package io.yggdrasil.labs.mealmate.lite.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import io.yggdrasil.labs.mealmate.lite.ui.chat.ChatScreen
import io.yggdrasil.labs.mealmate.lite.ui.plans.PlansScreen
import io.yggdrasil.labs.mealmate.lite.ui.recipes.RecipesScreen
import io.yggdrasil.labs.mealmate.lite.ui.settings.SettingsScreen

/**
 * 底部导航项定义
 */
enum class TopLevelRoute(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Chat("chat", "对话", Icons.Default.Chat),
    Recipes("recipes", "菜品", Icons.Default.MenuBook),
    Plans("plans", "计划", Icons.Default.CalendarMonth),
    Settings("settings", "设置", Icons.Default.Settings),
}

/**
 * 应用主导航宿主，包含 Bottom Navigation 和页面路由
 */
@Composable
fun MealMateNavHost() {
    val navController = rememberNavController()

    MaterialTheme {
        Scaffold(
            bottomBar = {
                NavigationBar {
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentDestination = navBackStackEntry?.destination

                    TopLevelRoute.entries.forEach { screen ->
                        NavigationBarItem(
                            icon = { Icon(screen.icon, contentDescription = screen.label) },
                            label = { Text(screen.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                        )
                    }
                }
            },
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = TopLevelRoute.Chat.route,
                modifier = Modifier.padding(innerPadding),
            ) {
                composable(TopLevelRoute.Chat.route) { ChatScreen() }
                composable(TopLevelRoute.Recipes.route) { RecipesScreen() }
                composable(TopLevelRoute.Plans.route) { PlansScreen() }
                composable(TopLevelRoute.Settings.route) { SettingsScreen() }
            }
        }
    }
}
