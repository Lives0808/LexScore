package com.lexscore.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.lexscore.nativeapp.ui.AppViewModel
import com.lexscore.nativeapp.ui.CorpusScreen
import com.lexscore.nativeapp.ui.HomeScreen
import com.lexscore.nativeapp.ui.LexScoreTheme
import com.lexscore.nativeapp.ui.LexTheme
import com.lexscore.nativeapp.ui.ReportScreen
import com.lexscore.nativeapp.ui.Screen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // 调试钩子：am start ... --ez lexscore_autorun true
        // 会用第一篇示例作文自动跑一次批改，便于自动化验证整条链路。
        val autorun = intent?.getBooleanExtra(EXTRA_AUTORUN, false) ?: false

        setContent {
            LexScoreTheme {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(LexTheme.colors.bg),
                ) {
                    AppRoot(autorun = autorun)
                }
            }
        }
    }

    private companion object {
        const val EXTRA_AUTORUN = "lexscore_autorun"
    }
}

@Composable
private fun AppRoot(autorun: Boolean = false, vm: AppViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val c = LexTheme.colors

    // 自动跑一次：加载示例 → 批改。整个流程交给 ViewModel，避免 Compose 副作用时序问题。
    LaunchedEffect(Unit) {
        if (autorun) vm.requestAutorun()
    }

    if (!state.loaded) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(
                    modifier = Modifier.size(26.dp),
                    color = c.accent,
                    strokeWidth = 2.5.dp,
                )
                Spacer(Modifier.height(12.dp))
                Text("正在加载评分引擎…", color = c.inkFaint, fontSize = 12.5.sp)
            }
        }
        return
    }

    Box(modifier = Modifier.padding(top = 8.dp)) {
        when (state.screen) {
            Screen.Home -> HomeScreen(
                state = state,
                onSelectTask = vm::selectTask,
                onPrompt = vm::setPrompt,
                onEssay = vm::setEssay,
                onChartData = vm::setChartData,
                onReading = vm::setReading,
                onListening = vm::setListening,
                onLoadSample = vm::loadSample,
                onGrade = vm::grade,
                onOpenReport = vm::openReport,
                onOpenCorpus = vm::openCorpus,
                onDeleteReport = vm::deleteReport,
            )

            Screen.Report -> {
                val report = state.current
                if (report == null) {
                    vm.openHome()
                } else {
                    ReportScreen(
                        report = report,
                        dimensionFilter = state.dimensionFilter,
                        statusFilter = state.statusFilter,
                        onDimensionFilter = vm::setDimensionFilter,
                        onStatusFilter = vm::setStatusFilter,
                        onAnnotationChange = vm::updateAnnotation,
                        onAcceptAll = vm::acceptAll,
                        onBack = vm::openHome,
                    )
                }
            }

            Screen.Corpus -> CorpusScreen(
                state = state,
                onBack = vm::openHome,
                onClearAll = vm::clearAll,
            )
        }
    }
}
