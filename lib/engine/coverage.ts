import type { CoverageItem, CoverageReport, Sentence } from "../types";
import { CHART_CUES, TASK1_FORBIDDEN, INTEGRATED_MARKERS } from "./lexicon";
import { countWords, stem, tokenize } from "./segment";

/* ------------------------------------------------------------------ *
 * 雅思 Task 1：图表数据覆盖检测
 * ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "as", "by", "at", "from", "that", "this", "is", "are", "was", "were", "be",
  "it", "its", "which", "than", "then", "there", "more", "most", "was",
  "were", "been", "has", "have", "had", "will", "would", "can", "could",
]);

/** 从图表数据里抽出所有数值（保留百分号信息，用于回查） */
function extractNumbers(text: string): { raw: string; value: number; percent: boolean }[] {
  const out = new Map<string, { raw: string; value: number; percent: boolean }>();
  const re = /(\d+(?:[.,]\d+)?)\s*(%|percent|million|billion|thousand)?/gi;
  for (const m of text.matchAll(re)) {
    const value = Number(m[1].replace(",", ""));
    if (!Number.isFinite(value)) continue;
    const percent = Boolean(m[2] && /%|percent/i.test(m[2]));
    const key = `${value}`;
    if (!out.has(key)) out.set(key, { raw: m[0].trim(), value, percent });
  }
  return [...out.values()];
}

/** 数值是否在作文中出现（允许四舍五入与不同量纲写法） */
function numberMentioned(sentences: Sentence[], value: number): Sentence | undefined {
  return sentences.find((s) => {
    const nums = extractNumbers(s.text);
    return nums.some((n) => {
      if (n.value === value) return true;
      // 允许 3.5 <-> 3.50 一类的小数写法差异
      return Math.abs(n.value - value) < 0.001;
    });
  });
}

function firstCueSentence(
  sentences: Sentence[],
  cues: string[],
): Sentence | undefined {
  return sentences.find((s) => {
    const lower = s.text.toLowerCase();
    return cues.some((c) => lower.includes(c.toLowerCase()));
  });
}

