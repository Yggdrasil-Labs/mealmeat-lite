/**
 * Schema 常量与类型 - 由 compile.ts 生成，禁止手改
 * @generated
 */

import type { FromSchema } from 'json-schema-to-ts'
import manifest from '../../../../contracts/v1/generated/manifest.json' with { type: 'json' }

// ============================================================================
// Schema 文件列表
// ============================================================================

export const SCHEMA_FILES = [
  'auth.schema.json',
  'chat.schema.json',
  'common.schema.json',
  'plan.schema.json',
  'recipe.schema.json',
  'settings.schema.json',
  'sync.schema.json',
] as const

export type SchemaFileName = (typeof SCHEMA_FILES)[number]

// ============================================================================
// Manifest Re-exports
// ============================================================================

export const schemas = manifest.schemas
export const functionToolMap = new Map(manifest.functionTools.map((f) => [f.name, f]))
export const schemaFileMap = new Map(schemas.map((s) => [s.id, s.file]))

// ============================================================================
// 展开的 Schema 常量 (as const)
// ============================================================================

export const AddRecipeInputSchema = {
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 30
      },
      "maxItems": 20
    },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 200
      },
      "maxItems": 100
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "maxItems": 100
    },
    "imageUrl": {
      "type": "string",
      "format": "uri"
    },
    "notes": {
      "type": "string",
      "maxLength": 5000
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
} as const

export const AddRecipeOutputSchema = {
  "type": "object",
  "properties": {
    "recipe": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "name": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "imageUrl": {
          "type": "string",
          "format": "uri"
        },
        "notes": {
          "type": "string"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "name",
        "tags",
        "ingredients",
        "steps",
        "serverVersion",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "recipe"
  ],
  "additionalProperties": false
} as const

export const AppliedResultDtoSchema = {
  "type": "object",
  "properties": {
    "status": {
      "const": "applied"
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    },
    "resource": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "name": {
              "type": "string"
            },
            "tags": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "ingredients": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "steps": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "imageUrl": {
              "type": "string",
              "format": "uri"
            },
            "notes": {
              "type": "string"
            },
            "serverVersion": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$",
              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            }
          },
          "required": [
            "id",
            "name",
            "tags",
            "ingredients",
            "steps",
            "serverVersion",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "deletedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            },
            "serverVersion": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$",
              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
            }
          },
          "required": [
            "id",
            "deletedAt",
            "serverVersion"
          ],
          "additionalProperties": false
        }
      ]
    }
  },
  "required": [
    "status",
    "serverVersion",
    "resource"
  ],
  "additionalProperties": false
} as const

export const BatchGenerateRecipesInputSchema = {
  "type": "object",
  "properties": {
    "recipes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 30
            },
            "maxItems": 20
          },
          "ingredients": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 200
            },
            "maxItems": 100
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 1000
            },
            "maxItems": 100
          },
          "imageUrl": {
            "type": "string",
            "format": "uri"
          },
          "notes": {
            "type": "string",
            "maxLength": 5000
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 50
    }
  },
  "required": [
    "recipes"
  ],
  "additionalProperties": false
} as const

export const BatchGenerateRecipesOutputSchema = {
  "type": "object",
  "properties": {
    "confirmationRequired": {
      "type": "boolean",
      "const": true
    },
    "count": {
      "type": "integer",
      "minimum": 1
    },
    "skippedDuplicates": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    }
  },
  "required": [
    "confirmationRequired",
    "count",
    "skippedDuplicates",
    "expiresAt"
  ],
  "additionalProperties": false
} as const

export const BootstrapRequestSchema = {
  "type": "object",
  "properties": {
    "bootstrapSecret": {
      "type": "string",
      "minLength": 1
    },
    "deviceName": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    }
  },
  "required": [
    "bootstrapSecret",
    "deviceName"
  ],
  "additionalProperties": false
} as const

export const BootstrapResponseSchema = {
  "type": "object",
  "properties": {
    "deviceId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "deviceToken": {
      "type": "string"
    },
    "familyCode": {
      "type": "string"
    }
  },
  "required": [
    "deviceId",
    "deviceToken",
    "familyCode"
  ],
  "additionalProperties": false
} as const

export const ChatHistoryResponseSchema = {
  "type": "object",
  "properties": {
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": {
            "type": "string",
            "enum": [
              "user",
              "assistant"
            ]
          },
          "content": {
            "type": "string"
          },
          "chatRequestId": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          }
        },
        "required": [
          "role",
          "content",
          "chatRequestId",
          "createdAt"
        ],
        "additionalProperties": false
      },
      "maxItems": 40
    }
  },
  "required": [
    "messages"
  ],
  "additionalProperties": false
} as const

export const ChatMessageSchema = {
  "type": "object",
  "properties": {
    "role": {
      "type": "string",
      "enum": [
        "user",
        "assistant"
      ]
    },
    "content": {
      "type": "string"
    },
    "chatRequestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    }
  },
  "required": [
    "role",
    "content",
    "chatRequestId",
    "createdAt"
  ],
  "additionalProperties": false
} as const

export const ChatRequestSchema = {
  "type": "object",
  "properties": {
    "chatRequestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "modelId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    }
  },
  "required": [
    "chatRequestId",
    "modelId",
    "message"
  ],
  "additionalProperties": false
} as const

export const ClearPatchSchema = {
  "type": "object",
  "properties": {
    "op": {
      "const": "clear"
    }
  },
  "required": [
    "op"
  ],
  "additionalProperties": false
} as const

export const ConfirmationCommitRequestSchema = {
  "type": "object",
  "properties": {
    "confirmationToken": {
      "type": "string"
    },
    "commitActionId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    }
  },
  "required": [
    "confirmationToken",
    "commitActionId"
  ],
  "additionalProperties": false
} as const

export const ConfirmationCommitResultDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "kind": {
          "const": "recipe_batch"
        },
        "changes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "recipe"
              },
              "operation": {
                "const": "upsert"
              },
              "data": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "name": {
                    "type": "string"
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string"
                  },
                  "serverVersion": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  }
                },
                "required": [
                  "id",
                  "name",
                  "tags",
                  "ingredients",
                  "steps",
                  "serverVersion",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 50
        }
      },
      "required": [
        "kind",
        "changes"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "kind": {
          "const": "weekly_plan_replace"
        },
        "changes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "weekly_plan"
              },
              "operation": {
                "const": "upsert"
              },
              "data": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "weekStart": {
                    "type": "string",
                    "format": "date",
                    "description": "必须是周一的 ISO 日期"
                  },
                  "serverVersion": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                  },
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "date": {
                          "type": "string",
                          "format": "date",
                          "description": "ISO 日期 YYYY-MM-DD"
                        },
                        "mealType": {
                          "type": "string",
                          "enum": [
                            "breakfast",
                            "lunch",
                            "dinner"
                          ],
                          "description": "餐次类型"
                        },
                        "recipeId": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "recipeNameSnapshot": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "id",
                        "date",
                        "mealType",
                        "recipeId",
                        "recipeNameSnapshot"
                      ],
                      "additionalProperties": false
                    },
                    "minItems": 21,
                    "maxItems": 21
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  }
                },
                "required": [
                  "id",
                  "weekStart",
                  "serverVersion",
                  "items",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 1
        }
      },
      "required": [
        "kind",
        "changes"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const ConfirmationEventDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "recipe_batch"
        },
        "state": {
          "const": "pending"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "confirmationToken": {
          "type": "string"
        },
        "preview": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 30
                    },
                    "maxItems": 20
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 200
                    },
                    "maxItems": 100
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 1000
                    },
                    "maxItems": 100
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string",
                    "maxLength": 5000
                  }
                },
                "required": [
                  "name"
                ],
                "additionalProperties": false
              },
              "minItems": 1,
              "maxItems": 50
            },
            "skippedDuplicates": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "items",
            "skippedDuplicates"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "confirmationToken",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "recipe_batch"
        },
        "state": {
          "type": "string",
          "enum": [
            "expired",
            "superseded",
            "consumed"
          ]
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "preview": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 30
                    },
                    "maxItems": 20
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 200
                    },
                    "maxItems": 100
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 1000
                    },
                    "maxItems": 100
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string",
                    "maxLength": 5000
                  }
                },
                "required": [
                  "name"
                ],
                "additionalProperties": false
              },
              "minItems": 1,
              "maxItems": 50
            },
            "skippedDuplicates": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "items",
            "skippedDuplicates"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "weekly_plan_replace"
        },
        "state": {
          "const": "pending"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "confirmationToken": {
          "type": "string"
        },
        "preview": {
          "type": "object",
          "properties": {
            "weekStart": {
              "type": "string",
              "format": "date",
              "description": "必须是周一的 ISO 日期"
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "date": {
                    "type": "string",
                    "format": "date",
                    "description": "ISO 日期 YYYY-MM-DD"
                  },
                  "mealType": {
                    "type": "string",
                    "enum": [
                      "breakfast",
                      "lunch",
                      "dinner"
                    ],
                    "description": "餐次类型"
                  },
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "recipeNameSnapshot": {
                    "type": "string"
                  }
                },
                "required": [
                  "date",
                  "mealType",
                  "recipeId",
                  "recipeNameSnapshot"
                ],
                "additionalProperties": false
              },
              "minItems": 21,
              "maxItems": 21
            }
          },
          "required": [
            "weekStart",
            "items"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "confirmationToken",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "weekly_plan_replace"
        },
        "state": {
          "type": "string",
          "enum": [
            "expired",
            "superseded",
            "consumed"
          ]
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "preview": {
          "type": "object",
          "properties": {
            "weekStart": {
              "type": "string",
              "format": "date",
              "description": "必须是周一的 ISO 日期"
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "date": {
                    "type": "string",
                    "format": "date",
                    "description": "ISO 日期 YYYY-MM-DD"
                  },
                  "mealType": {
                    "type": "string",
                    "enum": [
                      "breakfast",
                      "lunch",
                      "dinner"
                    ],
                    "description": "餐次类型"
                  },
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "recipeNameSnapshot": {
                    "type": "string"
                  }
                },
                "required": [
                  "date",
                  "mealType",
                  "recipeId",
                  "recipeNameSnapshot"
                ],
                "additionalProperties": false
              },
              "minItems": 21,
              "maxItems": 21
            }
          },
          "required": [
            "weekStart",
            "items"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "preview"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const CurrentWeeklyPlanResponseSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "weekStart": {
          "type": "string",
          "format": "date",
          "description": "必须是周一的 ISO 日期"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "date": {
                "type": "string",
                "format": "date",
                "description": "ISO 日期 YYYY-MM-DD"
              },
              "mealType": {
                "type": "string",
                "enum": [
                  "breakfast",
                  "lunch",
                  "dinner"
                ],
                "description": "餐次类型"
              },
              "recipeId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "recipeNameSnapshot": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "date",
              "mealType",
              "recipeId",
              "recipeNameSnapshot"
            ],
            "additionalProperties": false
          },
          "minItems": 21,
          "maxItems": 21
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "weekStart",
        "serverVersion",
        "items",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    {
      "type": "null"
    }
  ]
} as const

