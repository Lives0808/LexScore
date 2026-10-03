import type { CoverageReport, DimensionId, ExamType } from "../types";
import type { AnalysisBundle } from "./analyzers";

/**
 * 指标驱动的评分模型。
 *
 * 背景：早期版本用「基准分 + 小幅度加减」来算分，校准测试（scripts/calibrate.ts）
 * 证明它完全无法区分水平 —— Band 4.5 与 Band 8 的作文都落在 6.0–6.5。
 *
 * 重做后的思路：
 *   1. 每个维度由若干**可测量的指标**加权合成，而不是靠一堆零散的正负信号
 *   2. 权重与锚点来自实测：只采用在校准语料上**真正单调可分**的指标
 *   3. 每个指标用分段线性锚点归一化到 0–1，再映射到官方量表
 *
 * 三条来自实测的设计原则：
 *   · 句长标准差 / TTR / 复合句占比 是最能区分档次的三个指标 → 给高权重
 *   · 「扣题度」不能只看字面关键词 —— 高分作文必然同义替换，
 *     字面命中反而更低。改为「话题域匹配 + 结构要素覆盖」
 *   · 「衔接词密度」不能越低越差 —— 母语级写作靠指代与平行结构，
 *     显性衔接词本来就少。改为看衔接手段的**多样性**与段落组织
 */

/* ------------------------------------------------------------------ *
 * 归一化：分段线性锚点
 * ------------------------------------------------------------------ */

type Anchor = readonly [value: number, score: number];

/** 按锚点把原始指标映射到 0–1 */
function normalize(value: number, anchors: readonly Anchor[]): number {
  if (anchors.length === 0) return 0;
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];

  for (let i = 1; i < anchors.length; i += 1) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** 加权平均 */
function blend(parts: { score: number; weight: number }[]): number {
  const total = parts.reduce((a, p) => a + p.weight, 0);
  if (total <= 0) return 0.5;
  return parts.reduce((a, p) => a + p.score * p.weight, 0) / total;
}

/* ------------------------------------------------------------------ *
 * 锚点表
 *
 * 数值全部来自 scripts/metrics-audit.ts 在 lib/calibration/corpus.ts 上的实测。
 * 例如句长标准差：Band 4.5 实测 3.6，Band 8 实测 7.5。
 * ------------------------------------------------------------------ */

const ANCHORS = {
  /** 句长标准差：最能区分档次的指标 */
  lengthStdDev: [
    [2.0, 0.0],
    [3.5, 0.18],
    [4.5, 0.35],
    [5.5, 0.55],
    [6.5, 0.78],
    [7.5, 0.92],
    [9.0, 1.0],
  ],
  /** 词汇多样度（去重实词占比） */
  ttr: [
    [0.45, 0.0],
    [0.55, 0.15],
    [0.63, 0.33],
    [0.72, 0.58],
    [0.8, 0.8],
    [0.88, 1.0],
  ],
  /** 复合句占比 */
  complexRatio: [
    [0.15, 0.0],
    [0.3, 0.15],
    [0.44, 0.38],
    [0.6, 0.62],
    [0.75, 0.88],
    [0.9, 1.0],
  ],
  /** 学术词表密度（每 100 词） */
  awlDensity: [
    [0.0, 0.0],
    [1.0, 0.2],
    [2.5, 0.45],
    [4.0, 0.65],
    [6.0, 0.85],
    [9.0, 1.0],
  ],
  /** 长词占比（≥8 字母的实词比例），作为词汇复杂度的辅助代理 */
  longWordRatio: [
    [0.08, 0.0],
    [0.14, 0.25],
    [0.22, 0.55],
    [0.3, 0.8],
    [0.4, 1.0],
  ],
  /** 错误句占比 */
  errorRate: [
    [0.0, 1.0],
    [0.05, 0.9],
    [0.12, 0.72],
    [0.2, 0.5],
    [0.32, 0.25],
    [0.5, 0.0],
  ],
  /** 衔接手段类别数（共 7 类） */
  cohesionCategories: [
    [1, 0.0],
    [2, 0.2],
    [3, 0.38],
    [4, 0.58],
    [5, 0.78],
    [6, 0.92],
    [7, 1.0],
  ],
  /** 段落数（雅思 Task 2 理想 4–5 段） */
  paragraphCount: [
    [1, 0.0],
    [2, 0.2],
    [3, 0.55],
    [4, 0.85],
    [5, 1.0],
    [8, 0.9],
  ],
  /** 字数达标率（相对官方最低要求） */
  wordCountRatio: [
    [0.5, 0.0],
    [0.7, 0.15],
    [0.85, 0.4],
    [1.0, 0.72],
    [1.2, 0.9],
    [1.5, 1.0],
  ],
  /** 平均句长 */
  avgSentenceLength: [
    [7, 0.0],
    [10, 0.25],
    [13, 0.5],
    [17, 0.8],
    [21, 0.95],
    [27, 0.85],
  ],
} as const;

