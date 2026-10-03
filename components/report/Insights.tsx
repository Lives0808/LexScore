"use client";

import type { Report } from "@/lib/types";
import type { LearnerInsight, TrendDirection } from "@/lib/engine/insights";
import { trendLabel } from "@/lib/engine/insights";
import { Badge } from "../ui/Badge";

/**
 * 三层 Agent 轨迹。
 *
 * 把「语言层 → 语篇层 → 评分层」各自的结论摊开展示，
 * 让用户看到分数不是黑箱，而是三步推导出来的。
 */
export function AgentTracePanel({ report }: { report: Report }) {
  const agents = report.agents;
  if (!agents || agents.length === 0) return null;

  const toneOf = (agent: string) =>
    agent === "language" ? "accent" : agent === "discourse" ? "violet" : "pos";

  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <h2 className="text-ink text-[14px] font-semibold">三层 Agent 协同</h2>
      <p className="text-ink-faint mt-1 text-[11.5px] leading-relaxed">
        评分不是一步得出的。三个 Agent 各管一段，且
        <b className="text-ink-soft font-medium">
          评分层只能看到前两层的结论，看不到原文
        </b>
        —— 避免「看到一个语法错误就顺手压低逻辑分」这类串扰。
      </p>

      <ol className="mt-4 space-y-3.5">
        {agents.map((a, i) => (
          <li key={a.agent} className="relative pl-7">
            {/* 序号 */}
            <span
              className={`absolute top-0.5 left-0 flex size-5 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                toneOf(a.agent) === "accent"
                  ? "bg-accent-soft text-accent"
                  : toneOf(a.agent) === "violet"
                    ? "bg-violet-soft text-violet"
                    : "bg-pos-soft text-pos"
              }`}
            >
              {i + 1}
            </span>
            {/* 连接线 */}
            {i < agents.length - 1 && (
              <span className="bg-line absolute top-6 left-[9.5px] h-[calc(100%-4px)] w-px" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink text-[13px] font-medium">{a.title}</span>
              <Badge tone={toneOf(a.agent) as "accent" | "violet" | "pos"}>
                {a.agent}
              </Badge>
            </div>
            <p className="text-ink-soft mt-1 text-[12px] leading-relaxed">{a.summary}</p>
            <ul className="text-ink-faint mt-1.5 grid gap-x-4 gap-y-0.5 text-[11.5px] sm:grid-cols-2">
              {a.details.map((d) => (
                <li key={d} className="font-mono">
                  {d}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TREND_TONE: Record<TrendDirection, "neg" | "pos" | "warn" | "accent"> = {
  increasing: "neg",
  decreasing: "pos",
  new: "warn",
  stable: "accent",
};

/** 个人错误追踪：跨篇分析，指出该专项突破什么 */
export function InsightPanel({ insight }: { insight: LearnerInsight }) {
  if (insight.reportCount === 0) return null;

  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink text-[14px] font-semibold">个人错误追踪</h2>
        <span className="text-ink-faint text-[11.5px]">
          {insight.reportCount} 篇 · 跨度 {insight.spanDays} 天
        </span>
      </div>

      <p className="text-ink bg-bg mt-3 rounded-lg px-3.5 py-3 text-[12.5px] leading-relaxed">
        {insight.headline}
      </p>

      {insight.recurring.length > 0 && (
        <div className="mt-4">
          <h3 className="text-ink-soft text-[12px] font-medium">需要专项突破</h3>
          <ul className="mt-2 space-y-2.5">
            {insight.recurring.map((t) => (
              <li
                key={t.key}
                className="border-neg/25 bg-neg-soft/40 rounded-lg border px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={TREND_TONE[t.trend]}>{trendLabel(t.trend)}</Badge>
                  <Badge tone="neutral">{t.dimension}</Badge>
                  <span className="text-ink text-[12.5px] font-medium">{t.label}</span>
                </div>
                <p className="text-ink-faint mt-1.5 text-[11.5px]">
                  累计 {t.totalCount} 次 · 分布在 {t.reportCount} 篇中 · 最近{" "}
                  {t.recentCount} 次
                </p>
                {t.examples.length > 0 && (
                  <p className="text-ink-faint mt-1 font-mono text-[11px]">
                    例：{t.examples.slice(0, 2).join("　/　")}
                  </p>
                )}
                <p className="text-ink-soft mt-1.5 text-[12px] leading-relaxed">
                  {t.advice}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(insight.improving.length > 0 || insight.mastered.length > 0) && (
        <div className="mt-4">
          <h3 className="text-ink-soft text-[12px] font-medium">已改善 / 已掌握</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {insight.improving.map((t) => (
              <Badge key={t.key} tone="pos">
                {t.label} {t.earlierCount}→{t.recentCount}
              </Badge>
            ))}
            {insight.mastered.map((t) => (
              <Badge key={t.key} tone="pos">
                {t.label} 已不再出现
              </Badge>
            ))}
          </div>
        </div>
      )}

      {insight.strengthWords.length > 0 && (
        <div className="mt-4">
          <h3 className="text-ink-soft text-[12px] font-medium">
            你自己用过的高分表达（可复用）
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {insight.strengthWords.map((w) => (
              <Badge key={w} tone="accent">
                {w}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
