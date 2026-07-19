package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

/**
 * 菜品库页面 — 浏览、搜索、查看详情
 * 阶段 4 实现完整列表和搜索
 */
@Composable
fun RecipesScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("菜品库")
    }
}