export function analyzeChartCoverage(
  chartData: string,
  sentences: Sentence[],
): CoverageReport {
  const items: CoverageItem[] = [];

  /* --- 结构性覆盖：概述、最大、最小、趋势、对比 --- */

  const structural: {
    group: string;
    label: string;
    required: boolean;
    cues: string[];
    note: string;
    missingNote: string;
  }[] = [
    {
      group: "结构要点",
      label: "概述（Overview）",
      required: true,
      cues: CHART_CUES.overview,
      note: "已识别到概述句。Task 1 的 Overview 是拿分的必要条件，考官会单独寻找它。",
      missingNote:
        "未识别到概述句。Task 1 的 Overview 是硬性要求，缺失会直接限制任务完成项的上限（通常封顶 Band 5）。应在开头段后单独写一句，用 Overall / In general 开头，概括最显著的整体特征，不出现具体数字。",
    },
    {
      group: "结构要点",
      label: "最大值",
      required: true,
      cues: CHART_CUES.maximum,
      note: "已描述数据的最大值，属于 Task 1 必须覆盖的关键节点。",
      missingNote:
        "未识别到最大值的描述。图表题的评分要求覆盖「最显著的数据点」，最高值通常是最重要的比较基准，遗漏会被判定为关键信息筛选失败。应使用 the highest / peaked at / accounted for the largest proportion 等表达。",
    },
    {
      group: "结构要点",
      label: "最小值",
      required: true,
      cues: CHART_CUES.minimum,
      note: "已描述数据的最小值，与最大值构成对比基准。",
      missingNote:
        "未识别到最小值的描述。最大值与最小值应当成对出现，形成对比，否则数据描述不完整。应使用 the lowest / the smallest proportion / bottomed out 等表达。",
    },
    {
      group: "结构要点",
      label: "上升趋势描述",
      required: true,
      cues: CHART_CUES.rise,
      note: "已使用上升类动词描述增长趋势。",
      missingNote:
        "未识别到上升趋势的描述。图表题需要覆盖趋势方向，若图表确有增长数据，说明存在遗漏。注意动词变化：increased / rose / climbed / surged，避免整篇只用 increase。",
    },
    {
      group: "结构要点",
      label: "下降趋势描述",
      required: true,
      cues: CHART_CUES.fall,
      note: "已使用下降类动词描述减少趋势。",
      missingNote:
        "未识别到下降趋势的描述。若图表包含下降数据，说明遗漏了趋势方向。建议在同一句中完成对比：While A rose sharply, B declined steadily.",
    },
    {
      group: "结构要点",
      label: "稳定 / 波动描述",
      required: false,
      cues: [...CHART_CUES.stable, ...CHART_CUES.fluctuate],
      note: "已覆盖稳定或波动状态，说明没有只描述单调趋势。",
      missingNote:
        "未识别到稳定或波动的描述。若图表中存在持平或反复波动的数据，这部分属于「重要节点」，遗漏会显得数据筛选不够精细。可用 remained stable / plateaued / fluctuated. 注意区别：remained stable 表示持平，fluctuated 表示有起伏但无净变化。",
    },
    {
      group: "结构要点",
      label: "数据对比",
      required: true,
      cues: CHART_CUES.comparison,
      note: "已使用对比结构，说明在做横向比较而非孤立罗列数据。",
      missingNote:
        "未识别到对比结构。Task 1 的高分关键在于「比较」而非「罗列」：考官期待看到 whereas / while / in contrast / twice as many as 这类结构把不同项目联系起来。只有孤立数字的作文通常停留在 Band 5。",
    },
    {
      group: "结构要点",
      label: "数据约数处理",
      required: false,
      cues: CHART_CUES.approximation,
      note: "使用了约数表达，说明在不改变数据的前提下做了语言处理，这是 Task 1 的加分技巧。",
      missingNote:
        "未使用约数表达。Task 1 不需要罗列每一个精确数值，用 approximately / roughly / just over 处理次要数据，可以把篇幅留给关键节点。",
    },
  ];

  for (const st of structural) {
    const found = firstCueSentence(sentences, st.cues);
    items.push({
      id: `struct-${st.label}`,
      group: st.group,
      label: st.label,
      detail: st.required ? "官方要求覆盖" : "建议覆盖",
      status: found ? "covered" : st.required ? "missing" : "partial",
      evidenceSentenceId: found?.id,
      evidenceQuote: found?.text,
      note: found ? st.note : st.missingNote,
    });
  }

  /* --- 关键数据点：逐个数字回查是否在作文中出现 --- */

  if (chartData.trim()) {
    const numbers = extractNumbers(chartData)
      .filter((n) => n.value > 0)
      .slice(0, 14);

    for (const n of numbers) {
      const found = numberMentioned(sentences, n.value);
      items.push({
        id: `num-${n.value}`,
        group: "关键数据点",
        label: `${n.raw}`,
        detail: n.percent ? "百分比数据" : "数值数据",
        status: found ? "covered" : "missing",
        evidenceSentenceId: found?.id,
        evidenceQuote: found?.text,
        note: found
          ? "该数据已在文中出现。"
          : `图表中出现了 ${n.raw}，但全文未提及这个数值。如果它是关键节点（最高/最低/转折/起止点），遗漏会被判定为数据覆盖不完整；如果只是中间值，可以用 approximately ${n.value}${n.percent ? "%" : ""} 概括进趋势描述。`,
      });
    }
  }

  /* --- Task 1 违规：出现主观评价 --- */

  const subjective = sentences.find((s) => TASK1_FORBIDDEN.test(s.text));
  items.push({
    id: "struct-subjective",
    group: "结构要点",
    label: "不出现主观评价",
    detail: "Task 1 只描述数据，不论证",
    status: subjective ? "missing" : "covered",
    evidenceSentenceId: subjective?.id,
    evidenceQuote: subjective?.text,
    note: subjective
      ? "Task 1 的任务是「描述数据」，不是表达观点或提出建议。出现 I think / should / must 这类表达会被判定为任务类型理解错误，直接影响任务完成项。应改为纯客观描述。"
      : "未出现主观评价，符合 Task 1 的文体要求。",
  });

  const stats = summarize(items);
  const missingCritical = items.filter(
    (i) => i.status === "missing" && i.group === "结构要点",
  ).length;

  return {
    kind: "chart",
    title: "图表数据覆盖检测",
    summary:
      missingCritical === 0
        ? `结构要点全部覆盖，关键数据 ${stats.covered}/${items.length} 项到位。`
        : `有 ${missingCritical} 项必要结构要点缺失，关键数据覆盖 ${stats.covered}/${items.length} 项。Task 1 的分数主要取决于「筛选出关键信息」的能力，缺失必要项会直接压低任务完成项。`,
    items,
    stats,
  };
}

