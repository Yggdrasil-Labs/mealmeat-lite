package io.yggdrasil.labs.mealmate.lite.ui.sync

import androidx.test.platform.app.InstrumentationRegistry
import io.yggdrasil.labs.mealmate.lite.data.sync.FailureResolution
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncFailureRepository
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncIssueView
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import org.junit.Assert.assertEquals
import org.junit.Test

class SyncFailureViewModelTest {
    @Test
    fun action_failures_and_diagnostics_keep_separate_user_resolution_paths() {
        val repository = RecordingFailureRepository()
        val viewModel = SyncFailureViewModel(repository)

        viewModel.discard("failed-action")
        viewModel.dismiss("cursor-diagnostic")
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()

        assertEquals(listOf("failed-action"), repository.discardedActionIds)
        assertEquals(listOf("cursor-diagnostic"), repository.dismissedDiagnosticIds)
    }

    private class RecordingFailureRepository : SyncFailureRepository {
        val discardedActionIds = mutableListOf<String>()
        val dismissedDiagnosticIds = mutableListOf<String>()

        override fun observe(): Flow<List<SyncIssueView>> = emptyFlow()

        override suspend fun discardActionFailure(failedActionId: String): FailureResolution {
            discardedActionIds += failedActionId
            return FailureResolution.Discarded
        }

        override suspend fun dismissDiagnostic(diagnosticId: String): FailureResolution {
            dismissedDiagnosticIds += diagnosticId
            return FailureResolution.Dismissed
        }
    }
}
