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
    Provisioning,
    Active,
}

data class SessionState(
    val phase: SessionPhase,
    val generation: Long? = null,
    val selectedModelId: String? = null,
)

class SessionManager(
    private val credentialStore: DeviceCredentialStore,
    private val sessionIdSource: () -> String = { UUID.randomUUID().toString() },
    private val generationSource: () -> Long = defaultGenerationSource(),
) {
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(SessionState(SessionPhase.Unauthenticated))

    @Volatile
    private var credential: DeviceCredential? = null

    val state: StateFlow<SessionState> = mutableState.asStateFlow()

    suspend fun restore() {
        mutex.withLock {
            credential = credentialStore.read()
            mutableState.value =
                credential?.let {
                    SessionState(
                        phase = SessionPhase.Provisioning,
                        generation = it.sessionGeneration,
                    )
                } ?: SessionState(SessionPhase.Unauthenticated)
        }
    }

    suspend fun startProvisioning(
        deviceId: String,
        token: String,
    ): Long =
        mutex.withLock {
            val generation = nextGeneration(credential?.sessionGeneration)
            val next =
                DeviceCredential(
                    deviceId = deviceId,
                    token = token,
                    sessionId = sessionIdSource(),
                    sessionGeneration = generation,
                )
            credentialStore.save(next)
            credential = next
            mutableState.value = SessionState(SessionPhase.Provisioning, generation)
            generation
        }

    suspend fun activate(
        generation: Long,
        selectedModelId: String,
    ): Boolean =
        mutex.withLock {
            if (credential?.sessionGeneration != generation) return@withLock false
            mutableState.value = SessionState(SessionPhase.Active, generation, selectedModelId)
            true
        }

    suspend fun selectModel(
        generation: Long,
        selectedModelId: String,
    ): Boolean =
        mutex.withLock {
            if (credential?.sessionGeneration != generation) return@withLock false
            mutableState.value = SessionState(SessionPhase.Provisioning, generation, selectedModelId)
            true
        }

    suspend fun invalidate(generation: Long) {
        mutex.withLock {
            if (credential?.sessionGeneration != generation) return@withLock
            credentialStore.clear()
            credential = null
            mutableState.value = SessionState(SessionPhase.Unauthenticated)
        }
    }

    suspend fun currentCredential(generation: Long): DeviceCredential? =
        mutex.withLock {
            credential?.takeIf { it.sessionGeneration == generation }
        }

    suspend fun isCurrent(generation: Long): Boolean =
        mutex.withLock {
            credential?.sessionGeneration == generation
        }

    fun tokenSnapshot(): String? = credential?.token

    fun deviceIdSnapshot(): String? = credential?.deviceId

    private fun nextGeneration(previous: Long?): Long {
        val generated = generationSource()
        return if (previous == null || generated > previous) generated else previous + 1
    }
}

private fun defaultGenerationSource(): () -> Long {
    val counter = AtomicLong(System.currentTimeMillis())
    return counter::incrementAndGet
}
