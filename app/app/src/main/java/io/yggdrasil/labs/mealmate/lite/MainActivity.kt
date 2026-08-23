package io.yggdrasil.labs.mealmate.lite

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dagger.hilt.android.AndroidEntryPoint
import io.yggdrasil.labs.mealmate.lite.ui.navigation.MealMateRoot

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as MealMateApp).container
        setContent {
            val authState by container.authViewModel.state.collectAsStateWithLifecycle()
            MealMateRoot(
                authState = authState,
                authViewModel = container.authViewModel,
                settingsViewModel = container.settingsViewModel,
            )
        }
    }
}
