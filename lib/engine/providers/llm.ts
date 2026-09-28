import type {
  Annotation,
  AnnotationTag,
  DimensionId,
  DimensionScore,
  Evidence,
  Severity,
} from "../../types";
import { dimensionsFor } from "../../rubrics";
import { clamp, roundToStep } from "../segment";
import { locate } from "../analyzers";
import { liftText } from "../analyzers";
import { buildGradingPrompt } from "../prompts";
import type { GradeContext, GraderProvider, ScoringPlan } from "./types";
import { scoreWithRules } from "./mock";

/**
 * 真实模型评分器。
 *
 * 走 OpenAI 兼容的 /chat/completions 接口，因此可以接 OpenAI、DeepSeek、
 * 通义、豆包、Kimi 等任何提供兼容端点的服务。配置见 .env.example：
 *   LEXSCORE_LLM_BASE_URL / LEXSCORE_LLM_API_KEY / LEXSCORE_LLM_MODEL
 *
 * 未配置时 available() 返回 false，调用方自动回退到规则评分器。
 */

const VALID_TAGS: AnnotationTag[] = [
  "academic_collocation",
  "topic_lexis",
  "cohesion",
  "grammar",
  "sentence_variety",
  "register",
  "concision",
  "template",
  "task_response",
];

const VALID_SEVERITY: Severity[] = ["high", "medium", "low"];
const VALID_DIMENSIONS: DimensionId[] = ["TR", "CC", "LR", "GRA", "TF", "OD", "LU", "SV"];

export function llmConfig() {
  return {
    baseUrl: (process.env.LEXSCORE_LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: process.env.LEXSCORE_LLM_API_KEY || "",
    model: process.env.LEXSCORE_LLM_MODEL || "gpt-4o-mini",
    timeoutMs: Number(process.env.LEXSCORE_LLM_TIMEOUT_MS || 90000),
  };
}

interface RawEvidence {
  sentenceId?: string;
  comment?: string;
  metric?: string;
  delta?: number;
}

interface RawAnnotation {
  sentenceId?: string;
  target?: string;
  replacement?: string;
  dimension?: string;
  tag?: string;
  severity?: string;
  lift?: number;
  reason?: string;
  examinerNote?: string;
}

interface RawPlan {
  dimensions?: {
    dimension?: string;
    score?: number;
    summary?: string;
    evidences?: RawEvidence[];
  }[];
  annotations?: RawAnnotation[];
  summary?: string;
}

function coerceDimensions(raw: RawPlan, ctx: GradeContext): DimensionScore[] {
  const metas = dimensionsFor(ctx.input.exam);
  const byId = new Map<string, NonNullable<RawPlan["dimensions"]>[number]>();
  for (const d of raw.dimensions ?? []) {
    if (d.dimension) byId.set(d.dimension.toUpperCase(), d);
  }

  return metas.map((meta) => {
    const found = byId.get(meta.id);
    const score = clamp(
      roundToStep(Number(found?.score ?? 0) || 0, 0.5),
      ctx.input.exam === "ielts" ? 3 : 1,
      meta.max,
    );
    const evidences: Evidence[] = (found?.evidences ?? []).map((e) => {
      const sentence = ctx.bundle.sentences.find((s) => s.id === e.sentenceId);
      return {
        sentenceId: e.sentenceId ?? "",
        quote: sentence?.text ?? "",
        polarity: (Number(e.delta ?? 0) >= 0 ? "positive" : "negative") as Evidence["polarity"],
        comment: e.comment ?? "",
        metric: e.metric,
        delta: Number(e.delta ?? 0),
      };
    });

    return {
      dimension: meta.id,
      label: meta.label,
      labelEn: meta.labelEn,
      score,
      max: meta.max,
      bandLabel: ctx.input.exam === "ielts" ? `Band ${score.toFixed(1)}` : `${score.toFixed(1)} / 5.0`,
      summary: found?.summary ?? "",
      evidences,
    };
  });
}

function coerceAnnotations(raw: RawPlan, ctx: GradeContext): Annotation[] {
  const out: Annotation[] = [];
  const seen = new Set<string>();

  (raw.annotations ?? []).forEach((a, i) => {
    if (!a.sentenceId || !a.target) return;
    const sentence = ctx.bundle.sentences.find((s) => s.id === a.sentenceId);
    if (!sentence) return;
    // 原文定位失败直接丢弃：宁可少给一条，也不能给错位置
    if (!locate(sentence, a.target)) return;

    const dimension = VALID_DIMENSIONS.includes(a.dimension as DimensionId)
      ? (a.dimension as DimensionId)
      : "LR";
    const tag = VALID_TAGS.includes(a.tag as AnnotationTag)
      ? (a.tag as AnnotationTag)
      : "academic_collocation";
    const severity = VALID_SEVERITY.includes(a.severity as Severity)
      ? (a.severity as Severity)
      : "medium";
    const lift = [0.25, 0.5, 1].includes(Number(a.lift)) ? Number(a.lift) : 0.5;

    const key = `${a.sentenceId}|${a.target.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      id: `llm-${i}-${a.sentenceId}`,
      sentenceId: a.sentenceId,
      target: a.target,
      replacement: a.replacement ?? "",
      dimension,
      tag,
      severity,
      lift,
      liftText: liftText(dimension, lift),
      reason: a.reason ?? "",
      examinerNote: a.examinerNote ?? "",
      status: "pending",
    });
  });

  return out;
}

async function callModel(prompt: string): Promise<RawPlan> {
  const cfg = llmConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是一位资深雅思与托福写作考官，输出严格遵循 JSON schema，所有原文引用必须逐字符一致。",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`模型接口返回 ${res.status}：${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型返回内容为空");
    return JSON.parse(content) as RawPlan;
  } finally {
    clearTimeout(timer);
  }
}

export const llmProvider: GraderProvider = {
  id: "llm",
  label: "模型评分器",
  available: () => Boolean(llmConfig().apiKey),
  async score(ctx: GradeContext): Promise<ScoringPlan> {
    const cfg = llmConfig();
    const coverageText = ctx.coverage
      ? ctx.coverage.items
          .map((i) => `- [${i.status}] ${i.label}：${i.note}`)
          .join("\n")
      : "";

    const prompt = buildGradingPrompt(ctx.input, ctx.bundle, coverageText);
    const raw = await callModel(prompt);

    const dimensions = coerceDimensions(raw, ctx);
    const annotations = coerceAnnotations(raw, ctx);

    if (dimensions.every((d) => d.score <= (ctx.input.exam === "ielts" ? 3 : 1))) {
      throw new Error("模型返回的分数不可用");
    }

    return {
      dimensions,
      summary: raw.summary ?? "",
      engine: `llm:${cfg.model}`,
      annotations,
    };
  },
};

export { scoreWithRules };
