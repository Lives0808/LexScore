import type {
  AnnotationTag,
  DimensionId,
  ExamType,
  Severity,
  TaskType,
} from "../types";

/* ------------------------------------------------------------------ *
 * 1. 学术写作常用搭配升级表
 *    每一条都自带「为什么改」与「为什么考官更喜欢」
 * ------------------------------------------------------------------ */

export interface UpgradeRule {
  id: string;
  pattern: RegExp;
  replacement: string;
  dimension: DimensionId;
  tag: AnnotationTag;
  severity: Severity;
  lift: number;
  reason: string;
  examinerNote: string;
  only?: { exam?: ExamType; tasks?: TaskType[] };
}

export const ACADEMIC_UPGRADES: UpgradeRule[] = [
  {
    id: "up_lot_of",
    pattern: /\ba lot of\b/gi,
    replacement: "a considerable number of",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「a lot of」属于口语化程度较高的量词，在书面学术语境中显得随意。",
    examinerNote:
      "考官在词汇项上考察语域一致性。学术写作中量词倾向使用 a considerable / substantial / significant number of，或改用 a great deal of 搭配不可数名词。",
  },
  {
    id: "up_lots_of",
    pattern: /\blots of\b/gi,
    replacement: "numerous",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「lots of」是典型口语缩略形式，书面语中不使用。",
    examinerNote:
      "词汇项的「语域恰当」是明确的评分点。书面语使用 numerous / a multitude of 可与口语化表达拉开档次。",
  },
  {
    id: "up_more_and_more",
    pattern: /\bmore and more\b/gi,
    replacement: "an increasing number of",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「more and more」是口语化的重复结构，学术写作中应改用名词化表达。",
    examinerNote:
      "把比较结构转化为名词短语（an increasing number of / a growing proportion of）是 7 分以上词汇项的典型特征，因为它在有限字数内承载了更多信息。",
  },
  {
    id: "up_nowadays",
    pattern: /\bnowadays\b/gi,
    replacement: "in recent decades",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「nowadays」使用过于频繁，且时间指向模糊。",
    examinerNote:
      "考官更认可具体化的时间状语（in recent decades / over the past twenty years），它同时服务于词汇项和任务回应项——表明你意识到问题的时代背景。",
  },
  {
    id: "up_big",
    pattern: /\b(big|huge)\b/gi,
    replacement: "substantial",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「big / huge」语义宽泛，在学术语境中缺乏精确度。",
    examinerNote:
      "词汇项的高分要求「precise word choice」。用 substantial / considerable / pronounced 替代宽泛的 big，能让程度描述更精确；描述增长时还可直接用 sharp / marked。",
  },
  {
    id: "up_good",
    pattern: /\bgood\b(?!s)/gi,
    replacement: "beneficial",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「good」是最泛化的褒义形容词，无法体现具体的正面属性。",
    examinerNote:
      "考官期待看到对「好」的具体化：beneficial（有益）、advantageous（有利）、constructive（建设性）、conducive to（有助于）。笼统的 good 通常被判定为词汇量不足。",
  },
  {
    id: "up_bad",
    pattern: /\bbad\b/gi,
    replacement: "detrimental",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「bad」在书面学术语域中过于口语化且笼统。",
    examinerNote:
      "学术写作需要区分「有害」的程度与方向：detrimental to（不利）、adverse（负面）、counterproductive（适得其反）。这类搭配的准确使用是 LR 7 分的信号。",
  },
  {
    id: "up_things",
    pattern: /\bthings?\b/gi,
    replacement: "factors",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "high",
    lift: 0.5,
    reason: "「thing(s)」是英语中最空的实词，无法传递任何具体信息。",
    examinerNote:
      "考官会把 thing(s) 视为词汇匮乏的标志性信号。请替换为具体名词：factors / aspects / elements / considerations / implications，视语境而定。",
  },
  {
    id: "up_get",
    pattern: /\bget(s|ting)?\b/gi,
    replacement: "obtain",
    dimension: "LR",
    tag: "register",
    severity: "medium",
    lift: 0.5,
    reason: "「get」是多义口语动词，在学术写作中语义模糊。",
    examinerNote:
      "书面语中 get 应根据语境拆分为 obtain（获得）、receive（收到）、become（变得）、derive（取得）。考官在词汇项上看重这种一词多义的精确拆分。",
  },
  {
    id: "up_a_lot_better",
    pattern: /\bmuch better\b/gi,
    replacement: "considerably more effective",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "程度副词 + 泛化形容词的组合信息量偏低。",
    examinerNote:
      "用 considerably / markedly + 具体形容词，能同时展示副词搭配与精确用词两项能力。",
  },
  {
    id: "up_very_important",
    pattern: /\bvery important\b/gi,
    replacement: "crucial",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「very + 形容词」在学术写作中被视为弱搭配，学界普遍偏好单一强形容词。",
    examinerNote:
      "考官偏好强形容词本身（crucial / vital / pivotal / imperative），而不是用 very 加强。这是学术搭配的成熟度标志。",
  },
  {
    id: "up_very",
    pattern: /\bvery\s+(?=[a-z])/gi,
    replacement: "highly ",
    dimension: "LR",
    tag: "register",
    severity: "low",
    lift: 0.25,
    reason: "「very」在学术写作中使用频率过高，属于典型的弱修饰语。",
    examinerNote:
      "学术语域倾向用 highly / considerably / markedly / substantially 等更精确的程度副词。若整篇 very 出现三次以上，考官会判定为词汇手段单一。",
  },
  {
    id: "up_pay_attention",
    pattern: /\bpay(s|ing)? attention to\b/gi,
    replacement: "attach importance to",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「pay attention to」偏日常用语，在政策类论述中不够正式。",
    examinerNote:
      "政策与教育话题中，考官更认可 attach importance to / give priority to / place emphasis on 这类书面搭配。",
  },
  {
    id: "up_play_role",
    pattern: /\bplay(s|ed|ing)? an important role\b/gi,
    replacement: "play a pivotal role",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "medium",
    lift: 0.5,
    reason: "「play an important role」是使用过度的高频套话，且 important 信息量低。",
    examinerNote:
      "该短语常与模板句式一起出现，容易触发考官的「背诵痕迹」判断。改为 play a pivotal / decisive / instrumental role 可保留搭配优势又摆脱套话感。",
  },
  {
    id: "up_in_my_opinion",
    pattern: /\bin my opinion\b/gi,
    replacement: "From my perspective",
    dimension: "LR",
    tag: "register",
    severity: "low",
    lift: 0.25,
    reason: "「in my opinion」是最常见的立场引入方式，缺乏区分度。",
    examinerNote:
      "考官不会因这一个短语加分，但句式上的变化（From my perspective / I would argue that / It seems to me that）能体现语言手段的丰富性。",
  },
  {
    id: "up_i_think",
    pattern: /\bI think\b/g,
    replacement: "I would argue that",
    dimension: "LR",
    tag: "register",
    severity: "low",
    lift: 0.25,
    reason: "「I think」语气偏弱，学术论述更倾向使用明确的主张动词。",
    examinerNote:
      "议论文需要清晰立场。I would argue that / I am convinced that 比 I think 更能体现论断力度，也让立场句更容易被考官识别。",
  },
  {
    id: "up_help",
    pattern: /\bhelp(s|ed|ing)?\b/gi,
    replacement: "facilitate",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「help」语义泛化，且搭配上不如学术动词精确。",
    examinerNote:
      "学术写作偏好 facilitate（促进）、contribute to（有助于）、enable（使能够）、foster（培养）。这类动词自带搭配要求，能一并体现语法准确度。",
  },
  {
    id: "up_use",
    pattern: /\buse(s|d)?\s+(it|them|this|that|these|those)\b/gi,
    replacement: "employ it",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「use」在学术语篇中重复率过高时显得词汇贫乏。",
    examinerNote:
      "同义替换是词汇项的明确评分点：employ / utilise / apply / adopt 可交替使用，避免同一动词在文中反复出现。",
  },
  {
    id: "up_show",
    pattern: /\bshow(s|ed|ing)?\b/gi,
    replacement: "demonstrate",
    dimension: "LR",
    tag: "academic_collocation",
    severity: "low",
    lift: 0.25,
    reason: "「show」为通用动词，图表描述与论证中均可用更精确的动词。",
    examinerNote:
      "雅思 Task 1 尤其需要动词变化：illustrate / depict / indicate / reveal。考官会统计你是否对同类信息使用了不同的描述动词。",
  },
  {
    id: "up_so_that",
    pattern: /\bso\s+that\b/gi,
    replacement: "thereby",
    dimension: "GRA",
    tag: "sentence_variety",
    severity: "low",
    lift: 0.5,
    reason: "「so that」引导的目的状语从句结构较简单，且使用频繁会显得句式单薄。",
    examinerNote:
      "改为分词 + thereby 结构（…, thereby reducing costs）可将两个简单句压缩为一个复杂句，同时提升语法项与连贯项的表现。",
  },
  {
    id: "up_and_and",
    pattern: /\band\s+also\b/gi,
    replacement: "and",
    dimension: "LR",
    tag: "concision",
    severity: "low",
    lift: 0.25,
    reason: "「and also」语义重复，是两个并列连词的冗余叠加。",
    examinerNote:
      "冗余表达会在准确性上留下负面印象。学术写作讲求经济性，删去重复成分本身就是一个可展示的语言能力。",
  },
  {
    id: "up_etc",
    pattern: /\betc\.?\b/gi,
    replacement: "and other comparable items",
    dimension: "LR",
    tag: "register",
    severity: "medium",
    lift: 0.25,
    reason: "「etc.」在正式学术写作中通常被视为避重就轻，且暗示作者无法给出具体例子。",
    examinerNote:
      "考官在任务回应项上要求「具体例证」。用 etc. 收尾常被判定为展开不足。改为明确列举两项以上具体内容，或直接用 such as 引导。",
  },
  {
    id: "up_e_g",
    pattern: /\be\.g\./gi,
    replacement: "for instance",
    dimension: "LR",
    tag: "register",
    severity: "low",
    lift: 0.25,
    reason: "缩写在学术作文中不如完整形式正式。",
    examinerNote:
      "书面学术语域倾向于拼写完整的连接语：for instance / for example。缩写更适合脚注与参考文献。",
  },
  {
    id: "up_kids",
    pattern: /\bkids\b/gi,
    replacement: "children",
    dimension: "LR",
    tag: "register",
    severity: "high",
    lift: 0.5,
    reason: "「kids」是口语词，在学术作文中属于明显的语域失误。",
    examinerNote:
      "语域错误会直接影响词汇项评分。教育话题应使用 children / pupils / adolescents / young learners，并按年龄段精确选择。",
  },
  {
    id: "up_stuff",
    pattern: /\bstuff\b/gi,
    replacement: "materials",
    dimension: "LR",
    tag: "register",
    severity: "high",
    lift: 0.5,
    reason: "「stuff」是不可数口语词，含义完全依赖语境，学术写作中禁用。",
    examinerNote:
      "这类词会被考官直接归入口语化表达，拉低词汇项档次。需要按语境替换为 materials / resources / content。",
  },
  {
    id: "up_so_at_start",
    pattern: /(^|(?<=[.!?]\s))So,\s+/g,
    replacement: "Therefore, ",
    dimension: "CC",
    tag: "cohesion",
    severity: "medium",
    lift: 0.5,
    reason: "句首「So,」是口语化的推论标记，学术语篇中应使用正式衔接词。",
    examinerNote:
      "连贯与衔接项考察衔接手段是否恰当。Therefore / Consequently / As a result 是学术推论的标准表达，So 会被判定为语域不当。",
  },
  {
    id: "up_but_start",
    pattern: /(^|(?<=[.!?]\s))But\s+/g,
    replacement: "However, ",
    dimension: "CC",
    tag: "cohesion",
    severity: "medium",
    lift: 0.5,
    reason: "句首用「But」属于口语化的转折方式，且缺少必要的逗号停顿。",
    examinerNote:
      "However / Nevertheless / By contrast 是学术转折的标准衔接词。考官会统计你的转折手段是否单一——通篇只用 but 会限制 CC 的分数上限。",
  },
  {
    id: "up_and_start",
    pattern: /(^|(?<=[.!?]\s))And\s+/g,
    replacement: "Moreover, ",
    dimension: "CC",
    tag: "cohesion",
    severity: "medium",
    lift: 0.5,
    reason: "用「And」开头是对前句的简单追加，没有体现学术论证的递进关系。",
    examinerNote:
      "衔接项要求句子之间呈现清晰的逻辑关系（递进、因果、对比、举例）。Moreover / In addition / Furthermore 能明确标记递进，而 And 会让逻辑关系变得模糊。",
  },
  {
    id: "up_besides",
    pattern: /(^|(?<=[.!?]\s))Besides,\s+/g,
    replacement: "Furthermore, ",
    dimension: "CC",
    tag: "cohesion",
    severity: "low",
    lift: 0.25,
    reason: "句首「Besides,」在正式英语中偏口语，常用作「况且」的口吻。",
    examinerNote:
      "学术写作中追加论点应使用 Furthermore / In addition / What is more。Besides 更常见于口语会话。",
  },
  {
    id: "up_in_a_word",
    pattern: /\bIn a word,?\b/gi,
    replacement: "In conclusion,",
    dimension: "CC",
    tag: "template",
    severity: "medium",
    lift: 0.5,
    reason: "「In a word」是中式英语式的总结语，英语母语者几乎不这样开启结论段。",
    examinerNote:
      "这类中式表达会让考官意识到考生在套用中文写作结构。结论段应使用 In conclusion / To conclude / On balance 等标准表达。",
  },
  {
    id: "up_last_but_not_least",
    pattern: /\bLast but not least,?\b/gi,
    replacement: "Finally,",
    dimension: "CC",
    tag: "template",
    severity: "medium",
    lift: 0.25,
    reason: "「Last but not least」在学术写作中过于随意，且被大量模板使用。",
    examinerNote:
      "该短语高频出现在备考模板中，考官容易将其判定为背诵痕迹。改用 Finally / Ultimately 更稳妥。",
  },
  {
    id: "up_firstly_secondly",
    pattern: /\b(Firstly|Secondly|Thirdly),?\b/gi,
    replacement: "First",
    dimension: "CC",
    tag: "template",
    severity: "low",
    lift: 0.25,
    reason: "Firstly / Secondly 是最基础的列举方式，机械使用会显得衔接手段单一。",
    examinerNote:
      "CC 7 分要求衔接手段多样。可交替使用 First and foremost / A further consideration is / Equally important 等方式，避免整篇都是序数词。",
  },
  {
    id: "up_there_is_no_doubt",
    pattern: /\bThere is no doubt that\b/gi,
    replacement: "It is evident that",
    dimension: "TR",
    tag: "template",
    severity: "medium",
    lift: 0.25,
    reason: "「There is no doubt that」语气绝对，学术论证中难以成立，且是模板高频句。",
    examinerNote:
      "考官在任务回应项上偏好有条件的论断（It is evident that / Evidence suggests that），绝对化的断言反而暴露论证不足。",
  },
  {
    id: "up_as_we_all_know",
    pattern: /\bAs we all know,?\b/gi,
    replacement: "It is widely recognised that",
    dimension: "TR",
    tag: "template",
    severity: "high",
    lift: 0.5,
    reason: "「As we all know」诉诸常识而非证据，且是典型模板开头。",
    examinerNote:
      "学术论证需要引证或推理，而非诉诸共识。考官会将此类表达视为论证缺位的信号。",
  },
  {
    id: "up_with_development",
    pattern: /\bWith the (rapid )?development of (society|the society|modern society|technology)\b/gi,
    replacement: "As societies have become increasingly interconnected",
    dimension: "CC",
    tag: "template",
    severity: "high",
    lift: 0.5,
    reason: "这是中国考生使用频率最高的万能开头，几乎所有考官都将其识别为模板句。",
    examinerNote:
      "模板句在雅思中不会被直接扣分，但会占用开头段字数却没有任何实质内容，导致任务回应项难以进入 7 分。考官需要看到与本题直接相关的背景定位。",
  },
  {
    id: "up_every_coin",
    pattern: /\bEvery coin has two sides\b/gi,
    replacement: "The issue presents both opportunities and risks",
    dimension: "CC",
    tag: "template",
    severity: "high",
    lift: 0.5,
    reason: "「Every coin has two sides」是被考官反复标记的模板谚语。",
    examinerNote:
      "该表达不提供任何与题目相关的信息，属于纯粹的填充。考官在任务回应项上会因此判断开头段没有完成「引入话题 + 表明立场」的功能。",
  },
  {
    id: "up_from_what_discussed",
    pattern: /\bFrom what has been discussed above\b/gi,
    replacement: "On balance",
    dimension: "CC",
    tag: "template",
    severity: "medium",
    lift: 0.25,
    reason: "该过渡句是结论段最常见的模板开头之一。",
    examinerNote:
      "考官期待结论段能综合前文并给出明确立场，而非机械重复「如上所述」。用 On balance / Taking these factors together 更自然。",
  },
  {
    id: "up_cannot_be_denied",
    pattern: /\bIt cannot be denied that\b/gi,
    replacement: "It is difficult to dispute that",
    dimension: "TR",
    tag: "template",
    severity: "low",
    lift: 0.25,
    reason: "该句式出现频率极高，属于常见备考模板。",
    examinerNote:
      "同一类表达在考官眼中已高度模板化。替换为带有程度限定的表述能体现更强的论证意识。",
  },
  {
    id: "up_increasingly_important",
    pattern: /\bplay(s|ed)? an increasingly important role\b/gi,
    replacement: "have become central to",
    dimension: "LR",
    tag: "template",
    severity: "medium",
    lift: 0.25,
    reason: "「play an increasingly important role」是模板句的高频组成部分。",
    examinerNote:
      "该搭配本身并无错误，但因过度使用而失去区分度。改为 have become central to / are now integral to 更具体且不易被判定为模板。",
  },
];

