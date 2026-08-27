@file:Suppress("MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.data.sync

import androidx.room.withTransaction
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionResultDtoOneOf3Original
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionsRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionsResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase
import io.yggdrasil.labs.mealmate.lite.data.local.SyncApplyResult
import io.yggdrasil.labs.mealmate.lite.data.local.SyncPageApplier
import io.yggdrasil.labs.mealmate.lite.data.local.SyncSessionFence
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.decodePendingActionPayload
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import io.yggdrasil.labs.mealmate.lite.data.remote.MealMateApi
import io.yggdrasil.labs.mealmate.lite.data.remote.requireSuccessData
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

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

    suspend fun clearDiagnostics(sessionFence: SyncSessionFence)
}

interface SyncActionClient {
    suspend fun submit(
        actions: List<SyncActionDto>,
        token: String,
    ): SyncActionsResponse
}

interface SyncActionStore {
    suspend fun recoverStaleClaims(staleBefore: String): Int

    suspend fun claim(
        attemptId: String,
        claimedAt: String,
        limit: Int,
    ): List<PendingActionEntity>

    suspend fun acknowledge(
        actionId: String,
        attemptId: String,
        resource: AppliedResultDtoResource? = null,
        serverVersion: String? = null,
    ): Boolean

    suspend fun reject(
        actionId: String,
        attemptId: String,
        failure: SyncFailureEntity,
    ): Boolean

    suspend fun release(
        actionIds: List<String>,
        attemptId: String,
    )

    suspend fun quarantine(
        actionIds: List<String>,
        attemptId: String,
    )

    suspend fun resetForFullResync()
}

object SyncActionAcknowledgements {
    fun hasExactlyClaimedIds(
        claimed: Set<String>,
        received: Set<String>,
    ): Boolean = claimed == received
}

private sealed interface PageFetchOutcome {
    data class Page(
        val value: SyncResponse,
    ) : PageFetchOutcome

    data class Stop(
        val result: SyncRunResult,
    ) : PageFetchOutcome
}

private enum class ActionResultApply {
    Applied,
    ClaimLost,
    RequiresFullResync,
}

