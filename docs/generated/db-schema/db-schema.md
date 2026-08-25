最后生成: 2026-08-24
数据源: app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/local/；app/app/schemas/io.yggdrasil.labs.mealmate.lite.data.local.MealMateDatabase/2.json
条目数: 69

# db-schema

> 本文档由智能体从源码自动生成，**禁止手动编辑**。
> 变更历史见同目录 `changelog.md`。

## 概览

本文记录 Android Room v2 的 12 张本地表、69 个字段及关键约束。实现和迁移以 Kotlin Entity、`MealMateDatabase` 与导出的 Room schema JSON 共同校验。

## 详细内容

### recipes

权威菜谱缓存；`id` 为主键。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| recipes | id | TEXT | PK, NOT NULL | 菜谱 ID |
| recipes | name | TEXT | NOT NULL | 名称 |
| recipes | tagsJson | TEXT | NOT NULL | 标签 JSON |
| recipes | ingredientsJson | TEXT | NOT NULL | 食材 JSON |
| recipes | stepsJson | TEXT | NOT NULL | 步骤 JSON |
| recipes | serverVersion | TEXT | NOT NULL | 严格十进制服务端版本 |
| recipes | createdAt | TEXT | NOT NULL | 创建时间 |
| recipes | updatedAt | TEXT | NOT NULL | 更新时间 |
| recipes | imageUrl | TEXT | NULL | 图片地址 |
| recipes | notes | TEXT | NULL | 备注 |
| recipes | deletedAt | TEXT | NULL | tombstone 删除时间 |

### weekly_plans

权威周计划缓存；`id` 为主键，`weekStart` 有唯一索引。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| weekly_plans | id | TEXT | PK, NOT NULL | 周计划 ID |
| weekly_plans | weekStart | TEXT | UNIQUE, NOT NULL | 周起始日 |
| weekly_plans | serverVersion | TEXT | NOT NULL | 服务端版本 |
| weekly_plans | createdAt | TEXT | NOT NULL | 创建时间 |
| weekly_plans | updatedAt | TEXT | NOT NULL | 更新时间 |

### plan_items

周计划项目；删除父计划时级联删除。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| plan_items | id | TEXT | PK, NOT NULL | 项目 ID |
| plan_items | weeklyPlanId | TEXT | FK weekly_plans.id ON DELETE CASCADE, NOT NULL | 所属周计划 |
| plan_items | date | TEXT | NOT NULL | 日期 |
| plan_items | mealType | TEXT | NOT NULL | 餐次 |
| plan_items | recipeId | TEXT | NOT NULL | 菜谱 ID |
| plan_items | recipeNameSnapshot | TEXT | NOT NULL | 菜谱名称快照 |

### settings_cache

键值设置缓存。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| settings_cache | key | TEXT | PK, NOT NULL | 设置键 |
| settings_cache | value | TEXT | NOT NULL | 设置值 |

### conversation_messages

本地对话窗口，DAO 只保留最新 40 条。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| conversation_messages | localSequence | INTEGER | PK, AUTOINCREMENT, NOT NULL | 本地顺序 |
| conversation_messages | role | TEXT | NOT NULL | 消息角色 |
| conversation_messages | content | TEXT | NOT NULL | 内容 |
| conversation_messages | createdAt | TEXT | NOT NULL | 创建时间 |

### pending_actions

离线 action 队列。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| pending_actions | actionId | TEXT | PK, NOT NULL | action ID |
| pending_actions | type | TEXT | NOT NULL | action 类型 |
| pending_actions | payloadSchemaVersion | INTEGER | NOT NULL | payload schema 版本 |
| pending_actions | payloadJson | TEXT | NOT NULL | canonical payload |
| pending_actions | payloadHash | TEXT | NOT NULL | payload 哈希 |
| pending_actions | createdAt | TEXT | NOT NULL | 创建时间 |
| pending_actions | state | TEXT | NOT NULL | pending/sending/failed |
| pending_actions | attemptId | TEXT | NULL | claim attempt ID |
| pending_actions | claimedAt | TEXT | NULL | claim 时间 |

