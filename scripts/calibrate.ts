import { gradeEssaySync } from "../lib/engine";
import { CALIBRATION, type CalibrationSample } from "../lib/calibration/corpus";
import { dimensionsFor } from "../lib/rubrics";

/**
 * 评分校准验证。
 *
 * 回答一个最关键的问题：**引擎能不能稳定地区分不同水平的作文。**
 *
 * 三项检查：
 *   1. 单调性 —— 同一题型下，人工判定更高的作文，引擎给分也必须更高
 *   2. 区分度 —— 分数不能全挤在一个档位；Band 4.5 与 Band 8 至少要拉开 2 档
 *   3. 误差 —— 引擎分数与人工目标档位的平均偏差
 *
 * 任何一项不通过都会以非 0 退出码结束，方便接进 CI。
 */

interface Result {
  sample: CalibrationSample;
  actual: number;
  /** 换算到与引擎输出同一量纲的目标值（托福 0-5 → 0-30） */
  target: number;
  /** 统一到「档」的偏差：雅思 1 档 = 1.0，托福 1 档 = 6 分 */
  bandDiff: number;
  dimensions: { dimension: string; label: string; score: number; max: number }[];
}

const results: Result[] = [];

for (const sample of CALIBRATION) {
  const report = gradeEssaySync({
    exam: sample.exam,
    taskType: sample.taskType,
    prompt: sample.prompt,
    essay: sample.essay,
    chartData: sample.chartData,
    readingPoints: sample.readingPoints,
    listeningPoints: sample.listeningPoints,
  });

  // 托福的 targetBand 记在 0-5 量表上，引擎输出是 0-30，这里统一到 0-30
  const target = sample.exam === "ielts" ? sample.targetBand : sample.targetBand * 6;

  const bandDiff =
    sample.exam === "ielts"
      ? Math.abs(report.overall - sample.targetBand)
      : Math.abs(report.overall - sample.targetBand * 6) / 6;

  results.push({
    sample,
    actual: report.overall,
    target,
    bandDiff,
    dimensions: report.dimensions.map((d) => ({
      dimension: d.dimension,
      label: d.label,
      score: d.score,
      max: d.max,
    })),
  });
}

/* ------------------------------------------------------------------ *
 * 输出明细
 * ------------------------------------------------------------------ */

const line = "─".repeat(84);
console.log(`\n${line}`);
console.log("评分校准验证");
console.log(line);

for (const r of results) {
  const diff = r.actual - r.target;
  const mark = Math.abs(diff) <= 0.5 ? "✓" : Math.abs(diff) <= 1 ? "~" : "✗";
  const dims = r.dimensions.map((d) => `${d.dimension} ${d.score}`).join("  ");
  console.log(
    `${mark} ${r.sample.id.padEnd(12)} 目标 ${String(r.target).padEnd(4)} ` +
      `实际 ${String(r.actual).padEnd(4)} 偏差 ${(diff >= 0 ? "+" : "") + diff}`,
  );
  console.log(`    ${dims}`);
  console.log(`    ${r.sample.note}`);
}

/* ------------------------------------------------------------------ *
 * 检查 1：单调性
 * ------------------------------------------------------------------ */

console.log(`\n${line}`);
console.log("检查 1 · 单调性（同一题型内，目标更高的必须得分更高）");
console.log(line);

const byTask = new Map<string, Result[]>();
for (const r of results) {
  const list = byTask.get(r.sample.taskType) ?? [];
  list.push(r);
  byTask.set(r.sample.taskType, list);
}

let monotonicityFailures = 0;
for (const [task, list] of byTask) {
  const sorted = [...list].sort((a, b) => a.sample.targetBand - b.sample.targetBand);
  const violations: string[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const lower = sorted[i - 1];
    const higher = sorted[i];
    if (higher.actual <= lower.actual) {
      violations.push(
        `${lower.sample.id}(目标${lower.target}→${lower.actual}) ` +
          `不低于 ${higher.sample.id}(目标${higher.target}→${higher.actual})`,
      );
    }
  }
  if (violations.length === 0) {
    console.log(`✓ ${task.padEnd(22)} ${sorted.length} 篇，排序正确`);
  } else {
    monotonicityFailures += violations.length;
    console.log(`✗ ${task.padEnd(22)} 排序错误：`);
    for (const v of violations) console.log(`    ${v}`);
  }
}

