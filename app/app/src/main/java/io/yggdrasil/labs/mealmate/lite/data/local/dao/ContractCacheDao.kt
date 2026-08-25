package io.yggdrasil.labs.mealmate.lite.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ClientSessionState
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PlanItemEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SettingsCacheEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticEntity
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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertClientSession(entity: ClientSessionEntity)

    @Query("SELECT * FROM client_session WHERE singletonId = 0")
    abstract suspend fun getClientSession(): ClientSessionEntity?

    @Query(
        "UPDATE client_session SET selectedModelId = :modelId " +
            "WHERE singletonId = 0 AND sessionId = :sessionId AND sessionGeneration = :generation " +
            "AND state = 'provisioning'",
    )
    abstract suspend fun selectModel(
        sessionId: String,
        generation: Long,
        modelId: String,
    ): Int

    @Query(
        "UPDATE client_session SET state = 'active' " +
            "WHERE singletonId = 0 AND sessionId = :sessionId AND sessionGeneration = :generation " +
            "AND state = 'provisioning' AND selectedModelId IS NOT NULL AND length(selectedModelId) > 0",
    )
    abstract suspend fun promoteClientSession(
        sessionId: String,
        generation: Long,
    ): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun upsertReplicaVersion(entity: ReplicaVersionEntity)

    @Query("SELECT * FROM replica_versions WHERE resource = :resource AND resourceId = :resourceId")
    abstract suspend fun getReplicaVersion(
        resource: String,
        resourceId: String,
    ): ReplicaVersionEntity?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    abstract suspend fun insertSyncDiagnostic(entity: SyncDiagnosticEntity)

    @Query("DELETE FROM sync_diagnostics WHERE sessionId = :sessionId AND sessionGeneration = :generation")
    abstract suspend fun clearSyncDiagnostics(
        sessionId: String,
        generation: Long,
    )

    @Query("DELETE FROM plan_items")
    internal abstract suspend fun clearPlanItems()

    @Query("DELETE FROM weekly_plans")
    internal abstract suspend fun clearWeeklyPlans()

    @Query("DELETE FROM recipes")
    internal abstract suspend fun clearRecipes()

    @Query("DELETE FROM settings_cache")
    internal abstract suspend fun clearSettings()

    @Query("DELETE FROM conversation_messages")
    internal abstract suspend fun clearConversationMessages()

    @Query("DELETE FROM pending_actions")
    internal abstract suspend fun clearPendingActions()

    @Query("DELETE FROM sync_failures")
    internal abstract suspend fun clearSyncFailures()

    @Query("DELETE FROM sync_state")
    internal abstract suspend fun clearSyncState()

    @Query("DELETE FROM chat_draft")
    internal abstract suspend fun clearChatDraft()

    @Query("DELETE FROM replica_versions")
    internal abstract suspend fun clearReplicaVersions()

    @Query("DELETE FROM sync_diagnostics")
    internal abstract suspend fun clearSyncDiagnostics()

    @Query("DELETE FROM client_session")
    internal abstract suspend fun clearClientSession()

    suspend fun insertPendingAction(entity: PendingActionEntity) {
        requireCanonicalPendingActionEntity(entity)
        insertPendingActionUnchecked(entity)
    }

    suspend fun upsertSyncFailure(entity: SyncFailureEntity) {
        requireValidSyncFailureEntity(entity)
        upsertSyncFailureUnchecked(entity)
    }

    @Transaction
    open suspend fun replaceSession(entity: ClientSessionEntity) {
        require(entity.state != ClientSessionState.ACTIVE) {
            "replacement session cannot begin active"
        }
        clearPlanItems()
        clearWeeklyPlans()
        clearRecipes()
        clearSettings()
        clearConversationMessages()
        clearPendingActions()
        clearSyncFailures()
        clearSyncState()
        clearChatDraft()
        clearReplicaVersions()
        clearSyncDiagnostics()
        clearClientSession()
        upsertClientSession(entity)
    }

    @Transaction
    open suspend fun clearSessionData() {
        clearPlanItems()
        clearWeeklyPlans()
        clearRecipes()
        clearSettings()
        clearConversationMessages()
        clearPendingActions()
        clearSyncFailures()
        clearSyncState()
        clearChatDraft()
        clearReplicaVersions()
        clearSyncDiagnostics()
        clearClientSession()
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
