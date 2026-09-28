#!/usr/bin/env node
/**
 * 当 github.com 被墙、git push 连不上时，改走 GitHub API 推送提交。
 *
 * 背景：`github.com:443` 走的是 git 的 HTTPS 协议，容易被阻断；
 * 而 `api.github.com` 通常仍然可达（`gh` 命令能用就是这个原因）。
 * 这个脚本用 Git Data API 完成同样的推送：
 *
 *   1. 取远端 main 的提交与 tree
 *   2. 逐个创建 blob（二进制走 base64，文本直接内联进 tree）
 *   3. 创建新 tree / 新 commit
 *   4. 更新 refs/heads/main
 *
 * 用法：
 *   node scripts/push-via-api.mjs            # 推送当前分支到同名远端分支
 *   node scripts/push-via-api.mjs --dry-run  # 只打印将要提交的内容
 *
 * 需要：已登录的 gh CLI（用它的 token 调 API）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function ghToken() {
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
  } catch {
    console.error("无法获取 gh token，请先运行 gh auth login");
    process.exit(1);
  }
}

const TOKEN = ghToken();

async function api(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

/** 相对远端分支的变更清单 */
function collectChanges(remoteRef) {
  const status = git("diff", "--name-status", `${remoteRef}..HEAD`)
    .split("\n")
    .filter(Boolean);

  const changes = [];
  for (const line of status) {
    const [code, ...rest] = line.split("\t");
    const path = rest.join("\t");
    changes.push({ code: code[0], path });
  }
  return changes;
}

async function main() {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const slug = git("remote", "get-url", "origin").match(/github\.com[:/](.+?)(\.git)?$/)?.[1];
  if (!slug) throw new Error("无法从 origin 解析出 owner/repo");

  console.log(`仓库   ${slug}`);
  console.log(`分支   ${branch}`);

  const ref = await api(`/repos/${slug}/git/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await api(`/repos/${slug}/git/commits/${baseCommitSha}`);
  console.log(`远端   ${baseCommitSha.slice(0, 10)}`);
  console.log(`本地   ${git("rev-parse", "HEAD").slice(0, 10)}`);

  const changes = collectChanges(`origin/${branch}`);
  if (changes.length === 0) {
    console.log("\n没有需要推送的变更。");
    return;
  }

  const added = changes.filter((c) => c.code !== "D");
  const deleted = changes.filter((c) => c.code === "D");
  console.log(`\n变更   ${added.length} 个文件，删除 ${deleted.length} 个`);

  if (DRY_RUN) {
    for (const c of changes) console.log(`  ${c.code}  ${c.path}`);
    return;
  }

  /* --- 1. 二进制文件先单独建 blob --- */
  const binaryPaths = new Set(
    git("diff", "--numstat", `origin/${branch}..HEAD`)
      .split("\n")
      .filter(Boolean)
      .filter((l) => l.startsWith("-\t"))
      .map((l) => l.split("\t").slice(2).join("\t")),
  );

  const blobShas = new Map();
  const binaries = added.filter((c) => binaryPaths.has(c.path));
  console.log(`\n上传二进制 blob（${binaries.length} 个）…`);
  for (const [i, c] of binaries.entries()) {
    const buf = readFileSync(join(ROOT, c.path));
    const blob = await api(`/repos/${slug}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: buf.toString("base64"), encoding: "base64" }),
    });
    blobShas.set(c.path, blob.sha);
    process.stdout.write(`\r  ${i + 1}/${binaries.length} ${c.path.slice(0, 50)}`.padEnd(80));
  }
  process.stdout.write("\r".padEnd(80) + "\r");

  /* --- 2. 组装 tree（文本内联，二进制引用 blob，删除用 sha:null） --- */

  // 本地 origin/<branch> 引用可能落后于真正的远端状态（例如上一次是走 API 推的），
  // 于是把「其实早就删掉了」的文件又删一遍，导致 422 BadObjectState。
  // 因此先拉取远端当前 tree，只对真实存在的路径发删除指令。
  const remotePaths = new Set();
  if (deleted.length > 0) {
    const baseTree = await api(
      `/repos/${slug}/git/trees/${baseCommit.tree.sha}?recursive=1`,
    );
    for (const entry of baseTree.tree ?? []) {
      if (entry.type === "blob") remotePaths.add(entry.path);
    }
  }

  const tree = [];
  for (const c of deleted) {
    if (!remotePaths.has(c.path)) {
      console.log(`  跳过（远端已不存在）：${c.path}`);
      continue;
    }
    tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
  }
  for (const c of added) {
    const full = join(ROOT, c.path);
    const mode = statSync(full).mode & 0o111 ? "100755" : "100644";
    if (blobShas.has(c.path)) {
      tree.push({ path: c.path, mode, type: "blob", sha: blobShas.get(c.path) });
    } else {
      tree.push({
        path: c.path,
        mode,
        type: "blob",
        content: readFileSync(full, "utf8"),
      });
    }
  }
  console.log(`创建 tree（${tree.length} 个条目）…`);

  const newTree = await api(`/repos/${slug}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });

  /* --- 3. 创建 commit --- */
  const message = git("log", "-1", "--format=%B");
  const newCommit = await api(`/repos/${slug}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [baseCommitSha],
    }),
  });
  console.log(`创建 commit ${newCommit.sha.slice(0, 10)}`);

  /* --- 4. 更新 ref --- */
  await api(`/repos/${slug}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  console.log(`\n✓ 已推送到 ${slug}:${branch}`);
  console.log(`  ${newCommit.sha}`);
  console.log(
    "\n注意：本地 git 与远端已一致，但本地 origin 引用尚未更新，可执行 git fetch origin 同步。",
  );
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