/* ------------------------------------------------------------------ *
 * 2. 反模板检测：命中即给出「为什么考官反感」
 * ------------------------------------------------------------------ */

export interface TemplatePattern {
  id: string;
  pattern: RegExp;
  category: string;
  reason: string;
  suggestion: string;
  penalty: number;
}

export const TEMPLATE_PATTERNS: TemplatePattern[] = [
  {
    id: "tpl_dev_society",
    pattern: /\bwith the (rapid )?(development|advancement|progress) of (society|the society|modern society|technology|the economy)\b/i,
    category: "万能开头",
    reason:
      "与题目无关的空洞背景句。考官需要的是对本题背景的定位，而不是放之四海皆准的时代概述。",
    suggestion:
      "删掉，直接切入本题的核心矛盾。例如改写为「The cost of higher education has risen faster than median wages, which has reopened the question of who should pay.」",
    penalty: 0.5,
  },
  {
    id: "tpl_coin",
    pattern: /\bevery coin has two sides\b/i,
    category: "谚语套话",
    reason: "谚语不承担论证功能，且是考官最容易识别的背诵痕迹之一。",
    suggestion: "删除该句，改为直接陈述本题存在的两种对立立场。",
    penalty: 0.5,
  },
  {
    id: "tpl_widely_believed",
    pattern: /\bit is widely (believed|known|accepted|acknowledged) that\b/i,
    category: "空泛引入",
    reason: "「widely believed」既未说明谁相信，也无任何证据支撑，属于无效论证。",
    suggestion:
      "改为给出具体来源或条件的表述：Evidence from OECD data suggests that…",
    penalty: 0.25,
  },
  {
    id: "tpl_as_we_all_know",
    pattern: /\bas we all know\b/i,
    category: "诉诸常识",
    reason: "学术论证不能建立在「大家都知道」之上，这是逻辑上的诉诸共识谬误。",
    suggestion: "删除，或替换为 It is widely recognised that + 具体现象。",
    penalty: 0.5,
  },
  {
    id: "tpl_has_both_advantages",
    pattern: /\bhas both advantages and disadvantages\b/i,
    category: "两分法套话",
    reason:
      "只是重复题目本身，没有给出任何立场或分析，属于典型的字数填充。",
    suggestion: "删除该句，在开头段直接给出你的倾向性立场。",
    penalty: 0.5,
  },
  {
    id: "tpl_last_but_not_least",
    pattern: /\blast but not least\b/i,
    category: "模板衔接",
    reason: "过度使用的模板衔接语，考官会将其计入背诵痕迹。",
    suggestion: "改为 Finally / Ultimately / A final consideration is…",
    penalty: 0.25,
  },
  {
    id: "tpl_in_a_word",
    pattern: /\bin a word\b/i,
    category: "中式总结",
    reason: "中式英语式的总结表达，英语母语者极少在书面论证中使用。",
    suggestion: "改为 In conclusion / To conclude / On balance。",
    penalty: 0.5,
  },
  {
    id: "tpl_from_above",
    pattern: /\bfrom what has been discussed above\b/i,
    category: "模板过渡",
    reason: "机械重复前文，没有综合出新的判断。",
    suggestion:
      "改为对前文的实质综合：Taken together, these factors suggest that…",
    penalty: 0.25,
  },
  {
    id: "tpl_no_denying",
    pattern: /\bthere is no denying that\b/i,
    category: "绝对化套话",
    reason: "绝对化断言缺乏条件限定，在学术论证中难以成立。",
    suggestion: "改为 It is difficult to dispute that / There is strong evidence that…",
    penalty: 0.25,
  },
  {
    id: "tpl_firstly_secondly",
    pattern: /\bfirstly\b[\s\S]{0,400}?\bsecondly\b/i,
    category: "机械列举",
    reason: "Firstly / Secondly 的机械组合是最基础的衔接方式，无法体现衔接手段的多样性。",
    suggestion:
      "至少替换一处：First and foremost / A further consideration / Equally important is that…",
    penalty: 0.25,
  },
  {
    id: "tpl_it_is_important",
    pattern: /\bit is (very )?important (to|for)\b/i,
    category: "空泛价值判断",
    reason: "只说「重要」而不说明对谁重要、如何重要，论证停留在表面。",
    suggestion: "补充具体作用对象与机制：This matters for employers because…",
    penalty: 0.25,
  },
  {
    id: "tpl_play_role",
    pattern: /\bplay(s|ed)? an (increasingly )?(important|significant|vital) role\b/i,
    category: "高频套话",
    reason: "该搭配本身正确，但因过度使用而失去区分度。",
    suggestion: "改为 be central to / be integral to / underpin 等更具体的表达。",
    penalty: 0.25,
  },
  {
    id: "tpl_only_way",
    pattern: /\bthe only way to\b/i,
    category: "绝对化论断",
    reason: "「唯一方法」这类绝对化表述几乎无法论证成功。",
    suggestion:
      "改为限制性表述：one of the most effective ways to / a necessary step towards…",
    penalty: 0.25,
  },
];

