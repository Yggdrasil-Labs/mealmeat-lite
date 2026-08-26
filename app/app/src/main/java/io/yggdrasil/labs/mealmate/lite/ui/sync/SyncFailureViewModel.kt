@file:Suppress("MagicNumber", "MaxLineLength")

package io.yggdrasil.labs.mealmate.lite.ui.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncFailureRepository
import io.yggdrasil.labs.mealmate.lite.data.sync.SyncIssueView
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SyncFailureViewModel(
    private val repository: SyncFailureRepository,
) : ViewModel() {
    val issues: StateFlow<List<SyncIssueView>> =
        repository.observe().stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            emptyList(),
        )

    fun discard(actionId: String) {
        viewModelScope.launch { repository.discardActionFailure(actionId) }
    }

    fun dismiss(diagnosticId: String) {
        viewModelScope.launch { repository.dismissDiagnostic(diagnosticId) }
    }
}