/* ------------------------------------------------------------------ *
 * 托福综合写作：阅读论点 ↔ 听力反驳点 配对检测
 * ------------------------------------------------------------------ */

function keywordsOf(text: string): string[] {
  return [
    ...new Set(
      tokenize(text)
        .map((w) => w.toLowerCase())
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
        .map(stem),
    ),
  ];
}

/**
 * 在候选句中找到与该论点最匹配的一句。
 *
 * 用 IDF 加权：像 "chain stores" 这种在多个论点里都出现的通用词权重很低，
 * 而 "training / promotion / specialised" 这类只在某一个论点出现的词权重高。
 * 否则「阅读观点句」和「听力反驳句」共享话题词汇时会被误判为已覆盖。
 */
function bestMatch(
  point: string,
  candidates: Sentence[],
): { sentence: Sentence; ratio: number } | null {
  const keys = keywordsOf(point);
  if (keys.length === 0 || candidates.length === 0) return null;

  const stemsPerSentence = candidates.map(
    (s) => new Set(tokenize(s.text).map((w) => w.toLowerCase()).map(stem)),
  );

  const weightOf = (key: string): number => {
    const df = stemsPerSentence.filter((set) => set.has(key)).length;
    // df 越大，说明这个词越通用，区分度越低
    return 1 / Math.log(2 + df);
  };

  const totalWeight = keys.reduce((a, k) => a + weightOf(k), 0);
  if (totalWeight <= 0) return null;

  let best: { sentence: Sentence; ratio: number } | null = null;
  stemsPerSentence.forEach((set, i) => {
    const matched = keys.filter((k) => set.has(k));
    if (matched.length === 0) return;
    const ratio = matched.reduce((a, k) => a + weightOf(k), 0) / totalWeight;
    if (!best || ratio > best.ratio) best = { sentence: candidates[i], ratio };
  });

  return best;
}

type Attribution = "reading" | "listening" | "none";

/**
 * 为每个句子判定它归属阅读还是听力。
 *
 * 关键点：一个论点段里，「阅读观点句」不能被算作「听力反驳」的证据——
 * 否则只要阅读句和听力要点共享词汇（如 chain stores），就会误判为已覆盖。
 * 因此逐句判定来源，并把没有来源词的句子归给同段中最近一次出现的来源
 * （例如 "She also explains that…" 应继承上一句的听力归属）。
 */
function attributeSentences(
  sentences: Sentence[],
  paragraphs: { index: number; sentenceIds: string[] }[],
): Map<string, Attribution> {
  const map = new Map<string, Attribution>();
  const byId = new Map(sentences.map((s) => [s.id, s]));
  const has = (text: string, markers: string[]) =>
    markers.some((m) => text.toLowerCase().includes(m));

  for (const p of paragraphs) {
    let current: Attribution = "none";
    for (const id of p.sentenceIds) {
      const s = byId.get(id);
      if (!s) continue;
      const isListening = has(s.text, INTEGRATED_MARKERS.listening);
      const isReading = has(s.text, INTEGRATED_MARKERS.reading);
      if (isListening) current = "listening";
      else if (isReading) current = "reading";
      map.set(id, current);
    }
  }
  return map;
}

function candidatesFor(
  sentences: Sentence[],
  attribution: Map<string, Attribution>,
  want: Attribution,
): Sentence[] {
  const picked = sentences.filter((s) => attribution.get(s.id) === want);
  // 若全篇没有来源标记（考生用其他方式转述），退回全句集，避免全部误报为遗漏
  return picked.length > 0 ? picked : sentences;
}

function statusFromRatio(ratio: number): CoverageItem["status"] {
  if (ratio >= 0.5) return "covered";
  if (ratio >= 0.25) return "partial";
  return "missing";
}

/** 论点必须与作文语言一致，否则无法做关键词配对（例如用中文写论点、英文写作文） */
function isMatchable(point: string): boolean {
  return (point.match(/[A-Za-z]{3,}/g) ?? []).length >= 1;
}

const UNMATCHABLE_NOTE =
  "这条论点与作文的语言不一致（例如论点是中文、作文是英文），规则引擎无法做关键词配对，因此本条不计入覆盖判定。请用与作文相同的语言填写阅读与听力论点，才能得到准确的配对结果。";

