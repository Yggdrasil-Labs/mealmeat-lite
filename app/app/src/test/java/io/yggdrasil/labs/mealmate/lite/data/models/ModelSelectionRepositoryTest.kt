package io.yggdrasil.labs.mealmate.lite.data.models

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ModelListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ModelView
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class ModelSelectionRepositoryTest {
    @Test
    fun `selects the only default model for the current provisioning generation`() =
        runBlocking {
            val manager = SessionManager(FakeCredentialStore())
            val generation = manager.startProvisioning("device", "token")
            val repository =
                ModelSelectionRepository(
                    manager,
                    FakeModelCatalogClient(
                        ModelListResponse(
                            items =
                                listOf(
                                    ModelView("model-a", "Model A", isDefault = true),
                                    ModelView("model-b", "Model B", isDefault = false),
                                ),
                        ),
                    ),
                )

            assertEquals(ModelSelectionResult.Selected("model-a"), repository.loadDefault(generation))
            assertEquals(SessionPhase.Provisioning, manager.state.value.phase)
            assertEquals("model-a", manager.state.value.selectedModelId)
        }

    @Test
    fun `does not guess when the catalog has zero or multiple defaults`() =
        runBlocking {
            val manager = SessionManager(FakeCredentialStore())
            val generation = manager.startProvisioning("device", "token")
            val repository = ModelSelectionRepository(manager, FakeModelCatalogClient(ModelListResponse(emptyList())))

            assertEquals(ModelSelectionResult.InvalidCatalog, repository.loadDefault(generation))
            assertNull(manager.state.value.selectedModelId)
        }

    @Test
    fun `stale response cannot select a model for a newer session`() =
        runBlocking {
            val manager = SessionManager(FakeCredentialStore())
            val first = manager.startProvisioning("device-a", "token-a")
            val client = BlockingModelCatalogClient()
            val repository = ModelSelectionRepository(manager, client)
            val result =
                coroutineScope {
                    val request = async { repository.loadDefault(first) }
                    manager.startProvisioning("device-b", "token-b")
                    client.complete(ModelListResponse(listOf(ModelView("model-a", "Model A", true))))
                    request.await()
                }

            assertEquals(ModelSelectionResult.SessionChanged, result)
            assertNull(manager.state.value.selectedModelId)
        }
}

private class FakeModelCatalogClient(
    private val response: ModelListResponse,
) : ModelCatalogClient {
    override suspend fun listModels(): ModelListResponse = response
}

private class BlockingModelCatalogClient : ModelCatalogClient {
    private val gate = kotlinx.coroutines.CompletableDeferred<ModelListResponse>()

    override suspend fun listModels(): ModelListResponse = gate.await()

    fun complete(response: ModelListResponse) {
        gate.complete(response)
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
