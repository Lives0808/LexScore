import type { GradeInput, Report } from "./types";

/**
 * 客户端批改入口。
 *
 * 整套评分引擎是纯 TypeScript、零 Node 依赖的，所以可以直接在浏览器 /
 * Android WebView 里运行 —— 这意味着安卓版**完全离线可用**，不需要任何后端。
 *
 * 用动态 import 把引擎单独切一个 chunk：首屏只加载表单，点「开始批改」
 * 时才去加载引擎代码。
 */
export async function gradeOnClient(
  input: GradeInput,
): Promise<{ report: Report; notice?: string }> {
  const { gradeEssay } = await import("./engine");
  return gradeEssay(input);
}

/** 当前使用的评分器，用于界面上标注 */
export async function describeProvider(): Promise<string> {
  const { providerStatus } = await import("./engine/providers");
  return providerStatus().label;
}
