import { NextResponse } from "next/server";
import { gradeEssay } from "@/lib/engine";
import { providerStatus } from "@/lib/engine/providers";
import type { ExamType, GradeInput, TaskType } from "@/lib/types";

const VALID_TASKS: TaskType[] = [
  "ielts_task1",
  "ielts_task2",
  "toefl_integrated",
  "toefl_discussion",
];

export async function POST(request: Request) {
  let body: Partial<GradeInput>;
  try {
    body = (await request.json()) as Partial<GradeInput>;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const exam = body.exam as ExamType | undefined;
  const taskType = body.taskType as TaskType | undefined;

  if (exam !== "ielts" && exam !== "toefl") {
    return NextResponse.json({ error: "考试类型必须是 ielts 或 toefl" }, { status: 400 });
  }
  if (!taskType || !VALID_TASKS.includes(taskType)) {
    return NextResponse.json({ error: "任务类型不合法" }, { status: 400 });
  }
  if (!body.essay || body.essay.trim().length < 20) {
    return NextResponse.json({ error: "作文内容过短，至少 20 个字符" }, { status: 400 });
  }

  try {
    const { report, notice } = await gradeEssay({
      exam,
      taskType,
      prompt: body.prompt?.trim() || "（未填写题目）",
      essay: body.essay,
      chartData: body.chartData,
      readingPoints: body.readingPoints?.filter((p) => p.trim()),
      listeningPoints: body.listeningPoints?.filter((p) => p.trim()),
    });
    return NextResponse.json({ report, notice });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "批改失败" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ provider: providerStatus() });
}
