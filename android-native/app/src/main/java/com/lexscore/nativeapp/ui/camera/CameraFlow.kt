package com.lexscore.nativeapp.ui.camera

import android.graphics.Bitmap
import android.graphics.PointF
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.lexscore.nativeapp.imaging.ImageOps
import com.lexscore.nativeapp.imaging.Ocr
import com.lexscore.nativeapp.imaging.Quad
import com.lexscore.nativeapp.imaging.EraseStroke
import com.lexscore.nativeapp.ui.LexTheme
import com.lexscore.nativeapp.ui.components.Badge
import com.lexscore.nativeapp.ui.components.BodyText
import com.lexscore.nativeapp.ui.components.SectionCard
import com.lexscore.nativeapp.ui.components.Tone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

private enum class Step { Source, Crop, Cleanup, Result }

/** 清理页的两种工具 */
private enum class Tool { EraseBrush, EraseRect }

/**
 * 拍照批改流程。
 *
 * 拍照 → 自动裁剪矫正 → 去阴影增强 + 手动擦除 → OCR → 回填作文输入框。
 * 全程离线：OCR 模型打包在 APK 里，图片不离开设备。
 */
@Composable
fun CameraFlowScreen(
    onApplyText: (String) -> Unit,
    onCancel: () -> Unit,
) {
    val c = LexTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf(Step.Source) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    var original by remember { mutableStateOf<Bitmap?>(null) }
    var quad by remember { mutableStateOf<Quad?>(null) }
    var warped by remember { mutableStateOf<Bitmap?>(null) }
    var cleaned by remember { mutableStateOf<Bitmap?>(null) }
    var enhanced by remember { mutableStateOf(true) }

    var strokes by remember { mutableStateOf<List<EraseStroke>>(emptyList()) }
    var rects by remember { mutableStateOf<List<android.graphics.RectF>>(emptyList()) }
    var tool by remember { mutableStateOf(Tool.EraseBrush) }
    var ocrText by remember { mutableStateOf("") }

    // 拍照输出的临时文件
    var pendingUri by remember { mutableStateOf<Uri?>(null) }

    fun newCaptureUri(): Uri {
        val dir = File(context.cacheDir, "captures").apply { mkdirs() }
        val file = File(dir, "shot_${System.currentTimeMillis()}.jpg")
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun loadAndDetect(uri: Uri) {
        busy = true
        error = null
        status = "正在读取图片…"
        scope.launch {
            runCatching {
                withContext(Dispatchers.Default) {
                    val bmp = ImageOps.loadOriented(context, uri)
                    val detected = ImageOps.detectDocumentQuad(bmp)
                    bmp to detected
                }
            }.onSuccess { (bmp, detected) ->
                original = bmp
                quad = detected
                step = Step.Crop
                busy = false
            }.onFailure {
                error = it.message ?: "读取图片失败"
                busy = false
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { ok ->
        val uri = pendingUri
        if (ok && uri != null) loadAndDetect(uri) else if (!ok) busy = false
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> if (uri != null) loadAndDetect(uri) }

    fun runEnhance(base: Bitmap) {
        busy = true
        status = "正在去阴影、增强文字…"
        scope.launch {
            runCatching { withContext(Dispatchers.Default) { ImageOps.cleanDocument(base) } }
                .onSuccess {
                    cleaned = it
                    enhanced = true
                    busy = false
                }
                .onFailure {
                    error = it.message ?: "图像增强失败"
                    busy = false
                }
        }
    }

    fun applyWarp() {
        val src = original ?: return
        val q = quad ?: return
        busy = true
        status = "正在矫正…"
        scope.launch {
            runCatching { withContext(Dispatchers.Default) { ImageOps.warpPerspective(src, q) } }
                .onSuccess {
                    warped = it
                    cleaned = null
                    strokes = emptyList()
                    rects = emptyList()
                    step = Step.Cleanup
                    busy = false
                    // 进入清理页后立刻跑一次自动增强
                    runEnhance(it)
                }
                .onFailure {
                    error = it.message ?: "矫正失败"
                    busy = false
                }
        }
    }

    /**
     * 把擦除笔迹烘进图片。
     *
     * 关键：**始终基于矫正后的原图**，而不是增强图。
     * A/B 实测过：同一张图，OCR 跑未增强版本 100% 正确，
     * 跑增强版本出现 frce / cducation / Alhough 三处误识 ——
     * 对比度拉伸抹掉了灰色抗锯齿边缘，而 ML Kit 正是靠这些细节分辨字母。
     * 所以「自动增强」只作为给人看的辅助，不进 OCR 输入。
     */
    fun bakeEdits(): Bitmap? {
        val base = warped ?: return null
        if (strokes.isEmpty() && rects.isEmpty()) return base
        val bitmap = base
        val widthDip = 18f * context.resources.displayMetrics.density *
            (bitmap.width / 1080f).coerceAtLeast(0.5f)
        return ImageOps.applyEdits(bitmap, strokes, rects, widthDip)
    }

    fun runOcr() {
        val baked = bakeEdits() ?: return
        busy = true
        status = "正在识别文字…"
        scope.launch {
            runCatching { Ocr.recognize(baked) }
                .onSuccess {
                    ocrText = it
                    step = Step.Result
                    busy = false
                }
                .onFailure {
                    error = it.message ?: "识别失败"
                    busy = false
                }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(c.bg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 顶部标题栏
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(c.card)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "取消",
                    color = c.accent,
                    fontSize = 13.sp,
                    modifier = Modifier.clickable { onCancel() }.padding(4.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = when (step) {
                        Step.Source -> "拍照批改"
                        Step.Crop -> "裁剪与矫正"
                        Step.Cleanup -> "清理与增强"
                        Step.Result -> "识别结果"
                    },
                    color = c.ink,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = c.accent,
                        strokeWidth = 2.dp,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(status, color = c.inkFaint, fontSize = 11.sp)
                }
            }

            error?.let { msg ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(c.negSoft)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                ) {
                    Text(msg, color = c.neg, fontSize = 12.5.sp)
                }
            }

            when (step) {
                Step.Source -> SourceStep(
                    onCamera = {
                        val uri = newCaptureUri()
                        pendingUri = uri
                        cameraLauncher.launch(uri)
                    },
                    onGallery = {
                        galleryLauncher.launch(
                            PickVisualMediaRequest(
                                ActivityResultContracts.PickVisualMedia.ImageOnly,
                            ),
                        )
                    },
                )

                Step.Crop -> CropStep(
                    bitmap = original,
                    quad = quad,
                    onQuadChange = { quad = it },
                    onRedetect = {
                        original?.let { quad = ImageOps.detectDocumentQuad(it) }
                    },
                    onConfirm = { applyWarp() },
                )

                Step.Cleanup -> CleanupStep(
                    warped = warped,
                    cleaned = cleaned,
                    enhanced = enhanced,
                    strokes = strokes,
                    rects = rects,
                    tool = tool,
                    onToolChange = { tool = it },
                    onStrokeAdd = { strokes = strokes + it },
                    onStrokeUpdate = { idx, s ->
                        strokes = strokes.toMutableList().also { it[idx] = s }
                    },
                    onRectAdd = { rects = rects + it },
                    onUndo = {
                        if (rects.isNotEmpty()) rects = rects.dropLast(1)
                        else if (strokes.isNotEmpty()) strokes = strokes.dropLast(1)
                    },
                    onToggleEnhance = {
                        val base = warped ?: return@CleanupStep
                        if (enhanced) {
                            cleaned = null
                            enhanced = false
                        } else {
                            runEnhance(base)
                        }
                    },
                    onConfirm = { runOcr() },
                )

                Step.Result -> ResultStep(
                    text = ocrText,
                    onTextChange = { ocrText = it },
                    onRetry = {
                        strokes = emptyList()
                        rects = emptyList()
                        step = Step.Cleanup
                    },
                    onApply = { onApplyText(ocrText) },
                )
            }
        }
    }
}

/* ------------------------------------------------------------------ *
 * 第一步：选择来源
 * ------------------------------------------------------------------ */

@Composable
private fun SourceStep(onCamera: () -> Unit, onGallery: () -> Unit) {
    val c = LexTheme.colors
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SectionCard {
            Text("拍一张纸面作文", color = c.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            BodyText(
                "拍摄或选择一张图片，接下来会自动找纸边、矫正倾斜、去阴影，" +
                    "再识别出英文文字填进作文输入框。\n\n" +
                    "识别全程在本机完成，图片不会上传到任何服务器。",
            )
        }

        Button(
            onClick = onCamera,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = c.accentSolid),
        ) {
            Text("调用摄像头拍摄", fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }

        Button(
            onClick = onGallery,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = c.card,
                contentColor = c.ink,
            ),
        ) {
            Text("从相册选择图片", fontSize = 15.sp)
        }

        SectionCard {
            Text("拍摄建议", color = c.inkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(6.dp))
            BodyText(
                "· 把作文放平，尽量占满画面\n" +
                    "· 避免手影和强烈的明暗交界\n" +
                    "· 光线均匀比亮度高更重要\n" +
                    "· 斜着拍也没关系，会自动矫正",
                size = 12f,
                lineHeight = 20f,
            )
        }
    }
}

/* ------------------------------------------------------------------ *
 * 第二步：裁剪与矫正
 * ------------------------------------------------------------------ */

@Composable
private fun CropStep(
    bitmap: Bitmap?,
    quad: Quad?,
    onQuadChange: (Quad) -> Unit,
    onRedetect: () -> Unit,
    onConfirm: () -> Unit,
) {
    val c = LexTheme.colors
    if (bitmap == null || quad == null) return

    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var dragging by remember { mutableStateOf(-1) }

    val scale = if (canvasSize.width == 0 || canvasSize.height == 0) {
        1f
    } else {
        min(
            canvasSize.width.toFloat() / bitmap.width,
            canvasSize.height.toFloat() / bitmap.height,
        )
    }
    val offsetX = (canvasSize.width - bitmap.width * scale) / 2f
    val offsetY = (canvasSize.height - bitmap.height * scale) / 2f

    fun toScreen(p: PointF) = Offset(offsetX + p.x * scale, offsetY + p.y * scale)
    fun toBitmap(o: Offset) = PointF(
        ((o.x - offsetX) / scale).coerceIn(0f, bitmap.width.toFloat()),
        ((o.y - offsetY) / scale).coerceIn(0f, bitmap.height.toFloat()),
    )

    Column(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color(0xFF101619))
                .onSizeChanged { canvasSize = it }
                .pointerInput(bitmap, quad, canvasSize) {
                    detectDragGestures(
                        onDragStart = { start ->
                            // 抓取最近的角点
                            var best = -1
                            var bestDist = 64f
                            quad.points.forEachIndexed { i, p ->
                                val sp = toScreen(p)
                                val d = kotlin.math.hypot(
                                    (sp.x - start.x).toDouble(),
                                    (sp.y - start.y).toDouble(),
                                ).toFloat()
                                if (d < bestDist) {
                                    bestDist = d
                                    best = i
                                }
                            }
                            dragging = best
                        },
                        onDragEnd = { dragging = -1 },
                        onDrag = { change, _ ->
                            val idx = dragging
                            if (idx >= 0) {
                                val p = toBitmap(change.position)
                                val pts = quad.points.toMutableList()
                                pts[idx] = p
                                onQuadChange(Quad(pts[0], pts[1], pts[2], pts[3]))
                            }
                        },
                    )
                },
        ) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
            )

            Canvas(modifier = Modifier.fillMaxSize()) {
                if (scale == 1f && canvasSize.width == 0) return@Canvas
                val pts = quad.points.map { toScreen(it) }

                // 四边形边框
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(pts[0].x, pts[0].y)
                    for (i in 1 until pts.size) lineTo(pts[i].x, pts[i].y)
                    close()
                }
                drawPath(path, Color(0xFF4C8DF6), style = Stroke(width = 3f))

                // 四角拖拽手柄
                pts.forEach { p ->
                    drawCircle(Color.White, radius = 13f, center = p)
                    drawCircle(Color(0xFF4C8DF6), radius = 13f, center = p, style = Stroke(3f))
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(c.card)
                .padding(14.dp),
        ) {
            BodyText("拖动四个角，把边框对准纸张边缘。斜着拍也没关系。", size = 12.5f)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TextButton(onClick = onRedetect) {
                    Text("自动检测", color = c.accent, fontSize = 13.sp)
                }
                TextButton(onClick = { onQuadChange(Quad.fullFrame(bitmap.width, bitmap.height)) }) {
                    Text("用整张图", color = c.inkSoft, fontSize = 13.sp)
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = onConfirm,
                    shape = RoundedCornerShape(9.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accentSolid),
                ) {
                    Text("矫正", fontSize = 14.sp)
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ *
 * 第三步：清理与增强
 * ------------------------------------------------------------------ */

@Composable
private fun CleanupStep(
    warped: Bitmap?,
    cleaned: Bitmap?,
    enhanced: Boolean,
    strokes: List<EraseStroke>,
    rects: List<android.graphics.RectF>,
    tool: Tool,
    onToolChange: (Tool) -> Unit,
    onStrokeAdd: (EraseStroke) -> Unit,
    onStrokeUpdate: (Int, EraseStroke) -> Unit,
    onRectAdd: (android.graphics.RectF) -> Unit,
    onUndo: () -> Unit,
    onToggleEnhance: () -> Unit,
    onConfirm: () -> Unit,
) {
    val c = LexTheme.colors
    val display = cleaned ?: warped ?: return

    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var rectStart by remember { mutableStateOf<Offset?>(null) }
    var rectEnd by remember { mutableStateOf<Offset?>(null) }

    val scale = if (canvasSize.width == 0 || canvasSize.height == 0) {
        1f
    } else {
        min(
            canvasSize.width.toFloat() / display.width,
            canvasSize.height.toFloat() / display.height,
        )
    }
    val offsetX = (canvasSize.width - display.width * scale) / 2f
    val offsetY = (canvasSize.height - display.height * scale) / 2f

    fun toScreen(p: PointF) = Offset(offsetX + p.x * scale, offsetY + p.y * scale)
    fun toBitmap(o: Offset) = PointF(
        ((o.x - offsetX) / scale).coerceIn(0f, display.width.toFloat()),
        ((o.y - offsetY) / scale).coerceIn(0f, display.height.toFloat()),
    )

    Column(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color(0xFF101619))
                .onSizeChanged { canvasSize = it }
                .pointerInput(display, tool, strokes, rects, canvasSize) {
                    detectDragGestures(
                        onDragStart = { start ->
                            when (tool) {
                                Tool.EraseBrush -> onStrokeAdd(EraseStroke(listOf(toBitmap(start))))
                                Tool.EraseRect -> {
                                    rectStart = start
                                    rectEnd = start
                                }
                            }
                        },
                        onDragEnd = {
                            val s = rectStart
                            val e = rectEnd
                            if (tool == Tool.EraseRect && s != null && e != null) {
                                val p1 = toBitmap(s)
                                val p2 = toBitmap(e)
                                onRectAdd(
                                    android.graphics.RectF(
                                        min(p1.x, p2.x),
                                        min(p1.y, p2.y),
                                        max(p1.x, p2.x),
                                        max(p1.y, p2.y),
                                    ),
                                )
                            }
                            rectStart = null
                            rectEnd = null
                        },
                        onDrag = { change, _ ->
                            val p = toBitmap(change.position)
                            when (tool) {
                                Tool.EraseBrush -> {
                                    val last = strokes.lastOrNull() ?: return@detectDragGestures
                                    onStrokeUpdate(strokes.size - 1, last.add(p))
                                }
                                Tool.EraseRect -> rectEnd = change.position
                            }
                        },
                    )
                },
        ) {
            Image(
                bitmap = display.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
            )

            Canvas(modifier = Modifier.fillMaxSize()) {
                if (scale == 1f && canvasSize.width == 0) return@Canvas

                // 已经涂抹的擦除笔迹
                for (stroke in strokes) {
                    if (stroke.points.size < 2) continue
                    val path = androidx.compose.ui.graphics.Path().apply {
                        val first = toScreen(stroke.points[0])
                        moveTo(first.x, first.y)
                        for (i in 1 until stroke.points.size) {
                            val sp = toScreen(stroke.points[i])
                            lineTo(sp.x, sp.y)
                        }
                    }
                    drawPath(
                        path,
                        Color.White,
                        style = Stroke(width = 18f * scale.coerceAtLeast(0.4f), cap = androidx.compose.ui.graphics.StrokeCap.Round),
                    )
                }

                // 已框选的矩形
                for (r in rects) {
                    val tl = toScreen(PointF(r.left, r.top))
                    val br = toScreen(PointF(r.right, r.bottom))
                    drawRect(
                        Color.White,
                        topLeft = tl,
                        size = Size(br.x - tl.x, br.y - tl.y),
                    )
                }

                // 正在拖的矩形
                val s = rectStart
                val e = rectEnd
                if (tool == Tool.EraseRect && s != null && e != null) {
                    val l = min(s.x, e.x)
                    val t = min(s.y, e.y)
                    drawRect(
                        Color.White.copy(alpha = 0.85f),
                        topLeft = Offset(l, t),
                        size = Size(abs(e.x - s.x), abs(e.y - s.y)),
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(c.card)
                .padding(14.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ToolChip("擦除笔刷", tool == Tool.EraseBrush) { onToolChange(Tool.EraseBrush) }
                ToolChip("框选擦除", tool == Tool.EraseRect) { onToolChange(Tool.EraseRect) }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onUndo) {
                    Text("撤销", color = c.inkSoft, fontSize = 13.sp)
                }
                TextButton(onClick = onToggleEnhance) {
                    Text(
                        if (enhanced) "看原图" else "自动增强",
                        color = c.accent,
                        fontSize = 13.sp,
                    )
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = onConfirm,
                    shape = RoundedCornerShape(9.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = c.accentSolid),
                ) {
                    Text("识别文字", fontSize = 14.sp)
                }
            }
            Spacer(Modifier.height(6.dp))
            BodyText(
                "涂抹或框选可以擦掉多余的笔迹、涂改痕迹，只保留作文正文。" +
                    "「自动增强」会去阴影并提升文字对比度。",
                size = 11.5f,
                lineHeight = 18f,
            )
        }
    }
}

@Composable
private fun ToolChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = LexTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) c.accentSolid else c.card)
            .border(1.dp, if (selected) c.accentSolid else c.line, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (selected) Color.White else c.inkSoft,
            fontSize = 12.5.sp,
        )
    }
}

