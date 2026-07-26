---
id: mealmate-0.1.0-contracts-persistence-spec
status: in-progress
owner: Yggdrasil-Labs
created: 2026-07-26
updated: 2026-07-26
---

# 阶段 1：契约与持久化

## Overview

为 MealMate Lite v0.1 建立后端、数据库和 Android 共同消费的唯一契约事实源，使后续认证、同步、领域与对话功能能够在相同的数据、错误和协议语义上独立实现。

## Behavior: 权威契约覆盖

### Scenario: v0.1 全量覆盖

Given v0.1 已确认包含 21 个 HTTP operation、8 个 Function Calling 工具和 6 种 SSE event
When 生成契约覆盖清单
Then 清单分别包含 21、8、6 个唯一条目
And 每个条目都引用已登记的请求、响应或事件 schema

### Scenario: 多个消费者使用同一字段定义

Given `RecipeView` 同时出现在 HTTP、Function Calling、同步和 Android 缓存边界
When 检查这些接口的字段来源
Then `RecipeView` 的字段、必填性、联合分支和约束只定义一次
And 其它接口只通过稳定 schema ID 引用该定义

### Scenario: 重复或悬空定义

Given 契约中出现重复 operation ID、重复 schema ID 或无法解析的 schema 引用
When 执行契约源检查
Then 检查失败并列出每个重复或悬空标识
And 不产生新的消费者契约

## Behavior: HTTP JSON 契约

### Scenario: 成功响应跨端解析

Given 每个 v0.1 HTTP 成功响应类型各有一份有效 JSON fixture
When 后端和 Android 分别解析这些 fixtures
Then 两端均接受全部有效 fixtures
And 重新序列化后的对象保持相同字段、判别值和数值表示

### Scenario: 服务端版本保持精度

Given JSON 中 `serverVersion` 为 `"9007199254740993"`
When 后端和 Android 解析并重新序列化该对象
Then 两端输出仍为十进制字符串 `"9007199254740993"`
And 任何公开契约都不把它转换为 JSON number

### Scenario: 非法公开对象

Given 一个 HTTP 对象含未知字段、非法枚举值、缺少必填字段或同时携带互斥分支
When 任一消费者按 v0.1 契约解析
Then 解析失败并返回可分类的契约错误
And 失败对象不会进入业务处理或本地持久化

## Behavior: Function Calling 契约

### Scenario: 八个工具的合法输入

Given v0.1 的 8 个 Function Calling 工具各有一份最小合法输入 fixture
When 严格解析这些工具输入
Then 8 份 fixtures 全部被接受
And 每个写工具只使用稳定 ID 或完整创建草稿，不依赖名称猜测写入目标

### Scenario: 工具输入边界

Given `batch_generate_recipes` 含 50 个合法菜谱且 `generate_weekly_plan` 含 21 个合法餐次
When 解析这两个工具输入
Then 两个输入均被接受
And 增加第 51 个菜谱或减少任一餐次后解析失败

### Scenario: 未知工具或宽泛参数

Given 工具名不在 8 个 v0.1 工具中，或参数含未知字段、空 patch、泛化 object
When 解析工具调用
Then 解析失败并标识具体工具或字段
And 不生成任何可执行写操作

## Behavior: 可清空字段三态

### Scenario: 字段保持不变

Given 已有菜谱的 notes 为 `"少盐"`
When `update_recipe.patch` 不包含 notes
Then notes 保持 `"少盐"`
And 其它 patch 字段仍可正常修改

### Scenario: 显式清空字段

Given 已有菜谱的 imageUrl 和 notes 均非空
When `update_recipe.patch` 分别携带 `{ "op": "clear" }`
Then imageUrl 和 notes 被解释为显式清空
And 清空操作不会与字段缺失合并

### Scenario: 非法设值操作

