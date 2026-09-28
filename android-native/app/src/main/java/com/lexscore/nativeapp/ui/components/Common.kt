package com.lexscore.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.ui.LexTheme

/** 语义色调，对应网页版的 Badge tone */
enum class Tone { Neutral, Accent, Pos, Neg, Warn, Violet }

@Composable
fun Badge(text: String, tone: Tone = Tone.Neutral, modifier: Modifier = Modifier) {
    val c = LexTheme.colors
    val (border, bg, fg) = when (tone) {
        Tone.Neutral -> Triple(c.line, c.bg, c.inkSoft)
        Tone.Accent -> Triple(c.accent.copy(alpha = 0.28f), c.accentSoft, c.accent)
        Tone.Pos -> Triple(c.pos.copy(alpha = 0.28f), c.posSoft, c.pos)
        Tone.Neg -> Triple(c.neg.copy(alpha = 0.28f), c.negSoft, c.neg)
        Tone.Warn -> Triple(c.warn.copy(alpha = 0.28f), c.warnSoft, c.warn)
        Tone.Violet -> Triple(c.violet.copy(alpha = 0.28f), c.violetSoft, c.violet)
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(4.dp))
            .padding(horizontal = 5.dp, vertical = 2.dp),
    ) {
        Text(
            text = text,
            color = fg,
            fontSize = 10.5.sp,
            lineHeight = 13.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
        )
    }
}

@Composable
fun ScoreBar(value: Double, max: Double, color: Color, modifier: Modifier = Modifier) {
    val ratio = if (max <= 0) 0f else (value / max).coerceIn(0.0, 1.0).toFloat()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(LexTheme.colors.line),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(ratio)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(color),
        )
    }
}

/** 统一的卡片容器 */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    padding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = LexTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(c.card)
            .border(1.dp, c.line, RoundedCornerShape(12.dp))
            .padding(padding),
        content = content,
    )
}

@Composable
fun SectionTitle(text: String, trailing: String? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text,
            color = LexTheme.colors.ink,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
        )
        if (trailing != null) {
            Text(text = trailing, color = LexTheme.colors.inkFaint, fontSize = 11.sp)
        }
    }
}

@Composable
fun BodyText(
    text: String,
    color: Color = LexTheme.colors.inkSoft,
    size: Float = 13f,
    lineHeight: Float = 21f,
) {
    Text(text = text, color = color, fontSize = size.sp, lineHeight = lineHeight.sp)
}

@Composable
fun LabelText(text: String, color: Color = LexTheme.colors.inkFaint, size: Float = 11f) {
    Text(text = text, color = color, fontSize = size.sp)
}

/** 分数 → 语义色，与网页版 scoreTone 保持同一套阈值 */
@Composable
fun scoreTone(score: Double, max: Double): Tone {
    val ratio = if (max <= 0) 0.0 else score / max
    return when {
        ratio >= 0.78 -> Tone.Pos
        ratio >= 0.62 -> Tone.Accent
        ratio >= 0.48 -> Tone.Warn
        else -> Tone.Neg
    }
}

@Composable
fun scoreColor(score: Double, max: Double): Color {
    val c = LexTheme.colors
    return when (scoreTone(score, max)) {
        Tone.Pos -> c.pos
        Tone.Accent -> c.accent
        Tone.Warn -> c.warn
        Tone.Neg -> c.neg
        else -> c.inkFaint
    }
}

@Composable
fun severityColor(severity: String): Color {
    val c = LexTheme.colors
    return when (severity) {
        "high" -> c.neg
        "medium" -> c.warn
        else -> c.inkFaint
    }
}

@Composable
fun polarityColor(polarity: String): Color {
    val c = LexTheme.colors
    return when (polarity) {
        "negative" -> c.neg
        "positive" -> c.pos
        else -> c.inkFaint
    }
}
