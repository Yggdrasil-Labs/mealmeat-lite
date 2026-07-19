# MealMate Lite — 头脑风暴

## 背景

基于现有 MealMate 项目（Java Spring Boot + Vue 3）的功能设计，重构为轻量级新项目。原项目架构过重，新项目聚焦 AI 驱动的对话式交互，仅做 Android App + 轻量后端。

## 产品定位

- **目标用户**：私人家庭，非公开服务
- **核心交互**：AI 对话式驱动一切操作（录入、生成、查询、管理）
- **平台**：Android App（唯一客户端）
- **开发模式**：个人开发 + AI agent 实施编码

## 文档权威与版本边界

- [`product-design.md`](./product-design.md) 描述完整产品愿景；其中未标注版本的能力不自动进入 MVP。
- [`roadmap.md`](../roadmap.md) 的 **v0.1 对话内核**是 MVP 的唯一范围、验收标准和交付顺序来源。
- 本文保留探索、竞品调研和后续阶段候选方案；其中的“全量需求摘要”不作为 v0.1 的 SDD 输入。
- v0.1 是**单家庭单部署**：一个后端实例只服务一个家庭，不提供多家庭隔离或公开注册。多家庭能力留待 v1.3 重新设计。

## 已确认的设计决策

### 1. AI 编排层架构

后端抽象统一的 AI Provider 接口，底层对接多个模型，用户在 App 中可运行时切换。

```
用户对话 → 后端 AI Router → Provider 适配层 → DeepSeek / OpenAI / 通义 / ...
                ↓
         Function Calling 解析
                ↓
         执行业务操作（CRUD 菜品、生成计划、操作库存...）
                ↓
         流式返回结果给 App
```

关键点：

- Provider 接口统一：v0.1 仅支持 OpenAI-compatible 格式；部署端为每个已启用模型配置 baseURL、凭据和 model name
- Provider 凭据仅存在于部署端受限环境配置，不写入数据库、接口响应、日志或客户端；App 只获取已启用且已通过函数调用、流式能力检查的模型列表
- App 端切换：模型选择仅保存在当前设备，立即对该设备的下一轮对话生效，不影响其它设备
- `/chat` 每次都将 `modelId` 严格匹配服务端启用且声明 `streaming=true,tools=true` 的 allowlist；未知、停用或能力不匹配的值统一返回 `422 MODEL_UNAVAILABLE`。兼容性认定与探测语义以 `tech-stack.md` 的部署配置契约为准
- Function Calling 定义与模型解耦：tools/functions 定义是业务层的，不随模型变化

### 2. 数据模型

| 实体 | 核心字段 | 说明 |
|---|---|---|
| Recipe（菜品） | name, tags[], ingredients[]?, steps[]?, image?, notes? | 渐进式，只有 name 必填。ingredients 为自由文本数组 |
| WeeklyPlan（周计划） | week_start, items[] | 一周的餐次安排 |
| PlanItem（餐次） | date, meal_type(早/午/晚), recipe_id | 哪天哪餐吃什么（一餐一菜） |
| Conversation（对话） | device_id, messages[] | 每台设备一份 AI 多轮对话记录 |
| Settings（配置） | key, value | 家庭共享的非敏感配置，例如偏好文本；不保存设备模型选择 |
| AuthConfig（认证配置） | family_code_hash, initialized_at | 单例；仅保存家庭码哈希，不保存明文 |
| DeviceToken（设备） | id, token_hash, device_name, created_at, last_used_at, revoked_at | 多端认证；稳定 `id` 用于会话归属和设备撤销，令牌明文仅在签发时返回一次 |
| PendingConfirmation（确认草稿） | token_hash, device_id, kind, draft_payload, target_version?, expires_at, consumed_at, commit_action_id | 批量菜谱或周计划覆盖的服务端草稿；令牌一次性消费 |
| ChatRequestReceipt（聊天回执） | device_id, chat_request_id, request_hash, status, final_response, tool_receipts, created_at | 在线聊天及其工具写入的幂等和重放依据 |
| SyncActionReceipt（同步回执） | device_id, action_id, action_type, payload_hash, result, server_version, created_at | 离线动作幂等；重复上传不重复执行 |
| SyncChange（同步变更） | server_version, resource, resource_id, operation, payload | 统一增量游标和删除墓碑传播 |
| AuthAttemptThrottle（认证限流） | scope, source_key_hash, failure_count, locked_until, updated_at | bootstrap/family code 来源级限流，服务重启后继续有效 |

> **Post-MVP 实体**：Ingredient、Stock、ShoppingList、ShoppingItem、FamilyRole、Leftover、NotifyRule、Meal 多菜结构。数据模型预留扩展空间但不实现。

设计决策：

- Recipe 的 ingredients 是可选的（渐进式录入），可以只有名字和标签。ingredients 存自由文本数组，不做食材字典关联
- Conversation 按 `device_id` 隔离；每台设备各自保留多轮上下文，菜谱和计划仍全家庭共享
- **不设 User/Family 表，所有业务数据属于此部署唯一家庭**；认证配置与业务设置分离
- **MVP 不做库存、不做采购清单、不做提醒**：聚焦菜谱 + 周计划两个核心闭环
- **口味偏好 = 设置页一段纯文本** → System Prompt 注入，不建 FamilyRole 表

#### v0.1 逻辑数据契约

公共约定：

- 服务端创建的实体主键均为应用层生成的 UUIDv7；设备创建的 `chatRequestId`、`actionId`、`commitActionId` 使用 UUID。表中名为 `id` 的字段默认是主键；未标 `?` 的字段均 NOT NULL。所有时间字段使用 PostgreSQL `timestamptz`，业务周使用 `date`；`created_at/updated_at` 由服务端写入当前时间。
- 所有会产生 SyncChange 的事务必须先取得固定 key `1296911409` 的 PostgreSQL `pg_advisory_xact_lock(1296911409)` 全局写锁，再锁定目标资源、分配全局 sequence `server_version` 并写入业务数据；全局锁持有到事务提交/回滚。锁顺序固定为“全局同步写锁 → 资源行锁”，禁止反向获取。资源、SyncChange 和对应回执在同一事务提交，确保低版本事务不可能晚于高版本事务变为可见。版本号只由服务端生成，锁竞争获得顺序即 v0.1 的服务端接收顺序。
- 文本在写入前去除首尾空白；数组字段 NOT NULL 且数据库默认空数组，不接受 `null`。API 中缺失字段表示“不修改”，显式 `null` 只允许清空标为 nullable 的字段。字段长度、枚举、数组数量和跨字段业务不变量同时在 Zod/service 校验；数据库可表达的 NOT NULL、CHECK、UNIQUE 与 FK 不得只靠应用层。
- JSONB 草稿、回执和消息都必须先通过版本化 Zod schema；不允许把任意 JSON 直接解释为数据库操作。

| 实体 | 字段与类型 | 约束、索引与删除策略 |
|---|---|---|
| Recipe | `id uuid`；`name text`；`tags text[]`；`ingredients text[]`；`steps text[]`；`image_url text?`；`notes text?`；`server_version bigint`；`created_at/updated_at timestamptz`；`deleted_at timestamptz?` | `name` 1..100 字；tags ≤20 项且单项 ≤30 字；ingredients/steps 各 ≤100 项，单项分别 ≤200/1000 字；notes ≤5000 字；`server_version` 唯一索引；软删除，不级联删除 PlanItem |
| WeeklyPlan | `id uuid`；`week_start date`；`server_version bigint`；`created_at/updated_at timestamptz` | `week_start` 必须是 `Asia/Shanghai` 的周一且唯一；`server_version` 唯一索引；同周覆盖为更新现有行，不新增历史版本 |
| PlanItem | `id uuid`；`weekly_plan_id uuid`；`date date`；`meal_type text`；`recipe_id uuid`；`recipe_name_snapshot text`；`created_at/updated_at timestamptz` | FK `weekly_plan_id → WeeklyPlan`（删除计划时级联）并建索引；FK `recipe_id → Recipe`（RESTRICT）并建索引；`meal_type ∈ breakfast/lunch/dinner`；日期必须落在所属周的 7 天内；唯一 `(weekly_plan_id,date,meal_type)`；名称快照写入后不随 Recipe 改名变化；随 WeeklyPlan 聚合体同步，不单独分配同步版本 |
| Conversation | `device_id uuid`；`messages jsonb`；`updated_at timestamptz` | PK/FK `device_id → DeviceToken.id`；消息项为 `{ role: "user"\|"assistant", content, chatRequestId, createdAt }`；最多 40 条消息，即 20 个完整 user/assistant 轮次；裁剪与追加在同一事务完成；设备记录保留时不级联删除 |
| Settings | `key text`；`value jsonb`；`server_version bigint`；`updated_at timestamptz` | `key` 为主键；v0.1 只允许 `familyPreference`，其值为 0..5000 字字符串；`server_version` 唯一索引 |
| AuthConfig | `singleton boolean`；`family_code_hash text`；`family_code_version bigint`；`initialized_at/updated_at timestamptz` | `singleton=true` 为主键并带 CHECK，保证全库最多一行；`family_code_hash` 保存 Argon2id PHC 字符串；`family_code_version` 初始为 1，每次家庭码轮换递增且不回退 |
| DeviceToken | `id uuid`；`token_hash text`；`device_name text`；`created_at/last_used_at timestamptz`；`revoked_at timestamptz?` | `token_hash` 为 32-byte token 的 SHA-256 十六进制值并唯一；device_name 1..80 字；认证按 hash 查找并只接受 `revoked_at IS NULL`；撤销不物理删除 |
| PendingConfirmation | `id uuid`；`token_hash text`；`device_id uuid`；`chat_request_id uuid`；`tool_index int`；`kind text`；`draft_schema_version int`；`draft_payload jsonb`；`target_resource_id uuid?`；`target_version bigint?`；`expires_at timestamptz`；`consumed_at/superseded_at timestamptz?`；`commit_action_id uuid?`；`commit_request_hash text?`；`result jsonb?`；`created_at timestamptz` | `token_hash` 为 32-byte token 的 SHA-256 十六进制值并唯一；复合 FK `(device_id,chat_request_id) → ChatRequestReceipt` RESTRICT；UNIQUE `(device_id,chat_request_id,tool_index)`；kind 为 `recipe_batch` 或 `weekly_plan_replace`；建 `(device_id,kind,created_at)` 索引；部分唯一 `(device_id,commit_action_id)` where not null；消费后保留以重放结果；同设备同 kind 新预览会 supersede 旧预览 |
| ChatRequestReceipt | `device_id uuid`；`chat_request_id uuid`；`request_hash text`；`model_id text?`；`message text?`；`status text`；`retryable boolean`；`lease_owner uuid?`；`lease_generation int`；`lease_expires_at/heartbeat_at timestamptz?`；`attempt_count int`；`tool_receipts jsonb?`；`final_response text?`；`error_code text?`；`created_at/updated_at timestamptz` | 主键 `(device_id,chat_request_id)`；FK device RESTRICT；status 为 `running/completed/failed/expired`；索引 `(device_id,status,lease_expires_at)`；request hash 覆盖规范化的 modelId + message；正文只用于近期恢复且不进入日志；租约 generation 是写入 fencing token；expired 仅保留幂等墓碑 |
| SyncActionReceipt | `device_id uuid`；`action_id uuid`；`action_type text`；`payload_hash text`；`status text`；`result jsonb`；`server_version bigint?`；`created_at timestamptz` | 主键 `(device_id,action_id)`；FK device RESTRICT；status 为 `applied/rejected`；索引 `(created_at)`；duplicate 是读取既有回执后的传输态，不是新持久化状态 |
| SyncChange | `server_version bigint`；`resource text`；`resource_id text`；`operation text`；`payload_schema_version int`；`payload jsonb`；`created_at timestamptz` | `server_version` 为主键并在全局同步写锁内由 sequence 分配；UUID 资源 ID 使用小写标准 UUID 文本，Settings 使用 `familyPreference`；索引 `(resource,resource_id,server_version DESC)` 支持快照重建；合法组合见下文；WeeklyPlan payload 始终含完整 21 个 items |
| AuthAttemptThrottle | `scope text`；`source_key_hash text`；`failure_count int`；`locked_until timestamptz?`；`updated_at timestamptz` | 主键 `(scope,source_key_hash)`；scope 为 `bootstrap/register`；失败计数与锁定在单事务原子更新；来源保存 HMAC-SHA256，不保存明文 IP |

