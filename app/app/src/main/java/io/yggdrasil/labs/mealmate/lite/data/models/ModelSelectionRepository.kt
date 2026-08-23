package io.yggdrasil.labs.mealmate.lite.data.models

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ModelListResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException

interface ModelCatalogClient {
    suspend fun listModels(): ModelListResponse
}

sealed interface ModelSelectionResult {
    data class Selected(
        val modelId: String,
    ) : ModelSelectionResult

    data object InvalidCatalog : ModelSelectionResult

    data object SessionChanged : ModelSelectionResult

    data class Failed(
        val cause: Throwable,
    ) : ModelSelectionResult
}

class ModelSelectionRepository(
    private val sessionManager: SessionManager,
    private val client: ModelCatalogClient,
) {
    @Suppress("TooGenericExceptionCaught")
    suspend fun loadDefault(sessionGeneration: Long): ModelSelectionResult =
        try {
            val defaults = client.listModels().items.filter { it.isDefault }
            if (defaults.size != 1) return ModelSelectionResult.InvalidCatalog

            val selected = defaults.single().id
            if (!sessionManager.selectModel(sessionGeneration, selected)) {
                ModelSelectionResult.SessionChanged
            } else {
                ModelSelectionResult.Selected(selected)
            }
        } catch (error: kotlinx.coroutines.CancellationException) {
            throw error
        } catch (error: ApiCallException) {
            if (error.statusCode == UNAUTHORIZED_STATUS) {
                sessionManager.invalidate(sessionGeneration)
            }
            ModelSelectionResult.Failed(error)
        } catch (error: Exception) {
            ModelSelectionResult.Failed(error)
        }

    private companion object {
        const val UNAUTHORIZED_STATUS = 401
    }
}
