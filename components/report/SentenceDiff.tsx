"use client";

import { useMemo, useState } from "react";
import type { Annotation, AnnotationStatus, Paragraph, Sentence } from "@/lib/types";
import { buildPreview, resolveSpans, toSegments } from "@/lib/text";
import AnnotationCard from "./AnnotationCard";
import { Badge } from "../ui/Badge";

const ROLE_LABELS: Record<string, string> = {
  introduction: "引入段",
  overview: "概述段",
  body: "主体段",
  counter: "让步段",
  conclusion: "结论段",
  unknown: "段落",
};

interface Tooltip {
  annotation: Annotation;
  x: number;
  y: number;
}

export default function SentenceDiff({
  sentences,
  paragraphs,
  annotations,
  onChangeStatus,
  filter,
}: {
  sentences: Sentence[];
  paragraphs: Paragraph[];
  annotations: Annotation[];
  onChangeStatus: (annotationId: string, status: AnnotationStatus) => void;
  filter: { dimension: string | null; status: string | null };
}) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const bySentence = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of annotations) {
      if (filter.dimension && a.dimension !== filter.dimension) continue;
      if (filter.status && a.status !== filter.status) continue;
      const list = map.get(a.sentenceId) ?? [];
      list.push(a);
      map.set(a.sentenceId, list);
    }
    return map;
  }, [annotations, filter]);

  return (
    <div className="space-y-4">
      {paragraphs.map((para) => {
        const paraSentences = para.sentenceIds
          .map((id) => sentences.find((s) => s.id === id))
          .filter((s): s is Sentence => Boolean(s));
        if (paraSentences.length === 0) return null;

        return (
          <section
            key={para.index}
            className="overflow-hidden rounded-xl border border-line bg-card"
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-2.5">
              <span className="text-[12px] font-medium text-ink">
                第 {para.index + 1} 段
              </span>
              <Badge tone="accent">{ROLE_LABELS[para.role] ?? para.role}</Badge>
              <span className="text-[11.5px] text-ink-faint">
                {para.wordCount} 词 · {paraSentences.length} 句
              </span>
              <span className="ml-auto basis-full text-[11.5px] leading-snug text-ink-faint sm:basis-auto">
                {para.roleNote}
              </span>
            </header>

            <div className="grid grid-cols-[38px_1fr] md:grid-cols-[38px_1fr_1fr]">
              {/* 表头 */}
              <div className="border-b border-r border-line bg-bg/60 py-1.5" />
              <div className="border-b border-line bg-bg/60 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-ink-faint">
                原文
              </div>
              <div className="hidden border-b border-l border-line bg-bg/60 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-ink-faint md:block">
                修改版（接受后生效 · 蓝色为待定）
              </div>

              {paraSentences.map((sentence) => {
                const list = bySentence.get(sentence.id) ?? [];
                const spans = resolveSpans(sentence.text, list);
                const segments = toSegments(sentence.text, spans);
                const preview = buildPreview(sentence.text, spans);
                const hasChange = spans.some((s) => s.annotation.replacement);

                return (
                  <div key={sentence.id} className="contents">
                    {/* 句号 */}
                    <div className="border-r border-b border-line bg-bg/40 pt-3 text-center">
                      <span className="text-[10.5px] tabular-nums text-ink-faint">
                        {sentence.indexInParagraph + 1}
                      </span>
                    </div>

                    {/* 原文 */}
                    <div
                      id={`sent-${sentence.id}`}
                      className="border-b border-line px-3.5 py-3 text-[13.5px] leading-[1.9] text-ink"
                    >
                      {segments.map((seg, i) =>
                        seg.span ? (
                          <mark
                            key={i}
                            className={`mark bg-transparent ${
                              seg.span.annotation.severity === "high" ||
                              seg.span.annotation.severity === "medium"
                                ? "mark-neg"
                                : "mark-warn"
                            }`}
                            data-active={
                              activeId === seg.span.annotation.id ? "true" : undefined
                            }
                            onMouseEnter={(e) => {
                              const rect = (
                                e.currentTarget as HTMLElement
                              ).getBoundingClientRect();
                              setTooltip({
                                annotation: seg.span!.annotation,
                                x: rect.left,
                                y: rect.bottom + 8,
                              });
                              setActiveId(seg.span!.annotation.id);
                            }}
                            onMouseLeave={() => {
                              setTooltip(null);
                              setActiveId(null);
                            }}
                            onClick={() => {
                              document
                                .getElementById(`anno-${seg.span!.annotation.id}`)
                                ?.scrollIntoView({ block: "center", behavior: "smooth" });
                            }}
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        ),
                      )}
                    </div>

                    {/* 修改版 */}
                    <div className="hidden border-b border-l border-line bg-bg/25 px-3.5 py-3 text-[13.5px] leading-[1.9] text-ink-soft md:block">
                      {hasChange || spans.length > 0 ? (
                        preview.map((seg, i) => (
                          <span
                            key={i}
                            className={
                              seg.kind === "accepted"
                                ? "diff-add"
                                : seg.kind === "pending"
                                  ? "diff-pending"
                                  : undefined
                            }
                          >
                            {seg.text}
                          </span>
                        ))
                      ) : (
                        <span>{sentence.text}</span>
                      )}
                    </div>

                    {/* 批注 */}
                    {list.length > 0 && (
                      <div className="col-span-full border-b border-line bg-bg/40 px-3.5 py-3">
                        <div className="grid gap-2.5 lg:grid-cols-2">
                          {list.map((a) => (
                            <AnnotationCard
                              key={a.id}
                              annotation={a}
                              highlighted={activeId === a.id}
                              onChange={(status) => onChangeStatus(a.id, status)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* 悬浮显示原因 */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-[320px] rounded-lg border border-line-strong bg-card p-3 shadow-lg"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 340),
            top: tooltip.y,
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{tooltip.annotation.dimension}</Badge>
            <Badge tone="pos">{tooltip.annotation.liftText}</Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            {tooltip.annotation.reason}
          </p>
          {tooltip.annotation.replacement && (
            <p className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed">
              <span className="text-ink-faint">改为　</span>
              <span className="font-medium text-pos">
                {tooltip.annotation.replacement.slice(0, 90)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
