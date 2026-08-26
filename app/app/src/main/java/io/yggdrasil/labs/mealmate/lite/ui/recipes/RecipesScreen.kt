package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncIssueView
import io.yggdrasil.labs.mealmate.lite.ui.sync.SyncFailureViewModel

/**
 * 菜品库页面 — 浏览、搜索、查看详情
 * 阶段 4 实现完整列表和搜索
 */
@Composable
fun RecipesScreen(
    editorViewModel: RecipeEditorViewModel,
    failureViewModel: SyncFailureViewModel,
) {
    val editorState = editorViewModel.state.collectAsStateWithLifecycle().value
    val issues = failureViewModel.issues.collectAsStateWithLifecycle().value
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("菜品库")
        editorState.message?.let { message -> Text(message) }
        OutlinedTextField(editorState.recipeId, editorViewModel::updateRecipeId, label = { Text("菜品 ID") })
        OutlinedTextField(editorState.name, editorViewModel::updateName, label = { Text("名称（可选）") })
        OutlinedTextField(editorState.tags, editorViewModel::updateTags, label = { Text("标签，逗号分隔（可选）") })
        Button(onClick = editorViewModel::submitPatch) { Text("离线保存") }
        Button(onClick = editorViewModel::submitDelete) { Text("离线删除") }
        issues.forEach { issue ->
            when (issue) {
                is SyncIssueView.ActionFailure -> {
                    Text("同步失败：${issue.errorCode} ${issue.message}")
                    Button(onClick = { failureViewModel.discard(issue.actionId) }) { Text("丢弃失败动作") }
                    Button(onClick = { editorViewModel.replaceFailed(issue.actionId) }) { Text("按当前编辑重试") }
                }

                is SyncIssueView.Diagnostic -> {
                    Text("同步诊断：${issue.errorCode} ${issue.message}")
                    Button(onClick = { failureViewModel.dismiss(issue.diagnosticId) }) { Text("关闭诊断") }
                }
            }
        }
    }
}
