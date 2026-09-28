import { llmProvider } from "./llm";
import { ruleProvider } from "./mock";
import type { GraderProvider } from "./types";

/**
 * Provider 选择。
 *
 * 配置了 LEXSCORE_LLM_API_KEY 就走真实模型；否则使用规则评分器。
 * 两者输出同一套结构，UI 无需感知差异。
 */
export function getProvider(): GraderProvider {
  return llmProvider.available() ? llmProvider : ruleProvider;
}

export function providerStatus(): { id: string; label: string; mode: "llm" | "rules" } {
  const p = getProvider();
  return { id: p.id, label: p.label, mode: p.id === "llm" ? "llm" : "rules" };
}

export { ruleProvider, llmProvider };
export type { GraderProvider };
