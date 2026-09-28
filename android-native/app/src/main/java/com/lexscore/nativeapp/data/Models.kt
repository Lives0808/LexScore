package com.lexscore.nativeapp.data

import kotlinx.serialization.Serializable

/**
 * 引擎输出的数据模型。
 *
 * 与 TypeScript 侧的 lib/types.ts 一一对应。
 * 解析时开了 ignoreUnknownKeys，所以引擎新增字段不会导致安卓端解析失败。
 */

@Serializable
data class GradeInput(
    val exam: String,
    val taskType: String,
    val prompt: String,
    val essay: String,
    val chartData: String? = null,
    val readingPoints: List<String>? = null,
    val listeningPoints: List<String>? = null,
)

@Serializable
data class Sentence(
    val id: String,
    val index: Int,
    val paragraphIndex: Int,
    val indexInParagraph: Int,
    val text: String,
    val wordCount: Int,
)

@Serializable
data class Paragraph(
    val index: Int,
    val text: String,
    val role: String,
    val roleNote: String,
    val sentenceIds: List<String>,
    val wordCount: Int,
)

@Serializable
data class Annotation(
    val id: String,
    val sentenceId: String,
    /** 原文中被替换的片段；必须在所属句子中逐字符可定位 */
    val target: String,
    /** 修改后的表达；空串表示「仅建议，无自动替换」 */
    val replacement: String,
    val dimension: String,
    val tag: String,
    val severity: String,
    val lift: Double,
    val liftText: String,
    val reason: String,
    val examinerNote: String,
    val status: String = "pending",
) {
    val adviceOnly: Boolean get() = replacement.isBlank()
    val canApply: Boolean get() = replacement.isNotBlank()
}

@Serializable
data class Evidence(
    val sentenceId: String = "",
    val quote: String = "",
    val polarity: String,
    val comment: String,
    val metric: String? = null,
    val delta: Double,
)

@Serializable
data class DimensionScore(
    val dimension: String,
    val label: String,
    val labelEn: String,
    val score: Double,
    val max: Double,
    val bandLabel: String,
    val summary: String,
    val evidences: List<Evidence> = emptyList(),
)

@Serializable
data class KeywordHit(
    val term: String,
    val hit: Boolean,
    val count: Int,
    val kind: String,
)

@Serializable
data class OffTopicSentence(
    val sentenceId: String,
    val quote: String,
    val reason: String,
)

@Serializable
data class PositionInfo(
    val required: Boolean,
    val found: Boolean,
    val sentenceId: String? = null,
    val quote: String? = null,
    val note: String,
)

@Serializable
data class RelevanceReport(
    val score: Int,
    val verdict: String,
    val keywords: List<KeywordHit> = emptyList(),
    val offTopic: List<OffTopicSentence> = emptyList(),
    val position: PositionInfo,
)

@Serializable
data class TemplateHit(
    val id: String,
    val phrase: String,
    val sentenceId: String,
    val quote: String,
    val category: String,
    val reason: String,
    val suggestion: String,
    val penalty: Double,
)

@Serializable
data class TemplateReport(
    val originality: Int,
    val verdict: String,
    val hits: List<TemplateHit> = emptyList(),
)

@Serializable
data class CoverageItem(
    val id: String,
    val group: String,
    val label: String,
    val detail: String,
    val status: String,
    val evidenceSentenceId: String? = null,
    val evidenceQuote: String? = null,
    val note: String,
)

@Serializable
data class CoverageStats(
    val covered: Int,
    val partial: Int,
    val missing: Int,
)

@Serializable
data class CoverageReport(
    val kind: String,
    val title: String,
    val summary: String,
    val items: List<CoverageItem> = emptyList(),
    val stats: CoverageStats,
)

@Serializable
data class ConstraintItem(
    val id: String,
    val label: String,
    val status: String,
    val detail: String,
    val sentenceId: String? = null,
)

@Serializable
data class CorpusItem(
    val id: String,
    val kind: String,
    val text: String,
    val correction: String? = null,
    val dimension: String,
    val topic: String? = null,
    val note: String,
    val sourceReportId: String,
    val createdAt: Long,
)

@Serializable
data class Report(
    val id: String,
    val createdAt: Long,
    val exam: String,
    val taskType: String,
    val taskLabel: String,
    val prompt: String,
    val essay: String,
    val wordCount: Int,
    val overall: Double,
    val overallMax: Int,
    val overallLabel: String,
    val bandLabel: String = "",
    val summary: String,
    val dimensions: List<DimensionScore> = emptyList(),
    val sentences: List<Sentence> = emptyList(),
    val paragraphs: List<Paragraph> = emptyList(),
    val annotations: List<Annotation> = emptyList(),
    val relevance: RelevanceReport,
    val template: TemplateReport,
    val coverage: CoverageReport? = null,
    val constraints: List<ConstraintItem> = emptyList(),
    val corpus: List<CorpusItem> = emptyList(),
    val engine: String,
)

/** 引擎返回的外层信封：{ ok, report } 或 { ok, error } */
@Serializable
data class GradeEnvelope(
    val ok: Boolean,
    val report: Report? = null,
    val error: String? = null,
)

/** 维度中文名与短标签，用于图表轴与筛选 */
object DimensionMeta {
    private val labels = mapOf(
        "TR" to "任务回应",
        "CC" to "连贯与衔接",
        "LR" to "词汇丰富度",
        "GRA" to "语法与准确性",
        "TF" to "任务完成",
        "OD" to "组织发展",
        "LU" to "语言使用",
        "SV" to "句式多样性",
    )

    fun label(id: String): String = labels[id] ?: id

    /** 雷达图轴标签：雅思用缩写（TR/CC/LR/GRA），托福用中文短名 */
    fun axisLabel(id: String): String = if (id.length <= 3) id else label(id)
}

/** 批注标签的中文说明 */
object TagMeta {
    private val labels = mapOf(
        "academic_collocation" to "学术搭配",
        "topic_lexis" to "话题词伙",
        "cohesion" to "逻辑衔接",
        "grammar" to "语法",
        "sentence_variety" to "句式",
        "register" to "语域",
        "concision" to "冗余",
        "template" to "模板痕迹",
        "task_response" to "任务回应",
    )

    fun label(id: String): String = labels[id] ?: id
}

/** 任务类型 */
object TaskTypes {
    const val IELTS_TASK1 = "ielts_task1"
    const val IELTS_TASK2 = "ielts_task2"
    const val TOEFL_INTEGRATED = "toefl_integrated"
    const val TOEFL_DISCUSSION = "toefl_discussion"

    val all = listOf(
        TaskOption(IELTS_TASK2, "雅思", "大作文", "议论文，≥250 词"),
        TaskOption(IELTS_TASK1, "雅思", "小作文", "图表描述，≥150 词"),
        TaskOption(TOEFL_INTEGRATED, "托福", "综合写作", "阅读 + 听力，≥150 词"),
        TaskOption(TOEFL_DISCUSSION, "托福", "学术讨论", "≥120 词"),
    )
}

data class TaskOption(
    val id: String,
    val examLabel: String,
    val shortName: String,
    val hint: String,
) {
    val exam: String get() = if (examLabel == "雅思") "ielts" else "toefl"
}
