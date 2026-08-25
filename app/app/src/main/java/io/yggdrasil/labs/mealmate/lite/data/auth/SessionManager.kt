package io.yggdrasil.labs.mealmate.lite.data.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

enum class SessionPhase {
    Unauthenticated,
    Switching,
    Provisioning,
    Active,
}

data class SessionState(
    val phase: SessionPhase,
    val generation: Long? = null,
    val selectedModelId: String? = null,
)

data class LocalSession(
    val sessionId: String,
    val generation: Long,
    val phase: SessionPhase,
    val selectedModelId: String? = null,
)

interface SessionLocalStore {
    suspend fun read(): LocalSession?

    suspend fun replaceWithProvisioning(credential: DeviceCredential)

    suspend fun selectModel(
        credential: DeviceCredential,
        selectedModelId: String,
    ): Boolean

    suspend fun promote(credential: DeviceCredential): Boolean

    suspend fun markSwitching(credential: DeviceCredential)

    suspend fun clear()
}

private class InMemorySessionLocalStore : SessionLocalStore {
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
        if (!current.matches(credential) || current.phase != SessionPhase.Provisioning) return false
        session = current.copy(selectedModelId = selectedModelId)
        return true
    }

    override suspend fun promote(credential: DeviceCredential): Boolean {
        val current = session ?: return false
        if (!current.matches(credential) || current.selectedModelId.isNullOrBlank()) return false
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

@Suppress("TooManyFunctions") // This is the serialized lifecycle boundary for every session transition.
class SessionManager(
    private val credentialStore: DeviceCredentialStore,
    private val sessionStore: SessionLocalStore = InMemorySessionLocalStore(),
    private val sessionIdSource: () -> String = { UUID.randomUUID().toString() },
    private val generationSource: () -> Long = defaultGenerationSource(),
) {
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(SessionState(SessionPhase.Unauthenticated))

    @Volatile
    private var credential: DeviceCredential? = null

    @Volatile
    private var credentialUsable: Boolean = false

    val state: StateFlow<SessionState> = mutableState.asStateFlow()

    suspend fun restore() {
        mutex.withLock {
            val restoredCredential = credentialStore.read()
            if (restoredCredential == null) {
                credential = null
                credentialUsable = false
                sessionStore.clear()
                mutableState.value = SessionState(SessionPhase.Unauthenticated)
                return@withLock
            }

            if (restoredCredential.state == CredentialState.SWITCHING) {
                credentialStore.clear()
                sessionStore.clear()
                credential = null
                credentialUsable = false
                mutableState.value = SessionState(SessionPhase.Unauthenticated)
                return@withLock
            }

            var local = sessionStore.read()
            if (local?.matches(restoredCredential) == true && local.phase == SessionPhase.Switching) {
                credentialStore.clear()
                sessionStore.clear()
                credential = null
                credentialUsable = false
                mutableState.value = SessionState(SessionPhase.Unauthenticated)
                return@withLock
            }
            if (!local.matches(restoredCredential) || local?.phase == SessionPhase.Unauthenticated) {
                credentialStore.clear()
                sessionStore.clear()
                credential = null
                credentialUsable = false
                mutableState.value = SessionState(SessionPhase.Unauthenticated)
                return@withLock
            }
            if (local?.phase == SessionPhase.Active && local.selectedModelId.isNullOrBlank()) {
                sessionStore.replaceWithProvisioning(restoredCredential)
                local = sessionStore.read()
            }

            credential = restoredCredential
            credentialUsable = true
            mutableState.value =
                SessionState(
                    phase = requireNotNull(local).phase,
                    generation = restoredCredential.sessionGeneration,
                    selectedModelId = local.selectedModelId,
                )
        }
    }

    suspend fun startProvisioning(
        deviceId: String,
        token: String,
    ): Long =
        mutex.withLock {
            val generation = nextGeneration(credential?.sessionGeneration)
            val switching =
                DeviceCredential(
                    deviceId = deviceId,
                    token = token,
                    sessionId = sessionIdSource(),
                    sessionGeneration = generation,
                    state = CredentialState.SWITCHING,
                )
            credentialUsable = false
            credentialStore.save(switching)
            credential = null
            mutableState.value = SessionState(SessionPhase.Switching, generation)
            sessionStore.replaceWithProvisioning(switching)
            val next = switching.copy(state = CredentialState.ACTIVE)
            credentialStore.save(next)
            credential = next
            credentialUsable = true
            mutableState.value = SessionState(SessionPhase.Provisioning, generation)
            generation
        }

    suspend fun activate(
        generation: Long,
        selectedModelId: String,
    ): Boolean =
        mutex.withLock {
            val current = usableCredential(generation) ?: return@withLock false
            val local = sessionStore.read()
            if (local?.selectedModelId != selectedModelId && !sessionStore.selectModel(current, selectedModelId)) {
                return@withLock false
            }
            if (!sessionStore.promote(current)) return@withLock false
            mutableState.value = SessionState(SessionPhase.Active, generation, selectedModelId)
            true
        }

    suspend fun selectModel(
        generation: Long,
        selectedModelId: String,
    ): Boolean =
        mutex.withLock {
            val current = usableCredential(generation) ?: return@withLock false
            if (!sessionStore.selectModel(current, selectedModelId)) return@withLock false
            mutableState.value = SessionState(SessionPhase.Provisioning, generation, selectedModelId)
            true
        }

    suspend fun refreshAfterSync(generation: Long): Boolean =
        mutex.withLock {
            val current = usableCredential(generation) ?: return@withLock false
            val local = sessionStore.read()
            if (!local.matches(current) ||
                local?.phase != SessionPhase.Active ||
                local.selectedModelId.isNullOrBlank()
            ) {
                return@withLock false
            }
            mutableState.value = SessionState(SessionPhase.Active, generation, local.selectedModelId)
            true
        }

    suspend fun invalidate(generation: Long) {
        mutex.withLock {
            val current = credential?.takeIf { it.sessionGeneration == generation } ?: return@withLock
            credentialUsable = false
            credentialStore.save(current.copy(state = CredentialState.SWITCHING))
            credential = null
            mutableState.value = SessionState(SessionPhase.Unauthenticated)
            sessionStore.markSwitching(current)
            credentialStore.clear()
            sessionStore.clear()
        }
    }

    suspend fun currentCredential(generation: Long): DeviceCredential? =
        mutex.withLock {
            usableCredential(generation)
        }

    suspend fun isCurrent(generation: Long): Boolean =
        mutex.withLock {
            usableCredential(generation) != null
        }

    fun tokenSnapshot(): String? =
        credential
            ?.takeIf { credentialUsable && it.state == CredentialState.ACTIVE }
            ?.token

    fun deviceIdSnapshot(): String? =
        credential
            ?.takeIf { credentialUsable && it.state == CredentialState.ACTIVE }
            ?.deviceId

    private fun nextGeneration(previous: Long?): Long {
        val generated = generationSource()
        return if (previous == null || generated > previous) generated else previous + 1
    }

    private fun usableCredential(generation: Long): DeviceCredential? =
        credential?.takeIf {
            credentialUsable &&
                it.state == CredentialState.ACTIVE &&
                it.sessionGeneration == generation
        }
}

private fun LocalSession?.matches(credential: DeviceCredential): Boolean =
    this?.sessionId == credential.sessionId && this.generation == credential.sessionGeneration

private fun defaultGenerationSource(): () -> Long {
    val counter = AtomicLong(System.currentTimeMillis())
    return counter::incrementAndGet
}