关系与事务不变量：

- 创建、覆盖或调整单餐时，WeeklyPlan 与相关 PlanItem 在同一事务校验并写入；任一餐次失败则整批回滚。PlanItem 必须引用未删除的 Recipe。任何 PlanItem 变化都更新 WeeklyPlan 的 `server_version` 并只发出一条包含完整 21 餐的 WeeklyPlan SyncChange。
- bootstrap 成功事务同时创建 AuthConfig、首个 DeviceToken 和默认 `Settings.familyPreference=""`，并为 Settings 分配首个可同步版本；任一写入失败则实例仍视为未初始化。
- Recipe 软删除前检查所有 `week_start >= 当前周周一` 的计划引用；存在引用则返回冲突。历史 PlanItem 继续保留 `recipe_id` 与名称快照。
- `server_version` 允许因事务回滚出现空洞，客户端只能比较大小，不能假定连续。
- SyncChange 数据库 CHECK 限定合法组合：`recipe + upsert/delete`、`weekly_plan + upsert`、`settings + upsert`；payload 必须是 JSON object。每个 `(resource,operation,payload_schema_version)` 在代码中对应唯一 strict Zod schema，未知版本拒绝启动/消费。
- 物理清理 AuthConfig、DeviceToken、确认草稿、回执、SyncChange 与业务墓碑不属于 v0.1 运行时能力。

聊天回执状态机：

```text
不存在 ──首次请求──> running(generation=1)
running ──成功──> completed
running ──可重试错误──> failed(retryable=true)
running ──不可重试错误──> failed(retryable=false)
running(租约有效) ──同 ID 重试──> 409 CHAT_IN_PROGRESS
running(租约过期) / failed(retryable=true) ──用户同 ID 重试──> running(generation+1)
completed ──同 ID 同内容重试──> SSE 重放最终结果
failed(retryable=false) ──同 ID 同内容重试──> JSON 重放终态错误
任一其它 ID running(租约有效) ──本设备请求──> 409 CHAT_DEVICE_BUSY
running(租约过期) / failed(retryable=true) ──本设备创建新 ID──> failed(retryable=false, CHAT_REQUEST_SUPERSEDED)
completed / failed ──早于最近20个完成请求的保留边界──> expired（清除内容，只留幂等墓碑）
任意已有状态 ──同 ID 不同内容──> 409 IDEMPOTENCY_KEY_REUSED
```

- 每次 worker 取得 30 秒租约并每 10 秒独立心跳续租。服务端在接受或恢复聊天前锁定该 DeviceToken 行：同一 ID 的活动租约返回 `409 CHAT_IN_PROGRESS`；其它 ID 的活动租约返回 `409 CHAT_DEVICE_BUSY`；两者都带不超过剩余租约秒数的 `Retry-After`。此行锁覆盖“检查活动租约、supersede 旧可恢复请求、创建/接管回执”全过程，防止两个新 ID 同时通过检查。
- 服务端不会后台自动恢复，只有用户主动重试同一 `chatRequestId` 才能接管过期或可重试失败的请求。若用户改为发送新的 ID，事务先把该设备所有租约已过期的 running 和 `failed(retryable=true)` 旧请求终结为 `CHAT_REQUEST_SUPERSEDED`：对旧 running 行递增 `lease_generation`、清空 lease owner/到期/心跳并设 `status=failed,retryable=false`，再创建新请求；这些旧 ID 此后不得恢复或执行工具。completed 请求不受影响，会话只按成功请求的提交顺序追加。v0.1 不提供聊天排队或取消 API。
- 接管使用 compare-and-set 校验旧 generation/过期时间并递增 `lease_generation`。心跳、工具业务事务、对话追加和最终状态提交都必须使用同一谓词 `status=running AND lease_owner=:owner AND lease_generation=:generation`，同时校验 `DeviceToken.revoked_at IS NULL`；影响行数不是 1 即视为 fencing 失败并立即中止 provider/SSE。只比较 generation 而不比较 status/owner 不合格。
- `tool_receipts` 是版本化 strict JSON 数组，项为 `{ toolIndex, toolCallId, toolName, arguments, argumentsHash, status, result?, errorCode?, pendingConfirmationId? }`。`toolCallId = UUIDv5(namespace=chatRequestId, name=toolIndex十进制字符串)`，恢复和重放保持不变。每个工具开始前先持久化 receipt；写工具以 `(deviceId,chatRequestId,toolIndex)` 作为幂等键，并将业务写入、工具结果和 generation 校验放在同一事务。产生确认草稿的工具必须在同一事务把其 `PendingConfirmation.id` 写入 `pendingConfirmationId`。
- 重放 completed 请求时，按 `toolIndex ASC` 遍历所有带 `pendingConfirmationId` 的工具回执，逐一读取对应草稿当前状态并发送 `confirmation-required`；被后续预览替代的草稿发送 superseded，仍有效的草稿重新确定性生成 token 后发送 pending。不得按“设备最新同 kind 草稿”猜测来源。
- 恢复时重建原 modelId、用户消息和已完成工具结果；已成功工具作为既有结果提供给模型，不再次执行，未完成工具仍沿用原 toolIndex 与幂等键。只有请求进入 `completed` 时，才在同一事务向 Conversation 一次性追加 user + assistant 两条消息。
- 每次失败或恢复均递增 `attempt_count`，但 v0.1 不设自动重试次数；每次新尝试必须来自用户点击重试。数据库可以保存聊天正文和工具参数用于业务恢复，但日志仍禁止记录它们。
- Conversation 裁剪旧轮次时，同一事务把被裁剪轮次及更早的 ChatRequestReceipt 置为 `expired`，清空 modelId、message、tool receipts、final response 与错误详情，只保留主键和 request hash 防止旧 ID 重新执行。相同内容重试返回 `410 CHAT_REQUEST_EXPIRED`，不同内容仍返回 `409 IDEMPOTENCY_KEY_REUSED`。

### 3. Android App 架构

> 本节页面表是完整产品愿景；v0.1 实际只实现本文后部“补充 7：MVP 范围定义”列出的 4 页。

架构分层：

```
UI Layer (Jetpack Compose)
  → ViewModel
    → Repository
      → Local (Room) + Remote (Retrofit)
```

页面结构：

| 页面 | 功能 |
|---|---|
| 对话主页（首页） | AI 对话入口，所有操作从这里发起 |
| 菜品库 | 浏览、搜索、查看详情 |
| 食材/库存 | 查看当前库存、分类浏览、过期预警 |
| 周计划 | 日历视图展示本周三餐安排 |
| 采购清单 | 清单项 + 勾选，按食材类别分组 |
| 统计 | 频次统计、品类分布、时间趋势 |
| 设置 | 模型切换、家庭码管理、提醒配置、数据同步状态 |

导航：Bottom Navigation（对话、菜品、计划、更多）

关键交互：

- 对话页是主入口，日常操作通过对话完成
- 其他页面是数据展示 + 浏览，修改操作引导回对话或就地轻编辑
- AI 流式消息用 LazyColumn + 逐字渲染
- 离线时对话页提示"离线模式"，其他页面正常浏览本地数据
- 视觉风格：Material 3 标准，Dynamic Color

### 4. 后端架构

> 下列树是完整产品候选结构；v0.1 不创建 stock/shopping/notify/jobs 模块，实际模块以本文后部“MVP 后端模块”为准。

```
server/src/
├── routes/          # API 路由定义
│   ├── chat.ts      # 对话（SSE 流式）
│   ├── recipes.ts   # 菜品 CRUD
│   ├── stock.ts     # 库存
│   ├── plans.ts     # 周计划
│   ├── shopping.ts  # 采购清单
│   ├── settings.ts  # 配置（模型切换等）
│   ├── auth.ts      # 首次初始化、设备注册、注销
│   └── sync.ts      # 增量拉取、离线动作上传
├── services/        # 业务逻辑
│   ├── ai/          # AI 编排核心
│   │   ├── router.ts       # 模型路由
│   │   ├── providers.ts    # 统一 provider 接口
│   │   ├── functions.ts    # Function Calling 定义
│   │   └── executor.ts     # 解析 AI 返回 → 执行业务操作
│   ├── recipe.ts
│   ├── stock.ts
│   ├── plan.ts
│   ├── shopping.ts
│   └── notify.ts    # 提醒调度
├── db/              # Drizzle schema + migrations
├── jobs/            # 定时任务（提醒检查、库存过期扫描）
└── middleware/      # 认证、错误处理
```

