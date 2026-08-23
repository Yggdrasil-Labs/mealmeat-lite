package io.yggdrasil.labs.mealmate.lite.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceView
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.settings.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SettingsUiState(
    val devices: List<DeviceView> = emptyList(),
    val rotatedFamilyCode: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class SettingsViewModel(
    private val repository: SettingsRepository,
    private val sessionManager: SessionManager,
) : ViewModel() {
    private val mutableState = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = mutableState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        runWithLoading {
            val generation = sessionManager.state.value.generation ?: return@runWithLoading
            mutableState.value = mutableState.value.copy(devices = repository.listDevices(generation).items)
        }
    }

    fun rotateFamilyCode() {
        runWithLoading {
            val generation = sessionManager.state.value.generation ?: return@runWithLoading
            val familyCode = repository.rotateFamilyCode(generation)
            mutableState.value = mutableState.value.copy(rotatedFamilyCode = familyCode)
        }
    }

    fun dismissRotatedFamilyCode() {
        mutableState.value = mutableState.value.copy(rotatedFamilyCode = null)
    }

    fun revokeDevice(deviceId: String) {
        runWithLoading {
            val generation = sessionManager.state.value.generation ?: return@runWithLoading
            repository.revokeDevice(generation, deviceId)
            mutableState.value = mutableState.value.copy(devices = repository.listDevices(generation).items)
        }
    }

    fun logout() {
        runWithLoading {
            val generation = sessionManager.state.value.generation ?: return@runWithLoading
            repository.logout(generation)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private fun runWithLoading(block: suspend () -> Unit) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(isLoading = true, errorMessage = null)
            try {
                block()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                mutableState.value = mutableState.value.copy(errorMessage = error.message ?: "操作失败")
            } finally {
                mutableState.value = mutableState.value.copy(isLoading = false)
            }
        }
    }
}
