import type { CorpusItem, DimensionId, Report } from "../types";
import { GRAMMAR_RULES } from "./lexicon";

/**
 * 个人写作语料库的检索增强分析。
 *
 * 用户提出的需求：不要只存历史记录，要能说
 * 「你上周犯了 3 次主谓一致错误，这次又犯了 2 次，建议专项突破」。
 *
 * 这里的「检索」是在**用户自己的作文**上做结构化聚合 ——
 * 不需要向量库，因为错误类型本身就是结构化的标签。
 * 关键是三个判断：
 *   1. 哪些错误是**反复出现**的（需要专项突破）
 *   2. 哪些**正在改善**（趋势下降）
 *   3. 哪些**已经掌握**（以前错、最近不再错）
 */

export type TrendDirection = "increasing" | "decreasing" | "stable" | "new";

export interface ErrorTrend {
  key: string;
  /** 人话描述的错误类型，如「主谓一致」 */
  label: string;
  dimension: DimensionId;
  /** 累计出现次数 */
  totalCount: number;
  /** 出现在几篇作文里 */
  reportCount: number;
  /** 最近 3 篇里的出现次数 */
  recentCount: number;
  /** 更早的出现次数 */
  earlierCount: number;
  trend: TrendDirection;
  lastSeenAt: number;
  /** 原文片段，最多 3 条 */
  examples: string[];
  /** 针对性的建议 */
  advice: string;
}

export interface LearnerInsight {
  headline: string;
  /** 需要专项突破的，按优先级排序 */
  recurring: ErrorTrend[];
  /** 正在改善的 */
  improving: ErrorTrend[];
  /** 以前出错、最近没再犯的 */
  mastered: ErrorTrend[];
  /** 用户自己用过的高级表达，鼓励复用 */
  strengthWords: string[];
  reportCount: number;
  /** 语料覆盖的天数 */
  spanDays: number;
}

/** 从语料条目的 id 里还原出规则来源 */
function errorKeyOf(item: CorpusItem): {
  key: string;
  label: string;
  dimension: DimensionId;
  advice: string;
} {
  const grammarId = item.id.match(/-error-(.+)$/)?.[1];
  if (grammarId) {
    const rule = GRAMMAR_RULES.find((r) => r.id === grammarId);
    return {
      key: grammarId,
      label: rule?.message.split("，")[0].split("。")[0] ?? grammarId,
      dimension: rule?.dimension ?? item.dimension,
      advice: rule?.fixNote ?? item.note,
    };
  }
  const informal = item.id.match(/-informal-(.+)$/)?.[1];
  if (informal) {
    return {
      key: `informal:${informal}`,
      label: `口语化表达「${informal}」`,
      dimension: item.dimension,
      advice: `书面学术语域中应换成 ${item.correction ?? "更正式的表达"}。`,
    };
  }
  return {
    key: item.id,
    label: item.text.slice(0, 24),
    dimension: item.dimension,
    advice: item.note,
  };
}

/** 每篇作文错误类型 → 该篇出现次数 */
function errorsPerReport(
  report: Report,
): Map<string, { count: number; examples: string[] }> {
  const map = new Map<string, { count: number; examples: string[] }>();

  for (const item of report.corpus) {
    if (item.kind !== "error") continue;
    const { key } = errorKeyOf(item);
    const entry = map.get(key) ?? { count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 3) entry.examples.push(item.text);
    map.set(key, entry);
  }

  // 同一规则在一篇里可能命中多句，用批注补足计数
  for (const a of report.annotations) {
    if (a.tag !== "grammar") continue;
    const ruleId = a.id.split(":")[0];
    const entry = map.get(ruleId);
    if (!entry) continue; // 只统计已经进语料库的类型，避免噪声
    entry.count = Math.max(entry.count, 1);
  }

  return map;
}

/**
 * 「最近」的窗口大小。
 *
 * 固定用 3 篇在篇数少时会让全部历史都算「最近」，
 * 导致「已掌握」「正在改善」永远为空。所以取「3 篇」与「一半历史」的较小值 ——
 * 3 篇时窗口为 1（最新一篇 vs 之前），10 篇时窗口为 3。
 */
function recentWindowOf(total: number): number {
  return Math.max(1, Math.min(3, Math.floor(total / 2)));
}

