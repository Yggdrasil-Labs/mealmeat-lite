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
  'common.schema.json',
  'auth.schema.json',
  'recipe.schema.json',
  'plan.schema.json',
  'chat.schema.json',
  'sync.schema.json',
  'settings.schema.json',
] as const

export type SchemaFileName = (typeof SCHEMA_FILES)[number]

// ============================================================================
// Manifest Re-exports
// ============================================================================

export const schemas = manifest.schemas
export const PUBLIC_SCHEMA_IDS = schemas.filter((s) => s.public).map((s) => s.id)
export const FUNCTION_TOOL_NAMES = manifest.functionTools.map((f) => f.name)
export const functionToolMap = new Map(manifest.functionTools.map((f) => [f.name, f]))
export const schemaFileMap = new Map(schemas.map((s) => [s.id, s.file]))

// ============================================================================
// 展开的 Schema 常量 (as const)
// ============================================================================

export const UUIDSchema = {
  "type": "string",
  "format": "uuid",
  "description": "UUID v7 格式"
} as const

export const ServerVersionSchema = {
  "type": "string",
  "pattern": "^[1-9][0-9]*$",
  "description": "服务端版本号，正整数十进制字符串，上限 9223372036854775807"
} as const

export const Rfc3339DateTimeSchema = {
  "type": "string",
  "format": "date-time",
  "description": "UTC RFC 3339 时间戳"
} as const

export const MondayDateSchema = {
  "type": "string",
  "format": "date",
  "description": "必须是周一的 ISO 日期"
} as const

export const RecipeViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
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
      "description": "UTC RFC 3339 时间戳"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "UTC RFC 3339 时间戳"
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

export const WeeklyPlanViewSchema = {
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
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
            "description": "UUID v7 格式"
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
            "description": "UUID v7 格式"
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
      "description": "UTC RFC 3339 时间戳"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "UTC RFC 3339 时间戳"
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
// 工具输入 Schema 常量 (as const)
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

export const UpdateRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
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

export const DeleteRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
    }
  },
  "required": [
    "recipeId"
  ],
  "additionalProperties": false
} as const

export const RestoreRecipeInputSchema = {
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
    }
  },
  "required": [
    "recipeId"
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
            "description": "UUID v7 格式"
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

export const UpdatePlanItemInputSchema = {
  "type": "object",
  "properties": {
    "planItemId": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
    },
    "recipeId": {
      "type": "string",
      "format": "uuid",
      "description": "UUID v7 格式"
    }
  },
  "required": [
    "planItemId",
    "recipeId"
  ],
  "additionalProperties": false
} as const

// ============================================================================
// FromSchema 类型推导
// ============================================================================

export type UUID = FromSchema<typeof UUIDSchema>
export type ServerVersion = FromSchema<typeof ServerVersionSchema>
export type Rfc3339DateTime = FromSchema<typeof Rfc3339DateTimeSchema>
export type MondayDate = FromSchema<typeof MondayDateSchema>
export type RecipeView = FromSchema<typeof RecipeViewSchema>
export type RecipeDraft = FromSchema<typeof RecipeDraftSchema>
export type RecipePatchRequest = FromSchema<typeof RecipePatchRequestSchema>
export type WeeklyPlanView = FromSchema<typeof WeeklyPlanViewSchema>

export type AddRecipeInput = FromSchema<typeof AddRecipeInputSchema>
export type UpdateRecipeInput = FromSchema<typeof UpdateRecipeInputSchema>
export type DeleteRecipeInput = FromSchema<typeof DeleteRecipeInputSchema>
export type RestoreRecipeInput = FromSchema<typeof RestoreRecipeInputSchema>
export type SearchRecipesInput = FromSchema<typeof SearchRecipesInputSchema>
export type BatchGenerateRecipesInput = FromSchema<typeof BatchGenerateRecipesInputSchema>
export type GenerateWeeklyPlanInput = FromSchema<typeof GenerateWeeklyPlanInputSchema>
export type UpdatePlanItemInput = FromSchema<typeof UpdatePlanItemInputSchema>

// ============================================================================
// 类型映射
// ============================================================================

/** PublicSchemaId 类型 */
export type PublicSchemaId = 'UUID' | 'ServerVersion' | 'Rfc3339DateTime' | 'MondayDate' | 'RecipeView' | 'RecipeDraft' | 'RecipePatchRequest' | 'WeeklyPlanView'

/** FunctionToolName 类型 */
export type FunctionToolName = 'add_recipe' | 'update_recipe' | 'delete_recipe' | 'restore_recipe' | 'search_recipes' | 'batch_generate_recipes' | 'generate_weekly_plan' | 'update_plan_item'

/** ContractType - 根据 schema ID 获取类型 */
export type ContractType<T extends PublicSchemaId> = {
  UUID: UUID
  ServerVersion: ServerVersion
  Rfc3339DateTime: Rfc3339DateTime
  MondayDate: MondayDate
  RecipeView: RecipeView
  RecipeDraft: RecipeDraft
  RecipePatchRequest: RecipePatchRequest
  WeeklyPlanView: WeeklyPlanView
}[T]

/** ToolInput - 根据工具名获取输入类型 */
export type ToolInput<T extends FunctionToolName> = {
  add_recipe: AddRecipeInput
  update_recipe: UpdateRecipeInput
  delete_recipe: DeleteRecipeInput
  restore_recipe: RestoreRecipeInput
  search_recipes: SearchRecipesInput
  batch_generate_recipes: BatchGenerateRecipesInput
  generate_weekly_plan: GenerateWeeklyPlanInput
  update_plan_item: UpdatePlanItemInput
}[T]

