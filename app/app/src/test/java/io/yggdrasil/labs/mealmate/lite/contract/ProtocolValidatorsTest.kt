package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.GeneratedProtocolCatalog
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.LocalDate

@DisplayName("ProtocolValidatorsTest")
class ProtocolValidatorsTest {
    private val chatRequestId = "01912345-6789-7def-abcd-ef0123456789"

    private fun trace(vararg events: Pair<String, String>): List<SseFrame> =
        events.mapIndexed { index, (event, data) ->
            SseFrame(event = event, data = data, eventId = (index + 1).toString())
        }

    private fun start(
        replayed: Boolean = false,
        resumed: Boolean = false,
    ): Pair<String, String> = "start" to """{"chatRequestId":"$chatRequestId","replayed":$replayed,"resumed":$resumed}"""

    private fun delta(text: String = "你好"): Pair<String, String> = "delta" to """{"text":"$text"}"""

    private fun done(): Pair<String, String> = "done" to """{"chatRequestId":"$chatRequestId"}"""

    @Nested
    @DisplayName("SSE Trace 验证")
    inner class SseTraceValidation {
        @Test
        @DisplayName("有效 trace - start -> delta -> done")
        fun validTraceStartDeltaDone() {
            assertTrue(validateSseTrace(trace(start(), delta(), done())).success)
        }

        @Test
        @DisplayName("有效 trace - 包含闭合 tool-status")
        fun validTraceWithToolStatus() {
            val result =
                validateSseTrace(
                    trace(
                        start(),
                        "tool-status" to """{"toolCallId":"call_1","toolName":"add_recipe","status":"started"}""",
                        delta("正在添加菜品"),
                        "tool-status" to """{"toolCallId":"call_1","toolName":"add_recipe","status":"succeeded"}""",
                        done(),
                    ),
                )
            assertTrue(result.success, result.errors.joinToString())
        }

        @Test
        @DisplayName("拒绝缺少 start、未知事件与重复 start")
        fun rejectsInvalidStartsAndUnknownEvents() {
            assertFalse(validateSseTrace(trace(delta(), done())).success)
            assertFalse(validateSseTrace(trace(start(), "unknown" to "{}", done())).success)
            assertFalse(validateSseTrace(trace(start(), start(), done())).success)
        }

        @Test
        @DisplayName("拒绝空、非首或非单调 eventId")
        fun rejectsInvalidEventIds() {
            val emptyId = listOf(SseFrame("start", start().second, ""), SseFrame("done", done().second, "2"))
            val nonFirst = listOf(SseFrame("start", start().second, "2"), SseFrame("done", done().second, "3"))
            val nonMonotonic =
                listOf(
                    SseFrame("start", start().second, "1"),
                    SseFrame("delta", delta().second, "3"),
                    SseFrame("done", done().second, "2"),
                )
            assertFalse(validateSseTrace(emptyId).success)
            assertFalse(validateSseTrace(nonFirst).success)
            assertFalse(validateSseTrace(nonMonotonic).success)
        }

        @Test
        @DisplayName("拒绝错误 data、终态后事件、未闭合 tool 和 replay/resume 冲突")
        fun rejectsInvalidDataAndStateTransitions() {
            assertFalse(validateSseTrace(trace(start(), "delta" to """{"text":123}""", done())).success)
            assertFalse(validateSseTrace(trace(start(), done(), delta())).success)
            assertFalse(
                validateSseTrace(
                    trace(
                        start(),
                        "tool-status" to """{"toolCallId":"call_1","toolName":"add_recipe","status":"started"}""",
                        done(),
                    ),
                ).success,
            )
            assertFalse(validateSseTrace(trace(start(replayed = true, resumed = true), done())).success)
        }

        @Test
        @DisplayName("SSE error 必须满足生成的错误目录")
        fun validatesSseErrorAgainstGeneratedCatalog() {
            val valid =
                validateSseTrace(
                    trace(
                        start(),
                        "error" to
                            """{"errCode":"BAD_REQUEST","errMessage":"bad","requestId":"request-1","retryable":false}""",
                    ),
                )
            assertTrue(valid.success, valid.errors.joinToString())

            val wrongChannel =
                validateSseTrace(
                    trace(
                        start(),
                        "error" to
                            """{"errCode":"RATE_LIMITED","errMessage":"limited","requestId":"request-1","retryable":true}""",
                    ),
                )
            val retryableMismatch =
                validateSseTrace(
                    trace(
                        start(),
                        "error" to
                            """{"errCode":"BAD_REQUEST","errMessage":"bad","requestId":"request-1","retryable":true}""",
                    ),
                )
            val emptyRequestId =
                validateSseTrace(
                    trace(
                        start(),
                        "error" to
                            """{"errCode":"BAD_REQUEST","errMessage":"bad","requestId":"","retryable":false}""",
                    ),
                )
            assertFalse(wrongChannel.success)
            assertFalse(retryableMismatch.success)
            assertFalse(emptyRequestId.success)
        }
    }