export const DeleteRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    }
  },
  "required": [
    "recipeId"
  ],
  "additionalProperties": false
} as const

export const DeleteRecipeOutputSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "deletedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    }
  },
  "required": [
    "id",
    "deletedAt",
    "serverVersion"
  ],
  "additionalProperties": false
} as const

export const DeviceListResponseSchema = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "deviceName": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          },
          "lastUsedAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          },
          "isCurrent": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "deviceName",
          "createdAt",
          "lastUsedAt",
          "isCurrent"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "items"
  ],
  "additionalProperties": false
} as const

export const DeviceViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "deviceName": {
      "type": "string"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "lastUsedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "isCurrent": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "deviceName",
    "createdAt",
    "lastUsedAt",
    "isCurrent"
  ],
  "additionalProperties": false
} as const

export const ErrorResponseSchema = {
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "const": false
    },
    "errCode": {
      "type": "string"
    },
    "errMessage": {
      "type": "string"
    },
    "requestId": {
      "type": "string",
      "minLength": 1
    },
    "retryable": {
      "type": "boolean"
    },
    "details": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "reason"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "success",
    "errCode",
    "errMessage",
    "requestId",
    "retryable"
  ],
  "additionalProperties": false
} as const

export const GenerateWeeklyPlanInputSchema = {
  "type": "object",
  "properties": {
    "weekStart": {
      "type": "string",
      "format": "date",
      "description": "必须是周一的 ISO 日期"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "format": "date",
            "description": "ISO 日期 YYYY-MM-DD"
          },
          "mealType": {
            "type": "string",
            "enum": [
              "breakfast",
              "lunch",
              "dinner"
            ],
            "description": "餐次类型"
          },
          "recipeId": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          }
        },
        "required": [
          "date",
          "mealType",
          "recipeId"
        ],
        "additionalProperties": false
      },
      "minItems": 21,
      "maxItems": 21
    }
  },
  "required": [
    "weekStart",
    "items"
  ],
  "additionalProperties": false
} as const

export const GenerateWeeklyPlanOutputSchema = {
  "type": "object",
  "properties": {
    "plan": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "weekStart": {
          "type": "string",
          "format": "date",
          "description": "必须是周一的 ISO 日期"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "date": {
                "type": "string",
                "format": "date",
                "description": "ISO 日期 YYYY-MM-DD"
              },
              "mealType": {
                "type": "string",
                "enum": [
                  "breakfast",
                  "lunch",
                  "dinner"
                ],
                "description": "餐次类型"
              },
              "recipeId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "recipeNameSnapshot": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "date",
              "mealType",
              "recipeId",
              "recipeNameSnapshot"
            ],
            "additionalProperties": false
          },
          "minItems": 21,
          "maxItems": 21
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "weekStart",
        "serverVersion",
        "items",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "reusedRecipeIds": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        "description": "小写 canonical UUID 格式"
      }
    }
  },
  "required": [
    "plan",
    "reusedRecipeIds"
  ],
  "additionalProperties": false
} as const

export const HealthLiveResponseSchema = {
  "type": "object",
  "properties": {
    "status": {
      "const": "ok"
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": false
} as const

export const HealthNotReadyResponseSchema = {
  "type": "object",
  "properties": {
    "status": {
      "const": "not ready"
    },
    "reason": {
      "type": "string"
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": false
} as const

export const HealthReadyResponseSchema = {
  "type": "object",
  "properties": {
    "status": {
      "const": "ready"
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": false
} as const

export const IsoDateSchema = {
  "type": "string",
  "format": "date",
  "description": "ISO 日期 YYYY-MM-DD"
} as const

export const LogoutResponseSchema = {
  "type": "object",
  "properties": {
    "revoked": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "revoked"
  ],
  "additionalProperties": false
} as const

export const MealTypeSchema = {
  "type": "string",
  "enum": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "description": "餐次类型"
} as const

export const ModelListResponseSchema = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "isDefault": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "displayName",
          "isDefault"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "items"
  ],
  "additionalProperties": false
} as const

export const ModelViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "displayName": {
      "type": "string"
    },
    "isDefault": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "displayName",
    "isDefault"
  ],
  "additionalProperties": false
} as const

export const MondayDateSchema = {
  "type": "string",
  "format": "date",
  "description": "必须是周一的 ISO 日期"
} as const

export const PlanItemViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "date": {
      "type": "string",
      "format": "date",
      "description": "ISO 日期 YYYY-MM-DD"
    },
    "mealType": {
      "type": "string",
      "enum": [
        "breakfast",
        "lunch",
        "dinner"
      ],
      "description": "餐次类型"
    },
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "recipeNameSnapshot": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "date",
    "mealType",
    "recipeId",
    "recipeNameSnapshot"
  ],
  "additionalProperties": false
} as const

export const RecipeBatchPreviewSchema = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 30
            },
            "maxItems": 20
          },
          "ingredients": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 200
            },
            "maxItems": 100
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 1000
            },
            "maxItems": 100
          },
          "imageUrl": {
            "type": "string",
            "format": "uri"
          },
          "notes": {
            "type": "string",
            "maxLength": 5000
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 50
    },
    "skippedDuplicates": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "items",
    "skippedDuplicates"
  ],
  "additionalProperties": false
} as const

export const RecipeDraftSchema = {
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 30
      },
      "maxItems": 20
    },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 200
      },
      "maxItems": 100
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "maxItems": 100
    },
    "imageUrl": {
      "type": "string",
      "format": "uri"
    },
    "notes": {
      "type": "string",
      "maxLength": 5000
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
} as const

export const RecipeListResponseSchema = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "name": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "ingredients": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "imageUrl": {
            "type": "string",
            "format": "uri"
          },
          "notes": {
            "type": "string"
          },
          "serverVersion": {
            "type": "string",
            "pattern": "^[1-9][0-9]*$",
            "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          }
        },
        "required": [
          "id",
          "name",
          "tags",
          "ingredients",
          "steps",
          "serverVersion",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "nextCursor": {
      "type": "string"
    },
    "hasMore": {
      "type": "boolean"
    }
  },
  "required": [
    "items",
    "hasMore"
  ],
  "additionalProperties": false
} as const

export const RecipePatchRequestSchema = {
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 30
      },
      "maxItems": 20
    }
  },
  "minProperties": 1,
  "additionalProperties": false
} as const

export const RecipeTombstoneSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "deletedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    }
  },
  "required": [
    "id",
    "deletedAt",
    "serverVersion"
  ],
  "additionalProperties": false
} as const

export const RecipeUpsertChangeDtoSchema = {
  "type": "object",
  "properties": {
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    },
    "resource": {
      "const": "recipe"
    },
    "operation": {
      "const": "upsert"
    },
    "data": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "name": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "imageUrl": {
          "type": "string",
          "format": "uri"
        },
        "notes": {
          "type": "string"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "name",
        "tags",
        "ingredients",
        "steps",
        "serverVersion",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "serverVersion",
    "resource",
    "operation",
    "data"
  ],
  "additionalProperties": false
} as const

export const RecipeViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "name": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "ingredients": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "imageUrl": {
      "type": "string",
      "format": "uri"
    },
    "notes": {
      "type": "string"
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    }
  },
  "required": [
    "id",
    "name",
    "tags",
    "ingredients",
    "steps",
    "serverVersion",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
} as const

export const RegisterRequestSchema = {
  "type": "object",
  "properties": {
    "familyCode": {
      "type": "string",
      "minLength": 1
    },
    "deviceName": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    }
  },
  "required": [
    "familyCode",
    "deviceName"
  ],
  "additionalProperties": false
} as const

export const RegisterResponseSchema = {
  "type": "object",
  "properties": {
    "deviceId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "deviceToken": {
      "type": "string"
    }
  },
  "required": [
    "deviceId",
    "deviceToken"
  ],
  "additionalProperties": false
} as const

