package io.yggdrasil.labs.mealmate.lite.data.chat

import io.yggdrasil.labs.mealmate.lite.contract.SseFrame
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class SseStreamValidatorTest {
    @Test
    fun `accepts a generated valid trace`() {
        val validator = SseStreamValidator()

        assertDoesNotThrow {
            validator.accept(frame("start", "1", START_DATA))
            validator.accept(frame("delta", "2", "{\"text\":\"hello\"}"))
            validator.accept(frame("done", "3", DONE_DATA))
            validator.finish()
        }
    }

    @Test
    fun `rejects a trace whose prefix does not start with start`() {
        val validator = SseStreamValidator()

        assertThrows(SseProtocolException::class.java) {
            validator.accept(frame("delta", "1", "{\"text\":\"no start\"}"))
        }
    }

    @Test
    fun `rejects a trace whose first event id is not one`() {
        val validator = SseStreamValidator()

        assertThrows(SseProtocolException::class.java) {
            validator.accept(frame("start", "2", START_DATA))
        }
    }

    @Test
    fun `rejects a repeated terminal event`() {
        val validator = SseStreamValidator()
        validator.accept(frame("start", "1", START_DATA))
        validator.accept(frame("done", "2", DONE_DATA))

        assertThrows(SseProtocolException::class.java) {
            validator.accept(frame("done", "3", DONE_DATA))
        }
    }

    @Test
    fun `rejects a stream that closes before a terminal event`() {
        val validator = SseStreamValidator()
        validator.accept(frame("start", "1", START_DATA))

        assertThrows(SseIncompleteException::class.java) { validator.finish() }
    }

    private fun frame(
        event: String,
        eventId: String,
        data: String,
    ) = SseFrame(event = event, eventId = eventId, data = data)

    private companion object {
        const val START_DATA =
            "{\"chatRequestId\":\"44444444-4444-4444-8444-444444444444\",\"replayed\":false,\"resumed\":false}"
        const val DONE_DATA =
            "{\"chatRequestId\":\"44444444-4444-4444-8444-444444444444\"}"
    }
}
