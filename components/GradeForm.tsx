"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExamType, GradeInput, Report, TaskType } from "@/lib/types";
import { SAMPLES } from "@/lib/samples";
import { deleteReport, saveReport, useHydrated, useReports } from "@/lib/store";
import { formatOverall, TASK_LABELS } from "@/lib/rubrics";

const TASK_OPTIONS: { exam: ExamType; task: TaskType; hint: string }[] = [
  { exam: "ielts", task: "ielts_task2", hint: "议论文，≥250 词" },
  { exam: "ielts", task: "ielts_task1", hint: "图表描述，≥150 词" },
  { exam: "toefl", task: "toefl_integrated", hint: "阅读 + 听力，≥150 词" },
  { exam: "toefl", task: "toefl_discussion", hint: "学术讨论，≥120 词" },
];

function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;
}

function splitPoints(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.、)]\s*/, "").trim())
    .filter(Boolean);
}

export default function GradeForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const allReports = useReports();
  const [exam, setExam] = useState<ExamType>("ielts");
  const [taskType, setTaskType] = useState<TaskType>("ielts_task2");
  const [prompt, setPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [chartData, setChartData] = useState("");
  const [reading, setReading] = useState("");
  const [listening, setListening] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history: Report[] = hydrated ? allReports : [];

  const tasks = useMemo(() => TASK_OPTIONS.filter((o) => o.exam === exam), [exam]);

  const words = countWords(essay);
  const minWords =
    taskType === "ielts_task2"
      ? 250
      : taskType === "ielts_task1"
        ? 150
        : taskType === "toefl_integrated"
          ? 150
          : 120;

  function switchExam(next: ExamType) {
    setExam(next);
    setTaskType(next === "ielts" ? "ielts_task2" : "toefl_integrated");
  }

  function loadSample(id: string) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setExam(sample.input.exam);
    setTaskType(sample.input.taskType);
    setPrompt(sample.input.prompt);
    setEssay(sample.input.essay);
    setChartData(sample.input.chartData ?? "");
    setReading((sample.input.readingPoints ?? []).join("\n"));
    setListening((sample.input.listeningPoints ?? []).join("\n"));
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!essay.trim()) {
      setError("请先粘贴或输入作文内容。");
      return;
    }
    setBusy(true);
    try {
      const input: GradeInput = {
        exam,
        taskType,
        prompt: prompt.trim(),
        essay,
        chartData: taskType === "ielts_task1" ? chartData : undefined,
        readingPoints: taskType === "toefl_integrated" ? splitPoints(reading) : undefined,
        listeningPoints:
          taskType === "toefl_integrated" ? splitPoints(listening) : undefined,
      };
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        report?: Report;
        error?: string;
        notice?: string;
      };
      if (!res.ok || !data.report) {
        throw new Error(data.error ?? "批改失败，请稍后重试");
      }
      saveReport(data.report);
      router.push(`/report/${data.report.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批改失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="mb-8">
        <h1 className="text-ink text-[26px] font-semibold tracking-tight">
          把作文交给考官的标准来批
        </h1>
        <p className="text-ink-soft mt-2 max-w-[620px] text-[14px] leading-relaxed">
          每一处修改都标注对应的评分项与提分幅度，每一项打分都附评分依据的原文引用——
          告诉你「为什么这里扣了分」，而不是一句空泛的评价。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="border-line bg-card rounded-xl border p-6">
          {/* 考试类型 */}
          <fieldset>
            <legend className="text-ink-soft mb-2 text-[12.5px] font-medium">
              考试类型
            </legend>
            <div className="border-line inline-flex rounded-lg border p-0.5">
              {(["ielts", "toefl"] as ExamType[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => switchExam(e)}
                  className={`rounded-[6px] px-4 py-1.5 text-[13px] font-medium transition ${
                    exam === e ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {e === "ielts" ? "雅思 IELTS" : "托福 TOEFL"}
                </button>
              ))}
            </div>
          </fieldset>

          {/* 任务类型 */}
          <fieldset className="mt-5">
            <legend className="text-ink-soft mb-2 text-[12.5px] font-medium">
              任务类型
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {tasks.map((t) => (
                <button
                  key={t.task}
                  type="button"
                  onClick={() => setTaskType(t.task)}
                  className={`rounded-lg border px-3.5 py-2.5 text-left transition sm:py-2 ${
                    taskType === t.task
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  <span
                    className={`block text-[13px] font-medium ${
                      taskType === t.task ? "text-accent" : "text-ink"
                    }`}
                  >
                    {TASK_LABELS[t.task].split(" · ")[1] ?? TASK_LABELS[t.task]}
                  </span>
                  <span className="text-ink-faint mt-0.5 block text-[11px]">
                    {t.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* 题目 */}
          <label className="mt-5 block">
            <span className="text-ink-soft mb-2 block text-[12.5px] font-medium">
              题目 / Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="把题目原文粘贴进来。扣题度诊断与话题词伙推荐都依赖它。"
              className="border-line bg-bg focus:border-accent focus:bg-card w-full resize-y rounded-lg border px-3.5 py-2.5 text-[13.5px] leading-relaxed transition outline-none"
            />
          </label>

          {/* 雅思 Task 1：图表数据 */}
          {taskType === "ielts_task1" && (
            <label className="mt-5 block">
              <span className="text-ink-soft mb-2 block text-[12.5px] font-medium">
                图表数据
                <span className="text-ink-faint ml-2 font-normal">
                  每行一条，用于检测关键数据有没有遗漏
                </span>
              </span>
              <textarea
                value={chartData}
                onChange={(e) => setChartData(e.target.value)}
                rows={5}
                placeholder={"煤炭 1990: 45% → 2010: 28%\n天然气 1990: 20% → 2010: 33%"}
                className="border-line bg-bg focus:border-accent focus:bg-card w-full resize-y rounded-lg border px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed transition outline-none"
              />
            </label>
          )}

          {/* 托福综合写作：阅读 / 听力论点 */}
          {taskType === "toefl_integrated" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-ink-soft mb-2 block text-[12.5px] font-medium">
                  阅读材料的三个论点
                  <span className="text-ink-faint ml-2 font-normal">每行一个</span>
                </span>
                <textarea
                  value={reading}
                  onChange={(e) => setReading(e.target.value)}
                  rows={5}
                  placeholder={
                    "1. Chain stores drive small shops out of business.\n2. They offer low-paying jobs.\n3. They cause traffic congestion."
                  }
                  className="border-line bg-bg focus:border-accent focus:bg-card w-full resize-y rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed transition outline-none"
                />
              </label>
              <label className="block">
                <span className="text-ink-soft mb-2 block text-[12.5px] font-medium">
                  听力材料的三个反驳点
                  <span className="text-ink-faint ml-2 font-normal">每行一个</span>
                </span>
                <textarea
                  value={listening}
                  onChange={(e) => setListening(e.target.value)}
                  rows={5}
                  placeholder={
                    "1. Consumers save money, which stays in the local economy.\n2. They offer better training and pay.\n3. They are located in suburbs, reducing traffic."
                  }
                  className="border-line bg-bg focus:border-accent focus:bg-card w-full resize-y rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed transition outline-none"
                />
              </label>
              <p className="text-ink-faint text-[11.5px] leading-relaxed sm:col-span-2">
                请用与作文相同的语言填写，否则无法做关键词配对。规则引擎会逐条核对：
                阅读的每个论点是否转述完整、听力的每个反驳点是否遗漏。
              </p>
            </div>
          )}

          {/* 作文 */}
          <label className="mt-5 block">
            <span className="mb-2 flex items-baseline justify-between">
              <span className="text-ink-soft text-[12.5px] font-medium">作文正文</span>
              <span
                className={`text-[11.5px] tabular-nums ${
                  words >= minWords ? "text-pos" : "text-ink-faint"
                }`}
              >
                {words} 词<span className="text-ink-faint"> / 要求 ≥ {minWords}</span>
              </span>
            </span>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              rows={16}
              placeholder="粘贴作文正文。段落之间请空行分隔，引擎会据此判断段落结构。"
              className="border-line bg-bg focus:border-accent focus:bg-card w-full resize-y rounded-lg border px-3.5 py-3 text-[13.5px] leading-[1.85] transition outline-none"
            />
          </label>

          {error && (
            <p className="border-neg/25 bg-neg-soft text-neg mt-4 rounded-lg border px-3.5 py-2.5 text-[12.5px]">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="bg-accent w-full rounded-lg px-5 py-3 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:w-auto sm:py-2.5 sm:text-[13.5px]"
            >
              {busy ? "批改中…" : "开始批改"}
            </button>
            <span className="text-ink-faint hidden text-[11.5px] sm:inline">
              预计 1–3 秒
            </span>
          </div>
        </div>

        {/* 侧栏 */}
        <aside className="space-y-4">
          <div className="border-line bg-card rounded-xl border p-4">
            <h2 className="text-ink-soft text-[12.5px] font-medium">
              没有作文？用示例试一下
            </h2>
            <div className="mt-3 space-y-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadSample(s.id)}
                  className="border-line hover:border-accent hover:bg-accent-soft w-full rounded-lg border px-3 py-2.5 text-left transition"
                >
                  <span className="text-ink block text-[12.5px] font-medium">
                    {s.title}
                  </span>
                  <span className="text-ink-faint mt-0.5 block text-[11px] leading-snug">
                    {s.subtitle}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-line bg-card rounded-xl border p-4">
            <h2 className="text-ink-soft text-[12.5px] font-medium">历史批改</h2>
            {history.length === 0 ? (
              <p className="text-ink-faint mt-3 text-[11.5px]">
                还没有记录。批改完成后会自动保存在本机浏览器里。
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {history.slice(0, 8).map((r) => (
                  <li key={r.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/report/${r.id}`)}
                      className="hover:bg-accent-soft min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition"
                    >
                      <span className="text-ink block truncate text-[12.5px]">
                        {r.prompt.slice(0, 34) || r.taskLabel}
                      </span>
                      <span className="text-ink-faint mt-0.5 block text-[11px]">
                        {r.overallLabel} · {r.wordCount} 词 ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="删除记录"
                      onClick={() => {
                        deleteReport(r.id);
                      }}
                      className="text-ink-faint hover:text-neg rounded-md px-2 py-1 text-[15px] leading-none transition lg:px-1.5 lg:text-[13px] lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-line bg-card text-ink-soft rounded-xl border p-4 text-[11.5px] leading-relaxed">
            <h2 className="text-ink-soft text-[12.5px] font-medium">批改包含什么</h2>
            <ul className="mt-2.5 space-y-1.5">
              <li>· 四维评分，每项附原文引用依据</li>
              <li>· 逐句左右对照批注，可单条接受 / 忽略</li>
              <li>· 学术搭配与话题词伙标注</li>
              <li>· 扣题度诊断 + 反模板检测</li>
              <li>· 图表数据覆盖 / 听力论点配对检测</li>
              <li>· 自动沉淀个人写作语料库</li>
            </ul>
          </div>
        </aside>
      </div>

      {history.length > 0 && (
        <p className="text-ink-faint mt-6 text-[11.5px]">
          共 {history.length} 篇批改记录，累计{" "}
          {history.reduce((a, r) => a + r.wordCount, 0)} 词。最近一次：{" "}
          {formatOverall(history[0].exam, history[0].overall)}。
        </p>
      )}
    </div>
  );
}
