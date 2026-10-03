import type {
  Annotation,
  CoverageReport,
  DimensionId,
  ExamType,
  Sentence,
  TemplateHit,
} from "../types";
import {
  type AnalysisBundle,
  type GrammarAnalysis,
  type CohesionAnalysis,
  type LexisAnalysis,
  type Stats,
  type VarietyAnalysis,
} from "./analyzers";
import {
  deriveMetrics,
  scoreDimensions,
  type DimensionIndex,
  type Metrics,
} from "./scoring";

/**
 * 三层 Agent 协同工作流。
 *
 * 用户提出的思路：不要用一个 Prompt 解决所有问题，而是拆成
 *   Agent 1  只做语言纠错，不评分
 *   Agent 2  只做逻辑与扣题分析，不纠语法
 *   Agent 3  只消费前两者的结论，对齐官方 Rubric 打分
 *
 * 这里把它落成一条**职责隔离的流水线**，关键约束是：
 * **评分层拿不到原文，只能看到前两层给出的结构化结论。**
 * 这样可以避免「看到一个语法错误就顺手压低逻辑分」这类串扰 ——
 * 规则引擎和 LLM 都适用同一条约束。
 *
 * 每个阶段的结论都会保留在报告里，用户能看到分数是怎么一步步得出的。
 */

/* ------------------------------------------------------------------ *
 * Agent 1 · 语言层
 * ------------------------------------------------------------------ */

export interface LanguageFindings {
  agent: "language";
  /** 单句最大问题数，用于控制批注噪声 */
  grammar: GrammarAnalysis;
  lexis: LexisAnalysis;
  variety: VarietyAnalysis;
  stats: Stats;
  /** 面向评分层的客观指标（纯测量，不含任何判断） */
  metrics: {
    errorRate: number;
    ttr: number;
    awlDensity: number;
    longWordRatio: number;
    repetitionTop: number;
    informalCount: number;
    lengthStdDev: number;
    complexRatio: number;
  };
  /** 本层产出的批注（只含语言类） */
  annotations: Annotation[];
}

export function runLanguageAgent(
  bundle: AnalysisBundle,
  annotations: Annotation[],
): LanguageFindings {
  const { grammar, lexis, variety, stats } = bundle;
  const metrics = deriveMetrics(bundle, 0, undefined);

  const LANGUAGE_TAGS = new Set([
    "grammar",
    "academic_collocation",
    "register",
    "concision",
    "sentence_variety",
  ]);

  return {
    agent: "language",
    grammar,
    lexis,
    variety,
    stats,
    metrics: {
      errorRate: metrics.errorRate,
      ttr: metrics.ttr,
      awlDensity: metrics.awlDensity,
      longWordRatio: metrics.longWordRatio,
      repetitionTop: metrics.repetitionTop,
      informalCount: metrics.informalCount,
      lengthStdDev: metrics.lengthStdDev,
      complexRatio: metrics.complexRatio,
    },
    annotations: annotations.filter((a) => LANGUAGE_TAGS.has(a.tag)),
  };
}

/* ------------------------------------------------------------------ *
 * Agent 2 · 语篇层
 * ------------------------------------------------------------------ */

export interface DiscourseFindings {
  agent: "discourse";
  cohesion: CohesionAnalysis;
  template: { hits: TemplateHit[]; fillerCount: number; structuralCount: number };
  coverage?: CoverageReport;
  /** 面向评分层的客观指标 */
  metrics: {
    cohesionCategories: number;
    mechanicalOpenerRatio: number;
    referenceRatio: number;
    paragraphCount: number;
    structuralCoverage: number;
    developmentScore: number;
    argumentDepth: number;
    positionFound: boolean;
    topicMatch: number;
    fillerCount: number;
    structuralTemplateCount: number;
    wordCountRatio: number;
  };
  /** 本层产出的批注（只含逻辑/扣题/模板类） */
  annotations: Annotation[];
}

export function runDiscourseAgent(
  bundle: AnalysisBundle,
  annotations: Annotation[],
  minWords: number,
  coverage?: CoverageReport,
): DiscourseFindings {
  const metrics = deriveMetrics(bundle, minWords, coverage);

  const DISCOURSE_TAGS = new Set([
    "cohesion",
    "topic_lexis",
    "template",
    "task_response",
  ]);

  return {
    agent: "discourse",
    cohesion: bundle.cohesion,
    template: {
      hits: bundle.template.hits,
      fillerCount: bundle.template.fillerCount,
      structuralCount: bundle.template.structuralCount,
    },
    coverage,
    metrics: {
      cohesionCategories: metrics.cohesionCategories,
      mechanicalOpenerRatio: metrics.mechanicalOpenerRatio,
      referenceRatio: metrics.referenceRatio,
      paragraphCount: metrics.paragraphCount,
      structuralCoverage: metrics.structuralCoverage,
      developmentScore: metrics.developmentScore,
      argumentDepth: metrics.argumentDepth,
      positionFound: metrics.positionFound,
      topicMatch: metrics.topicMatch,
      fillerCount: metrics.fillerCount,
      structuralTemplateCount: metrics.structuralTemplateCount,
      wordCountRatio: metrics.wordCountRatio,
    },
    annotations: annotations.filter((a) => DISCOURSE_TAGS.has(a.tag)),
  };
}

/* ------------------------------------------------------------------ *
 * Agent 3 · 评分层
 * ------------------------------------------------------------------ */

