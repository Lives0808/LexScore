"use client";

import type {
  CoverageReport,
  RelevanceReport,
  Report,
  TemplateReport,
} from "@/lib/types";
import { Badge, ScoreBar, scoreTone } from "../ui/Badge";

const STATUS_TONE = {
  covered: "pos",
  partial: "warn",
  missing: "neg",
} as const;

const STATUS_LABEL = {
  covered: "已覆盖",
  partial: "不完整",
  missing: "缺失",
} as const;

export function ConstraintsPanel({ report }: { report: Report }) {
  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <h2 className="text-ink text-[14px] font-semibold">硬性约束检查</h2>
      <p className="text-ink-faint mt-1 text-[11.5px]">
        字数、分段与句长是考官最先注意到的形式指标，不达标会在内容评分之前先扣一层印象分。
      </p>
      <ul className="mt-3.5 space-y-2">
        {report.constraints.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <Badge
              tone={c.status === "pass" ? "pos" : c.status === "warn" ? "warn" : "neg"}
              className="mt-px shrink-0"
            >
              {c.status === "pass" ? "达标" : c.status === "warn" ? "警示" : "不达标"}
            </Badge>
            <div>
              <span className="text-ink text-[12.5px] font-medium">{c.label}</span>
              <p className="text-ink-soft mt-0.5 text-[12px] leading-relaxed">
                {c.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RelevancePanel({
  relevance,
  onJump,
}: {
  relevance: RelevanceReport;
  onJump: (sentenceId: string) => void;
}) {
  const tone = scoreTone(relevance.score, 100);
  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-ink text-[14px] font-semibold">扣题度诊断</h2>
        <span className="text-ink text-[20px] font-semibold tabular-nums">
          {relevance.score}
          <span className="text-ink-faint text-[11px] font-normal"> / 100</span>
        </span>
      </div>
      <div className="mt-3">
        <ScoreBar value={relevance.score} max={100} tone={tone} />
      </div>
      <p className="text-ink-soft mt-3 text-[12.5px] leading-relaxed">
        {relevance.verdict}
      </p>

      {/* 立场句 */}
      <div className="border-line bg-bg mt-4 rounded-lg border px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Badge
            tone={
              relevance.position.found
                ? "pos"
                : relevance.position.required
                  ? "neg"
                  : "neutral"
            }
          >
            {relevance.position.found
              ? "已定位立场句"
              : relevance.position.required
                ? "缺少立场句"
                : "不强制立场"}
          </Badge>
        </div>
        <p className="text-ink-soft mt-2 text-[12px] leading-relaxed">
          {relevance.position.note}
        </p>
        {relevance.position.quote && (
          <blockquote className="border-pos/40 text-ink-faint mt-2 border-l-2 pl-2 text-[11.5px] leading-relaxed italic">
            “{relevance.position.quote}”
            {relevance.position.sentenceId && (
              <button
                type="button"
                onClick={() => onJump(relevance.position.sentenceId!)}
                className="text-accent ml-1.5 not-italic transition hover:opacity-75"
              >
                定位
              </button>
            )}
          </blockquote>
        )}
      </div>

      {/* 关键词覆盖 */}
      <h3 className="text-ink-soft mt-4 text-[12px] font-medium">题目关键词覆盖</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {relevance.keywords.map((k) => (
          <span
            key={`${k.kind}-${k.term}`}
            title={k.kind === "instruction" ? "题目指令要求" : undefined}
            className={`rounded border px-1.5 py-1 text-[11px] ${
              k.kind === "instruction"
                ? "border-violet/25 bg-violet-soft text-violet"
                : k.hit
                  ? "border-pos/25 bg-pos-soft text-pos"
                  : "border-neg/25 bg-neg-soft text-neg"
            }`}
          >
            {k.term}
            {k.kind === "topic" && k.count > 0 && (
              <span className="ml-1 tabular-nums opacity-60">×{k.count}</span>
            )}
            {k.kind === "topic" && !k.hit && <span className="ml-1">未出现</span>}
          </span>
        ))}
      </div>
      <p className="text-ink-faint mt-2 text-[11px] leading-relaxed">
        绿色为已覆盖的题目核心概念，红色为全文未出现的关键词——考官会据此判断你是否回答了题目。
      </p>

      {/* 疑似跑题 */}
      {relevance.offTopic.length > 0 && (
        <>
          <h3 className="text-ink-soft mt-4 text-[12px] font-medium">
            疑似偏离主题的句子（{relevance.offTopic.length}）
          </h3>
          <ul className="mt-2 space-y-2">
            {relevance.offTopic.map((o) => (
              <li key={o.sentenceId} className="text-[12px] leading-relaxed">
                <blockquote className="border-warn/40 text-ink-faint border-l-2 pl-2 italic">
                  “{o.quote.length > 130 ? `${o.quote.slice(0, 130)}…` : o.quote}”
                  <button
                    type="button"
                    onClick={() => onJump(o.sentenceId)}
                    className="text-accent ml-1.5 not-italic transition hover:opacity-75"
                  >
                    定位
                  </button>
                </blockquote>
                <p className="text-ink-soft mt-1">{o.reason}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function TemplatePanel({
  template,
  onJump,
}: {
  template: TemplateReport;
  onJump: (sentenceId: string) => void;
}) {
  const tone = scoreTone(template.originality, 100);
  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-ink text-[14px] font-semibold">反模板检测</h2>
        <span className="text-ink text-[20px] font-semibold tabular-nums">
          {template.originality}
          <span className="text-ink-faint text-[11px] font-normal"> / 100 原创度</span>
        </span>
      </div>
      <div className="mt-3">
        <ScoreBar value={template.originality} max={100} tone={tone} />
      </div>
      <p className="text-ink-soft mt-3 text-[12.5px] leading-relaxed">
        {template.verdict}
      </p>

      {template.hits.length > 0 && (
        <ul className="mt-4 space-y-3">
          {template.hits.map((h) => (
            <li key={h.id} className="border-line bg-bg rounded-lg border px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="warn">{h.category}</Badge>
                <Badge tone="neg">-{h.penalty.toFixed(2).replace(/0$/, "")} 分</Badge>
              </div>
              <p className="text-neg mt-2 font-mono text-[12px]">“{h.phrase}”</p>
              <p className="text-ink-soft mt-1.5 text-[12px] leading-relaxed">
                {h.reason}
              </p>
              <p className="border-accent/30 text-ink-soft mt-1.5 border-l-2 pl-2 text-[12px] leading-relaxed">
                <span className="text-accent font-medium">改成　</span>
                {h.suggestion}
              </p>
              <button
                type="button"
                onClick={() => onJump(h.sentenceId)}
                className="text-accent mt-2 text-[11.5px] transition hover:opacity-75"
              >
                定位原句 ↑
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CoveragePanel({
  coverage,
  onJump,
}: {
  coverage: CoverageReport;
  onJump: (sentenceId: string) => void;
}) {
  const groups = [...new Set(coverage.items.map((i) => i.group))];
  const tone =
    coverage.stats.missing === 0 ? "pos" : coverage.stats.missing <= 1 ? "warn" : "neg";

  return (
    <section className="border-line bg-card rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-ink text-[14px] font-semibold">{coverage.title}</h2>
        <div className="flex items-center gap-1.5">
          <Badge tone="pos">{coverage.stats.covered} 覆盖</Badge>
          {coverage.stats.partial > 0 && (
            <Badge tone="warn">{coverage.stats.partial} 不完整</Badge>
          )}
          {coverage.stats.missing > 0 && (
            <Badge tone="neg">{coverage.stats.missing} 缺失</Badge>
          )}
        </div>
      </div>
      <div className="mt-3">
        <ScoreBar
          value={coverage.stats.covered}
          max={Math.max(1, coverage.items.length)}
          tone={tone}
        />
      </div>
      <p className="text-ink-soft mt-3 text-[12.5px] leading-relaxed">
        {coverage.summary}
      </p>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <h3 className="text-ink-soft text-[12px] font-medium">{group}</h3>
            <ul className="mt-2 space-y-2">
              {coverage.items
                .filter((i) => i.group === group)
                .map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-lg border px-3.5 py-2.5 ${
                      item.status === "missing"
                        ? "border-neg/25 bg-neg-soft/50"
                        : item.status === "partial"
                          ? "border-warn/25 bg-warn-soft/50"
                          : "border-line bg-bg"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                      <span className="text-ink text-[12.5px] font-medium">
                        {item.label}
                      </span>
                      {item.detail && item.group === "关键数据点" && (
                        <span className="text-ink-faint text-[11px]">{item.detail}</span>
                      )}
                    </div>
                    {item.detail &&
                      item.group !== "关键数据点" &&
                      item.group !== "转述框架" && (
                        <p className="text-ink-faint mt-1.5 text-[11.5px] leading-relaxed">
                          {item.detail}
                        </p>
                      )}
                    {item.group === "转述框架" && item.detail && (
                      <p className="text-ink-faint mt-1.5 text-[11.5px] leading-relaxed">
                        {item.detail}
                      </p>
                    )}
                    <p className="text-ink-soft mt-1.5 text-[12px] leading-relaxed">
                      {item.note}
                    </p>
                    {item.evidenceQuote && item.evidenceSentenceId && (
                      <blockquote className="border-line-strong text-ink-faint mt-1.5 border-l-2 pl-2 text-[11.5px] leading-relaxed italic">
                        “
                        {item.evidenceQuote.length > 130
                          ? `${item.evidenceQuote.slice(0, 130)}…`
                          : item.evidenceQuote}
                        ”
                        <button
                          type="button"
                          onClick={() => onJump(item.evidenceSentenceId!)}
                          className="text-accent ml-1.5 not-italic transition hover:opacity-75"
                        >
                          定位
                        </button>
                      </blockquote>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
