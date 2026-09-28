import type { GradeInput } from "./types";

/**
 * 示例素材。
 *
 * 三篇作文都刻意埋入了中国考生最常见的失误：模板句、中式搭配、
 * 连词重复、数据覆盖不全、听力反驳转述缺失。
 * 目的是让用户在第一次点击「开始批改」时就能看到完整的诊断能力。
 */

export interface Sample {
  id: string;
  title: string;
  subtitle: string;
  input: GradeInput;
}

export const SAMPLES: Sample[] = [
  {
    id: "ielts-task2",
    title: "雅思 Task 2 · 议论文",
    subtitle: "大学教育是否应该免费（埋入模板句与中式语法错误）",
    input: {
      exam: "ielts",
      taskType: "ielts_task2",
      prompt:
        "Some people believe that university education should be free for all students, regardless of their family income. To what extent do you agree or disagree?",
      essay: `With the rapid development of society, more and more people think that university education should be free. Every coin has two sides. In my opinion, I agree with this idea to a large extent.

Firstly, free education can help a lot of poor students to get into university. Because the tuition fee is very high, so many students from poor families have to give up their study. If the government pay the tuition, these students can go to university. This is good for the society because it can reduce the gap between rich and poor.

Secondly, a country needs more and more well-educated people to develop its economy. Although free education costs a lot of money, but it can bring big benefit in the long term, and it can also help the country to develop faster and faster, and this is the reason why so many people in different countries all over the world support this kind of policy. There is no doubt that education is very important.

On the other hand, some people think free education will bring some bad things. They say the government has many important things to do, such as building roads and hospitals. Besides, if the education is free, the quality of teaching will go down because the government don't have enough money to pay good teachers.

In a word, I think free university education is good. Although it has some disadvantages, but the advantages are more. Last but not least, the government should pay attention to this problem and make a good plan.`,
    },
  },
  {
    id: "ielts-task1",
    title: "雅思 Task 1 · 图表描述",
    subtitle: "四国电力结构变化（缺少 Overview 与关键数据）",
    input: {
      exam: "ielts",
      taskType: "ielts_task1",
      prompt:
        "The chart below shows the percentage of electricity generated from four different sources in one country between 1990 and 2010. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
      chartData: `煤炭 1990: 45% → 2010: 28%
天然气 1990: 20% → 2010: 33%
核能 1990: 12% → 2010: 15%
可再生能源 1990: 3% → 2010: 24%`,
      essay: `The chart shows the percentage of electricity produced by four different sources in a country between 1990 and 2010. Coal was the biggest source in 1990, it produced 45% of the electricity. In 2010, coal decreased to 28%. Natural gas increased from 20% to 33% during this period. Nuclear power also increased a little bit from 12% to 15%. Renewable energy increased from 3% to 24%, this is a big change. I think the government should pay attention to renewable energy because it is very important for the future. In conclusion, the way of making electricity changed a lot in this country.`,
    },
  },
  {
    id: "toefl-integrated",
    title: "托福 · 综合写作",
    subtitle: "大型连锁零售店（第二个听力反驳点转述缺失）",
    input: {
      exam: "toefl",
      taskType: "toefl_integrated",
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
      essay: `The reading passage argues that large retail chains harm local communities in three ways. The professor disagrees with this view.

First, the reading claims that chain stores cause small local shops to close, which damages the local economy. The lecturer points out that consumers actually save money by shopping at chain stores, and this money is then spent elsewhere in the local economy. She also explains that small shops can switch to providing specialised services instead of competing directly.

Second, the article says that chain stores offer low-paying jobs with poor benefits. The professor does not agree with this opinion.

Third, the author states that chain stores cause traffic problems in city centres. The lecture counters this by explaining that chain stores are usually located in suburbs rather than downtown areas, so they actually reduce traffic in the centre.`,
    },
  },
];

export function sampleById(id: string): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