### sync_failures

与 action 关联的服务端拒绝记录。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| sync_failures | actionId | TEXT | PK, NOT NULL | 失败 action ID |
| sync_failures | errCode | TEXT | NOT NULL | 错误码 |
| sync_failures | errMessage | TEXT | NOT NULL | 错误信息 |
| sync_failures | authoritativeSchemaVersion | INTEGER | NULL | 权威 payload schema 版本 |
| sync_failures | authoritativeJson | TEXT | NULL | 权威资源 JSON |
| sync_failures | serverVersion | TEXT | NULL | 服务端版本 |
| sync_failures | requiresFullResync | INTEGER | NOT NULL | 是否要求全量同步 |
| sync_failures | createdAt | TEXT | NOT NULL | 创建时间 |

### sync_state

同步 cursor 单例。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| sync_state | singletonId | INTEGER | PK, NOT NULL | 固定为 0 |
| sync_state | cursor | TEXT | NULL | 当前分页 cursor；terminal 或无法安全续传的 v1 cursor 为 null |
| sync_state | phase | TEXT | NULL | 当前分页处于 snapshot 或 incremental 阶段 |
| sync_state | lastResource | TEXT | NULL | snapshot 已提交页的最后资源类型 |
| sync_state | lastResourceId | TEXT | NULL | snapshot 已提交页的最后资源 ID |
| sync_state | lastServerVersion | TEXT | NULL | 已提交页的最大服务端版本边界 |

### chat_draft

未发送聊天草稿单例。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| chat_draft | singletonId | INTEGER | PK, NOT NULL | 固定为 0 |
| chat_draft | text | TEXT | NOT NULL | 草稿文本 |

### client_session

本地会话门禁；migration DDL 额外约束 singleton、状态枚举，以及 active 必须有模型。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| client_session | singletonId | INTEGER | PK, NOT NULL, CHECK = 0 | 固定为 0 |
| client_session | sessionId | TEXT | NOT NULL | 与加密凭证匹配的会话 ID |
| client_session | sessionGeneration | INTEGER | NOT NULL | 响应写入 fencing generation |
| client_session | state | TEXT | NOT NULL, CHECK switching/provisioning/active | 会话阶段 |
| client_session | selectedModelId | TEXT | NULL；active 时非空 | 当前模型 |

### replica_versions

每个权威资源的已应用版本。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| replica_versions | resource | TEXT | 复合 PK, NOT NULL | 资源类型 |
| replica_versions | resourceId | TEXT | 复合 PK, NOT NULL | 资源 ID |
| replica_versions | serverVersion | TEXT | NOT NULL | 已应用的最高服务端版本 |

### sync_diagnostics

无 actionId 的 cursor/protocol 诊断，按 session/generation fencing。

| 表名 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| sync_diagnostics | diagnosticId | TEXT | PK, NOT NULL | 诊断 ID |
| sync_diagnostics | sessionId | TEXT | NOT NULL | 所属 session |
| sync_diagnostics | sessionGeneration | INTEGER | NOT NULL | 所属 generation |
| sync_diagnostics | kind | TEXT | NOT NULL, CHECK cursor/protocol | 诊断类别 |
| sync_diagnostics | errorCode | TEXT | NOT NULL | 错误码 |
| sync_diagnostics | message | TEXT | NOT NULL | 错误信息 |
| sync_diagnostics | resource | TEXT | NULL | 相关资源 |
| sync_diagnostics | createdAt | TEXT | NOT NULL | 创建时间 |

## 使用指南

字段级事实以导出的 `2.json` 为准；migration 特有的 `CHECK` 和 v1 版本回填逻辑以 `MealMateDatabase.kt` 为准。