export const RejectedResultDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "status": {
          "const": "rejected"
        },
        "errCode": {
          "type": "string"
        },
        "errMessage": {
          "type": "string"
        },
        "requiresFullResync": {
          "type": "boolean",
          "const": false
        },
        "authoritative": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "name": {
                  "type": "string"
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "ingredients": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "steps": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "imageUrl": {
                  "type": "string",
                  "format": "uri"
                },
                "notes": {
                  "type": "string"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                }
              },
              "required": [
                "id",
                "name",
                "tags",
                "ingredients",
                "steps",
                "serverVersion",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "deletedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                }
              },
              "required": [
                "id",
                "deletedAt",
                "serverVersion"
              ],
              "additionalProperties": false
            }
          ]
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        }
      },
      "required": [
        "status",
        "errCode",
        "errMessage",
        "requiresFullResync",
        "authoritative",
        "serverVersion"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "status": {
          "const": "rejected"
        },
        "errCode": {
          "type": "string"
        },
        "errMessage": {
          "type": "string"
        },
        "requiresFullResync": {
          "type": "boolean",
          "const": true
        }
      },
      "required": [
        "status",
        "errCode",
        "errMessage",
        "requiresFullResync"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const RestoreRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    }
  },
  "required": [
    "recipeId"
  ],
  "additionalProperties": false
} as const

export const RestoreRecipeOutputSchema = {
  "type": "object",
  "properties": {
    "recipe": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "name": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "imageUrl": {
          "type": "string",
          "format": "uri"
        },
        "notes": {
          "type": "string"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "name",
        "tags",
        "ingredients",
        "steps",
        "serverVersion",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "recipe"
  ],
  "additionalProperties": false
} as const

export const RevokeDeviceResponseSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "revoked": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "id",
    "revoked"
  ],
  "additionalProperties": false
} as const

export const Rfc3339DateTimeSchema = {
  "type": "string",
  "format": "date-time",
  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
} as const

export const RotateFamilyCodeResponseSchema = {
  "type": "object",
  "properties": {
    "familyCode": {
      "type": "string"
    }
  },
  "required": [
    "familyCode"
  ],
  "additionalProperties": false
} as const

export const SearchRecipesInputSchema = {
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "maxLength": 200
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "maxItems": 20
    },
    "includeDeleted": {
      "type": "boolean",
      "default": false
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 20
    }
  },
  "additionalProperties": false
} as const

export const SearchRecipesOutputSchema = {
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "name": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "ingredients": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "imageUrl": {
            "type": "string",
            "format": "uri"
          },
          "notes": {
            "type": "string"
          },
          "serverVersion": {
            "type": "string",
            "pattern": "^[1-9][0-9]*$",
            "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
            "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
          }
        },
        "required": [
          "id",
          "name",
          "tags",
          "ingredients",
          "steps",
          "serverVersion",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "truncated": {
      "type": "boolean"
    }
  },
  "required": [
    "items",
    "truncated"
  ],
  "additionalProperties": false
} as const

export const ServerVersionSchema = {
  "type": "string",
  "pattern": "^[1-9][0-9]*$",
  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
} as const

export const SetStringPatchSchema = {
  "type": "object",
  "properties": {
    "op": {
      "const": "set"
    },
    "value": {
      "type": "string"
    }
  },
  "required": [
    "op",
    "value"
  ],
  "additionalProperties": false
} as const

export const SettingsDtoSchema = {
  "type": "object",
  "properties": {
    "key": {
      "const": "familyPreference"
    },
    "value": {
      "type": "string",
      "maxLength": 5000
    }
  },
  "required": [
    "key",
    "value"
  ],
  "additionalProperties": false
} as const

export const SettingsResponseSchema = {
  "type": "object",
  "properties": {
    "familyPreference": {
      "type": "string",
      "maxLength": 5000
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    }
  },
  "required": [
    "familyPreference",
    "serverVersion"
  ],
  "additionalProperties": false
} as const

export const SettingsUpdateRequestSchema = {
  "type": "object",
  "properties": {
    "familyPreference": {
      "type": "string",
      "minLength": 0,
      "maxLength": 5000
    }
  },
  "required": [
    "familyPreference"
  ],
  "additionalProperties": false
} as const

export const SetUriPatchSchema = {
  "type": "object",
  "properties": {
    "op": {
      "const": "set"
    },
    "value": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "op",
    "value"
  ],
  "additionalProperties": false
} as const

export const SseConfirmationRequiredEventSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "recipe_batch"
        },
        "state": {
          "const": "pending"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "confirmationToken": {
          "type": "string"
        },
        "preview": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 30
                    },
                    "maxItems": 20
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 200
                    },
                    "maxItems": 100
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 1000
                    },
                    "maxItems": 100
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string",
                    "maxLength": 5000
                  }
                },
                "required": [
                  "name"
                ],
                "additionalProperties": false
              },
              "minItems": 1,
              "maxItems": 50
            },
            "skippedDuplicates": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "items",
            "skippedDuplicates"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "confirmationToken",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "recipe_batch"
        },
        "state": {
          "type": "string",
          "enum": [
            "expired",
            "superseded",
            "consumed"
          ]
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "preview": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 30
                    },
                    "maxItems": 20
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 200
                    },
                    "maxItems": 100
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "maxLength": 1000
                    },
                    "maxItems": 100
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string",
                    "maxLength": 5000
                  }
                },
                "required": [
                  "name"
                ],
                "additionalProperties": false
              },
              "minItems": 1,
              "maxItems": 50
            },
            "skippedDuplicates": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "items",
            "skippedDuplicates"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "weekly_plan_replace"
        },
        "state": {
          "const": "pending"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "confirmationToken": {
          "type": "string"
        },
        "preview": {
          "type": "object",
          "properties": {
            "weekStart": {
              "type": "string",
              "format": "date",
              "description": "必须是周一的 ISO 日期"
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "date": {
                    "type": "string",
                    "format": "date",
                    "description": "ISO 日期 YYYY-MM-DD"
                  },
                  "mealType": {
                    "type": "string",
                    "enum": [
                      "breakfast",
                      "lunch",
                      "dinner"
                    ],
                    "description": "餐次类型"
                  },
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "recipeNameSnapshot": {
                    "type": "string"
                  }
                },
                "required": [
                  "date",
                  "mealType",
                  "recipeId",
                  "recipeNameSnapshot"
                ],
                "additionalProperties": false
              },
              "minItems": 21,
              "maxItems": 21
            }
          },
          "required": [
            "weekStart",
            "items"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "confirmationToken",
        "preview"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "confirmationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "kind": {
          "const": "weekly_plan_replace"
        },
        "state": {
          "type": "string",
          "enum": [
            "expired",
            "superseded",
            "consumed"
          ]
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "preview": {
          "type": "object",
          "properties": {
            "weekStart": {
              "type": "string",
              "format": "date",
              "description": "必须是周一的 ISO 日期"
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "date": {
                    "type": "string",
                    "format": "date",
                    "description": "ISO 日期 YYYY-MM-DD"
                  },
                  "mealType": {
                    "type": "string",
                    "enum": [
                      "breakfast",
                      "lunch",
                      "dinner"
                    ],
                    "description": "餐次类型"
                  },
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "recipeNameSnapshot": {
                    "type": "string"
                  }
                },
                "required": [
                  "date",
                  "mealType",
                  "recipeId",
                  "recipeNameSnapshot"
                ],
                "additionalProperties": false
              },
              "minItems": 21,
              "maxItems": 21
            }
          },
          "required": [
            "weekStart",
            "items"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "confirmationId",
        "kind",
        "state",
        "expiresAt",
        "preview"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const SseDeltaEventSchema = {
  "type": "object",
  "properties": {
    "text": {
      "type": "string"
    }
  },
  "required": [
    "text"
  ],
  "additionalProperties": false
} as const

export const SseDoneEventSchema = {
  "type": "object",
  "properties": {
    "chatRequestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    }
  },
  "required": [
    "chatRequestId"
  ],
  "additionalProperties": false
} as const

export const SseErrorEventSchema = {
  "type": "object",
  "properties": {
    "errCode": {
      "type": "string"
    },
    "errMessage": {
      "type": "string"
    },
    "retryable": {
      "type": "boolean"
    },
    "requestId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "errCode",
    "errMessage",
    "retryable",
    "requestId"
  ],
  "additionalProperties": false
} as const

export const SseStartEventSchema = {
  "type": "object",
  "properties": {
    "chatRequestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "replayed": {
      "type": "boolean"
    },
    "resumed": {
      "type": "boolean"
    }
  },
  "required": [
    "chatRequestId",
    "replayed",
    "resumed"
  ],
  "additionalProperties": false
} as const

export const SseToolStatusEventSchema = {
  "type": "object",
  "properties": {
    "toolCallId": {
      "type": "string"
    },
    "toolName": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "started",
        "succeeded",
        "failed"
      ]
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "toolCallId",
    "toolName",
    "status"
  ],
  "additionalProperties": false
} as const

export const SuccessResponseSchema = {
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "const": true
    },
    "data": {}
  },
  "required": [
    "success",
    "data"
  ],
  "additionalProperties": false
} as const

