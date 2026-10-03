package com.lexscore.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.DimensionMeta
import com.lexscore.nativeapp.ui.components.Badge
import com.lexscore.nativeapp.ui.components.BodyText
import com.lexscore.nativeapp.ui.components.LabelText
import com.lexscore.nativeapp.ui.components.ScoreBar
import com.lexscore.nativeapp.ui.components.SectionCard
import com.lexscore.nativeapp.ui.components.Tone

private val TABS = listOf(
    "phrases" to "好词与词伙",
    "sentences" to "好句",
    "errors" to "高频错误",
)

@Composable
fun CorpusScreen(
    state: UiState,
    onBack: () -> Unit,
    onClearAll: () -> Unit,
) {
    val c = LexTheme.colors
    var tab by remember { mutableStateOf("phrases") }

    val corpus = state.corpus
    val list = corpus.filter { it.item.kind == tab }

    // 错误在评分项上的分布
    val errorByDimension = corpus
        .filter { it.item.kind == "error" }
        .groupBy { it.item.dimension }
        .map { (dim, entries) -> dim to entries.sumOf { it.occurrences } }
        .sortedByDescending { it.second }
    val maxError = errorByDimension.maxOfOrNull { it.second } ?: 1

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column {
                Text(
                    "← 返回",
                    color = c.accent,
                    fontSize = 12.5.sp,
                    modifier = Modifier.clickable { onBack() },
                )
                Spacer(Modifier.height(10.dp))
                Text("我的写作语料库", color = c.ink, fontSize = 21.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                BodyText(
                    "自动从你写过的作文里抽取。复习时不用背通用范文，" +
                        "直接用自己写过的、已被验证的表达。",
                )
            }
        }

        if (state.reports.isEmpty()) {
            item {
                SectionCard {
                    BodyText("语料库还是空的。批改一篇作文后，好词、好句和高频错误会自动累积到这里。")
                }
            }
            return@LazyColumn
        }

        // 概览
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("已批改", "${state.reports.size}", "篇", Modifier.weight(1f))
                StatCard(
                    "累计写作",
                    "${state.reports.sumOf { it.wordCount }}",
                    "词",
                    Modifier.weight(1f),
                )
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard(
                    "沉淀词伙",
                    "${corpus.count { it.item.kind == "phrase" }}",
                    "条",
                    Modifier.weight(1f),
                )
                StatCard("错误类型", "${errorByDimension.size}", "类", Modifier.weight(1f))
            }
        }

        // 跨篇错误追踪
        state.insight?.let { insight ->
            item { InsightPanel(insight) }
        }

        // 错误分布
        if (errorByDimension.isNotEmpty()) {
            item {
                SectionCard {
                    Text("错误在评分项上的分布", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    BodyText(
                        "同一个评分项反复出错，说明是系统性问题，需要针对性训练。",
                        size = 11.5f,
                    )
                    Spacer(Modifier.height(12.dp))
                    errorByDimension.forEach { (dim, count) ->
                        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(DimensionMeta.label(dim), color = c.ink, fontSize = 12.5.sp)
                                Text("$count 次", color = c.inkFaint, fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(4.dp))
                            ScoreBar(
                                count.toDouble(),
                                maxError.toDouble(),
                                if (count >= maxError * 0.7) c.neg else c.warn,
                            )
                        }
                    }
                }
            }
        }

        // 标签页
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TABS.forEach { (id, label) ->
                    val selected = tab == id
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selected) c.accentSolid else c.card)
                            .border(1.dp, if (selected) c.accentSolid else c.line, RoundedCornerShape(8.dp))
                            .clickable { tab = id }
                            .padding(vertical = 9.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "$label ${corpus.count { it.item.kind == id }}",
                            color = if (selected) androidx.compose.ui.graphics.Color.White else c.inkSoft,
                            fontSize = 11.5.sp,
                        )
                    }
                }
            }
        }

        if (list.isEmpty()) {
            item { BodyText("这里还没有内容。多批改几篇，语料会自动累积。") }
        }

        items(list, key = { it.item.id }) { entry ->
            val item = entry.item
            SectionCard(padding = PaddingValues(13.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    item.topic?.let { Badge(it, Tone.Neutral) }
                    Badge(item.dimension, Tone.Accent)
                    if (entry.occurrences > 1) Badge("出现 ${entry.occurrences} 次", Tone.Warn)
                }
                Spacer(Modifier.height(7.dp))
                Text(
                    item.text.take(200),
                    color = if (item.kind == "error") c.neg else c.ink,
                    fontSize = 12.5.sp,
                    lineHeight = 19.sp,
                )
                item.correction?.let {
                    Spacer(Modifier.height(4.dp))
                    Text("→ $it", color = c.pos, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                }
                Spacer(Modifier.height(5.dp))
                BodyText(item.note, size = 11.5f, lineHeight = 18f)
            }
        }

        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9.dp))
                    .border(1.dp, c.line, RoundedCornerShape(9.dp))
                    .clickable { onClearAll() }
                    .padding(13.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("清空全部记录", color = c.inkFaint, fontSize = 12.sp)
            }
        }

        item { Spacer(Modifier.height(8.dp)) }
    }
}