export function analyzeIntegratedCoverage(
  readingPoints: string[],
  listeningPoints: string[],
  sentences: Sentence[],
  paragraphs: { index: number; sentenceIds: string[] }[],
): CoverageReport {
  const items: CoverageItem[] = [];

  const readingClean = readingPoints.map((p) => p.trim()).filter(Boolean);
  const listeningClean = listeningPoints.map((p) => p.trim()).filter(Boolean);

  const attribution = attributeSentences(sentences, paragraphs);
  const readingCandidates = candidatesFor(sentences, attribution, "reading");
  const listeningCandidates = candidatesFor(sentences, attribution, "listening");

  const maxPoints = Math.max(readingClean.length, listeningClean.length, 3);

  for (let i = 0; i < maxPoints; i += 1) {
    const reading = readingClean[i];
    const listening = listeningClean[i];

    if (reading) {
      const matchable = isMatchable(reading);
      const match = matchable ? bestMatch(reading, readingCandidates) : null;
      const ratio = match?.ratio ?? 0;
      const status = matchable ? statusFromRatio(ratio) : "partial";
      items.push({
        id: `read-${i}`,
        group: `论点 ${i + 1}`,
        label: `阅读观点 ${i + 1}`,
        detail: reading,
        status,
        evidenceSentenceId: status === "missing" ? undefined : match?.sentence.id,
        evidenceQuote: status === "missing" ? undefined : match?.sentence.text,
        note: !matchable
          ? UNMATCHABLE_NOTE
          : status === "covered"
            ? "已完整转述该阅读观点。"
            : status === "partial"
              ? `仅部分转述该阅读观点（关键词命中 ${Math.round(ratio * 100)}%）。综合写作要求准确概括阅读的三个论点，转述不完整会被判定为信息遗漏。`
              : "未在文中找到该阅读观点的转述。综合写作的核心任务就是「阅读观点 ↔ 听力反驳」的配对呈现，缺少任何一个阅读论点都会造成结构性失分。",
      });
    }

    if (listening) {
      const matchable = isMatchable(listening);
      const match = matchable ? bestMatch(listening, listeningCandidates) : null;
      const ratio = match?.ratio ?? 0;
      const status = matchable ? statusFromRatio(ratio) : "partial";
      items.push({
        id: `listen-${i}`,
        group: `论点 ${i + 1}`,
        label: `听力反驳 ${i + 1}`,
        detail: listening,
        status,
        evidenceSentenceId: status === "missing" ? undefined : match?.sentence.id,
        evidenceQuote: status === "missing" ? undefined : match?.sentence.text,
        note: !matchable
          ? UNMATCHABLE_NOTE
          : status === "covered"
            ? "已覆盖该听力反驳点。"
            : status === "partial"
              ? `该听力反驳点转述不完整（关键词命中 ${Math.round(ratio * 100)}%）。综合写作的分数重点在听力内容——考官统计的是你还原了多少听力细节，而不是阅读原文。`
              : "遗漏了这个听力反驳点。综合写作的评分核心是「听力材料的还原度」：官方明确说明，阅读部分只是背景，分数主要来自你听懂并转述了多少听力反驳。遗漏反驳点是最严重的失分方式。",
      });
    }
  }

  /* --- 转述框架检测 --- */

  const readingMarkers = INTEGRATED_MARKERS.reading.filter((m) =>
    sentences.some((s) => s.text.toLowerCase().includes(m)),
  );
  const listeningMarkers = INTEGRATED_MARKERS.listening.filter((m) =>
    sentences.some((s) => s.text.toLowerCase().includes(m)),
  );
  const refuteMarkers = INTEGRATED_MARKERS.refute.filter((m) =>
    sentences.some((s) => s.text.toLowerCase().includes(m)),
  );

  const readingSentence = sentences.find((s) =>
    INTEGRATED_MARKERS.reading.some((m) => s.text.toLowerCase().includes(m)),
  );
  items.push({
    id: "frame-reading",
    group: "转述框架",
    label: "引入阅读观点",
    detail: "使用 the reading / the passage 等指称",
    status: readingMarkers.length > 0 ? "covered" : "missing",
    evidenceSentenceId: readingSentence?.id,
    evidenceQuote: readingSentence?.text,
    note:
      readingMarkers.length > 0
        ? `已使用指称词引入阅读材料（${readingMarkers.slice(0, 3).join("、")}）。`
        : "全文未明确指称阅读材料。综合写作的评分依赖清晰的来源标记，否则考官无法判断哪部分是阅读观点、哪部分是听力反驳。应使用 the reading passage states that… / the author claims that…",
  });

  const listeningSentence = sentences.find((s) =>
    INTEGRATED_MARKERS.listening.some((m) => s.text.toLowerCase().includes(m)),
  );
  items.push({
    id: "frame-listening",
    group: "转述框架",
    label: "引入听力观点",
    detail: "使用 the lecture / the professor 等指称",
    status: listeningMarkers.length > 0 ? "covered" : "missing",
    evidenceSentenceId: listeningSentence?.id,
    evidenceQuote: listeningSentence?.text,
    note:
      listeningMarkers.length > 0
        ? `已使用指称词引入听力材料（${listeningMarkers.slice(0, 3).join("、")}）。`
        : "全文未明确指称听力材料。这会让整篇作文看起来像单纯的阅读摘要，而综合写作的分数主要来自听力内容的还原。应使用 the lecturer points out that… / the professor argues that…",
  });

  const refuteSentence = sentences.find((s) =>
    INTEGRATED_MARKERS.refute.some((m) => s.text.toLowerCase().includes(m)),
  );
  items.push({
    id: "frame-refute",
    group: "转述框架",
    label: "标记反驳关系",
    detail: "however / refutes / contradicts 等",
    status: refuteMarkers.length >= 2 ? "covered" : refuteMarkers.length === 1 ? "partial" : "missing",
    evidenceSentenceId: refuteSentence?.id,
    evidenceQuote: refuteSentence?.text,
    note:
      refuteMarkers.length >= 2
        ? `已使用反驳标记词（${refuteMarkers.slice(0, 4).join("、")}）。考官能清楚识别听力与阅读的对立关系。`
        : refuteMarkers.length === 1
          ? "只出现了一处反驳标记。三个论点都应明确标出听力与阅读的对立关系，否则读者需要自行推断。建议每个论点段都以 the professor refutes this by… 开头。"
          : "未出现反驳标记词。综合写作必须在每个论点中明确表达「听力反驳了阅读」，而不仅仅是并列陈述两方观点。缺少反驳关系标记会被判为「未完成综合任务」。",
  });

  const stats = summarize(items);
  const missingListening = items.filter(
    (i) => i.id.startsWith("listen-") && i.status === "missing",
  ).length;

  return {
    kind: "integrated",
    title: "阅读 ↔ 听力论点配对检测",
    summary:
      missingListening === 0
        ? "三个论点的听力反驳均已覆盖，配对结构完整。"
        : `有 ${missingListening} 个听力反驳点未被覆盖。综合写作的分数主要来自听力内容还原度，遗漏反驳点是最严重的失分方式。`,
    items,
    stats,
  };
}