/* ------------------------------------------------------------------ *
 * 第四步：识别结果
 * ------------------------------------------------------------------ */

@Composable
private fun ResultStep(
    text: String,
    onTextChange: (String) -> Unit,
    onRetry: () -> Unit,
    onApply: () -> Unit,
) {
    val c = LexTheme.colors
    Column(modifier = Modifier.fillMaxSize().padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("识别结果", color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(8.dp))
            Badge("${text.split(Regex("\\s+")).count { it.isNotBlank() }} 词", Tone.Accent)
        }
        Spacer(Modifier.height(4.dp))
        BodyText("识别难免有误差，确认无误后再填入。可以直接在这里修改。", size = 11.5f)
        Spacer(Modifier.height(10.dp))

        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.fillMaxWidth().weight(1f),
            shape = RoundedCornerShape(9.dp),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.5.sp, lineHeight = 22.sp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = c.card,
                unfocusedContainerColor = c.card,
                focusedIndicatorColor = c.accent,
                unfocusedIndicatorColor = c.line,
                focusedTextColor = c.ink,
                unfocusedTextColor = c.ink,
                cursorColor = c.accent,
            ),
        )

        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TextButton(onClick = onRetry) {
                Text("回去重新处理", color = c.inkSoft, fontSize = 13.sp)
            }
            Spacer(Modifier.weight(1f))
            Button(
                onClick = onApply,
                enabled = text.isNotBlank(),
                shape = RoundedCornerShape(9.dp),
                colors = ButtonDefaults.buttonColors(containerColor = c.accentSolid),
            ) {
                Text("填入作文并批改", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}
