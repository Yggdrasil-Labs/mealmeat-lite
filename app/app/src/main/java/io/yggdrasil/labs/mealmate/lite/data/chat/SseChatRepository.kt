package io.yggdrasil.labs.mealmate.lite.data.chat

import io.yggdrasil.labs.mealmate.lite.contract.SseFrame
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ChatRequest
import io.yggdrasil.labs.mealmate.lite.data.auth.SessionManager
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ChatDraftEntity
import io.yggdrasil.labs.mealmate.lite.data.local.entity.ConversationMessageEntity
import io.yggdrasil.labs.mealmate.lite.data.remote.ApiCallException
import io.yggdrasil.labs.mealmate.lite.data.remote.MealMateApi
import io.yggdrasil.labs.mealmate.lite.data.remote.asApiCallException
import io.yggdrasil.labs.mealmate.lite.data.remote.requireSuccessData
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.ResponseBody
import okio.BufferedSource

sealed interface ChatEvent {
    data class Frame(
        val frame: SseFrame,
    ) : ChatEvent

    data class TransportClosed(
        val cause: Throwable? = null,
    ) : ChatEvent
}

interface ChatSender {
    fun send(
        request: ChatRequest,
        generation: Long,
    ): Flow<ChatEvent>
}

interface ChatLocalStore {
    fun observeMessages(): Flow<List<ConversationMessageEntity>>

    fun observeDraft(): Flow<ChatDraftEntity?>

    suspend fun saveDraft(text: String)

    suspend fun appendTurnAndClearDraft(
        user: ConversationMessageEntity,
        assistant: ConversationMessageEntity,
    )
}

class SseChatRepository(
    private val api: MealMateApi,
    private val sessionManager: SessionManager,
) : ChatSender {
    override fun send(
        request: ChatRequest,
        generation: Long,
    ): Flow<ChatEvent> =
        flow {
            val credential = sessionManager.currentCredential(generation) ?: return@flow
            val authorization = "Bearer ${credential.token}"
            var probeAttempted = false

            suspend fun probeAfterClose(cause: Throwable?) {
                if (probeAttempted) return
                probeAttempted = true
                try {
                    api.listDevices(authorization).requireSuccessData()
                } catch (error: CancellationException) {
                    throw error
                } catch (error: ApiCallException) {
                    if (error.statusCode == UNAUTHORIZED_STATUS) sessionManager.invalidate(generation)
                } catch (_: Exception) {
                    // A failed probe is deliberately not treated as revocation.
                }
                emit(ChatEvent.TransportClosed(cause))
            }

            val response =
                try {
                    api.chat(request, authorization)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: java.io.IOException) {
                    probeAfterClose(error)
                    return@flow
                }
            if (!response.isSuccessful) {
                val error = response.asApiCallException()
                if (response.code() == UNAUTHORIZED_STATUS) sessionManager.invalidate(generation)
                throw error
            }

            val body =
                response.body() ?: run {
                    probeAfterClose(IllegalStateException("Chat response had no body"))
                    return@flow
                }
            var terminalFrameReceived = false
            val parseResult =
                try {
                    body.use {
                        parseStream(it) { event ->
                            if (!sessionManager.isCurrent(generation)) {
                                throw CancellationException("Session is no longer current")
                            }
                            if (event is ChatEvent.Frame &&
                                GeneratedProtocolCatalog.sseEventMap.getValue(event.frame.event).isTerminal
                            ) {
                                terminalFrameReceived = true
                            }
                            emit(event)
                        }
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: java.io.IOException) {
                    if (!terminalFrameReceived) {
                        probeAfterClose(error)
                        return@flow
                    }
                    // The terminal frame has already been delivered. A close failure cannot
                    // turn a completed trace into a transport failure or trigger a probe.
                    ParseResult(terminal = true, cause = null)
                }
            // A clean EOF without a terminal frame is a transport failure. The probe is the
            // only place where an already-established stream may invalidate the session.
            if (!parseResult.terminal && !terminalFrameReceived) probeAfterClose(parseResult.cause)
        }.flowOn(Dispatchers.IO)

    @Suppress("RethrowCaughtException")
    private suspend fun parseStream(
        body: ResponseBody,
        emit: suspend (ChatEvent) -> Unit,
    ): ParseResult {
        val validator = SseStreamValidator()
        try {
            var terminal = false
            readFrames(body.source(), isTerminalSeen = { terminal }) { frame ->
                validator.accept(frame)
                emit(ChatEvent.Frame(frame))
                if (GeneratedProtocolCatalog.sseEventMap.getValue(frame.event).isTerminal) terminal = true
            }
            validator.finish()
            return ParseResult(terminal, null)
        } catch (error: SseIncompleteException) {
            return ParseResult(false, error)
        } catch (error: java.io.IOException) {
            return ParseResult(false, error)
        } catch (error: CancellationException) {
            throw error
        }
    }

    @Suppress("RethrowCaughtException", "ThrowsCount")
    private suspend fun readFrames(
        source: BufferedSource,
        isTerminalSeen: () -> Boolean,
        onFrame: suspend (SseFrame) -> Unit,
    ) {
        var eventId: String? = null
        var event: String? = null
        val data = mutableListOf<String>()

        fun hasPendingFrame(): Boolean = eventId != null || event != null || data.isNotEmpty()

        suspend fun dispatch() {
            val id = eventId
            val name = event
            if (hasPendingFrame()) {
                if (id == null || name == null || data.isEmpty()) {
                    throw SseProtocolException("SSE frame must contain id, event and data")
                }
                onFrame(SseFrame(event = name, eventId = id, data = data.joinToString("\n")))
            }
            eventId = null
            event = null
            data.clear()
        }
        try {
            while (true) {
                val line = source.readUtf8Line() ?: break
                if (line.isEmpty()) {
                    dispatch()
                    continue
                }
                if (line.startsWith(':')) continue
                val separator = line.indexOf(':')
                val field = if (separator >= 0) line.substring(0, separator) else line
                val value = if (separator >= 0) line.substring(separator + 1).removePrefix(" ") else ""
                when (field) {
                    "id" -> eventId = value
                    "event" -> event = value
                    "data" -> data += value
                }
            }
        } catch (error: java.io.IOException) {
            if (isTerminalSeen() && hasPendingFrame()) {
                throw SseProtocolException("SSE frame appears after terminal event")
            }
            throw error
        }
        if (hasPendingFrame()) {
            if (isTerminalSeen()) throw SseProtocolException("SSE frame appears after terminal event")
            throw SseIncompleteException("SSE frame was not terminated")
        }
    }

    private companion object {
        const val UNAUTHORIZED_STATUS = 401
    }

    private data class ParseResult(
        val terminal: Boolean,
        val cause: Throwable?,
    )
}
