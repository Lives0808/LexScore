/**
 * LexScore 核心类型契约
 *
 * 引擎（规则分析 + 可选 LLM 增强）与 UI 之间的唯一约定。
 * 设计原则：任何一条评分结论，都必须能回溯到作文原文的某个句子。
 */

export type ExamType = "ielts" | "toefl";

export type TaskType =
  | "ielts_task1"
  | "ielts_task2"
  | "toefl_integrated"
  | "toefl_discussion";

/** 雅思 TR/CC/LR/GRA；托福 TF/OD/LU/SV */
export type DimensionId = "TR" | "CC" | "LR" | "GRA" | "TF" | "OD" | "LU" | "SV";

export type Severity = "high" | "medium" | "low";

/** 批注标签：直接对应产品要求的「学术写作常用搭配」「话题核心词伙」等 */
export type AnnotationTag =
  | "academic_collocation" // 学术写作常用搭配
  | "topic_lexis" // 话题核心词伙
  | "cohesion" // 逻辑衔接
  | "grammar" // 语法准确性
  | "sentence_variety" // 句式多样性
  | "register" // 语域（口语化 → 学术化）
  | "concision" // 冗长 → 简洁
  | "template" // 模板痕迹
  | "task_response"; // 任务回应 / 扣题

export type AnnotationStatus = "pending" | "accepted" | "ignored";

/**
 * 一条可接受 / 可忽略的修改建议。
 * `target` 必须在 `sentenceId` 指向的句子中原样出现，UI 才能做精确高亮。
 */
export interface Annotation {
  id: string;
  sentenceId: string;
  /** 原文中被替换的片段（原样引用） */
  target: string;
  /** 修改后的表达；整句重写时等于改写后的整句 */
  replacement: string;
  /** 该修改对应哪个评分项 */
  dimension: DimensionId;
  tag: AnnotationTag;
  severity: Severity;
  /** 提分幅度：按该评分项的量表计（雅思 0.5 = 半档；托福 0.5 = 半分） */
  lift: number;
  /** 提分幅度说明，如「此处增加逻辑衔接词，可提升 CC 项 0.5 分」 */
  liftText: string;
  /** 为什么这样改 */
  reason: string;
  /** 为什么更符合考官偏好 */
  examinerNote: string;
  status: AnnotationStatus;
}

export interface Sentence {
  id: string;
  /** 全文序号，0 起 */
  index: number;
  paragraphIndex: number;
  indexInParagraph: number;
  text: string;
  charStart: number;
  charEnd: number;
  wordCount: number;
}

export type ParagraphRole =
  | "introduction"
  | "overview"
  | "body"
  | "counter"
  | "conclusion"
  | "unknown";

export interface Paragraph {
  index: number;
  text: string;
  role: ParagraphRole;
  roleNote: string;
  sentenceIds: string[];
  wordCount: number;
}

/** 评分依据：直接定位到作文里对应的句子 */
export interface Evidence {
  sentenceId: string;
  quote: string;
  /** neutral 用于「客观指标陈述」这类不加不减的依据 */
  polarity: "positive" | "negative" | "neutral";
  /** 为什么这里加分 / 扣分 */
  comment: string;
  /** 支撑该判断的客观指标，如「衔接词密度 0.6/句」 */
  metric?: string;
  /** 对该维度分值的影响（雅思按 band，托福按 0-5 量表） */
  delta: number;
}

export interface DimensionScore {
  dimension: DimensionId;
  label: string;
  labelEn: string;
  score: number;
  max: number;
  bandLabel: string;
  summary: string;
  evidences: Evidence[];
}

export interface ConstraintItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  sentenceId?: string;
}

export interface CoverageItem {
  id: string;
  group: string;
  label: string;
  detail: string;
  status: "covered" | "partial" | "missing";
  evidenceSentenceId?: string;
  evidenceQuote?: string;
  note: string;
}

export interface CoverageReport {
  kind: "chart" | "integrated";
  title: string;
  summary: string;
  items: CoverageItem[];
  stats: { covered: number; partial: number; missing: number };
}

export interface KeywordHit {
  term: string;
  hit: boolean;
  count: number;
  kind: "topic" | "instruction";
}

export interface RelevanceReport {
  /** 扣题度 0-100 */
  score: number;
  verdict: string;
  keywords: KeywordHit[];
  offTopic: { sentenceId: string; quote: string; reason: string }[];
  position: {
    required: boolean;
    found: boolean;
    sentenceId?: string;
    quote?: string;
    note: string;
  };
}

export interface TemplateHit {
  id: string;
  phrase: string;
  sentenceId: string;
  quote: string;
  category: string;
  reason: string;
  suggestion: string;
  /** 对被判定维度分值的扣减 */
  penalty: number;
}

export interface TemplateReport {
  /** 原创度 0-100，越高越不像模板 */
  originality: number;
  verdict: string;
  hits: TemplateHit[];
}

export interface CorpusItem {
  id: string;
  kind: "phrase" | "sentence" | "error";
  text: string;
  /** error 类型时给出正确写法 */
  correction?: string;
  dimension: DimensionId;
  topic?: string;
  note: string;
  sourceReportId: string;
  createdAt: number;
}

/** 引擎在分析阶段产出的客观事实，是所有结论的原料 */
export interface Fact {
  code: string;
  dimension: DimensionId;
  severity: Severity;
  sentenceId?: string;
  quote?: string;
  detail: string;
  metric?: string;
  delta: number;
}

export interface Report {
  id: string;
  createdAt: number;
  exam: ExamType;
  taskType: TaskType;
  taskLabel: string;
  prompt: string;
  essay: string;
  wordCount: number;

  overall: number;
  overallMax: number;
  /** 「Band 6.5」/「24 / 30」 */
  overallLabel: string;
  bandLabel: string;
  summary: string;

  dimensions: DimensionScore[];
  sentences: Sentence[];
  paragraphs: Paragraph[];
  annotations: Annotation[];
  relevance: RelevanceReport;
  template: TemplateReport;
  coverage?: CoverageReport;
  constraints: ConstraintItem[];
  corpus: CorpusItem[];

  /** 生成来源，便于区分规则引擎与真实模型 */
  engine: string;
}

export interface GradeInput {
  exam: ExamType;
  taskType: TaskType;
  prompt: string;
  essay: string;
  /** 雅思 Task 1：图表数据（自由粘贴，引擎抽取数字做覆盖检测） */
  chartData?: string;
  /** 托福综合写作：阅读三个论点，每行一个 */
  readingPoints?: string[];
  /** 托福综合写作：听力三个反驳点，每行一个 */
  listeningPoints?: string[];
}

export interface DimensionMeta {
  id: DimensionId;
  label: string;
  labelEn: string;
  max: number;
  desc: string;
  /** 考官在这一项上具体看什么 */
  looksFor: string[];
}
