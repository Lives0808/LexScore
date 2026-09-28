package com.lexscore.nativeapp.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * 本地存储。
 *
 * 报告与语料都存在应用私有目录下的一个 JSON 文件里，
 * 不需要账号体系、不联网、不申请任何权限。
 * 卸载 App 或清除数据即全部删除。
 */
class ReportStore(private val context: Context) {

    private val file: File get() = File(context.filesDir, "reports.json")

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    @Volatile
    private var cache: List<Report>? = null

    suspend fun load(): List<Report> = withContext(Dispatchers.IO) {
        cache?.let { return@withContext it }
        val loaded = runCatching {
            if (!file.exists()) emptyList()
            else json.decodeFromString(ListSerializer(Report.serializer()), file.readText())
        }.getOrElse { emptyList() }
        val sorted = loaded.sortedByDescending { it.createdAt }
        cache = sorted
        sorted
    }

    suspend fun save(report: Report) = withContext(Dispatchers.IO) {
        val current = load().filterNot { it.id == report.id }
        val next = (listOf(report) + current).take(MAX_REPORTS)
        persist(next)
        cache = next
    }

    suspend fun update(report: Report) = withContext(Dispatchers.IO) {
        val next = load().map { if (it.id == report.id) report else it }
        persist(next)
        cache = next
    }

    suspend fun delete(id: String) = withContext(Dispatchers.IO) {
        val next = load().filterNot { it.id == id }
        persist(next)
        cache = next
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        file.delete()
        cache = emptyList()
    }

    private fun persist(list: List<Report>) {
        runCatching {
            val tmp = File(file.parentFile, "reports.json.tmp")
            tmp.writeText(json.encodeToString(ListSerializer(Report.serializer()), list))
            // 先写临时文件再替换，避免写入过程中被杀导致数据损坏
            if (!tmp.renameTo(file)) {
                file.writeText(tmp.readText())
                tmp.delete()
            }
        }
    }

    private companion object {
        const val MAX_REPORTS = 100
    }
}

/** 语料聚合：跨报告去重并统计出现次数 */
data class CorpusEntry(
    val item: CorpusItem,
    val occurrences: Int,
)

fun aggregateCorpus(reports: List<Report>): List<CorpusEntry> {
    val seen = LinkedHashMap<String, CorpusEntry>()
    for (report in reports) {
        for (item in report.corpus) {
            val key = "${item.kind}|${item.text.lowercase()}"
            val existing = seen[key]
            if (existing != null) {
                seen[key] = existing.copy(occurrences = existing.occurrences + 1)
            } else {
                seen[key] = CorpusEntry(item, 1)
            }
        }
    }
    return seen.values.sortedWith(
        compareByDescending<CorpusEntry> { it.occurrences }.thenByDescending { it.item.createdAt },
    )
}
