package io.yggdrasil.labs.mealmate.lite.data.sync

import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncActionsResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.LocalSession
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionLocalStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.local.SyncApplyResult
import io.yggdrasil.labs.mealmate.lite.data.local.SyncSessionFence
import io.yggdrasil.labs.mealmate.lite.data.local.entity.PendingActionEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncDiagnosticKind
import io.yggdrasil.labs.mealmate.lite.data.local.entity.SyncFailureEntity
import io.yggdrasil.labs.mealmate.lite.data.local.mapper.pendingActionEntityFromPayload
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.decodeFromString
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Test
import java.io.IOException

class InitialSyncCoordinatorTest {
    @Test
    fun `commits every page and activates only with the terminal null cursor page`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.pages += SyncResponse(emptyList(), true, "page-2")
            fixture.client.pages += SyncResponse(emptyList(), false, null)

            val result = fixture.coordinator.sync(SyncReason.InitialProvisioning)

            assertEquals(SyncRunResult.Success(pages = 2, appliedChanges = 0), result)
            assertEquals(listOf(null, "page-2"), fixture.client.requestedCursors)
            assertEquals(listOf(false, true), fixture.store.promotionFlags)
            assertEquals(SessionPhase.Active, fixture.sessionManager.state.value.phase)
        }

    @Test
    fun `failed second page keeps the session provisioning and retry resumes its committed cursor`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.pages += SyncResponse(emptyList(), true, "page-2")
            fixture.client.failureAtRequest = 2
            fixture.client.failure = IOException("offline")

            val failed =
                assertInstanceOf(
                    SyncRunResult.Failed::class.java,
                    fixture.coordinator.sync(SyncReason.InitialProvisioning),
                )
            assertEquals(SyncFailureKind.NETWORK, failed.kind)
            assertEquals(emptyList<String>(), fixture.store.diagnosticCodes)
            assertEquals(SessionPhase.Provisioning, fixture.sessionManager.state.value.phase)
            assertEquals("page-2", fixture.store.cursor)

            fixture.client.failureAtRequest = null
            fixture.client.pages += SyncResponse(emptyList(), false, null)
            assertInstanceOf(SyncRunResult.Success::class.java, fixture.coordinator.sync(SyncReason.InitialProvisioning))
            assertEquals("page-2", fixture.client.requestedCursors.last())
            assertEquals(SessionPhase.Active, fixture.sessionManager.state.value.phase)
        }

    @Test
    fun `decoded response failure is recorded as protocol without applying a page`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.failureAtRequest = 1
            fixture.client.failure = IllegalArgumentException("invalid generated DTO")

            val failed =
                assertInstanceOf(
                    SyncRunResult.Failed::class.java,
                    fixture.coordinator.sync(SyncReason.InitialProvisioning),
                )

            assertEquals(SyncFailureKind.PROTOCOL, failed.kind)
            assertEquals("RESPONSE_REJECTED", failed.errorCode)
            assertEquals(listOf("RESPONSE_REJECTED"), fixture.store.diagnosticCodes)
            assertEquals(null, fixture.store.cursor)
            assertEquals(emptyList<Boolean>(), fixture.store.promotionFlags)
            assertEquals(SessionPhase.Provisioning, fixture.sessionManager.state.value.phase)
        }

    @Test
    fun `invalid cursor http response is recorded as cursor failure`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.failureAtRequest = 1
            fixture.client.failure = ApiCallException(400, "INVALID_CURSOR", "cursor rejected")

            val failed =
                assertInstanceOf(
                    SyncRunResult.Failed::class.java,
                    fixture.coordinator.sync(SyncReason.InitialProvisioning),
                )

            assertEquals(SyncFailureKind.CURSOR, failed.kind)
            assertEquals("INVALID_CURSOR", failed.errorCode)
            assertEquals(listOf("INVALID_CURSOR"), fixture.store.diagnosticCodes)
            assertEquals(null, fixture.store.cursor)
        }

    @Test
    fun `terminal cursor is null so the next run begins a fresh snapshot`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.pages += SyncResponse(emptyList(), false, null)
            assertInstanceOf(SyncRunResult.Success::class.java, fixture.coordinator.sync(SyncReason.InitialProvisioning))

            fixture.client.pages += SyncResponse(emptyList(), false, null)
            assertInstanceOf(SyncRunResult.Success::class.java, fixture.coordinator.sync(SyncReason.AppForeground))

            assertEquals(listOf(null, null), fixture.client.requestedCursors)
        }

    @Test
    fun `a complete successful sync clears stale diagnostics for the active session`() =
        runBlocking {
            val fixture = fixture()
            fixture.store.diagnosticCodes += "CURSOR_CYCLE"
            fixture.client.pages += SyncResponse(emptyList(), false, null)

            assertInstanceOf(SyncRunResult.Success::class.java, fixture.coordinator.sync(SyncReason.InitialProvisioning))

            assertEquals(emptyList<String>(), fixture.store.diagnosticCodes)
        }

    @Test
    fun `rejects cursor cycles without applying the invalid page`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.pages += SyncResponse(emptyList(), true, "same")
            fixture.client.pages += SyncResponse(emptyList(), true, "same")

            val result = fixture.coordinator.sync(SyncReason.InitialProvisioning)

            assertInstanceOf(SyncRunResult.Failed::class.java, result)
            assertEquals(listOf("CURSOR_CYCLE"), fixture.store.diagnosticCodes)
            assertEquals(listOf(false), fixture.store.promotionFlags)
            assertEquals(SessionPhase.Provisioning, fixture.sessionManager.state.value.phase)
        }

    @Test
    fun `a queued call remains bound to the generation captured before the mutex`() =
        runBlocking {
            val fixture = fixture()
            fixture.client.pages += SyncResponse(emptyList(), false, null)
            fixture.client.blockAtRequest = 1

            val running =
                async(start = CoroutineStart.UNDISPATCHED) {
                    fixture.coordinator.sync(SyncReason.InitialProvisioning)
                }
            fixture.client.requestStarted.await()
            val queued =
                async(start = CoroutineStart.UNDISPATCHED) {
                    fixture.coordinator.sync(SyncReason.InitialProvisioning)
                }

            val nextGeneration = fixture.sessionManager.startProvisioning("device-b", "token-b")
            check(fixture.sessionManager.selectModel(nextGeneration, "model-b"))
            fixture.client.releaseRequest.complete(Unit)

            assertEquals(SyncRunResult.SessionChanged, running.await())
            assertEquals(SyncRunResult.SessionChanged, queued.await())
            assertEquals(listOf("token-a"), fixture.client.requestedTokens)
            assertEquals(emptyList<Boolean>(), fixture.store.promotionFlags)
        }

    @Test
    fun `lost action claim rejects the server acknowledgement instead of reporting success`() =
        runBlocking {
            val fixture = actionFixture(acknowledgeResult = false)
            fixture.client.pages += SyncResponse(emptyList(), false, null)

            val result = fixture.coordinator.sync(SyncReason.InitialProvisioning)

            val failed = assertInstanceOf(SyncRunResult.Failed::class.java, result)
            assertEquals(SyncFailureKind.PROTOCOL, failed.kind)
            assertEquals("ACTION_CLAIM_LOST", failed.errorCode)
            assertEquals(listOf("33333333-3333-4333-8333-333333333333"), fixture.actionStore.releasedActionIds)
        }

    private suspend fun fixture(): Fixture {
        val credentialStore = FakeCredentialStore()
        val localStore = FakeSessionLocalStore()
        val manager =
            SessionManager(
                credentialStore = credentialStore,
                sessionStore = localStore,
                sessionIdSource = { "session-a" },
                generationSource = { 7L },
            )
        val generation = manager.startProvisioning("device-a", "token-a")
        check(manager.selectModel(generation, "model-a"))
        val client = FakeSyncPageClient()
        val store = FakeSyncPageStore(localStore, credentialStore)
        return Fixture(manager, client, store, InitialSyncCoordinator(manager, client, store))
    }

    private suspend fun actionFixture(acknowledgeResult: Boolean): ActionFixture {
        val credentialStore = FakeCredentialStore()
        val localStore = FakeSessionLocalStore()
        val manager =
            SessionManager(
                credentialStore = credentialStore,
                sessionStore = localStore,
                sessionIdSource = { "session-a" },
                generationSource = { 7L },
            )
        val generation = manager.startProvisioning("device-a", "token-a")
        check(manager.selectModel(generation, "model-a"))
        val client = FakeSyncPageClient()
        val store = FakeSyncPageStore(localStore, credentialStore)
        val actionStore = FakeSyncActionStore(acknowledgeResult)
        val actionClient = FakeSyncActionClient()
        return ActionFixture(
            client,
            actionStore,
            InitialSyncCoordinator(manager, client, store, actionClient, actionStore),
        )
    }

    private data class Fixture(
        val sessionManager: SessionManager,
        val client: FakeSyncPageClient,
        val store: FakeSyncPageStore,
        val coordinator: InitialSyncCoordinator,
    )

    private data class ActionFixture(
        val client: FakeSyncPageClient,
        val actionStore: FakeSyncActionStore,
        val coordinator: InitialSyncCoordinator,
    )
}

