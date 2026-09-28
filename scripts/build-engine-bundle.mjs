#!/usr/bin/env node
/**
 * 把评分引擎打成一份单文件 JS，供原生安卓端通过 QuickJS 调用。
 *
 * 这样引擎源码只有 TypeScript 这一份，安卓端不需要维护 Kotlin 副本，
 * 也就不会出现「两端算法不一致」的问题。
 *
 * 用法：npm run engine:bundle
 */
import { build } from "esbuild";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "android-native/app/src/main/assets");
const OUT = join(ASSETS, "engine.js");

mkdirSync(dirname(OUT), { recursive: true });

const result = await build({
  entryPoints: [join(ROOT, "lib/engine/bundle-entry.ts")],
  outfile: OUT,
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "neutral",
  minify: false, // 保留可读性，便于排查线上问题
  legalComments: "none",
  logLevel: "warning",
});

if (result.errors.length > 0) {
  console.error(result.errors);
  process.exit(1);
}

const size = statSync(OUT).size;

/**
 * 示例作文另外导出一份 JSON 资源。
 *
 * 安卓端直接读这个文件解析，不走 QuickJS —— 少一条可能出错的链路，
 * 而且省去一次 JS 求值。
 */
// 在子进程里求值 bundle，取出示例数据
const { execFileSync } = await import("node:child_process");
const samplesJson = execFileSync(
  process.execPath,
  [
    "-e",
    `const fs=require('fs');globalThis.eval(fs.readFileSync(${JSON.stringify(OUT)},'utf8'));` +
      `process.stdout.write(LexScore.samples());`,
  ],
  { encoding: "utf8" },
);
const samplesPath = join(ASSETS, "samples.json");
writeFileSync(samplesPath, samplesJson);

console.log(`引擎 bundle 已生成`);
console.log(`  ${OUT.replace(`${ROOT}/`, "")}  ${(size / 1024).toFixed(0)} KB`);
console.log(`  ${samplesPath.replace(`${ROOT}/`, "")}  ${(samplesJson.length / 1024).toFixed(1)} KB`);
