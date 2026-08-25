package io.yggdrasil.labs.mealmate.lite

import android.app.Application
import androidx.room.Room
import dagger.hilt.android.HiltAndroidApp
import io.yggdrasil.labs.mealmate.lite.data.auth.AndroidDeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.AuthRepository
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.local.MIGRATION_1_2
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.RoomSessionLocalStore
import io.yggdrasil.labs.mealmate.lite.data.local.SyncPageApplier
import io.yggdrasil.labs.mealmate.lite.data.models.ModelSelectionRepository
import io.yggdrasil.labs.mealmate.lite.data.remote.RetrofitModelCatalogClient
import io.yggdrasil.labs.mealmate.lite.data.remote.createMealMateApi
import io.yggdrasil.labs.mealmate.lite.data.settings.SettingsRepository
import io.yggdrasil.labs.mealmate.lite.data.sync.InitialSyncCoordinator
import io.yggdrasil.labs.mealmate.lite.data.sync.RetrofitSyncPageClient
import io.yggdrasil.labs.mealmate.lite.data.sync.RoomSyncPageStore
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

    // Manual migrations preserve shipped databases instead of destructively recreating them.
    // Source: https://developer.android.com/training/data-storage/room/migrating-db-versions
    private val database =
        Room
            .databaseBuilder(application, MealMateDatabase::class.java, "mealmate.db")
            .addMigrations(MIGRATION_1_2)
            .build()
    val sessionManager = SessionManager(credentialStore, RoomSessionLocalStore(database))
    val api = createMealMateApi(BuildConfig.MEALMATE_BASE_URL, sessionManager::tokenSnapshot)
    private val modelSelectionRepository =
        ModelSelectionRepository(sessionManager, RetrofitModelCatalogClient(api))
    private val pageApplier = SyncPageApplier(database)
    private val syncCoordinator =
        InitialSyncCoordinator(
            sessionManager,
            RetrofitSyncPageClient(api),
            RoomSyncPageStore(database, pageApplier),
        )
    val authViewModel =
        AuthViewModel(
            AuthRepository(api, sessionManager),
            sessionManager,
            modelSelectionRepository,
            syncCoordinator,
        )
    val settingsViewModel = SettingsViewModel(SettingsRepository(api, sessionManager), sessionManager)
}