/** Single application-scoped entry point for initial and later sync runs. */
class InitialSyncCoordinator(
    private val sessionManager: SessionManager,
    private val client: SyncPageClient,
    private val store: SyncPageStore,
    private val actionClient: SyncActionClient? = null,
    private val actionStore: SyncActionStore? = null,
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
                val drainResult = drainActions(credential.token, fence, generation, reason)
                if (drainResult != null) return drainResult
                if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged
                try {
                    store.clearDiagnostics(fence)
                } catch (error: Exception) {
                    return failure(
                        fence,
                        SyncFailureKind.PROTOCOL,
                        SyncDiagnosticKind.PROTOCOL,
                        "DIAGNOSTIC_CLEAR_FAILED",
                        error.message ?: "Unable to clear completed-sync diagnostics",
                    )
                }
                return SyncRunResult.Success(pages, appliedChanges)
            }
            cursor = requireNotNull(page.nextCursor)
        }
    }

    @Suppress("TooGenericExceptionCaught", "ReturnCount")
    private suspend fun drainActions(
        token: String,
        fence: SyncSessionFence,
        generation: Long,
        reason: SyncReason,
    ): SyncRunResult? {
        val client = actionClient ?: return null
        val actions = actionStore ?: return null
        actions.recoverStaleClaims(Instant.now().minus(STALE_CLAIM_MINUTES, ChronoUnit.MINUTES).toString())
        while (true) {
            if (!sessionManager.isCurrent(generation)) return SyncRunResult.SessionChanged
            val attemptId = UUID.randomUUID().toString()
            val claimed = actions.claim(attemptId, Instant.now().toString(), MAX_ACTIONS_PER_BATCH)
            if (claimed.isEmpty()) return null
            val payloads =
                try {
                    claimed.map { decodePendingActionPayload(it.payloadSchemaVersion, it.payloadJson) }
                } catch (error: Exception) {
                    actions.quarantine(claimed.map(PendingActionEntity::actionId), attemptId)
                    return failure(fence, SyncFailureKind.PROTOCOL, SyncDiagnosticKind.PROTOCOL, "ACTION_PAYLOAD_REJECTED", error.message)
                }
            val response =
                try {
                    client.submit(payloads, token)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: IOException) {
                    actions.release(claimed.map(PendingActionEntity::actionId), attemptId)
                    return transportFailure("ACTION_NETWORK_ERROR", error.message)
                } catch (error: Exception) {
                    actions.quarantine(claimed.map(PendingActionEntity::actionId), attemptId)
                    return failure(fence, SyncFailureKind.PROTOCOL, SyncDiagnosticKind.PROTOCOL, "ACTION_RESPONSE_REJECTED", error.message)
                }
            val ids = response.results.map(::actionResultId)
            if (!SyncActionAcknowledgements.hasExactlyClaimedIds(claimed.map(PendingActionEntity::actionId).toSet(), ids.toSet()) ||
                ids.size != ids.toSet().size
            ) {
                actions.quarantine(claimed.map(PendingActionEntity::actionId), attemptId)
                return failure(
                    fence,
                    SyncFailureKind.PROTOCOL,
                    SyncDiagnosticKind.PROTOCOL,
                    "ACTION_ACK_INVALID",
                    "Action ACK ids do not match claimed batch",
                )
            }
            val actionOutcomes = response.results.map { result -> applyActionResult(result, attemptId, actions) }
            if (actionOutcomes.any { it == ActionResultApply.ClaimLost }) {
                actions.quarantine(claimed.map(PendingActionEntity::actionId), attemptId)
                return failure(
                    fence,
                    SyncFailureKind.PROTOCOL,
                    SyncDiagnosticKind.PROTOCOL,
                    "ACTION_CLAIM_LOST",
                    "A claimed action was no longer owned while applying the server acknowledgement",
                )
            }
            if (actionOutcomes.any { it == ActionResultApply.RequiresFullResync }) {
                actions.resetForFullResync()
                return syncLocked(reason, generation)
            }
        }
    }

    @Suppress("LongMethod", "ReturnCount") // Frozen result union needs an explicit per-variant CAS outcome.
    private suspend fun applyActionResult(
        result: SyncActionResultDto,
        attemptId: String,
        actions: SyncActionStore,
    ): ActionResultApply {
        when (result) {
            is SyncActionResultDto.SyncActionResultDtoOneOfValue -> {
                return if (actions.acknowledge(
                        result.value.actionId.toString(),
                        attemptId,
                        result.value.resource,
                        result.value.serverVersion,
                    )
                ) {
                    ActionResultApply.Applied
                } else {
                    ActionResultApply.ClaimLost
                }
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf1Value -> {
                val value = result.value
                return if (actions.reject(
                        value.actionId.toString(),
                        attemptId,
                        SyncFailureEntity(
                            value.actionId.toString(),
                            value.errCode,
                            value.errMessage,
                            1,
                            io.yggdrasil.labs.mealmate.lite.contract.contractJson.encodeToString(
                                io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
                                    .serializer(),
                                value.authoritative,
                            ),
                            value.serverVersion,
                            false,
                            Instant.now().toString(),
                        ),
                    )
                ) {
                    ActionResultApply.Applied
                } else {
                    ActionResultApply.ClaimLost
                }
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf2Value -> {
                val value = result.value
                return if (actions.reject(
                        value.actionId.toString(),
                        attemptId,
                        SyncFailureEntity(
                            value.actionId.toString(),
                            value.errCode,
                            value.errMessage,
                            null,
                            null,
                            null,
                            true,
                            Instant.now().toString(),
                        ),
                    )
                ) {
                    ActionResultApply.RequiresFullResync
                } else {
                    ActionResultApply.ClaimLost
                }
            }

            is SyncActionResultDto.SyncActionResultDtoOneOf3Value -> {
                when (val original = result.value.original) {
                    is SyncActionResultDtoOneOf3Original.AppliedResultDtoValue -> {
                        return if (actions.acknowledge(
                                result.value.actionId.toString(),
                                attemptId,
                                original.value.resource,
                                original.value.serverVersion,
                            )
                        ) {
                            ActionResultApply.Applied
                        } else {
                            ActionResultApply.ClaimLost
                        }
                    }

                    is SyncActionResultDtoOneOf3Original.RejectedResultDtoValue -> {
                        when (val rejected = original.value) {
                            is io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDto.RejectedResultDtoOneOfValue -> {
                                return if (actions.reject(
                                        result.value.actionId.toString(),
                                        attemptId,
                                        SyncFailureEntity(
                                            result.value.actionId.toString(),
                                            rejected.value.errCode,
                                            rejected.value.errMessage,
                                            1,
                                            io.yggdrasil.labs.mealmate.lite.contract.contractJson.encodeToString(
                                                io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource
                                                    .serializer(),
                                                rejected.value.authoritative,
                                            ),
                                            rejected.value.serverVersion,
                                            false,
                                            Instant.now().toString(),
                                        ),
                                    )
                                ) {
                                    ActionResultApply.Applied
                                } else {
                                    ActionResultApply.ClaimLost
                                }
                            }

                            is io.yggdrasil.labs.mealmate.lite.contract.generated.models.RejectedResultDto.RejectedResultDtoOneOf1Value -> {
                                return if (actions.reject(
                                        result.value.actionId.toString(),
                                        attemptId,
                                        SyncFailureEntity(
                                            result.value.actionId.toString(),
                                            rejected.value.errCode,
                                            rejected.value.errMessage,
                                            null,
                                            null,
                                            null,
                                            true,
                                            Instant.now().toString(),
                                        ),
                                    )
                                ) {
                                    ActionResultApply.RequiresFullResync
                                } else {
                                    ActionResultApply.ClaimLost
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun actionResultId(result: SyncActionResultDto): String =
        when (result) {
            is SyncActionResultDto.SyncActionResultDtoOneOfValue -> result.value.actionId.toString()
            is SyncActionResultDto.SyncActionResultDtoOneOf1Value -> result.value.actionId.toString()
            is SyncActionResultDto.SyncActionResultDtoOneOf2Value -> result.value.actionId.toString()
            is SyncActionResultDto.SyncActionResultDtoOneOf3Value -> result.value.actionId.toString()
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
        const val MAX_ACTIONS_PER_BATCH = 100
        const val STALE_CLAIM_MINUTES = 5L
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

class RetrofitSyncActionClient(
    private val api: MealMateApi,
) : SyncActionClient {
    override suspend fun submit(
        actions: List<SyncActionDto>,
        token: String,
    ): SyncActionsResponse {
        val response = api.syncActions(SyncActionsRequest(actions), authorization = "Bearer $token")
        if (!response.isSuccessful) throw ApiCallException(response.code(), message = "MealMate action sync failed: ${response.code()}")
        return requireNotNull(response.body()) { "MealMate action sync returned an empty body" }
    }
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

    override suspend fun clearDiagnostics(sessionFence: SyncSessionFence) {
        database.withTransaction {
            val session = database.contractCacheDao().getClientSession()
            require(
                session?.sessionId == sessionFence.sessionId &&
                    session.sessionGeneration == sessionFence.sessionGeneration,
            ) { "Client session changed before clearing sync diagnostics" }
            database.contractCacheDao().clearSyncDiagnostics(sessionFence.sessionId, sessionFence.sessionGeneration)
        }
    }
}

class RoomSyncActionStore(
    private val database: MealMateDatabase,
) : SyncActionStore {
    private val dao get() = database.contractCacheDao()

    override suspend fun recoverStaleClaims(staleBefore: String): Int = dao.recoverStaleClaims(staleBefore)

    override suspend fun claim(
        attemptId: String,
        claimedAt: String,
        limit: Int,
    ): List<PendingActionEntity> = dao.claimPendingActions(attemptId, claimedAt, limit)

    override suspend fun acknowledge(
        actionId: String,
        attemptId: String,
        resource: AppliedResultDtoResource?,
        serverVersion: String?,
    ): Boolean =
        database.withTransaction {
            if (!dao.acknowledgeAction(actionId, attemptId)) {
                false
            } else {
                if (resource != null && serverVersion != null) applyAuthoritative(resource, serverVersion)
                true
            }
        }

    override suspend fun reject(
        actionId: String,
        attemptId: String,
        failure: SyncFailureEntity,
    ): Boolean = dao.rejectAction(actionId, attemptId, failure)

    override suspend fun release(
        actionIds: List<String>,
        attemptId: String,
    ) = dao.releaseAttempt(actionIds, attemptId)

    override suspend fun quarantine(
        actionIds: List<String>,
        attemptId: String,
    ) = dao.quarantineAttempt(actionIds, attemptId)

    override suspend fun resetForFullResync() = dao.resetForFullResync()

    private suspend fun applyAuthoritative(
        resource: AppliedResultDtoResource,
        serverVersion: String,
    ) {
        when (resource) {
            is AppliedResultDtoResource.RecipeViewValue -> {
                val recipe = resource.value
                dao.upsertRecipe(
                    io.yggdrasil.labs.mealmate.lite.data.local.mapper.RecipeRoomMapper
                        .toEntity(recipe),
                )
                dao.upsertReplicaVersion(
                    io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity(
                        "recipe",
                        recipe.id.toString(),
                        serverVersion,
                    ),
                )
            }

            is AppliedResultDtoResource.RecipeTombstoneValue -> {
                val tombstone = resource.value
                val time = tombstone.deletedAt.toInstant().toString()
                dao.upsertRecipe(
                    io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity(
                        tombstone.id.toString(),
                        "",
                        "[]",
                        "[]",
                        "[]",
                        serverVersion,
                        time,
                        time,
                        null,
                        null,
                        time,
                    ),
                )
                dao.upsertReplicaVersion(
                    io.yggdrasil.labs.mealmate.lite.data.local.entity.ReplicaVersionEntity(
                        "recipe",
                        tombstone.id.toString(),
                        serverVersion,
                    ),
                )
            }
        }
    }
}

object StateMutationMutex {
    internal val instance = Mutex()
}