核心 API（除初始化和设备注册外均要求 `Authorization: Bearer <device-token>`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/chat` | 在线发送 `{ chatRequestId, modelId, message }`，SSE 流式返回 AI 响应 |
| GET | `/api/v1/chat/history` | 多轮对话历史 |
| GET | `/api/v1/recipes` | cursor 分页菜品列表（搜索、标签筛选，`limit ≤ 100`） |
| PATCH/DELETE | `/api/v1/recipes/:id` | 就地改名/标签、软删除菜品 |
| GET | `/api/v1/plans/current` | 本周计划 |
| GET | `/api/v1/plans/:weekStart` | 历史周计划 |
| GET/PUT | `/api/v1/settings` | 家庭共享非敏感配置读写（偏好） |
| GET | `/api/v1/models` | 获取部署端已启用且兼容 Function Calling/SSE 的模型列表 |
| POST | `/api/v1/auth/bootstrap` | 仅未初始化实例：校验部署 bootstrap secret，设置家庭码并签发首个设备令牌 |
| POST | `/api/v1/auth/register` | 用家庭码注册后续设备 |
| POST | `/api/v1/auth/logout` | 吊销当前设备令牌 |
| GET | `/api/v1/auth/devices` | 列出已加入设备 |
| DELETE | `/api/v1/auth/devices/:id` | 吊销指定设备令牌 |
| POST | `/api/v1/auth/family-code/rotate` | 轮换家庭码，旧码立即失效 |
| POST | `/api/v1/confirmations/commit` | 在 body 中提交 `confirmationToken` 与 `commitActionId`，一次性提交批量菜品或周计划覆盖草稿 |
| GET | `/api/v1/sync?cursor=…&limit=…` | 基于不透明游标分页拉取变更和删除墓碑（`limit ≤ 100`） |
| POST | `/api/v1/sync/actions` | 上传至多 100 个可离线执行的幂等动作 |

#### v0.1 HTTP 契约

公共约定：

- JSON 字段使用 camelCase；ID 为 UUID 字符串；时间为 UTC RFC 3339 字符串；`weekStart`/`date` 为 `YYYY-MM-DD`；数据库 bigint `serverVersion` 一律编码为十进制字符串，客户端不得转为 IEEE-754 number。未知字段由 Zod strict schema 拒绝。
- 普通成功响应为 `{ "success": true, "data": ... }`；普通失败响应为 `{ "success": false, "errCode": string, "errMessage": string, "requestId": string, "retryable": boolean, "details"?: [{ "field"?: string, "reason": string }] }`。SSE 成功流不套该 envelope。
- Bearer token 只在 `Authorization` header 中传输。除 bootstrap/register/rotate 的一次性签发字段和 `confirmation-required` 的短期确认 token 外，任何响应都不得回显 token 或家庭码；所有日志和错误详情均不得包含 token、家庭码、bootstrap secret、模型凭据、聊天正文或工具参数。
- GET 游标都是服务端签名或编码的不透明字符串；客户端不得解析。非法或已无法识别的游标返回 `400 INVALID_CURSOR`。

| 接口 | 请求契约 | 成功 `data` | 特有失败 |
|---|---|---|---|
| `GET /health/live` | 无鉴权、无参数 | `{ status: "ok" }` | 进程不可服务时由连接失败表达 |
| `GET /health/ready` | 无鉴权、无参数 | `{ status: "ready" }`；仅 DB 可连接、迁移版本匹配、必填配置有效且至少一个兼容模型可用时成功 | `503 NOT_READY` |
| `POST /api/v1/chat` | `{ chatRequestId: UUID, modelId: 1..100字, message: 1..10000字 }` | SSE 事件流，见下表 | `MODEL_UNAVAILABLE`、`IDEMPOTENCY_KEY_REUSED`、`CHAT_IN_PROGRESS`、`CHAT_DEVICE_BUSY`、`CHAT_REQUEST_SUPERSEDED`、`CHAT_REQUEST_EXPIRED`、provider/超时错误 |
| `GET /api/v1/chat/history` | 无参数 | `{ messages: ChatMessage[] }`，按时间升序，最多 40 条 | — |
| `GET /api/v1/recipes` | query：`cursor?`、`limit=50`（1..100）、`q?`（≤200字）、重复 `tag?`（≤20项） | `{ items: RecipeView[], nextCursor: string?, hasMore: boolean }`；不返回软删除项 | `INVALID_CURSOR` |
| `PATCH /api/v1/recipes/:id` | 至少一个：`{ name?: 1..100字, tags?: string[0..20] }`；只允许就地轻编辑 | 更新后的 `RecipeView` | `RECIPE_NOT_FOUND`、`RECIPE_DELETED` |
| `DELETE /api/v1/recipes/:id` | 无 body | `{ id, deletedAt, serverVersion }` | `RECIPE_NOT_FOUND`、`RECIPE_IN_USE` |
| `GET /api/v1/plans/current` | 无参数 | `WeeklyPlanView`；尚无计划时 `data: null` | — |
| `GET /api/v1/plans/:weekStart` | weekStart 必须为周一 | `WeeklyPlanView` | `INVALID_WEEK_START`、`PLAN_NOT_FOUND` |
| `GET /api/v1/settings` | 无参数 | `{ familyPreference: string, serverVersion: ServerVersion }` | — |
| `PUT /api/v1/settings` | `{ familyPreference: 0..5000字 }` | 同 GET；整体替换该设置 | `VALIDATION_ERROR` |
| `GET /api/v1/models` | 无参数 | `{ items: [{ id, displayName, isDefault }] }`；恰有一个默认项，不返回 baseURL、provider 名称或凭据 | — |
| `POST /api/v1/auth/bootstrap` | `{ bootstrapSecret: string, deviceName: 1..80字 }` | `{ deviceId, deviceToken, familyCode }`，三个敏感明文只在此次成功响应出现 | `ALREADY_INITIALIZED`、`INVALID_BOOTSTRAP_SECRET`、`RATE_LIMITED` |
| `POST /api/v1/auth/register` | `{ familyCode: string, deviceName: 1..80字 }` | `{ deviceId, deviceToken }`；token 只返回一次 | `NOT_INITIALIZED`、`INVALID_FAMILY_CODE`、`RATE_LIMITED` |
| `POST /api/v1/auth/logout` | 无 body | `{ revoked: true }`；当前 token 在事务提交后失效 | — |
| `GET /api/v1/auth/devices` | 无参数 | `{ items: [{ id, deviceName, createdAt, lastUsedAt, isCurrent }] }`；不列已撤销设备 | — |
| `DELETE /api/v1/auth/devices/:id` | 无 body；允许撤销当前设备 | `{ id, revoked: true }` | `DEVICE_NOT_FOUND` |
| `POST /api/v1/auth/family-code/rotate` | 无 body | `{ familyCode }`，新码只返回一次，旧码在同一事务失效 | — |
| `POST /api/v1/confirmations/commit` | `{ confirmationToken: string, commitActionId: UUID }` | `ConfirmationCommitResultDto`；App 复用同步 reducer 在一个 Room 事务应用，相同提交 ID 重放原结果 | `CONFIRMATION_NOT_FOUND`、`CONFIRMATION_EXPIRED`、`CONFIRMATION_CONSUMED`、`CONFIRMATION_SUPERSEDED`、`CONFIRMATION_STALE` |
| `GET /api/v1/sync` | query：`cursor?`、`limit=100`（1..100） | `{ changes: SyncChangeDto[], nextCursor: string?, hasMore: boolean }`；另受 1 MB 页面上限约束 | `INVALID_CURSOR` |
| `POST /api/v1/sync/actions` | `{ actions: SyncActionDto[1..100] }` | `{ results: SyncActionResultDto[] }`，与输入顺序一致且逐项 ACK | 顶层只报告整包格式/鉴权错误；业务错误放逐项结果 |

视图字段：

- `ServerVersion = string`，只允许正整数十进制格式；`RecipeDraft = { name, tags, ingredients, steps, imageUrl?, notes? }`；`RecipeTombstone = { id, deletedAt, serverVersion: ServerVersion }`。
- `RecipeView = { id, name, tags, ingredients, steps, imageUrl?, notes?, serverVersion: ServerVersion, createdAt, updatedAt }`。
- `PlanItemView = { id, date, mealType, recipeId, recipeNameSnapshot }`。
- `WeeklyPlanView = { id, weekStart, serverVersion: ServerVersion, items: PlanItemView[], createdAt, updatedAt }`，items 按日期、早/午/晚排序。
- `RecipeBatchPreview = { items: RecipeDraft[1..50], skippedDuplicates: string[] }`，不含持久化 ID/version/timestamp。
- `WeeklyPlanPreview = { weekStart, items: [{ date, mealType, recipeId, recipeNameSnapshot }] }`，恰好 21 餐，不含 WeeklyPlan/PlanItem 持久化 ID、version 或 timestamp。
- `ConfirmationCommitResultDto` 是封闭联合：`{ kind: "recipe_batch", changes: RecipeUpsertChangeDto[1..50] }` 或 `{ kind: "weekly_plan_replace", changes: [WeeklyPlanUpsertChangeDto] }`；不允许 generic result/object。
- `ConfirmationEventDto` 是同 kind 判别联合，公共字段为 `{ confirmationId, state: "pending"|"expired"|"superseded"|"consumed", expiresAt }`；recipe_batch 的 preview 必须是 RecipeBatchPreview，weekly_plan_replace 的 preview 必须是 WeeklyPlanPreview。仅 `state="pending"` 时要求 `confirmationToken`，其它状态禁止该字段。

菜谱 cursor 语义：

- 首次请求取得与写端同 key 的 `pg_advisory_xact_lock_shared(1296911409)`，读取当前最大已提交 `serverVersion` 作为 `snapshotWatermark`，随后从永久 SyncChange 重建该水位时每个 Recipe 的最新状态；后续页始终使用同一 watermark，因此分页期间的新增、修改和删除留到下一次新查询，不造成当前结果重复或漏项。
- 固定排序为 `(lower(name) ASC, id ASC)`。cursor payload 编码 schemaVersion、snapshotWatermark、规范化查询摘要、limit、上一页最后的 lowerName + id，经 RFC 8785 规范化后做无 padding base64url；签名为从 bootstrap secret 以独立 context 派生 key 对该 payload 字符串计算的 HMAC-SHA256。传输格式固定为 `<payload>.<signature>`，客户端不得解析或修改。
- `q` 去首尾空白后，对 name、任一 tag、任一 ingredient 做 Unicode case-insensitive substring OR 匹配；重复 `tag` 参数采用 case-insensitive exact membership AND 语义。cursor 与本次规范化 q/tags/limit 摘要不匹配统一返回 `400 INVALID_CURSOR`。

状态码与公共错误：

| HTTP | 使用场景 | errCode |
|---|---|---|
| 400 | 非法 JSON、缺字段、strict schema 多余字段、非法 cursor/UUID/date | `BAD_REQUEST`、`INVALID_CURSOR` |
| 401 | 缺少、无效或已撤销的 device token | `UNAUTHORIZED` |
| 404 | 资源或确认令牌不存在；不得借此泄露跨设备确认草稿 | `*_NOT_FOUND` |
| 409 | 幂等键复用、资源状态冲突、初始化竞争、计划版本变化 | 具体 `*_CONFLICT` 或上表错误码 |
| 410 | 聊天回执已按 20 轮保留规则清除内容 | `CHAT_REQUEST_EXPIRED` |
| 422 | 可解析但业务语义非法、模型不可用或批量无新增项 | `VALIDATION_ERROR`、`INVALID_WEEK_START`、`MODEL_UNAVAILABLE`、`NO_NEW_RECIPES` |
| 429 | bootstrap/family code 限流，必须带 `Retry-After` | `RATE_LIMITED` |
| 500 | 未预期服务端错误，仅返回 requestId | `INTERNAL_ERROR` |
| 502/503/504 | 模型提供方失败、服务未就绪/暂时繁忙、模型超时 | `PROVIDER_ERROR`、`NOT_READY`、`SERVICE_BUSY`、`MODEL_TIMEOUT` |

errCode 唯一映射（未列出的业务代码不得直接发布）：

| errCode | HTTP | retryable | Retry-After | 含义 |
|---|---:|---|---|---|
| `BAD_REQUEST` / `INVALID_CURSOR` | 400 | false | — | JSON/UUID/date/cursor 格式错误；cursor 不能用于不同查询 |
| `UNAUTHORIZED` / `INVALID_BOOTSTRAP_SECRET` / `INVALID_FAMILY_CODE` | 401 | false | — | 凭证缺失或错误；不返回是哪部分不匹配 |
| `RECIPE_NOT_FOUND` / `PLAN_NOT_FOUND` / `DEVICE_NOT_FOUND` / `CONFIRMATION_NOT_FOUND` | 404 | false | — | 资源不存在；跨设备确认也统一 NOT_FOUND |
| `CHAT_REQUEST_EXPIRED` / `CONFIRMATION_EXPIRED` | 410 | false | — | 内容已按保留期删除或确认已过期，必须创建新请求/预览 |
| `ALREADY_INITIALIZED` / `NOT_INITIALIZED` | 409 | false | — | 初始化状态不允许当前操作 |
| `IDEMPOTENCY_KEY_REUSED` / `RECIPE_DELETED` / `CHAT_REQUEST_SUPERSEDED` / `CONFIRMATION_CONSUMED` / `CONFIRMATION_SUPERSEDED` / `CONFIRMATION_STALE` | 409 | false | — | 幂等键、聊天上下文或资源状态冲突 |
| `RECIPE_IN_USE` | 409 | false | — | 当前或未来计划仍引用菜谱 |
| `CHAT_IN_PROGRESS` | 409 | true | 剩余租约秒数，1..30 | 相同聊天 ID 仍由活动 worker 处理 |
| `CHAT_DEVICE_BUSY` | 409 | true | 剩余租约秒数，1..30 | 同设备的另一个聊天 ID 仍由活动 worker 处理 |
| `VALIDATION_ERROR` / `INVALID_WEEK_START` / `MODEL_UNAVAILABLE` / `NO_NEW_RECIPES` | 422 | false | — | 请求可解析但违反业务约束，或批量候选全部因同名被跳过 |
| `RATE_LIMITED` | 429 | true | 锁定剩余秒数，1..900 | bootstrap/register 来源被锁定 |
| `INTERNAL_ERROR` / `SYNC_CHANGE_TOO_LARGE` | 500 | false | — | 未预期错误；只暴露 requestId，服务端告警 |
| `PROVIDER_ERROR` | 502 | true | 5 | 模型提供方失败且尚可安全重试 |
| `NOT_READY` | 503 | true | 5 | DB、迁移或模型目录未就绪 |
| `SERVICE_BUSY` | 503 | true | 1 | DB 连接池获取或同步写锁等待超时；事务已完整回滚 |
| `MODEL_TIMEOUT` | 504 | true | — | 60 秒 idle 或 5 分钟总超时 |

SSE 事件正式文法为 `start → (delta | tool-status | confirmation-required)* → (done | error)`：start 恰好一次且必须最先，done/error 二选一且必须最后。不同工具与文本事件允许交错；同一 toolCallId 必须先有一次 started，之后恰有一次 succeeded 或 failed。重放已完成工具时仍使用原 toolCallId，并把 `replayed=true`。每个 frame 使用 SSE `id:` 写入本次连接内从 1 开始单调递增的十进制 `eventId`，`data:` 为单行 JSON。`confirmation-required` 是 v0.1 唯一结构化业务事件，不扩展为通用混合消息协议。

| event | data schema | 语义 |
|---|---|---|
| `start` | `{ chatRequestId, replayed: boolean, resumed: boolean }` | 首个事件；完成结果重放时 `replayed=true`，接管中断请求时 `resumed=true`，两者不同时为 true |
| `delta` | `{ text: string }` | 仅包含面向用户的回复增量；重放时允许一次返回完整 `finalResponse` |
| `tool-status` | `{ toolCallId, toolName, status: "started"\|"succeeded"\|"failed", replayed?: boolean }` | 仅暴露工具名和状态，不暴露参数或内部结果；恢复时可重放已完成状态 |
| `confirmation-required` | `ConfirmationEventDto` | App 固定确认面板；只有 pending 状态携带 token 并启用确认按钮，其余状态只展示不可提交原因 |
| `error` | `{ errCode, errMessage, retryable: boolean, requestId }` | 流建立后的终止失败；不得再发送 `done` |
| `done` | `{ chatRequestId }` | 成功终止；此前所有工具写入、完整周计划聚合变更和最终回复已经持久化 |

设计决策：

- 对话是主要写入入口。就地编辑的“轻操作”：改菜品名称/标签、删除菜品和设置开关；它们必须有等价的受鉴权 API。
- `/chat` 背后：接收消息 → AI 推断意图 → Function Calling → 执行 → 流式返回
- API 成功响应使用 `{ success: true, data }`；失败响应严格使用公共约定的 `{ success: false, errCode, errMessage, requestId, retryable, details? }`，不得暴露堆栈、密钥或被禁止记录的正文。
- `/chat` 在 SSE 建立前的错误使用标准 JSON 错误响应；建立后发送 `start`、`delta`、`tool-status`、`confirmation-required`、`error`、`done` 事件。每个事件有单调 `eventId`；v0.1 不做 SSE event 断点续流。连接中断后用户以同一 `chatRequestId` 重试：已完成请求重放最终响应及确认面板状态，活动租约返回 `CHAT_IN_PROGRESS`，过期租约按 generation 接管恢复；同设备的其它有效聊天租约返回 `CHAT_DEVICE_BUSY`。
- `/sync` 使用游标与服务端版本，而非客户端时间戳，统一同步所有变更和墓碑。
- 认证中间件校验未吊销的 device token；`bootstrap` 仅可执行一次。

### 5. Function Calling 与 AI 业务编排

MVP 做 8 个 function，覆盖菜谱 + 周计划闭环：

| Function | 作用 | 示例触发语 |
|---|---|---|
| `add_recipe` | 添加菜品 | "加个红烧肉" |
| `update_recipe` | 补充/修改菜品信息 | "红烧肉的食材帮我补一下" |
| `search_recipes` | 搜索菜品库 | "我有哪些汤类的菜" |
| `batch_generate_recipes` | 批量生成菜品 | "帮我生成 20 个家常川菜" |
| `generate_weekly_plan` | 生成周计划 | "安排下周的菜，少辣" |
| `update_plan_item` | 调整某餐的菜 | "周三中午换一个" |
| `delete_recipe` | 删除菜品 | "把红烧肉删了" |
| `restore_recipe` | 显式恢复已删除菜品 | "恢复红烧肉" |

#### v0.1 Function Calling 契约

所有工具 schema 使用 strict object，字符串和数组沿用逻辑数据契约上限。写工具只接受稳定 ID；若用户只给名称，模型必须先调用 `search_recipes`，零候选或多候选时停止写入并向用户澄清。工具结果是供模型消费的结构化 JSON，不直接等同于 HTTP 响应。

| Function | 输入 schema | 成功结果 | 写入与确认语义 |
|---|---|---|---|
| `add_recipe` | `{ name, tags?: string[], ingredients?: string[], steps?: string[], imageUrl?: string, notes?: string }` | `{ recipe: RecipeView }` | 单菜直接创建；同名允许 |
| `update_recipe` | `{ recipeId: UUID, patch: { name?, tags?, ingredients?, steps?, imageUrl?: string\|null, notes?: string\|null } }`，patch 至少一项 | `{ recipe: RecipeView }` | 锁定未删除 Recipe 后原子更新；普通 patch 不得清除 `deletedAt` |
| `search_recipes` | `{ query?: string≤200, tags?: string[≤20], includeDeleted?: boolean=false, limit?: 1..50=20 }`，至少有 query/tags 之一 | `{ items: RecipeView[], truncated: boolean }` | 只读；名称、标签、食材字段不区分大小写 contains；恢复意图才可设 includeDeleted |
| `batch_generate_recipes` | `{ recipes: RecipeDraft[1..50] }` | 有新增项：给模型 `{ confirmationRequired: true, count, skippedDuplicates, expiresAt }`，给 App 发 `confirmation-required`；全部同名：公共失败 `{ ok:false, errCode:"NO_NEW_RECIPES", errMessage, retryable:false }` | 先按规范化名称跳过同名项；剩余 1..50 项才创建确认草稿且零业务写入。全部跳过时不创建 PendingConfirmation、不发确认事件，由模型说明没有可新增菜谱。用户要求删项/改名时，模型以完整新列表再次调用本工具，新草稿 supersede 同设备旧草稿 |
| `generate_weekly_plan` | `{ weekStart: MondayDate, items: [{ date, mealType, recipeId }] }`，恰好 21 项且覆盖 7 天三餐 | 无同周计划：`{ plan: WeeklyPlanView, reusedRecipeIds[] }`；已有计划给模型安全摘要并向 App 发包含 WeeklyPlanPreview 的 `confirmation-required` | 新周计划直接原子创建；覆盖已有同周计划时零业务写入并创建带 `targetVersion` 的确认草稿；token 不进入模型上下文 |
| `update_plan_item` | `{ planItemId: UUID, recipeId: UUID }` | `{ item: PlanItemView }` | 锁定餐次与目标未删除 Recipe 后更新，同时刷新名称快照 |
| `delete_recipe` | `{ recipeId: UUID }` | `{ id, deletedAt, serverVersion }` | 用户明确删除单菜时直接软删除；当前或未来计划引用则拒绝 |
| `restore_recipe` | `{ recipeId: UUID }` | `{ recipe: RecipeView }` | 只接受已删除 Recipe；恢复产生新的 `serverVersion` |

工具公共失败结果为 `{ ok: false, errCode, errMessage, retryable: false }`。模型参数不合法、资源状态冲突和确认前置条件失败不得由 executor 自动改写参数或绕过确认；应把错误回传模型生成面向用户的说明。

编排逻辑：

- 多轮对话驱动：用户通过多轮文字对话逐步完善菜谱信息和调整计划
- 单轮可触发多个 function
- 模型决定调用顺序和参数；后端以 Zod 校验参数、校验设备令牌后才执行，并只执行已定义的业务工具。用户提供的菜谱、偏好和消息始终作为不可信数据边界处理，不得当作工具指令。
- 对按名称写入的更新、删除和替换操作，必须先搜索：零个或多个候选都要求用户澄清。菜谱允许重名；批量预览默认跳过同名项并警告，用户可改名后保留变体。
- 周计划的“近 7 天”固定指目标 `weekStart` 前 7 个自然日，即 `[weekStart-7天, weekStart)` 中 PlanItem 引用的菜谱。服务端将未删除 Recipe 分为 nonRecent/recent，两组内按 `(lower(name),id)` 排序，先取 nonRecent、再取 recent，总计最多 100 条交给模型；模型仍可调用 `search_recipes` 获取其它候选。若 nonRecent 至少 21 条，`generate_weekly_plan` 发现任一 recent ID 必须以 `VALIDATION_ERROR` 拒绝并让模型重选；不足 21 条时允许 recent，全部未删除菜谱不足 21 条时还允许周内复用。工具成功结果的 `reusedRecipeIds` 精确列出使用 recent 或周内重复的去重 ID，模型必须据此向用户说明。
- 批量生成菜品和覆盖已有周计划先创建服务端草稿，返回仅对发起预览设备有效、10 分钟内有效的 `confirmationToken`；用户在该设备明确确认后才提交。单个菜品删除按用户明确指令执行。
- `PendingConfirmation` 只保存令牌哈希。提交时在一个数据库事务内校验调用设备、过期时间、未消费状态和（周计划覆盖时）`target_version`；目标计划版本变化则返回 `409 CONFIRMATION_STALE`，要求重新生成预览。成功后记录 `consumed_at` 和 `commit_action_id`；相同提交 ID 只返回原结果，令牌重放不重复写入。
- 确认提交以 `(deviceId,commitActionId)` 幂等，`commit_request_hash` 覆盖 confirmation token hash。相同 ID + 相同 token 重放原结果；相同 ID + 不同 token 返回 `409 IDEMPOTENCY_KEY_REUSED`；已消费 token 携带新提交 ID 返回 `409 CONFIRMATION_CONSUMED`。
- device token 是 CSPRNG 生成的 32-byte 随机值。`confirmationToken` 是以 HKDF-SHA256 从 bootstrap secret 派生的专用 key，对 UTF-8 字节串 `v1:<pendingConfirmationId小写UUID>:<deviceId小写UUID>` 做 HMAC-SHA256 得到的 32-byte 伪随机值；两者均以无 padding base64url 传输，服务端仅保存 SHA-256。确定性派生允许重放尚有效确认面板而不保存明文 token。确认令牌只进入发起设备的 SSE 事件和 HTTPS JSON body，不进入模型、URL、query、持久化客户端存储或日志。高熵 token 不使用慢 KDF，家庭码才使用 Argon2id。
- 每个聊天请求由设备生成 UUID `chatRequestId`。服务端以 `(device_id, chat_request_id)` 和请求哈希唯一约束持久化 ChatRequestReceipt；同 ID 同内容按状态重放、报告活动或接管恢复，同 ID 不同内容返回 `409 IDEMPOTENCY_KEY_REUSED`。每个写入型工具调用使用由聊天请求 ID 和工具序号派生的幂等键，并将业务写入、工具回执和租约 generation 校验置于同一事务。
- 所有 request/payload/arguments hash 都对 strict schema 校验和文本规范化后的对象执行 RFC 8785 JSON Canonicalization Scheme，再计算 SHA-256。聊天 hash 覆盖 `{modelId,message}`；同步 action hash 覆盖 `{type,payload}`、不含展示用 createdAt；工具 hash 覆盖 `{toolName,arguments}`。
- 删除若被当前或未来计划引用则拒绝，用户须先替换或移除相应餐次；普通更新不得复活软删除菜品，必须通过 `restore_recipe` 显式恢复，且多候选时要求选择。
- 每次 function 执行结果回传给模型，模型生成最终用户可读回复
- 对话上下文保持最近 20 轮；超出部分从服务端和设备本地永久删除，而非仅停止注入提示词
- System Prompt 注入家庭偏好（一段可编辑文本，设置页配置）

> Post-MVP function：generate_shopping_list、update_stock、check_stock、batch_init_stock、suggest_use_expiring、set_reminder、add_leftover、consume_leftover、update_meal

### 6. 同步、离线与多端一致性

同步模型：

```
服务端 PostgreSQL（权威数据源）
       ↕ /sync API
