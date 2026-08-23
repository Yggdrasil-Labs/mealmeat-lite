package io.yggdrasil.labs.mealmate.lite.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RegisterRequest
import io.yggdrasil.labs.mealmate.lite.data.auth.AuthRepository
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionPhase
import io.yggdrasil.labs.mealmate.lite.data.models.ModelSelectionRepository
import io.yggdrasil.labs.mealmate.lite.data.models.ModelSelectionResult
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

enum class JoinMode {
    Bootstrap,
    Recovery,
}

sealed interface AuthUiState {
    data object Checking : AuthUiState

    data class Join(
        val mode: JoinMode,
        val errorMessage: String? = null,
    ) : AuthUiState

    data class Provisioning(
        val familyCode: String? = null,
        val errorMessage: String? = null,
    ) : AuthUiState

    data class AwaitingFamilyCode(
        val familyCode: String,
    ) : AuthUiState

    data object Authenticated : AuthUiState
}

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager,
    private val modelSelectionRepository: ModelSelectionRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow<AuthUiState>(AuthUiState.Checking)
    val state: StateFlow<AuthUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            sessionManager.state.collectLatest { session ->
                if (session.phase == SessionPhase.Unauthenticated && mutableState.value is AuthUiState.Authenticated) {
                    mutableState.value = AuthUiState.Join(JoinMode.Recovery)
                }
            }
        }
        viewModelScope.launch {
            authRepository.restore()
            val session = sessionManager.state.value
            if (session.phase == SessionPhase.Unauthenticated || session.generation == null) {
                mutableState.value = AuthUiState.Join(JoinMode.Bootstrap)
            } else {
                resume(session.generation)
            }
        }
    }

    @Suppress("TooGenericExceptionCaught")
    fun bootstrap(
        bootstrapSecret: String,
        deviceName: String,
    ) {
        viewModelScope.launch {
            mutableState.value = AuthUiState.Provisioning()
            try {
                val provisioned =
                    authRepository.bootstrap(
                        BootstrapRequest(bootstrapSecret = bootstrapSecret, deviceName = deviceName),
                    )
                finishProvisioning(provisioned.generation, provisioned.familyCode)
            } catch (error: ApiCallException) {
                mutableState.value = joinError(JoinMode.Bootstrap, error)
            } catch (error: Exception) {
                mutableState.value = joinError(JoinMode.Bootstrap, error)
            }
        }
    }

    @Suppress("TooGenericExceptionCaught")
    fun register(
        familyCode: String,
        deviceName: String,
    ) {
        viewModelScope.launch {
            mutableState.value = AuthUiState.Provisioning()
            try {
                val provisioned =
                    authRepository.register(
                        RegisterRequest(familyCode = familyCode, deviceName = deviceName),
                    )
                finishProvisioning(provisioned.generation, familyCode = null)
            } catch (error: ApiCallException) {
                mutableState.value = joinError(JoinMode.Recovery, error)
            } catch (error: Exception) {
                mutableState.value = joinError(JoinMode.Recovery, error)
            }
        }
    }

    fun confirmFamilyCode() {
        if (mutableState.value !is AuthUiState.AwaitingFamilyCode) return
        val generation = sessionManager.state.value.generation ?: return
        viewModelScope.launch {
            if (sessionManager.activate(generation, sessionManager.state.value.selectedModelId ?: return@launch)) {
                mutableState.value = AuthUiState.Authenticated
            } else {
                mutableState.value = AuthUiState.Join(JoinMode.Recovery, "会话已过期，请重新加入")
            }
        }
    }

    fun retryProvisioning() {
        val generation = sessionManager.state.value.generation ?: return
        viewModelScope.launch { resume(generation) }
    }

    private suspend fun resume(generation: Long) {
        mutableState.value = AuthUiState.Provisioning()
        finishProvisioning(generation, familyCode = null)
    }

    private suspend fun finishProvisioning(
        generation: Long,
        familyCode: String?,
    ) {
        when (val result = modelSelectionRepository.loadDefault(generation)) {
            is ModelSelectionResult.Selected -> {
                if (familyCode != null) {
                    mutableState.value = AuthUiState.AwaitingFamilyCode(familyCode)
                } else if (sessionManager.activate(generation, result.modelId)) {
                    mutableState.value = AuthUiState.Authenticated
                } else {
                    mutableState.value = AuthUiState.Join(JoinMode.Recovery, "会话已过期，请重新加入")
                }
            }

            ModelSelectionResult.InvalidCatalog -> {
                mutableState.value = AuthUiState.Provisioning(familyCode, "服务端没有唯一的默认模型")
            }

            ModelSelectionResult.SessionChanged -> {
                mutableState.value = AuthUiState.Join(JoinMode.Recovery, "会话已过期，请重新加入")
            }

            is ModelSelectionResult.Failed -> {
                mutableState.value =
                    if (result.cause is ApiCallException && result.cause.statusCode == UNAUTHORIZED_STATUS) {
                        AuthUiState.Join(JoinMode.Recovery, "会话已过期，请重新加入")
                    } else {
                        AuthUiState.Provisioning(familyCode, errorMessage(result.cause))
                    }
            }
        }
    }

    private fun joinError(
        mode: JoinMode,
        error: Throwable,
    ): AuthUiState.Join =
        if (error is ApiCallException && error.errorCode == "ALREADY_INITIALIZED") {
            AuthUiState.Join(JoinMode.Recovery, "家庭已初始化，请使用家庭码加入")
        } else {
            AuthUiState.Join(mode, errorMessage(error))
        }

    private fun errorMessage(error: Throwable): String =
        when (error) {
            is ApiCallException -> error.message ?: "请求失败"
            else -> error.message ?: "网络请求失败，请稍后重试"
        }

    private companion object {
        const val UNAUTHORIZED_STATUS = 401
    }
}