export const SyncActionDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "type": {
          "const": "recipe.patch"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "payload": {
          "type": "object",
          "properties": {
            "recipeId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "patch": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 100
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "maxLength": 30
                  },
                  "maxItems": 20
                }
              },
              "minProperties": 1,
              "additionalProperties": false
            }
          },
          "required": [
            "recipeId",
            "patch"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "actionId",
        "type",
        "createdAt",
        "payload"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "type": {
          "const": "recipe.delete"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "payload": {
          "type": "object",
          "properties": {
            "recipeId": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            }
          },
          "required": [
            "recipeId"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "actionId",
        "type",
        "createdAt",
        "payload"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const SyncActionResultDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "status": {
          "const": "applied"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "resource": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "name": {
                  "type": "string"
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "ingredients": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "steps": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "imageUrl": {
                  "type": "string",
                  "format": "uri"
                },
                "notes": {
                  "type": "string"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                }
              },
              "required": [
                "id",
                "name",
                "tags",
                "ingredients",
                "steps",
                "serverVersion",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "deletedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                }
              },
              "required": [
                "id",
                "deletedAt",
                "serverVersion"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "required": [
        "actionId",
        "status",
        "serverVersion",
        "resource"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "status": {
          "const": "rejected"
        },
        "errCode": {
          "type": "string"
        },
        "errMessage": {
          "type": "string"
        },
        "requiresFullResync": {
          "type": "boolean",
          "const": false
        },
        "authoritative": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "name": {
                  "type": "string"
                },
                "tags": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "ingredients": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "steps": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "imageUrl": {
                  "type": "string",
                  "format": "uri"
                },
                "notes": {
                  "type": "string"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "updatedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                }
              },
              "required": [
                "id",
                "name",
                "tags",
                "ingredients",
                "steps",
                "serverVersion",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                  "description": "小写 canonical UUID 格式"
                },
                "deletedAt": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                  "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                }
              },
              "required": [
                "id",
                "deletedAt",
                "serverVersion"
              ],
              "additionalProperties": false
            }
          ]
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        }
      },
      "required": [
        "actionId",
        "status",
        "errCode",
        "errMessage",
        "requiresFullResync",
        "authoritative",
        "serverVersion"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "status": {
          "const": "rejected"
        },
        "errCode": {
          "type": "string"
        },
        "errMessage": {
          "type": "string"
        },
        "requiresFullResync": {
          "type": "boolean",
          "const": true
        }
      },
      "required": [
        "actionId",
        "status",
        "errCode",
        "errMessage",
        "requiresFullResync"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "actionId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "status": {
          "const": "duplicate"
        },
        "original": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "status": {
                  "const": "applied"
                },
                "serverVersion": {
                  "type": "string",
                  "pattern": "^[1-9][0-9]*$",
                  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                },
                "resource": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "name": {
                          "type": "string"
                        },
                        "tags": {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        "ingredients": {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        "steps": {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        "imageUrl": {
                          "type": "string",
                          "format": "uri"
                        },
                        "notes": {
                          "type": "string"
                        },
                        "serverVersion": {
                          "type": "string",
                          "pattern": "^[1-9][0-9]*$",
                          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                        },
                        "createdAt": {
                          "type": "string",
                          "format": "date-time",
                          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                        },
                        "updatedAt": {
                          "type": "string",
                          "format": "date-time",
                          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                        }
                      },
                      "required": [
                        "id",
                        "name",
                        "tags",
                        "ingredients",
                        "steps",
                        "serverVersion",
                        "createdAt",
                        "updatedAt"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "deletedAt": {
                          "type": "string",
                          "format": "date-time",
                          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                        },
                        "serverVersion": {
                          "type": "string",
                          "pattern": "^[1-9][0-9]*$",
                          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                        }
                      },
                      "required": [
                        "id",
                        "deletedAt",
                        "serverVersion"
                      ],
                      "additionalProperties": false
                    }
                  ]
                }
              },
              "required": [
                "status",
                "serverVersion",
                "resource"
              ],
              "additionalProperties": false
            },
            {
              "oneOf": [
                {
                  "type": "object",
                  "properties": {
                    "status": {
                      "const": "rejected"
                    },
                    "errCode": {
                      "type": "string"
                    },
                    "errMessage": {
                      "type": "string"
                    },
                    "requiresFullResync": {
                      "type": "boolean",
                      "const": false
                    },
                    "authoritative": {
                      "oneOf": [
                        {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "format": "uuid",
                              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                              "description": "小写 canonical UUID 格式"
                            },
                            "name": {
                              "type": "string"
                            },
                            "tags": {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            },
                            "ingredients": {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            },
                            "steps": {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            },
                            "imageUrl": {
                              "type": "string",
                              "format": "uri"
                            },
                            "notes": {
                              "type": "string"
                            },
                            "serverVersion": {
                              "type": "string",
                              "pattern": "^[1-9][0-9]*$",
                              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                            },
                            "createdAt": {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                            },
                            "updatedAt": {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                            }
                          },
                          "required": [
                            "id",
                            "name",
                            "tags",
                            "ingredients",
                            "steps",
                            "serverVersion",
                            "createdAt",
                            "updatedAt"
                          ],
                          "additionalProperties": false
                        },
                        {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "format": "uuid",
                              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                              "description": "小写 canonical UUID 格式"
                            },
                            "deletedAt": {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                            },
                            "serverVersion": {
                              "type": "string",
                              "pattern": "^[1-9][0-9]*$",
                              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                            }
                          },
                          "required": [
                            "id",
                            "deletedAt",
                            "serverVersion"
                          ],
                          "additionalProperties": false
                        }
                      ]
                    },
                    "serverVersion": {
                      "type": "string",
                      "pattern": "^[1-9][0-9]*$",
                      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                    }
                  },
                  "required": [
                    "status",
                    "errCode",
                    "errMessage",
                    "requiresFullResync",
                    "authoritative",
                    "serverVersion"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "status": {
                      "const": "rejected"
                    },
                    "errCode": {
                      "type": "string"
                    },
                    "errMessage": {
                      "type": "string"
                    },
                    "requiresFullResync": {
                      "type": "boolean",
                      "const": true
                    }
                  },
                  "required": [
                    "status",
                    "errCode",
                    "errMessage",
                    "requiresFullResync"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          ]
        }
      },
      "required": [
        "actionId",
        "status",
        "original"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const SyncActionsRequestSchema = {
  "type": "object",
  "properties": {
    "actions": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "type": {
                "const": "recipe.patch"
              },
              "createdAt": {
                "type": "string",
                "format": "date-time",
                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
              },
              "payload": {
                "type": "object",
                "properties": {
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "patch": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 100
                      },
                      "tags": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "maxLength": 30
                        },
                        "maxItems": 20
                      }
                    },
                    "minProperties": 1,
                    "additionalProperties": false
                  }
                },
                "required": [
                  "recipeId",
                  "patch"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "actionId",
              "type",
              "createdAt",
              "payload"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "type": {
                "const": "recipe.delete"
              },
              "createdAt": {
                "type": "string",
                "format": "date-time",
                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
              },
              "payload": {
                "type": "object",
                "properties": {
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  }
                },
                "required": [
                  "recipeId"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "actionId",
              "type",
              "createdAt",
              "payload"
            ],
            "additionalProperties": false
          }
        ]
      },
      "minItems": 1,
      "maxItems": 100
    }
  },
  "required": [
    "actions"
  ],
  "additionalProperties": false
} as const

