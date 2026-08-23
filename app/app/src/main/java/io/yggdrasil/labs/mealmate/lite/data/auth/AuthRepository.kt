package io.yggdrasil.labs.mealmate.lite.data.auth

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RegisterRequest
import io.yggdrasil.labs.mealmate.lite.data.remote.MealMateApi
import io.yggdrasil.labs.mealmate.lite.data.remote.requireSuccessData

data class ProvisionedSession(
    val generation: Long,
    val familyCode: String?,
)

class AuthRepository(
    private val api: MealMateApi,
    private val sessionManager: SessionManager,
) {
    suspend fun restore() {
        sessionManager.restore()
    }

    suspend fun bootstrap(request: BootstrapRequest): ProvisionedSession {
        val response = api.bootstrap(request).requireSuccessData()
        return ProvisionedSession(
            generation = sessionManager.startProvisioning(response.deviceId.toString(), response.deviceToken),
            familyCode = response.familyCode,
        )
    }

    suspend fun register(request: RegisterRequest): ProvisionedSession {
        val response = api.register(request).requireSuccessData()
        return ProvisionedSession(
            generation = sessionManager.startProvisioning(response.deviceId.toString(), response.deviceToken),
            familyCode = null,
        )
    }
}
