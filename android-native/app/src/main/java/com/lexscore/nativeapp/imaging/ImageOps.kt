package com.lexscore.nativeapp.imaging

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RectF
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 拍纸面作文用到的图像处理。
 *
 * 全部用 Kotlin + Bitmap 原生实现，没有引入 OpenCV ——
 * 一是体积（OpenCV 每个 ABI 都要 20MB+），二是这里只需要四个操作：
 * 读取并摆正、自动找纸边、透视矫正、去阴影增强。
 */

/** 纸张四角，顺序固定为左上 → 右上 → 右下 → 左下 */
data class Quad(
    val tl: PointF,
    val tr: PointF,
    val br: PointF,
    val bl: PointF,
) {
    val points: List<PointF> get() = listOf(tl, tr, br, bl)

    fun scaled(sx: Float, sy: Float) = Quad(
        PointF(tl.x * sx, tl.y * sy),
        PointF(tr.x * sx, tr.y * sy),
        PointF(br.x * sx, br.y * sy),
        PointF(bl.x * sx, bl.y * sy),
    )

    /** 输出尺寸：取上下边与左右边的较长者，避免矫正后变形 */
    fun outputSize(): Pair<Int, Int> {
        val wTop = dist(tl, tr)
        val wBottom = dist(bl, br)
        val hLeft = dist(tl, bl)
        val hRight = dist(tr, br)
        return max(wTop, wBottom).roundToInt().coerceAtLeast(1) to
            max(hLeft, hRight).roundToInt().coerceAtLeast(1)
    }

    companion object {
        fun fullFrame(w: Int, h: Int) = Quad(
            PointF(0f, 0f),
            PointF(w.toFloat(), 0f),
            PointF(w.toFloat(), h.toFloat()),
            PointF(0f, h.toFloat()),
        )

        /** 默认内缩 6%，给用户一个可调整的起点 */
        fun inset(w: Int, h: Int, ratio: Float = 0.06f) = Quad(
            PointF(w * ratio, h * ratio),
            PointF(w * (1 - ratio), h * ratio),
            PointF(w * (1 - ratio), h * (1 - ratio)),
            PointF(w * ratio, h * (1 - ratio)),
        )

        private fun dist(a: PointF, b: PointF): Float =
            kotlin.math.hypot((a.x - b.x).toDouble(), (a.y - b.y).toDouble()).toFloat()
    }
}

object ImageOps {

    /** 处理时统一限制长边，兼顾速度与 OCR 精度 */
    const val MAX_DIM = 1700

    /* ------------------------------------------------------------------ *
     * 读取与摆正
     * ------------------------------------------------------------------ */