export const SyncActionsResponseSchema = {
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "status": {
                "const": "applied"
              },
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                        "description": "小写 canonical UUID 格式"
                      },
                      "name": {
                        "type": "string"
                      },
                      "tags": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "ingredients": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "steps": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "imageUrl": {
                        "type": "string",
                        "format": "uri"
                      },
                      "notes": {
                        "type": "string"
                      },
                      "serverVersion": {
                        "type": "string",
                        "pattern": "^[1-9][0-9]*$",
                        "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                      },
                      "createdAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      },
                      "updatedAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      }
                    },
                    "required": [
                      "id",
                      "name",
                      "tags",
                      "ingredients",
                      "steps",
                      "serverVersion",
                      "createdAt",
                      "updatedAt"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                        "description": "小写 canonical UUID 格式"
                      },
                      "deletedAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      },
                      "serverVersion": {
                        "type": "string",
                        "pattern": "^[1-9][0-9]*$",
                        "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                      }
                    },
                    "required": [
                      "id",
                      "deletedAt",
                      "serverVersion"
                    ],
                    "additionalProperties": false
                  }
                ]
              }
            },
            "required": [
              "actionId",
              "status",
              "serverVersion",
              "resource"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "status": {
                "const": "rejected"
              },
              "errCode": {
                "type": "string"
              },
              "errMessage": {
                "type": "string"
              },
              "requiresFullResync": {
                "type": "boolean",
                "const": false
              },
              "authoritative": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                        "description": "小写 canonical UUID 格式"
                      },
                      "name": {
                        "type": "string"
                      },
                      "tags": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "ingredients": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "steps": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      },
                      "imageUrl": {
                        "type": "string",
                        "format": "uri"
                      },
                      "notes": {
                        "type": "string"
                      },
                      "serverVersion": {
                        "type": "string",
                        "pattern": "^[1-9][0-9]*$",
                        "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                      },
                      "createdAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      },
                      "updatedAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      }
                    },
                    "required": [
                      "id",
                      "name",
                      "tags",
                      "ingredients",
                      "steps",
                      "serverVersion",
                      "createdAt",
                      "updatedAt"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                        "description": "小写 canonical UUID 格式"
                      },
                      "deletedAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                        "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                      },
                      "serverVersion": {
                        "type": "string",
                        "pattern": "^[1-9][0-9]*$",
                        "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                      }
                    },
                    "required": [
                      "id",
                      "deletedAt",
                      "serverVersion"
                    ],
                    "additionalProperties": false
                  }
                ]
              },
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              }
            },
            "required": [
              "actionId",
              "status",
              "errCode",
              "errMessage",
              "requiresFullResync",
              "authoritative",
              "serverVersion"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "status": {
                "const": "rejected"
              },
              "errCode": {
                "type": "string"
              },
              "errMessage": {
                "type": "string"
              },
              "requiresFullResync": {
                "type": "boolean",
                "const": true
              }
            },
            "required": [
              "actionId",
              "status",
              "errCode",
              "errMessage",
              "requiresFullResync"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "actionId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "status": {
                "const": "duplicate"
              },
              "original": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "status": {
                        "const": "applied"
                      },
                      "serverVersion": {
                        "type": "string",
                        "pattern": "^[1-9][0-9]*$",
                        "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                      },
                      "resource": {
                        "oneOf": [
                          {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "format": "uuid",
                                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                                "description": "小写 canonical UUID 格式"
                              },
                              "name": {
                                "type": "string"
                              },
                              "tags": {
                                "type": "array",
                                "items": {
                                  "type": "string"
                                }
                              },
                              "ingredients": {
                                "type": "array",
                                "items": {
                                  "type": "string"
                                }
                              },
                              "steps": {
                                "type": "array",
                                "items": {
                                  "type": "string"
                                }
                              },
                              "imageUrl": {
                                "type": "string",
                                "format": "uri"
                              },
                              "notes": {
                                "type": "string"
                              },
                              "serverVersion": {
                                "type": "string",
                                "pattern": "^[1-9][0-9]*$",
                                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                              },
                              "createdAt": {
                                "type": "string",
                                "format": "date-time",
                                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                              },
                              "updatedAt": {
                                "type": "string",
                                "format": "date-time",
                                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                              }
                            },
                            "required": [
                              "id",
                              "name",
                              "tags",
                              "ingredients",
                              "steps",
                              "serverVersion",
                              "createdAt",
                              "updatedAt"
                            ],
                            "additionalProperties": false
                          },
                          {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "format": "uuid",
                                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                                "description": "小写 canonical UUID 格式"
                              },
                              "deletedAt": {
                                "type": "string",
                                "format": "date-time",
                                "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                              },
                              "serverVersion": {
                                "type": "string",
                                "pattern": "^[1-9][0-9]*$",
                                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                              }
                            },
                            "required": [
                              "id",
                              "deletedAt",
                              "serverVersion"
                            ],
                            "additionalProperties": false
                          }
                        ]
                      }
                    },
                    "required": [
                      "status",
                      "serverVersion",
                      "resource"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "oneOf": [
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "const": "rejected"
                          },
                          "errCode": {
                            "type": "string"
                          },
                          "errMessage": {
                            "type": "string"
                          },
                          "requiresFullResync": {
                            "type": "boolean",
                            "const": false
                          },
                          "authoritative": {
                            "oneOf": [
                              {
                                "type": "object",
                                "properties": {
                                  "id": {
                                    "type": "string",
                                    "format": "uuid",
                                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                                    "description": "小写 canonical UUID 格式"
                                  },
                                  "name": {
                                    "type": "string"
                                  },
                                  "tags": {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  },
                                  "ingredients": {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  },
                                  "steps": {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  },
                                  "imageUrl": {
                                    "type": "string",
                                    "format": "uri"
                                  },
                                  "notes": {
                                    "type": "string"
                                  },
                                  "serverVersion": {
                                    "type": "string",
                                    "pattern": "^[1-9][0-9]*$",
                                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                                  },
                                  "createdAt": {
                                    "type": "string",
                                    "format": "date-time",
                                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                                  },
                                  "updatedAt": {
                                    "type": "string",
                                    "format": "date-time",
                                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                                  }
                                },
                                "required": [
                                  "id",
                                  "name",
                                  "tags",
                                  "ingredients",
                                  "steps",
                                  "serverVersion",
                                  "createdAt",
                                  "updatedAt"
                                ],
                                "additionalProperties": false
                              },
                              {
                                "type": "object",
                                "properties": {
                                  "id": {
                                    "type": "string",
                                    "format": "uuid",
                                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                                    "description": "小写 canonical UUID 格式"
                                  },
                                  "deletedAt": {
                                    "type": "string",
                                    "format": "date-time",
                                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                                  },
                                  "serverVersion": {
                                    "type": "string",
                                    "pattern": "^[1-9][0-9]*$",
                                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                                  }
                                },
                                "required": [
                                  "id",
                                  "deletedAt",
                                  "serverVersion"
                                ],
                                "additionalProperties": false
                              }
                            ]
                          },
                          "serverVersion": {
                            "type": "string",
                            "pattern": "^[1-9][0-9]*$",
                            "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                          }
                        },
                        "required": [
                          "status",
                          "errCode",
                          "errMessage",
                          "requiresFullResync",
                          "authoritative",
                          "serverVersion"
                        ],
                        "additionalProperties": false
                      },
                      {
                        "type": "object",
                        "properties": {
                          "status": {
                            "const": "rejected"
                          },
                          "errCode": {
                            "type": "string"
                          },
                          "errMessage": {
                            "type": "string"
                          },
                          "requiresFullResync": {
                            "type": "boolean",
                            "const": true
                          }
                        },
                        "required": [
                          "status",
                          "errCode",
                          "errMessage",
                          "requiresFullResync"
                        ],
                        "additionalProperties": false
                      }
                    ]
                  }
                ]
              }
            },
            "required": [
              "actionId",
              "status",
              "original"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "results"
  ],
  "additionalProperties": false
} as const

export const SyncChangeDtoSchema = {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "resource": {
          "const": "recipe"
        },
        "operation": {
          "const": "upsert"
        },
        "data": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "name": {
              "type": "string"
            },
            "tags": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "ingredients": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "steps": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "imageUrl": {
              "type": "string",
              "format": "uri"
            },
            "notes": {
              "type": "string"
            },
            "serverVersion": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$",
              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            }
          },
          "required": [
            "id",
            "name",
            "tags",
            "ingredients",
            "steps",
            "serverVersion",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "serverVersion",
        "resource",
        "operation",
        "data"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "resource": {
          "const": "recipe"
        },
        "operation": {
          "const": "delete"
        },
        "data": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "deletedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            },
            "serverVersion": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$",
              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
            }
          },
          "required": [
            "id",
            "deletedAt",
            "serverVersion"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "serverVersion",
        "resource",
        "operation",
        "data"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "resource": {
          "const": "weekly_plan"
        },
        "operation": {
          "const": "upsert"
        },
        "data": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "小写 canonical UUID 格式"
            },
            "weekStart": {
              "type": "string",
              "format": "date",
              "description": "必须是周一的 ISO 日期"
            },
            "serverVersion": {
              "type": "string",
              "pattern": "^[1-9][0-9]*$",
              "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
            },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "date": {
                    "type": "string",
                    "format": "date",
                    "description": "ISO 日期 YYYY-MM-DD"
                  },
                  "mealType": {
                    "type": "string",
                    "enum": [
                      "breakfast",
                      "lunch",
                      "dinner"
                    ],
                    "description": "餐次类型"
                  },
                  "recipeId": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "recipeNameSnapshot": {
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "date",
                  "mealType",
                  "recipeId",
                  "recipeNameSnapshot"
                ],
                "additionalProperties": false
              },
              "minItems": 21,
              "maxItems": 21
            },
            "createdAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time",
              "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
              "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
            }
          },
          "required": [
            "id",
            "weekStart",
            "serverVersion",
            "items",
            "createdAt",
            "updatedAt"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "serverVersion",
        "resource",
        "operation",
        "data"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "resource": {
          "const": "settings"
        },
        "operation": {
          "const": "upsert"
        },
        "data": {
          "type": "object",
          "properties": {
            "key": {
              "const": "familyPreference"
            },
            "value": {
              "type": "string",
              "maxLength": 5000
            }
          },
          "required": [
            "key",
            "value"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "serverVersion",
        "resource",
        "operation",
        "data"
      ],
      "additionalProperties": false
    }
  ]
} as const