    @Nested
    @DisplayName("Invariant 验证")
    inner class InvariantValidation {
        @Test
        @DisplayName("WEEK_START_IS_MONDAY")
        fun weekStartIsMonday() {
            val monday = LocalDate.of(2024, 1, 15)
            assertEquals(DayOfWeek.MONDAY, monday.dayOfWeek)
            assertTrue(validateInvariant(InvariantId.WEEK_START_IS_MONDAY, monday.toString()).success)
            assertFalse(validateInvariant(InvariantId.WEEK_START_IS_MONDAY, "2024-01-16").success)
        }

        @Test
        @DisplayName("WEEKLY_PLAN_HAS_21_SLOTS 与 SERVER_VERSION_WITHIN_DB_BIGINT")
        fun weeklyPlanAndServerVersion() {
            assertTrue(
                validateInvariant(
                    InvariantId.WEEKLY_PLAN_HAS_21_SLOTS,
                    mapOf("items" to List<Any?>(21) { null }),
                ).success,
            )
            assertFalse(validateInvariant(InvariantId.WEEKLY_PLAN_HAS_21_SLOTS, 21).success)
            assertFalse(
                validateInvariant(
                    InvariantId.WEEKLY_PLAN_HAS_21_SLOTS,
                    mapOf("items" to 21),
                ).success,
            )
            assertTrue(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, "9223372036854775807").success)
            assertFalse(validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, "9223372036854775808").success)
        }

        @Test
        @DisplayName("SYNC_RESULTS_PRESERVE_INPUT_ORDER 不再是空操作")
        fun syncResultsPreserveInputOrder() {
            assertTrue(
                validateInvariant(
                    InvariantId.SYNC_RESULTS_PRESERVE_INPUT_ORDER,
                    SyncResultsOrderInput(listOf("a", "b"), listOf("a", "b")),
                ).success,
            )
            assertFalse(
                validateInvariant(
                    InvariantId.SYNC_RESULTS_PRESERVE_INPUT_ORDER,
                    SyncResultsOrderInput(listOf("a", "b"), listOf("b", "a")),
                ).success,
            )
            assertFalse(
                validateInvariant(
                    InvariantId.CONFIRMATION_STATE_FIELDS_MATCH,
                    ConfirmationStateFieldsInput(state = "unknown", confirmationToken = null),
                ).success,
            )
        }

        @Test
        @DisplayName("生成的不变量 corpus 在 Android 解释器中具有一致的正反结果")
        fun generatedInvariantCorpusHasConsistentResults() {
            for (definition in GeneratedProtocolCatalog.invariantDefinitions) {
                assertTrue(definition.validVectors.isNotEmpty(), "${definition.id} needs valid vectors")
                assertTrue(definition.invalidVectors.isNotEmpty(), "${definition.id} needs invalid vectors")
                for (vector in definition.validVectors) {
                    assertTrue(
                        validateInvariant(definition.id, contractJson.parseToJsonElement(vector)).success,
                        "${definition.id} valid vector: $vector",
                    )
                }
                for (vector in definition.invalidVectors) {
                    assertFalse(
                        validateInvariant(definition.id, contractJson.parseToJsonElement(vector)).success,
                        "${definition.id} invalid vector: $vector",
                    )
                }
            }
        }

        @Test
        @DisplayName("CONFIRMATION_STATE_FIELDS_MATCH 使用生成 token 规则")
        fun confirmationStateFieldsMatch() {
            assertTrue(
                validateInvariant(
                    InvariantId.CONFIRMATION_STATE_FIELDS_MATCH,
                    ConfirmationStateFieldsInput(state = "pending", confirmationToken = "token"),
                ).success,
            )
            assertFalse(
                validateInvariant(
                    InvariantId.CONFIRMATION_STATE_FIELDS_MATCH,
                    ConfirmationStateFieldsInput(state = "pending", confirmationToken = null),
                ).success,
            )
            assertFalse(
                validateInvariant(
                    InvariantId.CONFIRMATION_STATE_FIELDS_MATCH,
                    ConfirmationStateFieldsInput(state = "expired", confirmationToken = "token"),
                ).success,
            )
        }
    }
}
