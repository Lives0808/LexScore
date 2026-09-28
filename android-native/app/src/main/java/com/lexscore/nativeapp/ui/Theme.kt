package com.lexscore.nativeapp.ui

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * 配色。
 *
 * 与网页版的 CSS 变量保持同一组色值，两端视觉一致。
 * 深色模式跟随系统。
 */
data class LexColors(
    val ink: Color,
    val inkSoft: Color,
    val inkFaint: Color,
    val line: Color,
    val lineStrong: Color,
    val bg: Color,
    val card: Color,
    val accent: Color,
    val accentSolid: Color,
    val accentSoft: Color,
    val pos: Color,
    val posSoft: Color,
    val neg: Color,
    val negSoft: Color,
    val warn: Color,
    val warnSoft: Color,
    val violet: Color,
    val violetSoft: Color,
) {
    /** 分数 → 语义色，按得分率判断 */
    fun scoreColor(score: Double, max: Double): Color {
        val ratio = if (max <= 0) 0.0 else score / max
        return when {
            ratio >= 0.78 -> pos
            ratio >= 0.62 -> accent
            ratio >= 0.48 -> warn
            else -> neg
        }
    }
}

private val LightColors = LexColors(
    ink = Color(0xFF10161D),
    inkSoft = Color(0xFF56646F),
    inkFaint = Color(0xFF8B98A3),
    line = Color(0xFFE3E8EE),
    lineStrong = Color(0xFFCCD5DE),
    bg = Color(0xFFF6F8FA),
    card = Color(0xFFFFFFFF),
    accent = Color(0xFF1F4D8F),
    accentSolid = Color(0xFF1F4D8F),
    accentSoft = Color(0xFFEAF0F8),
    pos = Color(0xFF0D8050),
    posSoft = Color(0xFFE7F5EE),
    neg = Color(0xFFB8342A),
    negSoft = Color(0xFFFDECEB),
    warn = Color(0xFF9A6A10),
    warnSoft = Color(0xFFFDF4E3),
    violet = Color(0xFF5B3A8F),
    violetSoft = Color(0xFFF1ECFA),
)

private val DarkColors = LexColors(
    ink = Color(0xFFE6ECF2),
    inkSoft = Color(0xFF9AABB8),
    inkFaint = Color(0xFF6C7B88),
    line = Color(0xFF242D36),
    lineStrong = Color(0xFF38444F),
    bg = Color(0xFF0D1218),
    card = Color(0xFF151B22),
    accent = Color(0xFF7AAAE4),
    accentSolid = Color(0xFF2A5EA8),
    accentSoft = Color(0xFF17222F),
    pos = Color(0xFF4FC38F),
    posSoft = Color(0xFF12261D),
    neg = Color(0xFFEF8378),
    negSoft = Color(0xFF2B1A18),
    warn = Color(0xFFD9A441),
    warnSoft = Color(0xFF292012),
    violet = Color(0xFFAD90E0),
    violetSoft = Color(0xFF1E1A2C),
)

val LocalLexColors = staticCompositionLocalOf { LightColors }

private val LexTypography = Typography(
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 13.5.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    titleLarge = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 13.5.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 15.sp),
)

@Composable
fun LexScoreTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors

    // 状态栏跟随主题底色，避免深色模式下顶部一条亮色
    val view = LocalView.current
    if (!view.isInEditMode) {
        val window = (view.context as? Activity)?.window
        if (window != null) {
            window.statusBarColor = colors.bg.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalLexColors provides colors) {
        MaterialTheme(
            colorScheme = if (darkTheme) {
                darkColorScheme(
                    primary = colors.accentSolid,
                    background = colors.bg,
                    surface = colors.card,
                    onBackground = colors.ink,
                    onSurface = colors.ink,
                    outline = colors.line,
                )
            } else {
                lightColorScheme(
                    primary = colors.accentSolid,
                    background = colors.bg,
                    surface = colors.card,
                    onBackground = colors.ink,
                    onSurface = colors.ink,
                    outline = colors.line,
                )
            },
            typography = LexTypography,
            content = content,
        )
    }
}

/** 便于在 Composable 里取色：`LexTheme.colors.accent` */
object LexTheme {
    val colors: LexColors
        @Composable get() = LocalLexColors.current
}
