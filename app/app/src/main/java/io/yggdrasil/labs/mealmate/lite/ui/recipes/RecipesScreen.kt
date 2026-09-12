package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
 * 菜品库页面 — 从本地 Room 缓存选择菜品并离线编辑。
 * 完整搜索和详情体验留给后续阶段。
 */
@Composable
fun RecipesScreen(
    editorViewModel: RecipeEditorViewModel,
    failureViewModel: SyncFailureViewModel,
) {
    val editorState = editorViewModel.state.collectAsStateWithLifecycle().value
    val issues = failureViewModel.issues.collectAsStateWithLifecycle().value
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("菜品库")
        if (editorState.recipes.isEmpty()) {
            Text("暂无已同步菜品")
        } else {
            Text("本地菜品")
            editorState.recipes.forEach { recipe ->
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { editorViewModel.selectRecipe(recipe) },
                ) {
                    Column {
                        Text(recipe.name)
                        Text(recipe.id)
                    }
                }
            }
        }
        editorState.message?.let { message -> Text(message) }
        if (editorState.recipeId.isNotBlank()) Text("当前菜品：${editorState.recipeId}")
        OutlinedTextField(editorState.name, editorViewModel::updateName, label = { Text("名称") })
        OutlinedTextField(editorState.tags, editorViewModel::updateTags, label = { Text("标签，逗号分隔（可选）") })
        Button(
            enabled = editorState.recipeId.isNotBlank(),
            onClick = editorViewModel::submitPatch,
        ) { Text("离线保存") }
        Button(
            enabled = editorState.recipeId.isNotBlank(),
            onClick = editorViewModel::submitDelete,
        ) { Text("离线删除") }
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
