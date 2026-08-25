package io.yggdrasil.labs.mealmate.lite.data.sync

import androidx.room.withTransaction
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.SyncApplyResult
import io.yggdrasil.labs.mealmate.lite.data.local.SyncPageApplier
import io.yggdrasil.labs.mealmate.lite.data.local.SyncSessionFence
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import io.yggdrasil.labs.mealmate.lite.data.remote.MealMateApi
import io.yggdrasil.labs.mealmate.lite.data.remote.requireSuccessData
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException

enum class SyncReason {
    InitialProvisioning,
    AppForeground,
    Manual,
    Worker,
}

sealed interface SyncRunResult {
    data class Success(
        val pages: Int,
        val appliedChanges: Int,
    ) : SyncRunResult

    data class Failed(
        val kind: SyncFailureKind,
        val errorCode: String,
        val message: String,
    ) : SyncRunResult

    data object SessionChanged : SyncRunResult
}

enum class SyncFailureKind {
    NETWORK,
    CURSOR,
    PROTOCOL,
}

interface SyncCoordinator {
    suspend fun sync(reason: SyncReason): SyncRunResult
}

interface SyncPageClient {
    suspend fun fetch(
        cursor: String?,
        token: String,
    ): SyncResponse
}

interface SyncPageStore {
    suspend fun currentCursor(sessionFence: SyncSessionFence): String?

    suspend fun apply(
        page: SyncResponse,
        currentCursor: String?,
        sessionFence: SyncSessionFence,
        promoteOnTerminal: Boolean,
    ): SyncApplyResult

    suspend fun recordDiagnostic(
        sessionFence: SyncSessionFence,
        kind: SyncDiagnosticKind,
        errorCode: String,
        message: String,
    )
}

private sealed interface PageFetchOutcome {
    data class Page(
        val value: SyncResponse,
    ) : PageFetchOutcome

    data class Stop(
        val result: SyncRunResult,
    ) : PageFetchOutcome
}