Given notes 操作缺少 value、imageUrl 的 value 不是合法 URI，或同一操作同时携带 clear 和 value 语义
When 解析 `update_recipe.patch`
Then 解析失败并指出对应字段
And 原菜谱保持不变

## Behavior: Provider 工具投影

### Scenario: 八个工具可投影

Given 权威契约包含 8 个合法 Function Calling 工具
When 为 AI Provider 生成工具 schema
Then 生成结果恰好包含相同的 8 个工具名
And 每个工具输入仍拒绝权威契约拒绝的未知字段和非法联合分支

### Scenario: 本地校验保持权威

Given Provider 返回一组符合 Provider schema 表面结构的工具参数
When 系统准备执行工具
Then 参数仍需通过权威契约校验才可进入业务执行
And 校验失败时不会调用写入型工具

### Scenario: 无法无损投影

Given 权威工具 schema 使用 Provider 不支持且无法等价展开的能力
When 生成 Provider 工具投影
Then 生成失败并报告 schema ID 和不支持能力
And 不发布语义被削弱的 Provider schema

## Behavior: 公共错误目录

### Scenario: 已登记错误

Given 一个已登记的 v0.1 `errCode`
When 构造普通 JSON 或流内失败
Then HTTP 状态、`retryable`、`Retry-After` 和允许的传输通道与错误目录一致
And 失败对象包含非空 `requestId`

### Scenario: 重试提示边界

Given 错误分别为 `CHAT_IN_PROGRESS`、`RATE_LIMITED` 和 `MODEL_TIMEOUT`
When 构造公开失败
Then 前两者的 `Retry-After` 分别位于 1..30 秒和 1..900 秒
And `MODEL_TIMEOUT` 不携带 `Retry-After`

### Scenario: 未登记或不一致错误

Given 业务尝试发布未登记 `errCode`，或已登记错误使用错误的 HTTP 状态、retryable 值或 Retry-After
When 构造公开失败
Then 契约验证失败并标识不一致字段
And 错误不会作为有效公开响应发送

## Behavior: SSE 事件协议

### Scenario: 完整成功流

Given 一组从事件编号 1 开始的聊天事件
When 事件顺序为 `start`、零个或多个中间事件、`done`
Then 每个事件 data 都满足对应事件契约
And `start` 恰好一次且最先、`done` 恰好一次且最后

### Scenario: 工具生命周期和确认状态

Given 事件流包含一个 toolCallId 和一个 pending confirmation
When 同一 toolCallId 依次出现 started、succeeded，确认事件携带匹配 kind 的预览和 token
Then 完整事件流被接受
And expired、superseded 或 consumed 确认状态必须不含 token

### Scenario: 非法事件流

Given 事件缺少 start、eventId 不递增、工具未 started 就结束、终止后继续发送，或同时包含 done 和 error
When 校验完整事件序列
Then 序列验证失败并标识首个协议违规
And 该序列不会被视为成功聊天结果

## Behavior: 语义不变量

### Scenario: 完整周计划

Given 周计划起始日为 `2026-07-27`
When 验证覆盖 7 天且每天包含 breakfast、lunch、dinner 的 21 个餐次
Then 周计划通过 `WEEKLY_PLAN_HAS_21_SLOTS` 和 `WEEK_START_IS_MONDAY`
And 任一餐次日期都位于 `2026-07-27` 至 `2026-08-02`

### Scenario: 同步顺序

Given 同步请求包含 actionId A、B、C
When 返回逐项处理结果
Then 结果顺序仍为 A、B、C
And `SYNC_RESULTS_PRESERVE_INPUT_ORDER` 验证通过

### Scenario: 不变量违规

Given 周计划缺少一个餐次、weekStart 不是周一或 serverVersion 超过数据库 signed bigint 上限
When 执行对应语义检查
Then 分别返回稳定的不变量 ID
And 违规对象不会进入服务端或本地持久化

## Behavior: PostgreSQL 首版结构

### Scenario: 空数据库完成迁移

