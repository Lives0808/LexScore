import type {
  Annotation,
  CorpusItem,
  CoverageReport,
  DimensionId,
  ExamType,
  Fact,
  KeywordHit,
  Paragraph,
  RelevanceReport,
  Sentence,
  Severity,
  TaskType,
  TemplateHit,
  TemplateReport,
} from "../types";
import { TASK_REQUIREMENTS } from "../rubrics";
import {
  ACADEMIC_UPGRADES,
  ADVICE_RULES,
  AWL_WORDS,
  detectTopics,
  GRAMMAR_RULES,
  INFORMAL_MARKERS,
  LINKERS,
  TEMPLATE_PATTERNS,
  type Topic,
} from "./lexicon";
import { clamp, countWords, roundToStep, stem, tokenize } from "./segment";

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */

function fresh(re: RegExp): RegExp {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
}

function allMatches(text: string, re: RegExp): RegExpMatchArray[] {
  return [...text.matchAll(fresh(re))];
}

/** 原样定位 target 在句子中的位置，定位失败返回 null（宁可漏报也不误报） */
export function locate(
  sentence: Sentence,
  target: string,
): { start: number; end: number } | null {
  const trimmed = target.trim();
  if (!trimmed) return null;
  let idx = sentence.text.indexOf(trimmed);
  if (idx < 0) idx = sentence.text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx < 0) return null;
  return { start: idx, end: idx + trimmed.length };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function preserveCase(matched: string, replacement: string): string {
  if (
    matched.charAt(0) === matched.charAt(0).toUpperCase() &&
    /[A-Za-z]/.test(matched.charAt(0))
  ) {
    return capitalize(replacement);
  }
  return replacement;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "as",
  "by",
  "at",
  "from",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "must",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "his",
  "her",
  "i",
  "my",
  "me",
  "not",
  "no",
  "so",
  "than",
  "then",
  "there",
  "here",
  "more",
  "most",
  "some",
  "any",
  "all",
  "both",
  "each",
  "every",
  "other",
  "such",
  "only",
  "also",
  "very",
  "too",
  "much",
  "many",
  "about",
  "into",
  "over",
  "up",
  "out",
  "down",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "one",
  "two",
  "own",
  "same",
  "write",
  "essay",
  "discuss",
  "give",
  "reasons",
  "examples",
  "answer",
  "question",
  "following",
  "include",
  "words",
  "least",
]);

/** 话题词的同义替换表，避免因用词不同而误判为跑题 */
const SYNONYMS: Record<string, string[]> = {
  children: ["youngsters", "young people", "pupils", "minors", "adolescents"],
  education: ["schooling", "teaching", "instruction", "learning"],
  students: ["pupils", "learners", "undergraduates"],
  technology: ["technological", "digital", "technical"],
  environment: ["environmental", "ecological", "natural world"],
  government: ["authorities", "state", "administration", "policymakers"],
  money: ["funding", "finance", "financial", "capital", "resources"],
  jobs: ["employment", "work", "occupations", "careers"],
  health: ["healthcare", "medical", "wellbeing"],
  crime: ["criminal", "offending", "illegal"],
  city: ["urban", "cities", "metropolitan"],
  country: ["rural", "national", "nation"],
  parents: ["families", "guardians", "mothers", "fathers"],
  sports: ["sport", "athletics", "physical activity"],
  advertising: ["advertisement", "ads", "marketing", "commercial"],
  tourism: ["tourists", "travel", "visitors"],
  culture: ["cultural", "heritage", "tradition"],
  society: ["social", "community", "public"],
  pollution: ["polluted", "emissions", "contamination"],
};

/* ------------------------------------------------------------------ *
 * 1. 基础统计
 * ------------------------------------------------------------------ */

export interface Stats {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  sentenceLengths: number[];
  lengthStdDev: number;
  ttr: number;
  contentWordCount: number;
  uniqueContent: number;
}

export function computeStats(sentences: Sentence[], paragraphs: Paragraph[]): Stats {
  const lengths = sentences.map((s) => s.wordCount);
  const wordCount = lengths.reduce((a, b) => a + b, 0);
  const avg = lengths.length ? wordCount / lengths.length : 0;
  const variance = lengths.length
    ? lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / lengths.length
    : 0;

  const contentWords = sentences
    .flatMap((s) => tokenize(s.text))
    .filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const stems = new Set(contentWords.map(stem));

  return {
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgSentenceLength: Number(avg.toFixed(1)),
    sentenceLengths: lengths,
    lengthStdDev: Number(Math.sqrt(variance).toFixed(1)),
    ttr: contentWords.length ? Number((stems.size / contentWords.length).toFixed(3)) : 0,
    contentWordCount: contentWords.length,
    uniqueContent: stems.size,
  };
}

/* ------------------------------------------------------------------ *
 * 2. 连贯与衔接分析
 * ------------------------------------------------------------------ */

export interface CohesionAnalysis {
  hits: { term: string; category: string; sentenceId: string }[];
  density: number;
  categoriesUsed: string[];
  overused: { term: string; count: number; sentenceId: string }[];
  referenceCount: number;
  mechanicalOpeners: { sentenceId: string; opener: string }[];
}

const REFERENCE_WORDS = [
  "this",
  "these",
  "such",
  "the former",
  "the latter",
  "the above",
  "which",
];