function summarize(items: CoverageItem[]): CoverageReport["stats"] {
  return {
    covered: items.filter((i) => i.status === "covered").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
}

/** 字数与格式约束 */
export function analyzeConstraints(
  wordCount: number,
  sentenceCount: number,
  paragraphCount: number,
  minWords: number,
  taskType: string,
): { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[] {
  const out: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];

  out.push({
    id: "words",
    label: `字数（要求 ≥ ${minWords}）`,
    status: wordCount >= minWords ? "pass" : wordCount >= minWords * 0.9 ? "warn" : "fail",
    detail:
      wordCount >= minWords
        ? `当前 ${wordCount} 词，达到要求。注意不要为了凑字数堆砌内容，超出建议上限会稀释论点密度。`
        : `当前 ${wordCount} 词，低于最低要求 ${minWords} 词。字数不足会直接触发扣分，并且通常伴随论点展开不充分。建议补足到 ${Math.ceil(minWords * 1.05)} 词以上。`,
  });

  out.push({
    id: "paragraphs",
    label: "分段结构",
    status: paragraphCount >= 3 ? "pass" : paragraphCount === 2 ? "warn" : "fail",
    detail:
      paragraphCount >= 3
        ? `共 ${paragraphCount} 段，结构完整。`
        : `只有 ${paragraphCount} 段。分段是连贯与衔接项的显性指标，考官通过段落结构判断你是否有组织能力。至少应分为「引入 + 2 个主体段 + 结论」。`,
  });

  const avg = sentenceCount ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0;
  out.push({
    id: "avg_length",
    label: "平均句长",
    status: avg >= 12 && avg <= 28 ? "pass" : "warn",
    detail:
      avg >= 12 && avg <= 28
        ? `平均句长 ${avg} 词，处于合理区间。`
        : `平均句长 ${avg} 词，偏离建议区间（12–28 词）。${avg < 12 ? "句子偏短，句式层次可能不足。" : "句子偏长，注意是否存在多个分句挤在一句里的情况。"}`,
  });

  void taskType;
  return out;
}

export { countWords };