Given 一个可连接且没有 MealMate Lite 业务对象的 PostgreSQL 16 数据库
When 执行全部已发布迁移
Then 数据库包含 v0.1 定义的 12 个逻辑实体
And 主键、外键、唯一约束、检查约束和索引均与 v0.1 数据契约一致

### Scenario: 聚合与版本原子写入

Given 一份合法菜谱或完整周计划
When 保存聚合并产生同步变更
Then 业务数据、服务端版本、同步变更和对应回执全部提交
And 任一步失败时四者均不产生部分提交

### Scenario: 数据库结构或约束不满足

Given 数据库缺少当前迁移，或写入空菜谱名称、非周一计划、无效外键
When 执行 readiness 或持久化操作
Then readiness 返回 `503 NOT_READY` 或写入整体失败
And 数据库不保留部分业务数据

## Behavior: Android Room 本地结构

### Scenario: 完整同步页原子落地

Given Android 收到包含完整 WeeklyPlan 和 21 个餐次的同步页
When 将同步页应用到本地缓存
Then 计划头、21 个餐次和新 cursor 在同一事务提交
And 任一步失败时 cursor 与缓存都保持原值

### Scenario: 本地离线动作

Given 用户离线修改菜谱名称或标签
When 保存乐观修改
Then pending action 保留原 actionId、严格 payload、hash 和 pending 状态
And AI 消息、家庭偏好以及确认 token 不进入离线动作

### Scenario: 敏感或非法数据

Given bootstrap、register、确认事件返回敏感 token，或同步对象未通过契约与不变量检查
When 准备写入本地持久化
Then device token、confirmation token、家庭码和 bootstrap secret 不进入本地数据库
And 非法同步对象不会推进 cursor

## Behavior: 确定性生成与冻结

### Scenario: 干净环境重复生成

Given 相同的权威契约源、工具链版本、区域设置和换行配置
When 在两个空目录分别生成全部消费者契约
Then 两个输出目录的文件路径和字节内容完全一致
And 已提交生成物与新生成结果零差异

### Scenario: 陈旧生成文件

Given 权威源删除一个 schema 但已提交生成目录仍保留旧文件
When 执行生成一致性门禁
Then 门禁失败并列出陈旧文件
And 仅覆盖现有文件不能使门禁通过

### Scenario: v1 冻结后发生线格式变化

Given `contracts/v1` 已通过阶段 1 退出门禁
When 尝试新增可选响应字段、改变枚举、必填性或联合分支
Then 变更被识别为 wire contract 变化
And 必须使用新的 contract version，不能静默修改已冻结 v1

## Constraints

- PostgreSQL 固定为 16；首版迁移覆盖 12 个 v0.1 逻辑实体。
- Android Room 首版覆盖 9 张本地表：recipes、weekly_plans、plan_items、settings_cache、conversation_messages、pending_actions、sync_failures、sync_state、chat_draft。
- 契约覆盖固定为 21 个 HTTP operation、8 个 Function Calling 工具和 6 种 SSE event。
- JSON 请求体和单个同步页面最大 1 MB；同步动作批次与分页 limit 最大 100。
- 对话消息最长 10,000 字；Conversation 与 Android 本地历史最多 20 个完整 user/assistant 轮次，即 40 条消息。
- 确认草稿有效期 10 分钟；聊天租约 30 秒；心跳周期 10 秒。
- 所有公开对象拒绝未知字段；所有 JSONB payload 与持久化联合携带可验证的 schema version。
- 线格式 `serverVersion` 是正整数十进制字符串；数据库生成值不超过 `9223372036854775807`。
- 阶段 1 允许修改 `contracts/v1`；通过退出门禁后 v1 完全冻结，任何响应字段变化都需要新的 contract version。
- 阶段 1 只交付契约、生成物、迁移、实体、mapper 和 fixtures；不实现认证、同步执行器、领域服务、AI Provider、页面业务或发布部署。
