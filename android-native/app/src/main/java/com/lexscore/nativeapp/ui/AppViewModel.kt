package com.lexscore.nativeapp.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import android.net.Uri
import com.lexscore.nativeapp.data.Annotation
import com.lexscore.nativeapp.data.CorpusEntry
import com.lexscore.nativeapp.data.GradeInput
import com.lexscore.nativeapp.data.Report
import com.lexscore.nativeapp.data.ReportStore
import com.lexscore.nativeapp.data.TaskOption
import com.lexscore.nativeapp.data.TaskTypes
import com.lexscore.nativeapp.data.aggregateCorpus
import com.lexscore.nativeapp.engine.Engine
import com.lexscore.nativeapp.engine.Sample
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class Screen { Home, Report, Corpus, Camera }

data class UiState(
    val screen: Screen = Screen.Home,
    val task: TaskOption = TaskTypes.all.first(),
    val prompt: String = "",
    val essay: String = "",
    val chartData: String = "",
    val readingPoints: String = "",
    val listeningPoints: String = "",
    val busy: Boolean = false,
    val error: String? = null,
    val reports: List<Report> = emptyList(),
    val current: Report? = null,
    /** 逐句批注的筛选：维度，null 表示全部 */
    val dimensionFilter: String? = null,
    /** 逐句批注的筛选：状态 */
    val statusFilter: String = "pending",
    val engineVersion: String = "",
    val engineError: String? = null,
    val samples: List<Sample> = emptyList(),
    val loaded: Boolean = false,
) {
    val wordCount: Int
        get() = Regex("[A-Za-z][A-Za-z'’-]*").findAll(essay).count()

    val minWords: Int
        get() = when (task.id) {
            TaskTypes.IELTS_TASK2 -> 250
            TaskTypes.IELTS_TASK1 -> 150
            TaskTypes.TOEFL_INTEGRATED -> 150
            else -> 120
        }

    val corpus: List<CorpusEntry> get() = aggregateCorpus(reports)
}

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val store = ReportStore(app)

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    /**
     * 调试钩子：对指定图片跑完整的「导入 → 找纸边 → 矫正 → 去阴影 → OCR」链路，
     * 结果打到 logcat 并回填输入框。
     *
     * 用于自动化验证图像算法，避免依赖点击系统相册的坐标（很容易点偏）。
     */
    fun runOcrOnFile(relativePath: String) {
        viewModelScope.launch {
            val tag = "LexScore"
            val file = java.io.File(getApplication<Application>().cacheDir, relativePath)
            if (!file.exists()) {
                android.util.Log.e(tag, "测试图片不存在: ${file.absolutePath}")
                return@launch
            }
            runCatching {
                val started = System.currentTimeMillis()
                val uri = Uri.parse("file://${file.absolutePath}")
                val src = withContext(Dispatchers.Default) {
                    com.lexscore.nativeapp.imaging.ImageOps.loadOriented(getApplication(), uri)
                }
                val tLoad = System.currentTimeMillis()
                val quad = withContext(Dispatchers.Default) {
                    com.lexscore.nativeapp.imaging.ImageOps.detectDocumentQuad(src)
                }
                val tDetect = System.currentTimeMillis()
                val warped = withContext(Dispatchers.Default) {
                    com.lexscore.nativeapp.imaging.ImageOps.warpPerspective(src, quad)
                }
                val tWarp = System.currentTimeMillis()
                val cleaned = withContext(Dispatchers.Default) {
                    com.lexscore.nativeapp.imaging.ImageOps.cleanDocument(warped)
                }
                val tClean = System.currentTimeMillis()
                val text = com.lexscore.nativeapp.imaging.Ocr.recognize(warped)
                val tOcr = System.currentTimeMillis()

                android.util.Log.i(tag, "=== OCR 测试链路 ===")
                android.util.Log.i(tag, "原图 ${src.width}x${src.height}  " +
                    "纸边 ${quad.points.joinToString(" ") { "(%.0f,%.0f)".format(it.x, it.y) }}")
                android.util.Log.i(tag, "矫正后 ${warped.width}x${warped.height}")
                android.util.Log.i(tag, "耗时 载入 ${tLoad-started}ms · 找边 ${tDetect-tLoad}ms · " +
                    "矫正 ${tWarp-tDetect}ms · 增强 ${tClean-tWarp}ms · OCR ${tOcr-tClean}ms")
                android.util.Log.i(tag, "词数 ${text.split(Regex("[^A-Za-z']+")).count { it.isNotBlank() }}")
                android.util.Log.i(tag, "--- 识别结果开始 ---\n$text\n--- 识别结果结束 ---")

                // 把中间结果存到外部可读位置，方便拉回来看效果
                withContext(Dispatchers.IO) {
                    val outDir = java.io.File(getApplication<Application>().cacheDir, "ocr-debug")
                    outDir.mkdirs()
                    java.io.File(outDir, "warped.png").outputStream().use {
                        warped.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                    }
                    java.io.File(outDir, "cleaned.png").outputStream().use {
                        cleaned.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                    }
                }

                text
            }.onSuccess { text ->
                _state.update { it.copy(essay = text, screen = Screen.Home, error = null) }
            }.onFailure {
                android.util.Log.e(tag, "OCR 链路失败", it)
                _state.update { s -> s.copy(error = it.message ?: "OCR 测试失败") }
            }
        }
    }

    /** 调试钩子：启动后自动用第一篇示例跑一次批改 */
    private var autorunPending = false

    fun requestAutorun() {
        autorunPending = true
        maybeAutorun()
    }

    private fun maybeAutorun() {
        val s = _state.value
        if (!autorunPending || !s.loaded || s.busy || s.current != null) return
        if (s.samples.isEmpty()) return
        autorunPending = false
        loadSample(s.samples.first().id)
        grade()
    }

    init {
        viewModelScope.launch {
            Engine.ensureInitialized(getApplication())
            val reports = store.load()
            // 示例读取失败不再静默吞掉，否则界面上只是「少了一块」，很难排查
            var samples: List<Sample> = emptyList()
            var engineError: String? = null
            runCatching { Engine.samples(getApplication()) }
                .onSuccess { samples = it }
                .onFailure { e ->
                    engineError = "读取示例失败：${e.message ?: e::class.simpleName}"
                    android.util.Log.e("LexScore", "samples() failed", e)
                }
            _state.update {
                it.copy(
                    reports = reports,
                    samples = samples,
                    engineError = engineError,
                    engineVersion = Engine.version(),
                    loaded = true,
                )
            }
            // 若初始化前就请求了 autorun，这里补触发
            maybeAutorun()
        }
    }

    fun selectTask(task: TaskOption) = _state.update { it.copy(task = task, error = null) }

    fun setPrompt(v: String) = _state.update { it.copy(prompt = v) }
    fun setEssay(v: String) = _state.update { it.copy(essay = v) }
    fun setChartData(v: String) = _state.update { it.copy(chartData = v) }
    fun setReading(v: String) = _state.update { it.copy(readingPoints = v) }
    fun setListening(v: String) = _state.update { it.copy(listeningPoints = v) }
    fun dismissError() = _state.update { it.copy(error = null) }

    fun loadSample(sampleId: String) {
        val sample = _state.value.samples.firstOrNull { it.id == sampleId } ?: return
        val task = TaskTypes.all.firstOrNull { it.id == sample.input.taskType } ?: return
        _state.update {
            it.copy(
                task = task,
                prompt = sample.input.prompt,
                essay = sample.input.essay,
                chartData = sample.input.chartData.orEmpty(),
                readingPoints = sample.input.readingPoints.orEmpty().joinToString("\n"),
                listeningPoints = sample.input.listeningPoints.orEmpty().joinToString("\n"),
                error = null,
            )
        }
    }

    fun grade() {
        val s = _state.value
        if (s.essay.isBlank()) {
            _state.update { it.copy(error = "请先粘贴或输入作文内容") }
            return
        }
        _state.update { it.copy(busy = true, error = null) }

        viewModelScope.launch {
            val input = GradeInput(
                exam = s.task.exam,
                taskType = s.task.id,
                prompt = s.prompt.ifBlank { "（未填写题目）" },
                essay = s.essay,
                chartData = s.chartData.takeIf {
                    s.task.id == TaskTypes.IELTS_TASK1 && it.isNotBlank()
                },
                readingPoints = splitPoints(s.readingPoints).takeIf {
                    s.task.id == TaskTypes.TOEFL_INTEGRATED
                },
                listeningPoints = splitPoints(s.listeningPoints).takeIf {
                    s.task.id == TaskTypes.TOEFL_INTEGRATED
                },
            )

            runCatching { Engine.grade(input) }
                .onSuccess { report ->
                    store.save(report)
                    val reports = store.load()
                    _state.update {
                        it.copy(
                            busy = false,
                            current = report,
                            reports = reports,
                            screen = Screen.Report,
                            dimensionFilter = null,
                            statusFilter = "pending",
                        )
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(busy = false, error = e.message ?: "批改失败")
                    }
                }
        }
    }

    fun openReport(report: Report) = _state.update {
        it.copy(current = report, screen = Screen.Report, dimensionFilter = null, statusFilter = "pending")
    }

    fun openCorpus() = _state.update { it.copy(screen = Screen.Corpus) }
    fun openCamera() = _state.update { it.copy(screen = Screen.Camera, error = null) }
    fun openHome() = _state.update { it.copy(screen = Screen.Home) }

    /**
     * 把拍照识别的文字填进作文输入框，回到首页让用户确认后再批改。
     *
     * 不直接触发批改：OCR 难免有识别误差，让用户先过一眼更稳妥。
     */
    fun applyOcrText(text: String) = _state.update {
        it.copy(essay = text, screen = Screen.Home, error = null)
    }

    fun setDimensionFilter(v: String?) = _state.update { it.copy(dimensionFilter = v) }
    fun setStatusFilter(v: String) = _state.update { it.copy(statusFilter = v) }

    fun updateAnnotation(annotationId: String, status: String) {
        val current = _state.value.current ?: return
        val updated = current.copy(
            annotations = current.annotations.map {
                if (it.id == annotationId) it.copy(status = status) else it
            },
        )
        _state.update { it.copy(current = updated) }
        viewModelScope.launch { store.update(updated) }
    }

    /** 一键接受全部可替换的批注 */
    fun acceptAll() {
        val current = _state.value.current ?: return
        val updated = current.copy(
            annotations = current.annotations.map {
                if (it.status == "pending" && it.canApply) it.copy(status = "accepted") else it
            },
        )
        _state.update { it.copy(current = updated) }
        viewModelScope.launch { store.update(updated) }
    }

    fun deleteReport(id: String) {
        viewModelScope.launch {
            store.delete(id)
            val reports = store.load()
            _state.update { s ->
                s.copy(
                    reports = reports,
                    current = s.current?.takeIf { it.id != id },
                    screen = if (s.screen == Screen.Report && s.current?.id == id) Screen.Home else s.screen,
                )
            }
        }
    }

    fun clearAll() {
        viewModelScope.launch {
            store.clear()
            _state.update { it.copy(reports = emptyList(), current = null, screen = Screen.Home) }
        }
    }

    private fun splitPoints(raw: String): List<String> =
        raw.split("\n")
            .map { it.replace(Regex("^\\s*\\d+[.、)]\\s*"), "").trim() }
            .filter { it.isNotEmpty() }

    /** 导出修改稿：把已接受的替换应用到全文 */
    suspend fun buildRevisedEssay(report: Report): String = withContext(Dispatchers.Default) {
        report.sentences.joinToString(" ") { sentence ->
            applyAccepted(sentence.text, report.annotations.filter { it.sentenceId == sentence.id })
        }
    }
}

/** 把已接受的替换写回句子；未接受或仅建议的保持原样 */
fun applyAccepted(sentenceText: String, annotations: List<Annotation>): String {
    val spans = annotations
        .mapNotNull { a ->
            val idx = sentenceText.indexOf(a.target)
            if (idx < 0) null else Triple(idx, idx + a.target.length, a)
        }
        .filter { it.third.status == "accepted" && it.third.canApply }
        .sortedBy { it.first }

    if (spans.isEmpty()) return sentenceText

    val sb = StringBuilder()
    var cursor = 0
    for ((start, end, a) in spans) {
        if (start < cursor) continue
        sb.append(sentenceText, cursor, start)
        sb.append(a.replacement)
        cursor = end
    }
    sb.append(sentenceText, cursor, sentenceText.length)
    return sb.toString()
}
