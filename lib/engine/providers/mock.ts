import type {
  DimensionId,
  DimensionScore,
  Evidence,
  Fact,
  GradeInput,
  Sentence,
} from "../../types";
import {
  bandDescriptor,
  dimensionsFor,
  formatOverall,
  overallScore,
} from "../../rubrics";
import { clamp, roundToStep } from "../segment";
import type { GradeContext, GraderProvider, ScoringPlan } from "./types";

/**
 * 规则评分器（默认）。
 *
 * 不依赖任何外部模型：每一个分数变化都来自一条可定位到原文的 Fact。
 * 目的是让评分逻辑透明、可复现、可审计——用户能看到「为什么扣分」，
 * 而不是拿到一个无法解释的数字。
 */

const DIMENSION_NOTES: Record<DimensionId, string> = {
  TR: "考察是否完整回应题目各部分、立场是否明确、论点是否有展开与例证。",
  CC: "考察信息组织的逻辑性、段落中心是否单一、句间衔接是否自然。",
  LR: "考察词汇量、搭配准确性、话题词伙的运用与语域一致性。",
  GRA: "考察句法结构的丰富度，以及语法与标点的准确率。",
  TF: "考察是否有效回应题目要求，观点是否明确、论证是否有细节支撑。",
  OD: "考察结构统一性与论证推进的连贯程度。",
  LU: "考察用词准确性、搭配地道程度，以及语法错误是否影响理解。",
  SV: "考察句长变化与句式结构（从句、分词、倒装）的运用。",
};

function factsFor(facts: Fact[], id: DimensionId, exam: string): Fact[] {
  if (exam === "ielts") {
    // 雅思没有独立的「句式多样性」维度，其问题并入 GRA 一起评估
    if (id === "GRA") {
      return facts.filter((f) => f.dimension === "GRA" || f.dimension === "SV");
    }
    if (id === "SV") return [];
  }
  return facts.filter((f) => f.dimension === id);
}

function toEvidence(facts: Fact[], sentences: Sentence[]): Evidence[] {
  return facts.map((f) => {
    const sentence = f.sentenceId
      ? sentences.find((s) => s.id === f.sentenceId)
      : undefined;
    return {
      sentenceId: f.sentenceId ?? "",
      quote: f.quote ?? sentence?.text ?? "",
      polarity:
        f.delta > 0
          ? ("positive" as const)
          : f.delta < 0
            ? ("negative" as const)
            : ("neutral" as const),
      comment: f.detail,
      metric: f.metric,
      delta: f.delta,
    };
  });
}

function buildSummary(
  label: string,
  score: number,
  max: number,
  evidences: Evidence[],
): string {
  const negatives = evidences.filter((e) => e.polarity === "negative");
  const positives = evidences.filter((e) => e.polarity === "positive" && e.delta > 0);
  const scale = max === 9 ? 1 : 0.5;

  if (negatives.length === 0 && positives.length === 0) {
    return `${label}未检测到明显的加分或扣分信号，得分维持在基线水平。增加可验证的具体例证与话题词汇可继续爬升。`;
  }

  const parts: string[] = [];
  if (negatives.length > 0) {
    const weight = negatives.reduce((a, e) => a + Math.abs(e.delta), 0) * scale;
    parts.push(
      `扣分集中在 ${negatives.length} 处，累计影响约 -${trimZero(weight)} 分。最关键的一处是：${negatives[0].comment}`,
    );
  }
  if (positives.length > 0) {
    const weight = positives.reduce((a, e) => a + e.delta, 0) * scale;
    parts.push(
      `加分项 ${positives.length} 处，累计 +${trimZero(weight)} 分：${positives[0].comment}`,
    );
  }
  parts.push(
    `当前处于「${bandDescriptor(max === 9 ? "ielts" : "toefl", score)}」的水平区间。`,
  );
  return parts.join(" ");
}

function trimZero(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function scoreWithRules(ctx: GradeContext): ScoringPlan {
  const { input, facts, bundle } = ctx;
  const exam = input.exam;
  const dims = dimensionsFor(exam);
  const base = exam === "ielts" ? 6.5 : 3.0;
  const deltaScale = exam === "ielts" ? 1 : 0.5;
  const totalCap: [number, number] = exam === "ielts" ? [-3, 2] : [-1.5, 1];

  const dimensions: DimensionScore[] = dims.map((meta) => {
    const dimFacts = factsFor(facts, meta.id, exam);
    const rawDelta = dimFacts.reduce((a, f) => a + f.delta, 0) * deltaScale;
    const delta = clamp(rawDelta, totalCap[0], totalCap[1]);
    const raw = clamp(base + delta, exam === "ielts" ? 3 : 1, meta.max);
    const score = roundToStep(raw, 0.5);
    const evidences = toEvidence(dimFacts, bundle.sentences);

    return {
      dimension: meta.id,
      label: meta.label,
      labelEn: meta.labelEn,
      score,
      max: meta.max,
      bandLabel:
        exam === "ielts" ? `Band ${score.toFixed(1)}` : `${score.toFixed(1)} / 5.0`,
      summary: buildSummary(meta.label, score, meta.max, evidences),
      evidences,
    };
  });

  const overall = overallScore(
    exam,
    dimensions.map((d) => d.score),
  );
  const overallLabel = formatOverall(exam, overall);

  const weakest = [...dimensions].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  const strongest = [...dimensions].sort((a, b) => b.score / b.max - a.score / a.max)[0];

  const parts: string[] = [];
  parts.push(
    `整体 ${overallLabel}（${dimensions.map((d) => `${d.label} ${d.score}`).join(" / ")}）。`,
  );
  parts.push(
    `最需要优先处理的是${weakest.label}（${weakest.bandLabel}），${DIMENSION_NOTES[weakest.dimension]}`,
  );
  if (strongest && strongest.dimension !== weakest.dimension) {
    parts.push(`相对稳定的是${strongest.label}，可作为其他维度的参照。`);
  }
  if (ctx.coverage) parts.push(ctx.coverage.summary);
  parts.push(
    `全文 ${bundle.stats.wordCount} 词，共 ${bundle.stats.sentenceCount} 句；平均句长 ${bundle.stats.avgSentenceLength} 词。`,
  );

  return {
    dimensions,
    summary: parts.join(" "),
    engine: "rule-engine v1",
  };
}

export const ruleProvider: GraderProvider = {
  id: "rule-engine",
  label: "规则评分器 v1",
  available: () => true,
  async score(ctx: GradeContext) {
    return scoreWithRules(ctx);
  },
};

export type { GradeInput };
