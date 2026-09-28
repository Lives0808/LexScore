"use client";

import type { Report } from "@/lib/types";

/**
 * 分数变化曲线。
 *
 * 用批改历史画出总分走势，让进步可见 —— 这是留存的关键：
 * 用户看到线在往上走，才会继续写下一篇。
 *
 * 纯 SVG，无图表库依赖。
 */

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 34 };

export default function ScoreTrend({ reports }: { reports: Report[] }) {
  // 时间正序
  const points = [...reports].sort((a, b) => a.createdAt - b.createdAt);
  if (points.length < 2) return null;

  const exam = points[points.length - 1].exam;
  const maxScore = exam === "ielts" ? 9 : 30;
  // 纵轴下限取所有分数的最小值向下取整，避免曲线被压平看不出变化
  const minScore = Math.max(0, Math.floor(Math.min(...points.map((p) => p.overall)) - 1));

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (score: number) =>
    PAD.top + innerH - ((score - minScore) / Math.max(1, maxScore - minScore)) * innerH;

  const line = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`)
    .join(" ");
  const area = `${PAD.left},${PAD.top + innerH} ${line} ${x(points.length - 1)},${PAD.top + innerH}`;

  const ticks = [minScore, (minScore + maxScore) / 2, maxScore].map((v) => Math.round(v));
  const first = points[0].overall;
  const last = points[points.length - 1].overall;
  const delta = Number((last - first).toFixed(1));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-ink text-[13px] font-medium">
          总分走势（{points.length} 篇）
        </span>
        <span
          className={`text-[12px] font-semibold tabular-nums ${
            delta > 0 ? "text-pos" : delta < 0 ? "text-neg" : "text-ink-faint"
          }`}
        >
          {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {delta > 0 ? "+" : ""}
          {delta} 分
        </span>
        <span className="text-ink-faint text-[11.5px]">
          首篇 {first} → 最新 {last}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`总分走势：从 ${first} 到 ${last}，共 ${points.length} 篇`}
      >
        {/* 刻度 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={y(t)}
              x2={W - PAD.right}
              y2={y(t)}
              stroke="var(--color-line)"
              strokeWidth={0.8}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="var(--color-ink-faint)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* 面积与折线 */}
        <polygon
          points={area}
          fill="color-mix(in srgb, var(--color-accent) 10%, transparent)"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.overall)} r={3.5} fill="var(--color-accent)" />
            <text
              x={x(i)}
              y={y(p.overall) - 9}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {p.overall}
            </text>
          </g>
        ))}

        {/* 时间轴 */}
        {points.map((p, i) => (
          <text
            key={`d-${p.id}`}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-faint)"
          >
            {new Date(p.createdAt).toLocaleDateString("zh-CN", {
              month: "numeric",
              day: "numeric",
            })}
          </text>
        ))}
      </svg>
    </div>
  );
}
