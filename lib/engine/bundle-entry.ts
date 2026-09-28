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
