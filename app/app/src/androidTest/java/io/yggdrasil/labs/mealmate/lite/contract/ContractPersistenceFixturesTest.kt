package io.yggdrasil.labs.mealmate.lite.contract

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SettingsDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.SyncPageApplier
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.RecipeRoomMapper
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.BufferedReader

@RunWith(AndroidJUnit4::class)
class ContractPersistenceFixturesTest {
    @Test
    fun manifest_declared_room_fixtures_apply_once_and_round_trip_through_dao() =
        runBlocking {
            val fixtures = roomFixtures()
            val executions = mutableMapOf<String, Int>()
            val acceptedFixtures = fixtures.values.filter { it.expected == "accept" }.associateBy { it.id }
            val rejectedFixtures = fixtures.values.filter { it.expected == "reject" }
            val changesById =
                acceptedFixtures.values.associate { fixture ->
                    fixture.id to contractJson.decodeFromString<SyncChangeDto>(fixture.value.toString())
                }
            val requiredAcceptedFixtureIds =
                setOf(
                    "sync-change-recipe",
                    "sync-change-weekly-plan",
                    "sync-change-settings",
                    "sync-change-recipe-delete",
                )
            assertTrue(changesById.keys.containsAll(requiredAcceptedFixtureIds))
            assertEquals(setOf("sync-change-room-invalid-version"), rejectedFixtures.map { it.id }.toSet())

            val recipe = contractJson.decodeFromString<RecipeView>(fixtures.valueOf("sync-change-recipe")["data"]!!.toString())
            val plan = contractJson.decodeFromString<WeeklyPlanView>(fixtures.valueOf("sync-change-weekly-plan")["data"]!!.toString())
            val settings = contractJson.decodeFromString<SettingsDto>(fixtures.valueOf("sync-change-settings")["data"]!!.toString())
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val pageApplier = SyncPageApplier(database)
                val initialFixtureIds = changesById.keys - "sync-change-recipe-delete"
                pageApplier.applySyncPage(
                    SyncResponse(
                        initialFixtureIds.map { requireNotNull(changesById[it]) },
                        false,
                        "fixture-cursor",
                    ),
                    null,
                )
                initialFixtureIds.forEach { id -> executions[id] = (executions[id] ?: 0) + 1 }
                val dao = database.contractCacheDao()
                assertEquals(recipe, RecipeRoomMapper.toContract(requireNotNull(dao.getRecipe(recipe.id.toString()))))
                val storedPlan = requireNotNull(dao.getWeeklyPlan(plan.id.toString()))
                assertEquals(plan.id.toString(), storedPlan.id)
                assertEquals(plan.weekStart.toString(), storedPlan.weekStart)
                assertEquals(plan.serverVersion, storedPlan.serverVersion)
                assertEquals(plan.createdAt.toInstant().toString(), storedPlan.createdAt)
                assertEquals(plan.updatedAt.toInstant().toString(), storedPlan.updatedAt)
                val expectedPlanItems =
                    plan.items
                        .map {
                            listOf(
                                it.id.toString(),
                                it.date.toString(),
                                it.mealType.toString(),
                                it.recipeId.toString(),
                                it.recipeNameSnapshot,
                            )
                        }.sortedWith(compareBy<List<String>>({ it[1] }, { it[2] }))
                assertEquals(
                    expectedPlanItems,
                    dao.getPlanItems(plan.id.toString()).map {
                        listOf(it.id, it.date, it.mealType, it.recipeId, it.recipeNameSnapshot)
                    },
                )
                assertEquals(settings.key, dao.getSettings(settings.key)?.key)
                assertEquals(settings.value, dao.getSettings(settings.key)?.value)
                assertEquals("fixture-cursor", dao.getSyncState()?.cursor)

                pageApplier.applySyncPage(
                    SyncResponse(
                        listOf(requireNotNull(changesById["sync-change-recipe-delete"])),
                        false,
                        "fixture-cursor-delete",
                    ),
                    "fixture-cursor",
                )
                executions["sync-change-recipe-delete"] =
                    (executions["sync-change-recipe-delete"] ?: 0) + 1
                val tombstone = requireNotNull(dao.getRecipe(recipe.id.toString()))
                assertEquals("", tombstone.name)
                assertEquals("2026-08-03T00:00:00Z", tombstone.deletedAt)
                assertEquals("9007199254740993", tombstone.serverVersion)
                assertEquals("fixture-cursor-delete", dao.getSyncState()?.cursor)

                rejectedFixtures.forEach { fixture ->
                    val cursorBefore = requireNotNull(dao.getSyncState()?.cursor)
                    val recipeBefore = requireNotNull(dao.getRecipe(recipe.id.toString()))
                    val rejectedChange = contractJson.decodeFromString<SyncChangeDto>(fixture.value.toString())
                    var rejected = false
                    try {
                        pageApplier.applySyncPage(
                            SyncResponse(listOf(rejectedChange), false, "fixture-cursor-rejected-${fixture.id}"),
                            cursorBefore,
                        )
                    } catch (_: IllegalArgumentException) {
                        rejected = true
                    }
                    assertTrue("${fixture.id} (${fixture.expectedCategory}) must reject", rejected)
                    executions[fixture.id] = (executions[fixture.id] ?: 0) + 1
                    assertEquals(cursorBefore, dao.getSyncState()?.cursor)
                    assertEquals(recipeBefore, dao.getRecipe(recipe.id.toString()))
                }

                assertEquals(fixtures.keys, executions.keys)
                assertTrue("duplicate Room persistence execution: $executions", executions.values.all { it == 1 })
            } finally {
                database.close()
            }
        }

    private fun roomFixtures(): Map<String, Fixture> {
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        val paths =
            assets
                .readText("manifest.json")
                .let(contractJson::parseToJsonElement)
                .jsonObject["files"]!!
                .jsonArray
        val allFixtures =
            buildList {
                paths.forEach { path ->
                    val name = path.jsonPrimitive.content
                    if (name.endsWith(".jsonl")) {
                        addAll(
                            assets
                                .readText(name)
                                .lines()
                                .filter(String::isNotBlank)
                                .mapNotNull(::roomFixture),
                        )
                    }
                }
            }
        check(allFixtures.groupBy { it.id }.values.all { it.size == 1 }) { "Duplicate room fixture ID" }
        return allFixtures.associateBy { it.id }
    }

    private fun roomFixture(line: String): Fixture? {
        val item = contractJson.parseToJsonElement(line).jsonObject
        val consumers =
            item["consumers"]!!
                .jsonArray
                .map {
                    it.jsonPrimitive.content
                }.toSet()
        if ("room" !in consumers) return null
        return Fixture(
            id = item["id"]!!.jsonPrimitive.content,
            schemaId = item["schemaId"]!!.jsonPrimitive.content,
            expected = item["expected"]!!.jsonPrimitive.content,
            expectedCategory = item["expectedCategory"]!!.jsonPrimitive.content,
            consumers = consumers,
            value = item["value"]!!.jsonObject,
        )
    }

    private fun Map<String, Fixture>.valueOf(id: String): JsonObject = requireNotNull(this[id]) { "Missing room fixture: $id" }.value

    private fun android.content.res.AssetManager.readText(path: String): String = open(path).bufferedReader().use(BufferedReader::readText)

    private data class Fixture(
        val id: String,
        val schemaId: String,
        val expected: String,
        val expectedCategory: String,
        val consumers: Set<String>,
        val value: JsonObject,
    )
}
