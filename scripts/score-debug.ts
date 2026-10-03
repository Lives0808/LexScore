import {
  analyzeCohesion,
  analyzeGrammar,
  analyzeLexis,
  analyzeRelevance,
  analyzeTemplates,
  analyzeVariety,
  computeStats,
  type AnalysisBundle,
} from "../lib/engine/analyzers";
import { analyzeChartCoverage, analyzeIntegratedCoverage } from "../lib/engine/coverage";
import { detectTopics } from "../lib/engine/lexicon";
import { deriveMetrics, scoreDimensions } from "../lib/engine/scoring";
import { segmentEssay } from "../lib/engine/segment";
import { TASK_REQUIREMENTS } from "../lib/rubrics";
import { CALIBRATION } from "../lib/calibration/corpus";

/**
 * 评分指标明细。
 *
 * 校准发现某个维度分数异常时，用它把该维度的**每个指标原始值、归一化结果与权重**
 * 全部打出来。比反复猜「为什么这个分数不对」快得多。
 *
 * 用法：npx tsx scripts/score-debug.ts [样本 id]
 */
const only = process.argv[2];

for (const s of CALIBRATION) {
  if (only && s.id !== only) continue;

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

  const bundle = {
    stats,
    lexis,
    cohesion,
    variety,
    grammar,
    relevance,
    template,
    sentences,
    paragraphs,
    topics,
    annotations: [],
  } as unknown as AnalysisBundle;

  let coverage;
  if (isTask1) {
    coverage = analyzeChartCoverage(s.chartData ?? "", sentences);
  } else if (s.taskType === "toefl_integrated") {
    coverage = analyzeIntegratedCoverage(
      s.readingPoints ?? [],
      s.listeningPoints ?? [],
      sentences,
      paragraphs,
    );
  }

  const m = deriveMetrics(bundle, TASK_REQUIREMENTS[s.taskType].minWords, coverage);
  const indices = scoreDimensions(m, s.exam, s.taskType);

  const flagged = sentences.length
    ? (relevance.offTopic.length / sentences.length).toFixed(2)
    : "0";

  console.log(`\n${"═".repeat(78)}`);
  console.log(`▸ ${s.id}   目标 ${s.targetBand}`);
  console.log(
    `  跑题句 ${relevance.offTopic.length}/${sentences.length} (${flagged})  ` +
      `话题匹配 ${m.topicMatch.toFixed(2)}  结构覆盖 ${m.structuralCoverage.toFixed(2)}  ` +
      `展开度 ${m.developmentScore.toFixed(2)}  字数比 ${m.wordCountRatio.toFixed(2)}`,
  );
  if (coverage) {
    console.log(
      `  覆盖检测 ${coverage.stats.covered} 覆盖 / ${coverage.stats.partial} 部分 / ${coverage.stats.missing} 缺失`,
    );
  }

  for (const idx of indices) {
    console.log(`  ${idx.dimension}  综合指数 ${(idx.index * 100).toFixed(0)}/100`);
    for (const p of idx.parts) {
      console.log(
        `      ${p.name.padEnd(12)} 原始 ${String(p.raw).padEnd(12)} ` +
          `归一 ${p.score.toFixed(2)}  权重 ${p.weight}`,
      );
    }
  }
}
