import { renderToStaticMarkup } from "react-dom/server";
import { gradeEssay } from "../lib/engine";
import { SAMPLES } from "../lib/samples";
import SentenceDiff from "../components/report/SentenceDiff";
import DimensionCard from "../components/report/DimensionCard";
import {
  ConstraintsPanel,
  CoveragePanel,
  RelevancePanel,
  TemplatePanel,
} from "../components/report/Diagnostics";
import AnnotationCard from "../components/report/AnnotationCard";

/**
 * 报告页 UI 的结构校验。
 *
 * 报告页是客户端组件（数据来自 localStorage），curl 只能拿到「加载中…」，
 * 所以这里用服务端渲染把每个组件真正渲染成 HTML，再断言结构。
 * 目的是在没有浏览器的情况下，确认移动端改造没有破坏渲染。
 */

let failures = 0;
function check(ok: boolean, message: string) {
  if (!ok) {
    console.error(`  ✗ ${message}`);
    failures += 1;
  }
}

const noop = () => {};

async function main() {
  for (const sample of SAMPLES) {
    const { report } = await gradeEssay(sample.input);
    console.log(`\n▸ ${sample.title}`);

    /* ---------- 逐句对照 ---------- */
    const diffHtml = renderToStaticMarkup(
      <SentenceDiff
        sentences={report.sentences}
        paragraphs={report.paragraphs}
        annotations={report.annotations}
        onChangeStatus={noop}
        filter={{ dimension: null, status: null }}
      />,
    );

    check(diffHtml.includes("原文"), "逐句对照缺少「原文」列");
    check(diffHtml.includes("修改版"), "逐句对照缺少「修改版」列");
    check(
      diffHtml.includes("md:grid-cols-2"),
      "逐句对照缺少桌面端左右分栏类（md:grid-cols-2）",
    );
    check(diffHtml.includes("md:hidden"), "逐句对照缺少移动端专用标签（md:hidden）");
    check(diffHtml.includes("点一下高亮处"), "缺少移动端（点击）操作提示");
    check(diffHtml.includes("把鼠标移到高亮处"), "缺少桌面端（悬浮）操作提示");
    check(
      diffHtml.includes("scroll-mt-20"),
      "句子锚点缺少 scroll-mt，定位时会被吸顶导航挡住",
    );

    // 每条批注都应当出现在 HTML 里（作为 mark 或作为卡片）
    const markCount = (diffHtml.match(/<mark/g) ?? []).length;
    check(markCount > 0, "没有任何高亮标记");
    const cardCount = (diffHtml.match(/id="anno-/g) ?? []).length;
    check(
      cardCount === report.annotations.length,
      `批注卡片数量不符：渲染 ${cardCount}，实际 ${report.annotations.length}`,
    );

    // 接受 / 忽略按钮
    check(diffHtml.includes("接受修改"), "批注卡片缺少「接受修改」按钮");
    check(diffHtml.includes("忽略"), "批注卡片缺少「忽略」按钮");

    // 触摸设备不应渲染悬浮提示（服务端快照为 false）
    check(!diffHtml.includes('role="tooltip"'), "服务端渲染不应包含悬浮提示框");

    // 无障碍：高亮处应可作为按钮聚焦
    check(
      diffHtml.includes('role="button"'),
      "高亮标记缺少 role=button，触摸与键盘不可用",
    );

    console.log(
      `  逐句对照：${markCount} 个高亮 · ${cardCount} 张批注卡片 · 左右分栏与移动端标签均在`,
    );

    /* ---------- 四维评分卡片 ---------- */
    const dimHtml = report.dimensions
      .map((d) => renderToStaticMarkup(<DimensionCard dimension={d} onJump={noop} />))
      .join("");
    for (const d of report.dimensions) {
      check(dimHtml.includes(d.label), `评分卡片缺少维度 ${d.label}`);
      check(dimHtml.includes(String(d.score)), `评分卡片缺少 ${d.label} 的分数`);
    }
    check(dimHtml.includes("展开评分依据"), "评分卡片缺少展开依据的入口");
    check(
      renderToStaticMarkup(
        <DimensionCard dimension={report.dimensions[0]} onJump={noop} />,
      ).includes("展开评分依据"),
      "移动端应默认折叠评分依据",
    );
    console.log(`  四维评分卡片：${report.dimensions.length} 张渲染正常`);

    /* ---------- 诊断面板 ---------- */
    const diagHtml = [
      renderToStaticMarkup(<RelevancePanel relevance={report.relevance} onJump={noop} />),
      renderToStaticMarkup(<TemplatePanel template={report.template} onJump={noop} />),
      renderToStaticMarkup(<ConstraintsPanel report={report} />),
      report.coverage
        ? renderToStaticMarkup(<CoveragePanel coverage={report.coverage} onJump={noop} />)
        : "",
    ].join("");

    check(diagHtml.includes("扣题度诊断"), "缺少扣题度面板");
    check(diagHtml.includes("反模板检测"), "缺少反模板面板");
    check(diagHtml.includes("硬性约束检查"), "缺少硬性约束面板");
    if (report.coverage) {
      check(diagHtml.includes(report.coverage.title), "缺少覆盖检测面板");
    }
    console.log(
      `  诊断面板：扣题度 / 反模板 / 硬性约束${report.coverage ? " / 覆盖检测" : ""} 渲染正常`,
    );

    /* ---------- 单条批注卡片（三种状态） ---------- */
    // 取「有替换内容」的批注优先；综合写作可能一条都没有（全是仅建议）
    const sampleAnno =
      report.annotations.find((a) => a.replacement) ?? report.annotations[0];
    check(Boolean(sampleAnno), "报告里没有任何批注");
    for (const status of ["pending", "accepted", "ignored"] as const) {
      const html = renderToStaticMarkup(
        <AnnotationCard
          annotation={{ ...sampleAnno, status }}
          onChange={noop}
          highlighted={false}
        />,
      );
      check(html.includes("anno-"), `批注卡片 ${status} 状态渲染失败`);
      if (status !== "pending") {
        check(html.includes("撤销"), `${status} 状态应可撤销`);
      } else {
        check(html.includes("忽略"), "待处理状态应有忽略按钮");
      }
    }

    const actionable = report.annotations.filter((a) => a.replacement).length;
    console.log(
      `  批注卡片：三种状态可撤销 · ${actionable} / ${report.annotations.length} 条可一键接受`,
    );
  }

  console.log(failures === 0 ? "\n✓ 界面结构校验全部通过" : `\n✗ 共 ${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
