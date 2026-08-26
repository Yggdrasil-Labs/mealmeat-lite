@file:Suppress("MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.data.sync

import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

sealed interface SyncIssueView {
    data class ActionFailure(
        val actionId: String,
        val errorCode: String,
        val message: String,
    ) : SyncIssueView

    data class Diagnostic(
        val diagnosticId: String,
        val kind: SyncDiagnosticKind,
        val errorCode: String,
        val message: String,
        val resource: String?,
    ) : SyncIssueView
}

sealed interface FailureResolution {
    data object Discarded : FailureResolution

    data object Dismissed : FailureResolution

    data object NotFound : FailureResolution

    data object SessionChanged : FailureResolution
}

interface SyncFailureRepository {
    fun observe(): Flow<List<SyncIssueView>>

    suspend fun discardActionFailure(failedActionId: String): FailureResolution

    suspend fun dismissDiagnostic(diagnosticId: String): FailureResolution
}

class RoomSyncFailureRepository(
    private val database: MealMateDatabase,
    private val sessionManager: SessionManager,
) : SyncFailureRepository {
    override fun observe(): Flow<List<SyncIssueView>> =
        combine(
            database.contractCacheDao().observeSyncFailures(),
            database.contractCacheDao().observeSyncDiagnostics(),
            sessionManager.state,
        ) { failures, diagnostics, session ->
            failures.map { SyncIssueView.ActionFailure(it.actionId, it.errCode, it.errMessage) } +
                diagnostics
                    .filter { it.sessionGeneration == session.generation }
                    .map { SyncIssueView.Diagnostic(it.diagnosticId, it.kind, it.errorCode, it.message, it.resource) }
        }

    override suspend fun discardActionFailure(failedActionId: String): FailureResolution =
        if (database.contractCacheDao().discardActionFailure(failedActionId)) FailureResolution.Discarded else FailureResolution.NotFound

    override suspend fun dismissDiagnostic(diagnosticId: String): FailureResolution =
        if (database.contractCacheDao().dismissDiagnostic(diagnosticId)) FailureResolution.Dismissed else FailureResolution.NotFound
}