export function analyzeHistory(reports: Report[]): LearnerInsight {
  const sorted = [...reports].sort((a, b) => b.createdAt - a.createdAt); // 新 → 旧

  const trends = new Map<
    string,
    {
      label: string;
      dimension: DimensionId;
      advice: string;
      totalCount: number;
      reportCount: number;
      recentCount: number;
      earlierCount: number;
      lastSeenAt: number;
      examples: string[];
    }
  >();

  const recentWindow = recentWindowOf(sorted.length);
  sorted.forEach((report, index) => {
    const perReport = errorsPerReport(report);
    const isRecent = index < recentWindow;

    for (const [key, { count, examples }] of perReport) {
      const meta = errorKeyOf(
        report.corpus.find((c) => c.kind === "error" && errorKeyOf(c).key === key) ?? {
          id: key,
          kind: "error",
          text: examples[0] ?? "",
          dimension: "GRA" as DimensionId,
          note: "",
          sourceReportId: report.id,
          createdAt: report.createdAt,
        },
      );

      const entry = trends.get(key) ?? {
        label: meta.label,
        dimension: meta.dimension,
        advice: meta.advice,
        totalCount: 0,
        reportCount: 0,
        recentCount: 0,
        earlierCount: 0,
        lastSeenAt: 0,
        examples: [],
      };

      entry.totalCount += count;
      entry.reportCount += 1;
      if (isRecent) entry.recentCount += count;
      else entry.earlierCount += count;
      entry.lastSeenAt = Math.max(entry.lastSeenAt, report.createdAt);
      for (const ex of examples) {
        if (entry.examples.length < 3 && !entry.examples.includes(ex))
          entry.examples.push(ex);
      }
      trends.set(key, entry);
    }
  });

  const all: ErrorTrend[] = [...trends.entries()].map(([key, t]) => {
    // 趋势判断：新旧两段按「每篇平均次数」比，避免篇数不均导致的偏差
    const recentReports = Math.min(recentWindow, sorted.length);
    const earlierReports = Math.max(1, sorted.length - recentReports);
    const recentRate = t.recentCount / Math.max(1, recentReports);
    const earlierRate = t.earlierCount / earlierReports;

    let trend: TrendDirection;
    if (t.earlierCount === 0 && t.recentCount > 0) trend = "new";
    else if (recentRate > earlierRate * 1.3) trend = "increasing";
    else if (recentRate < earlierRate * 0.7) trend = "decreasing";
    else trend = "stable";

    return { key, ...t, trend };
  });

  const repeated = all.filter((t) => t.reportCount >= 2);
  const recurring = repeated
    .filter((t) => t.trend === "increasing" || t.trend === "stable" || t.trend === "new")
    .sort((a, b) => b.recentCount - a.recentCount || b.totalCount - a.totalCount)
    .slice(0, 5);

  const improving = repeated
    .filter((t) => t.trend === "decreasing")
    .sort((a, b) => b.totalCount - a.totalCount);

  // 已掌握：以前出现过、最近 3 篇里一次没犯
  const mastered = all
    .filter((t) => t.recentCount === 0 && t.earlierCount > 0)
    .sort((a, b) => b.earlierCount - a.earlierCount);

  const strengthWords = [
    ...new Set(
      sorted
        .flatMap((r) => r.corpus.filter((c) => c.kind === "phrase").map((c) => c.text))
        .filter((t) => t.length > 3),
    ),
  ].slice(0, 16);

  const spanDays =
    sorted.length >= 2
      ? Math.max(
          1,
          Math.round(
            (sorted[0].createdAt - sorted[sorted.length - 1].createdAt) / 86_400_000,
          ),
        )
      : 0;

  /* ---------------- 一句话诊断 ---------------- */

  let headline: string;
  if (sorted.length < 2) {
    headline = `目前只有 ${sorted.length} 篇记录。多写几篇之后，这里会指出你反复出错的地方。`;
  } else if (recurring.length === 0 && mastered.length > 0) {
    headline = `最近 ${recentWindow} 篇里，之前反复出现的 ${mastered.length} 类错误都没再犯 —— 这是实打实的进步。`;
  } else if (recurring.length > 0) {
    const top = recurring[0];
    headline =
      `最近 ${recentWindow} 篇里，「${top.label}」出现了 ${top.recentCount} 次` +
      `（累计 ${top.totalCount} 次，分布在 ${top.reportCount} 篇中）。` +
      `这是当前最值得专项突破的一项。`;
  } else if (improving.length > 0) {
    const top = improving[0];
    headline = `「${top.label}」正在改善：早期出现 ${top.earlierCount} 次，最近只出现 ${top.recentCount} 次。`;
  } else {
    headline = "整体稳定，暂未发现反复出现的系统性问题。";
  }

  return {
    headline,
    recurring,
    improving,
    mastered,
    strengthWords,
    reportCount: sorted.length,
    spanDays,
  };
}

/** 把趋势渲染成一句话，供界面上直接展示 */
export function trendLabel(trend: TrendDirection): string {
  switch (trend) {
    case "increasing":
      return "变严重";
    case "decreasing":
      return "在改善";
    case "new":
      return "新出现";
    default:
      return "持续存在";
  }
}
