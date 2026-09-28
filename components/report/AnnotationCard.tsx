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
      className={`bg-card rounded-lg border px-3.5 py-3 transition ${
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
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-relaxed break-words">
        <span
          className="text-ink-soft decoration-neg/50 line-through decoration-1"
          title={annotation.target}
        >
          {truncate(annotation.target, 120)}
        </span>
        {!adviceOnly && (
          <>
            <span className="text-ink-faint">→</span>
            <span className="text-pos font-medium">
              {truncate(annotation.replacement, 120)}
            </span>
          </>
        )}
      </div>

      {/* 为什么改 */}
      <p className="text-ink-soft mt-2.5 text-[12.5px] leading-relaxed">
        {annotation.reason}
      </p>

      {/* 为什么更符合考官偏好 */}
      {annotation.examinerNote && (
        <p className="border-accent/30 text-ink-soft mt-2 border-l-2 pl-2.5 text-[12.5px] leading-relaxed">
          <span className="text-accent font-medium">考官视角　</span>
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
              className="bg-accent-solid rounded-md px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 md:py-1.5 md:text-[12px]"
            >
              接受修改
            </button>
            <button
              type="button"
              onClick={() => onChange("ignored")}
              className="border-line text-ink-soft hover:border-line-strong hover:text-ink rounded-md border px-3.5 py-2 text-[12.5px] transition md:py-1.5 md:text-[12px]"
            >
              忽略
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onChange("pending")}
            className="border-line text-ink-soft hover:border-line-strong hover:text-ink rounded-md border px-3.5 py-2 text-[12.5px] transition md:py-1.5 md:text-[12px]"
          >
            撤销
          </button>
        )}
        {onFocusSentence && (
          <button
            type="button"
            onClick={() => onFocusSentence(annotation.sentenceId)}
            className="text-ink-faint hover:text-accent ml-auto rounded-md px-2 py-1.5 text-[12px] transition md:text-[11.5px]"
          >
            定位原句 ↑
          </button>
        )}
      </div>
    </div>
  );
}

function truncate(text: string | undefined, max: number): string {
  const value = text ?? "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
