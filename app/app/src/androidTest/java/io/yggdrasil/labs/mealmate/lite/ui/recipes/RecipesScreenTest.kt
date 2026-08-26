package io.yggdrasil.labs.mealmate.lite.ui.recipes

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import io.yggdrasil.labs.mealmate.lite.data.recipes.LocalMutationResult
import io.yggdrasil.labs.mealmate.lite.data.recipes.OfflineRecipeRepository
import io.yggdrasil.labs.mealmate.lite.data.recipes.RecipePatchCommand
import io.yggdrasil.labs.mealmate.lite.data.sync.FailureResolution
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncFailureRepository
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncIssueView
import io.yggdrasil.labs.mealmate.lite.ui.sync.SyncFailureViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class RecipesScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun rejected_action_can_only_be_reedited_with_a_new_action() {
        val recipeRepository = FakeOfflineRecipeRepository()
        var syncTriggers = 0
        val editor = RecipeEditorViewModel(recipeRepository) { syncTriggers += 1 }
        editor.updateRecipeId("11111111-1111-4111-8111-111111111111")
        editor.updateName("重新编辑的菜品")
        val failures =
            SyncFailureViewModel(
                FakeSyncFailureRepository(
                    SyncIssueView.ActionFailure("failed-action", "VERSION_CONFLICT", "服务端版本较新"),
                ),
            )

        composeRule.setContent { RecipesScreen(editor, failures) }
        composeRule.onNodeWithText("按当前编辑重试").performClick()

        composeRule.waitUntil(5_000) { recipeRepository.replacements.isNotEmpty() }
        assertEquals(
            listOf(
                Replacement(
                    "failed-action",
                    "11111111-1111-4111-8111-111111111111",
                    RecipePatchCommand("重新编辑的菜品", null),
                ),
            ),
            recipeRepository.replacements,
        )
        assertEquals(1, syncTriggers)
    }

    private class FakeOfflineRecipeRepository : OfflineRecipeRepository {
        val replacements = mutableListOf<Replacement>()

        override suspend fun patch(
            recipeId: String,
            patch: RecipePatchCommand,
        ): LocalMutationResult = LocalMutationResult.Missing

        override suspend fun delete(recipeId: String): LocalMutationResult = LocalMutationResult.Missing

        override suspend fun replaceFailed(
            failedActionId: String,
            recipeId: String,
            patch: RecipePatchCommand,
        ): LocalMutationResult {
            replacements += Replacement(failedActionId, recipeId, patch)
            return LocalMutationResult.Applied("replacement-action", null)
        }
    }

    private class FakeSyncFailureRepository(
        private val issue: SyncIssueView,
    ) : SyncFailureRepository {
        override fun observe(): Flow<List<SyncIssueView>> = flowOf(listOf(issue))

        override suspend fun discardActionFailure(failedActionId: String): FailureResolution = FailureResolution.Discarded

        override suspend fun dismissDiagnostic(diagnosticId: String): FailureResolution = FailureResolution.Dismissed
    }

    private data class Replacement(
        val failedActionId: String,
        val recipeId: String,
        val patch: RecipePatchCommand,
    )
}