/** Single application-scoped entry point for initial and later sync runs. */
class InitialSyncCoordinator(
    private val sessionManager: SessionManager,
    private val client: SyncPageClient,
    private val store: SyncPageStore,
    private val mutationMutex: Mutex = StateMutationMutex.instance,
) : SyncCoordinator {
    override suspend fun sync(reason: SyncReason): SyncRunResult {
        val expectedGeneration = sessionManager.state.value.generation ?: return SyncRunResult.SessionChanged
        return mutationMutex.withLock {
            syncLocked(reason, expectedGeneration)
        }
    }

    @Suppress("ReturnCount", "TooGenericExceptionCaught") // Guard exits make stale sessions/pages fail closed.
    private suspend fun syncLocked(
        reason: SyncReason,
        expectedGeneration: Long,
    ): SyncRunResult {
        val session = sessionManager.state.value
        val generation = session.generation?.takeIf { it == expectedGeneration } ?: return SyncRunResult.SessionChanged
        if (session.phase == SessionPhase.Provisioning && reason != SyncReason.InitialProvisioning) {
            return SyncRunResult.SessionChanged
        }
        val credential = sessionManager.currentCredential(generation) ?: return SyncRunResult.SessionChanged
        val fence = SyncSessionFence(credential.sessionId, credential.sessionGeneration)
        var cursor =
            try {
                store.currentCursor(fence)
            } catch (_: Exception) {
                return SyncRunResult.SessionChanged
            }
        val seenCursors = mutableSetOf<String>()
        cursor?.let(seenCursors::add)
        var pages = 0
        var appliedChanges = 0

        while (true) {
            if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged
            val page =
                when (val outcome = fetchPage(cursor, credential.token, generation, fence)) {
                    is PageFetchOutcome.Page -> outcome.value
                    is PageFetchOutcome.Stop -> return outcome.result
                }
            if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged

            val cursorFailure = validateCursor(page, cursor, seenCursors)
            if (cursorFailure != null) {
                return failure(
                    fence,
                    SyncFailureKind.CURSOR,
                    SyncDiagnosticKind.CURSOR,
                    cursorFailure,
                    "Invalid sync cursor chain",
                )
            }

            val terminal = !page.hasMore
            val promote =
                terminal &&
                    session.phase == SessionPhase.Provisioning &&
                    reason == SyncReason.InitialProvisioning
            val applied =
                try {
                    store.apply(page, cursor, fence, promote)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    return failure(
                        fence,
                        SyncFailureKind.PROTOCOL,
                        SyncDiagnosticKind.PROTOCOL,
                        "PAGE_REJECTED",
                        error.message ?: "Sync page was rejected",
                    )
                }
            if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged
            pages += 1
            appliedChanges += applied.appliedChanges

            if (terminal) {
                if (promote && !sessionManager.refreshAfterSync(generation)) return SyncRunResult.SessionChanged
                return SyncRunResult.Success(pages, appliedChanges)
            }
            cursor = requireNotNull(page.nextCursor)
        }
    }

    @Suppress("TooGenericExceptionCaught") // Non-I/O failures are malformed decoded responses.
    private suspend fun fetchPage(
        cursor: String?,
        token: String,
        generation: Long,
        fence: SyncSessionFence,
    ): PageFetchOutcome =
        try {
            PageFetchOutcome.Page(client.fetch(cursor, token))
        } catch (error: CancellationException) {
            throw error
        } catch (error: ApiCallException) {
            PageFetchOutcome.Stop(classifyApiFailure(error, generation, fence))
        } catch (error: IOException) {
            val result =
                if (sessionManager.isCurrent(generation)) {
                    transportFailure("NETWORK_ERROR", error.message)
                } else {
                    SyncRunResult.SessionChanged
                }
            PageFetchOutcome.Stop(result)
        } catch (error: Exception) {
            val result =
                if (sessionManager.isCurrent(generation)) {
                    failure(
                        fence,
                        SyncFailureKind.PROTOCOL,
                        SyncDiagnosticKind.PROTOCOL,
                        "RESPONSE_REJECTED",
                        error.message ?: "Sync response was rejected",
                    )
                } else {
                    SyncRunResult.SessionChanged
                }
            PageFetchOutcome.Stop(result)
        }

    private suspend fun classifyApiFailure(
        error: ApiCallException,
        generation: Long,
        fence: SyncSessionFence,
    ): SyncRunResult {
        if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged
        if (error.statusCode == UNAUTHORIZED_STATUS) {
            sessionManager.invalidate(generation)
            return SyncRunResult.SessionChanged
        }
        if (error.errorCode == INVALID_CURSOR_CODE) {
            return failure(
                fence,
                SyncFailureKind.CURSOR,
                SyncDiagnosticKind.CURSOR,
                INVALID_CURSOR_CODE,
                error.message,
            )
        }
        if (error.statusCode in CLIENT_ERROR_STATUS_RANGE &&
            error.statusCode !in TRANSIENT_CLIENT_STATUS_CODES
        ) {
            return failure(
                fence,
                SyncFailureKind.PROTOCOL,
                SyncDiagnosticKind.PROTOCOL,
                error.errorCode ?: "HTTP_${error.statusCode}",
                error.message,
            )
        }
        return transportFailure("HTTP_${error.statusCode}", error.message)
    }

    private fun validateCursor(
        page: SyncResponse,
        currentCursor: String?,
        seenCursors: MutableSet<String>,
    ): String? {
        val next = page.nextCursor
        if (!page.hasMore) return if (next == null) null else "TERMINAL_CURSOR_PRESENT"
        if (next.isNullOrBlank()) return "MISSING_NEXT_CURSOR"
        if (next == currentCursor || !seenCursors.add(next)) return "CURSOR_CYCLE"
        return null
    }

    private suspend fun failure(
        fence: SyncSessionFence,
        kind: SyncFailureKind,
        diagnosticKind: SyncDiagnosticKind,
        errorCode: String,
        message: String?,
    ): SyncRunResult.Failed {
        val safeMessage = message ?: errorCode
        runCatching { store.recordDiagnostic(fence, diagnosticKind, errorCode, safeMessage) }
        return SyncRunResult.Failed(kind, errorCode, safeMessage)
    }

    private fun transportFailure(
        errorCode: String,
        message: String?,
    ): SyncRunResult.Failed = SyncRunResult.Failed(SyncFailureKind.NETWORK, errorCode, message ?: errorCode)

    private companion object {
        const val UNAUTHORIZED_STATUS = 401
        const val INVALID_CURSOR_CODE = "INVALID_CURSOR"
        val CLIENT_ERROR_STATUS_RANGE = 400..499
        val TRANSIENT_CLIENT_STATUS_CODES = setOf(408, 429)
    }
}

class RetrofitSyncPageClient(
    private val api: MealMateApi,
) : SyncPageClient {
    override suspend fun fetch(
        cursor: String?,
        token: String,
    ): SyncResponse =
        api
            .sync(cursor = cursor, authorization = "Bearer $token")
            .requireSuccessData()
}

class RoomSyncPageStore(
    private val database: MealMateDatabase,
    private val applier: SyncPageApplier,
) : SyncPageStore {
    override suspend fun currentCursor(sessionFence: SyncSessionFence): String? =
        database.withTransaction {
            val dao = database.contractCacheDao()
            val session = dao.getClientSession()
            require(
                session?.sessionId == sessionFence.sessionId &&
                    session.sessionGeneration == sessionFence.sessionGeneration,
            ) { "Client session changed before reading sync cursor" }
            dao.getSyncState()?.cursor
        }

    override suspend fun apply(
        page: SyncResponse,
        currentCursor: String?,
        sessionFence: SyncSessionFence,
        promoteOnTerminal: Boolean,
    ): SyncApplyResult = applier.applySyncPage(page, currentCursor, sessionFence, promoteOnTerminal)

    override suspend fun recordDiagnostic(
        sessionFence: SyncSessionFence,
        kind: SyncDiagnosticKind,
        errorCode: String,
        message: String,
    ) = applier.recordDiagnostic(sessionFence, kind, errorCode, message)
}

object StateMutationMutex {
    internal val instance = Mutex()
}
