import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { gradeEssay } from "../lib/engine";
import { SAMPLES } from "../lib/samples";
import DimensionCard from "../components/report/DimensionCard";
import SentenceDiff from "../components/report/SentenceDiff";
import {
  ConstraintsPanel,
  CoveragePanel,
  RelevancePanel,
  TemplatePanel,
} from "../components/report/Diagnostics";
import { Badge } from "../components/ui/Badge";

/**
 * 生成一份可以直接在浏览器打开的单文件批改报告预览。
 *
 * 用途：给人看「这个东西到底长什么样」。不需要启动服务、不需要 localStorage，
 * 把构建产物里的 CSS 内联进来，报告内容直接渲染成静态 HTML。
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function findBuiltCss(): string {
  const dir = join(ROOT, ".next/static/chunks");
  const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
  if (files.length === 0) throw new Error("找不到构建产物 CSS，请先 npm run build");
  // 取体积最大的那个（Tailwind 全量样式）
  files.sort((a, b) => statSync(join(dir, b)).size - statSync(join(dir, a)).size);
  return join(dir, files[0]);
}

const noop = () => {};

async function main() {
  const css = readFileSync(findBuiltCss(), "utf8");

  const blocks: string[] = [];

  for (const sample of SAMPLES) {
    const { report } = await gradeEssay(sample.input);

    const body = renderToStaticMarkup(
      <div className="mx-auto max-w-[1200px] px-5 py-8">
        {/* 报告头部 */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{report.taskLabel}</Badge>
              <Badge tone="neutral">{report.engine}</Badge>
              <Badge tone="neutral">{report.wordCount} 词</Badge>
            </div>
            <h1 className="text-ink mt-3 text-[15px] leading-relaxed font-medium">
              {report.prompt}
            </h1>
          </div>
          <div className="border-line bg-card flex items-center gap-4 rounded-xl border px-4 py-4 sm:gap-5">
            <div className="text-center">
              <div className="text-ink text-[30px] leading-none font-semibold tracking-tight sm:text-[34px]">
                {report.exam === "ielts" ? report.overall.toFixed(1) : report.overall}
              </div>
              <div className="text-ink-faint mt-1.5 text-[11px]">
                {report.exam === "ielts" ? "Overall Band" : "总分 / 30"}
              </div>
            </div>
            <div className="bg-line h-12 w-px shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              {report.dimensions.map((d) => (
                <div key={d.dimension} className="flex items-center gap-2">
                  <span className="text-ink-soft flex-1 truncate text-[11.5px]">
                    {d.label}
                  </span>
                  <span className="text-ink text-[12px] font-semibold tabular-nums">
                    {d.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 总评 */}
        <section className="border-line bg-card mt-6 rounded-xl border p-5">
          <h2 className="text-ink text-[13px] font-semibold">考官式总评</h2>
          <p className="text-ink-soft mt-2 text-[13px] leading-[1.9]">{report.summary}</p>
        </section>

        {/* 四维评分 */}
        <section className="mt-6">
          <h2 className="text-ink mb-3 text-[15px] font-semibold">四维评分</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {report.dimensions.map((d) => (
              <DimensionCard key={d.dimension} dimension={d} onJump={noop} />
            ))}
          </div>
        </section>

        {/* 逐句批注 */}
        <section className="mt-9">
          <h2 className="text-ink mb-3 text-[15px] font-semibold">逐句对照批注</h2>
          <SentenceDiff
            sentences={report.sentences}
            paragraphs={report.paragraphs}
            annotations={report.annotations}
            onChangeStatus={noop}
            filter={{ dimension: null, status: null }}
          />
        </section>

        {/* 结构诊断 */}
        <section className="mt-9">
          <h2 className="text-ink mb-3 text-[15px] font-semibold">结构诊断</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <RelevancePanel relevance={report.relevance} onJump={noop} />
              <TemplatePanel template={report.template} onJump={noop} />
            </div>
            <div className="space-y-4">
              {report.coverage && (
                <CoveragePanel coverage={report.coverage} onJump={noop} />
              )}
              <ConstraintsPanel report={report} />
            </div>
          </div>
        </section>
      </div>,
    );

    blocks.push(
      `<div class="preview-page"><div class="preview-banner">${report.taskLabel} · ${report.overallLabel}</div>${body}</div>`,
    );
  }

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LexScore 批改报告预览</title>
<style>${css}</style>
<style>
  body { background: #f6f8fa; margin: 0; }
  .preview-page { border-bottom: 3px dashed #ccd5de; }
  .preview-banner {
    background: #10161d; color: #fff; font-size: 13px; font-weight: 600;
    padding: 10px 20px; letter-spacing: .02em;
  }
</style>
</head>
<body>${blocks.join("\n")}</body>
</html>`;

  const out = join(ROOT, "preview-report.html");
  writeFileSync(out, html, "utf8");
  console.log(`已生成 ${out}`);
  console.log(`大小 ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
  console.log(`包含 ${SAMPLES.length} 篇示例的完整批改报告`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
