package com.lexscore.nativeapp.engine

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.lexscore.nativeapp.data.GradeEnvelope
import com.lexscore.nativeapp.data.GradeInput
import com.lexscore.nativeapp.data.InsightEnvelope
import com.lexscore.nativeapp.data.LearnerInsight
import com.lexscore.nativeapp.data.Report
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * 评分引擎桥接。
 *
 * 引擎是 TypeScript 写的，安卓端**不重写 Kotlin 版本** —— 而是把整个引擎
 * 编译成一份 JS bundle（scripts/build-engine-bundle.mjs）作为 assets 打进 APK，
 * 交给一个不可见的 WebView 执行。这样引擎源码只有一份，
 * 安卓端与网页端的结果逐字节一致。
 *
 * 为什么用 WebView 而不是 QuickJS：
 * 先试过 app.cash.quickjs，但它的 JS 栈上限在库内部写死，跑完整套分析
 * （分句、上千次正则匹配、事实推导）会抛 `stack overflow`；
 * 加大线程栈无效，因为限制来自 QuickJS 自己的 stack_limit。
 * WebView 用的是 V8，栈空间充足 —— 网页版每天都在跑同一份代码。
 *
 * 代价：多一个 WebView 实例（约 20–30MB 内存），且求值发生在主线程。
 * 后续如果要彻底去掉这一层，方向是把引擎按段移植成 Kotlin。
 */
object Engine {

    private const val HOST_PAGE = "engine-host.html"
    private const val ASSET_SAMPLES = "samples.json"
    private const val INIT_TIMEOUT_MS = 15_000L

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    @Volatile
    private var webView: WebView? = null

    @Volatile
    private var bundleVersion: String = "unknown"

    @Volatile
    private var samplesCache: List<Sample>? = null

    /**
     * 等待页面里的脚本执行完毕。
     * 用一个极小的 Android 桥接对象回调，比轮询可靠。
     */
    private class ReadySignal {
        @Volatile
        var ready = false

        @JavascriptInterface
        fun onReady() {
            ready = true
        }
    }

    /** 必须在主线程调用 */
    @SuppressLint("SetJavaScriptEnabled")
    suspend fun ensureInitialized(context: Context) = withContext(Dispatchers.Main) {
        if (webView != null) return@withContext

        val signal = ReadySignal()
        val wv = WebView(context).apply {
            settings.javaScriptEnabled = true
            // 用 file:///android_asset 加载宿主页需要打开文件访问
            settings.allowFileAccess = true
            settings.allowContentAccess = false
            settings.domStorageEnabled = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            addJavascriptInterface(signal, "LexScoreHost")
        }

        wv.loadUrl("file:///android_asset/$HOST_PAGE")

        val ok = withTimeoutOrNull(INIT_TIMEOUT_MS) {
            while (!signal.ready) delay(20)
            true
        } ?: false

        if (!ok) {
            wv.destroy()
            error("评分引擎加载超时")
        }

        bundleVersion = evaluateRaw(wv, "LexScore.version")?.trim('"') ?: "unknown"
        webView = wv
    }

    fun version(): String = bundleVersion

    /** 批改。必须在主线程调用（ViewModel 默认就在主线程）。 */
    suspend fun grade(input: GradeInput): Report {
        val wv = webView ?: error("评分引擎尚未初始化")

        // 输入作为 JS 字符串字面量直接传参。
        // kotlinx.serialization 编码出的 JSON 字符串字面量本身就是合法的 JS 字面量。
        val inner = json.encodeToString(GradeInput.serializer(), input)
        val literal = json.encodeToString(String.serializer(), inner)

        val result = evaluate(wv, "LexScore.grade($literal)")
            ?: error("引擎没有返回结果")

        // evaluateJavascript 会把字符串结果再 JSON 编码一次，这里先解回原始 JSON
        val payload = json.decodeFromString(String.serializer(), result)
        val envelope = json.decodeFromString(GradeEnvelope.serializer(), payload)
        if (!envelope.ok) error(envelope.error ?: "批改失败")
        return envelope.report ?: error("引擎返回了空报告")
    }

    /**
     * 示例作文。
     *
     * 直接读构建期生成的 samples.json，不走 JS —— 少一条可能出错的链路。
     */
    suspend fun samples(context: Context): List<Sample> = withContext(Dispatchers.IO) {
        samplesCache?.let { return@withContext it }
        val raw = context.assets.open(ASSET_SAMPLES).bufferedReader().use { it.readText() }
        val parsed = json.decodeFromString(ListSerializer(Sample.serializer()), raw)
        samplesCache = parsed
        parsed
    }

    private suspend fun evaluate(wv: WebView, expression: String): String? =
        withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { cont ->
                try {
                    wv.evaluateJavascript(expression) { value ->
                        if (cont.isActive) cont.resume(if (value == "null") null else value)
                    }
                } catch (e: Throwable) {
                    if (cont.isActive) cont.resumeWithException(e)
                }
            }
        }

    private suspend fun evaluateRaw(wv: WebView, expression: String): String? =
        evaluate(wv, expression)

    /**
     * 跨篇错误追踪。
     *
     * 分析逻辑留在 TypeScript 引擎里，这里只负责传参与解析 ——
     * 不在 Kotlin 侧重写一份，避免两端结论不一致。
     */
    suspend fun analyzeHistory(reports: List<Report>): LearnerInsight? {
        val wv = webView ?: return null
        val payload = json.encodeToString(ListSerializer(Report.serializer()), reports)
        val literal = json.encodeToString(String.serializer(), payload)

        val result = evaluate(wv, "LexScore.analyzeHistory($literal)") ?: return null
        val raw = json.decodeFromString(String.serializer(), result)
        val envelope = json.decodeFromString(InsightEnvelope.serializer(), raw)
        return if (envelope.ok) envelope.insight else null
    }
}

@Serializable
data class Sample(
    val id: String,
    val title: String,
    val subtitle: String,
    val input: GradeInput,
)
