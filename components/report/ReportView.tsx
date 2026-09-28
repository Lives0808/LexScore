"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnnotationStatus } from "@/lib/types";
import { applyAccepted, DIMENSION_LABELS } from "@/lib/text";
import { updateAnnotationStatus, useHydrated, useReports } from "@/lib/store";
import DimensionCard from "./DimensionCard";
import SentenceDiff from "./SentenceDiff";
import {
  ConstraintsPanel,
  CoveragePanel,
  RelevancePanel,
  TemplatePanel,
} from "./Diagnostics";
import { Badge } from "../ui/Badge";

const STATUS_FILTERS = [
  { id: "", label: "全部" },
  { id: "pending", label: "待处理" },
  { id: "accepted", label: "已接受" },
  { id: "ignored", label: "已忽略" },
];

export default function ReportView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const reports = useReports();
  const [dimension, setDimension] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [copied, setCopied] = useState(false);

  const report = reports.find((r) => r.id === reportId) ?? null;
  const missing = hydrated && !report;

  function handleChange(annotationId: string, next: AnnotationStatus) {
    updateAnnotationStatus(reportId, annotationId, next);
  }

  function jump(sentenceId: string) {
    document
      .getElementById(`sent-${sentenceId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const stats = (() => {
    if (!report) return null;
    const total = report.annotations.length;
    const accepted = report.annotations.filter((a) => a.status === "accepted").length;
    const ignored = report.annotations.filter((a) => a.status === "ignored").length;
    const actionable = report.annotations.filter(
      (a) => a.status === "pending" && a.replacement,
    ).length;
    return { total, accepted, ignored, pending: total - accepted - ignored, actionable };
  })();

  if (missing) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center">
        <h1 className="text-[18px] font-semibold text-ink">找不到这份批改记录</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          批改结果保存在本机浏览器中。如果更换了浏览器或清理过缓存，记录就会丢失。
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
        >
          返回批改
        </Link>
      </div>
    );
  }

  if (!report || !stats) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center text-[13px] text-ink-faint">
        加载中…
      </div>
    );
  }

  const revised = report.sentences
    .map((s) =>
      applyAccepted(
        s.text,
        report.annotations.filter((a) => a.sentenceId === s.id),
      ),
    )
    .join(" ");

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8">
      {/* 头部 */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{report.taskLabel}</Badge>
            <Badge tone="neutral">{report.engine}</Badge>
            <Badge tone="neutral">{report.wordCount} 词</Badge>
            <Badge tone="neutral">
              {new Date(report.createdAt).toLocaleString("zh-CN")}
            </Badge>
          </div>
          <h1 className="mt-3 text-[15px] leading-relaxed font-medium text-ink">
            {report.prompt.length > 180
              ? `${report.prompt.slice(0, 180)}…`
              : report.prompt}
          </h1>
        </div>

        <div className="flex items-center gap-5 rounded-xl border border-line bg-card px-5 py-4">
          <div className="text-center">
            <div className="text-[34px] leading-none font-semibold tracking-tight text-ink">
              {report.exam === "ielts"
                ? report.overall.toFixed(1)
                : report.overall}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-faint">
              {report.exam === "ielts" ? "Overall Band" : "总分 / 30"}
            </div>
          </div>
          <div className="h-12 w-px bg-line" />
          <div className="space-y-1">
            {report.dimensions.map((d) => (
              <div key={d.dimension} className="flex items-center gap-2">
                <span className="w-[104px] truncate text-[11.5px] text-ink-soft">
                  {DIMENSION_LABELS[d.dimension] ?? d.label}
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-ink">
                  {d.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 总评 */}
      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-[13px] font-semibold text-ink">考官式总评</h2>
        <p className="mt-2 text-[13px] leading-[1.9] text-ink-soft">
          {report.summary}
        </p>
      </section>

      {/* 四维评分 */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">四维评分</h2>
          <span className="text-[11.5px] text-ink-faint">
            展开可查看每一项的评分依据与原文引用
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {report.dimensions.map((d) => (
            <DimensionCard key={d.dimension} dimension={d} onJump={jump} />
          ))}
        </div>
      </section>

      {/* 逐句批注 */}
      <section className="mt-9">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-ink">逐句对照批注</h2>
          <span className="text-[11.5px] text-ink-faint">
            悬浮高亮处查看原因 · 单条可接受或忽略
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatus(f.id)}
                  className={`rounded-[6px] px-2.5 py-1 text-[11.5px] transition ${
                    status === f.id
                      ? "bg-accent text-white"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={dimension ?? ""}
              onChange={(e) => setDimension(e.target.value || null)}
              className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11.5px] text-ink-soft outline-none focus:border-accent"
            >
              <option value="">全部评分项</option>
              {report.dimensions.map((d) => (
                <option key={d.dimension} value={d.dimension}>
                  {DIMENSION_LABELS[d.dimension] ?? d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
          <span className="text-[12px] text-ink-soft">
            共 <b className="text-ink">{stats.total}</b> 条批注 ·
            待处理 <b className="text-accent">{stats.pending}</b> ·
            已接受 <b className="text-pos">{stats.accepted}</b> ·
            已忽略 <b className="text-ink-faint">{stats.ignored}</b>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                for (const a of report.annotations) {
                  if (a.status === "pending" && a.replacement) {
                    updateAnnotationStatus(reportId, a.id, "accepted");
                  }
                }
              }}
              disabled={stats.actionable === 0}
              className="rounded-lg border border-line px-3 py-1.5 text-[11.5px] text-ink-soft transition hover:border-pos hover:text-pos disabled:opacity-40"
            >
              全部接受
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(revised);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white transition hover:opacity-90"
            >
              {copied ? "已复制" : "复制修改稿"}
            </button>
          </div>
        </div>

        <SentenceDiff
          sentences={report.sentences}
          paragraphs={report.paragraphs}
          annotations={report.annotations}
          onChangeStatus={handleChange}
          filter={{ dimension, status: status || null }}
        />
      </section>

      {/* 结构诊断 */}
      <section className="mt-9">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">结构诊断</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <RelevancePanel relevance={report.relevance} onJump={jump} />
            <TemplatePanel template={report.template} onJump={jump} />
          </div>
          <div className="space-y-4">
            {report.coverage && (
              <CoveragePanel coverage={report.coverage} onJump={jump} />
            )}
            <ConstraintsPanel report={report} />
          </div>
        </div>
      </section>

      {/* 语料沉淀 */}
      {report.corpus.length > 0 && (
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-ink">
              已沉淀到个人语料库
            </h2>
            <button
              type="button"
              onClick={() => router.push("/corpus")}
              className="text-[11.5px] text-accent transition hover:opacity-75"
            >
              查看语料库 →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.corpus.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-line bg-card px-3.5 py-3"
              >
                <div className="flex items-center gap-1.5">
                  <Badge
                    tone={
                      item.kind === "error"
                        ? "neg"
                        : item.kind === "sentence"
                          ? "accent"
                          : "pos"
                    }
                  >
                    {item.kind === "error"
                      ? "高频错误"
                      : item.kind === "sentence"
                        ? "好句"
                        : "好词"}
                  </Badge>
                  {item.topic && <Badge tone="neutral">{item.topic}</Badge>}
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink">
                  {item.text.length > 130 ? `${item.text.slice(0, 130)}…` : item.text}
                </p>
                {item.correction && (
                  <p className="mt-1 text-[12px] text-pos">→ {item.correction}</p>
                )}
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
