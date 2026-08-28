package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.MealType
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.PlanItemView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeTombstone
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayload
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayloadPatch
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf2
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDtoOneOf3
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.decodeAuthoritativeSnapshot
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.decodePendingActionPayload
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.pendingActionEntityFromPayload
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class RoomContractTest {
    @Test
    fun schema_has_nine_business_and_three_coordination_tables_and_unknown_versions_are_rejected() {
        val database =
            Room
                .inMemoryDatabaseBuilder(
                    InstrumentationRegistry.getInstrumentation().targetContext,
                    MealMateDatabase::class.java,
                ).allowMainThreadQueries()
                .build()

        try {
            val tables =
                database.openHelper.readableDatabase
                    .query("SELECT name FROM sqlite_master WHERE type='table'")
                    .use { cursor ->
                        buildSet {
                            while (cursor.moveToNext()) add(cursor.getString(0))
                        }
                    }.filterNot {
                        it == "android_metadata" || it == "room_master_table" || it.startsWith("sqlite_")
                    }.toSet()

            assertEquals(
                setOf(
                    "recipes",
                    "weekly_plans",
                    "plan_items",
                    "settings_cache",
                    "conversation_messages",
                    "pending_actions",
                    "sync_failures",
                    "sync_state",
                    "chat_draft",
                    "client_session",
                    "replica_versions",
                    "sync_diagnostics",
                ),
                tables,
            )
            tables.forEach { table ->
                database.openHelper.readableDatabase
                    .query("PRAGMA table_info($table)")
                    .use { cursor ->
                        while (cursor.moveToNext()) {
                            val normalizedColumn = cursor.getString(1).replace("_", "").lowercase()
                            assertTrue(
                                "$table must not persist a sensitive credential",
                                listOf("token", "secret", "familycode", "bootstrap").none(normalizedColumn::contains),
                            )
                        }
                    }
            }
            assertEquals(listOf("id"), database.primaryKeyColumns("recipes"))
            assertEquals(listOf("id"), database.primaryKeyColumns("weekly_plans"))
            assertEquals(listOf("id"), database.primaryKeyColumns("plan_items"))
            assertEquals(listOf("key"), database.primaryKeyColumns("settings_cache"))
            assertEquals(listOf("localSequence"), database.primaryKeyColumns("conversation_messages"))
            assertEquals(listOf("actionId"), database.primaryKeyColumns("pending_actions"))
            assertEquals(listOf("actionId"), database.primaryKeyColumns("sync_failures"))
            assertEquals(listOf("singletonId"), database.primaryKeyColumns("sync_state"))
            assertEquals(listOf("singletonId"), database.primaryKeyColumns("chat_draft"))
            assertEquals(listOf("singletonId"), database.primaryKeyColumns("client_session"))
            assertEquals(listOf("resource", "resourceId"), database.primaryKeyColumns("replica_versions"))
            assertEquals(listOf("diagnosticId"), database.primaryKeyColumns("sync_diagnostics"))
            assertTrue(database.uniqueIndexes("weekly_plans").contains(listOf("weekStart")))
            assertTrue(database.uniqueIndexes("plan_items").contains(listOf("weeklyPlanId", "date", "mealType")))
            assertTrue(database.foreignKeys("plan_items").contains(Triple("weekly_plans", "weeklyPlanId", "id")))
            assertEquals("TEXT", database.columnType("recipes", "serverVersion"))
            assertEquals("TEXT", database.columnType("weekly_plans", "serverVersion"))
            assertEquals("TEXT", database.columnType("sync_failures", "serverVersion"))
            assertTrue(database.columnNames("pending_actions").containsAll(listOf("payloadJson", "payloadSchemaVersion")))
            assertTrue(database.columnNames("sync_failures").containsAll(listOf("authoritativeJson", "authoritativeSchemaVersion")))
            assertIllegalArgument { decodePendingActionPayload(99, "{}") }
            assertIllegalArgument {
                decodePendingActionPayload(
                    1,
                    """{"actionId":"11111111-1111-4111-8111-111111111111","type":"evil","createdAt":"2026-08-01T12:00:00Z","payload":{"recipeId":"22222222-2222-4222-8222-222222222222","patch":{"name":"updated"}}}""",
                )
            }
            assertIllegalArgument { decodeAuthoritativeSnapshot(99, "{}") }
            assertIllegalArgument {
                decodeAuthoritativeSnapshot(
                    1,
                    contractJson.encodeToString(RecipeView.serializer(), recipeView("0")),
                )
            }
            assertIllegalArgument {
                SyncFailureEntity(
                    actionId = "a",
                    errCode = "REJECTED",
                    errMessage = "rejected",
                    authoritativeSchemaVersion = 1,
                    authoritativeJson = null,
                    serverVersion = null,
                    requiresFullResync = true,
                    createdAt = now.toString(),
                )
            }
            assertIllegalArgument { SyncStateEntity(singletonId = 1, cursor = null) }
            assertIllegalArgument { ChatDraftEntity(singletonId = 1, text = "draft") }
        } finally {
            database.close()
        }
    }

    @Test
    fun pending_action_round_trips_and_sync_page_commits_or_rolls_back_with_its_cursor() =
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
                val action = pendingActionEntityFromPayload(recipePatchAction())
                dao.insertPendingAction(action)
                assertEquals(action, dao.getPendingAction(action.actionId))
                assertEquals(PendingActionState.PENDING, dao.getPendingAction(action.actionId)?.state)
                assertEquals(recipePatchAction(), decodePendingActionPayload(action.payloadSchemaVersion, action.payloadJson))
                assertIllegalArgument {
                    runBlocking {
                        dao.insertPendingAction(action.copy(payloadHash = "0".repeat(64)))
                    }
                }
                assertIllegalArgument {
                    runBlocking {
                        dao.upsertSyncFailure(
                            SyncFailureEntity(
                                actionId = "invalid-version",
                                errCode = "REJECTED",
                                errMessage = "rejected",
                                authoritativeSchemaVersion = 99,
                                authoritativeJson = "{}",
                                serverVersion = null,
                                requiresFullResync = false,
                                createdAt = now.toString(),
                            ),
                        )
                    }
                }
                repeat(41) { sequence ->
                    dao.appendConversationMessage(
                        ConversationMessageEntity(
                            role = "user",
                            content = "message-$sequence",
                            createdAt = now.toString(),
                        ),
                    )
                }
                assertEquals(40, dao.getConversationMessages().size)

                dao.upsertSyncState(SyncStateEntity(cursor = "old"))
                val recipe = recipeView("9007199254740993")
                val applier = SyncPageApplier(database)
                applier.applySyncPage(
                    SyncResponse(
                        changes =
                            listOf(
                                SyncChangeDto.SyncChangeDtoOneOfValue(
                                    SyncChangeDtoOneOf("9007199254740993", "recipe", "upsert", recipe),
                                ),
                            ),
                        hasMore = false,
                        nextCursor = "new",
                    ),
                    currentCursor = "old",
                )
                assertEquals("9007199254740993", dao.getRecipe(recipe.id.toString())?.serverVersion)
                assertEquals("new", dao.getSyncState()?.cursor)

                val weeklyPlan = weeklyPlanView()
                val tombstone = RecipeTombstone(UUID.randomUUID(), now, "3")
                applier.applySyncPage(
                    SyncResponse(
                        changes =
                            listOf(
                                SyncChangeDto.SyncChangeDtoOneOf2Value(
                                    SyncChangeDtoOneOf2(
                                        "4",
                                        "weekly_plan",
                                        "upsert",
                                        weeklyPlan,
                                    ),
                                ),
                                SyncChangeDto.SyncChangeDtoOneOf3Value(
                                    SyncChangeDtoOneOf3(
                                        "5",
                                        "settings",
                                        "upsert",
                                        SettingsDto("familyPreference", "vegetarian"),
                                    ),
                                ),
                                SyncChangeDto.SyncChangeDtoOneOf1Value(
                                    SyncChangeDtoOneOf1("3", "recipe", "delete", tombstone),
                                ),
                            ),
                        hasMore = false,
                        nextCursor = "aggregates-applied",
                    ),
                    currentCursor = "new",
                )
                assertEquals(weeklyPlan.id.toString(), dao.getWeeklyPlan(weeklyPlan.id.toString())?.id)
                assertEquals(21, dao.getPlanItems(weeklyPlan.id.toString()).size)
                assertEquals("vegetarian", dao.getSettings("familyPreference")?.value)
                assertEquals(tombstone.deletedAt.toInstant().toString(), dao.getRecipe(tombstone.id.toString())?.deletedAt)
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)

                val invalidSettings =
                    runCatching {
                        applier.applySyncPage(
                            SyncResponse(
                                changes =
                                    listOf(
                                        SyncChangeDto.SyncChangeDtoOneOf3Value(
                                            SyncChangeDtoOneOf3("6", "settings", "upsert", SettingsDto("other", "value")),
                                        ),
                                    ),
                                hasMore = false,
                                nextCursor = "invalid-settings",
                            ),
                            currentCursor = "aggregates-applied",
                        )
                    }.exceptionOrNull()
                assertTrue(invalidSettings is IllegalArgumentException)
                assertNull(dao.getSettings("other"))
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)

                val oversizedSettings =
                    runCatching {
                        applier.applySyncPage(
                            SyncResponse(
                                changes =
                                    listOf(
                                        SyncChangeDto.SyncChangeDtoOneOf3Value(
                                            SyncChangeDtoOneOf3(
                                                "6",
                                                "settings",
                                                "upsert",
                                                SettingsDto("familyPreference", "x".repeat(5_001)),
                                            ),
                                        ),
                                    ),
                                hasMore = false,
                                nextCursor = "oversized-settings",
                            ),
                            currentCursor = "aggregates-applied",
                        )
                    }.exceptionOrNull()
                assertTrue(oversizedSettings is IllegalArgumentException)
                assertEquals("vegetarian", dao.getSettings("familyPreference")?.value)
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)

                val mismatchedTombstone =
                    runCatching {
                        applier.applySyncPage(
                            SyncResponse(
                                changes =
                                    listOf(
                                        SyncChangeDto.SyncChangeDtoOneOf1Value(
                                            SyncChangeDtoOneOf1(
                                                "2",
                                                "recipe",
                                                "delete",
                                                RecipeTombstone(recipe.id, now, "0"),
                                            ),
                                        ),
                                    ),
                                hasMore = false,
                                nextCursor = "mismatched-version",
                            ),
                            currentCursor = "aggregates-applied",
                        )
                    }.exceptionOrNull()
                assertTrue(mismatchedTombstone is IllegalArgumentException)
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)

                val invalidDiscriminator =
                    runCatching {
                        applier.applySyncPage(
                            SyncResponse(
                                changes =
                                    listOf(
                                        SyncChangeDto.SyncChangeDtoOneOfValue(
                                            SyncChangeDtoOneOf("2", "evil", "upsert", recipeView("2")),
                                        ),
                                    ),
                                hasMore = false,
                                nextCursor = "invalid-discriminator",
                            ),
                            currentCursor = "aggregates-applied",
                        )
                    }.exceptionOrNull()
                assertTrue(invalidDiscriminator is IllegalArgumentException)
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)

                val failedRecipe = recipeView("2")
                val rejected =
                    runCatching {
                        applier.applySyncPage(
                            SyncResponse(
                                changes =
                                    listOf(
                                        SyncChangeDto.SyncChangeDtoOneOfValue(
                                            SyncChangeDtoOneOf("2", "recipe", "upsert", failedRecipe),
                                        ),
                                        SyncChangeDto.SyncChangeDtoOneOf1Value(
                                            SyncChangeDtoOneOf1(
                                                "0",
                                                "recipe",
                                                "delete",
                                                RecipeTombstone(recipe.id, now, "0"),
                                            ),
                                        ),
                                    ),
                                hasMore = false,
                                nextCursor = "should-not-commit",
                            ),
                            currentCursor = "aggregates-applied",
                        )
                    }.exceptionOrNull()
                assertTrue(rejected is IllegalArgumentException)
                assertNull(dao.getRecipe(failedRecipe.id.toString()))
                assertEquals("aggregates-applied", dao.getSyncState()?.cursor)
            } finally {
                database.close()
            }
        }

    private inline fun assertIllegalArgument(block: () -> Unit) {
        try {
            block()
            fail("Expected IllegalArgumentException")
        } catch (_: IllegalArgumentException) {
            // expected
        }
    }

    private fun MealMateDatabase.columnNames(table: String): Set<String> =
        openHelper.readableDatabase
            .query("PRAGMA table_info($table)")
            .use { cursor ->
                buildSet {
                    while (cursor.moveToNext()) add(cursor.getString(1))
                }
            }

    private fun MealMateDatabase.columnType(
        table: String,
        column: String,
    ): String =
        openHelper.readableDatabase
            .query("PRAGMA table_info($table)")
            .use { cursor ->
                while (cursor.moveToNext()) {
                    if (cursor.getString(1) == column) return cursor.getString(2)
                }
                error("Column $column is missing from $table")
            }

    private fun MealMateDatabase.primaryKeyColumns(table: String): List<String> =
        openHelper.readableDatabase
            .query("PRAGMA table_info($table)")
            .use { cursor ->
                buildList {
                    while (cursor.moveToNext()) {
                        if (cursor.getInt(5) > 0) add(cursor.getString(1))
                    }
                }
            }

    private fun MealMateDatabase.uniqueIndexes(table: String): Set<List<String>> =
        openHelper.readableDatabase
            .query("PRAGMA index_list($table)")
            .use { indexes ->
                buildSet {
                    while (indexes.moveToNext()) {
                        if (indexes.getInt(2) == 1) {
                            val name = indexes.getString(1)
                            add(
                                openHelper.readableDatabase
                                    .query("PRAGMA index_info($name)")
                                    .use { columns ->
                                        buildList {
                                            while (columns.moveToNext()) add(columns.getString(2))
                                        }
                                    },
                            )
                        }
                    }
                }
            }

    private fun MealMateDatabase.foreignKeys(table: String): Set<Triple<String, String, String>> =
        openHelper.readableDatabase
            .query("PRAGMA foreign_key_list($table)")
            .use { cursor ->
                buildSet {
                    while (cursor.moveToNext()) {
                        add(Triple(cursor.getString(2), cursor.getString(3), cursor.getString(4)))
                    }
                }
            }

    private fun recipePatchAction(): SyncActionDto =
        SyncActionDto.SyncActionDtoOneOfValue(
            SyncActionDtoOneOf(
                actionId = UUID.fromString("11111111-1111-4111-8111-111111111111"),
                type = "recipe.patch",
                createdAt = now,
                payload =
                    SyncActionDtoOneOfPayload(
                        recipeId = UUID.fromString("22222222-2222-4222-8222-222222222222"),
                        patch = SyncActionDtoOneOfPayloadPatch(name = "updated"),
                    ),
            ),
        )

    private fun recipeView(serverVersion: String): RecipeView =
        RecipeView(
            id = UUID.randomUUID(),
            name = "Noodles",
            tags = listOf("quick"),
            ingredients = listOf("noodles"),
            steps = listOf("cook"),
            serverVersion = serverVersion,
            createdAt = now,
            updatedAt = now,
        )

    private fun weeklyPlanView(): WeeklyPlanView {
        val weekStart = LocalDate.of(2026, 8, 3)
        val mealTypes = listOf(MealType.breakfast, MealType.lunch, MealType.dinner)
        return WeeklyPlanView(
            id = UUID.randomUUID(),
            weekStart = weekStart,
            serverVersion = "4",
            items =
                (0..6).flatMap { dayOffset ->
                    mealTypes.map { mealType ->
                        PlanItemView(
                            id = UUID.randomUUID(),
                            date = weekStart.plusDays(dayOffset.toLong()),
                            mealType = mealType,
                            recipeId = UUID.randomUUID(),
                            recipeNameSnapshot = "$mealType-$dayOffset",
                        )
                    }
                },
            createdAt = now,
            updatedAt = now,
        )
    }

    private companion object {
        val now: OffsetDateTime = OffsetDateTime.of(2026, 8, 1, 12, 0, 0, 0, ZoneOffset.UTC)
    }
}