/* ------------------------------------------------------------------ *
 * 3. 衔接词库（按功能分类，用于统计衔接手段的多样性）
 * ------------------------------------------------------------------ */

export const LINKERS: Record<string, string[]> = {
  递进: [
    "furthermore",
    "moreover",
    "in addition",
    "additionally",
    "what is more",
    "besides",
    "equally important",
    "not only",
    "also",
  ],
  转折: [
    "however",
    "nevertheless",
    "nonetheless",
    "on the other hand",
    "by contrast",
    "in contrast",
    "conversely",
    "whereas",
    "while",
    "although",
    "even though",
    "though",
    "despite",
    "in spite of",
    "yet",
  ],
  因果: [
    "therefore",
    "consequently",
    "as a result",
    "thus",
    "hence",
    "because",
    "since",
    "due to",
    "owing to",
    "leads to",
    "results in",
    "gives rise to",
    "for this reason",
  ],
  举例: [
    "for example",
    "for instance",
    "such as",
    "to illustrate",
    "namely",
    "a case in point",
    "in particular",
    "specifically",
  ],
  顺序: [
    "first",
    "firstly",
    "first and foremost",
    "second",
    "secondly",
    "third",
    "finally",
    "ultimately",
    "subsequently",
    "initially",
    "to begin with",
  ],
  总结: [
    "in conclusion",
    "to conclude",
    "on balance",
    "to sum up",
    "in summary",
    "overall",
    "taken together",
    "all things considered",
  ],
  条件让步: [
    "provided that",
    "unless",
    "if",
    "in the event that",
    "should",
    "even if",
    "granted that",
  ],
};

