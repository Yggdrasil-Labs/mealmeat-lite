@file:Suppress("MagicNumber", "MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.data.recipes

import androidx.room.withTransaction
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOf1Payload
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayload
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDtoOneOfPayloadPatch
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.decodePendingActionPayload
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.pendingActionEntityFromPayload
import io.yggdrasil.labs.mealmate.lite.data.sync.StateMutationMutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

data class RecipePatchCommand(
    val name: String?,
    val tags: List<String>?,
) {
    init {
        require(name != null || tags != null) { "recipe patch must change at least one field" }
        name?.let { require(it.length in 1..100) { "recipe patch name length is invalid" } }
        tags?.let {
            require(it.size <= 20) { "recipe patch may contain at most 20 tags" }
            require(it.all { tag -> tag.length <= 30 }) { "recipe patch tag length is invalid" }
        }
    }
}

sealed interface LocalMutationResult {
    data class Applied(
        val actionId: String,
        val effectiveRecipe: RecipeEntity?,
    ) : LocalMutationResult

    data object Missing : LocalMutationResult

    data object Tombstoned : LocalMutationResult

    data object SessionChanged : LocalMutationResult
}

interface OfflineRecipeRepository {
    suspend fun patch(
        recipeId: String,
        patch: RecipePatchCommand,
    ): LocalMutationResult

    suspend fun delete(recipeId: String): LocalMutationResult

    suspend fun replaceFailed(
        failedActionId: String,
        recipeId: String,
        patch: RecipePatchCommand,
    ): LocalMutationResult
}

class RoomOfflineRecipeRepository(
    private val database: MealMateDatabase,
    private val actionIdSource: () -> UUID = UUID::randomUUID,
    private val now: () -> OffsetDateTime = { OffsetDateTime.now(ZoneOffset.UTC) },
) : OfflineRecipeRepository {
    override suspend fun patch(
        recipeId: String,
        patch: RecipePatchCommand,
    ): LocalMutationResult = mutate(recipeId) { id, createdAt -> patchAction(id, createdAt, patch) }

    override suspend fun delete(recipeId: String): LocalMutationResult = mutate(recipeId) { id, createdAt -> deleteAction(id, createdAt) }

    override suspend fun replaceFailed(
        failedActionId: String,
        recipeId: String,
        patch: RecipePatchCommand,
    ): LocalMutationResult =
        StateMutationMutex.instance.withLock {
            database.withTransaction {
                val dao = database.contractCacheDao()
                val recipe = dao.getRecipe(recipeId) ?: return@withTransaction LocalMutationResult.Missing
                if (recipe.deletedAt != null) return@withTransaction LocalMutationResult.Tombstoned
                if (effectiveProjection(recipe, dao.getOutstandingActions()) == null) {
                    return@withTransaction LocalMutationResult.Tombstoned
                }
                if (!dao.discardActionFailure(failedActionId)) return@withTransaction LocalMutationResult.SessionChanged
                val recipeUuid =
                    runCatching { UUID.fromString(recipeId) }.getOrNull()
                        ?: return@withTransaction LocalMutationResult.Missing
                val entity = pendingActionEntityFromPayload(patchAction(recipeUuid, now(), patch))
                dao.insertPendingAction(entity)
                LocalMutationResult.Applied(
                    entity.actionId,
                    effectiveProjection(recipe, dao.getOutstandingActions()),
                )
            }
        }

    private suspend fun mutate(
        recipeId: String,
        action: (UUID, OffsetDateTime) -> SyncActionDto,
    ): LocalMutationResult =
        StateMutationMutex.instance.withLock {
            database.withTransaction {
                val dao = database.contractCacheDao()
                val recipe = dao.getRecipe(recipeId) ?: return@withTransaction LocalMutationResult.Missing
                if (recipe.deletedAt != null) return@withTransaction LocalMutationResult.Tombstoned
                if (effectiveProjection(recipe, dao.getOutstandingActions()) == null) {
                    return@withTransaction LocalMutationResult.Tombstoned
                }
                val recipeUuid =
                    runCatching { UUID.fromString(recipeId) }.getOrNull()
                        ?: return@withTransaction LocalMutationResult.Missing
                val entity = pendingActionEntityFromPayload(action(recipeUuid, now()))
                dao.insertPendingAction(entity)
                LocalMutationResult.Applied(entity.actionId, effectiveProjection(recipe, dao.getOutstandingActions()))
            }
        }

    private fun effectiveProjection(
        authoritative: RecipeEntity,
        actions: List<io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity>,
    ): RecipeEntity? {
        var effective: RecipeEntity? = authoritative
        actions.sortedWith(compareBy({ it.createdAt }, { it.actionId })).forEach { action ->
            val payload = decodePendingActionPayload(action.payloadSchemaVersion, action.payloadJson)
            when (payload) {
                is SyncActionDto.SyncActionDtoOneOfValue -> {
                    if (payload.value.payload.recipeId
                            .toString() == authoritative.id && effective != null
                    ) {
                        val patch = payload.value.payload.patch
                        effective =
                            effective?.copy(
                                name = patch.name ?: effective?.name.orEmpty(),
                                tagsJson = patch.tags?.let(contractJson::encodeToString) ?: effective?.tagsJson.orEmpty(),
                            )
                    }
                }

                is SyncActionDto.SyncActionDtoOneOf1Value -> {
                    if (payload.value.payload.recipeId
                            .toString() == authoritative.id
                    ) {
                        effective = null
                    }
                }
            }
        }
        return effective
    }

    private fun patchAction(
        recipeId: UUID,
        createdAt: OffsetDateTime,
        patch: RecipePatchCommand,
    ): SyncActionDto =
        SyncActionDto.SyncActionDtoOneOfValue(
            SyncActionDtoOneOf(
                actionId = actionIdSource(),
                type = "recipe.patch",
                createdAt = createdAt,
                payload = SyncActionDtoOneOfPayload(recipeId, SyncActionDtoOneOfPayloadPatch(patch.name, patch.tags)),
            ),
        )

    private fun deleteAction(
        recipeId: UUID,
        createdAt: OffsetDateTime,
    ): SyncActionDto =
        SyncActionDto.SyncActionDtoOneOf1Value(
            SyncActionDtoOneOf1(actionIdSource(), "recipe.delete", createdAt, SyncActionDtoOneOf1Payload(recipeId)),
        )
}
