import {
  analyzeCohesion,
  analyzeGrammar,
  analyzeLexis,
  analyzeRelevance,
  analyzeTemplates,
  analyzeVariety,
  computeStats,
} from "../lib/engine/analyzers";
import { detectTopics } from "../lib/engine/lexicon";
import { segmentEssay } from "../lib/engine/segment";
import { CALIBRATION } from "../lib/calibration/corpus";

/**
 * 评分指标体检。
 *
 * 把每个样本的原始客观指标全部打印出来，用来回答：
 * **哪些指标真的能区分不同水平的作文？**
 *
 * 校准发现「所有分数都挤在 6.0–6.5」之后，第一步不是拍脑袋调参数，
 * 而是先看数据 —— 找出哪些指标本身就不具备区分度，再决定怎么改评分模型。
 */

interface Row {
  id: string;
  band: number;
  words: number;
  paras: number;
  avgLen: number;
  lenSd: number;
  ttr: number;
  awl: number;
  repeat: number;
  informal: number;
  cohDensity: number;
  cohCats: number;
  complex: number;
  errSents: number;
  relevance: number;
  originality: number;
}

const rows: Row[] = [];

for (const s of CALIBRATION) {
  const essay = s.essay.replace(/\r\n?/g, "\n").trim();
  const isTask1 = s.taskType === "ielts_task1";
  const { paragraphs, sentences } = segmentEssay(essay, isTask1);
  const topics = detectTopics(s.prompt, essay);
  const stats = computeStats(sentences, paragraphs);
  const lexis = analyzeLexis(
    sentences,
    paragraphs.map((p) => p.text),
    topics,
    stats.wordCount,
  );
  const cohesion = analyzeCohesion(sentences);
  const variety = analyzeVariety(sentences, stats);
  const grammar = analyzeGrammar(sentences);
  const relevance = analyzeRelevance(
    s.prompt,
    sentences,
    paragraphs,
    s.taskType,
    s.taskType === "toefl_integrated" && s.readingPoints?.length
      ? s.readingPoints.join(" ")
      : undefined,
  );
  const template = analyzeTemplates(sentences);

  rows.push({
    id: s.id,
    band: s.targetBand,
    words: stats.wordCount,
    paras: stats.paragraphCount,
    avgLen: stats.avgSentenceLength,
    lenSd: stats.lengthStdDev,
    ttr: stats.ttr,
    awl: lexis.awlDensity,
    repeat: lexis.repetitions.reduce((a, r) => a + r.count, 0),
    informal: lexis.informal.length,
    cohDensity: cohesion.density,
    cohCats: cohesion.categoriesUsed.length,
    complex: Math.round(variety.complexRatio * 100),
    errSents: grammar.errorSentences,
    relevance: relevance.score,
    originality: template.originality,
  });
}

/* ---------------- 明细表 ---------------- */

const H = [
  "样本".padEnd(13),
  "目标".padEnd(5),
  "词数".padStart(5),
  "段".padStart(3),
  "均长".padStart(5),
  "句长SD".padStart(7),
  "TTR".padStart(6),
  "AWL".padStart(5),
  "重复".padStart(5),
  "口语".padStart(5),
  "衔接密度".padStart(9),
  "衔接类".padStart(7),
  "复合%".padStart(6),
  "错句".padStart(5),
  "扣题".padStart(5),
  "原创度".padStart(7),
].join(" ");

console.log(`\n${H}`);
console.log("─".repeat(H.length + 4));

for (const r of rows) {
  console.log(
    [
      r.id.padEnd(13),
      String(r.band).padEnd(5),
      String(r.words).padStart(5),
      String(r.paras).padStart(3),
      String(r.avgLen).padStart(5),
      String(r.lenSd).padStart(7),
      String(r.ttr).padStart(6),
      String(r.awl).padStart(5),
      String(r.repeat).padStart(5),
      String(r.informal).padStart(5),
      String(r.cohDensity).padStart(9),
      String(r.cohCats).padStart(7),
      String(r.complex).padStart(6),
      String(r.errSents).padStart(5),
      String(r.relevance).padStart(5),
      String(r.originality).padStart(7),
    ].join(" "),
  );
}

/* ---------------- 区分度分析 ---------------- */

console.log(`\n${"─".repeat(70)}`);
console.log("指标区分度：在同一题型内，指标与目标分段是否单调相关");
console.log("─".repeat(70));

interface Metric {
  key: keyof Row;
  label: string;
  /** 期望方向：true = 越高越好，false = 越低越好 */
  higherIsBetter: boolean;
}

const METRICS: Metric[] = [
  { key: "lenSd", label: "句长标准差", higherIsBetter: true },
  { key: "ttr", label: "词汇多样度 TTR", higherIsBetter: true },
  { key: "awl", label: "学术词密度 AWL", higherIsBetter: true },
  { key: "repeat", label: "重复词次数", higherIsBetter: false },
  { key: "informal", label: "口语化表达", higherIsBetter: false },
  { key: "cohCats", label: "衔接手段类别数", higherIsBetter: true },
  { key: "complex", label: "复合句占比", higherIsBetter: true },
  { key: "errSents", label: "错误句数", higherIsBetter: false },
  { key: "originality", label: "模板原创度", higherIsBetter: true },
  { key: "relevance", label: "扣题度", higherIsBetter: true },
  { key: "words", label: "词数", higherIsBetter: true },
];

const groups = new Map<string, Row[]>();
for (let i = 0; i < rows.length; i += 1) {
  const task = CALIBRATION[i].taskType;
  const list = groups.get(task) ?? [];
  list.push(rows[i]);
  groups.set(task, list);
}

console.log(
  `\n${"题型".padEnd(22)}` + METRICS.map((m) => m.label.slice(0, 6).padStart(8)).join(""),
);
console.log("─".repeat(22 + METRICS.length * 8));

const useful: string[] = [];
const useless: string[] = [];

for (const [task, list] of groups) {
  if (list.length < 2) continue;
  const sorted = [...list].sort((a, b) => a.band - b.band);
  const marks: string[] = [];

  for (const m of METRICS) {
    const values = sorted.map((r) => Number(r[m.key]));
    let ok = true;
    for (let i = 1; i < values.length; i += 1) {
      const better = m.higherIsBetter
        ? values[i] >= values[i - 1]
        : values[i] <= values[i - 1];
      if (!better) ok = false;
    }
    marks.push((ok ? "✓" : "·").padStart(8));
    if (ok) {
      if (!useful.includes(m.label)) useful.push(m.label);
    } else if (!useless.includes(m.label)) {
      useless.push(m.label);
    }
  }
  console.log(task.padEnd(22) + marks.join(""));
}

console.log(`\n可区分：${useful.join("、") || "无"}`);
console.log(`不可区分：${useless.join("、") || "无"}`);
console.log(
  "\n注：✓ 表示在该题型内，指标随目标分段单调变化；" +
    "若某指标在所有题型都不可区分，说明它不该作为评分主依据。",
);