/** 口语化 / 不正式表达 */
export const INFORMAL_MARKERS: { pattern: RegExp; formal: string }[] = [
  { pattern: /\breally\b/gi, formal: "genuinely / markedly" },
  { pattern: /\ba bit\b/gi, formal: "slightly / marginally" },
  { pattern: /\bkind of\b|\bsort of\b/gi, formal: "somewhat" },
  { pattern: /\bguys\b/gi, formal: "individuals" },
  { pattern: /\bstuff\b/gi, formal: "material / resources" },
  { pattern: /\bwanna\b|\bgonna\b/gi, formal: "want to / going to" },
  { pattern: /\bokay\b|\bok\b/gi, formal: "acceptable / satisfactory" },
  { pattern: /\bfun\b/gi, formal: "enjoyable / engaging" },
  { pattern: /\btotally\b/gi, formal: "entirely" },
  { pattern: /\bhuge\b/gi, formal: "substantial" },
  { pattern: /\ba little\b/gi, formal: "marginally" },
  { pattern: /\btoo much\b/gi, formal: "excessive" },
];

/** 学术词表（AWL 高频子集）。命中即视为词汇项加分信号。 */
export const AWL_WORDS = new Set([
  "analyse", "analysis", "approach", "area", "assess", "assume", "authority",
  "available", "benefit", "concept", "consist", "constitute", "context",
  "contract", "create", "data", "define", "derive", "distribute", "economy",
  "environment", "establish", "estimate", "evident", "export", "factor",
  "finance", "formula", "function", "identify", "income", "indicate",
  "individual", "interpret", "involve", "issue", "labour", "legal",
  "legislate", "major", "method", "occur", "percent", "period", "policy",
  "principle", "proceed", "process", "require", "research", "respond",
  "role", "sector", "significant", "similar", "source", "specific",
  "structure", "theory", "vary", "achieve", "acquire", "administrate",
  "affect", "appropriate", "aspect", "assist", "category", "chapter",
  "commission", "community", "complex", "compute", "conclude", "conduct",
  "consequence", "construct", "consume", "credit", "culture", "design",
  "distinct", "element", "equate", "evaluate", "feature", "final",
  "focus", "impact", "injure", "institute", "invest", "item", "journal",
  "maintain", "normal", "obtain", "participate", "perceive", "positive",
  "potential", "previous", "primary", "purchase", "range", "region",
  "regulate", "relevant", "reside", "resource", "restrict", "secure",
  "seek", "select", "site", "strategy", "survey", "text", "tradition",
  "transfer", "alternative", "circumstance", "comment", "compensate",
  "component", "consent", "considerable", "constant", "constrain",
  "contribute", "convene", "coordinate", "core", "corporate",
  "correspond", "criteria", "deduce", "demonstrate", "document",
  "dominate", "emphasis", "ensure", "exclude", "framework", "fund",
  "illustrate", "immigrate", "imply", "initial", "instance", "interact",
  "justify", "layer", "link", "locate", "maximise", "minor", "negate",
  "outcome", "partner", "philosophy", "physical", "proportion", "publish",
  "react", "register", "rely", "remove", "scheme", "sequence", "sex",
  "shift", "specify", "sufficient", "task", "technical", "technique",
  "technology", "valid", "volume", "access", "adequate", "annual",
  "apparent", "approximate", "attitude", "attribute", "civil", "code",
  "commit", "communicate", "concentrate", "confer", "contrast", "cycle",
  "debate", "despite", "dimension", "domestic", "emerge", "error",
  "ethnic", "goal", "grant", "hence", "hypothesis", "implement",
  "implicate", "impose", "integrate", "internal", "investigate", "job",
  "label", "mechanism", "obvious", "occupy", "option", "output",
  "overall", "parallel", "parameter", "phase", "predict", "principal",
  "prior", "professional", "project", "promote", "regime", "resolve",
  "retain", "series", "statistic", "status", "stress", "subsequent",
  "sum", "summary", "undertake", "academy", "adjust", "alter", "amend",
  "aware", "capacity", "challenge", "clause", "compound", "conflict",
  "consult", "contact", "decline", "discrete", "draft", "enable",
  "energy", "enforce", "entity", "equivalent", "evolve", "expand",
  "expose", "external", "facilitate", "fundamental", "generate",
  "generation", "image", "liberal", "licence", "logic", "margin",
  "medical", "mental", "modify", "monitor", "network", "notion",
  "objective", "orient", "perspective", "precise", "prime",
  "psychology", "pursue", "ratio", "reject", "revenue", "stable",
  "style", "substitute", "sustain", "symbol", "target", "transit",
  "trend", "version", "welfare", "whereas",
]);

