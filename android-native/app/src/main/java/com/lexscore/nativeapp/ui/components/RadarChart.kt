package com.lexscore.nativeapp.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.DimensionMeta
import com.lexscore.nativeapp.data.DimensionScore
import com.lexscore.nativeapp.ui.LexTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * 四维评分雷达图。
 *
 * 直接把四个维度的得分画出来，一眼看出强弱项的形状。
 * 虚线是参考基线，落在虚线内就是短板。
 */
@Composable
fun RadarChart(
    dimensions: List<DimensionScore>,
    baseline: Double?,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 268.dp,
) {
    if (dimensions.size < 3) return

    val c = LexTheme.colors
    val measurer = rememberTextMeasurer()

    val axisStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = c.ink)
    val scoreStyle = TextStyle(fontSize = 10.sp, color = c.inkFaint)

    Canvas(modifier = modifier.size(size)) {
        val center = Offset(this.size.width / 2f, this.size.height / 2f)
        val radius = this.size.minDimension * 0.31f
        val n = dimensions.size

        // 网格环
        listOf(0.25f, 0.5f, 0.75f, 1f).forEach { ring ->
            val path = polygonPath(n, radius * ring, center)
            drawPath(
                path = path,
                color = c.line,
                style = Stroke(width = if (ring == 1f) 1.2f else 0.8f),
            )
        }

        // 轴线
        for (i in 0 until n) {
            drawLine(
                color = c.line,
                start = center,
                end = pointAt(i, n, radius, center),
                strokeWidth = 0.8f,
            )
        }

        // 基线参考
        if (baseline != null) {
            val basePath = Path()
            dimensions.forEachIndexed { i, d ->
                val r = radius * (baseline / d.max).coerceIn(0.0, 1.0).toFloat()
                val p = pointAt(i, n, r, center)
                if (i == 0) basePath.moveTo(p.x, p.y) else basePath.lineTo(p.x, p.y)
            }
            basePath.close()
            drawPath(
                path = basePath,
                color = c.inkFaint,
                style = Stroke(width = 1f, pathEffect = dashEffect()),
            )
        }

        // 得分区域
        val scorePath = Path()
        dimensions.forEachIndexed { i, d ->
            val r = radius * (d.score / d.max).coerceIn(0.0, 1.0).toFloat()
            val p = pointAt(i, n, r, center)
            if (i == 0) scorePath.moveTo(p.x, p.y) else scorePath.lineTo(p.x, p.y)
        }
        scorePath.close()
        drawPath(path = scorePath, color = c.accent.copy(alpha = 0.20f))
        drawPath(
            path = scorePath,
            color = c.accent,
            style = Stroke(width = 1.8f),
        )

        // 顶点
        dimensions.forEachIndexed { i, d ->
            val r = radius * (d.score / d.max).coerceIn(0.0, 1.0).toFloat()
            drawCircle(color = c.accent, radius = 3.2f, center = pointAt(i, n, r, center))
        }

        // 轴标签与分数
        dimensions.forEachIndexed { i, d ->
            val labelPoint = pointAt(i, n, radius + 30f, center)
            val axisText = measureCentered(measurer, DimensionMeta.axisLabel(d.dimension), axisStyle)
            val scoreText = measureCentered(
                measurer,
                formatScore(d.score) + " / " + formatScore(d.max),
                scoreStyle,
            )
            val above = labelPoint.y < center.y
            val axisY = if (above) labelPoint.y - axisText.size.height - 1f else labelPoint.y + 1f
            val scoreY = if (above) axisY + axisText.size.height + 1f else labelPoint.y + axisText.size.height + 2f

            drawCentered(measurer, axisText, labelPoint.x, axisY, axisStyle)
            drawCentered(measurer, scoreText, labelPoint.x, scoreY, scoreStyle)
        }
    }
}

private fun DrawScope.polygonPath(n: Int, radius: Float, center: Offset): Path {
    val path = Path()
    for (i in 0 until n) {
        val p = pointAt(i, n, radius, center)
        if (i == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
    }
    path.close()
    return path
}

private fun pointAt(index: Int, count: Int, radius: Float, center: Offset): Offset {
    // 第一个轴朝正上方，其余顺时针均分
    val angle = (-90.0 + index * 360.0 / count) * PI / 180.0
    return Offset(
        center.x + (radius * cos(angle)).toFloat(),
        center.y + (radius * sin(angle)).toFloat(),
    )
}

private fun dashEffect() = androidx.compose.ui.graphics.PathEffect.dashPathEffect(
    floatArrayOf(5f, 5f),
    0f,
)

private fun measureCentered(
    measurer: TextMeasurer,
    text: String,
    style: TextStyle,
) = measurer.measure(text = text, style = style)

private fun DrawScope.drawCentered(
    measurer: TextMeasurer,
    layout: androidx.compose.ui.text.TextLayoutResult,
    centerX: Float,
    topY: Float,
    style: TextStyle,
) {
    drawText(
        textLayoutResult = layout,
        topLeft = Offset(centerX - layout.size.width / 2f, topY),
    )
}

private fun formatScore(v: Double): String =
    if (v % 1.0 == 0.0) v.toInt().toString() else v.toString()
