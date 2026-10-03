#!/usr/bin/env node
/**
 * 用 GitHub API 创建 release 并上传附件，带重试。
 *
 * 为什么需要它：本机到 github.com / api.github.com 的链路极不稳定
 * （整场开发里反复出现连接超时、HTTP2 被重置）。
 * `gh release create` 一次失败就得手动重来，所以这里做成可重试的。
 *
 * 用法：
 *   node scripts/release-via-api.mjs <tag> <标题> <发布说明文件> <附件...>
 *
 * 例：
 *   node scripts/release-via-api.mjs v0.7.0 "LexScore v0.7.0" docs/releases/v0.7.0.md ./LexScore.apk
 */
import { readFileSync, statSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const [tag, title, notesFile, ...assets] = process.argv.slice(2);
if (!tag || !title || !notesFile) {
  console.error(
    "用法：node scripts/release-via-api.mjs <tag> <标题> <发布说明文件> [附件...]",
  );
  process.exit(1);
}

const TOKEN = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
const SLUG = execFileSync("git", ["remote", "get-url", "origin"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .trim()
  .match(/github\.com[:/](.+?)(\.git)?$/)?.[1];
if (!SLUG) {
  console.error("无法从 origin 解析出 owner/repo");
  process.exit(1);
}

const notes = readFileSync(join(ROOT, notesFile), "utf8");

/** 带指数退避的重试 */
async function withRetry(label, fn, attempts = 8) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const result = await fn();
      if (i > 1) console.log(`  ✓ ${label}（第 ${i} 次尝试成功）`);
      return result;
    } catch (error) {
      lastError = error;
      const wait = Math.min(60, 3 * 2 ** (i - 1));
      console.log(`  · ${label} 第 ${i} 次失败：${String(error.message).slice(0, 80)}`);
      if (i < attempts) {
        console.log(`    等待 ${wait}s 后重试…`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
  }
  throw lastError;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
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
      throw new Error(`${options.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */

console.log(`仓库 ${SLUG}`);
console.log(`标签 ${tag}\n`);

// 1. 先看 release 是否已存在（上次可能创建成功但上传失败）
console.log("▸ 检查 release 是否已存在");
let release = await withRetry("查询 release", async () => {
  try {
    return await api(`/repos/${SLUG}/releases/tags/${tag}`);
  } catch (e) {
    if (String(e.message).includes("404")) return null;
    throw e;
  }
});

if (release) {
  console.log(`  已存在（id ${release.id}），跳过创建`);
} else {
  console.log("▸ 创建 release");
  release = await withRetry("创建 release", () =>
    api(`/repos/${SLUG}/releases`, {
      method: "POST",
      body: JSON.stringify({
        tag_name: tag,
        name: title,
        body: notes,
        target_commitish: "main",
        draft: false,
        prerelease: false,
      }),
    }),
  );
  console.log(`  ✓ 已创建：${release.html_url}`);
}

// 2. 上传附件
for (const asset of assets) {
  const full = join(ROOT, asset);
  const name = basename(asset);
  const size = statSync(full).size;

  const existing = (release.assets ?? []).find((a) => a.name === name);
  if (existing && existing.size === size) {
    console.log(`▸ ${name} 已存在且大小一致（${size} 字节），跳过`);
    continue;
  }

  if (existing) {
    console.log(`▸ ${name} 已存在但大小不同，先删除旧的`);
    await withRetry("删除旧附件", () =>
      api(`/repos/${SLUG}/releases/assets/${existing.id}`, { method: "DELETE" }),
    );
  }

  console.log(`▸ 上传 ${name}（${(size / 1024 / 1024).toFixed(1)} MB）`);
  const data = readFileSync(full);

  const uploaded = await withRetry(`上传 ${name}`, () =>
    api(
      `/repos/${SLUG}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: data,
      },
    ),
  );
  console.log(`  ✓ ${uploaded.browser_download_url}`);
}

console.log(`\n✓ 发布完成：${release.html_url}`);
