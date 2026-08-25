package io.yggdrasil.labs.mealmate.lite.data.sync

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.AndroidDeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.local.MIGRATION_1_2
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.RoomSessionLocalStore
import io.yggdrasil.labs.mealmate.lite.data.local.SyncPageApplier
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState
import io.yggdrasil.labs.mealmate.lite.data.remote.SuccessEnvelope
import io.yggdrasil.labs.mealmate.lite.data.remote.createMealMateApi
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class InitialSyncIntegrationTest {
    @Test
    fun page_cursor_and_provisioning_survive_restart_before_terminal_activation() =
        runBlocking {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            context.deleteDatabase(DATABASE_NAME)
            val credentialStore =
                AndroidDeviceCredentialStore(
                    context,
                    alias = "mealmate_t3_integration_key",
                    fileName = "mealmate-t3-integration-credential.bin",
                )
            credentialStore.clear()
            credentialStore.deleteKeyForTest()
            val server = MockWebServer()
            server.start()
            try {
                server.enqueue(successResponse(SyncResponse(listOf(settingsChange("1")), true, "page-2")))
                server.enqueue(MockResponse().setResponseCode(500))

                val firstDatabase = openDatabase()
                val firstManager =
                    SessionManager(
                        credentialStore = credentialStore,
                        sessionStore = RoomSessionLocalStore(firstDatabase),
                        sessionIdSource = { "session-a" },
                        generationSource = { 7L },
                    )
                val generation = firstManager.startProvisioning("device-a", "token-a")
                assertTrue(firstManager.selectModel(generation, "model-a"))
                val firstCoordinator = coordinator(firstDatabase, firstManager, server)

                assertTrue(firstCoordinator.sync(SyncReason.InitialProvisioning) is SyncRunResult.Failed)
                assertEquals("page-2", firstDatabase.contractCacheDao().getSyncState()?.cursor)
                assertEquals(SessionPhase.Provisioning, firstManager.state.value.phase)
                firstDatabase.close()

                server.enqueue(successResponse(SyncResponse(emptyList(), false, null)))
                val restartedDatabase = openDatabase()
                val restartedManager = SessionManager(credentialStore, RoomSessionLocalStore(restartedDatabase))
                restartedManager.restore()
                assertEquals(SessionPhase.Provisioning, restartedManager.state.value.phase)

                val result = coordinator(restartedDatabase, restartedManager, server).sync(SyncReason.InitialProvisioning)
                assertTrue(result is SyncRunResult.Success)
                assertEquals(SessionPhase.Active, restartedManager.state.value.phase)
                assertEquals(ClientSessionState.ACTIVE, restartedDatabase.contractCacheDao().getClientSession()?.state)
                assertEquals(null, restartedDatabase.contractCacheDao().getSyncState()?.cursor)
                assertEquals(null, server.takeRequest().requestUrl?.queryParameter("cursor"))
                assertEquals("page-2", server.takeRequest().requestUrl?.queryParameter("cursor"))
                assertEquals("page-2", server.takeRequest().requestUrl?.queryParameter("cursor"))
                restartedDatabase.close()
            } finally {
                server.shutdown()
                credentialStore.clear()
                credentialStore.deleteKeyForTest()
                context.deleteDatabase(DATABASE_NAME)
            }
        }

    private fun openDatabase(): MealMateDatabase {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        return Room
            .databaseBuilder(context, MealMateDatabase::class.java, DATABASE_NAME)
            .addMigrations(MIGRATION_1_2)
            .allowMainThreadQueries()
            .build()
    }

    private fun coordinator(
        database: MealMateDatabase,
        sessionManager: SessionManager,
        server: MockWebServer,
    ): InitialSyncCoordinator {
        val api = createMealMateApi(server.url("/").toString(), sessionManager::tokenSnapshot)
        val applier = SyncPageApplier(database)
        return InitialSyncCoordinator(
            sessionManager,
            RetrofitSyncPageClient(api),
            RoomSyncPageStore(database, applier),
        )
    }

    private fun successResponse(page: SyncResponse): MockResponse =
        MockResponse()
            .setResponseCode(200)
            .setBody(contractJson.encodeToString(SuccessEnvelope(success = true, data = page)))

    private fun settingsChange(version: String): SyncChangeDto =
        SyncChangeDto.SyncChangeDtoOneOf3Value(
            SyncChangeDtoOneOf3(
                serverVersion = version,
                resource = "settings",
                operation = "upsert",
                data = SettingsDto("familyPreference", "vegetarian"),
            ),
        )

    private companion object {
        const val DATABASE_NAME = "t3-initial-sync-integration.db"
    }
}
