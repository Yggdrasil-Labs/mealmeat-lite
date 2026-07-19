package io.yggdrasil.labs.mealmate.lite.ui.plans

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

/**
 * 周计划页面 — 日历视图展示本周三餐
 * 阶段 4 实现完整日历视图
 */
@Composable
fun PlansScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("周计划")
    }
}