/* ------------------------------------------------------------------ *
 * 检查 2：区分度
 * ------------------------------------------------------------------ */

console.log(`\n${line}`);
console.log("检查 2 · 区分度（分数不能全挤在一档）");
console.log(line);

let spreadFailures = 0;
for (const [task, list] of byTask) {
  if (list.length < 2) continue;
  const scores = list.map((r) => r.actual);
  const spread = Math.max(...scores) - Math.min(...scores);
  // 雅思按半档：至少拉开 2 档；托福按总分 0-30：至少拉开 6 分
  const isIelts = list[0].sample.exam === "ielts";
  const required = isIelts ? 2.0 : 6;
  const ok = spread >= required;
  if (!ok) spreadFailures += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${task.padEnd(22)} 跨度 ${spread.toFixed(1).padEnd(5)} ` +
      `（要求 ≥ ${required}）  ${scores.join(" / ")}`,
  );
}

/* ------------------------------------------------------------------ *
 * 检查 3：误差
 * ------------------------------------------------------------------ */

console.log(`\n${line}`);
console.log("检查 3 · 与人工目标档位的偏差");
console.log(line);
console.log("（托福按 1 档 = 6 分换算成同一量纲，否则 0-30 与 0-9 的误差没法直接比）");

// 统一到「档」：雅思 1 档 = 1.0 分，托福 1 档 = 6 分
const diffs = results.map((r) => r.bandDiff);
const meanAbsError = diffs.reduce((a, b) => a + b, 0) / diffs.length;
const maxError = Math.max(...diffs);
const within05 = diffs.filter((d) => d <= 0.5).length;
const within1 = diffs.filter((d) => d <= 1).length;

console.log(
  `  平均绝对偏差 ${meanAbsError.toFixed(2)} 档  最大偏差 ${maxError.toFixed(2)} 档`,
);
console.log(
  `  落在 ±0.5 档内 ${within05}/${diffs.length}   落在 ±1.0 档内 ${within1}/${diffs.length}`,
);

/**
 * 判定标准说明：
 * 人工标注本身有 ±0.5 档的不确定性（同一篇作文不同考官也会差半档），
 * 因此要求「全部落在 ±1 档内、平均不超过 0.5 档」是合理且可达成的目标。
 */
const errorOk = within1 === diffs.length && meanAbsError <= 0.5;
console.log(errorOk ? "✓ 偏差在可接受范围" : "✗ 偏差过大");

/* ------------------------------------------------------------------ *
 * 检查 4：维度区分度（强作文的优势要体现在具体维度上）
 * ------------------------------------------------------------------ */

console.log(`\n${line}`);
console.log("检查 4 · 维度区分度（雅思 Task 2：Band 8 的 LR / GRA 应明显高于 Band 5.5）");
console.log(line);

const t2 = results.filter((r) => r.sample.taskType === "ielts_task2");
const weakest = t2.find((r) => r.sample.id === "t2-band55");
const strongest = t2.find((r) => r.sample.id === "t2-band80");

let dimensionFailures = 0;
if (weakest && strongest) {
  const metas = dimensionsFor("ielts");
  for (const meta of metas) {
    const a = weakest.dimensions.find((d) => d.dimension === meta.id)?.score ?? 0;
    const b = strongest.dimensions.find((d) => d.dimension === meta.id)?.score ?? 0;
    const delta = b - a;
    const ok = delta >= 1.0;
    if (!ok) dimensionFailures += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${meta.label.padEnd(14)} ${a} → ${b}  差 ${delta.toFixed(1)}（要求 ≥ 1.0）`,
    );
  }
} else {
  console.log("缺少对照样本，跳过");
}

/* ------------------------------------------------------------------ *
 * 结论
 * ------------------------------------------------------------------ */

const failures =
  monotonicityFailures + spreadFailures + dimensionFailures + (errorOk ? 0 : 1);

console.log(`\n${line}`);
if (failures === 0) {
  console.log("✓ 校准通过：引擎能把不同水平的作文稳定拉开档次");
  process.exit(0);
} else {
  console.log(`✗ 校准未通过：${failures} 项检查失败`);
  console.log("  说明评分信号需要调整 —— 见上方具体项目");
  process.exit(1);
}
