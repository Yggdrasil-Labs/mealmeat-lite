package io.yggdrasil.labs.mealmate.lite

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import io.yggdrasil.labs.mealmate.lite.data.auth.AndroidDeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.AuthRepository
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.models.ModelSelectionRepository
import io.yggdrasil.labs.mealmate.lite.data.remote.RetrofitModelCatalogClient
import io.yggdrasil.labs.mealmate.lite.data.remote.createMealMateApi
import io.yggdrasil.labs.mealmate.lite.data.settings.SettingsRepository
import io.yggdrasil.labs.mealmate.lite.ui.auth.AuthViewModel
import io.yggdrasil.labs.mealmate.lite.ui.settings.SettingsViewModel

@HiltAndroidApp
class MealMateApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

class AppContainer(
    application: Application,
) {
    private val credentialStore = AndroidDeviceCredentialStore(application)
    val sessionManager = SessionManager(credentialStore)
    val api = createMealMateApi(BuildConfig.MEALMATE_BASE_URL, sessionManager::tokenSnapshot)
    private val modelSelectionRepository =
        ModelSelectionRepository(sessionManager, RetrofitModelCatalogClient(api))
    val authViewModel = AuthViewModel(AuthRepository(api, sessionManager), sessionManager, modelSelectionRepository)
    val settingsViewModel = SettingsViewModel(SettingsRepository(api, sessionManager), sessionManager)
}
