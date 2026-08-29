package io.yggdrasil.labs.mealmate.lite.data.chat

import io.yggdrasil.labs.mealmate.lite.contract.SseFrame
import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import java.math.BigInteger

class SseProtocolException(message: String) : IllegalStateException(message)

class SseIncompleteException(message: String) : IllegalStateException(message)

/** Incremental validator for the frozen server SSE trace contract. */
class SseStreamValidator {
    private val frames = mutableListOf<SseFrame>()
    private var previousEvent: String? = null
    private var previousEventId = BigInteger.ZERO
    private var terminalSeen = false

    fun accept(frame: SseFrame) {
        if (terminalSeen) throw SseProtocolException("SSE frame appears after terminal event")
        val definition =
            GeneratedProtocolCatalog.sseEventMap[frame.event]
                ?: throw SseProtocolException("Unknown SSE event: ${frame.event}")
        if (!EVENT_ID_PATTERN.matches(frame.eventId)) {
            throw SseProtocolException("Invalid SSE event id: ${frame.eventId}")
        }
        val eventId = BigInteger(frame.eventId)
        if (frames.isEmpty() && eventId != BigInteger.ONE) {
            throw SseProtocolException("First SSE event id must be 1")
        }
        if (eventId <= previousEventId) {
            throw SseProtocolException("SSE event ids must increase monotonically")
        }
        if (frames.isEmpty() && !definition.isStart) {
            throw SseProtocolException("SSE trace must start with start")
        }
        if (previousEvent != null &&
            frame.event !in GeneratedProtocolCatalog.sseEventMap.getValue(previousEvent!!).nextEvents
        ) {
            throw SseProtocolException("Event ${frame.event} is not allowed after $previousEvent")
        }
        val dataError = GeneratedProtocolCatalog.validateEventData(definition.schemaId, contractJson, frame.data)
        if (dataError != null) throw SseProtocolException("Invalid ${frame.event} data: $dataError")

        frames += frame
        previousEvent = frame.event
        previousEventId = eventId
        if (definition.isTerminal) {
            terminalSeen = true
            val result = io.yggdrasil.labs.mealmate.lite.contract.validateSseTrace(frames)
            if (!result.success) {
                throw SseProtocolException(result.errors.joinToString("; "))
            }
        }
    }

    fun finish() {
        if (frames.isEmpty() || !terminalSeen) {
            throw SseIncompleteException("SSE stream closed before a terminal event")
        }
    }

    private companion object {
        val EVENT_ID_PATTERN = Regex("^[1-9][0-9]*$")
    }
}
