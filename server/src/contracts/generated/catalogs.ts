/**
 * 协议目录 - 由 compile.ts 生成，禁止手改
 * @generated
 */

import protocolCatalog from '../../../../contracts/v1/generated/protocol-catalog.json' with {
  type: 'json',
}
import type { InvariantDefinition, PublicErrorDefinition, SseEventDescriptor } from '../types.js'

/** 错误定义 */
export const errors = protocolCatalog.errors as readonly PublicErrorDefinition[]
export type ErrorEntry = PublicErrorDefinition
export type PublicErrorCode = PublicErrorDefinition['errCode']

/** SSE 事件定义 */
export const sseEvents = protocolCatalog.sseEvents as readonly SseEventDescriptor[]
export type SseEventEntry = (typeof sseEvents)[number]
export type SseEventName = SseEventEntry['event']

/** 不变量定义 */
export const invariants = protocolCatalog.invariants as readonly InvariantDefinition[]
export type InvariantEntry = (typeof invariants)[number]
export type InvariantId = InvariantEntry['id']

/** 错误码到定义的映射 */
export const errorMap = new Map<string, PublicErrorDefinition>(errors.map((e) => [e.errCode, e]))

/** SSE 事件到定义的映射 */
export const sseEventMap = new Map<string, SseEventDescriptor>(
  sseEvents.map((event) => [event.event, event]),
)

/** 不变量到定义的映射 */
export const invariantMap = new Map(invariants.map((i) => [i.id, i]))