export function analyzeCohesion(sentences: Sentence[]): CohesionAnalysis {
  const hits: CohesionAnalysis["hits"] = [];

  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    for (const [category, terms] of Object.entries(LINKERS)) {
      for (const term of terms) {
        const re = new RegExp(
          `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "g",
        );
        const count = (lower.match(re) ?? []).length;
        for (let i = 0; i < count; i += 1) {
          hits.push({ term, category, sentenceId: s.id });
        }
      }
    }
  }

  // 去重：同一句 + 同一 term 只记一次
  const uniqueHits: typeof hits = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.sentenceId}|${h.term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueHits.push(h);
  }

  const density = sentences.length
    ? Number((uniqueHits.length / sentences.length).toFixed(2))
    : 0;
  const categoriesUsed = [...new Set(uniqueHits.map((h) => h.category))];

  const byTerm = new Map<string, { count: number; sentenceId: string }>();
  for (const h of uniqueHits) {
    const prev = byTerm.get(h.term);
    if (prev) prev.count += 1;
    else byTerm.set(h.term, { count: 1, sentenceId: h.sentenceId });
  }
  const overused = [...byTerm.entries()]
    .filter(([, v]) => v.count >= 4)
    .map(([term, v]) => ({ term, count: v.count, sentenceId: v.sentenceId }))
    .sort((a, b) => b.count - a.count);

  let referenceCount = 0;
  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    for (const w of REFERENCE_WORDS) {
      if (new RegExp(`\\b${w}\\b`).test(lower)) referenceCount += 1;
    }
  }

  // 机械开头：连续三句以上以相同词开头
  const mechanicalOpeners: CohesionAnalysis["mechanicalOpeners"] = [];
  const openers = sentences.map((s) => {
    const m = s.text.match(/^([A-Za-z][A-Za-z'-]*)/);
    return { id: s.id, opener: m ? m[1].toLowerCase() : "" };
  });
  const openerCounts = new Map<string, string[]>();
  for (const o of openers) {
    if (!o.opener || STOPWORDS.has(o.opener)) continue;
    const list = openerCounts.get(o.opener) ?? [];
    list.push(o.id);
    openerCounts.set(o.opener, list);
  }
  for (const [opener, ids] of openerCounts) {
    if (ids.length >= 4) {
      mechanicalOpeners.push({ sentenceId: ids[0], opener });
    }
  }

  return {
    hits: uniqueHits,
    density,
    categoriesUsed,
    overused,
    referenceCount,
    mechanicalOpeners,
  };
}

/* ------------------------------------------------------------------ *
 * 3. 词汇分析
 * ------------------------------------------------------------------ */

export interface LexisAnalysis {
  awlHits: { word: string; sentenceId: string }[];
  awlDensity: number;
  repetitions: { word: string; count: number }[];
  informal: { marker: string; formal: string; sentenceId: string }[];
  usedTopicPhrases: string[];
}

export function analyzeLexis(
  sentences: Sentence[],
  paragraphTexts: string[],
  topics: Topic[],
  totalWords: number,
): LexisAnalysis {
  const awlHits: LexisAnalysis["awlHits"] = [];
  const informal: LexisAnalysis["informal"] = [];
  const stemCount = new Map<string, number>();
  const stemDisplay = new Map<string, string>();

  for (const s of sentences) {
    const words = tokenize(s.text);
    for (const w of words) {
      const lower = w.toLowerCase();
      if (AWL_WORDS.has(lower)) awlHits.push({ word: lower, sentenceId: s.id });
      if (!STOPWORDS.has(lower)) {
        const st = stem(lower);
        stemCount.set(st, (stemCount.get(st) ?? 0) + 1);
        if (!stemDisplay.has(st)) stemDisplay.set(st, lower);
      }
    }
    for (const marker of INFORMAL_MARKERS) {
      const m = s.text.match(fresh(marker.pattern));
      if (m) {
        informal.push({ marker: m[0], formal: marker.formal, sentenceId: s.id });
      }
    }
  }

  const uniqueAwl = new Set(awlHits.map((a) => a.word));
  const awlDensity = totalWords
    ? Number(((awlHits.length / totalWords) * 100).toFixed(1))
    : 0;

  const repetitions = [...stemCount.entries()]
    .filter(([, c]) => c >= 4)
    .map(([st, c]) => ({ word: stemDisplay.get(st) ?? st, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const joined = paragraphTexts.join(" ").toLowerCase();
  const usedTopicPhrases: string[] = [];
  for (const t of topics) {
    for (const p of t.phrases) {
      if (joined.includes(p.term.toLowerCase())) usedTopicPhrases.push(p.term);
    }
  }
  void uniqueAwl;

  return { awlHits, awlDensity, repetitions, informal, usedTopicPhrases };
}

/* ------------------------------------------------------------------ *
 * 4. 语法分析
 * ------------------------------------------------------------------ */

export interface GrammarAnalysis {
  errors: { ruleId: string; sentenceId: string; matched: string }[];
  errorSentences: number;
  longSentences: Sentence[];
  shortSentences: Sentence[];
}

const SUBORDINATORS = [
  "although",
  "though",
  "even though",
  "while",
  "whereas",
  "because",
  "since",
  "unless",
  "until",
  "provided",
  "if",
  "when",
  "whenever",
  "after",
  "before",
  "once",
  "as long as",
  "in order that",
  "so that",
  "which",
  "who",
  "whom",
  "whose",
  "that",
  "where",
  "why",
];

export function analyzeGrammar(sentences: Sentence[]): GrammarAnalysis {
  const errors: GrammarAnalysis["errors"] = [];

  for (const s of sentences) {
    for (const rule of GRAMMAR_RULES) {
      const matches = allMatches(s.text, rule.pattern);
      if (matches.length > 0) {
        errors.push({ ruleId: rule.id, sentenceId: s.id, matched: matches[0][0] });
      }
    }
  }

  const errorSentences = new Set(errors.map((e) => e.sentenceId)).size;
  const longSentences = sentences.filter((s) => s.wordCount >= 42);
  const shortSentences = sentences.filter((s) => s.wordCount <= 5);

  return { errors, errorSentences, longSentences, shortSentences };
}

/* ------------------------------------------------------------------ *
 * 5. 句式多样性分析
 * ------------------------------------------------------------------ */

export interface VarietyAnalysis {
  complexCount: number;
  complexRatio: number;
  structures: {
    name: string;
    found: boolean;
    example?: { sentenceId: string; quote: string };
  }[];
  openerRepetition: { word: string; count: number }[];
  lengthVariety: number;
}

const STRUCTURE_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "定语从句 (which/that/who)", pattern: /\b(which|who|whose)\b|,\s*that\b/i },
  {
    name: "分词短语",
    pattern: /(^|[,\s])((?:[A-Za-z]+ing)|(?:[A-Za-z]+ed))\s+[a-z]+\s/i,
  },
  {
    name: "被动语态",
    pattern:
      /\b(is|are|was|were|be|been|being)\s+(?:[a-z]+ed|[a-z]+en|built|made|done|given|taken|seen|shown)\b/i,
  },
  { name: "条件句", pattern: /\b(if|unless|provided that|should|were to)\b/i },
  {
    name: "让步状语从句",
    pattern:
      /\b(although|even though|whereas|while|despite|in spite of|notwithstanding)\b/i,
  },
  {
    name: "倒装 / 强调句",
    pattern: /\b(not only|never before|rarely|seldom|it is \w+ that|what .{1,30} is)\b/i,
  },
  {
    name: "名词化结构",
    pattern: /\b(the \w+(tion|ment|ance|ence|ity|ness|ism|ship|age)\b)/i,
  },
  {
    name: "类比与倍数",
    pattern: /\b(twice as|three times|as \w+ as|the more|the less)\b/i,
  },
  { name: "虚拟/推测", pattern: /\b(would|could|might|may)\s+[a-z]+\b/i },
];

export function analyzeVariety(sentences: Sentence[], stats: Stats): VarietyAnalysis {
  const complexSentences = sentences.filter((s) => {
    const lower = s.text.toLowerCase();
    return SUBORDINATORS.some((sub) => new RegExp(`\\b${sub}\\b`).test(lower));
  });

  const structures = STRUCTURE_PATTERNS.map((sp) => {
    for (const s of sentences) {
      if (sp.pattern.test(s.text)) {
        return {
          name: sp.name,
          found: true,
          example: { sentenceId: s.id, quote: s.text.slice(0, 120) },
        };
      }
    }
    return { name: sp.name, found: false };
  });

  const openerCounts = new Map<string, number>();
  for (const s of sentences) {
    const m = s.text.match(/^([A-Za-z][A-Za-z'-]*)/);
    const w = m ? m[1].toLowerCase() : "";
    if (!w || STOPWORDS.has(w)) continue;
    openerCounts.set(w, (openerCounts.get(w) ?? 0) + 1);
  }
  const openerRepetition = [...openerCounts.entries()]
    .filter(([, c]) => c >= 3)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  return {
    complexCount: complexSentences.length,
    complexRatio: sentences.length
      ? Number((complexSentences.length / sentences.length).toFixed(2))
      : 0,
    structures,
    openerRepetition,
    lengthVariety: stats.lengthStdDev,
  };
}

/* ------------------------------------------------------------------ *
 * 6. 反模板检测
 * ------------------------------------------------------------------ */

export function analyzeTemplates(sentences: Sentence[]): TemplateReport {
  const hits: TemplateHit[] = [];
  const fullText = sentences.map((s) => s.text).join("\n");

  for (const pattern of TEMPLATE_PATTERNS) {
    const anchor = sentences.find((s) => pattern.pattern.test(s.text));
    if (!anchor) continue;
    const m = anchor.text.match(fresh(pattern.pattern));
    const matched = m ? m[0] : anchor.text.slice(0, 60);
    hits.push({
      id: pattern.id,
      phrase: matched,
      sentenceId: anchor.id,
      quote: anchor.text,
      category: pattern.category,
      kind: pattern.kind,
      reason: pattern.reason,
      suggestion: pattern.suggestion,
      penalty: pattern.penalty,
    });
  }

  const fillerHits = hits.filter((h) => h.kind === "filler");
  const structuralHits = hits.filter((h) => h.kind === "structural");

  const coverage = fullText.length || 1;
  const penalties = hits.reduce((a, h) => a + h.penalty, 0);
  // 每 100 词允许 0.3 的容差
  const tolerance = (coverage / 100) * 0.003;
  const originality = clamp(Math.round(100 - (penalties - tolerance) * 45), 20, 100);

  /**
   * 结论要区分两类模板，不能笼统说「有模板」。
   * 填充式废话该删；机械结构只是建议变化表达 —— 把它们混为一谈，
   * 会让用户误以为「用 In conclusion 也会被扣分」，从而写出更差的文章。
   */
  let verdict: string;
  if (hits.length === 0) {
    verdict = "未检测到模板句，语言组织自然。";
  } else if (fillerHits.length >= Math.max(1, structuralHits.length)) {
    verdict =
      `检测到 ${fillerHits.length} 处填充式废话 —— 它们不承载任何信息，` +
      `删掉不会损失内容，只会让论证更紧凑。` +
      (structuralHits.length > 0
        ? `另有 ${structuralHits.length} 处机械结构，属于有效标记，变化表达即可。`
        : "");
  } else if (structuralHits.length > 0) {
    verdict =
      `有 ${structuralHits.length} 处机械结构。这类表达本身有效（不属于废话），` +
      `但连续使用会让考官觉得套路化，建议交替使用不同的过渡方式。`;
  } else if (originality >= 85) {
    verdict = "整体自然，仅有零星套话，不影响评分。";
  } else {
    verdict = "存在可识别的模板痕迹，考官可能据此判断为备考范文改写。";
  }

  return {
    originality,
    verdict,
    hits,
    fillerCount: fillerHits.length,
    structuralCount: structuralHits.length,
  };
}

/* ------------------------------------------------------------------ *
 * 7. 扣题度诊断
 * ------------------------------------------------------------------ */

const INSTRUCTION_PATTERNS: { id: string; pattern: RegExp; label: string }[] = [
  {
    id: "discuss_both",
    pattern: /discuss both (these )?views|discuss both sides/i,
    label: "讨论双方观点并给出自己的看法",
  },
  {
    id: "to_what_extent",
    pattern: /to what extent/i,
    label: "在多大程度上同意（需给出程度限定）",
  },
  {
    id: "agree_disagree",
    pattern: /do you agree or disagree|agree or disagree/i,
    label: "是否同意（需明确立场）",
  },
  {
    id: "advantages_disadvantages",
    pattern: /advantages? (and|or) disadvantages?/i,
    label: "利弊讨论",
  },
  {
    id: "positive_negative",
    pattern: /positive or negative development/i,
    label: "判断是积极还是消极发展",
  },
  {
    id: "problem_solution",
    pattern: /(problems?|causes?).{0,40}(solutions?|measures?)|what (problems|measures)/i,
    label: "问题与解决方案",
  },
  {
    id: "two_part",
    pattern: /two (different )?questions|both of the following/i,
    label: "两个子问题都必须回答",
  },
  { id: "outweigh", pattern: /outweigh/i, label: "比较哪一方更占优势" },
];

/**
 * 立场句标记。
 *
 * 注意要覆盖高分作文的常用句式 —— 早期版本漏了「I would argue」，
 * 结果 Band 8 的作文因为没被识别出立场，TR 反而低于 Band 5.5。
 * 越是好作文，越倾向用 I would argue / It is my contention 这类
 * 而非直白的 I think。
 */
const POSITION_MARKERS =
  /\b(i (would )?(argue|contend|maintain|believe|think|am convinced|am of the view)|i would (suggest|submit)|in my (view|opinion|judgement)|from my perspective|it is my (view|contention|position)|this essay (will|argues|contends)|my (position|contention|view) is|i (would )?(agree|disagree))\b/i;

export function extractKeywords(prompt: string): {
  topic: string[];
  instructions: string[];
} {
  const words = tokenize(prompt)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const stems = new Map<string, string>();
  for (const w of words) {
    const st = stem(w);
    if (!stems.has(st)) stems.set(st, w);
  }
  return {
    topic: [...stems.values()].slice(0, 14),
    instructions: INSTRUCTION_PATTERNS.filter((p) => p.pattern.test(prompt)).map(
      (p) => p.id,
    ),
  };
}

export function analyzeRelevance(
  prompt: string,
  sentences: Sentence[],
  paragraphs: Paragraph[],
  taskType: TaskType,
  keywordSource?: string,
): RelevanceReport {
  const { topic, instructions } = extractKeywords(keywordSource ?? prompt);
  const joined = sentences.map((s) => s.text.toLowerCase()).join(" ");

  const keywords: KeywordHit[] = topic.map((term) => {
    const st = stem(term);
    const variants = [term, st, ...(SYNONYMS[term] ?? [])];
    let count = 0;
    for (const v of variants) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      count += (joined.match(re) ?? []).length;
    }
    return { term, hit: count > 0, count, kind: "topic" as const };
  });

  const instructionHits: KeywordHit[] = INSTRUCTION_PATTERNS.filter((p) =>
    instructions.includes(p.id),
  ).map((p) => ({
    term: p.label,
    hit: true,
    count: 1,
    kind: "instruction" as const,
  }));

  const hitCount = keywords.filter((k) => k.hit).length;
  const literalRatio = keywords.length ? hitCount / keywords.length : 1;

  /**
   * 字面命中率不能直接当扣题度。
   *
   * 校准测试发现：Band 8 的作文在字面命中上反而低于 Band 5.5 ——
   * 因为高分作文必然做同义替换（university → tertiary education，
   * free → funded by the state），字面匹配等于在惩罚词汇能力。
   *
   * 所以改成「话题域匹配」：只要作文被判定落在同一个话题域内，
   * 就认为它没有跑题；字面命中率只用来区分「完全没提到」的极端情况。
   */
  const essayTopics = detectTopics(prompt, sentences.map((s) => s.text).join(" "));
  const promptTopics = detectTopics(prompt, prompt);
  const domainMatch =
    promptTopics.length === 0 ||
    essayTopics.length === 0 ||
    essayTopics.some((t) => promptTopics.some((p) => p.id === t.id));
  const hitRatio = domainMatch ? Math.max(0.8, literalRatio) : literalRatio;

  // 跑题句：与题目关键词零重叠，且不是纯过渡句
  const promptStems = new Set(keywords.map((k) => stem(k.term)));
  const offTopic: RelevanceReport["offTopic"] = [];
  for (const s of sentences) {
    if (s.wordCount < 12) continue;
    const p = paragraphs[s.paragraphIndex];
    if (p && (p.role === "introduction" || p.role === "conclusion")) continue;
    const words = tokenize(s.text).map((w) => w.toLowerCase());
    const contentStems = words
      .filter((w) => !STOPWORDS.has(w) && w.length >= 4)
      .map(stem);
    if (contentStems.length === 0) continue;
    const overlap = contentStems.filter((st) => promptStems.has(st)).length;
    if (overlap === 0 && contentStems.length >= 6) {
      offTopic.push({
        sentenceId: s.id,
        quote: s.text,
        reason:
          "该句内容与题目关键词没有任何词汇重叠，且信息密度较高，容易被视为偏离主题的泛泛而谈。",
      });
    }
  }

  const needsPosition = instructions.some((i) =>
    [
      "to_what_extent",
      "agree_disagree",
      "discuss_both",
      "outweigh",
      "positive_negative",
    ].includes(i),
  );
  const positionSentence = sentences.find((s) => POSITION_MARKERS.test(s.text));
  const position: RelevanceReport["position"] = {
    required: needsPosition,
    found: Boolean(positionSentence),
    sentenceId: positionSentence?.id,
    quote: positionSentence?.text,
    note: !needsPosition
      ? "该题型不强制要求立场陈述。"
      : positionSentence
        ? "已在文中识别到立场句，考官能在开头段快速定位你的观点，这对任务回应项有利。"
        : "未识别到明确的立场句。雅思 Task 2 与托福学术讨论都要求立场清晰可辨，缺少立场句会直接限制任务回应项得分。",
  };

  const structureBonus = paragraphs.length >= 4 ? 0.05 : 0;
  const score = clamp(Math.round((hitRatio + structureBonus) * 100), 0, 100);

  let verdict: string;
  if (score >= 85) verdict = "扣题紧密，题目关键词覆盖充分。";
  else if (score >= 70)
    verdict = "基本扣题，但部分核心概念没有展开，存在答非所问的风险。";
  else if (score >= 50) verdict = "扣题度不足，题目要求的若干关键角度未涉及。";
  else verdict = "严重偏题，考官会判定为未完成任务。";

  void taskType;

  return {
    score,
    verdict,
    keywords: [...keywords, ...instructionHits],
    offTopic,
    position,
  };
}

/* ------------------------------------------------------------------ *
 * 8. 批注生成：把规则命中转成可接受 / 可忽略的修改建议
 * ------------------------------------------------------------------ */

/** 确保文本以句末标点结尾 */
function ensureSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * 找出某个句子所属段落对应的听力论点。
 *
 * 段落里通常已经转述了阅读观点，所以先用「段落文本 − 本句」去匹配阅读论点，
 * 命中后再取同序号的听力论点。这样即使考生没写引言段、段落顺序有偏移，
 * 也能正确对上，比直接用「段落序号 − 1」鲁棒得多。
 */
function matchListeningPoint(
  sentence: Sentence,
  sentences: Sentence[],
  paragraphs: Paragraph[],
  listeningPoints: string[],
  readingPoints: string[],
): string | null {
  if (listeningPoints.length === 0) return null;

  const fallback = (): string | null => {
    const idx = sentence.paragraphIndex - 1;
    return idx >= 0 && idx < listeningPoints.length ? listeningPoints[idx] : null;
  };

  const para = paragraphs[sentence.paragraphIndex];
  if (!para || readingPoints.length === 0) return fallback();

  const paraText = para.sentenceIds
    .filter((id) => id !== sentence.id)
    .map((id) => sentences.find((s) => s.id === id)?.text ?? "")
    .join(" ");

  if (!paraText.trim()) return fallback();

  const hay = new Set(
    tokenize(paraText)
      .map((w) => w.toLowerCase())
      .filter((w) => !STOPWORDS.has(w))
      .map(stem),
  );

  let bestIndex = -1;
  let bestScore = 0;
  readingPoints.forEach((point, i) => {
    const keys = [
      ...new Set(
        tokenize(point)
          .map((w) => w.toLowerCase())
          .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
          .map(stem),
      ),
    ];
    if (keys.length === 0) return;
    const score = keys.filter((k) => hay.has(k)).length / keys.length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  if (bestIndex >= 0 && bestScore >= 0.2 && bestIndex < listeningPoints.length) {
    return listeningPoints[bestIndex];
  }
  return fallback();
}

export function buildAnnotations(ctx: {
  sentences: Sentence[];
  paragraphs: Paragraph[];
  taskType: TaskType;
  exam: ExamType;
  topics: Topic[];
  usedTopicPhrases: string[];
  repetitions: { word: string; count: number }[];
  /** 托福综合写作：用于把「只说了一句不同意」补成完整的听力反驳 */
  listeningPoints?: string[];
  readingPoints?: string[];
}): Annotation[] {
  const {
    sentences,
    paragraphs,
    taskType,
    exam,
    topics,
    usedTopicPhrases,
    repetitions,
    listeningPoints = [],
    readingPoints = [],
  } = ctx;
  const out: Annotation[] = [];
  const perSentence = new Map<string, number>();
  const usedRules = new Set<string>();

  const push = (a: Annotation) => {
    const n = perSentence.get(a.sentenceId) ?? 0;
    if (n >= 3) return; // 同一句最多给三条建议，避免噪声
    perSentence.set(a.sentenceId, n + 1);
    out.push(a);
  };

  for (const s of sentences) {
    // 学术搭配升级
    for (const rule of ACADEMIC_UPGRADES) {
      if (rule.only?.tasks && !rule.only.tasks.includes(taskType)) continue;
      const matches = allMatches(s.text, rule.pattern);
      if (matches.length === 0) continue;
      const matched = matches[0][0].trim();
      if (!locate(s, matched)) continue;
      const id = `${rule.id}:${s.id}`;
      if (usedRules.has(id)) continue;
      usedRules.add(id);
      push({
        id,
        sentenceId: s.id,
        target: matched,
        replacement: preserveCase(matched, rule.replacement),
        dimension: rule.dimension,
        tag: rule.tag,
        severity: rule.severity,
        lift: rule.lift,
        liftText: liftText(rule.dimension, rule.lift),
        reason: rule.reason,
        examinerNote: rule.examinerNote,
        status: "pending",
      });
    }

    // 语法 / 中式英语
    for (const rule of GRAMMAR_RULES) {
      const matches = allMatches(s.text, rule.pattern);
      if (matches.length === 0) continue;
      const matched = matches[0][0].trim();
      if (!locate(s, matched)) continue;
      const id = `${rule.id}:${s.id}`;
      if (usedRules.has(id)) continue;
      usedRules.add(id);
      const replacement = rule.replacement ? preserveCase(matched, rule.replacement) : "";
      push({
        id,
        sentenceId: s.id,
        target: matched,
        replacement,
        dimension: rule.dimension,
        tag: rule.dimension === "GRA" ? "grammar" : "task_response",
        severity: rule.severity,
        lift: rule.lift,
        liftText: liftText(rule.dimension, rule.lift),
        reason: rule.message,
        examinerNote: rule.fixNote,
        status: "pending",
      });
    }
  }

  // 仅给建议的结构性规则
  for (const s of sentences) {
    for (const rule of ADVICE_RULES) {
      if (rule.tasks && !rule.tasks.includes(taskType)) continue;
      if (!rule.pattern.test(s.text)) continue;
      const id = `${rule.id}:${s.id}`;
      if (usedRules.has(id)) continue;
      usedRules.add(id);

      // 空泛的反驳句可以直接补全：拿同段落对应的听力论点生成改写，
      // 这样「只说了一句不同意」也能一键接受，而不只是一条泛泛的提醒。
      let replacement = "";
      let reason = rule.reason;
      let examinerNote = rule.examinerNote;
      if (rule.id === "adv_vague_rebuttal") {
        const point = matchListeningPoint(
          s,
          sentences,
          paragraphs,
          listeningPoints,
          readingPoints,
        );
        if (point) {
          replacement = `The professor, however, challenges this claim. ${ensureSentence(point)}`;
          reason = `${rule.reason}这一次可以直接补全：根据你填写的听力论点，这句话应该展开成下面的内容。`;
          examinerNote = `${rule.examinerNote}注意：这里给的是「应该写出的信息」，请用你自己的句子重新组织，不要照抄——考官对模板化转述同样敏感。`;
        }
      }

      push({
        id,
        sentenceId: s.id,
        target: s.text,
        replacement,
        dimension: rule.dimension,
        tag: rule.tag,
        severity: rule.severity,
        lift: rule.lift,
        liftText: liftText(rule.dimension, rule.lift),
        reason,
        examinerNote,
        status: "pending",
      });
    }
  }

  // 话题核心词伙：指出本题应该覆盖、但全文没用到的词伙
  const lexDimension: DimensionId = exam === "ielts" ? "LR" : "LU";
  const anchorPara =
    paragraphs.find((p) => p.role === "body") ??
    paragraphs[Math.min(1, paragraphs.length - 1)];
  const anchor = anchorPara
    ? sentences.find((s) => s.id === anchorPara.sentenceIds[0])
    : sentences[0];

  if (anchor) {
    const missing = topics
      .flatMap((t) => t.phrases.map((p) => ({ ...p, topicLabel: t.label })))
      .filter((p) => !usedTopicPhrases.includes(p.term))
      .slice(0, 2);

    // 两条建议挂到不同的句子上，避免同一位置堆叠重复提示
    const bodyAnchors = paragraphs
      .filter((p) => p.role === "body" || p.role === "conclusion")
      .map((p) => sentences.find((s) => s.id === p.sentenceIds[0]))
      .filter((s): s is Sentence => Boolean(s));

    missing.forEach((m, i) => {
      const target = bodyAnchors[i % Math.max(1, bodyAnchors.length)] ?? anchor;
      push({
        id: `topic:${m.term}`,
        sentenceId: target.id,
        target: target.text,
        replacement: "",
        dimension: lexDimension,
        tag: "topic_lexis",
        severity: "low",
        lift: 0.25,
        liftText: liftText(lexDimension, 0.25),
        reason: `本题属于「${m.topicLabel}」话题，但全文未出现「${m.term}」这类话题核心词伙。${m.gloss}。`,
        examinerNote: `考官在词汇项上寻找的是「话题词汇储备」而不是通用词汇量。${m.gloss}——这类词伙能把论点落到具体概念上，是用词精准度最直接的体现，也是词汇项从 6 分跨到 7 分最常见的突破口。`,
        status: "pending",
      });
    });
  }

  // 高频重复用词：指出并给出替换方向
  for (const rep of repetitions.slice(0, 2)) {
    const occurrences = sentences.filter((s) =>
      new RegExp(`\\b${rep.word}\\w*`, "i").test(s.text),
    );
    const anchor = occurrences[occurrences.length - 1];
    if (!anchor || occurrences.length < 2) continue;
    push({
      id: `repeat:${rep.word}`,
      sentenceId: anchor.id,
      target: anchor.text,
      replacement: "",
      dimension: lexDimension,
      tag: "academic_collocation",
      severity: rep.count >= 6 ? "medium" : "low",
      lift: 0.25,
      liftText: liftText(lexDimension, 0.25),
      reason: `「${rep.word}」及其词形变化在全文出现了 ${rep.count} 次，是本文重复率最高的实词。词汇项的多样性直接受重复率影响——考官会把它读作「词汇手段有限」。`,
      examinerNote:
        "考官在词汇项上考察的是「是否能在同一语义场中变换表达」。与其反复使用同一个词，不如按语境换用同义表达；如果无法替换，通常说明这个论点还停留在抽象层面，需要补充具体内容。",
      status: "pending",
    });
  }

  // 超长句：确定性地给出拆分方案
  for (const s of sentences) {
    if (s.wordCount < 42) continue;
    const split = suggestSplit(s.text);
    if (!split) continue;
    push({
      id: `split:${s.id}`,
      sentenceId: s.id,
      target: s.text,
      replacement: split,
      dimension: "GRA",
      tag: "sentence_variety",
      severity: "medium",
      lift: 0.5,
      liftText: liftText("GRA", 0.5),
      reason: `该句共 ${s.wordCount} 词，包含多个独立分句但没有停顿，属于典型的 run-on sentence。读者需要反复阅读才能理清逻辑层次。`,
      examinerNote:
        "语法项的准确性包含「句子边界是否正确」。长句本身不是错误，但把多个独立分句用逗号串起来会让考官判定为结构失控。拆成两句后，每句一个信息焦点，同时还能提升句长变化度。",
      status: "pending",
    });
  }

  return out.sort((a, b) => {
    const s = severityRank(b.severity) - severityRank(a.severity);
    if (s !== 0) return s;
    return b.lift - a.lift;
  });
}

function severityRank(s: Severity): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

/** 构造「此处增加逻辑衔接词，可提升 CC 项 0.5 分」式的提分说明 */
export function liftText(dimension: DimensionId, lift: number): string {
  const names: Record<DimensionId, string> = {
    TR: "TR（任务回应）",
    CC: "CC（连贯与衔接）",
    LR: "LR（词汇丰富度）",
    GRA: "GRA（语法多样性与准确性）",
    TF: "任务完成",
    OD: "组织发展",
    LU: "语言使用",
    SV: "句式多样性",
  };
  return `可提升 ${names[dimension]} 项 ${lift} 分`;
}

/** 尝试在并列连词处把长句拆成两句（确定性改写，不依赖模型） */
export function suggestSplit(text: string): string | null {
  const candidates = [", and ", ", but ", ", so ", ", which ", "; "];
  for (const c of candidates) {
    const idx = text.indexOf(c);
    if (idx < 40) continue;
    if (idx > text.length - 40) continue;
    const head = text.slice(0, idx).trim();
    const tail = text.slice(idx + c.length).trim();
    if (!head || !tail) continue;
    const connector =
      c === ", but "
        ? "However, "
        : c === ", so "
          ? "Consequently, "
          : c === ", which "
            ? "This "
            : "";
    const newTail = connector ? capitalize(connector + tail) : capitalize(tail);
    return `${head}. ${newTail}`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 9. 个人语料库抽取
 * ------------------------------------------------------------------ */

export function buildCorpus(
  reportId: string,
  sentences: Sentence[],
  annotations: Annotation[],
  grammarErrors: GrammarAnalysis["errors"],
  lexis: LexisAnalysis,
  topics: Topic[],
): CorpusItem[] {
  const now = Date.now();
  const items: CorpusItem[] = [];
  const topicLabel = topics[0]?.label;

  // 好词：文中实际用到的学术词汇与话题词伙
  const awlSeen = new Set<string>();
  for (const hit of lexis.awlHits) {
    if (awlSeen.has(hit.word)) continue;
    awlSeen.add(hit.word);
    if (awlSeen.size > 12) break;
    const sentence = sentences.find((s) => s.id === hit.sentenceId);
    items.push({
      id: `${reportId}-phrase-${hit.word}`,
      kind: "phrase",
      text: hit.word,
      dimension: "LR",
      topic: topicLabel,
      note: "学术词表（AWL）词汇，是你的加分项，复习时可主动复用到同话题写作中。",
      sourceReportId: reportId,
      createdAt: now,
      ...(sentence ? { note: `学术词表（AWL）词汇。原句：${sentence.text}` } : {}),
    });
  }

  for (const phrase of lexis.usedTopicPhrases) {
    items.push({
      id: `${reportId}-topic-${phrase}`,
      kind: "phrase",
      text: phrase,
      dimension: "LR",
      topic: topicLabel,
      note: "话题核心词伙，使用正确。这类表达是考官判断「话题词汇储备」的直接依据。",
      sourceReportId: reportId,
      createdAt: now,
    });
  }

  // 好句：句式结构完整、无语法错误、且包含从句或分词的句子
  const errorSentenceIds = new Set(grammarErrors.map((e) => e.sentenceId));
  const annotationSentenceIds = new Set(annotations.map((a) => a.sentenceId));
  for (const s of sentences) {
    if (s.wordCount < 18 || s.wordCount > 40) continue;
    if (errorSentenceIds.has(s.id) || annotationSentenceIds.has(s.id)) continue;
    const isComplex = SUBORDINATORS.some((sub) =>
      new RegExp(`\\b${sub}\\b`, "i").test(s.text),
    );
    if (!isComplex) continue;
    const hasAwl = tokenize(s.text).some((w) => AWL_WORDS.has(w.toLowerCase()));
    if (!hasAwl) continue;
    items.push({
      id: `${reportId}-sentence-${s.id}`,
      kind: "sentence",
      text: s.text,
      dimension: "GRA",
      topic: topicLabel,
      note: "复杂句 + 学术词汇的组合，且未命中语法检查规则。这类句子可以直接作为同话题写作的模板句改写使用。",
      sourceReportId: reportId,
      createdAt: now,
    });
    if (items.filter((i) => i.kind === "sentence").length >= 5) break;
  }

  // 高频错误：语法规则命中
  const seenRules = new Set<string>();
  for (const err of grammarErrors) {
    if (seenRules.has(err.ruleId)) continue;
    seenRules.add(err.ruleId);
    const rule = GRAMMAR_RULES.find((r) => r.id === err.ruleId);
    if (!rule) continue;
    items.push({
      id: `${reportId}-error-${err.ruleId}`,
      kind: "error",
      text: err.matched,
      correction: rule.replacement || rule.fixNote.slice(0, 80),
      dimension: rule.dimension,
      topic: topicLabel,
      note: rule.message,
      sourceReportId: reportId,
      createdAt: now,
    });
  }

  // 高频错误：口语化用词
  for (const inf of lexis.informal) {
    items.push({
      id: `${reportId}-informal-${inf.marker}`,
      kind: "error",
      text: inf.marker,
      correction: inf.formal,
      dimension: "LR",
      topic: topicLabel,
      note: "口语化表达，学术写作中应替换。",
      sourceReportId: reportId,
      createdAt: now,
    });
  }

  return items;
}

/* ------------------------------------------------------------------ *
 * 10. 事实汇总（供评分与 LLM 增强共用）
 * ------------------------------------------------------------------ */

export interface AnalysisBundle {
  stats: Stats;
  cohesion: CohesionAnalysis;
  lexis: LexisAnalysis;
  grammar: GrammarAnalysis;
  variety: VarietyAnalysis;
  template: TemplateReport;
  relevance: RelevanceReport;
  topics: Topic[];
  sentences: Sentence[];
  paragraphs: Paragraph[];
  annotations: Annotation[];
  facts: Fact[];
  corpus: CorpusItem[];
}

export function deriveFacts(
  bundle: Omit<AnalysisBundle, "facts" | "corpus">,
  exam: ExamType,
  taskType: TaskType,
  coverage?: CoverageReport,
): Fact[] {
  const { stats, cohesion, lexis, grammar, variety, template, relevance, topics } =
    bundle;
  const facts: Fact[] = [];
  const first = (id: string) => bundle.sentences.find((s) => s.id === id);
  const isIelts = exam === "ielts";

  /* ---------- 任务回应 / 任务完成 ---------- */
  const req = TASK_REQUIREMENTS[taskType];
  if (stats.wordCount < req.minWords) {
    facts.push({
      code: "UNDER_WORD_COUNT",
      dimension: isIelts ? "TR" : "TF",
      severity: "high",
      detail: `全文 ${stats.wordCount} 词，低于官方最低要求 ${req.minWords} 词。字数不足会直接触发扣分，且通常伴随论点展开不充分。`,
      metric: `${stats.wordCount} / ${req.minWords} words`,
      delta: -1,
    });
  }
  if (relevance.score < 70) {
    facts.push({
      code: "LOW_RELEVANCE",
      dimension: isIelts ? "TR" : "TF",
      severity: relevance.score < 50 ? "high" : "medium",
      detail: `扣题度 ${relevance.score}/100。题目核心概念未充分覆盖：${
        relevance.keywords
          .filter((k) => !k.hit && k.kind === "topic")
          .map((k) => k.term)
          .slice(0, 5)
          .join("、") || "无"
      }`,
      metric: `扣题度 ${relevance.score}`,
      delta: relevance.score < 50 ? -1 : -0.5,
    });
  }
  if (relevance.position.required && !relevance.position.found) {
    facts.push({
      code: "NO_POSITION",
      dimension: isIelts ? "TR" : "TF",
      severity: "high",
      detail: "题型要求明确立场，但全文未识别到可定位的立场句。",
      delta: -0.5,
      ...(bundle.sentences[0]
        ? { sentenceId: bundle.sentences[0].id, quote: bundle.sentences[0].text }
        : {}),
    });
  }
  for (const off of relevance.offTopic.slice(0, 2)) {
    facts.push({
      code: "OFF_TOPIC_SENTENCE",
      dimension: isIelts ? "TR" : "TF",
      severity: "medium",
      sentenceId: off.sentenceId,
      quote: off.quote,
      detail: off.reason,
      delta: -0.25,
    });
  }
  if (template.hits.length > 0) {
    const h = template.hits[0];
    facts.push({
      code: "TEMPLATE_DETECTED",
      dimension: isIelts ? "TR" : "TF",
      severity: template.originality < 65 ? "high" : "medium",
      sentenceId: h.sentenceId,
      quote: h.quote,
      detail: `反模板检测命中 ${template.hits.length} 处，例如「${h.phrase}」（${h.category}）。${h.reason}`,
      metric: `原创度 ${template.originality}/100`,
      // 模板痕迹主要压制任务回应：套话占用了本应用于回应题目的篇幅
      delta: -Math.min(0.5, template.hits.reduce((a, x) => a + x.penalty, 0) * 0.5),
    });

    // 模板化的衔接语同样作用于连贯与衔接项
    const cohesionTemplates = template.hits.filter((x) =>
      ["模板衔接", "机械列举", "模板过渡", "中式总结"].includes(x.category),
    );
    if (cohesionTemplates.length > 0) {
      const ct = cohesionTemplates[0];
      facts.push({
        code: "TEMPLATE_COHESION",
        dimension: isIelts ? "CC" : "OD",
        severity: "low",
        sentenceId: ct.sentenceId,
        quote: ct.quote,
        detail: `衔接手段模板化：「${ct.phrase}」。${ct.reason}`,
        metric: `模板化衔接 ${cohesionTemplates.length} 处`,
        delta: -0.25,
      });
    }
  }
  const topicMisses = topics
    .flatMap((t) => t.phrases)
    .filter((p) => !lexis.usedTopicPhrases.includes(p.term))
    .slice(0, 3);
  if (topicMisses.length > 0) {
    facts.push({
      code: "TOPIC_LEXIS_GAP",
      dimension: isIelts ? "LR" : "LU",
      severity: "low",
      detail: `本话题的核心词伙尚未覆盖：${topicMisses.map((t) => t.term).join("、")}。`,
      delta: -0.25,
    });
  }

  /* ---------- 连贯与衔接 / 组织发展 ---------- */
  if (cohesion.density < 0.35 && stats.sentenceCount >= 5) {
    facts.push({
      code: "LOW_COHESION_DENSITY",
      dimension: isIelts ? "CC" : "OD",
      severity: "medium",
      detail: `衔接词密度仅 ${cohesion.density}/句（健康区间约 0.6–1.2）。句与句之间缺乏显性的逻辑标记，考官需要自行推断你的论证关系。`,
      metric: `衔接词密度 ${cohesion.density}`,
      delta: -0.5,
    });
  }
  if (cohesion.density > 1.8) {
    facts.push({
      code: "COHESION_OVERUSE",
      dimension: isIelts ? "CC" : "OD",
      severity: "medium",
      detail: `衔接词密度达 ${cohesion.density}/句，属于机械堆砌。考官会将其判定为「衔接手段使用不当」，因为逻辑关系被过度标记反而显得生硬。`,
      metric: `衔接词密度 ${cohesion.density}`,
      delta: -0.5,
    });
  }
  if (cohesion.categoriesUsed.length < 3 && stats.sentenceCount >= 5) {
    facts.push({
      code: "COHESION_MONOTONE",
      dimension: isIelts ? "CC" : "OD",
      severity: "medium",
      detail: `衔接手段只覆盖 ${cohesion.categoriesUsed.length} 类（${cohesion.categoriesUsed.join("、") || "无"}），多样性不足。增加对比、因果、举例类衔接词可明显改善。`,
      metric: `覆盖 ${cohesion.categoriesUsed.length} / 7 类`,
      delta: -0.5,
    });
  }
  if (cohesion.overused.length > 0) {
    const o = cohesion.overused[0];
    const s = first(o.sentenceId);
    facts.push({
      code: "COHESION_REPEAT",
      dimension: isIelts ? "CC" : "OD",
      severity: "medium",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `衔接词「${o.term}」在全文出现 ${o.count} 次，属于过度依赖单一衔接手段。`,
      metric: `${o.term} × ${o.count}`,
      delta: -0.25,
    });
  }
  if (
    cohesion.categoriesUsed.length >= 5 &&
    cohesion.density >= 0.6 &&
    cohesion.density <= 1.2
  ) {
    const s = cohesion.hits.find((h) => ["因果", "举例", "转折"].includes(h.category));
    const sen = s ? first(s.sentenceId) : undefined;
    facts.push({
      code: "GOOD_COHESION",
      dimension: isIelts ? "CC" : "OD",
      severity: "low",
      ...(sen ? { sentenceId: sen.id, quote: sen.text } : {}),
      detail: `衔接手段覆盖 ${cohesion.categoriesUsed.length} 类，密度 ${cohesion.density}/句，处于自然区间：逻辑关系清晰但未过度标记。`,
      metric: `覆盖 ${cohesion.categoriesUsed.length} / 7 类`,
      delta: 0.5,
    });
  }

  /* ---------- 词汇 / 语言使用 ---------- */
  if (lexis.awlDensity < 4 && stats.wordCount >= 80) {
    facts.push({
      code: "LOW_AWL",
      dimension: isIelts ? "LR" : "LU",
      severity: "medium",
      detail: `学术词表（AWL）词汇密度 ${lexis.awlDensity}/100 词，偏低。学术写作中该指标通常应达到 6–10。`,
      metric: `AWL ${lexis.awlDensity} / 100 words`,
      delta: -0.5,
    });
  }
  if (lexis.awlDensity >= 7) {
    const hit = lexis.awlHits[0];
    const s = hit ? first(hit.sentenceId) : undefined;
    facts.push({
      code: "GOOD_AWL",
      dimension: isIelts ? "LR" : "LU",
      severity: "low",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `学术词表词汇密度 ${lexis.awlDensity}/100 词，达到学术写作要求，说明具备相应的话题词汇储备。`,
      metric: `AWL ${lexis.awlDensity} / 100 words`,
      delta: 0.5,
    });
  }
  if (lexis.repetitions.length > 0) {
    const r = lexis.repetitions[0];
    const s = bundle.sentences.find((x) => x.text.toLowerCase().includes(r.word));
    facts.push({
      code: "WORD_REPETITION",
      dimension: isIelts ? "LR" : "LU",
      severity: r.count >= 6 ? "medium" : "low",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `「${r.word}」在全文出现 ${r.count} 次（含词形变化）。词汇项的多样性会被这一重复率拉低。`,
      metric: `${r.word} × ${r.count}`,
      delta: -0.25,
    });
  }
  if (lexis.informal.length > 0) {
    const inf = lexis.informal[0];
    const s = first(inf.sentenceId);
    facts.push({
      code: "INFORMAL_LANGUAGE",
      dimension: isIelts ? "LR" : "LU",
      severity: "medium",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `检测到 ${lexis.informal.length} 处口语化表达，例如「${inf.marker}」应改为「${inf.formal}」。语域不统一会直接影响该评分项。`,
      metric: `${lexis.informal.length} 处`,
      delta: -0.5,
    });
  }

  /* ---------- 语法 / 句式 ---------- */
  const errorRate = stats.sentenceCount
    ? grammar.errorSentences / stats.sentenceCount
    : 0;
  if (errorRate > 0.4 && grammar.errorSentences > 0) {
    const err = grammar.errors[0];
    const s = first(err.sentenceId);
    const rule = GRAMMAR_RULES.find((r) => r.id === err.ruleId);
    facts.push({
      code: "HIGH_ERROR_RATE",
      dimension: isIelts ? "GRA" : "LU",
      severity: "high",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `${grammar.errorSentences} / ${stats.sentenceCount} 个句子命中语法规则（${Math.round(errorRate * 100)}%）。${rule ? rule.message : ""}`,
      metric: `错误句占比 ${Math.round(errorRate * 100)}%`,
      delta: -1,
    });
  } else if (grammar.errorSentences > 0) {
    const err = grammar.errors[0];
    const s = first(err.sentenceId);
    facts.push({
      code: "SOME_ERRORS",
      dimension: isIelts ? "GRA" : "LU",
      severity: "low",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `检测到 ${grammar.errorSentences} 处语法或搭配问题，数量可控但会被考官计入准确性判断。`,
      metric: `${grammar.errorSentences} 处`,
      delta: -0.25,
    });
  } else if (stats.sentenceCount >= 5) {
    const s = bundle.sentences[Math.floor(bundle.sentences.length / 2)];
    facts.push({
      code: "CLEAN_GRAMMAR",
      dimension: isIelts ? "GRA" : "LU",
      severity: "low",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: "未检测到规则库覆盖的语法错误。考官对准确性有较好印象。",
      delta: 0.5,
    });
  }
  if (grammar.longSentences.length > 0) {
    const s = grammar.longSentences[0];
    facts.push({
      code: "RUN_ON_SENTENCE",
      dimension: isIelts ? "GRA" : "SV",
      severity: "medium",
      sentenceId: s.id,
      quote: s.text,
      detail: `存在 ${s.wordCount} 词的超长句，且包含多个独立分句。句子边界失控会同时影响准确性判断与可读性。`,
      metric: `${s.wordCount} words`,
      delta: -0.5,
    });
  }
  if (stats.lengthStdDev < 4 && stats.sentenceCount >= 6) {
    const s = bundle.sentences[0];
    facts.push({
      code: "MONOTONE_LENGTH",
      dimension: isIelts ? "GRA" : "SV",
      severity: "medium",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `句长标准差仅 ${stats.lengthStdDev}，句子长度高度一致（平均 ${stats.avgSentenceLength} 词），缺乏节奏变化。考官会判定为句式单一。`,
      metric: `标准差 ${stats.lengthStdDev}`,
      delta: -0.5,
    });
  }
  if (variety.complexRatio < 0.3 && stats.sentenceCount >= 5) {
    facts.push({
      code: "FEW_COMPLEX",
      dimension: isIelts ? "GRA" : "SV",
      severity: "medium",
      detail: `复合句占比仅 ${Math.round(variety.complexRatio * 100)}%。规则库检测到从句使用偏少，句法层次单薄。`,
      metric: `复合句 ${Math.round(variety.complexRatio * 100)}%`,
      delta: -0.5,
    });
  }
  if (variety.complexRatio >= 0.45) {
    const c = bundle.sentences.find((s) =>
      SUBORDINATORS.some((sub) => new RegExp(`\\b${sub}\\b`, "i").test(s.text)),
    );
    facts.push({
      code: "GOOD_COMPLEXITY",
      dimension: isIelts ? "GRA" : "SV",
      severity: "low",
      ...(c ? { sentenceId: c.id, quote: c.text } : {}),
      detail: `复合句占比 ${Math.round(variety.complexRatio * 100)}%，句法层次丰富，能承载复杂的逻辑关系。`,
      metric: `复合句 ${Math.round(variety.complexRatio * 100)}%`,
      delta: 0.5,
    });
  }
  for (const rep of variety.openerRepetition.slice(0, 1)) {
    const s = bundle.sentences.find((x) => x.text.toLowerCase().startsWith(rep.word));
    facts.push({
      code: "OPENER_REPETITION",
      dimension: isIelts ? "GRA" : "SV",
      severity: "medium",
      ...(s ? { sentenceId: s.id, quote: s.text } : {}),
      detail: `有 ${rep.count} 个句子以「${rep.word}」开头，句首结构重复，句式多样性不足。`,
      metric: `「${rep.word}」开头 × ${rep.count}`,
      delta: -0.25,
    });
  }

  /* ---------- 正向信号：立场清晰 / 段落结构 / 反方论证 ---------- */

  if (relevance.position.found && relevance.position.sentenceId) {
    facts.push({
      code: "CLEAR_POSITION",
      dimension: isIelts ? "TR" : "TF",
      severity: "low",
      sentenceId: relevance.position.sentenceId,
      quote: relevance.position.quote,
      detail:
        "立场句清晰可辨，考官能在开头段直接定位你的观点。这是任务回应项的基础得分点。",
      delta: 0.5,
    });
  }

  const bodyParas = bundle.paragraphs.filter((p) => p.role === "body");
  const hasConclusion = bundle.paragraphs.some((p) => p.role === "conclusion");
  if (bundle.paragraphs.length >= 4 && hasConclusion && bodyParas.length >= 2) {
    const anchor = first(bodyParas[0].sentenceIds[0]);
    facts.push({
      code: "GOOD_STRUCTURE",
      dimension: isIelts ? "CC" : "OD",
      severity: "low",
      ...(anchor ? { sentenceId: anchor.id, quote: anchor.text } : {}),
      detail: `段落结构完整：${bundle.paragraphs.length} 段，含引入段、${bodyParas.length} 个主体段与结论段。段落划分本身就是考官判断组织能力的显性依据。`,
      metric: `${bundle.paragraphs.length} 段 / 主体段 ${bodyParas.length} 个`,
      delta: 0.5,
    });
  }

  const counterPara = bundle.paragraphs.find(
    (p) =>
      p.role === "body" &&
      /\b(on the other hand|however|opponents?|critics?|those who|others? (argue|believe|claim))\b/i.test(
        p.text,
      ),
  );
  if (counterPara) {
    const anchor = first(counterPara.sentenceIds[0]);
    facts.push({
      code: "COUNTER_ARGUMENT",
      dimension: isIelts ? "TR" : "TF",
      severity: "low",
      ...(anchor ? { sentenceId: anchor.id, quote: anchor.text } : {}),
      detail:
        "文中包含对立面的讨论（让步段），说明回应了题目的双向要求，而不是单方面罗列支持理由。这是任务回应项进入高分段的重要标志。",
      delta: 0.25,
    });
  }

  /* ---------- 覆盖检测直接作用于任务回应 ---------- */
  if (coverage) {
    const missingStructural = coverage.items.filter(
      (i) => i.group === "结构要点" && i.status === "missing",
    );
    const overviewMissing = missingStructural.some((i) => i.label.includes("Overview"));
    if (missingStructural.length > 0) {
      facts.push({
        code: "COVERAGE_GAP",
        dimension: isIelts ? "TR" : "TF",
        severity: overviewMissing ? "high" : "medium",
        detail: `${coverage.title}发现 ${missingStructural.length} 项必要内容缺失：${missingStructural.map((i) => i.label).join("、")}。${
          overviewMissing
            ? "其中缺少 Overview 是最严重的：Task 1 没有概述句，任务完成项通常直接封顶 Band 5，因为考官无法判断你是否筛选出了主要特征。"
            : ""
        }`,
        metric: `缺失 ${missingStructural.length} 项必要内容`,
        delta: overviewMissing ? -1 : -0.5,
      });
    }

    const missingNumbers = coverage.items.filter(
      (i) => i.id.startsWith("num-") && i.status === "missing",
    );
    if (missingNumbers.length >= 3) {
      facts.push({
        code: "COVERAGE_NUMBERS",
        dimension: isIelts ? "TR" : "TF",
        severity: "medium",
        detail: `图表中有 ${missingNumbers.length} 个数据点未在文中出现（${missingNumbers
          .slice(0, 4)
          .map((i) => i.label)
          .join(
            "、",
          )} 等）。Task 1 考察的是「筛选关键信息」的能力，遗漏过多会被判定为数据覆盖不完整。`,
        metric: `遗漏 ${missingNumbers.length} 个数据点`,
        delta: -0.5,
      });
    }

    const missingRebuttals = coverage.items.filter(
      (i) => i.id.startsWith("listen-") && i.status === "missing",
    );
    if (missingRebuttals.length > 0) {
      facts.push({
        code: "MISSING_REBUTTAL",
        dimension: isIelts ? "TR" : "TF",
        severity: "high",
        detail: `有 ${missingRebuttals.length} 个听力反驳点未被转述（${missingRebuttals
          .map((i) => i.label)
          .join(
            "、",
          )}）。综合写作的评分核心是听力材料的还原度，阅读只是背景——遗漏反驳点是最严重的失分方式。`,
        metric: `遗漏 ${missingRebuttals.length} 个反驳点`,
        delta: -1,
      });
    }
  }

  /* ---------- 保底依据：每个评分项至少两条可定位到原文的依据 ---------- */
  facts.push(...baselineFacts(bundle, exam, taskType, facts));

  return facts;
}

/**
 * 保底依据。
 *
 * 评分项如果只有零到一条依据，用户看到的会是「有分数但没有解释」——
 * 这正是我们要避免的空泛评价。这里为每个评分项补齐到至少两条
 * 基于客观指标的中性依据，每条都引用最具代表性的那句话。
 */
function baselineFacts(
  bundle: Omit<AnalysisBundle, "facts" | "corpus">,
  exam: ExamType,
  taskType: TaskType,
  existing: Fact[],
): Fact[] {
  const { stats, sentences, paragraphs, cohesion, lexis, grammar } = bundle;
  const isIelts = exam === "ielts";
  const out: Fact[] = [];
  const countFor = (dim: DimensionId) =>
    existing.filter((f) => f.dimension === dim).length +
    out.filter((f) => f.dimension === dim).length;

  const quoteOf = (s?: Sentence) => (s ? { sentenceId: s.id, quote: s.text } : {});

  const byLength = [...sentences].sort((a, b) => b.wordCount - a.wordCount);
  const longest = byLength[0];
  const shortest = byLength[byLength.length - 1];
  const firstBody =
    paragraphs.find((p) => p.role === "body") ?? paragraphs[1] ?? paragraphs[0];
  const bodyAnchor = firstBody
    ? sentences.find((s) => s.id === firstBody.sentenceIds[0])
    : sentences[0];
  const denseSentence = [...sentences].sort(
    (a, b) =>
      cohesion.hits.filter((h) => h.sentenceId === b.id).length -
      cohesion.hits.filter((h) => h.sentenceId === a.id).length,
  )[0];
  const introAnchor = paragraphs[0]
    ? sentences.find((s) => s.id === paragraphs[0].sentenceIds[0])
    : sentences[0];
  const lastAnchor = paragraphs.length
    ? sentences.find((s) => s.id === paragraphs[paragraphs.length - 1].sentenceIds[0])
    : undefined;

  const plan: { dimension: DimensionId; facts: Omit<Fact, "dimension">[] }[] = [
    {
      dimension: isIelts ? "TR" : "TF",
      facts: [
        {
          code: "BASE_TASK",
          severity: "low",
          ...quoteOf(introAnchor),
          detail: `引入段的定位是「背景 + 立场」。本题要求覆盖：${TASK_REQUIREMENTS[taskType].instructions.join("、")}。考官会逐项核对是否回应，而不是笼统判断「写得像不像议论文」。`,
          metric: `词数 ${stats.wordCount}，段落 ${stats.paragraphCount}`,
          delta: 0,
        },
        {
          code: "BASE_TASK_2",
          severity: "low",
          ...quoteOf(lastAnchor ?? longest),
          detail: `结尾段的定位是「综合前文 + 重申立场」。当前全文 ${stats.wordCount} 词，${stats.wordCount < TASK_REQUIREMENTS[taskType].minWords ? `低于最低要求 ${TASK_REQUIREMENTS[taskType].minWords} 词——字数不足往往直接对应论点展开不充分。` : "字数达标。"}写完后自检：每个主体段的论点是否都有解释与例证，而不只是断言。`,
          metric: `${stats.wordCount} / ${TASK_REQUIREMENTS[taskType].minWords} words`,
          delta: 0,
        },
      ],
    },
    {
      dimension: isIelts ? "CC" : "OD",
      facts: [
        {
          code: "BASE_COHESION",
          severity: "low",
          ...quoteOf(bodyAnchor),
          detail: `主体段的中心句应当承载段落论点。当前衔接词密度 ${cohesion.density}/句，覆盖 ${cohesion.categoriesUsed.length}/7 类逻辑关系。理想状态是每段围绕一个论点展开，段间用不同的衔接手段推进，而不是靠 Firstly/Secondly 排序。`,
          metric: `衔接词密度 ${cohesion.density}/句，${cohesion.categoriesUsed.length}/7 类`,
          delta: 0,
        },
        {
          code: "BASE_COHESION_2",
          severity: "low",
          ...quoteOf(denseSentence),
          detail: `这一句是全文衔接最密集的句子。全文共 ${stats.sentenceCount} 句分布在 ${stats.paragraphCount} 段中。连贯与衔接项的判断依据是「逻辑关系是否靠衔接手段显性标记」，而不是句子之间靠读者自行推断。`,
          metric: `${stats.sentenceCount} 句 / ${stats.paragraphCount} 段`,
          delta: 0,
        },
      ],
    },
    {
      dimension: isIelts ? "LR" : "LU",
      facts: [
        {
          code: "BASE_LEXIS",
          severity: "low",
          ...quoteOf(denseSentence ?? longest),
          detail: `词汇多样度（去重后实词占比）为 ${stats.ttr}，学术词表密度 ${lexis.awlDensity}/100 词。考官在这一项上看两件事：是否用了话题相关的高频词伙，以及搭配是否地道，而不只是「词汇量大小」。`,
          metric: `TTR ${stats.ttr}，AWL ${lexis.awlDensity}/100`,
          delta: 0,
        },
        {
          code: "BASE_LEXIS_2",
          severity: "low",
          ...quoteOf(longest),
          detail: `刻意练习方向：把泛化词替换为精确表达（good → beneficial、big → substantial、things → factors）。同一实词在全文出现 ${lexis.repetitions[0]?.count ?? 1} 次以上时，就应考虑同义替换，避免被判定为词汇手段单一。`,
          metric: `重复词 Top1：${lexis.repetitions[0] ? `${lexis.repetitions[0].word} × ${lexis.repetitions[0].count}` : "无"}`,
          delta: 0,
        },
      ],
    },
    {
      dimension: isIelts ? "GRA" : "SV",
      facts: [
        {
          code: "BASE_GRAMMAR",
          severity: "low",
          ...quoteOf(longest),
          detail: `全文共 ${stats.sentenceCount} 句，平均句长 ${stats.avgSentenceLength} 词，句长标准差 ${stats.lengthStdDev}。最短句 ${shortest?.wordCount ?? 0} 词，最长句 ${longest?.wordCount ?? 0} 词。考官通过句长变化与从句使用判断句法层次，句子长度高度一致会被判定为句式单一。`,
          metric: `平均 ${stats.avgSentenceLength} 词，标准差 ${stats.lengthStdDev}`,
          delta: 0,
        },
        {
          code: "BASE_GRAMMAR_2",
          severity: "low",
          ...quoteOf(shortest ?? bodyAnchor),
          detail:
            grammar.errorSentences === 0
              ? "语法检查未发现规则库覆盖的错误类型（主谓一致、冠词、可数性、连词冗余、中式搭配等）。需要说明的是，规则检查只覆盖高频错误，不能替代人工校对。"
              : `本文有 ${grammar.errorSentences} 个句子命中语法规则。语法项的准确率是按「错误句占比」整体判断的，个别失误不影响理解时不会大幅降档，但同一类错误反复出现会被视为系统性缺陷。`,
          metric: `错误句 ${grammar.errorSentences} / ${stats.sentenceCount}`,
          delta: 0,
        },
      ],
    },
  ];

  for (const group of plan) {
    for (const fact of group.facts) {
      if (countFor(group.dimension) >= 2) break;
      out.push({ ...fact, dimension: group.dimension } as Fact);
    }
  }

  return out;
}

export { roundToStep, countWords, capitalize };