private class FakeSyncActionClient : SyncActionClient {
    override suspend fun submit(
        actions: List<SyncActionDto>,
        token: String,
    ): SyncActionsResponse {
        check(
            actions.single().let { action ->
                when (action) {
                    is SyncActionDto.SyncActionDtoOneOfValue -> action.value.actionId.toString() == "33333333-3333-4333-8333-333333333333"
                    is SyncActionDto.SyncActionDtoOneOf1Value -> false
                }
            },
        )
        return contractJson.decodeFromString(
            """{"results":[{"actionId":"33333333-3333-4333-8333-333333333333","status":"applied","serverVersion":"1","resource":{"id":"11111111-1111-4111-8111-111111111111","name":"权威菜品","tags":[],"ingredients":[],"steps":[],"serverVersion":"1","createdAt":"2026-08-03T00:00:00Z","updatedAt":"2026-08-03T00:00:00Z"}}]}""",
        )
    }
}

private class FakeSyncActionStore(
    private val acknowledgeResult: Boolean,
) : SyncActionStore {
    private val pending =
        pendingActionEntityFromPayload(
            contractJson.decodeFromString(
                """{"actionId":"33333333-3333-4333-8333-333333333333","type":"recipe.patch","createdAt":"2026-08-03T00:00:00Z","payload":{"recipeId":"11111111-1111-4111-8111-111111111111","patch":{"name":"本地菜品"}}}""",
            ),
        )
    var claimed = false
    val releasedActionIds = mutableListOf<String>()

    override suspend fun recoverStaleClaims(staleBefore: String): Int = 0

    override suspend fun claim(
        attemptId: String,
        claimedAt: String,
        limit: Int,
    ): List<PendingActionEntity> =
        if (claimed) {
            emptyList()
        } else {
            claimed = true
            listOf(pending.copy(attemptId = attemptId, claimedAt = claimedAt))
        }

    override suspend fun acknowledge(
        actionId: String,
        attemptId: String,
        resource: io.yggdrasil.labs.mealmate.lite.contract.generated.models.AppliedResultDtoResource?,
        serverVersion: String?,
    ): Boolean = acknowledgeResult

    override suspend fun reject(
        actionId: String,
        attemptId: String,
        failure: SyncFailureEntity,
    ): Boolean = true

    override suspend fun release(
        actionIds: List<String>,
        attemptId: String,
    ) {
        releasedActionIds += actionIds
    }

    override suspend fun resetForFullResync() = Unit
}

