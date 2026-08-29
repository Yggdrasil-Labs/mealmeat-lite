package io.yggdrasil.labs.mealmate.lite.data.chat

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ChatRequest
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.remote.createMealMateApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.util.UUID

class SseChatRepositoryTest {
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
    fun `valid terminal trace does not issue a session probe`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                id: 1
                event: start
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444","replayed":false,"resumed":false}

                id: 2
                event: delta
                data: {"text":"hello"}

                id: 3
                event: done
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444"}

                """.trimIndent() + "\n\n",
            ),
        )
        val manager = activeSession()
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)
        val events = SseChatRepository(api, manager).send(request(), manager.state.value.generation!!).toList()

        assertEquals(3, events.count { it is ChatEvent.Frame })
        assertTrue(events.none { it is ChatEvent.TransportClosed })
        assertEquals(1, server.requestCount)
        assertEquals(SessionPhase.Active, manager.state.value.phase)
    }

    @Test
    fun `truncated stream probes once and only unauthorized invalidates`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                id: 1
                event: start
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444","replayed":false,"resumed":false}

                """.trimIndent() + "\n\n",
            ),
        )
        server.enqueue(MockResponse().setResponseCode(401).setBody("{"))
        val manager = activeSession()
        val generation = manager.state.value.generation!!
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)
        val events = SseChatRepository(api, manager).send(request(), generation).toList()

        assertTrue(events.last() is ChatEvent.TransportClosed)
        assertEquals(2, server.requestCount)
        assertEquals(SessionPhase.Unauthenticated, manager.state.value.phase)
    }

    @Test
    fun `network failure probes once without invalidating an active session`() = runBlocking {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        server.enqueue(MockResponse().setBody("{\"success\":true,\"data\":{\"items\":[]}}"))
        val manager = activeSession()
        val generation = manager.state.value.generation!!
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)

        val events = SseChatRepository(api, manager).send(request(), generation).toList()

        assertTrue(events.single() is ChatEvent.TransportClosed)
        assertEquals(2, server.requestCount)
        assertEquals(SessionPhase.Active, manager.state.value.phase)
    }

    @Test
    fun `stream read failure probes once without fabricating unauthorized`() = runBlocking {
        server.enqueue(
            MockResponse()
                .setBody(
                    "id: 1\nevent: start\ndata: " +
                        "{\"chatRequestId\":\"44444444-4444-4444-8444-444444444444\"," +
                        "\"replayed\":false,\"resumed\":false}\n\n",
                ).setSocketPolicy(SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY),
        )
        server.enqueue(MockResponse().setBody("{\"success\":true,\"data\":{\"items\":[]}}"))
        val manager = activeSession()
        val generation = manager.state.value.generation!!
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)

        val events = SseChatRepository(api, manager).send(request(), generation).toList()

        assertEquals(1, events.count { it is ChatEvent.Frame })
        assertTrue(events.last() is ChatEvent.TransportClosed)
        assertEquals(2, server.requestCount)
        assertEquals(SessionPhase.Active, manager.state.value.phase)
    }

    @Test
    fun `error terminal is delivered without a probe`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                id: 1
                event: start
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444","replayed":false,"resumed":false}

                id: 2
                event: error
                data: {"errCode":"PROVIDER_ERROR","errMessage":"provider unavailable",
                data: "retryable":true,"requestId":"request-1"}

                """.trimIndent() + "\n\n",
            ),
        )
        val manager = activeSession()
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)

        val events = SseChatRepository(api, manager).send(request(), manager.state.value.generation!!).toList()

        assertEquals(2, events.count { it is ChatEvent.Frame })
        assertTrue(events.none { it is ChatEvent.TransportClosed })
        assertEquals(1, server.requestCount)
        assertEquals(SessionPhase.Active, manager.state.value.phase)
    }

    @Test
    fun `partial frame after terminal is rejected instead of completing the turn`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                id: 1
                event: start
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444","replayed":false,"resumed":false}

                id: 2
                event: done
                data: {"chatRequestId":"44444444-4444-4444-8444-444444444444"}

                id: 3
                event: delta
                data: {"text":"trailing"
                """.trimIndent(),
            ),
        )
        val manager = activeSession()
        val api = createMealMateApi(server.url("/").toString(), manager::tokenSnapshot)

        val failure =
            runCatching {
                SseChatRepository(api, manager).send(request(), manager.state.value.generation!!).toList()
            }.exceptionOrNull()
        assertTrue(failure is SseProtocolException)
        assertEquals(1, server.requestCount)
        assertEquals(SessionPhase.Active, manager.state.value.phase)
    }

    private fun request() = ChatRequest(UUID.fromString("44444444-4444-4444-8444-444444444444"), "model-a", "hello")

    private fun activeSession(): SessionManager {
        val manager = SessionManager(FakeDeviceCredentialStore())
        runBlocking {
            val generation = manager.startProvisioning("device-a", "token-a")
            check(manager.selectModel(generation, "model-a"))
            check(manager.activate(generation, "model-a"))
        }
        return manager
    }

    private class FakeDeviceCredentialStore : DeviceCredentialStore {
        private var credential: DeviceCredential? = null

        override suspend fun read(): DeviceCredential? = credential

        override suspend fun save(credential: DeviceCredential) {
            this.credential = credential
        }

        override suspend fun clear() {
            credential = null
        }
    }
}