/* ------------------------------------------------------------------ *
 * 4. 话题核心词伙：检测题目属于哪个话题，推荐该话题的考官偏好表达
 * ------------------------------------------------------------------ */

export interface Topic {
  id: string;
  label: string;
  triggers: RegExp;
  /** 话题核心词伙，附中文解释，说明为什么这些表达更对考官胃口 */
  phrases: { term: string; gloss: string }[];
}

export const TOPICS: Topic[] = [
  {
    id: "education",
    label: "教育",
    triggers:
      /\b(education|school|student|pupil|teacher|university|curricul|learn|study|exam|tuition|academic|literacy|classroom)\w*/i,
    phrases: [
      { term: "academic attainment", gloss: "学业成就，比 school grades 更书面" },
      { term: "critical thinking skills", gloss: "批判性思维，教育类必备用语" },
      { term: "vocational training", gloss: "职业培训，讨论分流教育时使用" },
      { term: "rote learning", gloss: "死记硬背，描述应试教育弊端" },
      { term: "lifelong learning", gloss: "终身学习，讨论成人教育" },
      { term: "curriculum design", gloss: "课程设计，讨论教学改革" },
      { term: "equal access to education", gloss: "教育机会均等，讨论公平议题" },
      { term: "extracurricular activities", gloss: "课外活动，讨论全面发展" },
    ],
  },
  {
    id: "environment",
    label: "环境",
    triggers:
      /\b(environment|climate|pollut|emission|carbon|energy|recycl|sustainab|fossil|global warming|waste|green|ecolog)\w*/i,
    phrases: [
      { term: "carbon footprint", gloss: "碳足迹，个人减排话题的标准用语" },
      { term: "renewable energy sources", gloss: "可再生能源，能源政策题必用" },
      { term: "fossil fuel dependency", gloss: "化石燃料依赖，能源转型论述核心" },
      { term: "sustainable development", gloss: "可持续发展，官方文件高频词" },
      { term: "greenhouse gas emissions", gloss: "温室气体排放，需用复数" },
      { term: "biodiversity loss", gloss: "生物多样性丧失，生态类话题" },
      { term: "environmental degradation", gloss: "环境退化，学术语域" },
      { term: "carbon-neutral", gloss: "碳中和的，用于描述政策目标" },
    ],
  },
  {
    id: "technology",
    label: "科技",
    triggers:
      /\b(technolog|internet|computer|online|digital|social media|artificial intelligence|robot|automat|smartphone|device|data)\w*/i,
    phrases: [
      { term: "digital literacy", gloss: "数字素养，教育+科技交叉话题" },
      { term: "technological advancement", gloss: "技术进步，比 new technology 更学术" },
      { term: "data privacy", gloss: "数据隐私，科技伦理题核心" },
      { term: "algorithmic decision-making", gloss: "算法决策，讨论 AI 伦理" },
      { term: "screen time", gloss: "屏幕使用时间，青少年健康话题" },
      { term: "the digital divide", gloss: "数字鸿沟，讨论技术不平等" },
      { term: "automation of labour", gloss: "劳动自动化，就业话题必用" },
      { term: "cyberbullying", gloss: "网络霸凌，社交媒体负面影响" },
    ],
  },
  {
    id: "health",
    label: "健康",
    triggers:
      /\b(health|diet|obes|exercise|medic|hospital|disease|mental|smoking|alcohol|sport|nutrition|wellbeing|well-being)\w*/i,
    phrases: [
      { term: "sedentary lifestyle", gloss: "久坐不动的生活方式，肥胖话题核心" },
      { term: "preventive healthcare", gloss: "预防性医疗，与 treatment 形成对比" },
      { term: "public health expenditure", gloss: "公共卫生支出，政策类论述" },
      { term: "mental wellbeing", gloss: "心理健康，注意用 wellbeing 而非 health" },
      { term: "obesity rates", gloss: "肥胖率，需要用复数形式" },
      { term: "a balanced diet", gloss: "均衡饮食，注意搭配介词" },
      { term: "life expectancy", gloss: "预期寿命，衡量健康水平的指标" },
      { term: "chronic illness", gloss: "慢性病，讨论医疗负担" },
    ],
  },
  {
    id: "work",
    label: "工作与就业",
    triggers:
      /\b(work|job|employ|career|salary|wage|office|profession|labour|labor|retire|unemploy|workplace)\w*/i,
    phrases: [
      { term: "work-life balance", gloss: "工作与生活平衡，职场话题必用" },
      { term: "career progression", gloss: "职业晋升，比 promotion 更学术" },
      { term: "job satisfaction", gloss: "工作满意度，讨论非物质激励" },
      { term: "remote working arrangements", gloss: "远程办公安排，后疫情时代话题" },
      { term: "the labour market", gloss: "劳动力市场，注意英式拼写 labour" },
      { term: "job security", gloss: "工作保障，讨论自动化冲击" },
      { term: "employee turnover", gloss: "员工流失率，管理学标准术语" },
      { term: "professional development", gloss: "职业发展，培训类话题" },
    ],
  },
  {
    id: "society",
    label: "社会",
    triggers:
      /\b(societ|poverty|inequal|urban|rural|populat|immigrat|commun|crime|welfare|homeless|aging|ageing)\w*/i,
    phrases: [
      { term: "social cohesion", gloss: "社会凝聚力，讨论社区与融合" },
      { term: "income inequality", gloss: "收入不平等，经济学标准表达" },
      { term: "social mobility", gloss: "社会流动性，讨论阶层固化" },
      { term: "an ageing population", gloss: "人口老龄化，注意 ageing 拼写" },
      { term: "urbanisation", gloss: "城市化，描述人口迁移趋势" },
      { term: "the welfare state", gloss: "福利国家，政策类核心概念" },
      { term: "social safety net", gloss: "社会保障网，讨论贫困救济" },
      { term: "demographic shift", gloss: "人口结构变化，宏观趋势描述" },
    ],
  },
  {
    id: "crime",
    label: "犯罪与法律",
    triggers:
      /\b(crime|criminal|prison|law|legal|punish|offend|police|court|justice|rehabilitat)\w*/i,
    phrases: [
      { term: "deterrent effect", gloss: "威慑作用，讨论刑罚功能" },
      { term: "rehabilitation programmes", gloss: "改造项目，与 punishment 对比" },
      { term: "recidivism rates", gloss: "再犯率，衡量刑罚效果的关键指标" },
      { term: "law enforcement agencies", gloss: "执法机构，注意用复数" },
      { term: "juvenile delinquency", gloss: "青少年犯罪，学术标准表达" },
      { term: "restorative justice", gloss: "恢复性司法，替代性惩罚方案" },
      { term: "custodial sentence", gloss: "监禁刑，比 prison sentence 正式" },
    ],
  },
  {
    id: "culture",
    label: "文化与全球化",
    triggers:
      /\b(cultur|heritage|tradition|globalis|globaliz|language|tourism|museum|identity|art|music)\w*/i,
    phrases: [
      { term: "cultural heritage", gloss: "文化遗产，保护类话题核心" },
      { term: "cultural identity", gloss: "文化认同，讨论全球化冲击" },
      { term: "cultural homogenisation", gloss: "文化同质化，批评全球化的标准术语" },
      { term: "intangible heritage", gloss: "非物质遗产，UNESCO 官方用语" },
      { term: "cross-cultural communication", gloss: "跨文化交际，语言学习话题" },
      { term: "linguistic diversity", gloss: "语言多样性，濒危语言话题" },
      { term: "heritage conservation", gloss: "遗产保护，注意搭配" },
    ],
  },
  {
    id: "government",
    label: "政府与公共政策",
    triggers:
      /\b(government|tax|taxpayer|public spending|subsidis|subsidiz|policy|state|fund|invest|budget|infrastructure|transport)\w*/i,
    phrases: [
      { term: "public expenditure", gloss: "公共支出，比 government spending 正式" },
      { term: "allocate resources", gloss: "分配资源，政策优先级讨论" },
      { term: "subsidise", gloss: "补贴（动词），注意英式拼写 -ise" },
      { term: "fiscal policy", gloss: "财政政策，宏观经济话题" },
      { term: "public infrastructure", gloss: "公共基础设施，建设类话题" },
      { term: "cost-effective", gloss: "成本效益高的，评估政策时使用" },
      { term: "return on investment", gloss: "投资回报，讨论公共项目收益" },
      { term: "regulatory framework", gloss: "监管框架，法律与政策话题" },
    ],
  },
  {
    id: "media",
    label: "媒体与信息",
    triggers:
      /\b(media|news|journal|advertis|broadcast|press|report|information|misinformation|fake)\w*/i,
    phrases: [
      { term: "media coverage", gloss: "媒体报道，中性学术表达" },
      { term: "misinformation", gloss: "错误信息（非故意），区别于 disinformation" },
      { term: "editorial independence", gloss: "编辑独立性，讨论新闻自由" },
      { term: "consumerism", gloss: "消费主义，批评广告的标准术语" },
      { term: "targeted advertising", gloss: "定向广告，数据伦理话题" },
      { term: "public discourse", gloss: "公共讨论，媒体作用论述" },
      { term: "information literacy", gloss: "信息素养，辨伪能力" },
    ],
  },
];

