"use client";

import { useCallback, useMemo, useState } from "react";
import type { Annotation, AnnotationStatus, Paragraph, Sentence } from "@/lib/types";
import { buildPreview, resolveSpans, toSegments } from "@/lib/text";
import { useHoverCapable } from "@/lib/hooks";
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
  above: boolean;
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
  const hoverCapable = useHoverCapable();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

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

  const focusAnnotation = useCallback((annotationId: string) => {
    setPinnedId(annotationId);
    document
      .getElementById(`anno-${annotationId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-ink-faint border-line bg-card rounded-lg border px-3.5 py-2.5 text-[11.5px] leading-relaxed">
        <span className="hidden md:inline">
          左侧为原文，右侧为修改版（接受后生效，蓝色为待定）。
          <b className="text-ink-soft font-medium">把鼠标移到高亮处</b>
          即可看到修改原因，也可以直接点高亮处跳到下方的批注卡片。
        </span>
        <span className="md:hidden">
          上方为原文，下方为修改版（接受后生效，蓝色为待定）。
          <b className="text-ink-soft font-medium">点一下高亮处</b>
          即可跳到批注卡片查看修改原因。
        </span>
      </p>

      {paragraphs.map((para) => {
        const paraSentences = para.sentenceIds
          .map((id) => sentences.find((s) => s.id === id))
          .filter((s): s is Sentence => Boolean(s));
        if (paraSentences.length === 0) return null;

        return (
          <section
            key={para.index}
            className="border-line bg-card overflow-hidden rounded-xl border"
          >
            <header className="border-line bg-bg border-b px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-ink text-[12px] font-medium">
                  第 {para.index + 1} 段
                </span>
                <Badge tone="accent">{ROLE_LABELS[para.role] ?? para.role}</Badge>
                <span className="text-ink-faint text-[11.5px]">
                  {para.wordCount} 词 · {paraSentences.length} 句
                </span>
              </div>
              <p className="text-ink-faint mt-1 text-[11.5px] leading-snug">
                {para.roleNote}
              </p>
            </header>

            {/* 桌面端列标题 */}
            <div className="border-line bg-bg/50 hidden border-b md:grid md:grid-cols-2">
              <div className="text-ink-faint px-4 py-1.5 text-[11px] font-medium tracking-wide">
                原文
              </div>
              <div className="border-line text-ink-faint border-l px-4 py-1.5 text-[11px] font-medium tracking-wide">
                修改版（接受后生效 · 蓝色为待定）
              </div>
            </div>

            {paraSentences.map((sentence) => {
              const list = bySentence.get(sentence.id) ?? [];
              const spans = resolveSpans(sentence.text, list);
              const segments = toSegments(sentence.text, spans);
              const preview = buildPreview(sentence.text, spans);
              const hasReplacement = spans.some((s) => s.annotation.replacement);

              return (
                <article
                  key={sentence.id}
                  className="border-line border-b last:border-b-0"
                >
                  <div className="grid md:grid-cols-2">
                    {/* 原文 */}
                    <div
                      id={`sent-${sentence.id}`}
                      className="md:border-line scroll-mt-20 px-4 py-3.5 md:border-r"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 md:hidden">
                        <span className="text-ink-faint text-[10.5px] font-medium tracking-wide">
                          第 {sentence.indexInParagraph + 1} 句 · 原文
                        </span>
                        {list.length > 0 && (
                          <Badge tone="neg">{list.length} 处可改</Badge>
                        )}
                      </div>
                      <p className="text-ink text-[14.5px] leading-[2] break-words md:text-[13.5px] md:leading-[1.9]">
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
                                pinnedId === seg.span.annotation.id ||
                                hoverId === seg.span.annotation.id
                                  ? "true"
                                  : undefined
                              }
                              role="button"
                              tabIndex={0}
                              onMouseEnter={
                                hoverCapable
                                  ? (e) => {
                                      const el = e.currentTarget as HTMLElement;
                                      const rect = el.getBoundingClientRect();
                                      const above =
                                        rect.bottom > window.innerHeight - 200;
                                      setTooltip({
                                        annotation: seg.span!.annotation,
                                        x: rect.left,
                                        y: above ? rect.top - 8 : rect.bottom + 8,
                                        above,
                                      });
                                      setHoverId(seg.span!.annotation.id);
                                    }
                                  : undefined
                              }
                              onMouseLeave={
                                hoverCapable
                                  ? () => {
                                      setTooltip(null);
                                      setHoverId(null);
                                    }
                                  : undefined
                              }
                              onClick={() => focusAnnotation(seg.span!.annotation.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  focusAnnotation(seg.span!.annotation.id);
                                }
                              }}
                            >
                              {seg.text}
                            </mark>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          ),
                        )}
                      </p>
                    </div>

                    {/* 修改版 */}
                    <div className="border-line bg-bg/30 md:bg-bg/25 border-t px-4 py-3.5 md:border-t-0 md:border-l">
                      <div className="text-ink-faint mb-1.5 text-[10.5px] font-medium tracking-wide md:hidden">
                        修改版{hasReplacement ? "（蓝色为待定）" : ""}
                      </div>
                      <p className="text-ink-soft text-[14.5px] leading-[2] break-words md:text-[13.5px] md:leading-[1.9]">
                        {spans.length > 0 ? (
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
                          <span className="text-ink-faint">本句无需修改。</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* 批注 */}
                  {list.length > 0 && (
                    <div className="border-line bg-bg/40 border-t px-3.5 py-3">
                      <div className="grid gap-2.5 lg:grid-cols-2">
                        {list.map((a) => (
                          <AnnotationCard
                            key={a.id}
                            annotation={a}
                            highlighted={pinnedId === a.id || hoverId === a.id}
                            onChange={(status) => onChangeStatus(a.id, status)}
                            onFocusSentence={(sid) =>
                              document
                                .getElementById(`sent-${sid}`)
                                ?.scrollIntoView({ block: "center", behavior: "smooth" })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}

      {/* 桌面端：悬浮显示原因 */}
      {tooltip && hoverCapable && (
        <div
          role="tooltip"
          className="border-line-strong bg-card pointer-events-none fixed z-50 w-[320px] max-w-[calc(100vw-24px)] rounded-lg border p-3 shadow-lg"
          style={{
            left: Math.max(12, Math.min(tooltip.x, window.innerWidth - 336)),
            top: tooltip.above ? undefined : tooltip.y,
            bottom: tooltip.above ? window.innerHeight - tooltip.y : undefined,
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{tooltip.annotation.dimension}</Badge>
            <Badge tone="pos">{tooltip.annotation.liftText}</Badge>
          </div>
          <p className="text-ink-soft mt-2 text-[12px] leading-relaxed">
            {tooltip.annotation.reason}
          </p>
          {tooltip.annotation.replacement && (
            <p className="border-line mt-2 border-t pt-2 text-[12px] leading-relaxed">
              <span className="text-ink-faint">改为　</span>
              <span className="text-pos font-medium">
                {tooltip.annotation.replacement.slice(0, 90)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
