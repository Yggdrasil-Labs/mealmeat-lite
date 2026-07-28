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
import { invariants } from './generated/catalogs.js'
import { validateInvariant } from './invariants.js'
import { type SseFrame, validateSseTrace } from './sse-trace.js'

function publicErrorBody(errCode: string, errMessage: string, retryable: boolean) {
  return {
    success: false,
    errCode,
    errMessage,
    requestId: 'request-1',
    retryable,
  }
}

function publicSseErrorBody(errCode: string, errMessage: string, retryable: boolean) {
  return {
    errCode,
    errMessage,
    requestId: 'request-1',
    retryable,
  }
}

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
      const body = publicErrorBody('RATE_LIMITED', 'Too many requests', true)
      const result = validatePublicErrorTuple(429, headers, body, 'json')
      expect(result.success).toBe(true)
    })

    it('状态码与 errCode 不匹配时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = publicErrorBody('RATE_LIMITED', 'Wrong status', true) // 应该是 429，但状态码是 400
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
    })

    it('缺少必需字段时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = {
        success: false,
        errCode: 'BAD_REQUEST',
        errMessage: 'Bad request',
        requestId: 'request-1',
        // 缺少 retryable
      }
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
    })

    it('RATE_LIMITED 缺少 Retry-After header 时失败', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = publicErrorBody('RATE_LIMITED', 'Too many requests', true)
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
      const body = publicErrorBody('RATE_LIMITED', 'Too many requests', true)
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
      const body = publicErrorBody('PROVIDER_ERROR', 'Provider failed', true)
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
      const body = publicErrorBody('BAD_REQUEST', 'Bad request', false)
      const result = validatePublicErrorTuple(400, headers, body, 'json')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('should not have')
      }
    })

    it('retryable 必须与生成错误目录一致', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const body = publicErrorBody('BAD_REQUEST', 'Bad request', true)
      const result = validatePublicErrorTuple(400, headers, body, 'json')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('retryable')
      }
    })

    it('SSE 使用其独立 error payload schema 且仍校验错误目录', () => {
      const headers = new Headers({ 'Content-Type': 'text/event-stream' })
      const valid = validatePublicErrorTuple(
        400,
        headers,
        publicSseErrorBody('BAD_REQUEST', 'Bad request', false),
        'sse',
      )
      expect(valid.success).toBe(true)

      const wrongChannel = validatePublicErrorTuple(
        429,
        headers,
        publicSseErrorBody('RATE_LIMITED', 'Too many requests', true),
        'sse',
      )
      expect(wrongChannel.success).toBe(false)
    })
  })
})

