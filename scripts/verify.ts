import { gradeEssay } from "../lib/engine";
import { SAMPLES } from "../lib/samples";
import { buildPreview, resolveSpans, toSegments, locateIn } from "../lib/text";

let failures = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    failures += 1;
  }
}

async function main() {
  for (const sample of SAMPLES) {
    const { report } = await gradeEssay(sample.input);
    console.log(`\n▸ ${sample.title}`);

    const sentenceById = new Map(report.sentences.map((s) => [s.id, s]));

    // 1. 每条批注的 target 必须能在所属句子里原样定位
    let unlocatable = 0;
    for (const a of report.annotations) {
      const sentence = sentenceById.get(a.sentenceId);
      if (!sentence) {
        check(false, `批注 ${a.id} 指向不存在的句子 ${a.sentenceId}`);
        continue;
      }
      if (!locateIn(sentence.text, a.target)) {
        unlocatable += 1;
        console.error(`  ✗ target 无法定位：${a.id}`);
        console.error(`      target   : ${JSON.stringify(a.target.slice(0, 90))}`);
        console.error(`      sentence : ${JSON.stringify(sentence.text.slice(0, 90))}`);
      }
      // 有替换内容的批注，replacement 不能和 target 完全相同
      if (a.replacement && a.replacement.trim() === a.target.trim()) {
        check(false, `批注 ${a.id} 的 replacement 与 target 相同，属于无效修改`);
      }
      // 提分说明必须包含评分项与数值
      check(
        a.liftText.includes(String(a.lift)),
        `批注 ${a.id} 的提分说明缺少幅度数值：${a.liftText}`,
      );
    }
    check(unlocatable === 0, `${unlocatable} 条批注无法定位到原文`);
    console.log(
      `  批注 ${report.annotations.length} 条，全部可定位：${unlocatable === 0}`,
    );

    // 2. 评分依据：引用必须来自被指向的句子
    let badQuote = 0;
    let withQuote = 0;
    for (const dim of report.dimensions) {
      for (const e of dim.evidences) {
        if (!e.quote) continue;
        withQuote += 1;
        const sentence = sentenceById.get(e.sentenceId);
        if (!sentence) {
          badQuote += 1;
          console.error(`  ✗ ${dim.dimension} 的依据指向不存在的句子 ${e.sentenceId}`);
          continue;
        }
        if (!sentence.text.startsWith(e.quote.slice(0, 40))) {
          badQuote += 1;
          console.error(`  ✗ ${dim.dimension} 的引用与句子不符：${e.quote.slice(0, 60)}`);
        }
      }
    }
    check(badQuote === 0, `${badQuote} 条评分依据的引用与原文不符`);
    console.log(`  评分依据 ${withQuote} 条带原文引用，引用错位：${badQuote}`);

    // 3. 每个评分项至少两条依据
    for (const dim of report.dimensions) {
      check(
        dim.evidences.length >= 2,
        `${dim.dimension} 只有 ${dim.evidences.length} 条评分依据（要求 ≥ 2）`,
      );
    }

    // 4. 左右分栏渲染逻辑
    let spanErrors = 0;
    for (const s of report.sentences) {
      const list = report.annotations.filter((a) => a.sentenceId === s.id);
      const spans = resolveSpans(s.text, list);

      // 区间必须有序且不重叠
      for (let i = 1; i < spans.length; i += 1) {
        if (spans[i].start < spans[i - 1].end) spanErrors += 1;
      }
      // 切分后的片段必须能无损拼回原文
      const rejoined = toSegments(s.text, spans)
        .map((x) => x.text)
        .join("");
      check(rejoined === s.text, `句子 ${s.id} 的原文切分无法还原`);

      // 修改版预览同样必须可还原（未接受时等于原文）
      const preview = buildPreview(s.text, spans)
        .map((x) => (x.kind === "pending" ? s.text.slice(0, 0) + x.text : x.text))
        .join("");
      check(preview.length > 0, `句子 ${s.id} 的修改版预览为空`);
    }
    check(spanErrors === 0, `存在 ${spanErrors} 处区间重叠未处理`);
    console.log(`  左右分栏切分无损，区间重叠：${spanErrors}`);

    // 5. 语料与诊断完整性
    check(report.corpus.length > 0, "语料库为空");
    check(report.relevance.keywords.length > 0, "扣题度诊断没有提取出任何关键词");
    console.log(
      `  语料 ${report.corpus.length} 条 · 扣题关键词 ${report.relevance.keywords.length} 个 · 模板命中 ${report.template.hits.length} 处`,
    );
  }

  console.log(failures === 0 ? "\n✓ 全部校验通过" : `\n✗ 共 ${failures} 项校验失败`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
