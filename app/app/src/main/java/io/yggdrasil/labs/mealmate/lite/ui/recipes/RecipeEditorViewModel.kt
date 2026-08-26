@file:Suppress("MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.data.recipes.LocalMutationResult
import io.yggdrasil.labs.mealmate.lite.data.recipes.OfflineRecipeRepository
import io.yggdrasil.labs.mealmate.lite.data.recipes.RecipePatchCommand
import io.yggdrasil.labs.mealmate.lite.data.sync.MealMateSyncWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RecipeEditorUiState(
    val recipeId: String = "",
    val name: String = "",
    val tags: String = "",
    val lastActionId: String? = null,
    val message: String? = null,
)

class RecipeEditorViewModel(
    private val repository: OfflineRecipeRepository,
    private val syncNow: () -> Unit,
) : ViewModel() {
    private val mutableState = MutableStateFlow(RecipeEditorUiState())
    val state: StateFlow<RecipeEditorUiState> = mutableState.asStateFlow()

    fun updateRecipeId(value: String) {
        mutableState.value = mutableState.value.copy(recipeId = value)
    }

    fun updateName(value: String) {
        mutableState.value = mutableState.value.copy(name = value)
    }

    fun updateTags(value: String) {
        mutableState.value = mutableState.value.copy(tags = value)
    }

    fun submitPatch() {
        val state = mutableState.value
        patch(
            state.recipeId,
            state.name.ifBlank { null },
            state.tags
                .takeIf { it.isNotBlank() }
                ?.split(',')
                ?.map(String::trim),
        )
    }

    fun submitDelete() {
        delete(mutableState.value.recipeId)
    }

    fun replaceFailed(failedActionId: String) {
        val state = mutableState.value
        viewModelScope.launch {
            val result =
                runCatching {
                    repository.replaceFailed(
                        failedActionId,
                        state.recipeId,
                        RecipePatchCommand(
                            state.name.ifBlank { null },
                            state.tags
                                .takeIf { it.isNotBlank() }
                                ?.split(',')
                                ?.map(String::trim),
                        ),
                    )
                }.getOrElse { error ->
                    mutableState.value = RecipeEditorUiState(message = error.message ?: "菜品编辑无效")
                    return@launch
                }
            publish(result)
        }
    }

    fun patch(
        recipeId: String,
        name: String?,
        tags: List<String>?,
    ) {
        viewModelScope.launch {
            val result =
                runCatching { repository.patch(recipeId, RecipePatchCommand(name, tags)) }.getOrElse { error ->
                    mutableState.value = RecipeEditorUiState(message = error.message ?: "菜品编辑无效")
                    return@launch
                }
            publish(result)
        }
    }

    fun delete(recipeId: String) {
        viewModelScope.launch { publish(repository.delete(recipeId)) }
    }

    private fun publish(result: LocalMutationResult) {
        if (result is LocalMutationResult.Applied) {
            mutableState.value = mutableState.value.copy(lastActionId = result.actionId, message = null)
            syncNow()
        } else {
            mutableState.value = mutableState.value.copy(message = "菜品不再可编辑")
        }
    }
}
