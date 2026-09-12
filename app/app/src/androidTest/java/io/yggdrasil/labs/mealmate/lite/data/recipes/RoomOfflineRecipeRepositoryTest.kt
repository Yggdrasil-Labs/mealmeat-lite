package io.yggdrasil.labs.mealmate.lite.data.recipes

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayload
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayloadPatch
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.pendingActionEntityFromPayload
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class RoomOfflineRecipeRepositoryTest {
    @Test
    fun acknowledged_action_refreshes_effective_recipe_projection() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val recipeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
                val action = pendingActionEntityFromPayload(patchAction(recipeId))
                val dao = database.contractCacheDao()
                dao.upsertRecipe(recipe(recipeId.toString()))
                dao.insertPendingAction(action.copy(state = PendingActionState.SENDING, attemptId = "attempt"))

                val repository = RoomOfflineRecipeRepository(database)
                val emissions = Channel<List<RecipeEntity>>(Channel.UNLIMITED)
                val observer =
                    launch {
                        repository.observeRecipes().collect { emissions.send(it) }
                    }
                try {
                    assertEquals("Local name", withTimeout(5_000) { emissions.receive() }.single().name)

                    assertEquals(true, dao.acknowledgeAction(action.actionId, "attempt"))

                    assertEquals("Authoritative name", withTimeout(5_000) { emissions.receive() }.single().name)
                } finally {
                    observer.cancel()
                }
            } finally {
                database.close()
            }
        }

    @Test
    fun rejected_action_refreshes_effective_recipe_projection() =
        runBlocking {
            val database =
                Room
                    .inMemoryDatabaseBuilder(
                        InstrumentationRegistry.getInstrumentation().targetContext,
                        MealMateDatabase::class.java,
                    ).allowMainThreadQueries()
                    .build()
            try {
                val recipeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
                val action = pendingActionEntityFromPayload(patchAction(recipeId))
                val dao = database.contractCacheDao()
                dao.upsertRecipe(recipe(recipeId.toString()))
                dao.insertPendingAction(action.copy(state = PendingActionState.SENDING, attemptId = "attempt"))

                val repository = RoomOfflineRecipeRepository(database)
                val emissions = Channel<List<RecipeEntity>>(Channel.UNLIMITED)
                val observer =
                    launch {
                        repository.observeRecipes().collect { emissions.send(it) }
                    }
                try {
                    assertEquals("Local name", withTimeout(5_000) { emissions.receive() }.single().name)

                    assertEquals(
                        true,
                        dao.rejectAction(
                            action.actionId,
                            "attempt",
                            SyncFailureEntity(
                                actionId = action.actionId,
                                errCode = "VERSION_CONFLICT",
                                errMessage = "stale version",
                                authoritativeSchemaVersion = null,
                                authoritativeJson = null,
                                serverVersion = "2",
                                requiresFullResync = false,
                                createdAt = NOW.toString(),
                            ),
                        ),
                    )

                    assertEquals("Authoritative name", withTimeout(5_000) { emissions.receive() }.single().name)
                } finally {
                    observer.cancel()
                }
            } finally {
                database.close()
            }
        }

    private fun patchAction(recipeId: UUID): SyncActionDto =
        SyncActionDto.SyncActionDtoOneOfValue(
            SyncActionDtoOneOf(
                actionId = UUID.fromString("11111111-1111-4111-8111-111111111111"),
                type = "recipe.patch",
                createdAt = NOW,
                payload =
                    SyncActionDtoOneOfPayload(
                        recipeId = recipeId,
                        patch = SyncActionDtoOneOfPayloadPatch(name = "Local name"),
                    ),
            ),
        )

    private fun recipe(id: String): RecipeEntity =
        RecipeEntity(
            id = id,
            name = "Authoritative name",
            tagsJson = "[]",
            ingredientsJson = "[]",
            stepsJson = "[]",
            serverVersion = "1",
            createdAt = NOW.toString(),
            updatedAt = NOW.toString(),
            imageUrl = null,
            notes = null,
        )

    private companion object {
        val NOW: OffsetDateTime = OffsetDateTime.of(2026, 9, 8, 0, 0, 0, 0, ZoneOffset.UTC)
    }
}
