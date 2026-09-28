package com.lexscore.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lexscore.nativeapp.data.TaskTypes
import com.lexscore.nativeapp.ui.components.Badge
import com.lexscore.nativeapp.ui.components.BodyText
import com.lexscore.nativeapp.ui.components.SectionCard
import com.lexscore.nativeapp.ui.components.Tone

@Composable
fun HomeScreen(
    state: UiState,
    onSelectTask: (com.lexscore.nativeapp.data.TaskOption) -> Unit,
    onPrompt: (String) -> Unit,
    onEssay: (String) -> Unit,
    onChartData: (String) -> Unit,
    onReading: (String) -> Unit,
    onListening: (String) -> Unit,
    onLoadSample: (String) -> Unit,
    onGrade: () -> Unit,
    onOpenReport: (com.lexscore.nativeapp.data.Report) -> Unit,
    onOpenCorpus: () -> Unit,
    onDeleteReport: (String) -> Unit,
) {
    val c = LexTheme.colors

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column {
                Text(
                    "把作文交给考官的标准来批",
                    color = c.ink,
                    fontSize = 21.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(6.dp))
                BodyText(
                    "每一处修改都标注对应的评分项与提分幅度，每一项打分都附评分依据的原文引用。" +
                        "全部在本机完成，不联网、不上传。",
                )
            }
        }

        // 任务类型
        item {
            SectionCard {
                Text("任务类型", color = c.inkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TaskTypes.all.filter { it.examLabel == "雅思" }.forEach { t ->
                        TaskChip(t, state.task.id == t.id, { onSelectTask(t) }, Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TaskTypes.all.filter { it.examLabel == "托福" }.forEach { t ->
                        TaskChip(t, state.task.id == t.id, { onSelectTask(t) }, Modifier.weight(1f))
                    }
                }
            }
        }

        // 题目
        item {
            SectionCard {
                FieldLabel("题目 / Prompt")
                Spacer(Modifier.height(6.dp))
                LexTextField(
                    value = state.prompt,
                    onValueChange = onPrompt,
                    placeholder = "把题目原文粘贴进来。扣题度诊断与话题词伙推荐都依赖它。",
                    minLines = 3,
                )
            }
        }

        // 雅思小作文：图表数据
        if (state.task.id == TaskTypes.IELTS_TASK1) {
            item {
                SectionCard {
                    FieldLabel("图表数据", "每行一条，用于检测关键数据有没有遗漏")
                    Spacer(Modifier.height(6.dp))
                    LexTextField(
                        value = state.chartData,
                        onValueChange = onChartData,
                        placeholder = "煤炭 1990: 45% → 2010: 28%\n天然气 1990: 20% → 2010: 33%",
                        minLines = 4,
                    )
                }
            }
        }

        // 托福综合写作：阅读 + 听力论点
        if (state.task.id == TaskTypes.TOEFL_INTEGRATED) {
            item {
                SectionCard {
                    FieldLabel("阅读材料的三个论点", "每行一个，需与作文语言一致")
                    Spacer(Modifier.height(6.dp))
                    LexTextField(
                        value = state.readingPoints,
                        onValueChange = onReading,
                        placeholder = "1. Chain stores drive small shops out of business.",
                        minLines = 3,
                    )
                    Spacer(Modifier.height(12.dp))
                    FieldLabel("听力材料的三个反驳点", "每行一个")
                    Spacer(Modifier.height(6.dp))
                    LexTextField(
                        value = state.listeningPoints,
                        onValueChange = onListening,
                        placeholder = "1. Consumers save money, which stays in the local economy.",
                        minLines = 3,
                    )
                }
            }
        }

        // 作文
        item {
            SectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FieldLabel("作文正文")
                    Text(
                        "${state.wordCount} 词 / 要求 ≥ ${state.minWords}",
                        color = if (state.wordCount >= state.minWords) c.pos else c.inkFaint,
                        fontSize = 11.5.sp,
                    )
                }
                Spacer(Modifier.height(6.dp))
                LexTextField(
                    value = state.essay,
                    onValueChange = onEssay,
                    placeholder = "粘贴作文正文。段落之间请空行分隔，引擎会据此判断段落结构。",
                    minLines = 10,
                )
            }
        }

        // 引擎层错误（与用户输入错误分开显示，便于定位问题）
        state.engineError?.let { msg ->
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(c.warnSoft)
                        .border(1.dp, c.warn.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                        .padding(13.dp),
                ) {
                    Text(msg, color = c.warn, fontSize = 12.5.sp)
                }
            }
        }

        // 错误
        state.error?.let { msg ->
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(c.negSoft)
                        .border(1.dp, c.neg.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(13.dp),
                ) {
                    Text(msg, color = c.neg, fontSize = 12.5.sp)
                }
            }
        }

        // 提交
        item {
            Button(
                onClick = onGrade,
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = c.accentSolid),
            ) {
                if (state.busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = c.card,
                        strokeWidth = 2.dp,
                    )
                    Spacer(Modifier.size(10.dp))
                    Text("批改中…", fontSize = 15.sp)
                } else {
                    Text("开始批改", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }

        // 示例
        if (state.samples.isNotEmpty()) {
            item {
                SectionCard {
                    Text("没有作文？用示例试一下", color = c.inkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(10.dp))
                    state.samples.forEach { s ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(9.dp))
                                .border(1.dp, c.line, RoundedCornerShape(9.dp))
                                .clickable { onLoadSample(s.id) }
                                .padding(11.dp),
                        ) {
                            Column {
                                Text(s.title, color = c.ink, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                                Spacer(Modifier.height(2.dp))
                                Text(s.subtitle, color = c.inkFaint, fontSize = 11.sp)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }

        // 历史
        item {
            SectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("历史批改（${state.reports.size}）", color = c.inkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    if (state.reports.isNotEmpty()) {
                        Text(
                            "查看语料库 →",
                            color = c.accent,
                            fontSize = 11.5.sp,
                            modifier = Modifier.clickable { onOpenCorpus() },
                        )
                    }
                }
                if (state.reports.isEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    BodyText("还没有记录。批改完成后会自动保存在本机。", size = 11.5f)
                }
            }
        }

        items(state.reports, key = { it.id }) { report ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(c.card)
                    .border(1.dp, c.line, RoundedCornerShape(10.dp))
                    .clickable { onOpenReport(report) }
                    .padding(13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        report.prompt.take(40).ifBlank { report.taskLabel },
                        color = c.ink,
                        fontSize = 12.5.sp,
                        maxLines = 2,
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        "${report.overallLabel} · ${report.wordCount} 词 · ${formatDate(report.createdAt)}",
                        color = c.inkFaint,
                        fontSize = 11.sp,
                    )
                }
                Badge(
                    if (report.exam == "ielts") "Band ${formatScore(report.overall)}" else "${report.overall.toInt()} / 30",
                    Tone.Accent,
                )
                Spacer(Modifier.size(6.dp))
                Text(
                    "×",
                    color = c.inkFaint,
                    fontSize = 18.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { onDeleteReport(report.id) }
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }

        item {
            Spacer(Modifier.height(4.dp))
            BodyText(
                "引擎版本 ${state.engineVersion} · 全部计算在本机完成",
                size = 11f,
            )
        }
    }
}

@Composable
private fun TaskChip(
    task: com.lexscore.nativeapp.data.TaskOption,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = LexTheme.colors
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) c.accentSoft else c.card)
            .border(1.dp, if (selected) c.accent else c.line, RoundedCornerShape(9.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 9.dp),
    ) {
        Text(
            task.shortName,
            color = if (selected) c.accent else c.ink,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(1.dp))
        Text(task.hint, color = c.inkFaint, fontSize = 10.5.sp, lineHeight = 14.sp)
    }
}

@Composable
fun FieldLabel(text: String, hint: String? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, color = LexTheme.colors.inkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
        if (hint != null) Text(hint, color = LexTheme.colors.inkFaint, fontSize = 11.sp)
    }
}

@Composable
fun LexTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    minLines: Int,
) {
    val c = LexTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = c.inkFaint, fontSize = 12.5.sp, lineHeight = 19.sp) },
        modifier = Modifier.fillMaxWidth(),
        minLines = minLines,
        shape = RoundedCornerShape(9.dp),
        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.5.sp, lineHeight = 22.sp),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = c.card,
            unfocusedContainerColor = c.bg,
            focusedIndicatorColor = c.accent,
            unfocusedIndicatorColor = c.line,
            focusedTextColor = c.ink,
            unfocusedTextColor = c.ink,
            cursorColor = c.accent,
        ),
    )
}

fun formatScore(v: Double): String =
    if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.1f", v)

fun formatDate(epochMillis: Long): String {
    val fmt = java.text.SimpleDateFormat("M月d日", java.util.Locale.CHINA)
    return fmt.format(java.util.Date(epochMillis))
}