App Room（本地缓存 + 离线暂存）
```

增量同步机制：

- 每条可同步数据携带单调递增的 `server_version`、`updated_at` 和可同步的 `deleted_at` 墓碑；客户端仅保存服务端下发的不透明 `cursor`。v0.1 的墓碑和同步回执永久保留。
- App 调用 `GET /api/v1/sync?cursor={cursor}&limit={1..100}` 拉取按 `server_version` 升序的变更。响应为 `{ changes, nextCursor, hasMore }`；首次无 cursor 时从完整当前快照开始，响应按 100 项或 1 MB 截断，`hasMore=true` 时必须继续拉取至 `false` 后才视为同步完成。
- 服务端是权威源。并发动作按数据库事务获得的服务端接收顺序串行应用，后写成功动作覆盖先写成功动作；客户端时间戳仅用于展示，不参与冲突判定。

离线写入处理：

- `pending_actions` 仅保存可确定执行的本地轻操作，例如 `recipe.patch`、`recipe.delete`；每项包含 UUID `actionId`、类型、payload 和本地创建时间。
- App 联网后以至多 100 项一批调用 `POST /api/v1/sync/actions`。回执以 `(device_id, actionId)` 唯一，保存动作类型和规范化 payload 哈希；相同 ID 且哈希相同返回原 `duplicate` 结果，哈希不同返回 `409 IDEMPOTENCY_KEY_REUSED`。资源写入、SyncChange 与回执必须在同一事务提交。
- 服务端逐项返回 `applied`、`duplicate` 或不可重试的业务错误；仅 `applied`/`duplicate` 后才能清除本地动作。`rejected` 必须带 `actionId`、`errCode`、当前资源快照及 `serverVersion`（无快照时标记 `requiresFullResync`）。客户端在一个 Room 事务内先以该权威状态回滚乐观修改，再保留同步失败记录供丢弃或重新编辑。
- 家庭共享偏好离线时只保存本地草稿，网络恢复后由用户手动保存；不得自动进入 `pending_actions`。
- AI 对话不离线排队：断网发送立即提示失败，保留未发送草稿并提供“重新发送”；恢复网络后由用户手动发送，避免陈旧上下文或确认操作被后台执行。

同步 DTO 使用判别联合，不使用可被任意解释的 `{ type, payload: object }`：

```ts
type SyncActionDto =
  | {
      actionId: UUID
      type: 'recipe.patch'
      createdAt: Rfc3339 // 仅展示，不参与排序或冲突判定
      payload: { recipeId: UUID; patch: { name?: string; tags?: string[] } }
    }
  | {
      actionId: UUID
      type: 'recipe.delete'
      createdAt: Rfc3339
      payload: { recipeId: UUID }
    }

