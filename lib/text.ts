import type { Annotation } from "./types";

/** 在句子文本中定位片段（大小写不敏感，返回首次出现的位置） */
export function locateIn(
  text: string,
  target: string,
): { start: number; end: number } | null {
  const trimmed = target.trim();
  if (!trimmed) return null;
  let idx = text.indexOf(trimmed);
  if (idx < 0) idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx < 0) return null;
  return { start: idx, end: idx + trimmed.length };
}

export interface Span {
  start: number;
  end: number;
  annotation: Annotation;
}

/** 把一条批注定位到句子中的区间；定位失败返回 null */
export function spanOf(sentenceText: string, annotation: Annotation): Span | null {
  const range = locateIn(sentenceText, annotation.target);
  if (!range) return null;
  return { ...range, annotation };
}

/** 把重叠的区间去重，保留优先级更高的那条 */
export function resolveSpans(sentenceText: string, annotations: Annotation[]): Span[] {
  const spans = annotations
    .map((a) => spanOf(sentenceText, a))
    .filter((s): s is Span => s !== null)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: Span[] = [];
  for (const span of spans) {
    const last = out[out.length - 1];
    if (last && span.start < last.end) {
      // 重叠：保留范围更小的那条，定位更精确
      if (span.end - span.start < last.end - last.start) {
        out[out.length - 1] = span;
      }
      continue;
    }
    out.push(span);
  }
  return out;
}

export interface TextSegment {
  text: string;
  span?: Span;
}

/** 把句子切成「普通文本 / 被标记文本」的片段序列，供渲染使用 */
export function toSegments(sentenceText: string, spans: Span[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: sentenceText.slice(cursor, span.start) });
    }
    segments.push({ text: sentenceText.slice(span.start, span.end), span });
    cursor = span.end;
  }
  if (cursor < sentenceText.length) {
    segments.push({ text: sentenceText.slice(cursor) });
  }
  return segments;
}

export interface PreviewSegment {
  text: string;
  kind: "plain" | "accepted" | "pending";
}

/** 生成「修改版」：已接受的替换直接生效，待处理的只做标记 */
export function buildPreview(sentenceText: string, spans: Span[]): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: sentenceText.slice(cursor, span.start), kind: "plain" });
    }
    const { annotation } = span;
    if (!annotation.replacement) {
      // 仅建议类批注不改变正文
      segments.push({ text: sentenceText.slice(span.start, span.end), kind: "plain" });
    } else if (annotation.status === "accepted") {
      segments.push({ text: annotation.replacement, kind: "accepted" });
    } else if (annotation.status === "ignored") {
      segments.push({ text: sentenceText.slice(span.start, span.end), kind: "plain" });
    } else {
      segments.push({ text: annotation.replacement, kind: "pending" });
    }
    cursor = span.end;
  }
  if (cursor < sentenceText.length) {
    segments.push({ text: sentenceText.slice(cursor), kind: "plain" });
  }
  return segments;
}

/** 应用所有已接受的替换，得到最终文本（用于复制导出） */
export function applyAccepted(sentenceText: string, annotations: Annotation[]): string {
  const spans = resolveSpans(sentenceText, annotations).filter(
    (s) => s.annotation.status === "accepted" && s.annotation.replacement,
  );
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += sentenceText.slice(cursor, span.start) + span.annotation.replacement;
    cursor = span.end;
  }
  return out + sentenceText.slice(cursor);
}

export function severityLabel(severity: string): string {
  return severity === "high" ? "严重" : severity === "medium" ? "中等" : "轻微";
}

export const TAG_LABELS: Record<string, string> = {
  academic_collocation: "学术写作常用搭配",
  topic_lexis: "话题核心词伙",
  cohesion: "逻辑衔接",
  grammar: "语法准确性",
  sentence_variety: "句式多样性",
  register: "语域",
  concision: "冗余表达",
  template: "模板痕迹",
  task_response: "任务回应",
};

export const DIMENSION_LABELS: Record<string, string> = {
  TR: "TR 任务回应",
  CC: "CC 连贯与衔接",
  LR: "LR 词汇丰富度",
  GRA: "GRA 语法多样性与准确性",
  TF: "任务完成",
  OD: "组织发展",
  LU: "语言使用",
  SV: "句式多样性",
};
