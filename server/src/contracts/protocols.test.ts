/**
 * 协议运行时测试
 *
 * 验证：
 * 1. 错误 tuple 校验 (status + headers + body)
 * 2. SSE trace 校验 (eventId 单调、start/terminal 位置、tool lifecycle)
 * 3. 不变量校验
 */
import { describe, expect, it } from 'vitest'
import { resolveErrorDefinition, validatePublicErrorTuple } from './error-catalog.js'
import { validateInvariant } from './invariants.js'
import { type SseFrame, validateSseTrace } from './sse-trace.js'

describe('错误目录', () => {
  describe('resolveErrorDefinition', () => {
    it('解析 BAD_REQUEST 错误定义', () => {
      const def = resolveErrorDefinition('BAD_REQUEST')
      expect(def.errCode).toBe('BAD_REQUEST')
      expect(def.httpStatus).toBe(400)
      expect(def.retryable).toBe(false)
    })

    it('解析 RATE_LIMITED 错误定义', () => {
      const def = resolveErrorDefinition('RATE_LIMITED')
      expect(def.errCode).toBe('RATE_LIMITED')
      expect(def.httpStatus).toBe(429)
      expect(def.retryable).toBe(true)
    })

    it('解析 PROVIDER_ERROR 错误定义', () => {
      const def = resolveErrorDefinition('PROVIDER_ERROR')
      expect(def.errCode).toBe('PROVIDER_ERROR')
      expect(def.httpStatus).toBe(502)
      expect(def.retryable).toBe(true)
    })
  })

  describe('validatePublicErrorTuple', () => {
    it('有效的 429 错误 tuple 通过', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '60',
      })
      const body = {
        errCode: 'RATE_LIMITED',
        message: 'Too many requests',
      }
      const result = validatePublicErrorTuple(429, headers, body, 'json')
      expect(result.success).toBe(true)
    })

    it('状态码与 errCode 不匹配时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = {
        errCode: 'RATE_LIMITED', // 应该是 429，但状态码是 400
        message: 'Wrong status',
      }
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
    })

    it('缺少必需字段时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = {
        errCode: 'BAD_REQUEST',
        // 缺少 message
      }
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
    })

    it('RATE_LIMITED 缺少 Retry-After header 时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = {
        errCode: 'RATE_LIMITED',
        message: 'Too many requests',
      }
      const result = validatePublicErrorTuple(429, headers, body, 'json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Retry-After')
      }
    })

    it('RATE_LIMITED Retry-After 超出范围时失败', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '1000', // 超过 900
      })
      const body = {
        errCode: 'RATE_LIMITED',
        message: 'Too many requests',
      }
      const result = validatePublicErrorTuple(429, headers, body, 'json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('900')
      }
    })

    it('PROVIDER_ERROR Retry-After 必须是固定值 5', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '10', // 应该是 5
      })
      const body = {
        errCode: 'PROVIDER_ERROR',
        message: 'Provider failed',
      }
      const result = validatePublicErrorTuple(502, headers, body, 'json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('5')
      }
    })

    it('BAD_REQUEST 不应有 Retry-After header', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '60',
      })
      const body = {
        errCode: 'BAD_REQUEST',
        message: 'Bad request',
      }
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('should not have')
      }
    })
  })
})

describe('SSE Trace 校验', () => {
  describe('validateSseTrace', () => {
    it('有效的 SSE trace 通过', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'delta', id: '2', data: { content: 'Hello' } },
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })

    it('start 不是第一个事件时失败', () => {
      const frames: SseFrame[] = [
        { event: 'delta', id: '1', data: { content: 'Hello' } },
        { event: 'start', id: '2', data: { chatId: 'abc' } },
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('start')
      }
    })

    it('缺少 terminal 事件时失败', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'delta', id: '2', data: { content: 'Hello' } },
        // 缺少 done 或 error
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('terminal')
      }
    })

    it('eventId 非单调递增时失败', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'delta', id: '3', data: { content: 'Hello' } },
        { event: 'delta', id: '2', data: { content: 'World' } }, // 非单调
        { event: 'done', id: '4', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('monotonic')
      }
    })

    it('tool lifecycle: running -> completed', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'tool-status', id: '2', data: { toolCallId: 't1', status: 'running' } },
        { event: 'tool-status', id: '3', data: { toolCallId: 't1', status: 'completed' } },
        { event: 'done', id: '4', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })

    it('tool lifecycle: completed 没有先 running 时失败', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'tool-status', id: '2', data: { toolCallId: 't1', status: 'completed' } }, // 没有 running
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('lifecycle')
      }
    })

    it('confirmation-required pending 状态必须有 token', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        { event: 'confirmation-required', id: '2', data: { state: 'pending' } }, // 缺少 token
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('confirmationToken')
      }
    })

    it('confirmation-required expired 状态不能有 token', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        {
          event: 'confirmation-required',
          id: '2',
          data: { state: 'expired', confirmationToken: 'should-not-exist' },
        },
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('must not have')
      }
    })

    it('confirmation-required pending 状态有 token 时通过', () => {
      const frames: SseFrame[] = [
        { event: 'start', id: '1', data: { chatId: 'abc' } },
        {
          event: 'confirmation-required',
          id: '2',
          data: { state: 'pending', confirmationToken: 'valid-token' },
        },
        { event: 'done', id: '3', data: {} },
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })
  })
})

describe('不变量校验', () => {
  describe('validateInvariant', () => {
    it('WEEK_START_IS_MONDAY: 周一日期通过', () => {
      // 2026-07-27 是周一
      const result = validateInvariant('WEEK_START_IS_MONDAY', '2026-07-27')
      expect(result.success).toBe(true)
    })

    it('WEEK_START_IS_MONDAY: 非周一日期失败', () => {
      // 2026-07-26 是周日
      const result = validateInvariant('WEEK_START_IS_MONDAY', '2026-07-26')
      expect(result.success).toBe(false)
    })

    it('WEEKLY_PLAN_HAS_21_SLOTS: 21 个 slot 通过', () => {
      const items = Array(21)
        .fill(null)
        .map((_, i) => ({ slotIndex: i }))
      const result = validateInvariant('WEEKLY_PLAN_HAS_21_SLOTS', { items })
      expect(result.success).toBe(true)
    })

    it('WEEKLY_PLAN_HAS_21_SLOTS: 非 21 个 slot 失败', () => {
      const items = Array(20)
        .fill(null)
        .map((_, i) => ({ slotIndex: i }))
      const result = validateInvariant('WEEKLY_PLAN_HAS_21_SLOTS', { items })
      expect(result.success).toBe(false)
    })

    it('SERVER_VERSION_WITHIN_DB_BIGINT: 有效范围通过', () => {
      const result = validateInvariant('SERVER_VERSION_WITHIN_DB_BIGINT', '9007199254740993')
      expect(result.success).toBe(true)
    })

    it('SERVER_VERSION_WITHIN_DB_BIGINT: 超出范围失败', () => {
      // 超过 DB bigint 上限
      const result = validateInvariant('SERVER_VERSION_WITHIN_DB_BIGINT', '9223372036854775808')
      expect(result.success).toBe(false)
    })
  })
})