export const SyncResponseSchema = {
  "type": "object",
  "properties": {
    "changes": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "recipe"
              },
              "operation": {
                "const": "upsert"
              },
              "data": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "name": {
                    "type": "string"
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "ingredients": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "imageUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "notes": {
                    "type": "string"
                  },
                  "serverVersion": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  }
                },
                "required": [
                  "id",
                  "name",
                  "tags",
                  "ingredients",
                  "steps",
                  "serverVersion",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "recipe"
              },
              "operation": {
                "const": "delete"
              },
              "data": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "deletedAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  },
                  "serverVersion": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                  }
                },
                "required": [
                  "id",
                  "deletedAt",
                  "serverVersion"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "weekly_plan"
              },
              "operation": {
                "const": "upsert"
              },
              "data": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid",
                    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                    "description": "小写 canonical UUID 格式"
                  },
                  "weekStart": {
                    "type": "string",
                    "format": "date",
                    "description": "必须是周一的 ISO 日期"
                  },
                  "serverVersion": {
                    "type": "string",
                    "pattern": "^[1-9][0-9]*$",
                    "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
                  },
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "date": {
                          "type": "string",
                          "format": "date",
                          "description": "ISO 日期 YYYY-MM-DD"
                        },
                        "mealType": {
                          "type": "string",
                          "enum": [
                            "breakfast",
                            "lunch",
                            "dinner"
                          ],
                          "description": "餐次类型"
                        },
                        "recipeId": {
                          "type": "string",
                          "format": "uuid",
                          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                          "description": "小写 canonical UUID 格式"
                        },
                        "recipeNameSnapshot": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "id",
                        "date",
                        "mealType",
                        "recipeId",
                        "recipeNameSnapshot"
                      ],
                      "additionalProperties": false
                    },
                    "minItems": 21,
                    "maxItems": 21
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  },
                  "updatedAt": {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
                    "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
                  }
                },
                "required": [
                  "id",
                  "weekStart",
                  "serverVersion",
                  "items",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "serverVersion": {
                "type": "string",
                "pattern": "^[1-9][0-9]*$",
                "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
              },
              "resource": {
                "const": "settings"
              },
              "operation": {
                "const": "upsert"
              },
              "data": {
                "type": "object",
                "properties": {
                  "key": {
                    "const": "familyPreference"
                  },
                  "value": {
                    "type": "string",
                    "maxLength": 5000
                  }
                },
                "required": [
                  "key",
                  "value"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "serverVersion",
              "resource",
              "operation",
              "data"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "nextCursor": {
      "type": "string"
    },
    "hasMore": {
      "type": "boolean"
    }
  },
  "required": [
    "changes",
    "hasMore"
  ],
  "additionalProperties": false
} as const

export const UpdatePlanItemInputSchema = {
  "type": "object",
  "properties": {
    "planItemId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    }
  },
  "required": [
    "planItemId",
    "recipeId"
  ],
  "additionalProperties": false
} as const

export const UpdatePlanItemOutputSchema = {
  "type": "object",
  "properties": {
    "item": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "date": {
          "type": "string",
          "format": "date",
          "description": "ISO 日期 YYYY-MM-DD"
        },
        "mealType": {
          "type": "string",
          "enum": [
            "breakfast",
            "lunch",
            "dinner"
          ],
          "description": "餐次类型"
        },
        "recipeId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "recipeNameSnapshot": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "date",
        "mealType",
        "recipeId",
        "recipeNameSnapshot"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "item"
  ],
  "additionalProperties": false
} as const

export const UpdateRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "patch": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 30
          },
          "maxItems": 20
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 200
          },
          "maxItems": 100
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 1000
          },
          "maxItems": 100
        },
        "imageUrl": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "op": {
                  "const": "clear"
                }
              },
              "required": [
                "op"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "op": {
                  "const": "set"
                },
                "value": {
                  "type": "string",
                  "format": "uri"
                }
              },
              "required": [
                "op",
                "value"
              ],
              "additionalProperties": false
            }
          ]
        },
        "notes": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "op": {
                  "const": "clear"
                }
              },
              "required": [
                "op"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "op": {
                  "const": "set"
                },
                "value": {
                  "type": "string"
                }
              },
              "required": [
                "op",
                "value"
              ],
              "additionalProperties": false
            }
          ]
        }
      },
      "minProperties": 1,
      "additionalProperties": false
    }
  },
  "required": [
    "recipeId",
    "patch"
  ],
  "additionalProperties": false
} as const

export const UpdateRecipeOutputSchema = {
  "type": "object",
  "properties": {
    "recipe": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "name": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "imageUrl": {
          "type": "string",
          "format": "uri"
        },
        "notes": {
          "type": "string"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "name",
        "tags",
        "ingredients",
        "steps",
        "serverVersion",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "recipe"
  ],
  "additionalProperties": false
} as const

export const UUIDSchema = {
  "type": "string",
  "format": "uuid",
  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
  "description": "小写 canonical UUID 格式"
} as const

export const WeeklyPlanPreviewSchema = {
  "type": "object",
  "properties": {
    "weekStart": {
      "type": "string",
      "format": "date",
      "description": "必须是周一的 ISO 日期"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "format": "date",
            "description": "ISO 日期 YYYY-MM-DD"
          },
          "mealType": {
            "type": "string",
            "enum": [
              "breakfast",
              "lunch",
              "dinner"
            ],
            "description": "餐次类型"
          },
          "recipeId": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "recipeNameSnapshot": {
            "type": "string"
          }
        },
        "required": [
          "date",
          "mealType",
          "recipeId",
          "recipeNameSnapshot"
        ],
        "additionalProperties": false
      },
      "minItems": 21,
      "maxItems": 21
    }
  },
  "required": [
    "weekStart",
    "items"
  ],
  "additionalProperties": false
} as const

export const WeeklyPlanUpsertChangeDtoSchema = {
  "type": "object",
  "properties": {
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    },
    "resource": {
      "const": "weekly_plan"
    },
    "operation": {
      "const": "upsert"
    },
    "data": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "小写 canonical UUID 格式"
        },
        "weekStart": {
          "type": "string",
          "format": "date",
          "description": "必须是周一的 ISO 日期"
        },
        "serverVersion": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "date": {
                "type": "string",
                "format": "date",
                "description": "ISO 日期 YYYY-MM-DD"
              },
              "mealType": {
                "type": "string",
                "enum": [
                  "breakfast",
                  "lunch",
                  "dinner"
                ],
                "description": "餐次类型"
              },
              "recipeId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                "description": "小写 canonical UUID 格式"
              },
              "recipeNameSnapshot": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "date",
              "mealType",
              "recipeId",
              "recipeNameSnapshot"
            ],
            "additionalProperties": false
          },
          "minItems": 21,
          "maxItems": 21
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        },
        "updatedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
          "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
        }
      },
      "required": [
        "id",
        "weekStart",
        "serverVersion",
        "items",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "serverVersion",
    "resource",
    "operation",
    "data"
  ],
  "additionalProperties": false
} as const

export const WeeklyPlanViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "小写 canonical UUID 格式"
    },
    "weekStart": {
      "type": "string",
      "format": "date",
      "description": "必须是周一的 ISO 日期"
    },
    "serverVersion": {
      "type": "string",
      "pattern": "^[1-9][0-9]*$",
      "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "date": {
            "type": "string",
            "format": "date",
            "description": "ISO 日期 YYYY-MM-DD"
          },
          "mealType": {
            "type": "string",
            "enum": [
              "breakfast",
              "lunch",
              "dinner"
            ],
            "description": "餐次类型"
          },
          "recipeId": {
            "type": "string",
            "format": "uuid",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            "description": "小写 canonical UUID 格式"
          },
          "recipeNameSnapshot": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "date",
          "mealType",
          "recipeId",
          "recipeNameSnapshot"
        ],
        "additionalProperties": false
      },
      "minItems": 21,
      "maxItems": 21
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|\\+00:00)$",
      "description": "UTC RFC 3339 时间戳，仅接受 Z 或 +00:00 零 offset"
    }
  },
  "required": [
    "id",
    "weekStart",
    "serverVersion",
    "items",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
} as const

// ============================================================================
// 运行时 schema 位置映射
// ============================================================================

