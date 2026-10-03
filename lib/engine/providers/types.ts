import type {
  Annotation,
  CoverageReport,
  DimensionScore,
  Fact,
  GradeInput,
  Sentence,
  TemplateReport,
  Paragraph,
  RelevanceReport,
} from "../../types";
import type { AnalysisBundle } from "../analyzers";
import type { PipelineResult } from "../agents";

export interface GradeContext {
  input: GradeInput;
  bundle: AnalysisBundle;
  facts: Fact[];
  /** 三层 Agent 流水线的完整结论，供评分层与报告展示使用 */
  pipeline: PipelineResult;
  coverage?: CoverageReport;
  constraints: {
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }[];
}

export interface ScoringPlan {
  dimensions: DimensionScore[];
  summary: string;
  /** 引擎标识，例如 rule-engine-v1 / llm:gpt-4o */
  engine: string;
  /** 模型额外产出的批注，会与规则引擎的确定性批注合并 */
  annotations?: Annotation[];
}

export interface GraderProvider {
  id: string;
  label: string;
  available(): boolean;
  score(ctx: GradeContext): Promise<ScoringPlan>;
}

export type { Sentence, Paragraph, RelevanceReport, TemplateReport };
