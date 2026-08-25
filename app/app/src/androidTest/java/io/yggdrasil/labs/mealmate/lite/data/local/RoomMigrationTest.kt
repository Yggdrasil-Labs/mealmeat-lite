package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomMigrationTest {
    @get:Rule
    val helper =
        MigrationTestHelper(
            InstrumentationRegistry.getInstrumentation(),
            MealMateDatabase::class.java,
        )

    @Test
    fun migration_1_2_preserves_v1_data_and_adds_session_replica_and_diagnostic_tables() {
        helper.createDatabase(DATABASE_NAME, 1).apply {
            execSQL(
                "INSERT INTO settings_cache (`key`, value) VALUES (?, ?)",
                arrayOf("familyPreference", "vegetarian"),
            )
            execSQL("INSERT INTO sync_state (singletonId, cursor) VALUES (0, 'v1-opaque-cursor')")
            execSQL(
                """
                INSERT INTO recipes
                    (id, name, tagsJson, ingredientsJson, stepsJson, serverVersion, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent(),
                arrayOf("recipe-a", "Noodles", "[]", "[]", "[]", "41", "2026-08-23T00:00:00Z", "2026-08-23T00:00:00Z"),
            )
            close()
        }

        val database =
            helper.runMigrationsAndValidate(
                DATABASE_NAME,
                2,
                true,
                MIGRATION_1_2,
            )

        database.use {
            assertEquals(
                "vegetarian",
                it.query("SELECT value FROM settings_cache WHERE `key` = 'familyPreference'").singleString(),
            )
            assertTrue(it.tableNames().containsAll(setOf("client_session", "replica_versions", "sync_diagnostics")))
            assertEquals(null, it.query("SELECT cursor FROM sync_state WHERE singletonId = 0").nullableString())
            assertEquals(
                "41",
                it.singleString(
                    "SELECT serverVersion FROM replica_versions " +
                        "WHERE resource = 'recipe' AND resourceId = 'recipe-a'",
                ),
            )
            assertTrue(
                runCatching {
                    it.execSQL(
                        """
                        INSERT INTO client_session
                            (singletonId, sessionId, sessionGeneration, state, selectedModelId)
                        VALUES (0, 'bad-session', 1, 'INVALID', NULL)
                        """.trimIndent(),
                    )
                }.isFailure,
            )
        }

        val room =
            Room
                .databaseBuilder(
                    InstrumentationRegistry.getInstrumentation().targetContext,
                    MealMateDatabase::class.java,
                    DATABASE_NAME,
                ).addMigrations(MIGRATION_1_2)
                .allowMainThreadQueries()
                .build()
        try {
            runBlocking {
                room.contractCacheDao().upsertClientSession(
                    ClientSessionEntity(
                        sessionId = "session-a",
                        sessionGeneration = 7,
                        state = ClientSessionState.PROVISIONING,
                        selectedModelId = "model-a",
                    ),
                )
                SyncPageApplier(room).applySyncPage(
                    page =
                        SyncResponse(
                            changes = listOf(settingsChange("42", "omnivore")),
                            hasMore = false,
                            nextCursor = null,
                        ),
                    currentCursor = null,
                    sessionFence = SyncSessionFence("session-a", 7),
                    promoteOnTerminal = true,
                )
                assertEquals("omnivore", room.contractCacheDao().getSettings("familyPreference")?.value)
                assertEquals(ClientSessionState.ACTIVE, room.contractCacheDao().getClientSession()?.state)
            }
        } finally {
            room.close()
        }
    }

    private fun SupportSQLiteDatabase.tableNames(): Set<String> =
        query("SELECT name FROM sqlite_master WHERE type = 'table'").use { cursor ->
            buildSet {
                while (cursor.moveToNext()) add(cursor.getString(0))
            }
        }

    private fun SupportSQLiteDatabase.singleString(query: String): String = query(query).singleString()

    private fun android.database.Cursor.singleString(): String =
        use { cursor ->
            check(cursor.moveToFirst())
            cursor.getString(0)
        }

    private fun android.database.Cursor.nullableString(): String? =
        use { cursor ->
            check(cursor.moveToFirst())
            if (cursor.isNull(0)) null else cursor.getString(0)
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

    private companion object {
        const val DATABASE_NAME = "room-migration-test"
    }
}