export const schemaLocations = {
  "AddRecipeInput": { file: "recipe.schema.json", defPath: "/$defs/AddRecipeInput" },
  "AddRecipeOutput": { file: "recipe.schema.json", defPath: "/$defs/AddRecipeOutput" },
  "AppliedResultDto": { file: "sync.schema.json", defPath: "/$defs/AppliedResultDto" },
  "BatchGenerateRecipesInput": { file: "recipe.schema.json", defPath: "/$defs/BatchGenerateRecipesInput" },
  "BatchGenerateRecipesOutput": { file: "recipe.schema.json", defPath: "/$defs/BatchGenerateRecipesOutput" },
  "BootstrapRequest": { file: "auth.schema.json", defPath: "/$defs/BootstrapRequest" },
  "BootstrapResponse": { file: "auth.schema.json", defPath: "/$defs/BootstrapResponse" },
  "ChatHistoryResponse": { file: "chat.schema.json", defPath: "/$defs/ChatHistoryResponse" },
  "ChatMessage": { file: "chat.schema.json", defPath: "/$defs/ChatMessage" },
  "ChatRequest": { file: "chat.schema.json", defPath: "/$defs/ChatRequest" },
  "ClearPatch": { file: "recipe.schema.json", defPath: "/$defs/ClearPatch" },
  "ConfirmationCommitRequest": { file: "sync.schema.json", defPath: "/$defs/ConfirmationCommitRequest" },
  "ConfirmationCommitResultDto": { file: "sync.schema.json", defPath: "/$defs/ConfirmationCommitResultDto" },
  "ConfirmationEventDto": { file: "sync.schema.json", defPath: "/$defs/ConfirmationEventDto" },
  "CurrentWeeklyPlanResponse": { file: "plan.schema.json", defPath: "/$defs/CurrentWeeklyPlanResponse" },
  "DeleteRecipeInput": { file: "recipe.schema.json", defPath: "/$defs/DeleteRecipeInput" },
  "DeleteRecipeOutput": { file: "recipe.schema.json", defPath: "/$defs/DeleteRecipeOutput" },
  "DeviceListResponse": { file: "auth.schema.json", defPath: "/$defs/DeviceListResponse" },
  "DeviceView": { file: "auth.schema.json", defPath: "/$defs/DeviceView" },
  "ErrorResponse": { file: "common.schema.json", defPath: "/$defs/ErrorResponse" },
  "GenerateWeeklyPlanInput": { file: "plan.schema.json", defPath: "/$defs/GenerateWeeklyPlanInput" },
  "GenerateWeeklyPlanOutput": { file: "plan.schema.json", defPath: "/$defs/GenerateWeeklyPlanOutput" },
  "HealthLiveResponse": { file: "common.schema.json", defPath: "/$defs/HealthLiveResponse" },
  "HealthNotReadyResponse": { file: "common.schema.json", defPath: "/$defs/HealthNotReadyResponse" },
  "HealthReadyResponse": { file: "common.schema.json", defPath: "/$defs/HealthReadyResponse" },
  "IsoDate": { file: "common.schema.json", defPath: "/$defs/IsoDate" },
  "LogoutResponse": { file: "auth.schema.json", defPath: "/$defs/LogoutResponse" },
  "MealType": { file: "common.schema.json", defPath: "/$defs/MealType" },
  "ModelListResponse": { file: "settings.schema.json", defPath: "/$defs/ModelListResponse" },
  "ModelView": { file: "settings.schema.json", defPath: "/$defs/ModelView" },
  "MondayDate": { file: "common.schema.json", defPath: "/$defs/MondayDate" },
  "PlanItemView": { file: "plan.schema.json", defPath: "/$defs/PlanItemView" },
  "RecipeBatchPreview": { file: "recipe.schema.json", defPath: "/$defs/RecipeBatchPreview" },
  "RecipeDraft": { file: "recipe.schema.json", defPath: "/$defs/RecipeDraft" },
  "RecipeListResponse": { file: "recipe.schema.json", defPath: "/$defs/RecipeListResponse" },
  "RecipePatchRequest": { file: "recipe.schema.json", defPath: "/$defs/RecipePatchRequest" },
  "RecipeTombstone": { file: "recipe.schema.json", defPath: "/$defs/RecipeTombstone" },
  "RecipeUpsertChangeDto": { file: "sync.schema.json", defPath: "/$defs/RecipeUpsertChangeDto" },
  "RecipeView": { file: "recipe.schema.json", defPath: "/$defs/RecipeView" },
  "RegisterRequest": { file: "auth.schema.json", defPath: "/$defs/RegisterRequest" },
  "RegisterResponse": { file: "auth.schema.json", defPath: "/$defs/RegisterResponse" },
  "RejectedResultDto": { file: "sync.schema.json", defPath: "/$defs/RejectedResultDto" },
  "RestoreRecipeInput": { file: "recipe.schema.json", defPath: "/$defs/RestoreRecipeInput" },
  "RestoreRecipeOutput": { file: "recipe.schema.json", defPath: "/$defs/RestoreRecipeOutput" },
  "RevokeDeviceResponse": { file: "auth.schema.json", defPath: "/$defs/RevokeDeviceResponse" },
  "Rfc3339DateTime": { file: "common.schema.json", defPath: "/$defs/Rfc3339DateTime" },
  "RotateFamilyCodeResponse": { file: "auth.schema.json", defPath: "/$defs/RotateFamilyCodeResponse" },
  "SearchRecipesInput": { file: "recipe.schema.json", defPath: "/$defs/SearchRecipesInput" },
  "SearchRecipesOutput": { file: "recipe.schema.json", defPath: "/$defs/SearchRecipesOutput" },
  "ServerVersion": { file: "common.schema.json", defPath: "/$defs/ServerVersion" },
  "SetStringPatch": { file: "recipe.schema.json", defPath: "/$defs/SetStringPatch" },
  "SettingsDto": { file: "settings.schema.json", defPath: "/$defs/SettingsDto" },
  "SettingsResponse": { file: "settings.schema.json", defPath: "/$defs/SettingsResponse" },
  "SettingsUpdateRequest": { file: "settings.schema.json", defPath: "/$defs/SettingsUpdateRequest" },
  "SetUriPatch": { file: "recipe.schema.json", defPath: "/$defs/SetUriPatch" },
  "SseConfirmationRequiredEvent": { file: "chat.schema.json", defPath: "/$defs/SseConfirmationRequiredEvent" },
  "SseDeltaEvent": { file: "chat.schema.json", defPath: "/$defs/SseDeltaEvent" },
  "SseDoneEvent": { file: "chat.schema.json", defPath: "/$defs/SseDoneEvent" },
  "SseErrorEvent": { file: "chat.schema.json", defPath: "/$defs/SseErrorEvent" },
  "SseStartEvent": { file: "chat.schema.json", defPath: "/$defs/SseStartEvent" },
  "SseToolStatusEvent": { file: "chat.schema.json", defPath: "/$defs/SseToolStatusEvent" },
  "SuccessResponse": { file: "common.schema.json", defPath: "/$defs/SuccessResponse" },
  "SyncActionDto": { file: "sync.schema.json", defPath: "/$defs/SyncActionDto" },
  "SyncActionResultDto": { file: "sync.schema.json", defPath: "/$defs/SyncActionResultDto" },
  "SyncActionsRequest": { file: "sync.schema.json", defPath: "/$defs/SyncActionsRequest" },
  "SyncActionsResponse": { file: "sync.schema.json", defPath: "/$defs/SyncActionsResponse" },
  "SyncChangeDto": { file: "sync.schema.json", defPath: "/$defs/SyncChangeDto" },
  "SyncResponse": { file: "sync.schema.json", defPath: "/$defs/SyncResponse" },
  "UpdatePlanItemInput": { file: "plan.schema.json", defPath: "/$defs/UpdatePlanItemInput" },
  "UpdatePlanItemOutput": { file: "plan.schema.json", defPath: "/$defs/UpdatePlanItemOutput" },
  "UpdateRecipeInput": { file: "recipe.schema.json", defPath: "/$defs/UpdateRecipeInput" },
  "UpdateRecipeOutput": { file: "recipe.schema.json", defPath: "/$defs/UpdateRecipeOutput" },
  "UUID": { file: "common.schema.json", defPath: "/$defs/UUID" },
  "WeeklyPlanPreview": { file: "plan.schema.json", defPath: "/$defs/WeeklyPlanPreview" },
  "WeeklyPlanUpsertChangeDto": { file: "sync.schema.json", defPath: "/$defs/WeeklyPlanUpsertChangeDto" },
  "WeeklyPlanView": { file: "plan.schema.json", defPath: "/$defs/WeeklyPlanView" },
} as const

export const toolInputSchemaLocations = {
  "add_recipe": { file: "recipe.schema.json", defPath: "/$defs/AddRecipeInput" },
  "batch_generate_recipes": { file: "recipe.schema.json", defPath: "/$defs/BatchGenerateRecipesInput" },
  "delete_recipe": { file: "recipe.schema.json", defPath: "/$defs/DeleteRecipeInput" },
  "generate_weekly_plan": { file: "plan.schema.json", defPath: "/$defs/GenerateWeeklyPlanInput" },
  "restore_recipe": { file: "recipe.schema.json", defPath: "/$defs/RestoreRecipeInput" },
  "search_recipes": { file: "recipe.schema.json", defPath: "/$defs/SearchRecipesInput" },
  "update_plan_item": { file: "plan.schema.json", defPath: "/$defs/UpdatePlanItemInput" },
  "update_recipe": { file: "recipe.schema.json", defPath: "/$defs/UpdateRecipeInput" },
} as const

export const PUBLIC_SCHEMA_IDS = Object.keys(schemaLocations)
export const FUNCTION_TOOL_NAMES = Object.keys(toolInputSchemaLocations)

// ============================================================================
// FromSchema 类型推导
// ============================================================================

