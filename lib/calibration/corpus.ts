/**
 * 评分校准语料。
 *
 * 每个样本都标注了「人工作出的目标分段」，用来检验引擎能不能稳定地区分
 * 不同水平的作文 —— 这是整个产品最核心的假设：
 *   · 一篇 Band 8 的作文必须比 Band 5.5 的得分高
 *   · 同一维度上，水平差距要体现在分数上，而不是全部挤在 6.5
 *
 * 语料按官方 band descriptor 的特征撰写，而不是「随便写好一点 / 差一点」：
 *   Band 8  —— 立场清晰、论证有层次、词汇精确、句法多变、几乎无错
 *   Band 6.5—— 立场清楚、论证基本展开、词汇够用、有零星错误
 *   Band 5.5—— 依赖模板、论证停留表面、词汇重复、错误可察觉
 *   Band 4.5—— 篇幅不足、论点未展开、错误频繁、衔接生硬
 */

export interface CalibrationSample {
  id: string;
  exam: "ielts" | "toefl";
  taskType: "ielts_task1" | "ielts_task2" | "toefl_integrated" | "toefl_discussion";
  /** 人工判定的目标总分档位 */
  targetBand: number;
  /** 各维度的人工预期（可缺省，缺省表示不做逐项校验） */
  expected?: Partial<
    Record<"TR" | "CC" | "LR" | "GRA" | "TF" | "OD" | "LU" | "SV", number>
  >;
  note: string;
  prompt: string;
  essay: string;
  chartData?: string;
  readingPoints?: string[];
  listeningPoints?: string[];
}

const TASK2_PROMPT =
  "Some people believe that university education should be free for all students, regardless of their family income. To what extent do you agree or disagree?";

