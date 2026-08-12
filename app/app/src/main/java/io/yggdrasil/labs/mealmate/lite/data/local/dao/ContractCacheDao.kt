package io.yggdrasil.labs.mealmate.lite.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PlanItemEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SettingsCacheEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncStateEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.WeeklyPlanEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.requireCanonicalPendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.requireValidSyncFailureEntity

/**
 * The sole write boundary for contract-backed cache data.
 * Source: https://developer.android.com/training/data-storage/room/accessing-data
 */
@Dao
@Suppress("TooManyFunctions") // Room requires all cache queries and transactions on this DAO boundary.
abstract class ContractCacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertRecipe(entity: RecipeEntity)

    @Query("SELECT * FROM recipes WHERE id = :id")
    abstract suspend fun getRecipe(id: String): RecipeEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertWeeklyPlan(entity: WeeklyPlanEntity)

    @Query("SELECT * FROM weekly_plans WHERE id = :id")
    abstract suspend fun getWeeklyPlan(id: String): WeeklyPlanEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertPlanItems(entities: List<PlanItemEntity>)

    @Query("SELECT * FROM plan_items WHERE weeklyPlanId = :weeklyPlanId ORDER BY date, mealType")
    abstract suspend fun getPlanItems(weeklyPlanId: String): List<PlanItemEntity>

    @Query("DELETE FROM plan_items WHERE weeklyPlanId = :weeklyPlanId")
    abstract suspend fun deletePlanItems(weeklyPlanId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertSettings(entity: SettingsCacheEntity)

    @Query("SELECT * FROM settings_cache WHERE `key` = :key")
    abstract suspend fun getSettings(key: String): SettingsCacheEntity?

    @Insert
    internal abstract suspend fun insertConversationMessageUnchecked(entity: ConversationMessageEntity)

    @Query("SELECT * FROM conversation_messages ORDER BY localSequence ASC")
    abstract suspend fun getConversationMessages(): List<ConversationMessageEntity>

    @Query(
        "DELETE FROM conversation_messages " +
            "WHERE localSequence NOT IN " +
            "(SELECT localSequence FROM conversation_messages ORDER BY localSequence DESC LIMIT 40)",
    )
    internal abstract suspend fun retainLatestConversationMessages()

    @Insert(onConflict = OnConflictStrategy.ABORT)
    internal abstract suspend fun insertPendingActionUnchecked(entity: PendingActionEntity)

    @Query("SELECT * FROM pending_actions WHERE actionId = :actionId")
    abstract suspend fun getPendingAction(actionId: String): PendingActionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    internal abstract suspend fun upsertSyncFailureUnchecked(entity: SyncFailureEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertSyncState(entity: SyncStateEntity)

    @Query("SELECT * FROM sync_state WHERE singletonId = 0")
    abstract suspend fun getSyncState(): SyncStateEntity?

    suspend fun insertPendingAction(entity: PendingActionEntity) {
        requireCanonicalPendingActionEntity(entity)
        insertPendingActionUnchecked(entity)
    }

    suspend fun upsertSyncFailure(entity: SyncFailureEntity) {
        requireValidSyncFailureEntity(entity)
        upsertSyncFailureUnchecked(entity)
    }

    @Transaction
    open suspend fun appendConversationMessage(entity: ConversationMessageEntity) {
        require(entity.content.length <= MAX_CONVERSATION_MESSAGE_LENGTH) {
            "conversation message exceeds $MAX_CONVERSATION_MESSAGE_LENGTH characters"
        }
        insertConversationMessageUnchecked(entity)
        retainLatestConversationMessages()
    }

    @Transaction
    open suspend fun replaceWeeklyPlan(
        entity: WeeklyPlanEntity,
        items: List<PlanItemEntity>,
    ) {
        upsertWeeklyPlan(entity)
        deletePlanItems(entity.id)
        insertPlanItems(items)
    }

    private companion object {
        const val MAX_CONVERSATION_MESSAGE_LENGTH = 10_000
    }
}