describe('SSE Trace 校验', () => {
  const chatRequestId = '550e8400-e29b-41d4-a716-446655440000'
  const confirmationId = '660e8400-e29b-41d4-a716-446655440000'

  const startFrame = (eventId = '1', overrides: Record<string, unknown> = {}): SseFrame => ({
    event: 'start',
    eventId,
    data: { chatRequestId, replayed: false, resumed: false, ...overrides },
  })
  const deltaFrame = (eventId = '2', data: unknown = { text: 'Hello' }): SseFrame => ({
    event: 'delta',
    eventId,
    data,
  })
  const doneFrame = (eventId = '3'): SseFrame => ({
    event: 'done',
    eventId,
    data: { chatRequestId },
  })

  describe('validateSseTrace', () => {
    it('有效的 SSE trace 通过', () => {
      const frames: SseFrame[] = [startFrame(), deltaFrame(), doneFrame()]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })

    it('start 不是第一个事件时失败', () => {
      const frames: SseFrame[] = [deltaFrame('1'), startFrame('2'), doneFrame('3')]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('start')
      }
    })

    it('缺少 terminal 事件时失败', () => {
      const frames: SseFrame[] = [
        startFrame(),
        deltaFrame(),
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
        startFrame('1'),
        deltaFrame('3'),
        deltaFrame('2', { text: 'World' }), // 非单调
        doneFrame('4'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('monotonic')
      }
    })

    it('tool lifecycle: started -> succeeded', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'tool-status',
          eventId: '2',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'started' },
        },
        {
          event: 'tool-status',
          eventId: '3',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'succeeded' },
        },
        doneFrame('4'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })

    it('tool lifecycle: succeeded 没有先 started 时失败', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'tool-status',
          eventId: '2',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'succeeded' },
        },
        doneFrame('3'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('lifecycle')
      }
    })

    it('tool lifecycle: terminal 前未闭合时失败', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'tool-status',
          eventId: '2',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'started' },
        },
        doneFrame('3'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Unclosed')
      }
    })

    it('confirmation-required pending 状态必须有 token', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'confirmation-required',
          eventId: '2',
          data: {
            confirmationId,
            kind: 'recipe_batch',
            state: 'pending',
            expiresAt: '2026-07-28T12:00:00Z',
            preview: { items: [{ name: '红烧肉' }], skippedDuplicates: [] },
          },
        },
        doneFrame('3'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('confirmationToken')
      }
    })

    it('confirmation-required expired 状态不能有 token', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'confirmation-required',
          eventId: '2',
          data: {
            confirmationId,
            kind: 'recipe_batch',
            state: 'expired',
            expiresAt: '2026-07-28T12:00:00Z',
            confirmationToken: 'should-not-exist',
            preview: { items: [{ name: '红烧肉' }], skippedDuplicates: [] },
          },
        },
        doneFrame('3'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('must not have')
      }
    })

    it('confirmation-required pending 状态有 token 时通过', () => {
      const frames: SseFrame[] = [
        startFrame(),
        {
          event: 'confirmation-required',
          eventId: '2',
          data: {
            confirmationId,
            kind: 'recipe_batch',
            state: 'pending',
            expiresAt: '2026-07-28T12:00:00Z',
            confirmationToken: 'valid-token',
            preview: { items: [{ name: '红烧肉' }], skippedDuplicates: [] },
          },
        },
        doneFrame('3'),
      ]
      const result = validateSseTrace(frames)
      expect(result.success).toBe(true)
    })

    it('eventId 必须从 1 开始且为纯十进制整数', () => {
      expect(validateSseTrace([startFrame('2'), doneFrame('3')]).success).toBe(false)
      expect(validateSseTrace([startFrame('1x'), doneFrame('2')]).success).toBe(false)
    })

    it('拒绝未知事件、重复 start 和不合法的事件 data', () => {
      expect(
        validateSseTrace([
          startFrame(),
          { event: 'unknown', eventId: '2', data: {} },
          doneFrame('3'),
        ]),
      ).toMatchObject({ success: false })
      expect(validateSseTrace([startFrame(), startFrame('2'), doneFrame('3')])).toMatchObject({
        success: false,
      })
      expect(
        validateSseTrace([startFrame(), deltaFrame('2', { content: 'wrong' }), doneFrame('3')]),
      ).toMatchObject({ success: false })
    })

    it('拒绝旧 tool status、重复终态及 replay/resume 冲突', () => {
      const legacyStatus = [
        startFrame(),
        {
          event: 'tool-status',
          eventId: '2',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'running' },
        },
        doneFrame('3'),
      ]
      const duplicateTerminal = [
        startFrame(),
        {
          event: 'tool-status',
          eventId: '2',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'started' },
        },
        {
          event: 'tool-status',
          eventId: '3',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'succeeded' },
        },
        {
          event: 'tool-status',
          eventId: '4',
          data: { toolCallId: 't1', toolName: 'add_recipe', status: 'failed' },
        },
        doneFrame('5'),
      ]

      expect(validateSseTrace(legacyStatus)).toMatchObject({ success: false })
      expect(validateSseTrace(duplicateTerminal)).toMatchObject({ success: false })
      expect(
        validateSseTrace([startFrame('1', { replayed: true, resumed: true }), doneFrame('2')]),
      ).toMatchObject({ success: false })
    })

    it('SSE error 必须满足已登记错误目录', () => {
      const validTrace = [
        startFrame(),
        {
          event: 'error',
          eventId: '2',
          data: publicSseErrorBody('BAD_REQUEST', 'Bad request', false),
        },
      ]
      expect(validateSseTrace(validTrace).success).toBe(true)

      expect(
        validateSseTrace([
          startFrame(),
          {
            event: 'error',
            eventId: '2',
            data: publicSseErrorBody('UNKNOWN_ERROR', 'Unknown', false),
          },
        ]).success,
      ).toBe(false)
      expect(
        validateSseTrace([
          startFrame(),
          {
            event: 'error',
            eventId: '2',
            data: publicSseErrorBody('RATE_LIMITED', 'Too many requests', true),
          },
        ]).success,
      ).toBe(false)
      expect(
        validateSseTrace([
          startFrame(),
          {
            event: 'error',
            eventId: '2',
            data: publicSseErrorBody('BAD_REQUEST', 'Bad request', true),
          },
        ]).success,
      ).toBe(false)
      expect(
        validateSseTrace([
          startFrame(),
          {
            event: 'error',
            eventId: '2',
            data: { ...publicSseErrorBody('BAD_REQUEST', 'Bad request', false), requestId: '' },
          },
        ]).success,
      ).toBe(false)
    })
  })
})

describe('不变量校验', () => {
  it('生成的不变量 corpus 在 Server 解释器中具有一致的正反结果', () => {
    const generatedInvariants = invariants as ReadonlyArray<{
      id: Parameters<typeof validateInvariant>[0]
      vectors: { valid: readonly unknown[]; invalid: readonly unknown[] }
    }>

    for (const invariant of generatedInvariants) {
      expect(invariant.vectors.valid, `${invariant.id} needs valid vectors`).not.toHaveLength(0)
      expect(invariant.vectors.invalid, `${invariant.id} needs invalid vectors`).not.toHaveLength(0)
      for (const value of invariant.vectors.valid) {
        expect(validateInvariant(invariant.id, value).success, `${invariant.id} valid vector`).toBe(
          true,
        )
      }
      for (const value of invariant.vectors.invalid) {
        expect(
          validateInvariant(invariant.id, value).success,
          `${invariant.id} invalid vector`,
        ).toBe(false)
      }
    }
  })

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