export const CALIBRATION: CalibrationSample[] = [
  /* ------------------------------------------------------------------ *
   * Band 4.5 —— 篇幅不足、论点未展开、错误频繁
   * ------------------------------------------------------------------ */
  {
    id: "t2-band45",
    exam: "ielts",
    taskType: "ielts_task2",
    targetBand: 4.5,
    note: "篇幅不足、只有断言没有论证、语法错误频繁、衔接生硬",
    prompt: TASK2_PROMPT,
    essay: `Nowadays education is very important for everyone. I think university should be free because many students are poor and they cannot pay. This is good for society.

Firstly, free education help poor students. Many students want to study but they have no money. If university is free, they can go to school. So this is very good. Also it can make the country develop.

Secondly, education is important. Because every country need educated people, so government should pay money. But some people think it is not good because government have many things to do.

In conclusion, I think free university is good. Government should do this.`,
  },

  /* ------------------------------------------------------------------ *
   * Band 5.5 —— 模板痕迹重、论证表面化、词汇重复
   * ------------------------------------------------------------------ */
  {
    id: "t2-band55",
    exam: "ielts",
    taskType: "ielts_task2",
    targetBand: 5.5,
    note: "模板句密集、论点有但展开不足、词汇重复、中式语法错误",
    prompt: TASK2_PROMPT,
    essay: `With the rapid development of society, more and more people discuss whether university education should be free. Every coin has two sides. In my opinion, I agree with this idea to a large extent.

Firstly, free education can help a lot of poor students to get into university. Because the tuition fee is very high, so many students from poor families have to give up their study. If the government pay the tuition, these students can go to university. This is good for the society because it can reduce the gap between rich and poor.

Secondly, a country needs more and more well-educated people to develop its economy. Although free education costs a lot of money, but it can bring big benefit in the long term. There is no doubt that education is very important for a country.

On the other hand, some people think free education will bring some bad things. They say the government has many important things to do, such as building roads and hospitals. Besides, if the education is free, the quality of teaching will go down because the government don't have enough money to pay good teachers.

In a word, I think free university education is good. Although it has some disadvantages, but the advantages are more. Last but not least, the government should pay attention to this problem and make a good plan.`,
  },

  /* ------------------------------------------------------------------ *
   * Band 6.5 —— 立场清楚、论证基本展开、有零星错误
   * ------------------------------------------------------------------ */
  {
    id: "t2-band65",
    exam: "ielts",
    taskType: "ielts_task2",
    targetBand: 6.5,
    note: "结构清楚、论证有展开但例证偏笼统、词汇够用、句法有变化、错误零星",
    prompt: TASK2_PROMPT,
    essay: `Whether higher education should be funded entirely by the state is a question that divides opinion. In my view, tuition should be free for students from lower-income families, although a completely universal system would be difficult to sustain.

The main argument for free university education is equal opportunity. Talented students who cannot afford tuition are effectively excluded from professions that require a degree, which means society loses their potential contribution. In countries where fees are high, many graduates begin their careers with substantial debt, and this can discourage them from choosing lower-paid but socially valuable work such as teaching or research.

However, making education free for everyone would place a heavy burden on public finances. Universities require laboratories, libraries and qualified staff, and these costs have to be met from somewhere. If the government covers all tuition, it may need to raise taxes or reduce spending on other services like healthcare. A more practical solution would be to provide grants for students whose family income falls below a certain level, while asking wealthier families to contribute.

In conclusion, while free education for all is an attractive ideal, a targeted system is more realistic. Governments should ensure that no student is excluded because of poverty, but they also need to consider the long-term sustainability of public spending.`,
  },

  /* ------------------------------------------------------------------ *
   * Band 8.0 —— 立场清晰、论证有层次、词汇精确、句法多变
   * ------------------------------------------------------------------ */
  {
    id: "t2-band80",
    exam: "ielts",
    taskType: "ielts_task2",
    targetBand: 8.0,
    note: "论证有让步与反驳、词汇精确且多样、句法多变、几乎无错",
    prompt: TASK2_PROMPT,
    essay: `The proposition that tertiary education ought to be funded entirely by the state, irrespective of parental income, rests on an appealing premise: that access to learning should not be rationed by wealth. While I sympathise with that principle, I would argue that universal free tuition is a blunt instrument, and that means-tested support is both fairer and more sustainable.

The case for abolishing fees outright is strongest when one considers the waste of human capital. Where tuition is expensive, able students from modest backgrounds are disproportionately likely to forgo university altogether, or to gravitate towards commercially lucrative degrees in order to service their debts. The consequence is a shortage of graduates in precisely the fields — medicine, teaching, engineering — where the social return exceeds the private one. Subsidising tuition can therefore be justified as an investment rather than an expenditure.

Yet universal provision is regressive in a way that its advocates seldom acknowledge. University students are drawn disproportionately from affluent households, so a blanket subsidy transfers resources from the general taxpayer to a comparatively privileged group. Worse, the graduates who benefit most are those who subsequently command the highest salaries; they receive the subsidy as students and capture the private returns of their degrees thereafter. This is not so much a safety net as a windfall.

A more defensible arrangement combines income-contingent loans with generous means-tested grants. Students from low-income families would receive non-repayable support covering both fees and living costs, while those from wealthier backgrounds would contribute on a sliding scale and repay only once their earnings exceeded a threshold. Such a scheme preserves access without asking those who will never attend university to underwrite those who will.

In short, the goal should be that no applicant is deterred by cost. Universal free tuition is one route to that goal, but it is an expensive and poorly targeted one. A system that concentrates public money where it is genuinely needed achieves the same end at far lower cost.`,
  },

  /* ------------------------------------------------------------------ *
   * 雅思小作文：Band 5.0 vs 7.5
   * ------------------------------------------------------------------ */
  {
    id: "t1-band50",
    exam: "ielts",
    taskType: "ielts_task1",
    targetBand: 5.0,
    note: "无 Overview、罗列数字不做比较、出现主观评价",
    prompt:
      "The chart below shows the percentage of electricity generated from four different sources in one country between 1990 and 2010.",
    chartData: `煤炭 1990: 45% → 2010: 28%
天然气 1990: 20% → 2010: 33%
核能 1990: 12% → 2010: 15%
可再生能源 1990: 3% → 2010: 24%`,
    essay: `The chart shows the percentage of electricity produced by four different sources in a country between 1990 and 2010. Coal was the biggest source in 1990, it produced 45% of the electricity. In 2010, coal decreased to 28%. Natural gas increased from 20% to 33% during this period. Nuclear power also increased a little bit from 12% to 15%. Renewable energy increased from 3% to 24%, this is a big change. I think the government should pay attention to renewable energy because it is very important for the future. In conclusion, the way of making electricity changed a lot in this country.`,
  },
  {
    id: "t1-band75",
    exam: "ielts",
    taskType: "ielts_task1",
    targetBand: 7.5,
    note: "有清晰 Overview、覆盖最大最小与趋势、持续做比较、无主观评价",
    prompt:
      "The chart below shows the percentage of electricity generated from four different sources in one country between 1990 and 2010.",
    chartData: `煤炭 1990: 45% → 2010: 28%
天然气 1990: 20% → 2010: 33%
核能 1990: 12% → 2010: 15%
可再生能源 1990: 3% → 2010: 24%`,
    essay: `The chart compares the proportion of electricity generated from four sources in a single country over a twenty-year period from 1990 to 2010.

Overall, the country became markedly less dependent on coal, while renewable energy grew from a negligible base to become the second largest source. Natural gas also rose steadily, and nuclear power remained the smallest contributor throughout.

In 1990 coal accounted for 45% of electricity generation, by far the highest share of any source. By 2010 this figure had fallen to 28%, a decline of 17 percentage points. Natural gas moved in the opposite direction, climbing from 20% to 33% and overtaking coal as the dominant source by the end of the period.

The most striking change concerns renewable energy. Having supplied just 3% of electricity in 1990 — the lowest figure recorded — it expanded eightfold to reach 24% in 2010, a share comparable to that of natural gas. Nuclear power, by contrast, changed relatively little, edging up from 12% to 15% and remaining the least significant source throughout the period.`,
  },

  /* ------------------------------------------------------------------ *
   * 托福综合写作：Band 2.0 vs 4.5
   * ------------------------------------------------------------------ */
  {
    id: "ti-band20",
    exam: "toefl",
    taskType: "toefl_integrated",
    targetBand: 2.0,
    note: "只有立场声明、几乎不复述听力内容、遗漏多数反驳点",
    prompt:
      "Summarise the points made in the lecture, being sure to explain how they cast doubt on the specific points made in the reading passage.",
    readingPoints: [
      "Large retail chains drive small local shops out of business, damaging the local economy.",
      "Chain stores offer only low-paying jobs with poor benefits.",
      "Chain stores cause the decline of city centres and create traffic congestion.",
    ],
    listeningPoints: [
      "Consumers save money at chain stores, and that money is spent elsewhere in the local economy; small shops can switch to specialised services.",
      "Chain stores actually provide better training, more promotion opportunities and higher pay than small shops.",
      "Chain stores are usually located in the suburbs rather than downtown, so they reduce traffic pressure in city centres.",
    ],
    essay: `The reading passage talks about chain stores and their problems. The professor does not agree with this opinion.

First, the reading says chain stores are bad for small shops. The professor does not agree.

Second, the reading says chain stores have low-paying jobs. The professor does not agree with this.

Third, the reading says chain stores cause traffic. The professor does not agree.`,
  },
  {
    id: "ti-band45",
    exam: "toefl",
    taskType: "toefl_integrated",
    targetBand: 4.5,
    note: "三个论点完整配对、准确复述听力细节、明确标记反驳关系",
    prompt:
      "Summarise the points made in the lecture, being sure to explain how they cast doubt on the specific points made in the reading passage.",
    readingPoints: [
      "Large retail chains drive small local shops out of business, damaging the local economy.",
      "Chain stores offer only low-paying jobs with poor benefits.",
      "Chain stores cause the decline of city centres and create traffic congestion.",
    ],
    listeningPoints: [
      "Consumers save money at chain stores, and that money is spent elsewhere in the local economy; small shops can switch to specialised services.",
      "Chain stores actually provide better training, more promotion opportunities and higher pay than small shops.",
      "Chain stores are usually located in the suburbs rather than downtown, so they reduce traffic pressure in city centres.",
    ],
    essay: `The reading passage argues that large retail chains damage local communities in three ways. The professor challenges each of these claims.

First, the reading states that chain stores drive small local shops out of business, thereby harming the local economy. The lecturer counters this by pointing out that consumers actually save money when they shop at chain stores, and that this saving is subsequently spent elsewhere in the local economy. She adds that small shops are not necessarily doomed: many can switch to providing specialised services that chains do not offer.

Second, the article claims that chain stores create only low-paying jobs with poor benefits. The professor refutes this by explaining that chains in fact provide better training, more opportunities for promotion, and higher wages than the small shops they replace.

Third, the author asserts that chain stores contribute to the decline of city centres and generate traffic congestion. The lecture challenges this too, noting that chain stores are typically located in suburban areas rather than downtown. As a result, they actually reduce the volume of traffic in city centres rather than adding to it.`,
  },
];