export interface Assessment {
  agent: "assessor";
  indices: DimensionIndex[];
  /** 本层实际使用的指标快照，便于审计 */
  usedMetrics: Metrics;
}

/**
 * 评分层。
 *
 * 契约：**只接收前两层的结论，不接触原文。**
 * 这一约束是三层拆分的意义所在 —— 评分不应该因为「看到了一个拼写错误」
 * 而顺带压低论证分，也不应该因为「句子写得漂亮」而抬高任务回应分。
 */
export function runAssessorAgent(
  language: LanguageFindings,
  discourse: DiscourseFindings,
  fullMetrics: Metrics,
  exam: ExamType,
  taskType: string,
): Assessment {
  // 显式合并两层指标：语言层管用词与句法，语篇层管组织与论证
  const merged: Metrics = {
    ...fullMetrics,
    errorRate: language.metrics.errorRate,
    ttr: language.metrics.ttr,
    awlDensity: language.metrics.awlDensity,
    longWordRatio: language.metrics.longWordRatio,
    repetitionTop: language.metrics.repetitionTop,
    informalCount: language.metrics.informalCount,
    lengthStdDev: language.metrics.lengthStdDev,
    complexRatio: language.metrics.complexRatio,
    cohesionCategories: discourse.metrics.cohesionCategories,
    mechanicalOpenerRatio: discourse.metrics.mechanicalOpenerRatio,
    referenceRatio: discourse.metrics.referenceRatio,
    paragraphCount: discourse.metrics.paragraphCount,
    structuralCoverage: discourse.metrics.structuralCoverage,
    developmentScore: discourse.metrics.developmentScore,
    argumentDepth: discourse.metrics.argumentDepth,
    positionFound: discourse.metrics.positionFound,
    topicMatch: discourse.metrics.topicMatch,
    fillerCount: discourse.metrics.fillerCount,
    structuralTemplateCount: discourse.metrics.structuralTemplateCount,
    wordCountRatio: discourse.metrics.wordCountRatio,
  };

  return {
    agent: "assessor",
    indices: scoreDimensions(merged, exam, taskType),
    usedMetrics: merged,
  };
}

/* ------------------------------------------------------------------ *
 * 编排
 * ------------------------------------------------------------------ */

export interface PipelineResult {
  language: LanguageFindings;
  discourse: DiscourseFindings;
  assessment: Assessment;
  /** 合并后的批注：语言层在前，语篇层在后 */
  annotations: Annotation[];
}

export function runPipeline(
  bundle: AnalysisBundle,
  annotations: Annotation[],
  exam: ExamType,
  taskType: string,
  minWords: number,
  coverage?: CoverageReport,
): PipelineResult {
  const language = runLanguageAgent(bundle, annotations);
  const discourse = runDiscourseAgent(bundle, annotations, minWords, coverage);
  const fullMetrics = deriveMetrics(bundle, minWords, coverage);
  const assessment = runAssessorAgent(language, discourse, fullMetrics, exam, taskType);

  return {
    language,
    discourse,
    assessment,
    annotations: [...language.annotations, ...discourse.annotations],
  };
}

/** 供报告页展示：每个 Agent 各自做了什么 */
export interface AgentTrace {
  agent: "language" | "discourse" | "assessor";
  title: string;
  summary: string;
  details: string[];
}

export function describeTrace(result: PipelineResult): AgentTrace[] {
  const { language, discourse, assessment } = result;

  const languageDetails = [
    `语法错误句 ${language.grammar.errorSentences} / ${language.stats.sentenceCount}`,
    `学术词密度 ${language.metrics.awlDensity}/100 词`,
    `词汇多样度 ${language.metrics.ttr.toFixed(3)}`,
    `最高重复次数 ${language.metrics.repetitionTop}`,
    `口语化表达 ${language.metrics.informalCount} 处`,
    `句长标准差 ${language.metrics.lengthStdDev}`,
    `复合句占比 ${Math.round(language.metrics.complexRatio * 100)}%`,
  ];

  const discourseDetails = [
    `衔接手段 ${discourse.metrics.cohesionCategories}/7 类`,
    `段落开头机械化 ${Math.round(discourse.metrics.mechanicalOpenerRatio * 100)}%`,
    `论证深度 ${discourse.metrics.argumentDepth.toFixed(1)}/100 词`,
    `填充式废话 ${discourse.metrics.fillerCount} 处`,
    `机械结构 ${discourse.metrics.structuralTemplateCount} 处`,
    discourse.coverage
      ? `覆盖检测 ${discourse.coverage.stats.covered} 覆盖 / ${discourse.coverage.stats.missing} 缺失`
      : "无覆盖检测（议论文）",
  ];

  const assessorDetails = assessment.indices.map(
    (i) => `${i.dimension} 质量指数 ${(i.index * 100).toFixed(0)}/100`,
  );

  return [
    {
      agent: "language",
      title: "语言层",
      summary: "只做语言测量与纠错，不参与评分判断。",
      details: languageDetails,
    },
    {
      agent: "discourse",
      title: "语篇层",
      summary: "只做逻辑、连贯与扣题分析，不纠语法。",
      details: discourseDetails,
    },
    {
      agent: "assessor",
      title: "评分层",
      summary: "只消费前两层的结构化结论，对齐官方 Rubric 打分 —— 不接触原文。",
      details: assessorDetails,
    },
  ];
}

export type { DimensionId, Sentence };
