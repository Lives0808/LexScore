"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CorpusItem } from "@/lib/types";
import {
  aggregateCorpus,
  bucketCorpus,
  clearAll,
  corpusStats,
  useHydrated,
  useReports,
} from "@/lib/store";
import ScoreTrend from "./report/ScoreTrend";
import { Badge, ScoreBar } from "./ui/Badge";

type Bucket = "phrases" | "sentences" | "errors";

const TABS: { id: Bucket; label: string; hint: string }[] = [
  {
    id: "phrases",
    label: "好词与词伙",
    hint: "文中用对的学术词汇与话题词伙，可直接复用到同话题写作",
  },
  {
    id: "sentences",
    label: "好句",
    hint: "复杂句 + 学术词汇且未命中语法规则，可作为改写模板",
  },
  {
    id: "errors",
    label: "高频错误",
    hint: "命中规则库的错误，按出现次数排序，优先消除重复项",
  },
];

export default function CorpusView() {
  const hydrated = useHydrated();
  const reports = useReports();
  const [tab, setTab] = useState<Bucket>("phrases");

  const items = useMemo(() => aggregateCorpus(reports), [reports]);
  const buckets = useMemo(() => bucketCorpus(items), [items]);
  const stats = useMemo(() => corpusStats(items, reports), [items, reports]);
  const maxErrorCount = Math.max(1, ...stats.errorByDimension.map((d) => d.count));

  if (!hydrated) {
    return (
      <div className="text-ink-faint mx-auto max-w-[640px] px-5 py-24 text-center text-[13px]">
        加载中…
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center">
        <h1 className="text-ink text-[18px] font-semibold">语料库还是空的</h1>
        <p className="text-ink-soft mt-2 text-[13px] leading-relaxed">
          每批改一篇作文，LexScore 会自动把其中的好词、好句和反复出现的错误收集到这里。
          批改几篇之后，这里就是你自己的专属语料。
        </p>
        <Link
          href="/"
          className="bg-accent-solid mt-5 inline-block rounded-lg px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
        >
          去批改第一篇
        </Link>
      </div>
    );
  }

  const list = buckets[tab];

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-[22px] font-semibold tracking-tight">
            我的写作语料库
          </h1>
          <p className="text-ink-soft mt-2 max-w-[560px] text-[13px] leading-relaxed">
            自动从你写过的作文里抽取的专属素材。复习时不用再背通用范文，
            直接用自己写过的、已经被验证过的表达。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("确定要清空所有批改记录与语料吗？该操作不可撤销。")) {
              clearAll();
            }
          }}
          className="border-line text-ink-faint hover:border-neg hover:text-neg rounded-lg border px-3 py-1.5 text-[11.5px] transition"
        >
          清空全部
        </button>
      </div>

      {/* 概览 */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="已批改" value={`${stats.totalEssays}`} unit="篇" />
        <StatCard label="累计写作" value={`${stats.totalWords}`} unit="词" />
        <StatCard label="沉淀词伙" value={`${buckets.phrases.length}`} unit="条" />
        <StatCard
          label="高频错误类型"
          value={`${stats.errorByDimension.length}`}
          unit="类"
        />
      </div>

      {/* 总分走势：让进步可见 */}
      {reports.length >= 2 && (
        <section className="border-line bg-card mt-6 rounded-xl border p-5">
          <ScoreTrend reports={reports} />
          <p className="text-ink-faint mt-3 text-[11.5px] leading-relaxed">
            每条记录都存在你自己的浏览器里，不上传任何服务器。多写几篇，
            曲线才能反映真实趋势 —— 单篇分数的波动通常来自题目难度，不代表水平变化。
          </p>
        </section>
      )}

      {/* 薄弱项分布 */}
      {stats.errorByDimension.length > 0 && (
        <section className="border-line bg-card mt-6 rounded-xl border p-5">
          <h2 className="text-ink text-[14px] font-semibold">错误在评分项上的分布</h2>
          <p className="text-ink-faint mt-1 text-[11.5px]">
            同一个评分项反复出错，说明这是系统性问题，需要针对性训练而不是零散修改。
          </p>
          <ul className="mt-4 space-y-3">
            {stats.errorByDimension.map((d) => (
              <li key={d.dimension}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-ink">{d.label}</span>
                  <span className="text-ink-faint tabular-nums">{d.count} 次</span>
                </div>
                <div className="mt-1.5">
                  <ScoreBar
                    value={d.count}
                    max={maxErrorCount}
                    tone={d.count >= maxErrorCount * 0.7 ? "neg" : "warn"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tabs */}
      <div className="mt-7">
        <div className="border-line bg-card flex w-full overflow-x-auto rounded-lg border p-0.5 sm:inline-flex sm:w-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 shrink-0 rounded-[6px] px-3.5 py-2 text-[12.5px] whitespace-nowrap transition sm:py-1.5 ${
                tab === t.id
                  ? "bg-accent-solid text-white"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-60">
                {buckets[t.id].length}
              </span>
            </button>
          ))}
        </div>
        <p className="text-ink-faint mt-2.5 text-[11.5px] leading-relaxed">
          {TABS.find((t) => t.id === tab)?.hint}
        </p>

        {list.length === 0 ? (
          <p className="text-ink-faint mt-8 text-[13px]">
            这里还没有内容。多批改几篇，语料会自动累积。
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => {
              const occurrences =
                (item as CorpusItem & { occurrences?: number }).occurrences ?? 1;
              return (
                <article
                  key={item.id}
                  className={`bg-card flex flex-col rounded-lg border px-4 py-3.5 ${
                    item.kind === "error" ? "border-neg/25" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.topic && <Badge tone="neutral">{item.topic}</Badge>}
                    <Badge tone="accent">{item.dimension}</Badge>
                    {occurrences > 1 && <Badge tone="warn">出现 {occurrences} 次</Badge>}
                  </div>

                  <p
                    className={`mt-2.5 leading-relaxed ${
                      item.kind === "error"
                        ? "text-neg decoration-neg/40 text-[13px] line-through"
                        : "text-ink text-[13px]"
                    }`}
                  >
                    {item.text}
                  </p>

                  {item.correction && (
                    <p className="text-pos mt-1.5 text-[12.5px] leading-relaxed font-medium">
                      → {item.correction}
                    </p>
                  )}

                  <p className="text-ink-faint mt-2 text-[11.5px] leading-relaxed">
                    {item.note}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="border-line bg-card rounded-xl border px-4 py-3.5">
      <div className="text-ink-faint text-[11.5px]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-ink text-[24px] leading-none font-semibold tabular-nums">
          {value}
        </span>
        <span className="text-ink-faint text-[11.5px]">{unit}</span>
      </div>
    </div>
  );
}
