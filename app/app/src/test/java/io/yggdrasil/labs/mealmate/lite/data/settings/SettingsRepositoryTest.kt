package io.yggdrasil.labs.mealmate.lite.data.settings

import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.remote.createMealMateApi
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class SettingsRepositoryTest {
    private lateinit var server: MockWebServer

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `logout retains credential on server failure and clears it after success`() =
        runBlocking {
            server.enqueue(MockResponse().setResponseCode(500))
            server.enqueue(MockResponse().setBody("""{"success":true,"data":{"revoked":true}}"""))
            val store = FakeCredentialStore()
            val manager = SessionManager(store)
            val generation = manager.startProvisioning("11111111-1111-4111-8111-111111111111", "token")
            val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)
            val repository = SettingsRepository(api, manager)

            var failure: Throwable? = null
            try {
                repository.logout(generation)
            } catch (error: Throwable) {
                failure = error
            }
            check(failure != null)
            assertEquals(SessionPhase.Provisioning, manager.state.value.phase)
            repository.logout(generation)
            assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
            assertEquals(null, store.saved)
        }

    @Test
    fun `current device cannot be revoked locally`() =
        runBlocking {
            val manager = SessionManager(FakeCredentialStore())
            val generation = manager.startProvisioning("11111111-1111-4111-8111-111111111111", "token")
            val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)
            val repository = SettingsRepository(api, manager)

            var failure: Throwable? = null
            try {
                repository.revokeDevice(generation, "11111111-1111-4111-8111-111111111111")
            } catch (error: Throwable) {
                failure = error
            }
            assertEquals(CurrentDeviceRevocationException::class, failure!!::class)
            assertEquals(0, server.requestCount)
        }
}

private class FakeCredentialStore : DeviceCredentialStore {
    var saved: DeviceCredential? = null

    override suspend fun read(): DeviceCredential? = saved

    override suspend fun save(credential: DeviceCredential) {
        saved = credential
    }

    override suspend fun clear() {
        saved = null
    }
}
