package io.yggdrasil.labs.mealmate.lite.data.auth

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class SessionManagerTest {
    @Test
    fun `stale generation cannot activate or invalidate a newer session`() =
        runBlocking {
            val store = FakeDeviceCredentialStore()
            val manager = SessionManager(store)

            val first = manager.startProvisioning(deviceId = "device-a", token = "token-a")
            val second = manager.startProvisioning(deviceId = "device-b", token = "token-b")

            assertEquals(SessionPhase.Provisioning, manager.state.value.phase)
            assertEquals(second, manager.state.value.generation)
            assertEquals(false, manager.activate(first, "model-a"))
            manager.invalidate(first)
            assertEquals("token-b", manager.currentCredential(second)?.token)

            assertEquals(true, manager.activate(second, "model-b"))
            assertEquals(SessionPhase.Active, manager.state.value.phase)
            assertEquals("model-b", manager.state.value.selectedModelId)

            manager.invalidate(second)
            assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
            assertNull(store.saved)
        }

    @Test
    fun `restore exposes an encrypted credential as provisioning until activation completes`() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "device-a",
                    token = "token-a",
                    sessionId = "session-a",
                    sessionGeneration = 7,
                )
            val manager =
                SessionManager(
                    FakeDeviceCredentialStore(credential),
                    FakeSessionLocalStore(LocalSession("session-a", 7, SessionPhase.Provisioning)),
                )

            manager.restore()

            assertEquals(SessionPhase.Provisioning, manager.state.value.phase)
            assertEquals(7, manager.state.value.generation)
            assertEquals(credential, manager.currentCredential(7))
        }

    @Test
    fun `restore rejects an active credential without a matching Room session`() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "device-a",
                    token = "token-a",
                    sessionId = "session-a",
                    sessionGeneration = 7,
                )
            val credentialStore = FakeDeviceCredentialStore(credential)
            val localStore = FakeSessionLocalStore(LocalSession("other-session", 6, SessionPhase.Active, "model-a"))

            val manager = SessionManager(credentialStore, localStore)
            manager.restore()

            assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
            assertNull(credentialStore.saved)
            assertNull(localStore.read())
        }

    @Test
    fun `restore accepts only a matching persisted active session`() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "device-a",
                    token = "token-a",
                    sessionId = "session-a",
                    sessionGeneration = 7,
                )
            val localStore =
                FakeSessionLocalStore(
                    LocalSession("session-a", 7, SessionPhase.Active, selectedModelId = "model-a"),
                )

            val manager = SessionManager(FakeDeviceCredentialStore(credential), localStore)
            manager.restore()

            assertEquals(SessionPhase.Active, manager.state.value.phase)
            assertEquals("model-a", manager.state.value.selectedModelId)
        }

    @Test
    fun `restore finishes an interrupted invalidation instead of resurrecting its credential`() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "device-a",
                    token = "token-a",
                    sessionId = "session-a",
                    sessionGeneration = 7,
                )
            val credentialStore = FakeDeviceCredentialStore(credential)
            val localStore = FakeSessionLocalStore(LocalSession("session-a", 7, SessionPhase.Switching))

            val manager = SessionManager(credentialStore, localStore)
            manager.restore()

            assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
            assertNull(credentialStore.saved)
            assertNull(localStore.read())
        }

    @Test
    fun `restore clears a switching credential even before Room was replaced`() =
        runBlocking {
            val credential =
                DeviceCredential(
                    deviceId = "device-a",
                    token = "token-a",
                    sessionId = "session-new",
                    sessionGeneration = 8,
                    state = CredentialState.SWITCHING,
                )
            val credentialStore = FakeDeviceCredentialStore(credential)
            val localStore =
                FakeSessionLocalStore(
                    LocalSession("session-old", 7, SessionPhase.Active, selectedModelId = "model-a"),
                )

            val manager = SessionManager(credentialStore, localStore)
            manager.restore()

            assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
            assertNull(credentialStore.saved)
            assertNull(localStore.read())
            assertNull(manager.tokenSnapshot())
        }

    @Test
    fun `failed switching write immediately fences the in-memory credential`() =
        runBlocking {
            val credentialStore = FakeDeviceCredentialStore()
            val manager = SessionManager(credentialStore)
            val generation = manager.startProvisioning("device-a", "token-a")
            credentialStore.failSaves = true

            val failure = runCatching { manager.invalidate(generation) }.exceptionOrNull()

            assertEquals("credential write failed", failure?.message)
            assertNull(manager.currentCredential(generation))
            assertEquals(false, manager.isCurrent(generation))
            assertNull(manager.tokenSnapshot())
            assertNull(manager.deviceIdSnapshot())
        }
}

private class FakeDeviceCredentialStore(
    initial: DeviceCredential? = null,
) : DeviceCredentialStore {
    var saved: DeviceCredential? = initial
    var failSaves: Boolean = false

    override suspend fun read(): DeviceCredential? = saved

    override suspend fun save(credential: DeviceCredential) {
        check(!failSaves) { "credential write failed" }
        saved = credential
    }

    override suspend fun clear() {
        saved = null
    }
}

private class FakeSessionLocalStore(
    private var session: LocalSession? = null,
) : SessionLocalStore {
    override suspend fun read(): LocalSession? = session

    override suspend fun replaceWithProvisioning(credential: DeviceCredential) {
        session = LocalSession(credential.sessionId, credential.sessionGeneration, SessionPhase.Provisioning)
    }

    override suspend fun selectModel(
        credential: DeviceCredential,
        selectedModelId: String,
    ): Boolean {
        val current = session ?: return false
        session = current.copy(selectedModelId = selectedModelId)
        return true
    }

    override suspend fun promote(credential: DeviceCredential): Boolean {
        val current = session ?: return false
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
