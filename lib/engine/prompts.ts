import type { GradeInput } from "../types";
import { TASK_REQUIREMENTS, dimensionsFor, TASK_LABELS } from "../rubrics";
import type { AnalysisBundle } from "./analyzers";

/**
 * 真实模型的提示词。
 *
 * 关键设计：
 * 1. 句子带 id 注入，强制模型「引用原文」，杜绝空泛评价；
 * 2. 先注入规则引擎已算出的事实，让模型做解释与改写，而不是从零猜测；
 * 3. 输出 JSON schema 与前端渲染结构一一对应，不做二次翻译。
 */
export function buildGradingPrompt(
  input: GradeInput,
  bundle: AnalysisBundle,
  coverageText: string,
): string {
  const dims = dimensionsFor(input.exam);
  const req = TASK_REQUIREMENTS[input.taskType];

  const dimensionSpec = dims
    .map(
      (d) =>
        `- ${d.id}（${d.label}，满分 ${d.max}）：${d.desc}\n  考官关注：${d.looksFor.join("；")}`,
    )
    .join("\n");

  const numbered = bundle.sentences
    .map(
      (s) =>
        `[${s.id}] (第${s.paragraphIndex + 1}段 第${s.indexInParagraph + 1}句) ${s.text}`,
    )
    .join("\n");

  const factLines = bundle.facts
    .map(
      (f) =>
        `- [${f.code}] 影响维度 ${f.dimension}｜严重度 ${f.severity}｜影响 ${f.delta}｜${f.sentenceId ? `引用句 ${f.sentenceId}` : "全局"}｜${f.detail}${f.metric ? `｜指标 ${f.metric}` : ""}`,
    )
    .join("\n");

  const templateLines =
    bundle.template.hits.length > 0
      ? bundle.template.hits
          .map(
            (h) => `- 「${h.phrase}」（${h.category}，句 ${h.sentenceId}）：${h.reason}`,
          )
          .join("\n")
      : "未命中模板库。";

  const metricLines = [
    `词数 ${bundle.stats.wordCount}（要求 ≥ ${req.minWords}）`,
    `段落数 ${bundle.stats.paragraphCount}`,
    `句数 ${bundle.stats.sentenceCount}`,
    `平均句长 ${bundle.stats.avgSentenceLength} 词，句长标准差 ${bundle.stats.lengthStdDev}`,
    `学术词表密度 ${bundle.lexis.awlDensity} / 100 词`,
    `衔接词密度 ${bundle.cohesion.density} / 句，覆盖 ${bundle.cohesion.categoriesUsed.length} / 7 类`,
    `复合句占比 ${Math.round(bundle.variety.complexRatio * 100)}%`,
    `扣题度 ${bundle.relevance.score} / 100`,
    `模板原创度 ${bundle.template.originality} / 100`,
  ].join("\n");

  const extraContext: string[] = [];
  if (input.chartData?.trim()) {
    extraContext.push(`【图表原始数据】\n${input.chartData.trim()}`);
  }
  if (input.readingPoints?.length) {
    extraContext.push(
      `【阅读材料的三个论点】\n${input.readingPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    );
  }
  if (input.listeningPoints?.length) {
    extraContext.push(
      `【听力材料的三个反驳点】\n${input.listeningPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    );
  }
  if (coverageText) extraContext.push(`【覆盖检测结果】\n${coverageText}`);

  return `你是一位资深的雅思/托福写作考官，正在批改一篇 ${TASK_LABELS[input.taskType]} 作文。

## 一、题目
${input.prompt}

## 二、评分项定义
${dimensionSpec}

## 三、学生作文（已分句并编号，引用原文时必须使用这些编号）
${numbered}

## 四、规则引擎已检测到的事实（这些是客观测量结果，请以它们为依据，不要推翻）
${factLines || "无"}

## 五、反模板检测结果
${templateLines}

## 六、客观指标
${metricLines}

${extraContext.join("\n\n")}

## 七、你的任务

### 1. 四维评分
为每个评分项给出分数（${input.exam === "ielts" ? "雅思按 0.5 一档，范围 3.0–9.0" : "托福按 0.5 一档，范围 1.0–5.0"}）。
每一项必须附 2–4 条「评分依据」，每条依据都必须：
- 用 sentenceId 精确指向原文某一句；
- 说明「为什么这里加/扣分」，而不是复述规则；
- 给出可验证的指标（如「衔接词密度 0.3/句」「该句 48 词包含 3 个独立分句」）。

### 2. 逐句批注
找出所有值得修改的地方，每条批注必须：
- target 是原文中**原样出现**的片段（用于前端精确高亮，务必逐字符一致）；
- replacement 是修改后的表达，保持原句其余部分不变；
- dimension 标明它作用于哪个评分项；
- lift 是提分幅度（按该评分项的量表，0.25 或 0.5）；
- reason 说明「为什么这样改」；
- examinerNote 说明「为什么这个表达更符合考官偏好」，尽量点出考官在评分标准里对应的表述。

优先关注这些类型：
- academic_collocation：学术写作常用搭配（把口语化、泛化的表达换成学术搭配）
- topic_lexis：话题核心词伙（本题话题下考官期待看到的词伙，学生漏掉了什么）
- cohesion：逻辑衔接（句间关系缺失或用错衔接词）
- grammar：语法准确性
- sentence_variety：句式多样性（句长雷同、句首结构重复、缺少从句或分词）
- register：语域（口语化 → 学术化）
- template：模板痕迹

### 3. 总分评语
用 3–5 句中文，说明整体水平、最优先改进的方向，以及在考场上这篇文章大概会得到什么结果。

## 八、输出格式
只输出 JSON，不要任何解释文字或 Markdown 代码块标记：

{
  "dimensions": [
    {
      "dimension": "${dims[0].id}",
      "score": 0,
      "summary": "该维度的诊断，中文，点明扣分集中在哪里",
      "evidences": [
        {
          "sentenceId": "s1",
          "comment": "为什么这里加分或扣分",
          "metric": "支撑该判断的客观指标",
          "delta": -0.5
        }
      ]
    }
  ],
  "annotations": [
    {
      "sentenceId": "s1",
      "target": "原文片段",
      "replacement": "修改后",
      "dimension": "CC",
      "tag": "cohesion",
      "severity": "medium",
      "lift": 0.5,
      "reason": "为什么这样改",
      "examinerNote": "为什么更符合考官偏好"
    }
  ],
  "summary": "总分评语"
}

要求：dimensions 必须包含全部 ${dims.length} 项（${dims.map((d) => d.id).join("、")}）。
annotations 控制在 8–20 条，宁可精准也不要凑数。所有 sentenceId 必须是上面出现过的编号。`;
}
