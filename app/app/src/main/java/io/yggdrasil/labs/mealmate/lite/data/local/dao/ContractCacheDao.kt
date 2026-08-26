@file:Suppress("MagicNumber", "MaxLineLength")

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
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionState
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
import kotlinx.coroutines.flow.Flow

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

    @Query("SELECT * FROM recipes WHERE deletedAt IS NULL ORDER BY updatedAt DESC, id ASC")
    abstract fun observeRecipes(): Flow<List<RecipeEntity>>

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

    @Query("SELECT * FROM pending_actions WHERE state IN ('PENDING', 'SENDING') ORDER BY createdAt ASC, actionId ASC")
    abstract suspend fun getOutstandingActions(): List<PendingActionEntity>

    @Query("SELECT * FROM pending_actions WHERE state = 'PENDING' ORDER BY createdAt ASC, actionId ASC LIMIT :limit")
    internal abstract suspend fun pendingActionsForClaim(limit: Int): List<PendingActionEntity>

    @Query(
        "UPDATE pending_actions SET state = 'SENDING', attemptId = :attemptId, claimedAt = :claimedAt WHERE actionId = :actionId AND state = 'PENDING'",
    )
    internal abstract suspend fun claimPendingAction(
        actionId: String,
        attemptId: String,
        claimedAt: String,
    ): Int

    @Query(
        "UPDATE pending_actions SET state = 'PENDING', attemptId = NULL, claimedAt = NULL WHERE state = 'SENDING' AND claimedAt < :staleBefore",
    )
    abstract suspend fun recoverStaleClaims(staleBefore: String): Int

    @Query("DELETE FROM pending_actions WHERE actionId = :actionId AND state = 'SENDING' AND attemptId = :attemptId")
    internal abstract suspend fun deleteAcknowledgedAction(
        actionId: String,
        attemptId: String,
    ): Int

    @Query(
        "UPDATE pending_actions SET state = 'FAILED', attemptId = NULL, claimedAt = NULL WHERE actionId = :actionId AND state = 'SENDING' AND attemptId = :attemptId",
    )
    internal abstract suspend fun failClaimedAction(
        actionId: String,
        attemptId: String,
    ): Int

    @Query(
        "UPDATE pending_actions SET state = 'PENDING', attemptId = NULL, claimedAt = NULL WHERE actionId = :actionId AND state = 'SENDING' AND attemptId = :attemptId",
    )
    internal abstract suspend fun releaseClaimedAction(
        actionId: String,
        attemptId: String,
    ): Int

    @Query("DELETE FROM pending_actions WHERE actionId = :actionId AND state = 'FAILED'")
    internal abstract suspend fun deleteFailedAction(actionId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    internal abstract suspend fun upsertSyncFailureUnchecked(entity: SyncFailureEntity)

    @Query("SELECT * FROM sync_failures ORDER BY createdAt ASC, actionId ASC")
    abstract fun observeSyncFailures(): Flow<List<SyncFailureEntity>>

    @Query("SELECT * FROM sync_failures WHERE actionId = :actionId")
    abstract suspend fun getSyncFailure(actionId: String): SyncFailureEntity?

    @Query("DELETE FROM sync_failures WHERE actionId = :actionId")
    internal abstract suspend fun deleteSyncFailure(actionId: String): Int

    @Query("SELECT * FROM sync_diagnostics ORDER BY createdAt ASC, diagnosticId ASC")
    abstract fun observeSyncDiagnostics(): Flow<List<SyncDiagnosticEntity>>

    @Query("DELETE FROM sync_diagnostics WHERE diagnosticId = :diagnosticId")
    internal abstract suspend fun deleteSyncDiagnostic(diagnosticId: String): Int

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
    open suspend fun claimPendingActions(
        attemptId: String,
        claimedAt: String,
        limit: Int,
    ): List<PendingActionEntity> {
        require(limit in 1..100) { "sync action claim limit must be 1..100" }
        return pendingActionsForClaim(limit).mapNotNull { action ->
            if (claimPendingAction(action.actionId, attemptId, claimedAt) == 1) {
                action.copy(state = PendingActionState.SENDING, attemptId = attemptId, claimedAt = claimedAt)
            } else {
                null
            }
        }
    }

    @Transaction
    open suspend fun acknowledgeAction(
        actionId: String,
        attemptId: String,
    ): Boolean = deleteAcknowledgedAction(actionId, attemptId) == 1

    @Transaction
    open suspend fun rejectAction(
        actionId: String,
        attemptId: String,
        failure: SyncFailureEntity,
    ): Boolean {
        require(failure.actionId == actionId) { "failure must belong to rejected action" }
        if (failClaimedAction(actionId, attemptId) != 1) return false
        upsertSyncFailure(failure)
        return true
    }

    @Transaction
    open suspend fun releaseAttempt(
        actionIds: List<String>,
        attemptId: String,
    ) {
        actionIds.forEach { actionId -> releaseClaimedAction(actionId, attemptId) }
    }

    @Transaction
    open suspend fun resetForFullResync() {
        clearPlanItems()
        clearWeeklyPlans()
        clearRecipes()
        clearSettings()
        clearConversationMessages()
        clearSyncState()
        clearReplicaVersions()
    }

    @Transaction
    open suspend fun discardActionFailure(actionId: String): Boolean {
        if (getSyncFailure(actionId) == null) return false
        if (deleteFailedAction(actionId) != 1) return false
        return deleteSyncFailure(actionId) == 1
    }

    @Transaction
    open suspend fun dismissDiagnostic(diagnosticId: String): Boolean = deleteSyncDiagnostic(diagnosticId) == 1

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
