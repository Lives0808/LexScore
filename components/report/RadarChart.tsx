"use client";

import type { DimensionScore } from "@/lib/types";

/**
 * 四维评分雷达图。
 *
 * 纯 SVG，无图表库依赖。四个轴分别对应四个评分项，
 * 把得分直接画出来，一眼就能看出强弱项的形状。
 */

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 86;
const RINGS = [0.25, 0.5, 0.75, 1];
/** 第一个轴朝正上方，其余顺时针 90° 一个 */
const START_ANGLE = -Math.PI / 2;

function polar(index: number, count: number, radius: number) {
  const angle = START_ANGLE + (index * 2 * Math.PI) / count;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function toPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export default function RadarChart({
  dimensions,
  /** 参考线：通常画一条「基线」，让用户看到哪些项在基线之下 */
  baseline,
  size = 260,
}: {
  dimensions: DimensionScore[];
  baseline?: number;
  size?: number;
}) {
  const count = dimensions.length;
  if (count < 3) return null;

  const ratios = dimensions.map((d) => Math.max(0, Math.min(1, d.score / d.max)));
  const scorePoints = ratios.map((r, i) => polar(i, count, RADIUS * r));
  const baselinePoints =
    baseline !== undefined
      ? dimensions.map((_, i) => polar(i, count, RADIUS * (baseline / dimensions[i].max)))
      : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      role="img"
      aria-label={`四维评分雷达图：${dimensions
        .map((d) => `${d.label} ${d.score}/${d.max}`)
        .join("，")}`}
      className="mx-auto block"
    >
      {/* 网格环 */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={toPoints(dimensions.map((_, i) => polar(i, count, RADIUS * ring)))}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={ring === 1 ? 1.2 : 0.8}
        />
      ))}

      {/* 轴线 */}
      {dimensions.map((d, i) => {
        const outer = polar(i, count, RADIUS);
        return (
          <line
            key={d.dimension}
            x1={CENTER}
            y1={CENTER}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-line)"
            strokeWidth={0.8}
          />
        );
      })}

      {/* 基线参考 */}
      {baselinePoints && (
        <polygon
          points={toPoints(baselinePoints)}
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* 得分区域 */}
      <polygon
        points={toPoints(scorePoints)}
        fill="color-mix(in srgb, var(--color-accent) 20%, transparent)"
        stroke="var(--color-accent)"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />

      {/* 顶点 */}
      {scorePoints.map((p, i) => (
        <circle
          key={dimensions[i].dimension}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="var(--color-accent)"
        />
      ))}

      {/* 轴标签与分数 */}
      {dimensions.map((d, i) => {
        const label = polar(i, count, RADIUS + 30);
        const anchor =
          Math.abs(label.x - CENTER) < 6 ? "middle" : label.x > CENTER ? "start" : "end";
        const dy = label.y < CENTER ? -2 : 10;
        return (
          <g key={d.dimension}>
            <text
              x={label.x}
              y={label.y + dy}
              textAnchor={anchor}
              fontSize={11.5}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {d.label}
            </text>
            <text
              x={label.x}
              y={label.y + dy + 13}
              textAnchor={anchor}
              fontSize={11}
              fill="var(--color-ink-faint)"
            >
              {d.score} / {d.max}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
