package io.yggdrasil.labs.mealmate.lite.data.local

import androidx.room.withTransaction
import io.yggdrasil.labs.mealmate.lite.contract.InvariantId
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncChangeDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.contract.validateInvariant
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.RecipeRoomMapper
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.planItemEntityFromContract
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.settingsCacheEntityFromContract
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.weeklyPlanEntityFromContract

typealias SyncPageDto = SyncResponse

data class SyncApplyResult(
    val appliedChanges: Int,
    val cursor: String?,
)

/**
 * Applies a complete sync page in one Room transaction.
 * Source: https://developer.android.com/reference/kotlin/androidx/room/package-summary#withTransaction(androidx.room.RoomDatabase,kotlin.coroutines.SuspendFunction0)
 */
class SyncPageApplier(
    private val database: MealMateDatabase,
) {
    suspend fun applySyncPage(
        page: SyncPageDto,
        currentCursor: String?,
    ): SyncApplyResult =
        database.withTransaction {
            val dao = database.contractCacheDao()
            val storedCursor = dao.getSyncState()?.cursor
            require(storedCursor == currentCursor) { "Sync cursor changed before page application" }
            page.changes.forEach { change -> applyChange(change) }
            dao.upsertSyncState(SyncStateEntity(cursor = page.nextCursor))
            SyncApplyResult(appliedChanges = page.changes.size, cursor = page.nextCursor)
        }

    private suspend fun applyChange(change: SyncChangeDto) {
        val dao = database.contractCacheDao()
        when (change) {
            is SyncChangeDto.SyncChangeDtoOneOfValue -> {
                change.value.let { value ->
                    require(value.resource == "recipe" && value.operation == "upsert") {
                        "Recipe upsert must have resource=recipe and operation=upsert"
                    }
                    requireMatchingVersion(value.serverVersion, value.data.serverVersion)
                    dao.upsertRecipe(RecipeRoomMapper.toEntity(value.data))
                }
            }

            is SyncChangeDto.SyncChangeDtoOneOf1Value -> {
                val value = change.value
                require(value.resource == "recipe" && value.operation == "delete") {
                    "Recipe tombstone must have resource=recipe and operation=delete"
                }
                val tombstone = value.data
                requireMatchingVersion(value.serverVersion, tombstone.serverVersion)
                dao.upsertRecipe(
                    RecipeEntity(
                        id = tombstone.id.toString(),
                        name = "",
                        tagsJson = "[]",
                        ingredientsJson = "[]",
                        stepsJson = "[]",
                        serverVersion = tombstone.serverVersion,
                        createdAt = tombstone.deletedAt.toInstant().toString(),
                        updatedAt = tombstone.deletedAt.toInstant().toString(),
                        imageUrl = null,
                        notes = null,
                        deletedAt = tombstone.deletedAt.toInstant().toString(),
                    ),
                )
            }

            is SyncChangeDto.SyncChangeDtoOneOf2Value -> {
                val value = change.value
                require(value.resource == "weekly_plan" && value.operation == "upsert") {
                    "Weekly plan must have resource=weekly_plan and operation=upsert"
                }
                val plan = value.data
                requireMatchingVersion(value.serverVersion, plan.serverVersion)
                dao.replaceWeeklyPlan(
                    weeklyPlanEntityFromContract(plan),
                    plan.items.map { planItemEntityFromContract(plan.id.toString(), it) },
                )
            }

            is SyncChangeDto.SyncChangeDtoOneOf3Value -> {
                val value = change.value
                require(value.resource == "settings" && value.operation == "upsert") {
                    "Settings must have resource=settings and operation=upsert"
                }
                requireValidVersion(value.serverVersion)
                dao.upsertSettings(settingsCacheEntityFromContract(value.data))
            }
        }
    }

    private fun requireValidVersion(value: String) {
        require(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, value).success) {
            "Invalid serverVersion: $value"
        }
    }

    private fun requireMatchingVersion(
        changeVersion: String,
        resourceVersion: String,
    ) {
        requireValidVersion(changeVersion)
        requireValidVersion(resourceVersion)
        require(changeVersion == resourceVersion) { "Sync change version must match its resource version" }
    }
}
