package io.yggdrasil.labs.mealmate.lite.contract

import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDeltaEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseDoneEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseStartEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SseToolStatusEvent
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.WeeklyPlanView
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * 协议验证器测试
 *
 * 验收标准：
 * - AC2: SSE trace 与 invariant golden vectors 和 TS 端结果一致
 */
@DisplayName("ProtocolValidatorsTest")
class ProtocolValidatorsTest {
    @Nested
    @DisplayName("SSE Trace 验证")
    inner class SseTraceValidation {
        @Test
        @DisplayName("有效 trace - start -> delta -> done")
        fun validTraceStartDeltaDone() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("delta", """{"text":"你好"}"""),
                    SseFrame("delta", """{"text":"，我是"}"""),
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}"""),
                )
            val result = validateSseTrace(trace)
            assertTrue(result.success, "有效 trace 应通过验证")
        }

        @Test
        @DisplayName("有效 trace - 包含 tool-status")
        fun validTraceWithToolStatus() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("tool-status", """{"toolCallId":"call_1","toolName":"add_recipe","status":"started"}"""),
                    SseFrame("delta", """{"text":"正在添加菜品..."}"""),
                    SseFrame("tool-status", """{"toolCallId":"call_1","toolName":"add_recipe","status":"succeeded"}"""),
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}"""),
                )
            val result = validateSseTrace(trace)
            assertTrue(result.success, "包含 tool-status 的 trace 应通过验证")
        }

        @Test
        @DisplayName("无效 trace - 缺少 start")
        fun invalidTraceMissingStart() {
            val trace =
                listOf(
                    SseFrame("delta", """{"text":"你好"}"""),
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}"""),
                )
            val result = validateSseTrace(trace)
            assertFalse(result.success, "缺少 start 的 trace 应失败")
            assertTrue(result.errors.any { it.contains("start") }, "错误应提到 start")
        }

        @Test
        @DisplayName("无效 trace - 缺少 terminal")
        fun invalidTraceMissingTerminal() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("delta", """{"text":"你好"}"""),
                )
            val result = validateSseTrace(trace)
            assertFalse(result.success, "缺少 terminal 的 trace 应失败")
            assertTrue(result.errors.any { it.contains("terminal") || it.contains("done") || it.contains("error") })
        }

        @Test
        @DisplayName("无效 trace - 非单调 eventId")
        fun invalidTraceNonMonotonicEventId() {
            val trace =
                listOf(
                    SseFrame(
                        "start",
                        """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}""",
                        eventId = "1",
                    ),
                    SseFrame("delta", """{"text":"你好"}""", eventId = "3"),
                    SseFrame("delta", """{"text":"世界"}""", eventId = "2"), // 倒退
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}""", eventId = "4"),
                )
            val result = validateSseTrace(trace)
            assertFalse(result.success, "非单调 eventId 应失败")
        }

        @Test
        @DisplayName("无效 trace - terminal 后有更多事件")
        fun invalidTraceEventsAfterTerminal() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}"""),
                    SseFrame("delta", """{"text":"不应该出现"}"""),
                )
            val result = validateSseTrace(trace)
            assertFalse(result.success, "terminal 后的事件应导致失败")
        }

        @Test
        @DisplayName("有效 trace - error 作为 terminal")
        fun validTraceErrorTerminal() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("error", """{"errCode":"PROVIDER_ERROR","errMessage":"模型超时","retryable":true,"requestId":"req-1"}"""),
                )
            val result = validateSseTrace(trace)
            assertTrue(result.success, "error 作为 terminal 应通过验证")
        }

        @Test
        @DisplayName("无效 trace - tool 未闭合")
        fun invalidTraceUnclosedTool() {
            val trace =
                listOf(
                    SseFrame("start", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789","replayed":false,"resumed":false}"""),
                    SseFrame("tool-status", """{"toolCallId":"call_1","toolName":"add_recipe","status":"started"}"""),
                    // 没有 succeeded 或 failed
                    SseFrame("done", """{"chatRequestId":"01912345-6789-7def-abcd-ef0123456789"}"""),
                )
            val result = validateSseTrace(trace)
            assertFalse(result.success, "未闭合的 tool 应导致失败")
        }
    }

    @Nested
    @DisplayName("Invariant 验证")
    inner class InvariantValidation {
        @Test
        @DisplayName("WEEK_START_IS_MONDAY - 有效周一")
        fun weekStartIsMondayValid() {
            // 2024-01-15 是周一
            val monday = LocalDate.of(2024, 1, 15)
            assertEquals(DayOfWeek.MONDAY, monday.dayOfWeek)

            val result = validateInvariant(InvariantId.WEEK_START_IS_MONDAY, monday.toString())
            assertTrue(result.success, "周一应通过验证")
        }

        @Test
        @DisplayName("WEEK_START_IS_MONDAY - 无效非周一")
        fun weekStartIsMondayInvalid() {
            // 2024-01-16 是周二
            val tuesday = LocalDate.of(2024, 1, 16)
            assertEquals(DayOfWeek.TUESDAY, tuesday.dayOfWeek)

            val result = validateInvariant(InvariantId.WEEK_START_IS_MONDAY, tuesday.toString())
            assertFalse(result.success, "非周一应失败")
        }

        @Test
        @DisplayName("WEEKLY_PLAN_HAS_21_SLOTS - 有效 21 个槽位")
        fun weeklyPlanHas21SlotsValid() {
            val result = validateInvariant(InvariantId.WEEKLY_PLAN_HAS_21_SLOTS, 21)
            assertTrue(result.success, "21 个槽位应通过验证")
        }

        @Test
        @DisplayName("WEEKLY_PLAN_HAS_21_SLOTS - 无效槽位数")
        fun weeklyPlanHas21SlotsInvalid() {
            val result = validateInvariant(InvariantId.WEEKLY_PLAN_HAS_21_SLOTS, 20)
            assertFalse(result.success, "非 21 个槽位应失败")
        }

        @Test
        @DisplayName("SERVER_VERSION_WITHIN_DB_BIGINT - 有效范围")
        fun serverVersionWithinRange() {
            val result = validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, "9223372036854775807")
            assertTrue(result.success, "最大 bigint 应通过验证")
        }

        @Test
        @DisplayName("SERVER_VERSION_WITHIN_DB_BIGINT - 超出范围")
        fun serverVersionOutOfRange() {
            val result = validateInvariant(InvariantId.SERVER_VERSION_WITHIN_DB_BIGINT, "9223372036854775808")
            assertFalse(result.success, "超出 bigint 范围应失败")
        }
    }
}
