"use client";

import type { Annotation, AnnotationStatus } from "@/lib/types";
import { Badge, SeverityDot, TagBadge } from "../ui/Badge";
import { DIMENSION_LABELS } from "@/lib/text";

export default function AnnotationCard({
  annotation,
  onChange,
  highlighted,
  onFocusSentence,
}: {
  annotation: Annotation;
  onChange: (status: AnnotationStatus) => void;
  highlighted?: boolean;
  onFocusSentence?: (sentenceId: string) => void;
}) {
  const { status } = annotation;
  const adviceOnly = !annotation.replacement;

  return (
    <div
      id={`anno-${annotation.id}`}
      className={`rounded-lg border bg-card px-3.5 py-3 transition ${
        highlighted
          ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
          : status === "accepted"
            ? "border-pos/35 bg-pos-soft/40"
            : status === "ignored"
              ? "border-line opacity-55"
              : "border-line"
      }`}
    >
      {/* 标签行 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityDot severity={annotation.severity} />
        <Badge tone="neutral">{DIMENSION_LABELS[annotation.dimension]}</Badge>
        <TagBadge tag={annotation.tag} />
        <Badge tone="pos">{annotation.liftText}</Badge>
        {adviceOnly && <Badge tone="warn">仅建议，无自动替换</Badge>}
        {status === "accepted" && <Badge tone="pos">已接受</Badge>}
        {status === "ignored" && <Badge tone="neutral">已忽略</Badge>}
      </div>

      {/* 修改对照 */}
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-relaxed">
        <span
          className="text-ink-soft line-through decoration-neg/50 decoration-1"
          title={annotation.target}
        >
          {truncate(annotation.target, 120)}
        </span>
        {!adviceOnly && (
          <>
            <span className="text-ink-faint">→</span>
            <span className="font-medium text-pos">
              {truncate(annotation.replacement, 120)}
            </span>
          </>
        )}
      </div>

      {/* 为什么改 */}
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
        {annotation.reason}
      </p>

      {/* 为什么更符合考官偏好 */}
      {annotation.examinerNote && (
        <p className="mt-2 border-l-2 border-accent/30 pl-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-medium text-accent">考官视角　</span>
          {annotation.examinerNote}
        </p>
      )}

      {/* 操作 */}
      <div className="mt-3 flex items-center gap-2">
        {status === "pending" ? (
          <>
            <button
              type="button"
              onClick={() => onChange("accepted")}
              disabled={adviceOnly}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              接受修改
            </button>
            <button
              type="button"
              onClick={() => onChange("ignored")}
              className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-line-strong hover:text-ink"
            >
              忽略
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onChange("pending")}
            className="rounded-md border border-line px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-line-strong hover:text-ink"
          >
            撤销
          </button>
        )}
        {onFocusSentence && (
          <button
            type="button"
            onClick={() => onFocusSentence(annotation.sentenceId)}
            className="ml-auto text-[11.5px] text-ink-faint transition hover:text-accent"
          >
            定位原句 ↑
          </button>
        )}
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
