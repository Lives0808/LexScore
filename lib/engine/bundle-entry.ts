/**
 * 安卓端入口。
 *
 * 原生安卓端把整个引擎作为一份 JS bundle 内嵌，在 WebView（V8）里执行，
 * 因此引擎源码只有 TypeScript 这一份，不需要维护 Kotlin 副本。
 *
 * 返回完整 JSON 字符串即可：WebView 的 evaluateJavascript 能处理几十 KB 的返回值。
 * （曾经试过 app.cash.quickjs，它的 JS 栈上限写死在库内部，
 *   连返回 5KB 字符串都会 stack overflow，已弃用。）
 */
import { gradeEssaySync } from "./index";
import { SAMPLES } from "../samples";
import { analyzeHistory } from "./insights";

declare const globalThis: Record<string, unknown>;

globalThis.LexScore = {
  /** bundle 版本，安卓端会读出来便于排查 */
  version: "1.0.0",

  /**
   * 批改。
   * @param inputJson GradeInput 的 JSON 字符串
   * @returns { ok: true, report } 或 { ok: false, error } 的 JSON 字符串
   */
  grade(inputJson: string): string {
    try {
      const input = JSON.parse(inputJson);
      return JSON.stringify({ ok: true, report: gradeEssaySync(input) });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * 跨篇错误追踪。
   *
   * 逻辑留在 TypeScript 里，安卓端通过这里调用 ——
   * 不在 Kotlin 侧重写一份，避免两端分析结果不一致。
   *
   * @param reportsJson 用户所有报告的 JSON 数组
   * @returns LearnerInsight 的 JSON 字符串
   */
  analyzeHistory(reportsJson: string): string {
    try {
      const reports = JSON.parse(reportsJson);
      return JSON.stringify({ ok: true, insight: analyzeHistory(reports) });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * 示例作文。
   *
   * 安卓端实际读构建期生成的 samples.json 资源，这个接口作为兜底保留。
   */
  samples(): string {
    return JSON.stringify(
      SAMPLES.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        input: s.input,
      })),
    );
  },
};