export type AddRecipeInput = FromSchema<typeof AddRecipeInputSchema>
export type AddRecipeOutput = FromSchema<typeof AddRecipeOutputSchema>
export type AppliedResultDto = FromSchema<typeof AppliedResultDtoSchema>
export type BatchGenerateRecipesInput = FromSchema<typeof BatchGenerateRecipesInputSchema>
export type BatchGenerateRecipesOutput = FromSchema<typeof BatchGenerateRecipesOutputSchema>
export type BootstrapRequest = FromSchema<typeof BootstrapRequestSchema>
export type BootstrapResponse = FromSchema<typeof BootstrapResponseSchema>
export type ChatHistoryResponse = FromSchema<typeof ChatHistoryResponseSchema>
export type ChatMessage = FromSchema<typeof ChatMessageSchema>
export type ChatRequest = FromSchema<typeof ChatRequestSchema>
export type ClearPatch = FromSchema<typeof ClearPatchSchema>
export type ConfirmationCommitRequest = FromSchema<typeof ConfirmationCommitRequestSchema>
export type ConfirmationCommitResultDto = FromSchema<typeof ConfirmationCommitResultDtoSchema>
export type ConfirmationEventDto = FromSchema<typeof ConfirmationEventDtoSchema>
export type CurrentWeeklyPlanResponse = FromSchema<typeof CurrentWeeklyPlanResponseSchema>
export type DeleteRecipeInput = FromSchema<typeof DeleteRecipeInputSchema>
export type DeleteRecipeOutput = FromSchema<typeof DeleteRecipeOutputSchema>
export type DeviceListResponse = FromSchema<typeof DeviceListResponseSchema>
export type DeviceView = FromSchema<typeof DeviceViewSchema>
export type ErrorResponse = FromSchema<typeof ErrorResponseSchema>
export type GenerateWeeklyPlanInput = FromSchema<typeof GenerateWeeklyPlanInputSchema>
export type GenerateWeeklyPlanOutput = FromSchema<typeof GenerateWeeklyPlanOutputSchema>
export type HealthLiveResponse = FromSchema<typeof HealthLiveResponseSchema>
export type HealthNotReadyResponse = FromSchema<typeof HealthNotReadyResponseSchema>
export type HealthReadyResponse = FromSchema<typeof HealthReadyResponseSchema>
export type IsoDate = FromSchema<typeof IsoDateSchema>
export type LogoutResponse = FromSchema<typeof LogoutResponseSchema>
export type MealType = FromSchema<typeof MealTypeSchema>
export type ModelListResponse = FromSchema<typeof ModelListResponseSchema>
export type ModelView = FromSchema<typeof ModelViewSchema>
export type MondayDate = FromSchema<typeof MondayDateSchema>
export type PlanItemView = FromSchema<typeof PlanItemViewSchema>
export type RecipeBatchPreview = FromSchema<typeof RecipeBatchPreviewSchema>
export type RecipeDraft = FromSchema<typeof RecipeDraftSchema>
export type RecipeListResponse = FromSchema<typeof RecipeListResponseSchema>
export type RecipePatchRequest = FromSchema<typeof RecipePatchRequestSchema>
export type RecipeTombstone = FromSchema<typeof RecipeTombstoneSchema>
export type RecipeUpsertChangeDto = FromSchema<typeof RecipeUpsertChangeDtoSchema>
export type RecipeView = FromSchema<typeof RecipeViewSchema>
export type RegisterRequest = FromSchema<typeof RegisterRequestSchema>
export type RegisterResponse = FromSchema<typeof RegisterResponseSchema>
export type RejectedResultDto = FromSchema<typeof RejectedResultDtoSchema>
export type RestoreRecipeInput = FromSchema<typeof RestoreRecipeInputSchema>
export type RestoreRecipeOutput = FromSchema<typeof RestoreRecipeOutputSchema>
export type RevokeDeviceResponse = FromSchema<typeof RevokeDeviceResponseSchema>
export type Rfc3339DateTime = FromSchema<typeof Rfc3339DateTimeSchema>
export type RotateFamilyCodeResponse = FromSchema<typeof RotateFamilyCodeResponseSchema>
export type SearchRecipesInput = FromSchema<typeof SearchRecipesInputSchema>
export type SearchRecipesOutput = FromSchema<typeof SearchRecipesOutputSchema>
export type ServerVersion = FromSchema<typeof ServerVersionSchema>
export type SetStringPatch = FromSchema<typeof SetStringPatchSchema>
export type SettingsDto = FromSchema<typeof SettingsDtoSchema>
export type SettingsResponse = FromSchema<typeof SettingsResponseSchema>
export type SettingsUpdateRequest = FromSchema<typeof SettingsUpdateRequestSchema>
export type SetUriPatch = FromSchema<typeof SetUriPatchSchema>
export type SseConfirmationRequiredEvent = FromSchema<typeof SseConfirmationRequiredEventSchema>
export type SseDeltaEvent = FromSchema<typeof SseDeltaEventSchema>
export type SseDoneEvent = FromSchema<typeof SseDoneEventSchema>
export type SseErrorEvent = FromSchema<typeof SseErrorEventSchema>
export type SseStartEvent = FromSchema<typeof SseStartEventSchema>
export type SseToolStatusEvent = FromSchema<typeof SseToolStatusEventSchema>
export type SuccessResponse = FromSchema<typeof SuccessResponseSchema>
export type SyncActionDto = FromSchema<typeof SyncActionDtoSchema>
export type SyncActionResultDto = FromSchema<typeof SyncActionResultDtoSchema>
export type SyncActionsRequest = FromSchema<typeof SyncActionsRequestSchema>
export type SyncActionsResponse = FromSchema<typeof SyncActionsResponseSchema>
export type SyncChangeDto = FromSchema<typeof SyncChangeDtoSchema>
export type SyncResponse = FromSchema<typeof SyncResponseSchema>
export type UpdatePlanItemInput = FromSchema<typeof UpdatePlanItemInputSchema>
export type UpdatePlanItemOutput = FromSchema<typeof UpdatePlanItemOutputSchema>
export type UpdateRecipeInput = FromSchema<typeof UpdateRecipeInputSchema>
export type UpdateRecipeOutput = FromSchema<typeof UpdateRecipeOutputSchema>
export type UUID = FromSchema<typeof UUIDSchema>
export type WeeklyPlanPreview = FromSchema<typeof WeeklyPlanPreviewSchema>
export type WeeklyPlanUpsertChangeDto = FromSchema<typeof WeeklyPlanUpsertChangeDtoSchema>
export type WeeklyPlanView = FromSchema<typeof WeeklyPlanViewSchema>

// ============================================================================
// 类型映射
// ============================================================================

/** PublicSchemaId 类型 */
export type PublicSchemaId = keyof typeof schemaLocations

/** FunctionToolName 类型 */
export type FunctionToolName = keyof typeof toolInputSchemaLocations

/** ContractType - 根据 schema ID 获取类型 */
export type ContractType<T extends PublicSchemaId> = {
  AddRecipeInput: AddRecipeInput
  AddRecipeOutput: AddRecipeOutput
  AppliedResultDto: AppliedResultDto
  BatchGenerateRecipesInput: BatchGenerateRecipesInput
  BatchGenerateRecipesOutput: BatchGenerateRecipesOutput
  BootstrapRequest: BootstrapRequest
  BootstrapResponse: BootstrapResponse
  ChatHistoryResponse: ChatHistoryResponse
  ChatMessage: ChatMessage
  ChatRequest: ChatRequest
  ClearPatch: ClearPatch
  ConfirmationCommitRequest: ConfirmationCommitRequest
  ConfirmationCommitResultDto: ConfirmationCommitResultDto
  ConfirmationEventDto: ConfirmationEventDto
  CurrentWeeklyPlanResponse: CurrentWeeklyPlanResponse
  DeleteRecipeInput: DeleteRecipeInput
  DeleteRecipeOutput: DeleteRecipeOutput
  DeviceListResponse: DeviceListResponse
  DeviceView: DeviceView
  ErrorResponse: ErrorResponse
  GenerateWeeklyPlanInput: GenerateWeeklyPlanInput
  GenerateWeeklyPlanOutput: GenerateWeeklyPlanOutput
  HealthLiveResponse: HealthLiveResponse
  HealthNotReadyResponse: HealthNotReadyResponse
  HealthReadyResponse: HealthReadyResponse
  IsoDate: IsoDate
  LogoutResponse: LogoutResponse
  MealType: MealType
  ModelListResponse: ModelListResponse
  ModelView: ModelView
  MondayDate: MondayDate
  PlanItemView: PlanItemView
  RecipeBatchPreview: RecipeBatchPreview
  RecipeDraft: RecipeDraft
  RecipeListResponse: RecipeListResponse
  RecipePatchRequest: RecipePatchRequest
  RecipeTombstone: RecipeTombstone
  RecipeUpsertChangeDto: RecipeUpsertChangeDto
  RecipeView: RecipeView
  RegisterRequest: RegisterRequest
  RegisterResponse: RegisterResponse
  RejectedResultDto: RejectedResultDto
  RestoreRecipeInput: RestoreRecipeInput
  RestoreRecipeOutput: RestoreRecipeOutput
  RevokeDeviceResponse: RevokeDeviceResponse
  Rfc3339DateTime: Rfc3339DateTime
  RotateFamilyCodeResponse: RotateFamilyCodeResponse
  SearchRecipesInput: SearchRecipesInput
  SearchRecipesOutput: SearchRecipesOutput
  ServerVersion: ServerVersion
  SetStringPatch: SetStringPatch
  SettingsDto: SettingsDto
  SettingsResponse: SettingsResponse
  SettingsUpdateRequest: SettingsUpdateRequest
  SetUriPatch: SetUriPatch
  SseConfirmationRequiredEvent: SseConfirmationRequiredEvent
  SseDeltaEvent: SseDeltaEvent
  SseDoneEvent: SseDoneEvent
  SseErrorEvent: SseErrorEvent
  SseStartEvent: SseStartEvent
  SseToolStatusEvent: SseToolStatusEvent
  SuccessResponse: SuccessResponse
  SyncActionDto: SyncActionDto
  SyncActionResultDto: SyncActionResultDto
  SyncActionsRequest: SyncActionsRequest
  SyncActionsResponse: SyncActionsResponse
  SyncChangeDto: SyncChangeDto
  SyncResponse: SyncResponse
  UpdatePlanItemInput: UpdatePlanItemInput
  UpdatePlanItemOutput: UpdatePlanItemOutput
  UpdateRecipeInput: UpdateRecipeInput
  UpdateRecipeOutput: UpdateRecipeOutput
  UUID: UUID
  WeeklyPlanPreview: WeeklyPlanPreview
  WeeklyPlanUpsertChangeDto: WeeklyPlanUpsertChangeDto
  WeeklyPlanView: WeeklyPlanView
}[T]

/** ToolInput - 根据工具名获取输入类型 */
export type ToolInput<T extends FunctionToolName> = {
  "add_recipe": AddRecipeInput
  "batch_generate_recipes": BatchGenerateRecipesInput
  "delete_recipe": DeleteRecipeInput
  "generate_weekly_plan": GenerateWeeklyPlanInput
  "restore_recipe": RestoreRecipeInput
  "search_recipes": SearchRecipesInput
  "update_plan_item": UpdatePlanItemInput
  "update_recipe": UpdateRecipeInput
}[T]

