import type {
  DimensionId,
  DimensionMeta,
  ExamType,
  TaskType,
} from "./types";

/**
 * 评分标准（rubric）对齐层。
 *
 * 雅思：TR / CC / LR / GRA，各 0-9，总分取四项平均后四舍五入到最近的半档
 *      （平均分以 .25 结尾进位到下一个半档，以 .75 结尾进位到下一个整档）。
 * 托福：任务完成 / 组织发展 / 语言使用 / 句式多样性，各 0-5，
 *      换算总分 = 四项平均 × 6，得到 0-30。
 */

export const IELTS_DIMENSIONS: DimensionMeta[] = [
  {
    id: "TR",
    label: "任务回应",
    labelEn: "Task Response / Achievement",
    max: 9,
    desc: "是否完整回应题目的每一个部分，立场是否清晰一致，论点是否有充分展开与例证。",
    looksFor: [
      "题目每个部分都有回应",
      "立场贯穿全文且前后一致",
      "主要论点有解释和具体例证",
      "字数达标且不跑题",
    ],
  },
  {
    id: "CC",
    label: "连贯与衔接",
    labelEn: "Coherence & Cohesion",
    max: 9,
    desc: "信息组织是否有逻辑，段落是否有中心，句间与段间衔接是否自然。",
    looksFor: [
      "每段只有一个中心论点",
      "衔接手段多样且不机械堆砌",
      "指代清晰（this / these / such / it）",
      "段落顺序符合论证推进逻辑",
    ],
  },
  {
    id: "LR",
    label: "词汇丰富度",
    labelEn: "Lexical Resource",
    max: 9,
    desc: "词汇量、搭配准确性、话题词伙的使用，以及拼写与词形变化。",
    looksFor: [
      "使用话题相关的高频学术词伙",
      "搭配地道（collocation 正确）",
      "避免重复使用同一个词",
      "语域恰当，不出现口语化表达",
    ],
  },
  {
    id: "GRA",
    label: "语法多样性与准确性",
    labelEn: "Grammatical Range & Accuracy",
    max: 9,
    desc: "句式结构的丰富程度，以及语法与标点的准确率。",
    looksFor: [
      "简单句、复合句、复杂句混用",
      "从句、分词、倒装等结构运用得当",
      "语法错误少且不影响理解",
      "标点使用规范",
    ],
  },
];

export const TOEFL_DIMENSIONS: DimensionMeta[] = [
  {
    id: "TF",
    label: "任务完成",
    labelEn: "Task Fulfillment",
    max: 5,
    desc: "是否有效回应题目要求，观点是否明确，论证是否切题且有细节支撑。",
    looksFor: [
      "直接回答问题，不绕弯",
      "观点有具体理由和例子",
      "综合写作完整转述听力与阅读的关系",
      "不引入与题目无关的内容",
    ],
  },
  {
    id: "OD",
    label: "组织发展",
    labelEn: "Organization & Development",
    max: 5,
    desc: "结构是否统一、推进是否连贯，论证是否有层次地展开。",
    looksFor: [
      "有清晰的开头—主体—结尾",
      "段落之间有过渡",
      "论点按逻辑顺序推进",
      "不出现与段落中心无关的句子",
    ],
  },
  {
    id: "LU",
    label: "语言使用",
    labelEn: "Language Use",
    max: 5,
    desc: "词汇选择的准确性与地道程度，以及语法错误对理解的影响。",
    looksFor: [
      "用词准确、搭配地道",
      "语法错误少，不影响理解",
      "避免中式英语",
      "语域保持学术一致",
    ],
  },
  {
    id: "SV",
    label: "句式多样性",
    labelEn: "Sentence Variety",
    max: 5,
    desc: "句长与句式结构的变化程度。",
    looksFor: [
      "长短句交替，节奏有变化",
      "使用从句、分词短语、倒装等结构",
      "句子开头方式多样",
      "不出现连续简单句堆砌",
    ],
  },
];

export function dimensionsFor(exam: ExamType): DimensionMeta[] {
  return exam === "ielts" ? IELTS_DIMENSIONS : TOEFL_DIMENSIONS;
}

export function dimensionMeta(
  exam: ExamType,
  id: DimensionId,
): DimensionMeta | undefined {
  return dimensionsFor(exam).find((d) => d.id === id);
}

export const TASK_LABELS: Record<TaskType, string> = {
  ielts_task1: "雅思 Task 1 · 图表描述",
  ielts_task2: "雅思 Task 2 · 议论文",
  toefl_integrated: "托福 · 综合写作",
  toefl_discussion: "托福 · 学术讨论",
};

export interface TaskRequirement {
  /** 官方最低字数，低于此值直接构成扣分项 */
  minWords: number;
  /** 建议字数上限 */
  recommendedMax: number;
  /** 题目指令类型，决定需要检查哪些结构性要素 */
  instructions: string[];
  /** 时间限制（分钟），用于给出练习建议 */
  minutes: number;
}

export const TASK_REQUIREMENTS: Record<TaskType, TaskRequirement> = {
  ielts_task1: {
    minWords: 150,
    recommendedMax: 220,
    instructions: [
      "overview",
      "max",
      "min",
      "trend",
      "comparison",
      "no_opinion",
    ],
    minutes: 20,
  },
  ielts_task2: {
    minWords: 250,
    recommendedMax: 340,
    instructions: [
      "position",
      "both_views",
      "discuss_both",
      "example",
      "conclusion",
    ],
    minutes: 40,
  },
  toefl_integrated: {
    minWords: 150,
    recommendedMax: 280,
    instructions: ["reading_points", "lecture_rebuttals", "no_opinion"],
    minutes: 20,
  },
  toefl_discussion: {
    minWords: 120,
    recommendedMax: 250,
    instructions: ["position", "peer_response", "example"],
    minutes: 10,
  },
};

/** 雅思总分：四项取平均后按官方规则进位到半档 */
export function ieltsOverall(scores: number[]): number {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 2) / 2;
}

/** 托福总分：四项平均（0-5）× 6 → 0-30，取整数 */
export function toeflOverall(scores: number[]): number {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 6);
}

export function overallScore(exam: ExamType, scores: number[]): number {
  return exam === "ielts" ? ieltsOverall(scores) : toeflOverall(scores);
}

export function formatOverall(exam: ExamType, score: number): string {
  return exam === "ielts" ? `Band ${score.toFixed(1)}` : `${score} / 30`;
}

/** 半档描述语，用于「提分幅度说明」的语气校准 */
export function bandDescriptor(exam: ExamType, score: number): string {
  if (exam === "ielts") {
    if (score >= 8) return "接近母语使用者水平，仅在极少数细节上失分";
    if (score >= 7) return "能灵活运用英语，偶有失误但不影响表达";
    if (score >= 6) return "基本能有效表达，但存在明显的准确性问题";
    if (score >= 5) return "表达受限，错误较多，读者需要费力理解";
    return "尚未形成有效表达，需要从基础句式重建";
  }
  if (score >= 4.5) return "接近满分档，论证充分、语言流畅";
  if (score >= 3.5) return "论证完整但展开不够充分，语言偶有失误";
  if (score >= 2.5) return "论证不够充分，语言错误开始影响理解";
  if (score >= 1.5) return "结构松散，语言问题严重干扰理解";
  return "未能有效回应任务";
}
