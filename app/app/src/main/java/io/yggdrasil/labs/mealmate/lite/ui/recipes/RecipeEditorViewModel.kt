@file:Suppress("MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.data.local.entity.RecipeEntity
import io.yggdrasil.labs.mealmate.lite.data.recipes.LocalMutationResult
import io.yggdrasil.labs.mealmate.lite.data.recipes.OfflineRecipeRepository
import io.yggdrasil.labs.mealmate.lite.data.recipes.RecipePatchCommand
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString

data class RecipeEditorUiState(
    val recipes: List<RecipeEntity> = emptyList(),
    val recipeId: String = "",
    val name: String = "",
    val tags: String = "",
    val lastActionId: String? = null,
    val message: String? = null,
)

private fun RecipeEntity.tagsAsText(): String =
    runCatching { contractJson.decodeFromString<List<String>>(tagsJson).joinToString(", ") }.getOrDefault("")

class RecipeEditorViewModel(
    private val repository: OfflineRecipeRepository,
    private val syncNow: () -> Unit,
) : ViewModel() {
    private val mutableState = MutableStateFlow(RecipeEditorUiState())
    val state: StateFlow<RecipeEditorUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.observeRecipes().collect { recipes ->
                mutableState.value = mutableState.value.copy(recipes = recipes)
            }
        }
    }

    fun selectRecipe(recipe: RecipeEntity) {
        mutableState.value =
            mutableState.value.copy(
                recipeId = recipe.id,
                name = recipe.name,
                tags = recipe.tagsAsText(),
                message = null,
            )
    }

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
            publish(result, state.recipeId)
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
            publish(result, recipeId)
        }
    }

    fun delete(recipeId: String) {
        viewModelScope.launch { publish(repository.delete(recipeId), recipeId) }
    }

    private fun publish(
        result: LocalMutationResult,
        recipeId: String,
    ) {
        if (result is LocalMutationResult.Applied) {
            val current = mutableState.value
            val effectiveRecipes =
                result.effectiveRecipe?.let { effective ->
                    if (current.recipes.any { recipe -> recipe.id == recipeId }) {
                        current.recipes.map { recipe -> if (recipe.id == recipeId) effective else recipe }
                    } else {
                        current.recipes + effective
                    }
                } ?: current.recipes.filterNot { recipe -> recipe.id == recipeId }
            val selectedRecipeFields =
                result.effectiveRecipe?.takeIf { it.id == current.recipeId }?.let { effective ->
                    current.copy(name = effective.name, tags = effective.tagsAsText())
                } ?: current
            mutableState.value =
                selectedRecipeFields.copy(
                    recipes = effectiveRecipes,
                    lastActionId = result.actionId,
                    message =
                        if (result.effectiveRecipe == null) {
                            "已从本机移除，待联网同步（动作 ${result.actionId}）"
                        } else {
                            "已保存到本机，待联网同步（动作 ${result.actionId}）"
                        },
                )
            syncNow()
        } else {
            mutableState.value = mutableState.value.copy(message = "菜品不再可编辑")
        }
    }
}
