"use client";

import { useState } from "react";
import type { DimensionScore } from "@/lib/types";
import { useIsDesktop } from "@/lib/hooks";
import { Badge, ScoreBar, scoreTone } from "../ui/Badge";

export default function DimensionCard({
  dimension,
  onJump,
}: {
  dimension: DimensionScore;
  onJump: (sentenceId: string) => void;
}) {
  // 手机上默认折叠：四张卡片各带一串评分依据会把逐句批注推到很下面。
  // 桌面端空间充足，默认展开，让「评分依据」这个核心价值直接可见。
  const isDesktop = useIsDesktop();
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? isDesktop;
  const tone = scoreTone(dimension.score, dimension.max);
  const negatives = dimension.evidences.filter((e) => e.polarity === "negative");
  const positives = dimension.evidences.filter((e) => e.polarity === "positive");

  return (
    <article className="border-line bg-card flex flex-col rounded-xl border p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-ink text-[13.5px] font-semibold">{dimension.label}</h3>
          <p className="text-ink-faint mt-0.5 text-[10.5px] leading-tight">
            {dimension.labelEn}
          </p>
        </div>
        <div className="text-right">
          <div className="text-ink text-[24px] leading-none font-semibold tabular-nums">
            {dimension.score}
          </div>
          <div className="text-ink-faint mt-1 text-[10.5px]">/ {dimension.max}</div>
        </div>
      </header>

      <div className="mt-3">
        <ScoreBar value={dimension.score} max={dimension.max} tone={tone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={tone}>{dimension.bandLabel}</Badge>
        {negatives.length > 0 && <Badge tone="neg">扣分 {negatives.length} 处</Badge>}
        {positives.length > 0 && <Badge tone="pos">加分 {positives.length} 处</Badge>}
      </div>

      <p className="text-ink-soft mt-3 text-[12.5px] leading-relaxed">
        {dimension.summary}
      </p>

      {dimension.evidences.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOverride(!open)}
            aria-expanded={open}
            className="text-accent mt-3 self-start rounded-md py-1 text-[12px] font-medium transition hover:opacity-75"
          >
            {open ? "收起评分依据" : `展开评分依据（${dimension.evidences.length}）`}
          </button>

          {open && (
            <ul className="border-line mt-2.5 space-y-2.5 border-t pt-3">
              {dimension.evidences.map((e, i) => (
                <li key={`${e.sentenceId}-${i}`} className="text-[12px] leading-relaxed">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block size-[6px] shrink-0 rounded-full ${
                        e.polarity === "negative"
                          ? "bg-neg"
                          : e.polarity === "positive"
                            ? "bg-pos"
                            : "bg-ink-faint"
                      }`}
                    />
                    <span className="text-ink-soft">{e.comment}</span>
                  </div>

                  {e.metric && (
                    <div className="text-ink-faint mt-1 font-mono text-[10.5px]">
                      {e.metric}
                      {e.delta !== 0 && (
                        <span className={e.delta < 0 ? "text-neg ml-2" : "text-pos ml-2"}>
                          {e.delta > 0 ? "+" : ""}
                          {e.delta} 分
                        </span>
                      )}
                    </div>
                  )}

                  {e.quote && (
                    <blockquote className="border-line-strong text-ink-faint mt-1.5 border-l-2 pl-2 text-[11.5px] leading-relaxed italic">
                      “{e.quote.length > 150 ? `${e.quote.slice(0, 150)}…` : e.quote}”
                      {e.sentenceId && (
                        <button
                          type="button"
                          onClick={() => onJump(e.sentenceId)}
                          className="text-accent ml-1.5 not-italic transition hover:opacity-75"
                        >
                          定位
                        </button>
                      )}
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}
