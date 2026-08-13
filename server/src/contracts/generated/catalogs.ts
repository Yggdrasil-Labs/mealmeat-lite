/**
 * 协议目录 - 由 compile.ts 生成，禁止手改
 * @generated
 */

const protocolCatalog = {
  "errors": [
    {
      "errCode": "BAD_REQUEST",
      "httpStatus": 400,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "INVALID_CURSOR",
      "httpStatus": 400,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "UNAUTHORIZED",
      "httpStatus": 401,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "INVALID_BOOTSTRAP_SECRET",
      "httpStatus": 401,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "INVALID_FAMILY_CODE",
      "httpStatus": 401,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "RECIPE_NOT_FOUND",
      "httpStatus": 404,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "PLAN_NOT_FOUND",
      "httpStatus": 404,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "DEVICE_NOT_FOUND",
      "httpStatus": 404,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CONFIRMATION_NOT_FOUND",
      "httpStatus": 404,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CHAT_REQUEST_EXPIRED",
      "httpStatus": 410,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CONFIRMATION_EXPIRED",
      "httpStatus": 410,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "ALREADY_INITIALIZED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "NOT_INITIALIZED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "IDEMPOTENCY_KEY_REUSED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "RECIPE_DELETED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "CHAT_REQUEST_SUPERSEDED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CONFIRMATION_CONSUMED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CONFIRMATION_SUPERSEDED",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "CONFIRMATION_STALE",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "RECIPE_IN_USE",
      "httpStatus": 409,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "CHAT_IN_PROGRESS",
      "httpStatus": 409,
      "retryable": true,
      "retryAfter": {
        "kind": "range",
        "minSeconds": 1,
        "maxSeconds": 30
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "CHAT_DEVICE_BUSY",
      "httpStatus": 409,
      "retryable": true,
      "retryAfter": {
        "kind": "range",
        "minSeconds": 1,
        "maxSeconds": 30
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "VALIDATION_ERROR",
      "httpStatus": 422,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "INVALID_WEEK_START",
      "httpStatus": 422,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "MODEL_UNAVAILABLE",
      "httpStatus": 422,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "NO_NEW_RECIPES",
      "httpStatus": 422,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "sse"
      ]
    },
    {
      "errCode": "RATE_LIMITED",
      "httpStatus": 429,
      "retryable": true,
      "retryAfter": {
        "kind": "range",
        "minSeconds": 1,
        "maxSeconds": 900
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "INTERNAL_ERROR",
      "httpStatus": 500,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "SYNC_CHANGE_TOO_LARGE",
      "httpStatus": 500,
      "retryable": false,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "PROVIDER_ERROR",
      "httpStatus": 502,
      "retryable": true,
      "retryAfter": {
        "kind": "fixed",
        "seconds": 5
      },
      "channels": [
        "json",
        "sse"
      ]
    },
    {
      "errCode": "NOT_READY",
      "httpStatus": 503,
      "retryable": true,
      "retryAfter": {
        "kind": "fixed",
        "seconds": 5
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "SERVICE_BUSY",
      "httpStatus": 503,
      "retryable": true,
      "retryAfter": {
        "kind": "fixed",
        "seconds": 1
      },
      "channels": [
        "json"
      ]
    },
    {
      "errCode": "MODEL_TIMEOUT",
      "httpStatus": 504,
      "retryable": true,
      "retryAfter": {
        "kind": "none"
      },
      "channels": [
        "json",
        "sse"
      ]
    }
  ],
  "sseEvents": [
    {
      "event": "start",
      "schemaId": "SseStartEvent",
      "isStart": true,
      "isTerminal": false,
      "nextEvents": [
        "delta",
        "tool-status",
        "confirmation-required",
        "error",
        "done"
      ],
      "mutuallyExclusiveDataFields": [
        "replayed",
        "resumed"
      ]
    },
    {
      "event": "delta",
      "schemaId": "SseDeltaEvent",
      "isStart": false,
      "isTerminal": false,
      "nextEvents": [
        "delta",
        "tool-status",
        "confirmation-required",
        "error",
        "done"
      ]
    },
    {
      "event": "tool-status",
      "schemaId": "SseToolStatusEvent",
      "isStart": false,
      "isTerminal": false,
      "nextEvents": [
        "delta",
        "tool-status",
        "confirmation-required",
        "error",
        "done"
      ],
      "toolLifecycle": {
        "idField": "toolCallId",
        "statusField": "status",
        "startedStatus": "started",
        "terminalStatuses": [
          "succeeded",
          "failed"
        ]
      }
    },
    {
      "event": "confirmation-required",
      "schemaId": "SseConfirmationRequiredEvent",
      "isStart": false,
      "isTerminal": false,
      "nextEvents": [
        "delta",
        "tool-status",
        "confirmation-required",
        "error",
        "done"
      ],
      "confirmationToken": {
        "stateField": "state",
        "tokenField": "confirmationToken",
        "tokenRequiredState": "pending",
        "tokenForbiddenStates": [
          "expired",
          "superseded",
          "consumed"
        ]
      }
    },
    {
      "event": "error",
      "schemaId": "SseErrorEvent",
      "isStart": false,
      "isTerminal": true,
      "nextEvents": [],
      "errorCatalog": {
        "errCodeField": "errCode",
        "retryableField": "retryable",
        "requestIdField": "requestId"
      }
    },
    {
      "event": "done",
      "schemaId": "SseDoneEvent",
      "isStart": false,
      "isTerminal": true,
      "nextEvents": []
    }
  ],
  "invariants": [
    {
      "id": "WEEK_START_IS_MONDAY",
      "appliesTo": [
        "WeeklyPlanView",
        "GenerateWeeklyPlanInput"
      ],
      "owners": [
        "server",
        "android",
        "database"
      ],
      "vectors": {
        "valid": [
          "2026-07-27"
        ],
        "invalid": [
          "2026-07-26",
          "not-a-date"
        ]
      }
    },
    {
      "id": "WEEKLY_PLAN_HAS_21_SLOTS",
      "appliesTo": [
        "WeeklyPlanView",
        "GenerateWeeklyPlanInput"
      ],
      "owners": [
        "server",
        "android"
      ],
      "vectors": {
        "valid": [
          {
            "items": [
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null
            ]
          }
        ],
        "invalid": [
          {
            "items": []
          },
          21,
          {
            "items": 21
          }
        ]
      }
    },
    {
      "id": "SYNC_RESULTS_PRESERVE_INPUT_ORDER",
      "appliesTo": [
        "SyncActionsResponse"
      ],
      "owners": [
        "server",
        "android"
      ],
      "vectors": {
        "valid": [
          {
            "inputActionIds": [
              "a",
              "b"
            ],
            "resultActionIds": [
              "a",
              "b"
            ]
          }
        ],
        "invalid": [
          {
            "inputActionIds": [
              "a",
              "b"
            ],
            "resultActionIds": [
              "b",
              "a"
            ]
          },
          {
            "inputActionIds": [
              "a"
            ],
            "resultActionIds": [
              "a",
              "b"
            ]
          }
        ]
      }
    },
    {
      "id": "SERVER_VERSION_WITHIN_DB_BIGINT",
      "appliesTo": [
        "ServerVersion"
      ],
      "owners": [
        "server",
        "android",
        "database"
      ],
      "vectors": {
        "valid": [
          "1",
          "9223372036854775807"
        ],
        "invalid": [
          "0",
          "9223372036854775808",
          "01"
        ]
      }
    },
    {
      "id": "CONFIRMATION_STATE_FIELDS_MATCH",
      "appliesTo": [
        "ConfirmationEventDto"
      ],
      "owners": [
        "server",
        "android"
      ],
      "vectors": {
        "valid": [
          {
            "state": "pending",
            "confirmationToken": "token-1"
          },
          {
            "state": "expired"
          }
        ],
        "invalid": [
          {
            "state": "pending"
          },
          {
            "state": "consumed",
            "confirmationToken": "token-1"
          },
          {
            "state": "unknown"
          }
        ]
      }
    }
  ]
} as const
import type { InvariantDefinition, PublicErrorDefinition, SseEventDescriptor } from '../types.js'

/** 错误定义 */
export const errors = protocolCatalog.errors as unknown as readonly PublicErrorDefinition[]
export type ErrorEntry = PublicErrorDefinition
export type PublicErrorCode = PublicErrorDefinition['errCode']

/** SSE 事件定义 */
export const sseEvents = protocolCatalog.sseEvents as unknown as readonly SseEventDescriptor[]
export type SseEventEntry = (typeof sseEvents)[number]
export type SseEventName = SseEventEntry['event']

/** 不变量定义 */
export const invariants = protocolCatalog.invariants as unknown as readonly InvariantDefinition[]
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
