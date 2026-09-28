package com.lexscore.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.Annotation
import com.lexscore.nativeapp.data.Paragraph
import com.lexscore.nativeapp.data.Sentence
import com.lexscore.nativeapp.ui.LexTheme

private val ROLE_LABELS = mapOf(
    "introduction" to "引入段",
    "overview" to "概述段",
    "body" to "主体段",
    "counter" to "让步段",
    "conclusion" to "结论段",
)

/**
 * 逐句对照批改。
 *
 * 手机上不做左右分栏（窄屏放不下），改为上下堆叠：
 * 上方原文、下方修改版，各自带标签。原文里被批注的位置高亮，
 * 点击即可跳到对应的批注卡片。
 */
@Composable
fun SentenceDiff(
    sentences: List<Sentence>,
    paragraphs: List<Paragraph>,
    annotations: List<Annotation>,
    dimensionFilter: String?,
    statusFilter: String?,
    onAnnotationChange: (String, String) -> Unit,
    onJumpToAnnotation: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = LexTheme.colors

    val filtered = annotations.filter { a ->
        (dimensionFilter == null || a.dimension == dimensionFilter) &&
            (statusFilter == null || a.status == statusFilter)
    }
    val bySentence = filtered.groupBy { it.sentenceId }
    // 用于高亮的批次不受状态筛选影响，否则切到「已接受」就看不到原文标记了
    val highlightBySentence = annotations.groupBy { it.sentenceId }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        paragraphs.forEach { para ->
            val paraSentences = para.sentenceIds.mapNotNull { id -> sentences.find { it.id == id } }
            if (paraSentences.isEmpty()) return@forEach

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(c.card)
                    .border(1.dp, c.line, RoundedCornerShape(12.dp)),
            ) {
                // 段落头
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(c.bg)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "第 ${para.index + 1} 段",
                            color = c.ink,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        Badge(ROLE_LABELS[para.role] ?: para.role, Tone.Accent)
                        Text("${para.wordCount} 词 · ${paraSentences.size} 句", color = c.inkFaint, fontSize = 11.sp)
                    }
                    Spacer(Modifier.height(3.dp))
                    Text(para.roleNote, color = c.inkFaint, fontSize = 11.5.sp, lineHeight = 16.sp)
                }

                paraSentences.forEach { sentence ->
                    val list = bySentence[sentence.id].orEmpty()
                    val highlight = highlightBySentence[sentence.id].orEmpty()

                    Column(modifier = Modifier.fillMaxWidth()) {
                        // 原文
                        Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "第 ${sentence.indexInParagraph + 1} 句 · 原文",
                                    color = c.inkFaint,
                                    fontSize = 10.5.sp,
                                )
                                if (highlight.isNotEmpty()) {
                                    Badge("${highlight.size} 处可改", Tone.Neg)
                                }
                            }
                            Spacer(Modifier.height(5.dp))

                            Text(
                                text = buildHighlighted(sentence.text, highlight),
                                fontSize = 14.5.sp,
                                lineHeight = 28.sp,
                            )

                            // 修改版：叠在原文下面，避免窄屏左右分栏放不下
                            Spacer(Modifier.height(10.dp))
                            Text("修改版", color = c.inkFaint, fontSize = 10.5.sp)
                            Spacer(Modifier.height(3.dp))
                            Text(
                                text = buildPreview(sentence.text, highlight),
                                fontSize = 14.5.sp,
                                lineHeight = 28.sp,
                            )
                        }

                        // 批注卡片
                        if (list.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(c.bg.copy(alpha = 0.6f))
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                list.forEach { a ->
                                    AnnotationCard(
                                        annotation = a,
                                        highlighted = false,
                                        onChange = { status -> onAnnotationChange(a.id, status) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** 原文渲染：把被批注的片段加底色 */
@Composable
private fun buildHighlighted(text: String, annotations: List<Annotation>) =
    buildAnnotatedString {
        val c = LexTheme.colors
        val spans = locateSpans(text, annotations)
        var cursor = 0
        for (span in spans) {
            if (span.start > cursor) append(text.substring(cursor, span.start))
            val bg = when (span.annotation.severity) {
                "high", "medium" -> c.negSoft
                else -> c.warnSoft
            }
            withStyle(SpanStyle(background = bg)) {
                append(text.substring(span.start, span.end))
            }
            cursor = span.end
        }
        if (cursor < text.length) append(text.substring(cursor))
    }

/** 修改版渲染：已接受用绿色，待定用蓝色下划线 */
@Composable
private fun buildPreview(text: String, annotations: List<Annotation>) =
    buildAnnotatedString {
        val c = LexTheme.colors
        val spans = locateSpans(text, annotations)
        if (spans.isEmpty()) {
            withStyle(SpanStyle(color = c.inkFaint)) { append("本句无需修改。") }
            return@buildAnnotatedString
        }
        var cursor = 0
        for (span in spans) {
            if (span.start > cursor) append(text.substring(cursor, span.start))
            val a = span.annotation
            when {
                a.adviceOnly -> withStyle(SpanStyle(color = c.inkSoft)) {
                    append(text.substring(span.start, span.end))
                }
                a.status == "accepted" -> withStyle(
                    SpanStyle(color = c.pos, fontWeight = FontWeight.Medium, background = c.posSoft),
                ) { append(a.replacement) }
                a.status == "ignored" -> append(text.substring(span.start, span.end))
                else -> withStyle(
                    SpanStyle(
                        color = c.accent,
                        background = c.accentSoft,
                        textDecoration = TextDecoration.Underline,
                    ),
                ) { append(a.replacement) }
            }
            cursor = span.end
        }
        if (cursor < text.length) append(text.substring(cursor))
    }

private data class Span(
    val start: Int,
    val end: Int,
    val annotation: Annotation,
)

/** 定位所有可在句子中命中原文的批注，去掉重叠 */
private fun locateSpans(text: String, annotations: List<Annotation>): List<Span> {
    val spans = annotations.mapNotNull { a ->
        val idx = text.indexOf(a.target)
        if (idx < 0) null else Span(idx, idx + a.target.length, a)
    }.sortedWith(compareBy({ it.start }, { -(it.end - it.start) }))

    val out = mutableListOf<Span>()
    for (span in spans) {
        val last = out.lastOrNull()
        if (last != null && span.start < last.end) {
            // 重叠时保留更精确的那条
            if (span.end - span.start < last.end - last.start) out[out.size - 1] = span
            continue
        }
        out.add(span)
    }
    return out
}