/**
 * 跨篇错误追踪。
 *
 * 分析逻辑在 TypeScript 引擎里（LexScore.analyzeHistory），
 * 这里只负责展示 —— 避免两端各写一份分析逻辑导致结论不一致。
 */
@Composable
private fun InsightPanel(insight: com.lexscore.nativeapp.data.LearnerInsight) {
    val c = LexTheme.colors

    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("个人错误追踪", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            LabelText("${insight.reportCount} 篇 · 跨度 ${insight.spanDays} 天", size = 11f)
        }

        Spacer(Modifier.height(10.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(9.dp))
                .background(c.bg)
                .padding(12.dp),
        ) {
            BodyText(insight.headline, size = 12.5f, lineHeight = 20f)
        }

        if (insight.recurring.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Text("需要专项突破", color = c.inkSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            insight.recurring.forEach { t ->
                Spacer(Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(9.dp))
                        .background(c.negSoft.copy(alpha = 0.5f))
                        .border(1.dp, c.neg.copy(alpha = 0.25f), RoundedCornerShape(9.dp))
                        .padding(12.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Badge(
                            when (t.trend) {
                                "increasing" -> "变严重"
                                "decreasing" -> "在改善"
                                "new" -> "新出现"
                                else -> "持续存在"
                            },
                            when (t.trend) {
                                "increasing" -> Tone.Neg
                                "decreasing" -> Tone.Pos
                                "new" -> Tone.Warn
                                else -> Tone.Accent
                            },
                        )
                        Text(t.label, color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    }
                    Spacer(Modifier.height(4.dp))
                    LabelText(
                        "累计 ${t.totalCount} 次 · 分布在 ${t.reportCount} 篇中 · 最近 ${t.recentCount} 次",
                        size = 11f,
                    )
                    if (t.examples.isNotEmpty()) {
                        Spacer(Modifier.height(3.dp))
                        Text(
                            "例：" + t.examples.take(2).joinToString("　/　"),
                            color = c.inkFaint,
                            fontSize = 11.sp,
                        )
                    }
                    Spacer(Modifier.height(5.dp))
                    BodyText(t.advice, size = 12f, lineHeight = 18f)
                }
            }
        }

        if (insight.improving.isNotEmpty() || insight.mastered.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Text("已改善 / 已掌握", color = c.inkSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                insight.improving.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { t ->
                            Badge("${t.label} ${t.earlierCount}→${t.recentCount}", Tone.Pos)
                        }
                    }
                }
                insight.mastered.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { t -> Badge("${t.label} 已不再出现", Tone.Pos) }
                    }
                }
            }
        }

        if (insight.strengthWords.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Text(
                "你自己用过的高分表达（可复用）",
                color = c.inkSoft,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                insight.strengthWords.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { w -> Badge(w, Tone.Accent) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, unit: String, modifier: Modifier = Modifier) {
    val c = LexTheme.colors
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(c.card)
            .border(1.dp, c.line, RoundedCornerShape(12.dp))
            .padding(13.dp),
    ) {
        Text(label, color = c.inkFaint, fontSize = 11.5.sp)
        Spacer(Modifier.height(3.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, color = c.ink, fontSize = 23.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(0.dp))
            Text(" $unit", color = c.inkFaint, fontSize = 11.5.sp)
        }
    }
}
