package io.yggdrasil.labs.mealmate.lite.ui.chat

import androidx.test.ext.junit.runners.AndroidJUnit4
import io.yggdrasil.labs.mealmate.lite.contract.SseFrame
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ChatRequest
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredential
import io.yggdrasil.labs.mealmate.lite.data.auth.DeviceCredentialStore
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatEvent
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatLocalStore
import io.yggdrasil.labs.mealmate.lite.data.chat.ChatSender
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ChatViewModelTest {
    @Test
    fun persists_one_turn_only_after_done_for_current_generation() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val sender =
                FakeChatSender(
                    listOf(
                        ChatEvent.Frame(frame("start", START_ID, START_DATA)),
                        ChatEvent.Frame(frame("delta", "2", "{\"text\":\"reply\"}")),
                        ChatEvent.Frame(frame("done", "3", DONE_DATA)),
                    ),
                )
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("question")
            viewModel.send()

            assertEquals(
                listOf(Turn("user", "question"), Turn("assistant", "reply")),
                store.turns,
            )
            assertEquals(null, store.draft.value)
        }

    @Test
    fun does_not_persist_done_event_from_old_generation() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val sender =
                object : ChatSender {
                    override fun send(
                        request: ChatRequest,
                        generation: Long,
                    ): Flow<ChatEvent> =
                        flow {
                            emit(ChatEvent.Frame(frame("start", START_ID, startData(request.chatRequestId))))
                            session.startProvisioning("new-device", "new-token")
                            emit(ChatEvent.Frame(frame("delta", "2", "{\"text\":\"stale\"}")))
                            emit(ChatEvent.Frame(frame("done", "3", doneData(request.chatRequestId))))
                        }
                }
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("old question")
            viewModel.send()

            assertTrue(store.turns.isEmpty())
            assertEquals("old question", store.draft.value?.text)
        }

    @Test
    fun error_terminal_keeps_draft_and_exposes_server_message() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val sender =
                FakeChatSender(
                    listOf(
                        ChatEvent.Frame(frame("start", START_ID, START_DATA)),
                        ChatEvent.Frame(
                            frame(
                                "error",
                                "2",
                                "{\"errCode\":\"PROVIDER_ERROR\",\"errMessage\":\"provider unavailable\",\n" +
                                    "\"retryable\":true,\"requestId\":\"request-1\"}",
                            ),
                        ),
                    ),
                )
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("question")
            viewModel.send()

            assertTrue(store.turns.isEmpty())
            assertEquals("question", store.draft.value?.text)
            assertEquals("provider unavailable", viewModel.state.value.error)
        }

    @Test
    fun request_id_mismatch_is_rejected_without_persisting_a_turn() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val sender =
                object : ChatSender {
                    override fun send(
                        request: ChatRequest,
                        generation: Long,
                    ): Flow<ChatEvent> =
                        flowOf(
                            ChatEvent.Frame(frame("start", "1", START_DATA)),
                            ChatEvent.Frame(frame("done", "2", DONE_DATA)),
                        )
                }
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("question")
            viewModel.send()

            assertTrue(store.turns.isEmpty())
            assertEquals("question", store.draft.value?.text)
            assertEquals("SSE start request id mismatch", viewModel.state.value.error)
            assertEquals(false, viewModel.state.value.retryable)
        }

    @Test
    fun retry_reuses_request_id_after_transport_close() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val requestIds = mutableListOf<UUID>()
            var attempt = 0
            val sender =
                object : ChatSender {
                    override fun send(
                        request: ChatRequest,
                        generation: Long,
                    ): Flow<ChatEvent> {
                        requestIds += request.chatRequestId
                        attempt += 1
                        return if (attempt == 1) {
                            flowOf(
                                ChatEvent.Frame(frame("start", "1", startData(request.chatRequestId))),
                                ChatEvent.TransportClosed(IllegalStateException("socket closed")),
                            )
                        } else {
                            flowOf(
                                ChatEvent.Frame(frame("start", "1", startData(request.chatRequestId))),
                                ChatEvent.Frame(frame("delta", "2", "{\"text\":\"reply\"}")),
                                ChatEvent.Frame(frame("done", "3", doneData(request.chatRequestId))),
                            )
                        }
                    }
                }
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("question")
            viewModel.send()
            viewModel.send()

            assertEquals(2, requestIds.size)
            assertEquals(requestIds[0], requestIds[1])
            assertEquals(
                listOf(Turn("user", "question"), Turn("assistant", "reply")),
                store.turns,
            )
        }

    @Test
    fun non_retryable_api_error_disables_retry() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            var sends = 0
            val sender =
                object : ChatSender {
                    override fun send(
                        request: ChatRequest,
                        generation: Long,
                    ): Flow<ChatEvent> =
                        flow {
                            sends += 1
                            throw ApiCallException(422, "MODEL_UNAVAILABLE", "model unavailable")
                        }
                }
            val viewModel = ChatViewModel(sender, session, store, testScope())

            viewModel.updateDraft("question")
            viewModel.send()

            assertEquals("model unavailable", viewModel.state.value.error)
            assertEquals(false, viewModel.state.value.retryable)
            viewModel.send()
            assertEquals(1, sends)
        }

    @Test
    fun generation_change_cancels_the_active_sender_job() =
        runBlocking {
            val session = activeSession()
            val store = FakeChatLocalStore()
            val cancelled = CompletableDeferred<Unit>()
            val sender =
                object : ChatSender {
                    override fun send(
                        request: ChatRequest,
                        generation: Long,
                    ): Flow<ChatEvent> =
                        flow {
                            try {
                                emit(ChatEvent.Frame(frame("start", START_ID, startData(request.chatRequestId))))
                                awaitCancellation()
                            } finally {
                                cancelled.complete(Unit)
                            }
                        }
                }
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            val viewModel = ChatViewModel(sender, session, store, scope)

            viewModel.updateDraft("question")
            viewModel.send()
            session.startProvisioning("new-device", "new-token")

            withTimeout(1_000) { cancelled.await() }
            scope.cancel()
        }

    private fun activeSession(): SessionManager {
        val manager = SessionManager(FakeDeviceCredentialStore())
        runBlocking {
            val generation = manager.startProvisioning("device-a", "token-a")
            check(manager.selectModel(generation, "model-a"))
            check(manager.activate(generation, "model-a"))
        }
        return manager
    }

    private fun testScope() = CoroutineScope(Dispatchers.Unconfined)

    private fun frame(
        event: String,
        eventId: String,
        data: String,
    ) = SseFrame(event, data, eventId)

    private fun startData(requestId: UUID) = START_DATA.replace(FIXED_CHAT_ID, requestId.toString())

    private fun doneData(requestId: UUID) = DONE_DATA.replace(FIXED_CHAT_ID, requestId.toString())

    private class FakeChatSender(
        private val events: List<ChatEvent>,
    ) : ChatSender {
        override fun send(
            request: ChatRequest,
            generation: Long,
        ): Flow<ChatEvent> =
            flowOf(
                *events
                    .map { event ->
                        if (event is ChatEvent.Frame &&
                            (event.frame.event == "start" || event.frame.event == "done")
                        ) {
                            event.copy(
                                frame =
                                    event.frame.copy(
                                        data = event.frame.data.replace(FIXED_CHAT_ID, request.chatRequestId.toString()),
                                    ),
                            )
                        } else {
                            event
                        }
                    }.toTypedArray(),
            )
    }

    private class FakeChatLocalStore : ChatLocalStore {
        val draft = MutableStateFlow<ChatDraftEntity?>(null)
        val turns = mutableListOf<Turn>()

        override fun observeMessages(): Flow<List<ConversationMessageEntity>> = flowOf(emptyList())

        override fun observeDraft(): Flow<ChatDraftEntity?> = draft

        override suspend fun saveDraft(text: String) {
            draft.value = ChatDraftEntity(text = text)
        }

        override suspend fun appendTurnAndClearDraft(
            user: ConversationMessageEntity,
            assistant: ConversationMessageEntity,
        ) {
            turns += Turn(user.role, user.content)
            turns += Turn(assistant.role, assistant.content)
            draft.value = null
        }
    }

    private class FakeDeviceCredentialStore : DeviceCredentialStore {
        private var credential: DeviceCredential? = null

        override suspend fun read(): DeviceCredential? = credential

        override suspend fun save(credential: DeviceCredential) {
            this.credential = credential
        }

        override suspend fun clear() {
            credential = null
        }
    }

    private data class Turn(
        val role: String,
        val content: String,
    )

    private companion object {
        const val START_ID = "1"
        const val FIXED_CHAT_ID = "44444444-4444-4444-8444-444444444444"
        const val START_DATA =
            "{\"chatRequestId\":\"$FIXED_CHAT_ID\",\"replayed\":false,\"resumed\":false}"
        const val DONE_DATA = "{\"chatRequestId\":\"$FIXED_CHAT_ID\"}"
    }
}
