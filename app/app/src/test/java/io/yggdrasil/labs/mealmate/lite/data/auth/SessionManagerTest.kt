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
            val manager = SessionManager(FakeDeviceCredentialStore(credential))

            manager.restore()

            assertEquals(SessionPhase.Provisioning, manager.state.value.phase)
            assertEquals(7, manager.state.value.generation)
            assertEquals(credential, manager.currentCredential(7))
        }
}

private class FakeDeviceCredentialStore(
    initial: DeviceCredential? = null,
) : DeviceCredentialStore {
    var saved: DeviceCredential? = initial

    override suspend fun read(): DeviceCredential? = saved

    override suspend fun save(credential: DeviceCredential) {
        saved = credential
    }

    override suspend fun clear() {
        saved = null
    }
}
