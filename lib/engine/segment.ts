import type { Paragraph, ParagraphRole, Sentence } from "../types";

/** 句尾缩写：出现在这些词之后的句点不构成句子边界 */
const HARD_ABBREV = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "st",
  "vs",
  "fig",
  "al",
  "inc",
  "ltd",
  "approx",
  "dept",
  "univ",
  "no",
  "vol",
  "pp",
  "cf",
  "resp",
  "jr",
  "sr",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "mt",
  "ft",
  "hr",
  "min",
  "sec",
  "kg",
  "km",
  "cm",
  "mm",
  "gov",
  "sen",
  "rep",
  "gen",
  "col",
  "capt",
  "lt",
  "sgt",
]);

/** 这些缩写后面允许断句（因为其后通常跟大写开头的完整句子） */
const SOFT_ABBREV = new Set(["etc", "eg", "ie", "esp"]);

/** 查找句子边界位置（返回每个句子的结束下标，不含） */
function findBoundaries(text: string): number[] {
  const out: number[] = [];
  const re = /([.!?]+)(?=\s+["'“”‘’(（\[]*[A-Z0-9"“])/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const before = text.slice(0, m.index);
    const tail = before.match(/([A-Za-z][A-Za-z.]*)$/);
    const raw = tail ? tail[1] : "";
    const norm = raw.toLowerCase().replace(/\./g, "");

    if (m[0] === "[" || m[0] === "]") continue;
    // 注意：小数（3.5）不会走到这里——边界正则要求句点后必须有空白，
    // 所以不能用「句点前是数字」来判断，否则 2010. Coal 会被误判成小数值。
    if (m[0] === "." && HARD_ABBREV.has(norm)) continue;
    if (m[0] === "." && /^[a-z]$/.test(norm)) continue;
    if (m[0] === "." && SOFT_ABBREV.has(norm)) {
      out.push(end);
      continue;
    }
    out.push(end);
  }
  return out;
}

export function splitSentences(
  text: string,
  offsetBase = 0,
): {
  text: string;
  charStart: number;
  charEnd: number;
}[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const raw = text;
  const bounds = findBoundaries(raw);
  const pieces: { text: string; charStart: number; charEnd: number }[] = [];

  let cursor = 0;
  for (const b of bounds) {
    const chunk = raw.slice(cursor, b);
    if (chunk.trim()) {
      pieces.push({
        text: chunk.trim(),
        charStart: offsetBase + cursor,
        charEnd: offsetBase + b,
      });
    }
    cursor = b;
  }
  const rest = raw.slice(cursor);
  if (rest.trim()) {
    pieces.push({
      text: rest.trim(),
      charStart: offsetBase + cursor,
      charEnd: offsetBase + raw.length,
    });
  }

  // 合并被误切的碎片：仅当一个极短片段的前一句没有正常结束时才合并
  const merged: typeof pieces = [];
  for (const p of pieces) {
    const prev = merged[merged.length - 1];
    if (prev && countWords(p.text) <= 2 && !/[.!?]$/.test(prev.text)) {
      prev.text = `${prev.text} ${p.text}`.trim();
      prev.charEnd = p.charEnd;
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

export function tokenize(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
}

const CONCLUSION_MARKERS =
  /\b(in conclusion|to conclude|on balance|to sum up|in summary|all things considered|taken together|overall,|ultimately)\b/i;
const OVERVIEW_MARKERS =
  /\b(overall|in general|broadly speaking|it is clear that|the most striking)\b/i;

function detectRole(
  index: number,
  total: number,
  text: string,
  isTask1: boolean,
): { role: ParagraphRole; note: string } {
  if (index === 0) {
    return { role: "introduction", note: "引入段：应完成话题定位与立场陈述" };
  }
  if (isTask1 && OVERVIEW_MARKERS.test(text)) {
    return {
      role: "overview",
      note: "概述段：Task 1 的核心得分段，需覆盖总体趋势而不堆砌数字",
    };
  }
  if (index === total - 1 && total >= 3) {
    if (CONCLUSION_MARKERS.test(text)) {
      return { role: "conclusion", note: "结论段：需综合前文并重申立场" };
    }
    return {
      role: "conclusion",
      note: "末段：未见明确结论标记词，考官可能判定为「无结论」",
    };
  }
  return { role: "body", note: "主体段：应聚焦单一中心论点并充分展开" };
}

export interface SegmentedEssay {
  paragraphs: Paragraph[];
  sentences: Sentence[];
  wordCount: number;
}

export function segmentEssay(essay: string, isTask1: boolean): SegmentedEssay {
  const normalized = essay.replace(/\r\n?/g, "\n").trim();

  let rawParagraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParagraphs.length <= 1) {
    const byLine = normalized
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (byLine.length > 1) rawParagraphs = byLine;
  }

  const paragraphs: Paragraph[] = [];
  const sentences: Sentence[] = [];
  let charCursor = 0;
  let globalIndex = 0;

  rawParagraphs.forEach((text, pIndex) => {
    const startInDoc = normalized.indexOf(text, charCursor);
    charCursor = startInDoc >= 0 ? startInDoc + text.length : charCursor;

    const { role, note } = detectRole(pIndex, rawParagraphs.length, text, isTask1);

    const pieces = splitSentences(text, startInDoc >= 0 ? startInDoc : 0);
    const ids: string[] = [];

    pieces.forEach((piece, sIndex) => {
      const id = `s${globalIndex}`;
      sentences.push({
        id,
        index: globalIndex,
        paragraphIndex: pIndex,
        indexInParagraph: sIndex,
        text: piece.text,
        charStart: piece.charStart,
        charEnd: piece.charEnd,
        wordCount: countWords(piece.text),
      });
      ids.push(id);
      globalIndex += 1;
    });

    paragraphs.push({
      index: pIndex,
      text,
      role,
      roleNote: note,
      sentenceIds: ids,
      wordCount: countWords(text),
    });
  });

  return {
    paragraphs,
    sentences,
    wordCount: countWords(normalized),
  };
}

/* ---------------- 通用工具 ---------------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** 在句子数组中查找最先包含给定片段（不区分大小写）的句子 */
export function findSentenceByFragment(
  sentences: Sentence[],
  fragment: string,
): Sentence | undefined {
  const needle = fragment.toLowerCase().slice(0, 40);
  return sentences.find((s) => s.text.toLowerCase().includes(needle));
}

export function sentenceById(sentences: Sentence[], id: string): Sentence | undefined {
  return sentences.find((s) => s.id === id);
}

/** 计算词形归并后的简单词干，用于重复词统计 */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/['’-]/g, "");
  if (w.length <= 4) return w;
  for (const suffix of [
    "ations",
    "ation",
    "ings",
    "ing",
    "ies",
    "ied",
    "ers",
    "er",
    "est",
    "ed",
    "es",
    "s",
  ]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
      return w.slice(0, w.length - suffix.length);
    }
  }
  return w;
}