/* ------------------------------------------------------------------ *
 * 派生指标
 * ------------------------------------------------------------------ */

export interface Metrics {
  wordCount: number;
  minWords: number;
  wordCountRatio: number;
  paragraphCount: number;
  avgSentenceLength: number;
  lengthStdDev: number;
  ttr: number;
  awlDensity: number;
  longWordRatio: number;
  repetitionTop: number;
  informalCount: number;
  linkerDensity: number;
  cohesionCategories: number;
  mechanicalOpenerRatio: number;
  referenceRatio: number;
  complexRatio: number;
  structureVariety: number;
  errorRate: number;
  topicMatch: number;
  structuralCoverage: number;
  positionFound: boolean;
  offTopicRatio: number;
  developmentScore: number;
  argumentDepth: number;
  mechanicalTemplate: boolean;
  templateCohesionHits: number;
  templateOriginality: number;
}

const LONG_WORD_MIN = 8;

export function deriveMetrics(
  bundle: AnalysisBundle,
  minWords: number,
  coverage?: CoverageReport,
): Metrics {
  const {
    stats,
    lexis,
    cohesion,
    grammar,
    variety,
    template,
    sentences,
    relevance,
    paragraphs,
  } = bundle;

  // 长词占比：词汇复杂度的一个粗糙但列表无关的代理指标
  const contentWords = sentences
    .flatMap((s) => s.text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
    .filter((w) => w.length >= 4);
  const longWords = contentWords.filter((w) => w.length >= LONG_WORD_MIN);
  const longWordRatio = contentWords.length ? longWords.length / contentWords.length : 0;

  // 指代衔接：使用 this / these / such / which 等把句子串起来的比例
  const refPattern =
    /\b(this|these|those|such|which|the former|the latter|it is|therefore)\b/i;
  const referenceSentences = sentences.filter((s) => refPattern.test(s.text)).length;
  const referenceRatio = sentences.length ? referenceSentences / sentences.length : 0;

  // 句型种类：结构检测里命中的种类数
  const structureVariety =
    variety.structures.filter((s) => s.found).length /
    Math.max(1, variety.structures.length);

  // 错误句占比：用比例而非绝对数，避免短作文因「句子少」而显得干净
  const errorRate = sentences.length ? grammar.errorSentences / sentences.length : 0;

  // 论证展开度：主体段平均句数 + 是否出现具体例证
  const bodyParagraphs = bundle.paragraphs.filter((p) => p.role === "body");
  // 用词数而不是句子数：高分作文句子更长、信息密度更高，
  // 按句子数衡量会反过来惩罚好作文（实测 Band 8 每段句子数少于 Band 5.5）。
  const avgBodyWords = bodyParagraphs.length
    ? bodyParagraphs.reduce((a, p) => a + p.wordCount, 0) / bodyParagraphs.length
    : 0;
  const hasExample =
    /\b(for example|for instance|such as|a case in point|to illustrate)\b/i.test(
      bundle.paragraphs.map((p) => p.text).join(" "),
    );

  /**
   * 论证深度。
   *
   * 校准发现：Band 5.5 与 Band 8 都「有立场、有分段、有话可说」，
   * 单看结构指标区分不出来。真正的差别在论证方式：
   *   · 会不会用因果链把理由推下去（therefore / the consequence is / which means）
   *   · 会不会主动让步再反驳（while…, I would argue；yet…）
   *   · 会不会用限定语避免绝对化（arguably / tends to / in most cases）
   *
   * 这三类都是可正则检测的形式特征，不需要语义理解。
   * 按每 100 词归一，避免长作文占便宜。
   */
  const essayText = paragraphs.map((p) => p.text).join(" ");
  // 刻意不含 because —— 弱作文反而高频使用 because 堆砌理由，
  // 把它算作「论证深度」会让 Band 5.5 反超 Band 8。
  const reasoning =
    essayText.match(
      /\b(therefore|consequently|as a result|which means|the consequence|hence|thus|leads? to|results? in|it follows)\b/gi,
    )?.length ?? 0;
  const concession =
    essayText.match(
      /\b(while|although|though|despite|admittedly|it is true that|granted|one might argue|it could be argued|yet|critics? (say|argue))\b/gi,
    )?.length ?? 0;
  const hedging =
    essayText.match(
      /\b(arguably|to some extent|in most cases|broadly|tends? to|is likely to|may well|seldom|rarely)\b/gi,
    )?.length ?? 0;
  const argumentDepth =
    stats.wordCount > 0
      ? ((reasoning + concession * 1.2 + hedging * 1.5) / stats.wordCount) * 100
      : 0;
  const developmentScore = Math.min(
    1,
    (avgBodyWords / 90) * 0.8 + (hasExample ? 0.2 : 0),
  );

  // 话题匹配：不只看字面命中，还看「作文被判定属于哪些话题」
  // 高分作文会用 tertiary education 替代 university，用 funded by the state 替代 free，
  // 纯字面匹配会惩罚这种同义替换，所以这里把话题域匹配作为主信号。
  const promptTopics = bundle.topics.length;
  const keywordHitRatio =
    relevance.keywords.length > 0
      ? relevance.keywords.filter((k) => k.hit && k.kind === "topic").length /
        Math.max(1, relevance.keywords.filter((k) => k.kind === "topic").length)
      : 0;
  const topicMatch = promptTopics > 0 ? Math.max(0.75, keywordHitRatio) : keywordHitRatio;

  /**
   * 结构要素覆盖。
   *
   * 优先级：覆盖检测 > 题目指令推断。
   * 覆盖检测是任务回应项最实在的依据 ——
   * 雅思小作文有没有写 Overview、托福综合有没有还原听力反驳点，
   * 都由它判定，而不是靠猜。
   */
  let structuralCoverage: number;
  if (coverage && coverage.items.length > 0) {
    const structural = coverage.items.filter(
      (i) =>
        i.group === "结构要点" || i.group.startsWith("论点") || i.group === "转述框架",
    );
    const pool = structural.length > 0 ? structural : coverage.items;
    const earned = pool.reduce(
      (a, i) => a + (i.status === "covered" ? 1 : i.status === "partial" ? 0.45 : 0),
      0,
    );
    structuralCoverage = earned / pool.length;

    // 雅思小作文缺 Overview 是硬伤，直接压上限
    const noOverview =
      coverage.kind === "chart" &&
      coverage.items.some((i) => i.label.includes("Overview") && i.status === "missing");
    if (noOverview) structuralCoverage = Math.min(structuralCoverage, 0.35);

    // 托福综合写作遗漏听力反驳点同样致命
    const missingRebuttal = coverage.items.some(
      (i) => i.id.startsWith("listen-") && i.status === "missing",
    );
    if (missingRebuttal) structuralCoverage = Math.min(structuralCoverage, 0.45);
  } else {
    const instructionKeywords = relevance.keywords.filter(
      (k) => k.kind === "instruction",
    );
    structuralCoverage = instructionKeywords.length
      ? 0.5 + (relevance.position.found ? 0.35 : 0)
      : relevance.position.found
        ? 0.85
        : 0.4;
  }

  const offTopicRatio = sentences.length
    ? relevance.offTopic.length / sentences.length
    : 0;

  // 机械模板：模板命中里属于「填充式废话」的那几类
  const mechanicalTemplate = template.hits.some((h) =>
    ["谚语套话", "万能开头", "诉诸常识", "两分法套话"].includes(h.category),
  );

  /**
   * 模板化的衔接语数量。
   *
   * 必要性：Band 5.5 的作文靠 Firstly / On the other hand / Last but not least
   * 堆出「衔接手段类别多」，CC 反而高于 Band 8 —— 因为后者靠指代和
   * 段落推进，显性衔接词本来就少。
   * 衔接手段的**多样性**要在扣掉模板之后才算数。
   */
  const templateCohesionHits = template.hits.filter((h) =>
    ["模板衔接", "机械列举", "模板过渡", "中式总结"].includes(h.category),
  ).length;

  /**
   * 段落开头的机械化程度。
   *
   * 这是区分「组织能力强」与「套模板」最直接的形式特征：
   *   Band 5.5 —— 五段分别以 With the rapid development / Firstly /
   *               Secondly / On the other hand / In a word 开头，5/5 机械化
   *   Band 8   —— 以 The proposition that… / The case for… / Yet… /
   *               A more defensible arrangement… 开头，只有 1/5
   *
   * 高分作文的段落开头承载信息（点出本段论点），
   * 低分作文的段落开头只是序号标签。
   */
  const openerPattern =
    /^(firstly|first|secondly|second|thirdly|third|finally|lastly|last but not least|in a word|in conclusion|to conclude|moreover|furthermore|besides|on the other hand|however|with the rapid development|every coin|as we all know|it is widely)/i;
  const mechanicalOpeners = paragraphs.filter((p) =>
    openerPattern.test(p.text.trimStart()),
  ).length;
  const mechanicalOpenerRatio = paragraphs.length
    ? mechanicalOpeners / paragraphs.length
    : 0;

  return {
    wordCount: stats.wordCount,
    minWords,
    wordCountRatio: minWords > 0 ? stats.wordCount / minWords : 1,
    paragraphCount: stats.paragraphCount,
    avgSentenceLength: stats.avgSentenceLength,
    lengthStdDev: stats.lengthStdDev,
    ttr: stats.ttr,
    awlDensity: lexis.awlDensity,
    longWordRatio,
    repetitionTop: lexis.repetitions[0]?.count ?? 0,
    informalCount: lexis.informal.length,
    linkerDensity: cohesion.density,
    cohesionCategories: cohesion.categoriesUsed.length,
    mechanicalOpenerRatio,
    referenceRatio,
    complexRatio: variety.complexRatio,
    structureVariety,
    errorRate,
    topicMatch,
    structuralCoverage,
    positionFound: relevance.position.found,
    offTopicRatio,
    developmentScore,
    argumentDepth,
    mechanicalTemplate,
    templateCohesionHits,
    templateOriginality: template.originality,
  };
}

/* ------------------------------------------------------------------ *
 * 各维度的合成
 * ------------------------------------------------------------------ */

/** 雅思：把 0–1 的质量指数映射到 3.0–9.0；托福：映射到 1.0–5.0 */
function toScale(index: number, exam: ExamType): number {
  const clamped = Math.max(0, Math.min(1, index));
  return exam === "ielts" ? 3.0 + clamped * 6.0 : 1.0 + clamped * 4.0;
}

export interface DimensionIndex {
  dimension: DimensionId;
  /** 0–1 的质量指数 */
  index: number;
  /** 参与合成的指标明细，用于生成「评分依据」 */
  parts: { name: string; raw: string; score: number; weight: number }[];
}

export function scoreDimensions(
  m: Metrics,
  exam: ExamType,
  taskType: string,
): DimensionIndex[] {
  const n = normalize;
  const A = ANCHORS;
  const isIelts = exam === "ielts";

  const taskId: DimensionId = isIelts ? "TR" : "TF";
  const cohId: DimensionId = isIelts ? "CC" : "OD";
  const lexId: DimensionId = isIelts ? "LR" : "LU";

  /* ---------- 任务回应 / 任务完成 ---------- */
  // 这一项几乎全是结构性的：有没有立场、有没有展开、有没有跑题。
  // 刻意不把「字面关键词命中」作为主信号 —— 那会惩罚同义替换。
  /**
   * 任务回应项**按题型分别组装**。
   *
   * 雅思小作文考的是 Task Achievement（有没有写 Overview、数据覆盖全不全），
   * 大作文考的是 Task Response（立场、论证展开）；
   * 托福综合写作考的是听力还原度，学术讨论才考立场与展开。
   * 用同一套指标打所有题型，是小作文长期被误判的根因。
   */
  const isChart = taskType === "ielts_task1";
  const isIntegrated = taskType === "toefl_integrated";

  const coverageScore = n(m.structuralCoverage, [
    [0, 0],
    [0.35, 0.2],
    [0.6, 0.5],
    [0.8, 0.78],
    [1, 0.95],
  ]);

  const taskParts: { score: number; weight: number }[] = [];

  if (isChart || isIntegrated) {
    // 数据覆盖 / 听力还原度是绝对主信号，不设立场要求
    taskParts.push({ score: coverageScore, weight: 0.56 });
    taskParts.push({ score: n(m.wordCountRatio, A.wordCountRatio), weight: 0.26 });
    taskParts.push({
      score: n(m.developmentScore, [
        [0, 0],
        [0.5, 0.4],
        [0.75, 0.72],
        [1, 1],
      ]),
      weight: 0.18,
    });
  } else {
    // 议论文：论证展开与结构覆盖并重，立场是及格线
    taskParts.push({
      score: n(m.developmentScore, [
        [0, 0],
        [0.35, 0.2],
        [0.55, 0.45],
        [0.75, 0.75],
        [0.95, 1],
      ]),
      weight: 0.26,
    });
    // 论证深度：区分「有话说」和「说透」的关键，权重仅次于展开度
    taskParts.push({
      score: n(m.argumentDepth, [
        [0.4, 0],
        [1.2, 0.25],
        [2.0, 0.55],
        [3.0, 0.82],
        [4.5, 1],
      ]),
      weight: 0.24,
    });
    taskParts.push({ score: n(m.wordCountRatio, A.wordCountRatio), weight: 0.16 });
    taskParts.push({ score: coverageScore, weight: 0.16 });
    taskParts.push({ score: m.positionFound ? 0.88 : 0.3, weight: 0.12 });
    taskParts.push({
      score: n(m.topicMatch, [
        [0, 0],
        [0.5, 0.25],
        [0.75, 0.6],
        [0.9, 0.85],
        [1, 1],
      ]),
      weight: 0.06,
    });
  }

  const taskIndex = blend(taskParts);

  /**
   * 唯一的扣分项是机械模板。
   *
   * 曾经的「跑题句比例」扣分被移除了 —— 它基于字面关键词重叠判定，
   * 而高分作文必然做同义替换，结果 Band 8 的作文被标记 4/16 句跑题、
   * 扣掉三成指数，TR 反而低于 Band 5.5。
   * 这个信号现在只作为界面提示，不参与评分。
   */
  const taskPenalty = m.mechanicalTemplate ? 0.1 : 0;

  /* ---------- 连贯与衔接 / 组织发展 ---------- */
  // 关键修正：不再把「显性衔接词密度低」当缺点。
  // 母语级写作靠指代、平行结构与段落推进，显性衔接词本来就少，
  // 所以密度只作为辅助，多样性与段落组织才是主信号。
  const cohesionIndex = blend([
    {
      // 扣掉模板化衔接后才是真实的衔接手段多样性
      score: n(
        Math.max(1, m.cohesionCategories - m.templateCohesionHits),
        A.cohesionCategories,
      ),
      weight: 0.3,
    },
    { score: n(m.paragraphCount, A.paragraphCount), weight: 0.24 },
    // 段落开头是否机械化：本项最强的区分指标
    {
      score: n(m.mechanicalOpenerRatio, [
        [0, 1],
        [0.2, 0.85],
        [0.4, 0.55],
        [0.6, 0.3],
        [0.8, 0.12],
        [1, 0],
      ]),
      weight: 0.26,
    },
    {
      score: n(m.referenceRatio, [
        [0, 0.1],
        [0.2, 0.4],
        [0.4, 0.7],
        [0.6, 0.92],
        [0.8, 1],
      ]),
      weight: 0.15,
    },
    // 密度过低且类别少才扣分；密度适中即满分。高密度不加分（母语级写作显性衔接词本来就少）
    {
      score:
        m.linkerDensity >= 0.4
          ? n(m.linkerDensity, [
              [0.4, 0.8],
              [0.8, 1.0],
              [1.3, 0.9],
              [2.0, 0.5],
            ])
          : n(m.linkerDensity, [
              [0, 0.15],
              [0.2, 0.45],
              [0.4, 0.8],
            ]),
      weight: 0.11,
    },
    { score: n(m.avgSentenceLength, A.avgSentenceLength), weight: 0.07 },
  ]);

  /* ---------- 词汇 / 语言使用 ---------- */
  const lexicalIndex = blend([
    { score: n(m.ttr, A.ttr), weight: 0.34 },
    { score: n(m.longWordRatio, A.longWordRatio), weight: 0.16 },
    { score: n(m.awlDensity, A.awlDensity), weight: 0.2 },
    // 重复与口语化是扣分项，用「距离满分多远」表达
    {
      score: n(m.repetitionTop, [
        [0, 1],
        [3, 0.9],
        [6, 0.72],
        [10, 0.45],
        [16, 0.2],
      ]),
      weight: 0.16,
    },
    {
      score: n(m.informalCount, [
        [0, 1],
        [1, 0.85],
        [3, 0.6],
        [6, 0.3],
        [10, 0.1],
      ]),
      weight: 0.1,
    },
  ]);

  /* ---------- 语法 / 句式多样性 ---------- */
  const grammarIndex = blend([
    { score: n(m.lengthStdDev, A.lengthStdDev), weight: 0.34 },
    { score: n(m.complexRatio, A.complexRatio), weight: 0.3 },
    { score: n(m.errorRate, A.errorRate), weight: 0.26 },
    {
      score: n(m.structureVariety, [
        [0, 0],
        [0.3, 0.3],
        [0.55, 0.6],
        [0.75, 0.85],
        [1, 1],
      ]),
      weight: 0.1,
    },
  ]);

  /**
   * 字数不达标的全局惩罚。
   *
   * 官方评分标准明确把「篇幅不足」列为扣分依据：作文没写完，
   * 意味着论点无法充分展开，这个缺陷会同时体现在四个维度上，
   * 而不是只影响任务回应。
   *
   * 校准数据：106 词的作文（要求的 42%）原本拿到 6.0，
   * 加上长度惩罚后落到 5.0，与人工判定一致。
   */
  const lengthPenalty =
    m.wordCountRatio >= 1 ? 0 : (1 - Math.max(0, m.wordCountRatio)) * 0.34;

  const mk = (
    dimension: DimensionId,
    index: number,
    parts: DimensionIndex["parts"],
  ): DimensionIndex => ({
    dimension,
    index: Math.max(0, Math.min(1, index - lengthPenalty)),
    parts,
  });

  const taskDetail: DimensionIndex["parts"] = [];
  if (isChart || isIntegrated) {
    taskDetail.push({
      name: isChart ? "数据覆盖度" : "听力还原度",
      raw: m.structuralCoverage.toFixed(2),
      score: coverageScore,
      weight: 0.56,
    });
    taskDetail.push({
      name: "字数达标率",
      raw: `${m.wordCount}/${m.minWords}`,
      score: n(m.wordCountRatio, A.wordCountRatio),
      weight: 0.26,
    });
    taskDetail.push({
      name: "转述充分度",
      raw: m.developmentScore.toFixed(2),
      score: n(m.developmentScore, [
        [0, 0],
        [0.5, 0.4],
        [0.75, 0.72],
        [1, 1],
      ]),
      weight: 0.18,
    });
  } else {
    taskDetail.push({
      name: "论证展开度",
      raw: m.developmentScore.toFixed(2),
      score: n(m.developmentScore, [
        [0, 0],
        [0.35, 0.2],
        [0.55, 0.45],
        [0.75, 0.75],
        [0.95, 1],
      ]),
      weight: 0.26,
    });
    taskDetail.push({
      name: "论证深度",
      raw: `${m.argumentDepth.toFixed(1)}/100词`,
      score: n(m.argumentDepth, [
        [0.4, 0],
        [1.2, 0.25],
        [2.0, 0.55],
        [3.0, 0.82],
        [4.5, 1],
      ]),
      weight: 0.24,
    });
    taskDetail.push({
      name: "字数达标率",
      raw: `${m.wordCount}/${m.minWords}`,
      score: n(m.wordCountRatio, A.wordCountRatio),
      weight: 0.16,
    });
    taskDetail.push({
      name: "结构要素覆盖",
      raw: m.structuralCoverage.toFixed(2),
      score: coverageScore,
      weight: 0.16,
    });
    taskDetail.push({
      name: "立场句",
      raw: m.positionFound ? "已定位" : "缺失",
      score: m.positionFound ? 0.88 : 0.3,
      weight: 0.12,
    });
    taskDetail.push({
      name: "话题匹配",
      raw: m.topicMatch.toFixed(2),
      score: n(m.topicMatch, [
        [0, 0],
        [0.5, 0.25],
        [0.75, 0.6],
        [0.9, 0.85],
        [1, 1],
      ]),
      weight: 0.06,
    });
  }

  const task = mk(taskId, taskIndex - taskPenalty, taskDetail);

  const cohesion = mk(cohId, cohesionIndex, [
    {
      name: "衔接手段类别",
      raw: `${m.cohesionCategories}/7（扣模板后 ${Math.max(1, m.cohesionCategories - m.templateCohesionHits)}）`,
      score: n(
        Math.max(1, m.cohesionCategories - m.templateCohesionHits),
        A.cohesionCategories,
      ),
      weight: 0.3,
    },
    {
      name: "段落结构",
      raw: `${m.paragraphCount} 段`,
      score: n(m.paragraphCount, A.paragraphCount),
      weight: 0.24,
    },
    {
      name: "段落开头机械化",
      raw: `${Math.round(m.mechanicalOpenerRatio * 100)}%`,
      score: n(m.mechanicalOpenerRatio, [
        [0, 1],
        [0.2, 0.85],
        [0.4, 0.55],
        [0.6, 0.3],
        [0.8, 0.12],
        [1, 0],
      ]),
      weight: 0.26,
    },
    {
      name: "指代衔接占比",
      raw: m.referenceRatio.toFixed(2),
      score: m.referenceRatio,
      weight: 0.15,
    },
    {
      name: "显性衔接密度",
      raw: `${m.linkerDensity}/句`,
      score:
        m.linkerDensity >= 0.4
          ? n(m.linkerDensity, [
              [0.4, 0.8],
              [0.8, 1.0],
              [1.3, 0.9],
              [2.0, 0.5],
            ])
          : n(m.linkerDensity, [
              [0, 0.15],
              [0.2, 0.45],
              [0.4, 0.8],
            ]),
      weight: 0.11,
    },
    {
      name: "平均句长",
      raw: `${m.avgSentenceLength} 词`,
      score: n(m.avgSentenceLength, A.avgSentenceLength),
      weight: 0.07,
    },
  ]);

  const lexical = mk(lexId, lexicalIndex, [
    { name: "词汇多样度", raw: m.ttr.toFixed(3), score: n(m.ttr, A.ttr), weight: 0.3 },
    {
      name: "长词占比",
      raw: m.longWordRatio.toFixed(3),
      score: n(m.longWordRatio, A.longWordRatio),
      weight: 0.24,
    },
    {
      name: "学术词密度",
      raw: `${m.awlDensity}/100 词`,
      score: n(m.awlDensity, A.awlDensity),
      weight: 0.2,
    },
    {
      name: "最高重复次数",
      raw: `${m.repetitionTop}`,
      score: n(m.repetitionTop, [
        [0, 1],
        [3, 0.9],
        [6, 0.72],
        [10, 0.45],
        [16, 0.2],
      ]),
      weight: 0.16,
    },
    {
      name: "口语化表达",
      raw: `${m.informalCount} 处`,
      score: n(m.informalCount, [
        [0, 1],
        [1, 0.85],
        [3, 0.6],
        [6, 0.3],
        [10, 0.1],
      ]),
      weight: 0.1,
    },
  ]);

  const grammar = mk(isIelts ? "GRA" : "SV", grammarIndex, [
    {
      name: "句长标准差",
      raw: m.lengthStdDev.toFixed(1),
      score: n(m.lengthStdDev, A.lengthStdDev),
      weight: 0.34,
    },
    {
      name: "复合句占比",
      raw: `${Math.round(m.complexRatio * 100)}%`,
      score: n(m.complexRatio, A.complexRatio),
      weight: 0.3,
    },
    {
      name: "错误句占比",
      raw: `${Math.round(m.errorRate * 100)}%`,
      score: n(m.errorRate, A.errorRate),
      weight: 0.26,
    },
    {
      name: "句型种类",
      raw: m.structureVariety.toFixed(2),
      score: m.structureVariety,
      weight: 0.1,
    },
  ]);

  if (isIelts) {
    return [task, cohesion, lexical, grammar];
  }
  // 托福四项一一对应，只是标签不同
  return [task, cohesion, lexical, grammar];
}

export { toScale, normalize };
