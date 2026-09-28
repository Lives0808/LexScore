"use client";

import { useState } from "react";
import type { DimensionScore } from "@/lib/types";
import { Badge, ScoreBar, scoreTone } from "../ui/Badge";

export default function DimensionCard({
  dimension,
  onJump,
}: {
  dimension: DimensionScore;
  onJump: (sentenceId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const tone = scoreTone(dimension.score, dimension.max);
  const negatives = dimension.evidences.filter((e) => e.polarity === "negative");
  const positives = dimension.evidences.filter((e) => e.polarity === "positive");

  return (
    <article className="flex flex-col rounded-xl border border-line bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13.5px] font-semibold text-ink">
            {dimension.label}
          </h3>
          <p className="mt-0.5 text-[10.5px] leading-tight text-ink-faint">
            {dimension.labelEn}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[24px] leading-none font-semibold tabular-nums text-ink">
            {dimension.score}
          </div>
          <div className="mt-1 text-[10.5px] text-ink-faint">
            / {dimension.max}
          </div>
        </div>
      </header>

      <div className="mt-3">
        <ScoreBar value={dimension.score} max={dimension.max} tone={tone} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={tone}>{dimension.bandLabel}</Badge>
        {negatives.length > 0 && (
          <Badge tone="neg">扣分 {negatives.length} 处</Badge>
        )}
        {positives.length > 0 && (
          <Badge tone="pos">加分 {positives.length} 处</Badge>
        )}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
        {dimension.summary}
      </p>

      {dimension.evidences.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 self-start text-[11.5px] font-medium text-accent transition hover:opacity-75"
          >
            {open ? "收起评分依据" : `展开评分依据（${dimension.evidences.length}）`}
          </button>

          {open && (
            <ul className="mt-2.5 space-y-2.5 border-t border-line pt-3">
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
                    <div className="mt-1 font-mono text-[10.5px] text-ink-faint">
                      {e.metric}
                      {e.delta !== 0 && (
                        <span
                          className={
                            e.delta < 0 ? "ml-2 text-neg" : "ml-2 text-pos"
                          }
                        >
                          {e.delta > 0 ? "+" : ""}
                          {e.delta} 分
                        </span>
                      )}
                    </div>
                  )}

                  {e.quote && (
                    <blockquote className="mt-1.5 border-l-2 border-line-strong pl-2 text-[11.5px] leading-relaxed text-ink-faint italic">
                      “{e.quote.length > 150 ? `${e.quote.slice(0, 150)}…` : e.quote}”
                      {e.sentenceId && (
                        <button
                          type="button"
                          onClick={() => onJump(e.sentenceId)}
                          className="ml-1.5 not-italic text-accent transition hover:opacity-75"
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
