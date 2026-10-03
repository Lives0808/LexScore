package com.lexscore.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.CoverageReport
import com.lexscore.nativeapp.data.DimensionMeta
import com.lexscore.nativeapp.data.DimensionScore
import com.lexscore.nativeapp.data.Report
import com.lexscore.nativeapp.ui.components.Badge
import com.lexscore.nativeapp.ui.components.BodyText
import com.lexscore.nativeapp.ui.components.LabelText
import com.lexscore.nativeapp.ui.components.RadarChart
import com.lexscore.nativeapp.ui.components.ScoreBar
import com.lexscore.nativeapp.ui.components.SectionCard
import com.lexscore.nativeapp.ui.components.SentenceDiff
import com.lexscore.nativeapp.ui.components.Tone
import com.lexscore.nativeapp.ui.components.polarityColor
import com.lexscore.nativeapp.ui.components.scoreColor

private val STATUS_FILTERS = listOf(
    "" to "全部",
    "pending" to "待处理",
    "accepted" to "已接受",
    "ignored" to "已忽略",
)

@Composable
fun ReportScreen(
    report: Report,
    dimensionFilter: String?,
    statusFilter: String,
    onDimensionFilter: (String?) -> Unit,
    onStatusFilter: (String) -> Unit,
    onAnnotationChange: (String, String) -> Unit,
    onAcceptAll: () -> Unit,
    onBack: () -> Unit,
) {
    val c = LexTheme.colors
    val expanded = remember { mutableStateMapOf<String, Boolean>() }

    val total = report.annotations.size
    val accepted = report.annotations.count { it.status == "accepted" }
    val ignored = report.annotations.count { it.status == "ignored" }
    val pending = total - accepted - ignored

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        /* ---------- 头部 ---------- */
        item {
            Column {
                Text(
                    "← 返回",
                    color = c.accent,
                    fontSize = 12.5.sp,
                    modifier = Modifier.clickable { onBack() },
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Badge(report.taskLabel, Tone.Accent)
                    Badge("${report.wordCount} 词", Tone.Neutral)
                    Badge(report.engine, Tone.Neutral)
                }
                Spacer(Modifier.height(8.dp))
                Text(report.prompt, color = c.ink, fontSize = 13.5.sp, lineHeight = 21.sp)
            }
        }

        /* ---------- 总分 ---------- */
        item {
            SectionCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.width(110.dp)) {
                        Text(
                            if (report.exam == "ielts") formatScore(report.overall)
                            else report.overall.toInt().toString(),
                            color = c.ink,
                            fontSize = 40.sp,
                            fontWeight = FontWeight.SemiBold,
                            lineHeight = 44.sp,
                        )
                        Text(
                            if (report.exam == "ielts") "Overall Band" else "总分 / 30",
                            color = c.inkFaint,
                            fontSize = 11.sp,
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        report.dimensions.forEach { d ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    DimensionMeta.label(d.dimension),
                                    color = c.inkSoft,
                                    fontSize = 11.5.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    formatScore(d.score),
                                    color = c.ink,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
            }
        }

        /* ---------- 总评 ---------- */
        item {
            SectionCard {
                Text("考官式总评", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                BodyText(report.summary, lineHeight = 22f)
            }
        }

        /* ---------- 雷达图 + 四维评分 ---------- */
        item {
            SectionCard {
                Text("四维评分", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                RadarChart(
                    dimensions = report.dimensions,
                    baseline = if (report.exam == "ielts") 6.0 else 3.0,
                    modifier = Modifier.fillMaxWidth(),
                )
                LabelText(
                    "虚线为 ${if (report.exam == "ielts") "Band 6.0" else "3.0 分"} 参考线，落在虚线内即短板",
                    size = 11f,
                )
            }
        }

        report.dimensions.forEach { d ->
            item(key = "dim-${d.dimension}") {
                DimensionCard(
                    dimension = d,
                    expanded = expanded[d.dimension] ?: false,
                    onToggle = { expanded[d.dimension] = !(expanded[d.dimension] ?: false) },
                )
            }
        }

        /* ---------- 逐句批注 ---------- */
        item {
            Column {
                Text("逐句对照批注", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                LabelText("点高亮处跳到下方批注卡片 · 单条可接受或忽略")
                Spacer(Modifier.height(10.dp))

                // 状态筛选
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    STATUS_FILTERS.forEach { (id, label) ->
                        FilterChip(label, statusFilter == id) { onStatusFilter(id) }
                    }
                }
                Spacer(Modifier.height(8.dp))

                // 维度筛选
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    FilterChip("全部评分项", dimensionFilter == null) { onDimensionFilter(null) }
                    report.dimensions.forEach { d ->
                        FilterChip(d.dimension, dimensionFilter == d.dimension) {
                            onDimensionFilter(d.dimension)
                        }
                    }
                }
            }
        }

        item {
            SectionCard(padding = PaddingValues(13.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BodyText(
                        "共 $total 条 · 待处理 $pending · 已接受 $accepted · 已忽略 $ignored",
                        size = 12f,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onAcceptAll) {
                        Text("全部接受", color = c.pos, fontSize = 12.5.sp)
                    }
                }
            }
        }

        item {
            SentenceDiff(
                sentences = report.sentences,
                paragraphs = report.paragraphs,
                annotations = report.annotations,
                dimensionFilter = dimensionFilter,
                statusFilter = statusFilter.ifBlank { null },
                onAnnotationChange = onAnnotationChange,
                onJumpToAnnotation = {},
            )
        }

        /* ---------- 三层 Agent 轨迹 ---------- */
        if (report.agents.isNotEmpty()) {
            item { AgentTracePanel(report.agents) }
        }

        /* ---------- 结构诊断 ---------- */
        item { RelevancePanel(report) }
        item { TemplatePanel(report) }
        report.coverage?.let { cov -> item { CoveragePanel(cov) } }
        item { ConstraintsPanel(report) }

        /* ---------- 语料 ---------- */
        if (report.corpus.isNotEmpty()) {
            item {
                SectionCard {
                    Text(
                        "已沉淀到个人语料库（${report.corpus.size}）",
                        color = c.ink,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(10.dp))
                    report.corpus.forEach { item ->
                        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Badge(
                                    when (item.kind) {
                                        "error" -> "高频错误"
                                        "sentence" -> "好句"
                                        else -> "好词"
                                    },
                                    when (item.kind) {
                                        "error" -> Tone.Neg
                                        "sentence" -> Tone.Accent
                                        else -> Tone.Pos
                                    },
                                )
                                item.topic?.let { Badge(it, Tone.Neutral) }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                item.text.take(160),
                                color = c.ink,
                                fontSize = 12.5.sp,
                                lineHeight = 19.sp,
                            )
                            item.correction?.let {
                                Spacer(Modifier.height(2.dp))
                                Text("→ $it", color = c.pos, fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(2.dp))
                            LabelText(item.note, size = 11f)
                        }
                    }
                }
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

/**
 * 三层 Agent 轨迹。
 *
 * 把「语言层 → 语篇层 → 评分层」各自的结论摊开展示，
 * 让用户看到分数不是黑箱，而是三步推导出来的。
 */
@Composable
private fun AgentTracePanel(agents: List<com.lexscore.nativeapp.data.AgentTrace>) {
    val c = LexTheme.colors
    SectionCard {
        Text("三层 Agent 协同", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        BodyText(
            "评分不是一步得出的。三个 Agent 各管一段，且评分层只能看到前两层的结论、" +
                "看不到原文 —— 避免「看到一个语法错误就顺手压低逻辑分」这类串扰。",
            size = 11.5f,
            lineHeight = 18f,
        )
        Spacer(Modifier.height(12.dp))

        agents.forEachIndexed { index, a ->
            val tone = when (a.agent) {
                "language" -> Tone.Accent
                "discourse" -> Tone.Violet
                else -> Tone.Pos
            }
            Row(verticalAlignment = Alignment.Top) {
                Badge("${index + 1}", tone)
                Spacer(Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(a.title, color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                        Badge(a.agent, tone)
                    }
                    Spacer(Modifier.height(3.dp))
                    BodyText(a.summary, size = 11.5f, lineHeight = 17f)
                    Spacer(Modifier.height(4.dp))
                    a.details.forEach { d ->
                        Text(d, color = c.inkFaint, fontSize = 11.sp, lineHeight = 16.sp)
                    }
                }
            }
            if (index < agents.size - 1) Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = LexTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) c.accentSolid else c.card)
            .border(1.dp, if (selected) c.accentSolid else c.line, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 11.dp, vertical = 7.dp),
    ) {
        Text(
            label,
            color = if (selected) Color.White else c.inkSoft,
            fontSize = 11.5.sp,
        )
    }
}

@Composable
private fun DimensionCard(
    dimension: DimensionScore,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val c = LexTheme.colors
    val color = scoreColor(dimension.score, dimension.max)
    val negatives = dimension.evidences.count { it.polarity == "negative" }
    val positives = dimension.evidences.count { it.polarity == "positive" }

    SectionCard {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text(dimension.label, color = c.ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                LabelText(dimension.labelEn, size = 10.5f)
            }
            Text(
                formatScore(dimension.score),
                color = c.ink,
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 28.sp,
            )
            Text(" / ${formatScore(dimension.max)}", color = c.inkFaint, fontSize = 11.sp)
        }

        Spacer(Modifier.height(9.dp))
        ScoreBar(dimension.score, dimension.max, color)

        Spacer(Modifier.height(9.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Badge(dimension.bandLabel, if (color == c.pos) Tone.Pos else Tone.Accent)
            if (negatives > 0) Badge("扣分 $negatives 处", Tone.Neg)
            if (positives > 0) Badge("加分 $positives 处", Tone.Pos)
        }

        Spacer(Modifier.height(9.dp))
        BodyText(dimension.summary, size = 12.5f, lineHeight = 20f)

        Spacer(Modifier.height(6.dp))
        Text(
            if (expanded) "收起评分依据" else "展开评分依据（${dimension.evidences.size}）",
            color = c.accent,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.clickable { onToggle() }.padding(vertical = 4.dp),
        )

        if (expanded) {
            dimension.evidences.forEach { e ->
                Column(modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                    Row {
                        Box(
                            modifier = Modifier
                                .padding(top = 6.dp)
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(polarityColor(e.polarity)),
                        )
                        Spacer(Modifier.width(7.dp))
                        BodyText(e.comment, size = 12f, lineHeight = 19f)
                    }
                    e.metric?.let {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            if (e.delta != 0.0) "$it    ${if (e.delta > 0) "+" else ""}${formatScore(e.delta)} 分" else it,
                            color = c.inkFaint,
                            fontSize = 10.5.sp,
                        )
                    }
                    if (e.quote.isNotBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .padding(start = 13.dp)
                                .width(2.dp)
                                .height(2.dp)
                                .background(Color.Transparent),
                        )
                        Text(
                            "“${e.quote.take(150)}”",
                            color = c.inkFaint,
                            fontSize = 11.5.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(start = 13.dp),
                        )
                    }
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ *
 * 结构诊断面板
 * ------------------------------------------------------------------ */

@Composable
private fun RelevancePanel(report: Report) {
    val c = LexTheme.colors
    val r = report.relevance

    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("扣题度诊断", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text("${r.score} / 100", color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        ScoreBar(
            r.score.toDouble(),
            100.0,
            when {
                r.score >= 85 -> c.pos
                r.score >= 70 -> c.accent
                r.score >= 50 -> c.warn
                else -> c.neg
            },
        )
        Spacer(Modifier.height(8.dp))
        BodyText(r.verdict, size = 12.5f, lineHeight = 20f)

        Spacer(Modifier.height(10.dp))
        Badge(
            if (r.position.found) "已定位立场句" else if (r.position.required) "缺少立场句" else "不强制立场",
            if (r.position.found) Tone.Pos else if (r.position.required) Tone.Neg else Tone.Neutral,
        )
        Spacer(Modifier.height(5.dp))
        BodyText(r.position.note, size = 12f, lineHeight = 19f)

        Spacer(Modifier.height(10.dp))
        Text("题目关键词覆盖", color = c.inkSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(6.dp))
        // 关键词用流式换行排布
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            r.keywords.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { k ->
                        Badge(
                            if (k.kind == "instruction") k.term
                            else if (k.hit) "${k.term} ×${k.count}" else "${k.term} 未出现",
                            when {
                                k.kind == "instruction" -> Tone.Violet
                                k.hit -> Tone.Pos
                                else -> Tone.Neg
                            },
                        )
                    }
                }
            }
        }

        if (r.offTopic.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("疑似偏离主题（${r.offTopic.size}）", color = c.inkSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            r.offTopic.forEach { o ->
                Spacer(Modifier.height(6.dp))
                Text("“${o.quote.take(130)}”", color = c.inkFaint, fontSize = 11.5.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(3.dp))
                BodyText(o.reason, size = 12f, lineHeight = 19f)
            }
        }
    }
}

@Composable
private fun TemplatePanel(report: Report) {
    val c = LexTheme.colors
    val t = report.template

    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("反模板检测", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text("${t.originality} / 100 原创度", color = c.ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        ScoreBar(
            t.originality.toDouble(),
            100.0,
            when {
                t.originality >= 85 -> c.pos
                t.originality >= 65 -> c.warn
                else -> c.neg
            },
        )
        Spacer(Modifier.height(8.dp))
        BodyText(t.verdict, size = 12.5f, lineHeight = 20f)

        t.hits.forEach { h ->
            Spacer(Modifier.height(12.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .background(c.bg)
                    .border(1.dp, c.line, RoundedCornerShape(9.dp))
                    .padding(12.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Badge(h.category, Tone.Warn)
                    Badge("-${formatScore(h.penalty)} 分", Tone.Neg)
                }
                Spacer(Modifier.height(6.dp))
                Text("“${h.phrase}”", color = c.neg, fontSize = 12.sp)
                Spacer(Modifier.height(5.dp))
                BodyText(h.reason, size = 12f, lineHeight = 19f)
                Spacer(Modifier.height(5.dp))
                BodyText("改成　${h.suggestion}", color = c.accent, size = 12f, lineHeight = 19f)
            }
        }
    }
}

@Composable
private fun CoveragePanel(coverage: CoverageReport) {
    val c = LexTheme.colors
    val groups = coverage.items.map { it.group }.distinct()

    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(coverage.title, color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Badge("${coverage.stats.covered} 覆盖", Tone.Pos)
            if (coverage.stats.partial > 0) Badge("${coverage.stats.partial} 不完整", Tone.Warn)
            if (coverage.stats.missing > 0) Badge("${coverage.stats.missing} 缺失", Tone.Neg)
        }
        Spacer(Modifier.height(8.dp))
        ScoreBar(
            coverage.stats.covered.toDouble(),
            coverage.items.size.coerceAtLeast(1).toDouble(),
            if (coverage.stats.missing == 0) c.pos else if (coverage.stats.missing <= 1) c.warn else c.neg,
        )
        Spacer(Modifier.height(8.dp))
        BodyText(coverage.summary, size = 12.5f, lineHeight = 20f)

        groups.forEach { group ->
            Spacer(Modifier.height(12.dp))
            Text(group, color = c.inkSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            coverage.items.filter { it.group == group }.forEach { item ->
                Spacer(Modifier.height(7.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(9.dp))
                        .background(
                            when (item.status) {
                                "missing" -> c.negSoft
                                "partial" -> c.warnSoft
                                else -> c.bg
                            },
                        )
                        .border(1.dp, c.line, RoundedCornerShape(9.dp))
                        .padding(11.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Badge(
                            when (item.status) {
                                "covered" -> "已覆盖"
                                "partial" -> "不完整"
                                else -> "缺失"
                            },
                            when (item.status) {
                                "covered" -> Tone.Pos
                                "partial" -> Tone.Warn
                                else -> Tone.Neg
                            },
                        )
                        Text(item.label, color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    }
                    Spacer(Modifier.height(5.dp))
                    BodyText(item.note, size = 12f, lineHeight = 19f)
                    item.evidenceQuote?.let {
                        Spacer(Modifier.height(4.dp))
                        Text("“${it.take(130)}”", color = c.inkFaint, fontSize = 11.5.sp, lineHeight = 18.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ConstraintsPanel(report: Report) {
    val c = LexTheme.colors

    SectionCard {
        Text("硬性约束检查", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        LabelText("字数、分段与句长会在内容评分之前先影响印象分", size = 11f)
        Spacer(Modifier.height(10.dp))

        report.constraints.forEach { item ->
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                Badge(
                    when (item.status) {
                        "pass" -> "达标"
                        "warn" -> "警示"
                        else -> "不达标"
                    },
                    when (item.status) {
                        "pass" -> Tone.Pos
                        "warn" -> Tone.Warn
                        else -> Tone.Neg
                    },
                )
                Spacer(Modifier.width(8.dp))
                Column {
                    Text(item.label, color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(2.dp))
                    BodyText(item.detail, size = 12f, lineHeight = 19f)
                }
            }
        }
    }
}
