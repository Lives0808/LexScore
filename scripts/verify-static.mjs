#!/usr/bin/env node
/**
 * 静态产物完整性校验。
 *
 * 检查 out/ 里每个页面的站内资源引用是否都真实存在。
 * 这一步对安卓尤其重要：WebView 加载不到 JS/CSS 就是一片白屏，
 * 而且不会在构建阶段报任何错。所以在打包进 APK 之前必须拦住。
 *
 * 用法：node scripts/verify-static.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

if (!existsSync(OUT)) {
  console.error("找不到 out/，请先运行 npm run build");
  process.exit(1);
}

/** 从 HTML 属性与内嵌的 RSC 载荷里抽取站内引用 */
function extractRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/(\/_next\/static\/[^"\\\s]+)/g)) refs.add(m[1]);

  return [...refs]
    .map((r) => r.split("?")[0].replace(/\\+$/, ""))
    .filter((r) => r.startsWith("/") && !r.startsWith("//"));
}

const pages = ["index.html", "report/index.html", "corpus/index.html", "404.html"];
const missing = [];
let checked = 0;

console.log("静态产物完整性校验\n");

for (const page of pages) {
  const path = join(OUT, page);
  if (!existsSync(path)) {
    missing.push(`缺少页面 ${page}`);
    continue;
  }

  const refs = extractRefs(readFileSync(path, "utf8"));
  for (const ref of refs) {
    let target = join(OUT, ref);
    try {
      if (statSync(target).isDirectory()) target = join(target, "index.html");
    } catch {
      // 不存在，下面统一记为缺失
    }
    if (!existsSync(target)) missing.push(`${page} → ${ref}`);
    checked += 1;
  }
  console.log(`  ${page.padEnd(22)} 站内引用 ${String(refs.length).padStart(3)} 个`);
}

console.log();

if (missing.length > 0) {
  console.error(`✗ ${missing.length} 个引用指向不存在的文件：`);
  for (const m of missing.slice(0, 20)) console.error(`    ${m}`);
  console.error(
    "\n这类问题在浏览器里表现为白屏或样式丢失，打包进 APK 前必须修复。",
  );
  process.exit(1);
}

// 引擎必须真的被打了进去，否则批改会静默失败
const chunksDir = join(OUT, "_next/static/chunks");
let engineBundled = false;
if (existsSync(chunksDir)) {
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(chunksDir)) {
    if (!f.endsWith(".js")) continue;
    if (readFileSync(join(chunksDir, f), "utf8").includes("rule-engine")) {
      engineBundled = true;
      break;
    }
  }
}

if (!engineBundled) {
  console.error("✗ 产物里找不到评分引擎（rule-engine），批改功能会失效");
  process.exit(1);
}

console.log(`✓ ${checked} 个站内资源引用全部有效`);
console.log("✓ 评分引擎已打包进产物");
