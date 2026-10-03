"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnnotationStatus } from "@/lib/types";
import { applyAccepted, DIMENSION_LABELS } from "@/lib/text";
import { updateAnnotationStatus, useHydrated, useReports } from "@/lib/store";
import DimensionCard from "./DimensionCard";
import RadarChart from "./RadarChart";
import SentenceDiff from "./SentenceDiff";
import { AgentTracePanel } from "./Insights";
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

export default function ReportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("id") ?? "";
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
        <h1 className="text-ink text-[18px] font-semibold">找不到这份批改记录</h1>
        <p className="text-ink-soft mt-2 text-[13px] leading-relaxed">
          批改结果保存在本机浏览器中。如果更换了浏览器或清理过缓存，记录就会丢失。
        </p>
        <Link
          href="/"
          className="bg-accent-solid mt-5 inline-block rounded-lg px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
        >
          返回批改
        </Link>
      </div>
    );
  }

  if (!report || !stats) {
    return (
      <div className="text-ink-faint mx-auto max-w-[640px] px-5 py-24 text-center text-[13px]">
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
          <h1 className="text-ink mt-3 text-[15px] leading-relaxed font-medium">
            {report.prompt.length > 180
              ? `${report.prompt.slice(0, 180)}…`
              : report.prompt}
          </h1>
        </div>

        <div className="border-line bg-card flex w-full items-center gap-4 rounded-xl border px-4 py-4 sm:gap-5 lg:w-auto lg:px-5">
          <div className="text-center">
            <div className="text-ink text-[30px] leading-none font-semibold tracking-tight sm:text-[34px]">
              {report.exam === "ielts" ? report.overall.toFixed(1) : report.overall}
            </div>
            <div className="text-ink-faint mt-1.5 text-[11px]">
              {report.exam === "ielts" ? "Overall Band" : "总分 / 30"}
            </div>
          </div>
          <div className="bg-line h-12 w-px shrink-0" />
          <div className="min-w-0 flex-1 space-y-1 lg:flex-none">
            {report.dimensions.map((d) => (
              <div key={d.dimension} className="flex items-center gap-2">
                <span className="text-ink-soft flex-1 truncate text-[11.5px] lg:w-[104px] lg:flex-none">
                  {DIMENSION_LABELS[d.dimension] ?? d.label}
                </span>
                <span className="text-ink text-[12px] font-semibold tabular-nums">
                  {d.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 总评 */}
      <section className="border-line bg-card mt-6 rounded-xl border p-5">
        <h2 className="text-ink text-[13px] font-semibold">考官式总评</h2>
        <p className="text-ink-soft mt-2 text-[13px] leading-[1.9]">{report.summary}</p>
      </section>

      {/* 四维评分 */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-ink text-[15px] font-semibold">四维评分</h2>
          <span className="text-ink-faint text-[11.5px]">
            展开可查看每一项的评分依据与原文引用
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* 雷达图：一眼看出强弱项的形状 */}
          <div className="border-line bg-card flex flex-col items-center rounded-xl border p-4">
            <RadarChart
              dimensions={report.dimensions}
              baseline={report.exam === "ielts" ? 6 : 3}
            />
            <p className="text-ink-faint mt-2 text-center text-[11px] leading-relaxed">
              虚线为 {report.exam === "ielts" ? "Band 6.0" : "3.0 分"} 参考线，
              <br />
              落在虚线内的维度就是当前短板。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {report.dimensions.map((d) => (
              <DimensionCard key={d.dimension} dimension={d} onJump={jump} />
            ))}
          </div>
        </div>
      </section>

      {/* 逐句批注 */}
      <section className="mt-9">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-ink text-[15px] font-semibold">逐句对照批注</h2>

          <div className="no-print flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
            <div className="border-line bg-card inline-flex overflow-x-auto rounded-lg border p-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatus(f.id)}
                  className={`shrink-0 rounded-[6px] px-2.5 py-1.5 text-[11.5px] whitespace-nowrap transition ${
                    status === f.id
                      ? "bg-accent-solid text-white"
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
              className="border-line bg-card text-ink-soft focus:border-accent min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] outline-none lg:flex-none"
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
        <div className="border-line bg-card mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border px-4 py-3">
          <span className="text-ink-soft text-[12px]">
            共 <b className="text-ink">{stats.total}</b> 条批注 · 待处理{" "}
            <b className="text-accent">{stats.pending}</b> · 已接受{" "}
            <b className="text-pos">{stats.accepted}</b> · 已忽略{" "}
            <b className="text-ink-faint">{stats.ignored}</b>
          </span>
          <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto">
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
              className="border-line text-ink-soft hover:border-pos hover:text-pos flex-1 rounded-lg border px-3 py-2 text-[12px] transition disabled:opacity-40 lg:flex-none lg:py-1.5 lg:text-[11.5px]"
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
              className="bg-accent-solid flex-1 rounded-lg px-3 py-2 text-[12px] font-medium text-white transition hover:opacity-90 lg:flex-none lg:py-1.5 lg:text-[11.5px]"
            >
              {copied ? "已复制" : "复制修改稿"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="border-line text-ink-soft hover:border-line-strong hover:text-ink flex-1 rounded-lg border px-3 py-2 text-[12px] transition lg:flex-none lg:py-1.5 lg:text-[11.5px]"
            >
              导出 PDF
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

      {/* 三层 Agent 轨迹 */}
      <section className="mt-9">
        <AgentTracePanel report={report} />
      </section>

      {/* 结构诊断 */}
      <section className="mt-9">
        <h2 className="text-ink mb-3 text-[15px] font-semibold">结构诊断</h2>
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
            <h2 className="text-ink text-[15px] font-semibold">已沉淀到个人语料库</h2>
            <button
              type="button"
              onClick={() => router.push("/corpus")}
              className="text-accent text-[11.5px] transition hover:opacity-75"
            >
              查看语料库 →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.corpus.map((item) => (
              <div
                key={item.id}
                className="border-line bg-card rounded-lg border px-3.5 py-3"
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
                <p className="text-ink mt-2 text-[12.5px] leading-relaxed">
                  {item.text.length > 130 ? `${item.text.slice(0, 130)}…` : item.text}
                </p>
                {item.correction && (
                  <p className="text-pos mt-1 text-[12px]">→ {item.correction}</p>
                )}
                <p className="text-ink-faint mt-1.5 text-[11.5px] leading-relaxed">
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