type AppliedResultDto = {
  status: 'applied'
  serverVersion: ServerVersion
  resource: RecipeView | RecipeTombstone
}
type RejectedResultDto =
  | {
      status: 'rejected'
      errCode: string
      errMessage: string
      requiresFullResync: false
      authoritative: RecipeView | RecipeTombstone
      serverVersion: ServerVersion
    }
  | {
      status: 'rejected'
      errCode: string
      errMessage: string
      requiresFullResync: true
    }
type SyncActionResultDto =
  | ({ actionId: UUID } & AppliedResultDto)
  | ({ actionId: UUID } & RejectedResultDto)
  | { actionId: UUID; status: 'duplicate'; original: AppliedResultDto | RejectedResultDto }

type SyncChangeDto =
  | { serverVersion: ServerVersion; resource: 'recipe'; operation: 'upsert'; data: RecipeView }
  | { serverVersion: ServerVersion; resource: 'recipe'; operation: 'delete'; data: RecipeTombstone }
  | { serverVersion: ServerVersion; resource: 'weekly_plan'; operation: 'upsert'; data: WeeklyPlanView }
  | { serverVersion: ServerVersion; resource: 'settings'; operation: 'upsert'; data: { key: 'familyPreference'; value: string } }
```

`duplicate.original` 不允许再次嵌套 duplicate。`requiresFullResync=false` 必须同时携带 authoritative 与 serverVersion；`true` 分支禁止携带二者，客户端据此执行完整同步。

- 一批 actions 严格按数组顺序处理，每项一个数据库事务；单项失败不回滚同批其它项。相同或不同资源上的并发可同步写事务都以取得全局同步写锁、分配 `serverVersion` 并提交的顺序为服务端接收顺序。
- 整包 schema 或鉴权失败时不处理任何 action；整包合法后逐项写回执。服务端崩溃时，不存在“业务写入成功但没有回执”的可见状态，因为资源、SyncChange 和回执同事务提交。
- 首次无 cursor 同步时，服务端在第一页通过 `pg_advisory_xact_lock_shared(1296911409)` 确定 `snapshotWatermark`。服务端从永久 SyncChange 中重建 `serverVersion <= watermark` 的每个资源最新状态，并固定按 `(resource ASC, resource_id ASC)` 分页；后续 snapshot cursor 编码 watermark 与最后一个 `(resource,resource_id)`。快照结束后 cursor 切到增量阶段，从 watermark 之后继续，确保分页期间发生的写入不会漏失。
- Sync cursor 使用与菜谱 cursor 相同的 RFC 8785 payload + base64url + HMAC-SHA256 封装，但必须使用独立 HKDF context。payload 是封闭联合：snapshot 为 `{ schemaVersion:1, phase:"snapshot", watermark, lastResource?, lastResourceId?, limit }`，incremental 为 `{ schemaVersion:1, phase:"incremental", lastServerVersion, limit }`；格式同为 `<payload>.<signature>`。修改 limit、phase、版本或签名均返回 `400 INVALID_CURSOR`。
- 增量 cursor 中 `lastServerVersion` 是最后已确认的版本；服务端只返回更大的版本。客户端只有在整页 Room 事务成功后才保存 `nextCursor`，应用崩溃可安全重复拉取上一页。
- 单页先受 `limit` 限制，再在加入下一项会超过 1 MB 时截断；至少返回一个合法 change，否则单项超过限制时返回 `500 SYNC_CHANGE_TOO_LARGE` 并告警。

同步触发时机：

- App 切回前台
- 对话发送消息后
- WorkManager 定期后台同步（每 30 分钟）

多端：

- 不区分用户，家庭码仅用于后续设备加入；一个部署只有一份共享数据。已加入设备权限相同，均可改共享偏好、轮换家庭码和撤销指定设备。
- 对话与模型选择按设备隔离：每台设备使用自己的 Conversation 与本地选中模型，不影响共享菜谱和计划。
- 初期不做实时推送，依赖轮询同步
- 可同步业务资源使用 `deleted_at` 墓碑传播删除；同步回执不作为可删除业务资源

设备注册与凭证安全：

- 部署时必须设置至少 256 位随机的 `MEALMATE_BOOTSTRAP_SECRET`。首台设备调用 `POST /api/v1/auth/bootstrap`，校验该 secret 后生成随机家庭码；AuthConfig 单例以唯一约束和事务 compare-and-set 初始化，竞争失败返回 `409 ALREADY_INITIALIZED`。初始化成功后该入口永久关闭。
- 家庭码由服务端 CSPRNG 均匀生成 12 个 Crockford Base32 字符（60 bit），显示为 `XXXX-XXXX-XXXX`。生成字符表排除 `I/L/O/U`；输入规范化为去除 ASCII 空格和连字符、转大写，并兼容映射 `O→0`、`I/L→1`，规范化后必须正好 12 字符且只含 Crockford 字符。
- bootstrap 和家庭码轮换的成功响应只向发起设备返回一次明文 `familyCode`；服务端使用 Argon2id（memory 64 MiB、iterations 3、parallelism 1、随机 16-byte salt、32-byte output）保存标准 PHC 字符串，验证使用成熟库并做常量时间比较。device token 使用 CSPRNG 生成 32 byte、以无 padding base64url 返回，服务端只保存 SHA-256；它和稳定 `deviceId` 仅在 bootstrap/register 响应中返回一次，不设自然过期，只能被注销、设备撤销或恢复重置吊销。
- register 先读取 `family_code_hash + family_code_version` 并在事务外执行昂贵 Argon2id 校验；校验成功后开启签发事务并 `SELECT ... FOR UPDATE` 锁定 AuthConfig，只有 hash 与 version 仍与已校验快照完全相同才创建 DeviceToken。rotate 也锁定同一行，在更新 hash 时递增 version。若注册二次检查发现变化，统一返回 `401 INVALID_FAMILY_CODE` 且绝不签发 token；不得在持有 AuthConfig 行锁时执行 Argon2id。
- Android 使用 Android Keystore 保护的加密存储保存 device token；不得写入普通 SharedPreferences、Room 或日志。
- bootstrap secret 与家庭码按来源连续 5 次失败后限速 15 分钟；返回 `429 RATE_LIMITED` 和 `Retry-After`。Caddy 覆盖外来转发地址头，后端仅信任来自 Caddy 私有网络对端的客户端地址头。部署者可通过受限服务端命令重置家庭码；该操作不删业务数据，但吊销全部旧设备令牌。

认证限流确定语义：

- 只覆盖 bootstrap secret 校验和 register family code 校验，scope 分别为 `bootstrap`、`register`。`ALREADY_INITIALIZED`、`NOT_INITIALIZED`、schema 错误和已鉴权接口失败不计入凭证失败。
- 来源键取 Caddy 验证后的客户端地址：IPv4 使用完整地址，IPv6 归一到 /64；服务端以独立 HKDF context 派生 HMAC key，对 UTF-8 字节串 `v1:<scope>:<canonicalSource>` 做 HMAC-SHA256，只保存其十六进制结果，不保存/记录明文 IP。
- 每个 `(scope,sourceKeyHash)` 在 AuthAttemptThrottle 行锁事务内原子处理。正确凭证在提交成功时删除计数；错误凭证递增，达到第 5 次的响应即为 `429 RATE_LIMITED` 并设置 `locked_until=now+15min`。锁定期内不执行昂贵 hash 验证，直接返回剩余秒数。
- 15 分钟到期后的首次尝试先把失败计数重置为 0 再校验；若仍错误则记为新周期第 1 次。计数持久化在 PostgreSQL，服务重启不清零；并发请求不能绕过第 5 次阈值。

### 7. 提醒与定时任务

> Post-MVP 设计，归属 roadmap v0.8，不进入 v0.1 开发范围。

| 类型 | 触发逻辑 | 示例 |
|---|---|---|
| 备菜提醒 | 计划中某餐的前 N 小时 | "明天中午要做糖醋排骨，今晚记得腌肉" |
| 采购提醒 | 采购清单生成后 / 指定日期 | "周末该去买菜了" |
| 食材过期提醒 | 库存 expiry_date 前 N 天 | "冰箱里的牛奶后天过期" |
| 计划未确认提醒 | 每周固定时间，若本周计划未生成 | "这周还没安排菜单，要不要生成一个？" |
| 自定义提醒 | 用户通过对话设置 | "明早提醒我泡黄豆" |

实现方式：

- 后端 node-cron 每分钟扫描 notify_rules 表 → 匹配触发 → 写入 pending_notifications
- App WorkManager 每 15 分钟拉取待推送项 → 发本地 Notification → 确认已推送
- 不依赖第三方推送 SDK
- 提醒规则在设置页可查看和开关

## 技术选型汇总

| 层 | 选择 |
|---|---|
| 后端框架 | Node.js + Hono |
| AI SDK | Vercel AI SDK (`ai` + `@ai-sdk/openai`) + Zod |
| ORM | Drizzle |
| 数据库 | PostgreSQL 16 |
| AI 模型 | 部署端配置唯一默认模型 + 多模型可切换，v0.1 仅 OpenAI-compatible 格式 |
| Android UI | Kotlin + Jetpack Compose + Material 3 |
| 本地存储 | Room |
| DI | Hilt |
| 网络 | Retrofit + OkHttp + kotlinx.serialization |
| 流式 | OkHttp SSE |
| 后台任务 | WorkManager |
| 认证 | 家庭码 + device token（简单认证，无用户体系） |
| 反代 | Caddy（自动 HTTPS） |
| 部署 | Docker Compose（Node + PG + Caddy），自有云服务，CN 区域 |
| 仓库结构 | Monorepo（server/ + app/） |

> 完整选型理由见 [`tech-stack.md`](./tech-stack.md)

## 功能特性

| 特性 | 说明 |
|---|---|
| 对话式交互 | 所有业务操作通过自然语言对话完成 |
| 渐进式录入 | 菜品最小只需名称，AI 后续补充细节 |
| AI 批量冷启动 | "帮我生成 30 个家常川菜"快速填充菜品库 |
| 周计划生成 | 偏好驱动（口味、忌口、近期不重复） |
| 采购清单 | AI 推断食材 + 用户确认，反哺菜品数据 |
| 食材库存追踪 | 采购自动入库 + 计划自动扣减 + 对话修正 |
| 多模型切换 | 设置页切换 AI 模型，立即生效 |
| 多端共享 | 多设备同一份数据，增量同步 |
| 离线可用 | 本地 Room 缓存，离线浏览 + 暂存操作 |
| 提醒通知 | 备菜/采购/过期/计划/自定义 5 类提醒 |
| 简单统计 | 频次、品类分布、时间趋势 |

## 不做的事（Scope Out）

- Web 端
- 多用户/多租户体系
- 精确营养分析（初期仅频次统计）
- 公开注册 / 社交功能
- iOS 支持
- 实时多端推送（初期依赖轮询）
- 复杂权限控制

## 早期全量需求摘要（已被 v0.1 范围替代）

> 此节记录产品愿景，不作为 v0.1 的需求、验收标准或实施清单。正式 MVP 输入以 [`roadmap.md`](../roadmap.md) 的 v0.1 章节为准。

### 目标

构建一个以 AI 对话为核心交互的 Android 家庭饮食规划 App，覆盖菜品管理、食材库存、周计划生成、采购清单、提醒通知和简单统计。

### 用户故事

- As a 家庭成员, I want 通过对话告诉 AI 添加菜品, so that 不用手填表单就能维护菜品库
- As a 家庭成员, I want AI 根据我家口味生成周计划, so that 不用每天想吃什么
- As a 家庭成员, I want AI 推断采购清单并让我确认, so that 买菜有清晰指引
- As a 家庭成员, I want 采购完成后库存自动更新, so that 不用手动记录库存变化
- As a 家庭成员, I want 收到备菜和食材过期提醒, so that 不会忘记准备或浪费食材
- As a 家庭成员, I want 在多台设备上使用同一份数据, so that 家人可以各自查看和操作
- As a 家庭成员, I want 离线时仍能浏览菜品和计划, so that 没网时也能查看安排
- As a 家庭成员, I want 切换不同 AI 模型, so that 可以选择效果更好或更便宜的模型

### 验收标准

- [ ] AC1: 通过对话输入"加个红烧肉"，系统创建菜品记录并返回确认
- [ ] AC2: 通过对话输入"安排下周的菜"，系统生成 7 天 × 3 餐的计划，考虑偏好和近期不重复
- [ ] AC3: 通过对话输入"出采购清单"，系统基于周计划 AI 推断食材并返回清单供确认
- [ ] AC4: 采购清单确认完成后，相关食材自动入库；计划中的菜做完后库存自动扣减
- [ ] AC5: 食材过期前 N 天、计划餐次前 N 小时，App 发出本地通知提醒
- [ ] AC6: 多台 Android 设备输入相同家庭码后共享数据，增量同步延迟 ≤ 30 分钟
- [ ] AC7: 断网状态下可浏览菜品库、库存、周计划、采购清单
- [ ] AC8: 在设置页切换 AI 模型后，下一轮对话使用新模型
- [ ] AC9: 通过"帮我生成 20 个家常川菜"批量创建菜品，冷启动菜品库

### 非功能需求

- 性能：AI 流式响应首 token ≤ 3s（网络正常时）
- 安全：家庭码 + device token 认证，API Key 不存储在客户端
- 兼容性：Android 8.0 (API 26) 及以上
- 可维护性：AI agent 可高效编写和维护的代码结构

### 已确认的技术决策

- 后端：Node.js + Hono + Drizzle + PostgreSQL
- Android：Kotlin + Jetpack Compose + Room + Hilt + Retrofit
- AI：部署端配置唯一默认模型 + 多模型切换，OpenAI-compatible 格式，Function Calling 驱动
- 认证：家庭码 + device token，简单认证（无用户体系）
- 同步：双向增量同步，Room 离线暂存 + 联网上传，服务端接收顺序为权威源
- 提醒：后端 cron + App WorkManager 本地通知
- 部署：Docker，自有云服务

### 不做的事（Scope Out）

- Web 端
- 多用户/多租户
- 精确营养达标分析
- iOS
- 实时多端推送
- 公开注册/社交
- 复杂权限

### 下一步

→ 以本目录四份现有文档作为 v0.1 开发输入；开发前须关闭本文标记的待确认项，并以 [`roadmap.md`](../roadmap.md) 的验收标准作为交付门禁。

## 竞品调研（2026-07-11，深度更新）

> 基于 deep-research 工作流：5 角度并行搜索 → 24 来源 → 86 论点 → 25 个 3 票对抗验证 → 6 个高置信度确认。完整报告见 `wf_f8eb56ff-a40`。

### 验证发现

| # | 发现 | 置信度 | 来源 |
|---|---|---|---|
| 1 | **开源生态已成熟** — RecipeLLM（Open WebUI + Mealie + Letta Agent + PostgreSQL，docker-compose 一键部署）和 CookTrace（19 个 function-calling tools，支持 Anthropic/OpenAI/Gemini/自定义 OpenAI 兼容，v1.0.0-rc.4 发布于 2026-07-11） | 高 | GitHub 源码直接检查 |
| 2 | **CV 拍照是差异化利器** — Ollie 用拍照识别冰箱/ pantry 食材来做菜品推荐，CNET 评测者称其为"最喜欢的特性" | 高 | CNET + App Store 双重验证 |
| 3 | **库存追踪仍是稀缺能力** — DishGen 完全没有库存管理，每次对话需手动输入食材，无持久化 pantry | 高 | 5 个独立来源一致 |
| 4 | **Commerce 集成模式出现** — Fresh 集成 Instacart + DoorDash，AI 预填购物车直达配送 | 中 | 创始人宣称 + App Store 验证 |
| 5 | **定价收敛** — $10/月（年付 ~$7/月），7 天免费试用成为标准获客漏斗 | 高 | CNET + App Store + Google Play |
| 6 | **市场三分** — Agentic 工具调用平台 vs 对话式菜谱生成 vs 电商集成的"餐到配送"管道 | 综合 | — |

### 被推翻的假设

- ~~DishGen 有免费版 + 付费解锁~~ → 具体定价模式仍不确定
- ~~CookTrace 离线优先架构~~（1-2 票推翻，Capacitor App 离线能力被夸大）
- ~~AI 菜品规划市场规模 $0.83B → $1.03B~~（3-0 推翻，报告来源不可靠）
- ~~MyFitnessPal 收购 Intent~~（1-2 票推翻）

### 竞品矩阵（2026-07）

| 维度 | CookTrace | Ollie | DishGen | Fresh | RecipeLLM | Remy | Samsung Food | **MealMate** |
|---|---|---|---|---|---|---|---|---|
| **交互模型** | AI Chat + Tools | 表单 + AI 建议 | 对话式生成 | 表单 + AI | AI Chat | 表单 + AI | AI 建议 | **对话式 All-in** |
| **库存追踪** | ✅ | ❌ | ❌ | ❌ | ❌ (via Mealie) | ✅ 轻量 | ❌ | **✅ 全链路** |
| **周计划** | ✅ 手动 | ✅ AI | ❌ | ✅ AI | ✅ (Mealie) | ✅ AI | ✅ AI | **✅ AI 对话** |
| **采购清单** | ✅ | ✅ | ❌ | ✅ + 配送 | ❌ | ✅ | ❌ | **✅ AI 推断** |
| **FC Tools** | ✅ 19 | ❌ | ❌ | ❌ | ✅ Letta | ❌ | ❌ | **✅ 11+** |
| **CV 识别** | ❌ | ✅ 拍照 | ❌ | ❌ | ❌ | ❌ | ✅ 食材识别 | **待定** |
| **Commerce** | ❌ | ❌ | ❌ | ✅ Instacart | ❌ | ✅ 超市对接 | ✅ 零售商 | **N/A** |
| **离线** | ❌ (推翻) | ❓ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ 设计** |
| **开源** | ✅ MIT | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | **待定** |
| **定价** | 免费自部署 | $10/月 | 付费 | 付费 | 免费自部署 | 付费 | 订阅 | **私有** |
| **平台** | Web + Android | iOS + Android | Web | iOS | Web | iOS | iOS + Android | **Android** |

### 调研盲区（未覆盖）

- **中国市场 App**（下厨房、豆包等）的 AI 功能深度 —— 无验证发现存活
- **Reddit/HN/PH 用户声音** —— 无验证发现存活
- **AI 流式 UI 模式**在各竞品中的具体实现 —— 无验证发现存活
- **所有竞品的用户量数据** —— 全部被推翻或无法验证

### 更新后的关键洞察

#### 1. 对话式 + 全链路 = 市场空白（维持）

- DishGen 做了对话式但只管菜谱生成
- CookTrace 做了全链路（计划+采购+库存+过期）但偏向工具调用而非自然对话
- Remy 做了全链路但不是对话式
- 没有产品同时做到"自然对话式交互 + 菜品/库存/计划/采购全链路"
- 我们的定位仍然成立，但 CookTrace 是最接近的竞品（19 tools，正在快速迭代）

#### 2. ChatGPT 做饮食规划的痛点（维持，增强）

- 不知道用户的菜品库（每次重新描述）
- 不知道家庭库存（无法扣减）
- 无持久化（下次对话从头来）
- 无采购清单管理（文字输出无法勾选）
- 无提醒能力
- **新增洞察**：开源方案（RecipeLLM + CookTrace）正在解决这些痛点，但需要用户有技术能力自部署
- 我们 = "ChatGPT 做饮食规划的痛点全部解决版 + 无需技术能力的开箱即用 App"

#### 3. 库存追踪是差异化杀手锏（维持，增强证据）

- 竞品矩阵明确显示：只有 CookTrace 和 Remy 做了库存，大部分没有
- CV 拍照盘库存（Ollie 验证了用户喜爱度）是降低库存维护成本的关键
- 我们的设计（采购自动入库 + 计划自动扣减 + 对话修正 + 拍照识别）最完整

#### 4. 开源竞品是新的威胁和机会

- CookTrace 的 19-tool 架构直接对标我们的 function calling 设计 — 需要研究其实现
- RecipeLLM 证明了"编排现有 OSS 组件"这条路可行
- **机会**：我们可以借鉴 CookTrace 的 tool 设计，同时提供他们缺失的"自然对话体验 + 移动端原生 App"

#### 5. CV 拍照是被验证的差异化方向

- Ollie 在 App Store 评分和 CNET 评测中，拍照识食材是最受好评的特性
- 竞品中仅 Ollie 和 Samsung Food 做了 CV
- 我们可以在"拍照录菜"和"拍照盘库存"两个场景上做

### 可借鉴的设计（更新）

| 来源 | 借鉴点 | 优先级 |
|---|---|---|
| CookTrace | 19 个 function-calling tool 的定义和参数设计（源码可读） | 高 — 直接参考 |
| Ollie | CV 拍照识别食材 → 降低库存维护成本 | 高 — 验证过的 UX |
| Ollie | 食材复用作为周计划约束 | 中 — 已有设计 |
| Fresh | Instacart 预填购物车模式 → 未来可对接社区团购 | 低 — CN 市场暂无需求 |
| Remy | 库存极低门槛建立（"25 秒建立"理念） | 高 — 已有设计 |
| DishGen | AI Chef Chat 来回对话调整的交互 | 中 — 已有设计 |
| FoodiePrep | Agentic AI — AI 不只建议，直接执行操作 | 中 — 已有设计 |
| RecipeLLM | Docker Compose 一键部署的运维体验 | 中 — 部署时可参考 |

### 调研后设计补充

基于竞品调研，补充以下设计点：

#### 补充 1：库存极简初始化

用户可以对 AI 说"我家冰箱有鸡蛋、牛奶、西红柿、猪肉…"一句话批量建库存。AI 解析后自动创建多条 Stock 记录，推断类别和大致保质期。目标：30 秒内完成首次库存建立。

#### 补充 2：食材复用作为计划约束

AI 生成周计划时，优先安排共享食材的菜品组合（例如：周一用西红柿做番茄炒蛋，周三用剩余西红柿做番茄牛腩），减少采购品类和食材浪费。

#### 补充 3：快过期食材优先消耗

AI 生成计划或用户请求建议时，自动检查库存中即将过期的食材，优先推荐使用这些食材的菜品。对话中主动提示："鸡蛋还有 3 天过期，要不要明天安排个蛋类菜？"

#### 补充 4：新增 Function

| Function | 作用 | 示例触发语 |
|---|---|---|
| `batch_init_stock` | 一句话批量建库存 | "冰箱里有鸡蛋牛奶西红柿猪肉" |
| `suggest_use_expiring` | 推荐消耗快过期食材的菜品 | "有什么快过期的要用掉？" |

#### 补充 5：CV 拍照盘库存（新增，基于 Ollie 验证）

拍照识别冰箱/菜篮中的食材 → AI 解析食材列表 → 用户确认后批量入库。与"一句话批量建库存"互补：文字适合初始化，拍照适合日常快速更新。

#### 补充 6：CookTrace 竞品深度分析（新增）

CookTrace 是当前最接近的技术竞品，需要单独分析其 tool 设计：
- 19 个 tools 覆盖 recipe/pantry/shopping/cook-log
- 多 provider 支持（我们已设计）
- 缺失：自然对话体验（偏"工具调用"风格）、移动端原生 App（Capacitor 套壳）、离线能力（宣称但被推翻）、提醒通知系统
- **结论**：CookTrace 是开发者的工具，MealMate 是家庭的 App

#### 补充 7：MVP 范围定义（2026-07-12，第三轮聚焦）

**MVP 一句话**：AI 多轮对话管理菜谱 + 生成周计划。证明"对话式饮食管理比通用 ChatGPT 强"。

##### MVP 做什么

| 模块 | MVP 范围 | 不做 |
|---|---|---|
| **菜谱管理** | 对话增删改查、批量 AI 生成、标签搜索、多轮补充完善 | — |
| **周计划** | AI 对话生成 7 天 × 3 餐、对话调整单餐（一餐一菜） | 多菜搭配、荤素平衡 |
| **对话 AI** | 8 个 function calling、设备级模型选择、SSE 流式、多轮上下文 | 快捷 refine 按钮、上下文压缩 |
| **偏好** | 设置页一段纯文本 → System Prompt | FamilyRole 表、动态学习 |
| **认证** | 家庭码 + device token（简单认证） | — |
| **同步** | Room 本地缓存；轻操作以幂等 action 上传，按服务端接收顺序应用；离线 AI 消息提示失败并可手动重发 | 实时推送、离线 AI 队列 |

##### MVP 用户故事

- 用户说"加个红烧肉"→ 创建菜品
- 用户说"红烧肉的食材帮我补一下"→ 多轮完善菜谱
- 用户说"帮我生成 20 个家常川菜"→ 生成批量预览，用户确认后创建
- 用户说"安排下周的菜，少辣"→ 7 天 × 3 餐计划
- 用户说"周三中午换一个"→ 调整单餐
- 设置页改偏好文字 → 下轮对话生效
- 设置页切换模型 → 下轮对话用新模型

##### MVP 不做

| 砍掉 | 理由 | 什么时候 |
|---|---|---|
| 食材字典（Ingredient） | Recipe.ingredients 用自由文本数组即可 | v0.2 |
| 库存管理（Stock） | 不是菜谱+计划核心闭环，依赖食材字典 | v0.3 |
| 采购清单（ShoppingList） | 依赖库存+食材字典 | v0.4 |
| 一餐多菜（Meal.dishes[]） | PlanItem 1:1 够用 | v0.5 |
| 提醒通知 | 整套基础设施太重 | v0.8 |
| CV/语音/统计 | 非核心 | v1.0+ |

##### MVP 验收标准

- [ ] AC1: 对话"加个红烧肉"→ 菜品创建 + AI 确认回复
- [ ] AC2: 对话"帮我生成 20 个家常川菜"→ 只生成预览、零业务写入；同设备确认后才批量创建，重复确认不重复写入
- [ ] AC3: 对话"安排下周的菜，少辣"→ 新周生成 7 天 × 3 餐并可调整单餐；同周已有计划时只生成预览，确认覆盖前原计划不变
- [ ] AC4: 设置页切换模型 → 下轮对话生效；修改偏好文字 → System Prompt 更新

##### MVP 后端模块

```
server/src/
├── routes/          # chat, models, recipes, plans, settings, auth, confirmations, sync, health
├── services/
│   ├── ai/          # router, providers, functions, executor
│   ├── recipe.ts
│   └── plan.ts
├── db/              # Drizzle schema + migrations
└── middleware/      # device auth, error handling
```

##### MVP App 页面

| 页面 | 功能 |
|---|---|
| 对话主页 | AI 多轮对话入口，所有操作从这里发起 |
| 菜品库 | 浏览、搜索、查看详情 |
| 周计划 | 日历视图展示本周三餐安排 |
| 设置 | 模型切换、偏好文字编辑、家庭码轮换、设备列表/撤销、当前设备注销与同步状态；不含角色、提醒或 Provider 凭据配置 |

导航：Bottom Nav（对话、菜品、计划、设置）

## 下一步

- 产品功能全景 → [`product-design.md`](./product-design.md)
- 技术选型 → [`tech-stack.md`](./tech-stack.md)
- 里程碑规划 → [`roadmap.md`](../roadmap.md)
- 开发时直接维护并同步这四份现有文档，不新增平行的 spec/design/plan

## Decisions

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| MVP 家庭模型 | 单家庭 / 多家庭 | 单家庭 | v0.1 仅服务一个家庭部署，多家庭数据隔离留到后续架构重审。 |
| 初始化密钥来源 | 部署环境变量 / App 生成 | 部署环境变量 | 部署者设置 `MEALMATE_BOOTSTRAP_SECRET` 并线下分享，避免 App 自行建立信任根。 |
| 确认令牌归属 | 任意家庭设备 / 仅预览发起设备 | 仅预览发起设备 | 令牌仅对创建预览的设备有效，且在 10 分钟内过期。 |
| 确认交互通道 | 用户另发确认消息 / 固定结构化 SSE 面板 | `confirmation-required` 固定面板 | token 直接交给 App 且模型不可见；不引入通用混合消息渲染。 |
| 确认面板编辑 | 只读预览 / 面板内编辑 | 只读预览 | 面板只提交原草稿；删项或改名通过继续对话生成完整新预览，避免新增修订 API 与双重编辑路径。 |
| 家庭码泄露处理 | 不可变 / 设置中轮换 | 设置中轮换 | 新家庭码立即使旧码失效，已加入设备继续可用。 |
| 设备权限 | 区分管理员 / 全设备平等 | 全设备平等 | 已加入的任一设备均可改家庭偏好、轮换家庭码和撤销其它设备。 |
| 找回家庭码 | 自助找回 / 部署者重置 | 部署者受限命令重置 | 找回时不清数据，但撤销全部旧设备令牌，所有设备需重新加入。 |
| 设备撤销 | 全部重置 / 单设备撤销 | 设置页按设备撤销 | 日常可查看设备列表并单独撤销指定令牌。 |
| 设备令牌有效期 | 固定过期 / 直到撤销 | 直到登出、撤销或恢复重置 | 家庭自用场景优先减少重新登录摩擦。 |
| 暴力尝试防护 | 无限制 / 限速 | 连续 5 次失败后限速 15 分钟 | 针对家庭码和初始化密钥的来源级防护。 |
| 家庭码格式 | 12 位 / 26 位 Crockford Base32 | 12 位，`XXXX-XXXX-XXXX` | 60 bit 随机性配合来源级限流，在家庭私有场景兼顾安全与手工输入。 |
| 家庭码哈希 | Argon2id / scrypt | Argon2id 64 MiB、t=3、p=1 | 固定实现参数，避免开发阶段继续分叉；使用 16-byte salt 与 32-byte output 的 PHC 字符串。 |
| 对话上下文 | 家庭共享 / 设备独立 | 设备独立 | 每台设备有自己的对话上下文，菜谱与计划仍在家庭内共享。 |
| 模型选择范围 | 家庭共享 / 设备本地 | 设备本地 | 各设备自行选择已启用的模型，不影响其它设备。 |
| Provider 凭据配置 | App 输入并保存 / 仅部署端配置 | 仅部署端受限配置 | App 只能选择已启用模型，避免凭据进入客户端或普通业务数据。 |
| 可选模型 | 全部展示 / 仅兼容模型 | 仅展示声明兼容且发布前 verify 通过的模型 | 启动时只做静态配置校验；部署前显式探测流式与工具调用，运行时不因外部网络波动切换模型。 |
| 第三方模型数据提示 | 专门确认 / 不新增提示 | 不新增提示 | 家庭成员已知对话数据会发送给其选择的模型提供方。 |
| 模型不可用 | 自动切换 / 用户决定 | 不自动降级 | 明确失败，用户可重试或手动切换模型，避免静默改变数据处理方。 |
| LLM 工具调用重试 | 所有调用自动重试 / 只重试安全调用 | 只自动重试无副作用调用 | 写操作依靠幂等键，不做盲重试。 |
| 单条消息工具调用上限 | 有上限 / 无上限 | 无上限 | 个人使用接受成本和异常循环风险。 |
| 流式超时 | 短超时 / 60 秒无事件或总计 5 分钟 | 60 秒无事件或总计 5 分钟 | 超时结束为可重试错误。 |
| 聊天崩溃恢复 | 失败关闭 / 用户重试时租约恢复 | 用户重试时租约恢复 | 30 秒租约、10 秒心跳和 generation fencing；复用已完成工具回执，不后台自动恢复。 |
| 同设备聊天并发 | 允许并行 / 设备级单飞 | 设备级单飞 | 同设备只允许一个有效聊天租约；不同 ID 并发返回 `CHAT_DEVICE_BUSY`，不排队、不提供取消 API。 |
| 后端 lint/format | Biome / ESLint + Prettier | Biome | 单一工具覆盖 TypeScript 检查与格式化，减少 MVP 配置面和工具冲突。 |
| 日志内容 | 保留正文 / 仅元数据 | 仅元数据 | 记录 requestId、模型、耗时、错误和工具名，不记录对话正文或工具参数。 |
| 用户数据进入提示词 | 作为指令拼接 / 明确不可信数据 | 明确为不可信用户数据 | 后端以 schema、鉴权与确认机制约束工具，避免提示注入越权。 |
| 离线 AI 消息 | 排队自动发送 / 显示失败手动重发 | 显示失败并保留草稿 | 用户可在网络恢复后主动重新发送。 |
| 离线共享偏好 | 直接排队提交 / 本地草稿 | 本地草稿 | 联网后由用户手动保存，避免共享状态静默覆盖。 |
| 同步冲突顺序 | 客户端时间 / 服务端接收顺序 | 服务端接收顺序 | 客户端时间仅作展示，服务端按 action receipt 的接收顺序裁决。 |
| 同步拒绝项 | 静默丢弃 / 保留失败记录 | 保留失败记录 | 展示原因并允许丢弃或按当前数据重新编辑。 |
| 同步回执与墓碑保留 | 定期清理 / v0.1 永久保留 | v0.1 永久保留 | 以存储换取幂等、删除传播和恢复操作的可追溯性。 |
| 删除后编辑 | 可复活 / 禁止普通复活 | 禁止普通复活 | 已删除菜谱不能被普通补丁恢复，需显式恢复。 |
| 恢复菜谱入口 | UI 恢复 / AI 工具恢复 | `restore_recipe` 工具 | 用户以自然语言恢复；只搜索已删除项，多候选时要求选择。 |
| 重名菜谱 | 禁止 / 允许 | 允许 | 后续按名称更新、删除或替换时必须先搜索，零个或多个候选都要澄清。 |
| 批量生成同名项 | 自动创建 / 默认跳过 | 默认跳过并警告 | 用户可在确认预览中改名后保留变体。 |
| 菜谱搜索 | 同义词与语义搜索 / 字段包含匹配 | 不区分大小写的字段包含匹配 | 仅匹配名称、标签与自由文本食材，同义词留到 v0.2。 |
| 计划生成候选范围 | 全量上下文 / 服务端精选至多 100 条 | 服务端精选 | 按名称、标签、近期计划和需求选候选，模型可再搜索。 |
| 生成计划时菜谱不足 | 自动新建 / 复用并说明 | 复用现有菜谱并说明 | 不自动创建未确认的新菜谱。 |
| 避免重复规则 | 不限制 / 避开近 7 天 | 避开近 7 天 | 菜谱不足时允许复用，但必须说明。 |
| 时区 | 可配置 / 固定 | `Asia/Shanghai` | v0.1 单家庭部署统一使用上海时区。 |
| 删除被计划引用的菜谱 | 允许删除 / 拒绝当前或未来引用 | 拒绝当前或未来引用 | 用户需先替换或移除当前、未来计划中的引用。 |
| 历史计划与已删菜谱 | 依赖原菜谱 / 保存名称快照 | 保存 PlanItem 名称快照 | 历史计划可在原菜谱删除后仍正确展示。 |
| 同周计划覆盖历史 | 保留版本 / 仅保留最新 | 仅保留最新 | 创建新周计划覆盖同一周，过往周永久保留，不做版本历史。 |
| 自动备份 | 提供 / 不提供 | 不提供 | MVP 验证交互价值；已接受数据丢失风险，并依赖现有服务器快照或备份。 |
