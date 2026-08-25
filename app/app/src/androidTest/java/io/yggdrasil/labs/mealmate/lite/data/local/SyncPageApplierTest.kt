package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncCursorPhase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SyncPageApplierTest {
    @Test
    fun older_resource_version_is_a_no_op_and_terminal_page_activates_in_the_same_transaction() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val dao = database.contractCacheDao()
                dao.upsertClientSession(
                    ClientSessionEntity(
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        state = ClientSessionState.PROVISIONING,
                        selectedModelId = "model-a",
                    ),
                )
                val applier = SyncPageApplier(database)
                val fence = SyncSessionFence("session-a", 7)
                val first =
                    SyncResponse(
                        changes = listOf(settingsChange("10", "vegetarian")),
                        hasMore = true,
                        nextCursor = "page-2",
                    )
                assertEquals(1, applier.applySyncPage(first, null, fence, promoteOnTerminal = false).appliedChanges)
                dao.insertSyncDiagnostic(
                    SyncDiagnosticEntity(
                        diagnosticId = "diagnostic-a",
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        kind = SyncDiagnosticKind.CURSOR,
                        errorCode = "OLD_CURSOR",
                        message = "old cursor",
                        createdAt = "2026-08-24T00:00:00Z",
                    ),
                )

                val terminal =
                    SyncResponse(
                        changes = emptyList(),
                        hasMore = false,
                        nextCursor = null,
                    )
                assertEquals(
                    0,
                    applier.applySyncPage(terminal, "page-2", fence, promoteOnTerminal = true).appliedChanges,
                )

                val staleNextRun =
                    SyncResponse(
                        changes = listOf(settingsChange("9", "omnivore")),
                        hasMore = false,
                        nextCursor = null,
                    )
                assertEquals(
                    0,
                    applier.applySyncPage(staleNextRun, null, fence, promoteOnTerminal = false).appliedChanges,
                )

                assertEquals("vegetarian", dao.getSettings("familyPreference")?.value)
                assertEquals("10", dao.getReplicaVersion("settings", "familyPreference")?.serverVersion)
                assertEquals(ClientSessionState.ACTIVE, dao.getClientSession()?.state)
                assertEquals(null, dao.getSyncState()?.cursor)
                assertEquals(
                    0,
                    database.openHelper.readableDatabase
                        .query("SELECT COUNT(*) FROM sync_diagnostics")
                        .use { cursor ->
                            cursor.moveToFirst()
                            cursor.getInt(0)
                        },
                )
            } finally {
                database.close()
            }
        }

    @Test
    fun repeated_continuation_page_is_rejected_without_advancing_cursor_or_cache() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val dao = database.contractCacheDao()
                dao.upsertClientSession(
                    ClientSessionEntity(
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        state = ClientSessionState.PROVISIONING,
                        selectedModelId = "model-a",
                    ),
                )
                val applier = SyncPageApplier(database)
                val fence = SyncSessionFence("session-a", 7)
                val first =
                    SyncResponse(
                        changes = listOf(settingsChange("10", "vegetarian")),
                        hasMore = true,
                        nextCursor = "page-2",
                    )
                applier.applySyncPage(first, null, fence, promoteOnTerminal = false)

                val repeated =
                    SyncResponse(
                        changes = listOf(settingsChange("10", "omnivore")),
                        hasMore = true,
                        nextCursor = "page-3",
                    )
                val failure =
                    runCatching {
                        applier.applySyncPage(repeated, "page-2", fence, promoteOnTerminal = false)
                    }.exceptionOrNull()

                assertTrue(failure is IllegalArgumentException)
                assertEquals("page-2", dao.getSyncState()?.cursor)
                assertEquals("vegetarian", dao.getSettings("familyPreference")?.value)
                assertEquals("10", dao.getReplicaVersion("settings", "familyPreference")?.serverVersion)
            } finally {
                database.close()
            }
        }

    @Test
    fun initial_snapshot_rejects_duplicate_resource_keys_even_when_versions_increase() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val dao = database.contractCacheDao()
                dao.upsertClientSession(
                    ClientSessionEntity(
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        state = ClientSessionState.PROVISIONING,
                        selectedModelId = "model-a",
                    ),
                )
                val duplicateKeyPage =
                    SyncResponse(
                        changes =
                            listOf(
                                settingsChange("10", "vegetarian"),
                                settingsChange("11", "omnivore"),
                            ),
                        hasMore = true,
                        nextCursor = "page-2",
                    )

                val failure =
                    runCatching {
                        SyncPageApplier(database).applySyncPage(
                            duplicateKeyPage,
                            currentCursor = null,
                            sessionFence = SyncSessionFence("session-a", 7),
                            promoteOnTerminal = false,
                        )
                    }.exceptionOrNull()

                assertTrue(failure is IllegalArgumentException)
                assertEquals(null, dao.getSyncState())
                assertEquals(null, dao.getSettings("familyPreference"))
                assertEquals(null, dao.getReplicaVersion("settings", "familyPreference"))
            } finally {
                database.close()
            }
        }

    @Test
    fun empty_snapshot_bridge_advances_to_incremental_and_then_activates() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val dao = database.contractCacheDao()
                dao.upsertClientSession(
                    ClientSessionEntity(
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        state = ClientSessionState.PROVISIONING,
                        selectedModelId = "model-a",
                    ),
                )
                val applier = SyncPageApplier(database)
                val fence = SyncSessionFence("session-a", 7)

                applier.applySyncPage(
                    SyncResponse(changes = emptyList(), hasMore = true, nextCursor = "incremental-1"),
                    currentCursor = null,
                    sessionFence = fence,
                    promoteOnTerminal = false,
                )
                assertEquals("incremental-1", dao.getSyncState()?.cursor)
                assertEquals(SyncCursorPhase.INCREMENTAL, dao.getSyncState()?.phase)
                assertEquals(null, dao.getSyncState()?.lastServerVersion)

                applier.applySyncPage(
                    SyncResponse(
                        changes = listOf(settingsChange("12", "vegetarian")),
                        hasMore = false,
                        nextCursor = null,
                    ),
                    currentCursor = "incremental-1",
                    sessionFence = fence,
                    promoteOnTerminal = true,
                )

                assertEquals("vegetarian", dao.getSettings("familyPreference")?.value)
                assertEquals(ClientSessionState.ACTIVE, dao.getClientSession()?.state)
                assertEquals(null, dao.getSyncState()?.cursor)
            } finally {
                database.close()
            }
        }

    private fun settingsChange(
        version: String,
        value: String,
    ): SyncChangeDto =
        SyncChangeDto.SyncChangeDtoOneOf3Value(
            SyncChangeDtoOneOf3(
                serverVersion = version,
                resource = "settings",
                operation = "upsert",
                data = SettingsDto("familyPreference", value),
            ),
        )
}