export function detectTopics(prompt: string, essay: string): Topic[] {
  const text = `${prompt} ${essay}`;
  const scored = TOPICS.map((t) => {
    const hits = text.match(new RegExp(t.triggers.source, "gi"));
    return { topic: t, score: hits ? hits.length : 0 };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.topic);
}

/* ------------------------------------------------------------------ *
 * 5. 中式英语 / 语法错误规则
 * ------------------------------------------------------------------ */

export interface GrammarRule {
  id: string;
  pattern: RegExp;
  replacement?: string;
  message: string;
  fixNote: string;
  severity: Severity;
  dimension: DimensionId;
  lift: number;
}

export const GRAMMAR_RULES: GrammarRule[] = [
  {
    id: "gr_although_but",
    pattern: /\bAlthough\b[^.!?]{0,120}?,\s*but\b/gi,
    replacement: "Although",
    message: "although 与 but 不能同时出现在同一个句子中，这是中文「虽然…但是…」的直译。",
    fixNote:
      "英语中 although 本身已表达让步，主句不能再加 but。保留 although 并删去 but 即可；若想强调转折，可改成 Although…, the opposite is true。",
    severity: "high",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_because_so",
    pattern: /\bBecause\b[^.!?]{0,120}?,\s*so\b/gi,
    replacement: "Because",
    message: "because 与 so 不可连用，这是中文「因为…所以…」的直接迁移。",
    fixNote:
      "英语中 because 引导原因状语从句，主句本身已隐含结果，不能再用 so。删掉 so，或用 Because…, therefore… 的正式组合（但 then 需另起一句）。",
    severity: "high",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_a_an",
    pattern: /\ba\s+(?=[aeiou])[a-z]+/gi,
    message: "不定冠词 a 用于辅音音素前，元音音素前应使用 an。",
    fixNote:
      "冠词错误是考官判定语法准确度的常见依据。注意判断依据是发音而非拼写：a university（/j/ 起始）正确，an hour 正确。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_many_information",
    pattern: /\b(many|few|a few|number of)\s+(information|advice|knowledge|research|equipment|evidence|money|work|progress|furniture|news)\b/gi,
    message: "不可数名词不能与 many / few 等可数限定词搭配。",
    fixNote:
      "这类名词（information, advice, knowledge, research, evidence）在英语中不可数。应改用 much / little / a great deal of / a substantial amount of，或使用 a piece of information 这类量词结构。",
    severity: "high",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_much_people",
    pattern: /\b(much|less|a little)\s+(people|students|children|persons|jobs|problems|reasons|factors)\b/gi,
    message: "可数名词复数不能与 much / less 搭配。",
    fixNote:
      "可数名词复数应用 many / fewer / a few。特别注意 less 与 fewer 的区分：less money（不可数）但 fewer jobs（可数），这是考官敏感的高频错误点。",
    severity: "high",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_people_is",
    pattern: /\b(people|children|students|they|we)\s+(is|was|has)\b/gi,
    message: "主语与谓语单复数不一致（subject-verb agreement）。",
    fixNote:
      "复数主语需要复数谓语。这类错误在语法项中属于「基础错误」，出现两次以上会明显限制分数上限。",
    severity: "high",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_i_lowercase",
    pattern: /(?:^|[.!?]\s+)i\b/g,
    message: "第一人称代词 I 必须大写。",
    fixNote: "这是英文书写的基本规范，机械性错误会直接影响考官对准确度的整体印象。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_double_space",
    pattern: /\S {2,}\S/g,
    message: "存在连续空格。",
    fixNote: "排版细节会影响书面印象，正式写作中应保持单空格。",
    severity: "low",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_space_before_punct",
    pattern: /\s+[,.;:!?]/g,
    message: "标点前出现了多余空格。",
    fixNote: "英语标点紧跟前面的词，不加空格，标点后加一个空格。",
    severity: "low",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_there_is_are",
    pattern: /\bThere (is|are)\b/gi,
    message: "「There is/are」句式使用较频繁，属于低信息密度的结构。",
    fixNote:
      "过度使用 There be 句式会让句子显得松散。可改为实义主语句式：There are many reasons… → Several factors account for…，同时提升语法项与词汇项表现。",
    severity: "low",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_nowadays_nowadays",
    pattern: /\b(Most|Many) of (people|students|children)\b/gi,
    message: "「Most of people」缺少定冠词，属于限定词误用。",
    fixNote:
      "正确形式为 Most people（泛指）或 Most of the people（特指）。这类限定词错误是考官判断语法准确度的直接依据。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_according_to_me",
    pattern: /\bAccording to me\b/gi,
    replacement: "In my view",
    message: "「According to me」在英语中不成立，according to 只用于引用他人或外部来源。",
    fixNote:
      "这是典型的中式表达。表达个人立场应使用 In my view / From my perspective / I would argue that。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_discuss_about",
    pattern: /\b(discuss|emphasise|emphasize|mention|explain|describe)\s+about\b/gi,
    message: "discuss / mention / explain 等动词为及物动词，后面不能加 about。",
    fixNote:
      "英语中 discuss 直接接宾语：discuss the issue。若要使用 about，应改用 talk about / speak about。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_contact_with",
    pattern: /\bcontact to\b|\breach to\b/gi,
    message: "动词搭配错误，介词使用不当。",
    fixNote: "contact 为及物动词，直接接宾语；reach 同样直接接宾语。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.25,
  },
  {
    id: "gr_open",
    pattern: /\bopen the (light|TV|television|computer|air conditioner)\b/gi,
    message: "中式搭配：中文的「开」在英语中对应不同动词。",
    fixNote:
      "英语按对象选择动词：turn on the light/TV，turn on the computer，turn on the air conditioner。open 仅用于门窗、书本等实体开合。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_very_like",
    pattern: /\bvery like\b|\bvery enjoy\b|\bvery love\b/gi,
    message: "very 不能直接修饰动词。",
    fixNote:
      "程度副词 very 只修饰形容词或副词。修饰动词应使用 like…very much / thoroughly enjoy / greatly appreciate。",
    severity: "medium",
    dimension: "GRA",
    lift: 0.5,
  },
  {
    id: "gr_knowledge_verb",
    pattern: /\bknowledge(s)?\s+(is|are)\s+(very\s+)?(important|useful)\b/gi,
    message: "「Knowledge is important」类表述过于空泛，属于无效论证。",
    fixNote:
      "这类句子语法正确但信息量为零。学术写作需要说明知识在什么机制上起作用：A working knowledge of statistics enables employees to interpret data independently.",
    severity: "low",
    dimension: "TR",
    lift: 0.25,
  },
];

/* ------------------------------------------------------------------ *
 * 6. 雅思 Task 1 图表描述专用词库
 * ------------------------------------------------------------------ */

export const CHART_CUES = {
  overview: [
    "overall",
    "in general",
    "broadly speaking",
    "it is clear that",
    "the most striking feature",
    "taken as a whole",
  ],
  maximum: [
    "the highest",
    "the largest",
    "the biggest",
    "the greatest",
    "peaked at",
    "reached a peak",
    "topped",
    "was at its highest",
    "maximum",
    "the most substantial",
    "accounted for the largest",
  ],
  minimum: [
    "the lowest",
    "the smallest",
    "the least",
    "bottomed out",
    "reached a low",
    "was at its lowest",
    "minimum",
    "the smallest proportion",
  ],
  rise: [
    "increased",
    "rose",
    "grew",
    "climbed",
    "surged",
    "soared",
    "escalated",
    "went up",
    "experienced growth",
    "upward trend",
  ],
  fall: [
    "decreased",
    "declined",
    "fell",
    "dropped",
    "plummeted",
    "slumped",
    "diminished",
    "went down",
    "downward trend",
  ],
  stable: [
    "remained stable",
    "remained constant",
    "levelled off",
    "leveled off",
    "plateaued",
    "was unchanged",
    "stabilised",
    "stabilized",
    "steady",
  ],
  fluctuate: [
    "fluctuated",
    "varied",
    "was erratic",
    "experienced fluctuations",
    "irregular",
  ],
  comparison: [
    "compared with",
    "compared to",
    "in contrast",
    "whereas",
    "while",
    "by comparison",
    "twice as",
    "three times as",
    "half as",
    "overtook",
    "surpassed",
    "exceeded",
    "the same as",
  ],
  approximation: [
    "approximately",
    "roughly",
    "around",
    "just over",
    "just under",
    "nearly",
    "slightly more than",
    "about",
  ],
};

/** 雅思 Task 1 不应出现的主观表达（Task 1 只描述数据，不论证） */
export const TASK1_FORBIDDEN =
  /\b(I (think|believe|feel|argue)|In my opinion|should|must|It is necessary|we need to|responsible for this)\b/gi;

/* ------------------------------------------------------------------ *
 * 6b. 仅给建议、不给替换的规则（用于结构性问题）
 * ------------------------------------------------------------------ */

export interface AdviceRule {
  id: string;
  pattern: RegExp;
  dimension: DimensionId;
  tag: AnnotationTag;
  severity: Severity;
  lift: number;
  reason: string;
  examinerNote: string;
  tasks?: TaskType[];
}

export const ADVICE_RULES: AdviceRule[] = [
  {
    id: "adv_vague_rebuttal",
    pattern:
      /\b(the\s+)?(professor|lecturer|lecture|speaker|listening|recording)\s+(does\s+not|doesn't|did\s+not|didn't)\s+(agree|accept|approve|support)\b/gi,
    dimension: "TF",
    tag: "task_response",
    severity: "high",
    lift: 0.5,
    reason:
      "这句话只说了「教授不同意」，但没有转述不同意的具体理由。综合写作的分数主要来自听力内容的还原度，一句「不同意」不包含任何听力信息，考官无法据此给分。",
    examinerNote:
      "官方评分说明明确指出：综合写作的分数取决于你听懂并准确转述了多少听力内容，阅读部分只是背景。因此每个论点段都必须写出听力的具体反驳机制——是给出了相反证据、指出了数据漏洞，还是提供了替代解释。",
    tasks: ["toefl_integrated"],
  },
  {
    id: "adv_some_people",
    pattern: /\b(some|many|a lot of)\s+people\s+(think|believe|say|argue)\b/gi,
    dimension: "TR",
    tag: "task_response",
    severity: "medium",
    lift: 0.25,
    reason:
      "「some people think」是泛化的他人观点，没有说明是谁、为什么这么想，在论证链条中不承担实际功能。",
    examinerNote:
      "考官在任务回应项上考察论点是否有展开与例证。泛化的「有些人认为」相当于零信息；应改为具体的群体或条件，例如 Critics of free tuition argue that…，并紧跟理由或数据。",
  },
  {
    id: "adv_in_conclusion",
    pattern: /\b(in conclusion|to conclude|in a word)\b[^.!?]{0,40}\b(I think|I believe|in my opinion)\b/gi,
    dimension: "CC",
    tag: "concision",
    severity: "low",
    lift: 0.25,
    reason:
      "结论段开头同时堆叠了总结标记词与立场引入语，两个功能重复，浪费了本应用于综合前文的篇幅。",
    examinerNote:
      "结论段的功能是「综合前文 + 重申立场」，不是重新引入观点。直接陈述结论即可：In conclusion, tuition-free higher education is justified on both equity and economic grounds.",
  },
];

/* ------------------------------------------------------------------ *
 * 7. 托福综合写作：转述动词与听力立场标记
 * ------------------------------------------------------------------ */

export const INTEGRATED_MARKERS = {
  /** 引入阅读观点 */
  reading: [
    "the reading",
    "the passage",
    "the author",
    "the text",
    "according to the reading",
    "the article",
    "the writer",
  ],
  /** 引入听力反驳 */
  listening: [
    "the lecture",
    "the lecturer",
    "the professor",
    "the speaker",
    "the listening",
    "the talk",
    "the recording",
  ],
  /** 听力反驳信号词 */
  refute: [
    "however",
    "but",
    "on the contrary",
    "in fact",
    "actually",
    "disagrees",
    "refutes",
    "contradicts",
    "casts doubt",
    "challenges",
    "counters",
    "points out",
    "argues instead",
    "is not the case",
    "inaccurate",
    "misleading",
    "fails to account for",
  ],
  /** 转述动词 */
  reporting: [
    "states",
    "claims",
    "asserts",
    "argues",
    "suggests",
    "maintains",
    "notes",
    "observes",
    "contends",
    "proposes",
    "explains",
    "indicates",
  ],
};
