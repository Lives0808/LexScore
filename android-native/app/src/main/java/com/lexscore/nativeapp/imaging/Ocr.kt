package com.lexscore.nativeapp.imaging

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * 离线 OCR。
 *
 * 用 ML Kit 的拉丁文字识别，**模型随 APK 一起打包**，识别全程在本机完成，
 * 图片不会上传到任何服务器。
 */
object Ocr {

    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    suspend fun recognize(bitmap: Bitmap): String {
        val image = InputImage.fromBitmap(bitmap, 0)
        val result = suspendCancellableCoroutine { cont ->
            recognizer.process(image)
                .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
                .addOnFailureListener { e -> if (cont.isActive) cont.resumeWithException(e) }
        }
        return rebuildParagraphs(result)
    }

    /**
     * 把识别结果重组成段落。
     *
     * ML Kit 返回的是「块 → 行 → 元素」的层级结构。直接取 text 会把
     * 每一行都变成独立的一段，粘进输入框后完全没法看。
     *
     * 这里按两个经验规则重组：
     *   1. 同一个块内的行属于同一段 —— 除非上一行以句末标点结尾且下一行
     *      明显是新的开头，才断段
     *   2. 不同块之间空一行
     */
    private fun rebuildParagraphs(result: com.google.mlkit.vision.text.Text): String {
        val paragraphs = mutableListOf<String>()

        for (block in result.textBlocks) {
            val lines = block.lines.map { it.text.trim() }.filter { it.isNotEmpty() }
            if (lines.isEmpty()) continue

            val current = StringBuilder()
            for (line in lines) {
                if (current.isEmpty()) {
                    current.append(line)
                    continue
                }
                val prev = current.last()
                val endsSentence = prev == '.' || prev == '!' || prev == '?' || prev == ':' || prev == ';'
                if (endsSentence && looksLikeParagraphStart(line)) {
                    paragraphs.add(current.toString())
                    current.clear()
                    current.append(line)
                } else {
                    // 英文里同一段被 OCR 断行，用空格接回去
                    // 连字符结尾说明是断词，直接连接不加空格
                    if (prev == '-') {
                        current.deleteCharAt(current.length - 1)
                        current.append(line)
                    } else {
                        current.append(' ').append(line)
                    }
                }
            }
            if (current.isNotEmpty()) paragraphs.add(current.toString())
        }

        return paragraphs.joinToString("\n\n")
    }

    /** 首字母大写、且不是连接词开头，通常意味着新段落的开始 */
    private fun looksLikeParagraphStart(line: String): Boolean {
        val first = line.firstOrNull() ?: return false
        if (!first.isUpperCase()) return false
        val lower = line.lowercase()
        val connectors = listOf(
            "and ", "but ", "or ", "so ", "because ", "although ", "however,",
            "therefore", "which ", "that ", "who ", "while ", "if ", "when ",
        )
        return connectors.none { lower.startsWith(it) }
    }
}
