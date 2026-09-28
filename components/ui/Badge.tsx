import type { ReactNode } from "react";
import { TAG_LABELS } from "@/lib/text";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "pos" | "neg" | "warn" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-bg text-ink-soft",
    accent: "border-accent/25 bg-accent-soft text-accent",
    pos: "border-pos/25 bg-pos-soft text-pos",
    neg: "border-neg/25 bg-neg-soft text-neg",
    warn: "border-warn/25 bg-warn-soft text-warn",
    violet: "border-violet/25 bg-violet-soft text-violet",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] leading-tight font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function TagBadge({ tag }: { tag: string }) {
  const tone =
    tag === "topic_lexis"
      ? "violet"
      : tag === "academic_collocation"
        ? "accent"
        : tag === "template"
          ? "warn"
          : tag === "grammar"
            ? "neg"
            : "neutral";
  return <Badge tone={tone}>{TAG_LABELS[tag] ?? tag}</Badge>;
}

export function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "high" ? "bg-neg" : severity === "medium" ? "bg-warn" : "bg-ink-faint";
  return (
    <span
      className={`inline-block size-[7px] shrink-0 rounded-full ${color}`}
      aria-hidden
    />
  );
}

export function ScoreBar({
  value,
  max,
  tone = "accent",
}: {
  value: number;
  max: number;
  tone?: "accent" | "pos" | "neg" | "warn";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors: Record<string, string> = {
    accent: "bg-accent",
    pos: "bg-pos",
    neg: "bg-neg",
    warn: "bg-warn",
  };
  return (
    <div className="bg-line h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full ${colors[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** 分数 → 语义色：按「该维度得分率」判断 */
export function scoreTone(score: number, max: number): "pos" | "warn" | "neg" | "accent" {
  const ratio = score / max;
  if (ratio >= 0.78) return "pos";
  if (ratio >= 0.62) return "accent";
  if (ratio >= 0.48) return "warn";
  return "neg";
}
