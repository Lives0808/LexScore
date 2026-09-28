"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AnnotationStatus, CorpusItem, DimensionId, Report } from "./types";

/**
 * 本地存储层。
 *
 * MVP 阶段报告与语料都存在浏览器 localStorage，不需要账号体系即可完整体验。
 * 后续接入服务端时，把这个模块的读写函数换成 API 调用即可，UI 不用改。
 */

const REPORT_KEY = "lexscore:reports:v1";
const MAX_REPORTS = 40;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * 订阅：把 localStorage 当作外部数据源，用 useSyncExternalStore 读取
 * ------------------------------------------------------------------ */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("lexscore:reports-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("lexscore:reports-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** 原始字符串快照。字符串按值比较，所以引用稳定，不会引起重复渲染 */
function getRawSnapshot(): string {
  return window.localStorage.getItem(REPORT_KEY) ?? "";
}

const EMPTY = "";

/** 本地数据是否已经可用（服务端渲染与首次 hydration 时为 false） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useReports(): Report[] {
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, () => EMPTY);
  return useMemo(
    () => safeParse<Report[]>(raw, []).sort((a, b) => b.createdAt - a.createdAt),
    [raw],
  );
}

/* ------------------------------------------------------------------ *
 * 命令式读写（事件回调里使用）
 * ------------------------------------------------------------------ */

export function listReports(): Report[] {
  if (typeof window === "undefined") return [];
  const reports = safeParse<Report[]>(window.localStorage.getItem(REPORT_KEY), []);
  return reports.sort((a, b) => b.createdAt - a.createdAt);
}

export function getReport(id: string): Report | undefined {
  return listReports().find((r) => r.id === id);
}

export function saveReport(report: Report): void {
  if (typeof window === "undefined") return;
  const reports = listReports().filter((r) => r.id !== report.id);
  reports.unshift(report);
  window.localStorage.setItem(
    REPORT_KEY,
    JSON.stringify(reports.slice(0, MAX_REPORTS)),
  );
  notify();
}

export function deleteReport(id: string): void {
  if (typeof window === "undefined") return;
  const reports = listReports().filter((r) => r.id !== id);
  window.localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
  notify();
}

export function updateAnnotationStatus(
  reportId: string,
  annotationId: string,
  status: AnnotationStatus,
): void {
  if (typeof window === "undefined") return;
  const reports = listReports();
  const index = reports.findIndex((r) => r.id === reportId);
  if (index < 0) return;
  reports[index] = {
    ...reports[index],
    annotations: reports[index].annotations.map((a) =>
      a.id === annotationId ? { ...a, status } : a,
    ),
  };
  window.localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
  notify();
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REPORT_KEY);
  notify();
}

function notify(): void {
  window.dispatchEvent(new Event("lexscore:reports-changed"));
}

/* ------------------------------------------------------------------ *
 * 个人写作语料库
 * ------------------------------------------------------------------ */

export interface CorpusBucket {
  phrases: CorpusItem[];
  sentences: CorpusItem[];
  errors: CorpusItem[];
}

/** 汇总所有报告的语料，按文本去重并统计出现频次 */
export function aggregateCorpus(reports: Report[]): CorpusItem[] {
  const seen = new Map<string, CorpusItem & { occurrences: number }>();
  for (const report of reports) {
    for (const item of report.corpus ?? []) {
      const key = `${item.kind}|${item.text.toLowerCase()}`;
      const existing = seen.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        seen.set(key, { ...item, occurrences: 1 });
      }
    }
  }
  return [...seen.values()].sort((a, b) => {
    const ao = (a as CorpusItem & { occurrences: number }).occurrences;
    const bo = (b as CorpusItem & { occurrences: number }).occurrences;
    return bo - ao || b.createdAt - a.createdAt;
  });
}

export function bucketCorpus(items: CorpusItem[]): CorpusBucket {
  return {
    phrases: items.filter((i) => i.kind === "phrase"),
    sentences: items.filter((i) => i.kind === "sentence"),
    errors: items.filter((i) => i.kind === "error"),
  };
}

export interface CorpusStats {
  totalEssays: number;
  totalWords: number;
  /** 各维度上的错误累计次数，用于画薄弱项分布 */
  errorByDimension: { dimension: DimensionId; label: string; count: number }[];
  topErrors: { text: string; correction?: string; count: number; note: string }[];
  recurringPhrases: { text: string; count: number }[];
}

const DIMENSION_LABELS: Record<string, string> = {
  TR: "任务回应",
  CC: "连贯与衔接",
  LR: "词汇丰富度",
  GRA: "语法准确度",
  TF: "任务完成",
  OD: "组织发展",
  LU: "语言使用",
  SV: "句式多样性",
};

export function corpusStats(items: CorpusItem[], reports: Report[]): CorpusStats {
  const errors = items.filter((i) => i.kind === "error");
  const byDim = new Map<DimensionId, number>();

  for (const e of errors) {
    const occ = (e as CorpusItem & { occurrences?: number }).occurrences ?? 1;
    byDim.set(e.dimension, (byDim.get(e.dimension) ?? 0) + occ);
  }

  const topErrors = errors
    .map((e) => ({
      text: e.text,
      correction: e.correction,
      count: (e as CorpusItem & { occurrences?: number }).occurrences ?? 1,
      note: e.note,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recurringPhrases = items
    .filter((i) => i.kind === "phrase")
    .map((i) => ({
      text: i.text,
      count: (i as CorpusItem & { occurrences?: number }).occurrences ?? 1,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totalEssays: reports.length,
    totalWords: reports.reduce((a, r) => a + r.wordCount, 0),
    errorByDimension: [...byDim.entries()]
      .map(([dimension, count]) => ({
        dimension,
        label: DIMENSION_LABELS[dimension] ?? dimension,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    topErrors,
    recurringPhrases,
  };
}
