package io.yggdrasil.labs.mealmate.lite.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.yggdrasil.labs.mealmate.lite.contract.SseFrame
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ChatRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ConfirmationEventDto
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDeltaEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDoneEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseErrorEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseStartEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseToolStatusEvent
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatEvent
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatLocalStore
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatSender
import io.yggdrasil.labs.mealmate.lite.data.chat.SseProtocolException
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

data class ChatUiState(
    val draft: String = "",
    val messages: List<ConversationMessageEntity> = emptyList(),
    val streamingText: String = "",
    val sending: Boolean = false,
    val error: String? = null,
    val retryable: Boolean = false,
)

class ChatViewModel(
    private val sender: ChatSender,
    private val sessionManager: SessionManager,
    private val localStore: ChatLocalStore,
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val mutableState = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = mutableState.asStateFlow()
    private val workScope = scope ?: viewModelScope
    private var pendingRequest: PendingRequest? = null
    private var observedGeneration = sessionManager.state.value.generation
    private var attemptSequence = 0L
    private var activeAttempt: Long? = null
    private var activeJob: Job? = null
    private var draftSequence = 0L

    init {
        workScope.launch {
            sessionManager.state.collect { session ->
                if (session.generation != observedGeneration) {
                    observedGeneration = session.generation
                    pendingRequest = null
                    activeAttempt = ++attemptSequence
                    activeJob?.cancel()
                    activeJob = null
                    draftSequence += 1
                    mutableState.value =
                        mutableState.value.copy(
                            draft = "",
                            streamingText = "",
                            sending = false,
                            error = null,
                            retryable = false,
                        )
                }
            }
        }
        workScope.launch {
            localStore.observeMessages().collect { messages ->
                mutableState.value = mutableState.value.copy(messages = messages)
            }
        }
        workScope.launch {
            localStore.observeDraft().collect { draft ->
                if (!mutableState.value.sending && draft != null) {
                    mutableState.value = mutableState.value.copy(draft = draft.text)
                }
            }
        }
    }

    fun updateDraft(text: String) {
        if (text != mutableState.value.draft) pendingRequest = null
        mutableState.value = mutableState.value.copy(draft = text, error = null, retryable = false)
        val generation = sessionManager.state.value.generation
        val draftRevision = ++draftSequence
        workScope.launch {
            if (generation != null) {
                sessionManager.withCurrentGeneration(generation) {
                    if (draftRevision == draftSequence) localStore.saveDraft(text)
                }
            }
        }
    }

    fun send() {
        val text = mutableState.value.draft.trim()
        if (text.isEmpty()) return
        if (mutableState.value.sending) return
        if (mutableState.value.error != null && !mutableState.value.retryable) return
        val session = sessionManager.state.value
        val currentGeneration = session.generation ?: return
        val generation = currentGeneration
        val currentModel = session.selectedModelId ?: return
        val modelId = currentModel
        val requestId =
            pendingRequest
                ?.takeIf { it.text == text && it.modelId == modelId && it.generation == generation }
                ?.requestId
                ?: UUID.randomUUID().also {
                    pendingRequest = PendingRequest(it, text, modelId, generation)
                }
        val attempt = ++attemptSequence
        activeAttempt = attempt
        // Any queued draft write from before this attempt must not resurrect the draft
        // after a successful atomic turn append clears it.
        draftSequence += 1
        mutableState.value =
            mutableState.value.copy(sending = true, streamingText = "", error = null, retryable = false)
        val job = workScope.launch { runAttempt(requestId, modelId, text, generation, attempt) }
        activeJob = job.takeUnless { it.isCompleted }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun runAttempt(
        requestId: UUID,
        modelId: String,
        text: String,
        generation: Long,
        attempt: Long,
    ) {
        val assistant = StringBuilder()
        var completed = false
        var terminalError = false
        try {
            sender.send(ChatRequest(requestId, modelId, text), generation).collect { event ->
                when (event) {
                    is ChatEvent.Frame -> {
                        if (activeAttempt != attempt || !sessionManager.isCurrent(generation)) return@collect
                        when (handleFrame(event.frame, requestId, text, generation, attempt, assistant)) {
                            FrameResult.Completed -> completed = true
                            FrameResult.TerminalError -> terminalError = true
                            FrameResult.Continue -> Unit
                        }
                    }

                    is ChatEvent.TransportClosed -> {
                        handleTransportClosed(event, text, generation, attempt)
                    }
                }
            }
            if (activeAttempt != attempt) return
            if (!sessionManager.isCurrent(generation)) return
            if (!completed || terminalError) return
            persistCompleted(text, assistant.toString(), generation, attempt)
        } catch (error: kotlinx.coroutines.CancellationException) {
            throw error
        } catch (error: Exception) {
            sessionManager.withCurrentGeneration(generation) {
                if (activeAttempt == attempt) {
                    localStore.saveDraft(text)
                    mutableState.value =
                        mutableState.value.copy(
                            error = error.message ?: "发送失败",
                            retryable = retryable(error),
                        )
                }
            }
        } finally {
            if (activeAttempt == attempt) {
                activeJob = null
                mutableState.value = mutableState.value.copy(sending = false)
            }
        }
    }

    private fun retryable(error: Exception): Boolean =
        when (error) {
            is ApiCallException -> error.retryable ?: (error.statusCode >= SERVER_ERROR_MIN_STATUS)
            is SseProtocolException -> false
            is SerializationException -> false
            else -> true
        }

    @Suppress("LongParameterList")
    private suspend fun handleFrame(
        frame: SseFrame,
        requestId: UUID,
        text: String,
        generation: Long,
        attempt: Long,
        assistant: StringBuilder,
    ): FrameResult {
        val definition =
            GeneratedProtocolCatalog.sseEventMap[frame.event]
                ?: throw SseProtocolException("Unknown SSE event: ${frame.event}")
        return when (definition.schemaId) {
            "SseStartEvent" -> {
                val start = contractJson.decodeFromString<SseStartEvent>(frame.data)
                requireSse(start.chatRequestId == requestId, "SSE start request id mismatch")
                FrameResult.Continue
            }

            "SseDeltaEvent" -> {
                assistant.append(contractJson.decodeFromString<SseDeltaEvent>(frame.data).text)
                mutableState.value = mutableState.value.copy(streamingText = assistant.toString())
                FrameResult.Continue
            }

            "SseToolStatusEvent" -> {
                contractJson.decodeFromString<SseToolStatusEvent>(frame.data)
                FrameResult.Continue
            }

            "SseConfirmationRequiredEvent" -> {
                contractJson.decodeFromString<ConfirmationEventDto>(frame.data)
                FrameResult.Continue
            }

            "SseErrorEvent" -> {
                val serverError = contractJson.decodeFromString<SseErrorEvent>(frame.data)
                requireSse(serverError.requestId == requestId.toString(), "SSE error request id mismatch")
                sessionManager.withCurrentGeneration(generation) {
                    if (activeAttempt == attempt) {
                        localStore.saveDraft(text)
                        mutableState.value =
                            mutableState.value.copy(
                                error = serverError.errMessage,
                                retryable = serverError.retryable,
                            )
                    }
                }
                FrameResult.TerminalError
            }

            "SseDoneEvent" -> {
                val done = contractJson.decodeFromString<SseDoneEvent>(frame.data)
                requireSse(done.chatRequestId == requestId, "SSE done request id mismatch")
                FrameResult.Completed
            }

            else -> {
                throw SseProtocolException("Unsupported SSE schema")
            }
        }
    }

    private fun requireSse(
        condition: Boolean,
        message: String,
    ) {
        if (!condition) throw SseProtocolException(message)
    }

    private suspend fun handleTransportClosed(
        event: ChatEvent.TransportClosed,
        text: String,
        generation: Long,
        attempt: Long,
    ) {
        sessionManager.withCurrentGeneration(generation) {
            if (activeAttempt == attempt) {
                localStore.saveDraft(text)
                mutableState.value =
                    mutableState.value.copy(
                        error = event.cause?.message ?: "连接已断开",
                        retryable = true,
                    )
            }
        }
    }

    private suspend fun persistCompleted(
        text: String,
        assistant: String,
        generation: Long,
        attempt: Long,
    ) {
        val now = OffsetDateTime.now(ZoneOffset.UTC).toString()
        sessionManager.withCurrentGeneration(generation) {
            if (activeAttempt == attempt) {
                localStore.appendTurnAndClearDraft(
                    ConversationMessageEntity(role = "user", content = text, createdAt = now),
                    ConversationMessageEntity(
                        role = "assistant",
                        content = assistant,
                        createdAt = now,
                    ),
                )
                pendingRequest = null
                mutableState.value = mutableState.value.copy(draft = "", streamingText = "")
            }
        }
    }

    private companion object {
        const val SERVER_ERROR_MIN_STATUS = 500
    }

    private enum class FrameResult {
        Continue,
        Completed,
        TerminalError,
    }

    private data class PendingRequest(
        val requestId: UUID,
        val text: String,
        val modelId: String,
        val generation: Long,
    )
}
