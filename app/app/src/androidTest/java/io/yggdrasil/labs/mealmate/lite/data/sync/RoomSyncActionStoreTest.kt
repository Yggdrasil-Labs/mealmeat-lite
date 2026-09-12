package io.yggdrasil.labs.mealmate.lite.data.sync

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RecipeView
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayload
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayloadPatch
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.RecipeRoomMapper
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.pendingActionEntityFromPayload
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.time.OffsetDateTime
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class RoomSyncActionStoreTest {
    @Test
    fun rejected_authority_is_applied_and_stale_ack_cannot_roll_back_the_recipe() =
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
                val recipeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
                dao.upsertRecipe(RecipeRoomMapper.toEntity(recipeView(recipeId, "10", "optimistic")))
                dao.upsertReplicaVersion(ReplicaVersionEntity("recipe", recipeId.toString(), "10"))
                val store = RoomSyncActionStore(database)

                val incompleteAction = action("00000000-0000-4000-8000-000000000000", recipeId)
                dao.insertPendingAction(incompleteAction)
                dao.claimPendingActions("attempt-incomplete", NOW.toString(), 1)
                try {
                    store.acknowledge(incompleteAction.actionId, "attempt-incomplete", null, null)
                    fail("An acknowledgement without authoritative data must be rejected")
                } catch (_: IllegalArgumentException) {
                    // Expected: the action must remain recoverable until a complete acknowledgement arrives.
                }
                assertEquals(PendingActionState.SENDING, dao.getPendingAction(incompleteAction.actionId)?.state)

                val rejectedAction = action("11111111-1111-4111-8111-111111111111", recipeId)
                dao.insertPendingAction(rejectedAction)
                dao.claimPendingActions("attempt-rejected", NOW.toString(), 1)
                val authoritative = recipeView(recipeId, "11", "server")

                assertTrue(
                    store.reject(
                        rejectedAction.actionId,
                        "attempt-rejected",
                        failure(rejectedAction.actionId, authoritative),
                    ),
                )
                assertEquals(PendingActionState.FAILED, dao.getPendingAction(rejectedAction.actionId)?.state)
                assertEquals("server", dao.getRecipe(recipeId.toString())?.name)
                assertEquals("11", dao.getReplicaVersion("recipe", recipeId.toString())?.serverVersion)

                val acknowledgedAction = action("33333333-3333-4333-8333-333333333333", recipeId)
                dao.insertPendingAction(acknowledgedAction)
                dao.claimPendingActions("attempt-acknowledged", NOW.toString(), 1)

                assertTrue(
                    store.acknowledge(
                        acknowledgedAction.actionId,
                        "attempt-acknowledged",
                        AppliedResultDtoResource.RecipeViewValue(recipeView(recipeId, "10", "stale")),
                        "10",
                    ),
                )
                assertNull(dao.getPendingAction(acknowledgedAction.actionId))
                assertEquals("server", dao.getRecipe(recipeId.toString())?.name)
                assertEquals("11", dao.getReplicaVersion("recipe", recipeId.toString())?.serverVersion)
            } finally {
                database.close()
            }
        }

    private fun action(
        actionId: String,
        recipeId: UUID,
    ) = pendingActionEntityFromPayload(
        SyncActionDto.SyncActionDtoOneOfValue(
            SyncActionDtoOneOf(
                actionId = UUID.fromString(actionId),
                type = "recipe.patch",
                createdAt = NOW,
                payload =
                    SyncActionDtoOneOfPayload(
                        recipeId = recipeId,
                        patch = SyncActionDtoOneOfPayloadPatch(name = "updated"),
                    ),
            ),
        ),
    )

    private fun failure(
        actionId: String,
        resource: RecipeView,
    ) = SyncFailureEntity(
        actionId = actionId,
        errCode = "CONFLICT",
        errMessage = "server wins",
        authoritativeSchemaVersion = 1,
        authoritativeJson =
            contractJson.encodeToString(
                AppliedResultDtoResource.serializer(),
                AppliedResultDtoResource.RecipeViewValue(resource),
            ),
        serverVersion = resource.serverVersion,
        requiresFullResync = false,
        createdAt = NOW.toString(),
    )

    private fun recipeView(
        id: UUID,
        serverVersion: String,
        name: String,
    ) = RecipeView(
        id = id,
        name = name,
        tags = emptyList(),
        ingredients = emptyList(),
        steps = emptyList(),
        serverVersion = serverVersion,
        createdAt = NOW,
        updatedAt = NOW,
    )

    private companion object {
        val NOW: OffsetDateTime = OffsetDateTime.parse("2026-09-08T00:00:00Z")
    }
}