    /**
     * 按需缩放解码，并按 EXIF 方向摆正。
     *
     * 手机拍出来的照片方向信息在 EXIF 里，不处理的话送进 OCR 会是横着的。
     */
    fun loadOriented(context: Context, uri: Uri, maxDim: Int = MAX_DIM): Bitmap {
        android.util.Log.d("LexScore", "loadOriented: uri=$uri")

        // API 28+ 用 ImageDecoder：它自己处理 EXIF 方向，也支持更多编码格式
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            val source = runCatching { ImageDecoder.createSource(context.contentResolver, uri) }
                .getOrElse {
                    android.util.Log.e("LexScore", "createSource failed", it)
                    error("无法读取图片：${it.message}")
                }
            val decoded = runCatching {
                ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    decoder.isMutableRequired = false
                    val longest = maxOf(info.size.width, info.size.height)
                    if (longest > maxDim) {
                        val scale = maxDim.toFloat() / longest
                        decoder.setTargetSize(
                            (info.size.width * scale).roundToInt().coerceAtLeast(1),
                            (info.size.height * scale).roundToInt().coerceAtLeast(1),
                        )
                    }
                }
            }.getOrElse {
                android.util.Log.e("LexScore", "decodeBitmap failed", it)
                error("无法解码图片：${it.message}")
            }
            return decoded
        }

        // 旧版本回退：BitmapFactory + 手动读 EXIF
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, bounds)
        } ?: error("无法读取图片")

        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > maxDim * 2) sample *= 2

        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, opts)
        } ?: error("无法解码图片")

        val rotation = context.contentResolver.openInputStream(uri)?.use { stream ->
            when (ExifInterface(stream).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f

        val upright = if (rotation == 0f) {
            decoded
        } else {
            val m = Matrix().apply { postRotate(rotation) }
            Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, m, true)
                .also { if (it != decoded) decoded.recycle() }
        }

        return scaleToMax(upright, maxDim)
    }

    /**
     * 缩小到指定长边，**不回收源图**。
     *
     * 和 scaleToMax 分开是有原因的：detectDocumentQuad 只是「看一眼」缩略图，
     * 源图后面还要用来做透视矫正。之前误用了会回收源图的版本，
     * 导致后续 getPixels 直接抛「Can't call getPixels() on a recycled bitmap」。
     */
    fun scaleCopy(bitmap: Bitmap, maxDim: Int): Bitmap {
        val longest = max(bitmap.width, bitmap.height)
        if (longest <= maxDim) return bitmap
        val ratio = maxDim.toFloat() / longest
        return Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * ratio).roundToInt().coerceAtLeast(1),
            (bitmap.height * ratio).roundToInt().coerceAtLeast(1),
            true,
        )
    }

    /** 缩小到指定长边，并回收源图（仅在调用方不再需要源图时使用） */
    fun scaleToMax(bitmap: Bitmap, maxDim: Int): Bitmap {
        val longest = max(bitmap.width, bitmap.height)
        if (longest <= maxDim) return bitmap
        val ratio = maxDim.toFloat() / longest
        val scaled = Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * ratio).roundToInt().coerceAtLeast(1),
            (bitmap.height * ratio).roundToInt().coerceAtLeast(1),
            true,
        )
        if (scaled != bitmap) bitmap.recycle()
        return scaled
    }

    /* ------------------------------------------------------------------ *
     * 自动找纸边
     * ------------------------------------------------------------------ */

    private const val DETECT_DIM = 320

    /**
     * 自动估计纸张四角。
     *
     * 思路：纸张通常是画面里最大的一块亮区。
     * 用 Otsu 阈值把亮区二值化，再取该区域的四个极值点当作四角。
     * 纸张占比过大或过小时（说明背景也是亮的 / 根本没拍到纸），
     * 退回整幅内缩，交给用户手动调整。
     */
    fun detectDocumentQuad(bitmap: Bitmap): Quad {
        val small = scaleCopy(bitmap, DETECT_DIM)
        val recycleSmall = small !== bitmap

        val w = small.width
        val h = small.height
        val pixels = IntArray(w * h)
        small.getPixels(pixels, 0, w, 0, 0, w, h)

        val gray = IntArray(w * h) { i ->
            val p = pixels[i]
            ((Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000)
        }

        val threshold = otsu(gray)
        var bright = 0
        for (v in gray) if (v > threshold) bright++
        val ratio = bright.toFloat() / gray.size

        if (recycleSmall) small.recycle()

        // 亮区占比不合理，说明自动检测不可靠
        if (ratio < 0.12f || ratio > 0.94f) {
            return Quad.inset(bitmap.width, bitmap.height)
        }

        // 四个方向的极值点：矩形在图像坐标系下的四角
        var minSum = Int.MAX_VALUE
        var maxSum = Int.MIN_VALUE
        var minDiff = Int.MAX_VALUE
        var maxDiff = Int.MIN_VALUE
        var tlIdx = 0
        var brIdx = 0
        var trIdx = 0
        var blIdx = 0

        for (y in 0 until h) {
            val row = y * w
            for (x in 0 until w) {
                if (gray[row + x] <= threshold) continue
                val sum = x + y
                val diff = x - y
                if (sum < minSum) { minSum = sum; tlIdx = row + x }
                if (sum > maxSum) { maxSum = sum; brIdx = row + x }
                if (diff > maxDiff) { maxDiff = diff; trIdx = row + x }
                if (diff < minDiff) { minDiff = diff; blIdx = row + x }
            }
        }

        val sx = bitmap.width.toFloat() / w
        val sy = bitmap.height.toFloat() / h

        fun pointOf(index: Int) = PointF((index % w) * sx, (index / w) * sy)

        val quad = Quad(pointOf(tlIdx), pointOf(trIdx), pointOf(brIdx), pointOf(blIdx))

        // 面积太小或形状太扁，同样不可信
        val area = polygonArea(quad)
        val frame = bitmap.width.toFloat() * bitmap.height
        if (area < frame * 0.15f || area > frame * 1.02f) {
            return Quad.inset(bitmap.width, bitmap.height)
        }
        return quad
    }

    private fun polygonArea(q: Quad): Float {
        val pts = q.points
        var sum = 0f
        for (i in pts.indices) {
            val a = pts[i]
            val b = pts[(i + 1) % pts.size]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2f
    }

    private fun otsu(gray: IntArray): Int {
        val hist = IntArray(256)
        for (v in gray) hist[v.coerceIn(0, 255)]++

        val total = gray.size
        var sum = 0.0
        for (i in 0..255) sum += i.toDouble() * hist[i]

        var sumB = 0.0
        var wB = 0
        var best = 0.0
        var threshold = 127

        for (t in 0..255) {
            wB += hist[t]
            if (wB == 0) continue
            val wF = total - wB
            if (wF == 0) break

            sumB += t.toDouble() * hist[t]
            val mB = sumB / wB
            val mF = (sum - sumB) / wF
            val between = wB.toDouble() * wF * (mB - mF) * (mB - mF)

            if (between > best) {
                best = between
                threshold = t
            }
        }
        return threshold
    }

    /* ------------------------------------------------------------------ *
     * 透视矫正
     * ------------------------------------------------------------------ */

    /**
     * 把四角围出的区域拉正成矩形。
     *
     * 直接求解「目标矩形 → 原图四边形」的单应矩阵，这样每个输出像素
     * 正向查表即可，省掉一次矩阵求逆。
     */
    fun warpPerspective(src: Bitmap, quad: Quad, maxDim: Int = MAX_DIM): Bitmap {
        val (rawW, rawH) = quad.outputSize()
        val longest = max(rawW, rawH)
        val scale = if (longest > maxDim) maxDim.toFloat() / longest else 1f
        val outW = (rawW * scale).roundToInt().coerceAtLeast(1)
        val outH = (rawH * scale).roundToInt().coerceAtLeast(1)

        val dst = arrayOf(
            floatArrayOf(0f, 0f),
            floatArrayOf(outW - 1f, 0f),
            floatArrayOf(outW - 1f, outH - 1f),
            floatArrayOf(0f, outH - 1f),
        )
        val srcPts = quad.points.map { floatArrayOf(it.x, it.y) }.toTypedArray()

        val h = solveHomography(dst, srcPts)

        val srcPixels = IntArray(src.width * src.height)
        src.getPixels(srcPixels, 0, src.width, 0, 0, src.width, src.height)

        val out = IntArray(outW * outH)
        val sw = src.width
        val sh = src.height

        for (y in 0 until outH) {
            for (x in 0 until outW) {
                val denom = h[6] * x + h[7] * y + 1f
                val sx: Float
                val sy: Float
                if (abs(denom) < 1e-6f) {
                    sx = -1f
                    sy = -1f
                } else {
                    sx = (h[0] * x + h[1] * y + h[2]) / denom
                    sy = (h[3] * x + h[4] * y + h[5]) / denom
                }
                out[y * outW + x] = sampleBilinear(srcPixels, sw, sh, sx, sy)
            }
        }

        val result = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        result.setPixels(out, 0, outW, 0, 0, outW, outH)
        return result
    }

    private fun sampleBilinear(px: IntArray, w: Int, h: Int, x: Float, y: Float): Int {
        if (x < -1f || y < -1f || x > w.toFloat() || y > h.toFloat()) return Color.WHITE
        val x0 = x.toInt().coerceIn(0, w - 1)
        val y0 = y.toInt().coerceIn(0, h - 1)
        val x1 = (x0 + 1).coerceAtMost(w - 1)
        val y1 = (y0 + 1).coerceAtMost(h - 1)
        val fx = (x - x0).coerceIn(0f, 1f)
        val fy = (y - y0).coerceIn(0f, 1f)

        val p00 = px[y0 * w + x0]
        val p10 = px[y0 * w + x1]
        val p01 = px[y1 * w + x0]
        val p11 = px[y1 * w + x1]

        fun mix(c00: Int, c10: Int, c01: Int, c11: Int): Int {
            val top = c00 + (c10 - c00) * fx
            val bottom = c01 + (c11 - c01) * fx
            return (top + (bottom - top) * fy).roundToInt().coerceIn(0, 255)
        }

        return Color.rgb(
            mix(Color.red(p00), Color.red(p10), Color.red(p01), Color.red(p11)),
            mix(Color.green(p00), Color.green(p10), Color.green(p01), Color.green(p11)),
            mix(Color.blue(p00), Color.blue(p10), Color.blue(p01), Color.blue(p11)),
        )
    }

    /**
     * 解 8 元一次方程组，求出把 src 四点映射到 dst 四点的单应矩阵。
     * 返回 [h0..h7]，第 9 个元素固定为 1。
     */
    private fun solveHomography(
        src: Array<FloatArray>,
        dst: Array<FloatArray>,
    ): FloatArray {
        // 8x9 的增广矩阵
        val a = Array(8) { DoubleArray(9) }
        for (i in 0 until 4) {
            val (x, y) = src[i]
            val (u, v) = dst[i]
            a[i * 2] = doubleArrayOf(
                x.toDouble(), y.toDouble(), 1.0, 0.0, 0.0, 0.0,
                -x.toDouble() * u, -y.toDouble() * u, u.toDouble(),
            )
            a[i * 2 + 1] = doubleArrayOf(
                0.0, 0.0, 0.0, x.toDouble(), y.toDouble(), 1.0,
                -x.toDouble() * v, -y.toDouble() * v, v.toDouble(),
            )
        }

        // 高斯消元
        for (col in 0 until 8) {
            var pivot = col
            for (row in col + 1 until 8) {
                if (abs(a[row][col]) > abs(a[pivot][col])) pivot = row
            }
            val tmp = a[col]
            a[col] = a[pivot]
            a[pivot] = tmp

            val div = a[col][col]
            if (abs(div) < 1e-12) continue
            for (j in col..8) a[col][j] /= div

            for (row in 0 until 8) {
                if (row == col) continue
                val factor = a[row][col]
                if (factor == 0.0) continue
                for (j in col..8) a[row][j] -= factor * a[col][j]
            }
        }

        return FloatArray(8) { a[it][8].toFloat() }
    }

    /* ------------------------------------------------------------------ *
     * 去阴影与增强
     * ------------------------------------------------------------------ */

    /**
     * 消除光照不均与阴影，提升文字对比度。
     *
     * 做法是「背景除法」：
     *   1. 转灰度
     *   2. 大幅降采样再模糊，得到只保留光照趋势的背景图
     *   3. 原图 ÷ 背景 → 光照被归一化，阴影和明暗渐变消失
     *   4. 对比度拉伸，得到接近白底黑字的效果
     *
     * 比固定阈值抗干扰：纸面明暗不均、手影、灯光斜射都能处理。
     */
    fun cleanDocument(src: Bitmap, binarize: Boolean = false): Bitmap {
        val w = src.width
        val h = src.height
        val pixels = IntArray(w * h)
        src.getPixels(pixels, 0, w, 0, 0, w, h)

        val gray = IntArray(w * h)
        for (i in pixels.indices) {
            val p = pixels[i]
            gray[i] = (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000
        }

        // 估背景：降采样到 1/8 再盒式模糊，然后双线性放大回原尺寸
        val bgW = max(1, w / 8)
        val bgH = max(1, h / 8)
        val bg = IntArray(bgW * bgH)
        for (by in 0 until bgH) {
            val sy = (by * h / bgH).coerceIn(0, h - 1)
            for (bx in 0 until bgW) {
                val sx = (bx * w / bgW).coerceIn(0, w - 1)
                bg[by * bgW + bx] = gray[sy * w + sx]
            }
        }
        boxBlur(bg, bgW, bgH, radius = 3)

        val out = IntArray(w * h)
        for (y in 0 until h) {
            val fy = y * (bgH - 1).toFloat() / max(1, h - 1)
            val by0 = fy.toInt().coerceIn(0, bgH - 1)
            val by1 = (by0 + 1).coerceAtMost(bgH - 1)
            val wy = fy - by0

            for (x in 0 until w) {
                val fx = x * (bgW - 1).toFloat() / max(1, w - 1)
                val bx0 = fx.toInt().coerceIn(0, bgW - 1)
                val bx1 = (bx0 + 1).coerceAtMost(bgW - 1)
                val wx = fx - bx0

                val b00 = bg[by0 * bgW + bx0]
                val b10 = bg[by0 * bgW + bx1]
                val b01 = bg[by1 * bgW + bx0]
                val b11 = bg[by1 * bgW + bx1]

                val top = b00 + (b10 - b00) * wx
                val bottom = b01 + (b11 - b01) * wx
                val background = (top + (bottom - top) * wy).coerceAtLeast(1f)

                // 背景除法：把光照分量除掉
                val normalized = (gray[y * w + x] * 255f / background).coerceIn(0f, 255f)
                val v = if (binarize) {
                    if (normalized > 150f) 255 else 0
                } else {
                    // 温和的对比拉伸。
                    // 区间收得太窄会把 e / o 这类字母的内腔填死，
                    // OCR 就会把 education 认成 cducation —— 这里刻意留宽。
                    contrastStretch(normalized, low = 45f, high = 225f)
                }
                out[y * w + x] = Color.rgb(v.toInt(), v.toInt(), v.toInt())
            }
        }

        val result = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        result.setPixels(out, 0, w, 0, 0, w, h)
        return result
    }

    private fun contrastStretch(v: Float, low: Float, high: Float): Float {
        // 线性拉伸即可：加 S 曲线会压暗中间调，把字母内腔的细节吃掉
        val t = ((v - low) / (high - low)).coerceIn(0f, 1f)
        return (t * 255f).coerceIn(0f, 255f)
    }

    private fun boxBlur(data: IntArray, w: Int, h: Int, radius: Int) {
        if (radius <= 0) return
        val tmp = IntArray(data.size)

        // 横向
        for (y in 0 until h) {
            var sum = 0
            val row = y * w
            for (x in -radius..radius) sum += data[row + x.coerceIn(0, w - 1)]
            for (x in 0 until w) {
                tmp[row + x] = sum / (2 * radius + 1)
                val outIdx = (x - radius).coerceIn(0, w - 1)
                val inIdx = (x + radius + 1).coerceIn(0, w - 1)
                sum += data[row + inIdx] - data[row + outIdx]
            }
        }

        // 纵向
        for (x in 0 until w) {
            var sum = 0
            for (y in -radius..radius) sum += tmp[y.coerceIn(0, h - 1) * w + x]
            for (y in 0 until h) {
                data[y * w + x] = sum / (2 * radius + 1)
                val outIdx = (y - radius).coerceIn(0, h - 1)
                val inIdx = (y + radius + 1).coerceIn(0, h - 1)
                sum += tmp[inIdx * w + x] - tmp[outIdx * w + x]
            }
        }
    }

    /** 把用户涂抹出来的白色笔迹烘焙进图片 */
    fun applyEdits(
        base: Bitmap,
        strokes: List<EraseStroke>,
        rects: List<RectF>,
        width: Float,
    ): Bitmap {
        val out = base.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(out)
        val paint = Paint().apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            // 注意不要和参数同名：apply 里 this 是 Paint，同名会被遮蔽
            this.strokeWidth = width
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            isAntiAlias = true
        }

        for (stroke in strokes) {
            if (stroke.points.size < 2) continue
            val path = android.graphics.Path()
            path.moveTo(stroke.points[0].x, stroke.points[0].y)
            for (i in 1 until stroke.points.size) {
                path.lineTo(stroke.points[i].x, stroke.points[i].y)
            }
            canvas.drawPath(path, paint)
        }

        paint.style = Paint.Style.FILL
        for (r in rects) canvas.drawRect(r, paint)

        return out
    }
}

/**
 * 一笔涂抹（擦除用）。
 *
 * 刻意不叫 Stroke —— Compose 里已经有 drawscope.Stroke，同名会冲突。
 */
data class EraseStroke(val points: List<PointF> = emptyList()) {
    fun add(p: PointF) = EraseStroke(points + p)
}
