# ARCH-001：v0.1 契约采用统一唯一事实源

- **Status:** accepted
- **Date:** 2026-07-26
- **Applies to:** MealMate Lite v0.1 HTTP、Function Calling、SSE、Sync、JSONB 与 Android wire DTO

## Context

v0.1 设计最初把 Zod 描述为后端 HTTP、FC 和 JSONB 的 schema，同时要求 Android 手写或生成 Kotlin serializer。该结构会重复定义字段、联合分支和边界，并且无法覆盖 SSE 跨帧顺序、公共错误 tuple 与跨字段语义不变量。

工具验证还确认：

- OpenAPI Generator 7.22.0 的 TypeScript models-only 产物不能独立编译；
- Kotlin nullable DTO 无法区分 PATCH 字段缺失与显式 null；
- AI SDK 的 Provider schema 边界是 JSONSchema7，不能直接使用不受限的 Draft 2020-12；
- JSON Schema 只能验证单个值，不能代替协议状态机和语义不变量。

## Decision

1. `contracts/v1/source/` 是 v0.1 wire contract 的唯一事实源。
2. 权威数据 schema 使用 JSON Schema Draft 2020-12，并限制为可跨 Ajv、Provider 和 Kotlin 工具链无损投影的 MealMate Portable Profile。
3. `openapi.yaml` 是根目录；HTTP operation 直接定义于 OpenAPI，FC、错误、SSE 和不变量通过 `x-mealmate-*` 目录引用唯一 schema ID。
4. TypeScript 类型由权威 schema 常量通过 `json-schema-to-ts` 推导；服务端运行时使用 Ajv 2020 standalone validator，不再以 Zod 定义公开契约。
5. AI Provider 接收从权威 FC schema 生成的 JSONSchema7 投影；工具执行前必须再次使用权威 Ajv validator。
6. Kotlin DTO 使用固定版本 OpenAPI Generator 生成。Android strict parser 与显式 domain/Room mapper 负责消费；不生成 Retrofit client。
7. SSE 跨帧顺序、错误响应 tuple 和业务语义不变量分别由权威目录生成状态表/映射表，并以共享 trace/golden fixture 验证。
8. Drizzle 与 Room 保持独立存储模型，只通过显式 contract mapper 连接 wire DTO。
9. 生成物提交 Git、禁止手改；生成必须在空目录执行并检测陈旧文件。
10. `contracts/v1` 在阶段 1 退出前可修改，退出后完全冻结。严格未知字段策略下，任何响应字段变化都需要新的 contract version。

## Contract correction

`update_recipe.patch.imageUrl` 和 `notes` 使用显式操作联合：

```json
{ "op": "set", "value": "..." }
```

或：

```json
{ "op": "clear" }
```

字段缺失表示不修改。该结构在 TypeScript 与生成 Kotlin DTO 中都能稳定区分“不修改、清空、设值”。

## Consequences

### Positive

- 字段和联合只维护一次；
- Server、Provider、Android、数据库 mapper 可由同一 fixture corpus 交叉验证；
- 公开错误、SSE trace 和业务不变量成为可执行契约；
- 存储结构可以独立演进，不污染 wire contract；
- v1 冻结边界和生成漂移可机械判定。

### Costs

- 需要维护小型生成/投影工具和 Portable Profile 检查；
- OpenAPI Generator 的 OAS 3.1 支持仍需 hardest-shape 编译门禁；
- Android serializer 不自动执行全部 JSON Schema 关键字，持久化前仍需不变量和 mapper 检查；
- 严格未知字段意味着 v1 冻结后不能通过新增可选响应字段演进。

## Rejected alternatives

| 方案 | 不采用原因 |
|---|---|
| Zod 为权威、Kotlin 手工同步 | 双事实源，无法证明跨端一致 |
| OpenAPI Generator 同时生成 TS/Kotlin | TypeScript models-only 实测不可独立编译 |
| 完整 2020-12 schema 直接交给 Provider | Provider 可能拒绝或忽略关键字，产生静默弱化 |
| nullable PATCH | Kotlin 把字段缺失和显式 null 合并 |
| 生成完整 server/client stub | 超出阶段 1，侵入 Hono/Retrofit 业务实现 |

## Verification

详细接口、固定版本、fixture 和退出门禁见：

- [`../active/0.1.0/contracts-persistence/spec.md`](../active/0.1.0/contracts-persistence/spec.md)
- [`../active/0.1.0/contracts-persistence/design.md`](../active/0.1.0/contracts-persistence/design.md)
