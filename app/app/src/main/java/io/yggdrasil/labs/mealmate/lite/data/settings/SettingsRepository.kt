package io.yggdrasil.labs.mealmate.lite.data.settings

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RevokeDeviceResponse
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import io.yggdrasil.labs.mealmate.lite.data.remote.MealMateApi
import io.yggdrasil.labs.mealmate.lite.data.remote.requireSuccessData

class CurrentDeviceRevocationException : IllegalArgumentException("The current device cannot be revoked")

class SettingsRepository(
    private val api: MealMateApi,
    private val sessionManager: SessionManager,
) {
    suspend fun listDevices(generation: Long): DeviceListResponse {
        val request = suspend { api.listDevices().requireSuccessData() }
        return authenticated(generation, request)
    }

    suspend fun rotateFamilyCode(generation: Long): String =
        authenticated(generation) { api.rotateFamilyCode().requireSuccessData().familyCode }

    suspend fun revokeDevice(
        generation: Long,
        deviceId: String,
    ): RevokeDeviceResponse {
        val currentDeviceId = sessionManager.deviceIdSnapshot()
        if (currentDeviceId == deviceId) throw CurrentDeviceRevocationException()
        return authenticated(generation) { api.revokeDevice(deviceId).requireSuccessData() }
    }

    suspend fun logout(generation: Long) {
        authenticated(generation) {
            api.logout().requireSuccessData()
            sessionManager.invalidate(generation)
        }
    }

    private suspend fun <T> authenticated(
        generation: Long,
        block: suspend () -> T,
    ): T {
        if (!sessionManager.isCurrent(generation)) {
            throw ApiCallException(UNAUTHORIZED_STATUS, message = "Session is no longer current")
        }
        return try {
            block()
        } catch (error: ApiCallException) {
            if (error.statusCode == UNAUTHORIZED_STATUS) sessionManager.invalidate(generation)
            throw error
        }
    }

    private companion object {
        const val UNAUTHORIZED_STATUS = 401
    }
}
