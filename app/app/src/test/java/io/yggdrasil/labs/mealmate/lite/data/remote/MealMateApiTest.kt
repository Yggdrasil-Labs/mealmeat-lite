package io.yggdrasil.labs.mealmate.lite.data.remote

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapResponse
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.util.UUID

class MealMateApiTest {
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
    fun `model catalog stays unwrapped and auth calls carry the current token`() =
        runBlocking {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"items":[{"id":"model-a","displayName":"Model A","isDefault":true}]}"""),
            )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(
                        """{"success":true,"data":{"deviceId":"11111111-1111-4111-8111-111111111111","deviceToken":"token","familyCode":"ABCD-EFGH"}}""",
                    ),
            )
            val api = createMealMateApi(server.url("/").toString()) { "token-a" }

            assertEquals(
                "model-a",
                api
                    .listModels()
                    .body()
                    ?.items
                    ?.single()
                    ?.id,
            )
            val modelRequest = server.takeRequest()
            assertEquals("Bearer token-a", modelRequest.getHeader("Authorization"))

            val response =
                api.bootstrap(
                    io.yggdrasil.labs.mealmate.lite.contract.generated.models
                        .BootstrapRequest("secret", "Pixel"),
                )
            assertEquals(UUID.fromString("11111111-1111-4111-8111-111111111111"), response.body()?.data?.deviceId)
            assertEquals("Bearer token-a", server.takeRequest().getHeader("Authorization"))
        }
}