private class FakeSyncPageClient : SyncPageClient {
    val pages = ArrayDeque<SyncResponse>()
    val requestedCursors = mutableListOf<String?>()
    val requestedTokens = mutableListOf<String>()
    var failureAtRequest: Int? = null
    var failure: Throwable = IOException("offline")
    var blockAtRequest: Int? = null
    val requestStarted = CompletableDeferred<Unit>()
    val releaseRequest = CompletableDeferred<Unit>()

    override suspend fun fetch(
        cursor: String?,
        token: String,
    ): SyncResponse {
        requestedCursors += cursor
        requestedTokens += token
        if (requestedCursors.size == blockAtRequest) {
            requestStarted.complete(Unit)
            releaseRequest.await()
        }
        if (requestedCursors.size == failureAtRequest) throw failure
        return pages.removeFirst()
    }
}

private class FakeSyncPageStore(
    private val sessionStore: SessionLocalStore,
    private val credentialStore: DeviceCredentialStore,
) : SyncPageStore {
    var cursor: String? = null
    val promotionFlags = mutableListOf<Boolean>()
    val diagnosticCodes = mutableListOf<String>()

    override suspend fun currentCursor(sessionFence: SyncSessionFence): String? = cursor

    override suspend fun apply(
        page: SyncResponse,
        currentCursor: String?,
        sessionFence: SyncSessionFence,
        promoteOnTerminal: Boolean,
    ): SyncApplyResult {
        check(cursor == currentCursor)
        cursor = page.nextCursor
        promotionFlags += promoteOnTerminal
        if (promoteOnTerminal) check(sessionStore.promote(requireNotNull(credentialStore.read())))
        return SyncApplyResult(0, cursor)
    }

    override suspend fun recordDiagnostic(
        sessionFence: SyncSessionFence,
        kind: SyncDiagnosticKind,
        errorCode: String,
        message: String,
    ) {
        diagnosticCodes += errorCode
    }

    override suspend fun clearDiagnostics(sessionFence: SyncSessionFence) {
        diagnosticCodes.clear()
    }
}

private class FakeCredentialStore(
    private var credential: DeviceCredential? = null,
) : DeviceCredentialStore {
    override suspend fun read(): DeviceCredential? = credential

    override suspend fun save(credential: DeviceCredential) {
        this.credential = credential
    }

    override suspend fun clear() {
        credential = null
    }
}

private class FakeSessionLocalStore : SessionLocalStore {
    private var session: LocalSession? = null

    override suspend fun read(): LocalSession? = session

    override suspend fun replaceWithProvisioning(credential: DeviceCredential) {
        session = LocalSession(credential.sessionId, credential.sessionGeneration, SessionPhase.Provisioning)
    }

    override suspend fun selectModel(
        credential: DeviceCredential,
        selectedModelId: String,
    ): Boolean {
        val current = session ?: return false
        if (current.sessionId != credential.sessionId || current.generation != credential.sessionGeneration) return false
        session = current.copy(selectedModelId = selectedModelId)
        return true
    }

    override suspend fun promote(credential: DeviceCredential): Boolean {
        val current = session ?: return false
        if (current.sessionId != credential.sessionId || current.generation != credential.sessionGeneration) return false
        if (current.selectedModelId == null) return false
        session = current.copy(phase = SessionPhase.Active)
        return true
    }

    override suspend fun markSwitching(credential: DeviceCredential) {
        session = LocalSession(credential.sessionId, credential.sessionGeneration, SessionPhase.Switching)
    }

    override suspend fun clear() {
        session = null
    }
}
