package com.lexscore.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.Annotation
import com.lexscore.nativeapp.data.DimensionMeta
import com.lexscore.nativeapp.data.TagMeta
import com.lexscore.nativeapp.ui.LexTheme

/**
 * 单条批注卡片。
 *
 * 与网页版一致：标签行（评分项 / 类型 / 提分幅度）+ 修改对照 +
 * 为什么改 + 考官视角，底部是接受 / 忽略。
 */
@Composable
fun AnnotationCard(
    annotation: Annotation,
    highlighted: Boolean,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = LexTheme.colors
    val accepted = annotation.status == "accepted"
    val ignored = annotation.status == "ignored"

    val border = when {
        highlighted -> c.accent
        accepted -> c.pos.copy(alpha = 0.4f)
        else -> c.line
    }
    val bg = when {
        accepted -> c.posSoft.copy(alpha = 0.5f)
        else -> c.card
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(if (highlighted) 2.dp else 1.dp, border, RoundedCornerShape(10.dp))
            .padding(13.dp),
    ) {
        // 标签行
        Row(
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Dot(color = severityColor(annotation.severity), size = 7.dp)
            Badge(DimensionMeta.label(annotation.dimension), Tone.Neutral)
            Badge(
                TagMeta.label(annotation.tag),
                when (annotation.tag) {
                    "topic_lexis" -> Tone.Violet
                    "academic_collocation" -> Tone.Accent
                    "template" -> Tone.Warn
                    "grammar" -> Tone.Neg
                    else -> Tone.Neutral
                },
            )
        }

        Spacer(Modifier.height(5.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Badge(annotation.liftText, Tone.Pos)
            if (annotation.adviceOnly) Badge("仅建议", Tone.Warn)
            if (accepted) Badge("已接受", Tone.Pos)
            if (ignored) Badge("已忽略", Tone.Neutral)
        }

        // 修改对照
        Spacer(Modifier.height(9.dp))
        Text(
            text = annotation.target,
            color = c.inkSoft,
            fontSize = 13.sp,
            lineHeight = 20.sp,
            textDecoration = TextDecoration.LineThrough,
        )
        if (annotation.canApply) {
            Spacer(Modifier.height(3.dp))
            Row(verticalAlignment = Alignment.Top) {
                Text("→ ", color = c.inkFaint, fontSize = 13.sp)
                Text(
                    text = annotation.replacement,
                    color = c.pos,
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // 为什么改
        Spacer(Modifier.height(9.dp))
        Text(
            text = annotation.reason,
            color = c.inkSoft,
            fontSize = 12.5.sp,
            lineHeight = 20.sp,
        )

        // 考官视角
        if (annotation.examinerNote.isNotBlank()) {
            Spacer(Modifier.height(7.dp))
            Row {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(48.dp)
                        .background(c.accent.copy(alpha = 0.35f)),
                )
                Spacer(Modifier.width(8.dp))
                Column {
                    Text(
                        text = "考官视角",
                        color = c.accent,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        text = annotation.examinerNote,
                        color = c.inkSoft,
                        fontSize = 12.5.sp,
                        lineHeight = 20.sp,
                    )
                }
            }
        }

        // 操作
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (annotation.status == "pending") {
                if (annotation.canApply) {
                    TextButton(onClick = { onChange("accepted") }) {
                        Text("接受修改", color = c.accent, fontSize = 12.5.sp)
                    }
                }
                TextButton(onClick = { onChange("ignored") }) {
                    Text("忽略", color = c.inkSoft, fontSize = 12.5.sp)
                }
            } else {
                TextButton(onClick = { onChange("pending") }) {
                    Text("撤销", color = c.inkSoft, fontSize = 12.5.sp)
                }
            }
        }
    }
}

/** 严重度小圆点 */
@Composable
private fun Dot(color: Color, size: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(color),
    )
}
