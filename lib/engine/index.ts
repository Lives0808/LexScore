import type { Annotation, CoverageReport, GradeInput, Report } from "../types";
import { TASK_LABELS, TASK_REQUIREMENTS, formatOverall, overallScore } from "../rubrics";
import {
  analyzeCohesion,
  analyzeGrammar,
  analyzeLexis,
  analyzeRelevance,
  analyzeTemplates,
  analyzeVariety,
  buildAnnotations,
  buildCorpus,
  computeStats,
  deriveFacts,
  type AnalysisBundle,
} from "./analyzers";
import {
  analyzeChartCoverage,
  analyzeConstraints,
  analyzeIntegratedCoverage,
} from "./coverage";
import { detectTopics } from "./lexicon";
import { segmentEssay } from "./segment";
import { getProvider } from "./providers";
import { ruleProvider, scoreWithRules } from "./providers/mock";
import type { GradeContext, ScoringPlan } from "./providers/types";

export function newId(prefix = "r"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export interface GradeResult {
  report: Report;
  /** 回退到规则引擎时说明原因，便于排查 */
  notice?: string;
}

/**
 * 批改流程的前半段：从原始输入跑出全部客观分析结果。
 *
 * 抽成独立函数是为了让「同步」和「异步」两条入口共用同一条流水线 ——
 * 原生安卓端通过 QuickJS 调用，而 QuickJS 是同步求值的，用不了 Promise。
 */
function assemble(input: GradeInput) {
  const essay = input.essay.replace(/\r\n?/g, "\n").trim();
  if (!essay) throw new Error("作文内容为空");

  const isTask1 = input.taskType === "ielts_task1";
  const { paragraphs, sentences } = segmentEssay(essay, isTask1);

  if (sentences.length === 0) throw new Error("无法从作文中切分出句子，请检查内容");

  const topics = detectTopics(input.prompt, essay);
  const stats = computeStats(sentences, paragraphs);
  const cohesion = analyzeCohesion(sentences);
  const lexis = analyzeLexis(
    sentences,
    paragraphs.map((p) => p.text),
    topics,
    stats.wordCount,
  );
  const grammar = analyzeGrammar(sentences);
  const variety = analyzeVariety(sentences, stats);
  const template = analyzeTemplates(sentences);
  const relevance = analyzeRelevance(
    input.prompt,
    sentences,
    paragraphs,
    input.taskType,
    // 综合写作的「题目」只是一个通用指令，真正要覆盖的内容在阅读材料里
    input.taskType === "toefl_integrated" && input.readingPoints?.length
      ? input.readingPoints.join(" ")
      : undefined,
  );
  const annotations = buildAnnotations({
    sentences,
    paragraphs,
    taskType: input.taskType,
    exam: input.exam,
    topics,
    usedTopicPhrases: lexis.usedTopicPhrases,
    repetitions: lexis.repetitions,
    listeningPoints: input.listeningPoints,
    readingPoints: input.readingPoints,
  });

  let coverage: CoverageReport | undefined;
  if (isTask1) {
    coverage = analyzeChartCoverage(input.chartData ?? "", sentences);
  } else if (input.taskType === "toefl_integrated") {
    coverage = analyzeIntegratedCoverage(
      input.readingPoints ?? [],
      input.listeningPoints ?? [],
      sentences,
      paragraphs,
    );
  }

  const req = TASK_REQUIREMENTS[input.taskType];
  const constraints = analyzeConstraints(
    stats.wordCount,
    stats.sentenceCount,
    stats.paragraphCount,
    req.minWords,
    input.taskType,
  );

  const partial = {
    stats,
    cohesion,
    lexis,
    grammar,
    variety,
    template,
    relevance,
    topics,
    sentences,
    paragraphs,
    annotations,
  };

  const facts = deriveFacts(partial, input.exam, input.taskType, coverage);
  const bundle: AnalysisBundle = { ...partial, facts, corpus: [] };

  const ctx: GradeContext = {
    input: { ...input, essay },
    bundle,
    facts,
    coverage,
    constraints,
  };

  const reportId = newId("rep");

  /** 把评分方案组装成最终报告 */
  const buildReport = (plan: ScoringPlan): Report => {
    // 合并批注：规则引擎的确定性批注优先，模型批注补充其后
    const merged: Annotation[] = [...annotations];
    const seen = new Set(merged.map((a) => `${a.sentenceId}|${a.target.toLowerCase()}`));
    for (const a of plan.annotations ?? []) {
      const key = `${a.sentenceId}|${a.target.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
    merged.sort((a, b) => {
      const rank = (s: string) => (s === "high" ? 3 : s === "medium" ? 2 : 1);
      return rank(b.severity) - rank(a.severity) || b.lift - a.lift;
    });

    const corpus = buildCorpus(
      reportId,
      sentences,
      merged,
      grammar.errors,
      lexis,
      topics,
    );

    const report: Report = {
      id: reportId,
      createdAt: Date.now(),
      exam: input.exam,
      taskType: input.taskType,
      taskLabel: TASK_LABELS[input.taskType],
      prompt: input.prompt,
      essay,
      wordCount: stats.wordCount,
      overall: 0,
      overallMax: input.exam === "ielts" ? 9 : 30,
      overallLabel: "",
      bandLabel: "",
      summary: plan.summary,
      dimensions: plan.dimensions,
      sentences,
      paragraphs,
      annotations: merged,
      relevance,
      template,
      coverage,
      constraints,
      corpus,
      engine: plan.engine,
    };

    report.overall = overallScore(
      input.exam,
      plan.dimensions.map((d) => d.score),
    );
    report.overallLabel = formatOverall(input.exam, report.overall);
    report.bandLabel = report.overallLabel;

    return report;
  };

  return { ctx, buildReport };
}

/**
 * 同步批改：只用确定性规则评分器。
 *
 * 给原生安卓端（QuickJS）和任何不方便处理 Promise 的环境使用。
 * 因为不涉及网络与模型调用，结果完全可复现。
 */
export function gradeEssaySync(input: GradeInput): Report {
  const { ctx, buildReport } = assemble(input);
  return buildReport(scoreWithRules(ctx));
}

export async function gradeEssay(input: GradeInput): Promise<GradeResult> {
  const { ctx, buildReport } = assemble(input);

  const provider = getProvider();
  let plan: ScoringPlan;
  let notice: string | undefined;

  try {
    plan = await provider.score(ctx);
  } catch (error) {
    notice = `模型评分失败，已回退到规则评分器：${
      error instanceof Error ? error.message : String(error)
    }`;
    plan = await ruleProvider.score(ctx);
  }

  return { report: buildReport(plan), notice };
}
