# MealMate Lite — 技术选型

> 本文档记录 MealMate Lite 的技术选型决策与理由。
>
> - 产品功能 → [`product-design.md`](./product-design.md)
> - 版本里程碑 → [`roadmap.md`](../roadmap.md)
> - 探索记录 → [`brainstorm.md`](./brainstorm.md)

## 选型总览

| 层 | 选择 |
|---|---|
| 后端框架 | Node.js + Hono |
| AI SDK | Vercel AI SDK (`ai` + `@ai-sdk/openai`) |
| FC 参数校验 | Zod |
| ORM | Drizzle |
| 数据库 | PostgreSQL 16 |
| Android UI | Kotlin + Jetpack Compose + Material 3 |
| Android 状态 | ViewModel + StateFlow |
| 本地存储 | Room |
| DI | Hilt |
| 网络 | Retrofit + OkHttp + kotlinx.serialization |
| 流式 | OkHttp SSE |
| 后台任务 | WorkManager |
| 导航 | Navigation Compose |
| 认证 | 家庭码 + device token（简单认证，无用户体系） |
| 反代 | Caddy（自动 HTTPS） |
| 部署 | Docker Compose（Node + PG + Caddy） |
| 后端测试 | Vitest |
| Android 测试 | JUnit 5 + Turbine（JVM）+ AndroidX JUnit 4 / Compose Testing（仪器） |
| 后端 lint / format | Biome |
| Android lint | ktlint + detekt |
| 包管理 | pnpm（后端）、Gradle Kotlin DSL（Android） |
| 仓库结构 | Monorepo（server/ + app/） |

## 不做的选择

| 不选 | 原因 |
|---|---|
| Express / Fastify / NestJS | Express 性能差无类型；Fastify 插件复杂；Nest 太重 |
| Prisma / TypeORM | Prisma 运行时重、迁移僵硬；TypeORM 类型差 bug 多 |
| MySQL / SQLite | PG 原生 Array/JSON 更适合 tags[]、ingredients[]、messages[] |
| openai-node 直接用 | 多模型切换需自己封装，FC 流式解析要手写 |
| Flutter / React Native | 跨平台对 SSE/离线/通知的支持不如原生，且明确不做 iOS |
| Nginx | Caddy 自动证书零配置，个人项目不需要 Nginx 的灵活性 |
| 多语言 i18n | 私人家庭中文场景，维护成本不值得 |
| 分仓 | 一人开发，API 契约同步和 AI agent 上下文完整性更重要 |

---

## 后端详细选型

### Hono

- 轻量（核心 < 14KB），启动快
- 类型安全路由：路径参数、query、body 全程类型推导
- 原生 SSE 支持：`streamSSE()` 处理 AI 流式回复
- 中间件模式简洁直觉
- AI agent 编码效率高：代码量少、模式统一

### Drizzle

- Schema 即类型：定义一次，查询结果自动推导
- SQL-like API：会写 SQL 就会用，AI 生成准确率高
- 迁移简单：`drizzle-kit generate` 自动生成 migration
- 零运行时开销：不需要 Query Engine 二进制

### PostgreSQL

- Array 列原生支持 `tags[]`、`ingredients[]`
- JSONB 支持对话消息存储
- 全文搜索内置（菜品搜索可用）
- 未来扩展（向量搜索 pgvector）无缝

### Vercel AI SDK

- 统一多 provider 抽象：DeepSeek / OpenAI / 通义 / Anthropic 同一套 API
- 流式 Function Calling 内置：不用手动拼 delta、解析 tool_calls
- `streamText()` / `generateText()` 一行完成调用
- Zod 定义 FC 参数 schema，类型安全
- 与 Hono SSE 天然配合

### 模型切换机制

- v0.1 仅接入 OpenAI-compatible Provider。Provider API Key、baseURL、模型标识和启用状态只在部署端受限环境配置；不写入数据库、接口响应、日志或客户端，也不提供 App 侧录入或运行时修改入口
- 服务端只向 App 返回已启用且部署配置声明 `capabilities.streaming=true`、`capabilities.tools=true` 的模型目录；其中必须恰有一个 `isDefault=true`，新设备首次使用自动选它。后续模型选择保存在设备本地，并作为该设备聊天请求的 `modelId`，不形成家庭共享的 active model。每次请求均服务端 allowlist 校验，未知、停用或不兼容模型返回 `422 MODEL_UNAVAILABLE`
- 设置页切换 → 仅当前设备的下一轮对话生效；模型不可用时明确失败，用户重试或手动切换，不自动降级到其它 provider
- Provider 接口统一：所有模型走 OpenAI 兼容格式；Function Calling 定义与模型解耦

---

## Android 详细选型

### Jetpack Compose + Material 3

- 声明式 UI：纯函数描述界面，AI 生成效率高
- Material 3：深色模式 + Dynamic Color 零额外成本
- 无 XML：一套 Kotlin 代码搞定 UI + 逻辑
- 组件化天然适合聊天界面（LazyColumn + 气泡组件）

### 架构分层

```
UI Layer (Compose Screen/Component)
  → ViewModel (StateFlow, 单向数据流)
    → Repository (数据协调)
      → Room (本地) + Retrofit (远端)
```

### Room

- 编译时校验 SQL 正确性
- Flow 响应式查询：数据变化自动通知 UI
- 支持离线缓存 + pending_actions 暂存
- 迁移机制内置

设备本地的非敏感模型选择可存于 SharedPreferences；家庭共享偏好不在离线时写入 `pending_actions`，只保存为本地草稿，待用户联网后手动提交。被拒绝的乐观同步动作必须在同一 Room 事务中先应用服务端返回的资源快照，再标记为同步失败。

v0.1 Android 本地表：

| 表 | 关键字段 | 约束与用途 |
|---|---|---|
| `recipes` | `id` PK、业务字段、`server_version String`、`deleted_at?` | 镜像 RecipeView/墓碑；搜索仅查未删除行 |
| `weekly_plans` | `id` PK、`week_start` UNIQUE、`server_version String`、timestamps | WeeklyPlan 聚合头 |
| `plan_items` | `id` PK、`weekly_plan_id` FK CASCADE、date、meal_type、recipe_id、name_snapshot | UNIQUE `(weekly_plan_id,date,meal_type)`；只能随完整 WeeklyPlan 聚合替换 |
| `settings_cache` | `key` PK、`value`、`server_version String` | v0.1 仅 `familyPreference` 的服务端已确认值 |
| `conversation_messages` | 自增本地顺序、role、content、chat_request_id、created_at | 当前设备最多 40 条；完整 user/assistant 轮次原子替换/裁剪 |
| `pending_actions` | `action_id` PK、type、payload_json、payload_hash、created_at、state、attempt_id?、claimed_at? | 只允许 `recipe.patch/delete`；state 为 pending/sending/failed；sending 必须有 attempt/claim 字段 |
| `sync_failures` | `action_id` PK、err_code、err_message、authoritative_json?、server_version?、created_at | 保留被拒绝动作，供丢弃或基于权威状态重新编辑 |
| `sync_state` | `singleton` PK、cursor?、last_success_at? | 仅在整页变更成功提交后推进 cursor |
| `chat_draft` | `singleton` PK、message、updated_at | 只保存未发送草稿；不属于 pending action，不触发后台发送 |

Room 中的 `server_version` 使用只含十进制正整数的 String 值对象比较，不转 Long；页面 sync 在一个 `withTransaction` 中应用所有 changes、处理 tombstone 并更新 cursor。收到完整 WeeklyPlan 时先 upsert 计划头，再以同一事务替换其全部 21 个 PlanItem，避免半周状态。

本地同步状态机：

- 全 App 只有一个 `SyncCoordinator`；前台触发和 WorkManager 都调用它，并由 process-wide Mutex 单飞。30 分钟周期任务使用唯一任务名 `mealmate-sync-periodic` 与 `ExistingPeriodicWorkPolicy.KEEP`，立即同步使用唯一任务名 `mealmate-sync-now` 与 `ExistingWorkPolicy.KEEP`；两者最终都进入同一 Mutex，不得启动第二套上传器。
- 每轮开始先在 Room transaction 把 `state= sending AND claimed_at < now-5min` 的项恢复为 pending；再按 `(created_at,action_id)` 选择最多 100 个 pending，生成一个 `attempt_id` 并原子标为 sending/claimed_at。网络层只能发送本次 attempt 的 action IDs。
- 收到逐项 ACK 后在一个 transaction 应用权威资源、写 sync failure、按 applied/duplicate 删除 pending action 或按 rejected 转 failed。网络/进程在 ACK 前失败时不猜测服务端结果；将本 attempt 恢复 pending，之后以原 actionId 重投。
- App 启动、切前台和 Worker 开始时都执行 stale-claim 恢复；5 分钟只用于本地发送 claim，不改变服务端动作幂等或聊天租约。测试通过注入 Clock 推进时间，不使用 sleep。

### 认证凭证存储

- device token 使用 Android Keystore 保护的加密存储；不得保存在普通 SharedPreferences、Room 或日志。
- token 仅在注册响应中接收一次。收到 401 后清除本地凭证并回到设备注册流程；用户注销时调用服务端吊销接口后再清除本地凭证。

### WorkManager

- 系统保活，进程杀掉后自动恢复
- 约束条件：必须有网才同步
- 对读取同步可使用指数退避；同步动作只按 `(deviceId, actionId)` 重新投递，绝不以重试重新执行业务写入。回执保存动作类型与规范化 payload 哈希；相同 ID 不同哈希必须返回 `409 IDEMPOTENCY_KEY_REUSED`。AI Function Calling 的写操作不做盲重试
- 适合：定期同步（30 分钟）、切前台触发同步、拉取待推送通知

### OkHttp SSE

- 原生 Server-Sent Events 支持
- 配合 Kotlin Flow collect 实现逐字渲染
- 事件协议为 `start`、`delta`、`tool-status`、`confirmation-required`、`error`、`done`，均带单调 `eventId`；confirmation-required 是唯一结构化业务事件。建立流前使用 JSON 错误响应，建立后只通过 `error` 事件报告失败
- 60 秒无事件或单次流总时长 5 分钟即结束为可重试错误；不后台自动重发 AI 消息。中断重试复用同一 `chatRequestId`：已完成请求重放持久化最终响应，活动租约返回 `CHAT_IN_PROGRESS`，过期租约由用户重试接管；同设备另一 ID 的有效租约返回 `CHAT_DEVICE_BUSY`。App 请求进行中禁用发送，不排队、不提供取消；离线未送达草稿的手动重发才生成新 ID
- App 以 `chatRequestId` 作为流式 assistant 草稿键；只有收到 `done` 才转为正式消息。流内 `error` 或连接中断保留失败态供用户查看，但点击重试时必须先清除/替换旧 delta，再渲染重试流；进程重启只从服务端读取 completed 历史，不恢复半条回复。

### Hilt

- 编译时依赖注入，Android 官方推荐
- ViewModel、Repository、Worker 自动获得依赖
- 减少样板代码

### 不做的 Android 选择

| 不做 | 原因 |
|---|---|
| 多语言 | 私人家庭中文场景 |
| 深色模式（额外工作） | Material 3 自动支持，不需要额外开发 |
| Jetpack DataStore | Room 已覆盖持久化需求，设置项用 SharedPreferences 够了 |
| Ktor Client | Retrofit 生态更成熟，拦截器机制更灵活 |

---

## 部署架构

```
┌─────────────────────────────────┐
│         自有云服务器（CN）        │
│                                 │
│  ┌───────────┐  ┌────────────┐ │
│  │  Node.js  │  │ PostgreSQL │ │
│  │  (Hono)   │──│   16       │ │
│  │  :3000    │  │  :5432     │ │
│  └───────────┘  └────────────┘ │
│        │                        │
│  ┌───────────┐                  │
│  │   Caddy   │  ← 自动 HTTPS   │
│  │  :443     │                  │
│  └───────────┘                  │
└─────────────────────────────────┘
         ↕ HTTPS
    ┌──────────┐
    │ Android  │
    │   App    │
    └──────────┘
```

### Caddy

- 自动获取 + 续期 Let's Encrypt 证书
- 配置极简（三行反代）
- 适合个人项目，不需要 Nginx 的复杂功能

### Docker Compose

生产以 `docker compose --profile production up -d --build --wait` 启动全部服务，v0.1 的编排契约如下：

```yaml
services:
  db:       # PostgreSQL 16；健康检查通过后才能运行 migrate
  migrate:  # depends_on db: service_healthy；一次性迁移，成功退出 0
  app:      # depends_on db: service_healthy、migrate: service_completed_successfully
  caddy:    # profiles: [production]；depends_on app healthy；映射宿主 80/443
secrets:
  db_password:
    file: ${MEALMATE_DB_PASSWORD_FILE} # 部署机上的只读密码文件
```

- 网络分为 `edge` 与 `internal`：Caddy 同时加入两者，app/db/migrate 只加入 `internal`；生产 Compose 不暴露 app 的 3000 和 PostgreSQL 的 5432 到宿主。
- 使用 `pg_data`、`caddy_data`、`caddy_config` 命名 volume；生产数据不使用源码目录 bind mount。v0.1 不承诺自动备份，但不得把 `docker compose down` 写成删除 volume 的命令。
- db healthcheck 固定执行 `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`；`migrate` 固定执行 `node dist/cli.js db migrate` 且 `restart: "no"`。app 的容器 healthcheck 分别调用 `node dist/healthcheck.js live` 与 readiness 所需的 `node dist/healthcheck.js ready`；Compose 启动门禁以 ready 检查为准。Caddy 启动前先执行 `caddy validate --config /etc/caddy/Caddyfile`，其 healthcheck 请求自身的 `/health/live`。迁移失败、数据库 schema 版本不匹配、必填配置缺失或 secret 文件不可读时 migrate/app 必须非零退出，readiness 不得成功，也不得带旧 schema 运行。
- app 使用 Node 22 的多阶段镜像、pnpm lockfile frozen install、非 root 用户和 exec-form entrypoint；runtime 镜像不包含编译工具、源码凭据或开发依赖。阶段 0 必须把 Node、PostgreSQL 16 和 Caddy 2 镜像固定到“完整 semver tag + sha256 digest”，Compose/Dockerfile 禁止 floating major、`latest` 或仅 tag 引用；升级 digest 单独提交并重跑全部门禁。
- 每个常驻服务设置 `restart: unless-stopped`、healthcheck 和 json-file 日志轮转（单文件 10 MB、保留 3 个）；单机 Compose 不依赖仅对 Swarm 生效的 `deploy.resources` 来声称资源限制。
- app 收到 SIGTERM 后停止接收新 chat/sync 请求，给活动事务和 SSE 最多 30 秒完成，然后退出；未完成聊天不由后台继续，待用户同 ID 重试时按回执租约恢复。

### 部署配置契约

| 配置 | 必填 | 约束与用途 |
|---|---|---|
| `MEALMATE_DB_PASSWORD_FILE` | 是 | Compose 主机侧 secret 源文件路径；文件权限仅允许部署者读取，不挂入 Caddy；Compose 以 `db_password` 名称只读挂给 db/migrate/app |
| `DB_HOST` / `DB_PORT` | 是 | Compose 固定为 `db` / `5432`；只走 internal network |
| `DB_NAME` / `DB_USER` | 是 | db、migrate、app 使用完全相同的值；非空且只允许 PostgreSQL 标识符安全字符 |
| `DB_PASSWORD_FILE` | 是 | app/migrate 固定为 `/run/secrets/db_password`；读取同一个 Docker secret，不接受命令行参数或日志输出中的明文密码 |
| `POSTGRES_DB` / `POSTGRES_USER` | 是 | db 容器分别引用与 `DB_NAME` / `DB_USER` 相同的 Compose 插值值 |
| `POSTGRES_PASSWORD_FILE` | 是 | db 固定为 `/run/secrets/db_password`，与 app/migrate 挂载同一个只读 `db_password` secret |
| `MEALMATE_BOOTSTRAP_SECRET` | 是 | 至少 256 位随机值，推荐 64 位十六进制或 43 位 base64url；启动时校验熵编码长度，不接受示例值。初始化后必须保持不变，因为它还隔离派生 cursor、确认令牌和限流来源键的 HMAC key；恢复重置不轮换它 |
| `MEALMATE_MODELS_FILE` | 是 | 部署机模型目录 strict JSON 的源文件路径；Compose 将其只读挂载至容器内 `/run/config/models.json`。每项含 `id/displayName/baseURL/model/apiKeyEnv/enabled/isDefault/capabilities:{streaming,tools}`，id 唯一，启用且两项能力均为 true 的项目中必须恰有一个默认模型 |
| Provider API Key env | 至少一个 | 环境变量名由模型目录的 `apiKeyEnv` 引用；缺失时对应模型不进入可用 allowlist，全部缺失则 readiness 失败 |
| `MEALMATE_PUBLIC_DOMAIN` | 是 | Caddy 证书与反向代理域名 |
| `TZ` | 是 | 固定为 `Asia/Shanghai`；其它值启动失败 |
| `LOG_LEVEL` | 否 | `info` 默认；生产禁止开启会记录 body 的 HTTP debug 日志 |

启动时先解析全部配置并输出仅含“配置项名称 + 是否有效”的检查结果；不得输出值。Caddy 必须覆盖客户端提供的 `X-Forwarded-*`，app 只信任来自 internal network 中 Caddy 对端的一跳代理信息。

启动/readiness 只做模型目录 strict schema、默认项、API key 存在性与 URL scheme 静态校验，不访问 Provider，避免外部网络波动使本地/CI 不可启动。部署前必须显式执行 `node dist/cli.js models verify`：对每个 enabled 模型在 30 秒内发起固定无敏感数据的流式 no-op tool 探测，同时断言非空 delta 与合法 tool call；命令只输出 model id、pass/fail 和错误类别，不输出 URL/key/响应正文。探测失败阻止该次人工发布，但运行期 Provider 失败仍按 `PROVIDER_ERROR`/`MODEL_TIMEOUT` 明确返回，不自动切换。

Caddy 与 Hono 都限制 JSON body 为 1 MB；SSE 路由关闭响应缓冲和缓存，保持 event frame 及时 flush，并允许单次连接覆盖 5 分钟总超时。Caddy access log 只记录 method、模板化 route、status、耗时和 requestId，不记录 query、Authorization、请求/响应 body 或 confirmation token。

生产 `caddy` 服务只属于 `production` profile，使用 `Caddyfile`、正式域名、公网 ACME 和宿主 80/443；生产命令必须显式带 `--profile production`。本地/CI 叠加 `docker-compose.test.yml`，新增不同服务名 `caddy-test` 且只属于 `test` profile；它依赖同一个 app healthy，挂载 `Caddyfile.test`，监听容器内纯 HTTP `:8080`，禁用 ACME 和公网访问，以 `127.0.0.1::8080` 分配随机宿主端口，并通过 `docker compose --profile test port caddy-test 8080` 取得探针地址。测试 profile 不启用 `production`，因此生产 `caddy` 的 80/443 映射不会创建；禁止在 override 中给同一 caddy service 追加 ports。Caddy test healthcheck 固定请求 `http://127.0.0.1:8080/health/live`；测试镜像必须显式提供该探针所用的 `wget`/`curl`，不得假设基础镜像包含。两种 profile 复用相同 app/db/migrate 镜像、secret 和启动条件，仅边缘服务、配置与宿主端口不同；测试配置将 `MEALMATE_PUBLIC_DOMAIN` 设为保留域名 `test.invalid` 以通过 app 静态校验，但不会解析或访问它。

部署者恢复操作使用受限命令 `docker compose run --rm app node dist/cli.js auth recovery-reset`。命令在单一事务生成新家庭码、更新 AuthConfig 并撤销全部 DeviceToken，不修改 Recipe/WeeklyPlan/Settings；成功后只向当前终端输出一次新家庭码。恢复演练必须验证旧 token 全部 401、旧家庭码注册失败、业务数据仍可读取，并禁止附加 `-v` 或执行任何 volume 删除。

bootstrap 是一次性状态转换，不能在响应丢失后重放敏感明文。客户端收到 `ALREADY_INITIALIZED` 且本地没有 device token 时必须进入“联系部署者恢复”状态，不得循环提交 bootstrap；部署者通过上述 recovery-reset 生成新家庭码后，设备走普通 register。

---

## 仓库结构

Monorepo，后端和 Android 同仓：

```
mealmate-lite/
├── server/              # Node.js + Hono 后端
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── services/
│   │   ├── db/
│   │   └── middleware/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   └── Dockerfile
├── app/                 # Android (Kotlin + Compose)
│   ├── app/
│   │   └── src/main/
│   ├── build.gradle.kts
│   └── settings.gradle.kts
├── docs/                # 产品/技术文档
├── docker-compose.yml   # 部署编排
├── Caddyfile
├── .gitignore
└── README.md
```

---

## 测试策略

| 层 | 工具 | 覆盖 |
|---|---|---|
| 后端单元 | Vitest | Service 逻辑、FC executor、数据转换 |
| 后端集成 | Vitest + testcontainers | API 端到端、DB 交互 |
| Android 单元 | JUnit 5 + Turbine | ViewModel 状态流、Repository 逻辑 |
| Android UI | AndroidX JUnit 4 + Compose Testing | 组件渲染、用户交互 |
| Android 集成 | Gradle Managed Devices | 首次 bootstrap、后续设备注册、令牌吊销、离线草稿重发、同步幂等与服务端接收顺序 |

目标命令（仓库骨架阶段即创建，CI 与本地使用同一命令）：

```bash
mise exec -- corepack pnpm --dir server lint
mise exec -- corepack pnpm --dir server typecheck
mise exec -- corepack pnpm --dir server test:unit
mise exec -- corepack pnpm --dir server test:integration
mise exec -- bash ./app/scripts/provision-android-sdk.sh
./app/gradlew ktlintCheck detekt :app:lintDebug :app:testDebugUnitTest
mise exec -- bash ./app/scripts/run-managed-device-tests.sh ./app/gradlew pixel2Api27DebugAndroidTest pixel6Api36DebugAndroidTest
docker compose -f docker-compose.yml -f docker-compose.test.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile test up --build --wait
```

后端只使用固定精确版本的 `@biomejs/biome`，提交根目录 `biome.json`，`pnpm --dir server lint` 固定执行 `biome check --config-path=.. src/`。格式化与 lint 由同一配置负责，不再引入 ESLint 或 Prettier；生成的 migration 只允许通过 `files.includes` 明确排除，不允许开发者本地静默跳过检查。

`app/build.gradle.kts` 必须声明两个固定的 Gradle Managed Devices：`pixel2Api27`（Pixel 2、API 27、`aosp`、`testedAbi=x86_64`）和 `pixel6Api36`（Pixel 6、API 36、`aosp`、`testedAbi=x86_64`）。CI 不允许用“当前已连接模拟器”替代这两个门禁；升级镜像 API 或设备定义必须通过文档与基线评审。

测试替身与确定性：

- Provider 使用进程内 scripted fake，能按脚本产生 delta、多个 tool call、参数错误、连接中断、60 秒 idle、总时长超时和 provider 5xx；单元/集成测试不访问真实模型或公网。
- 时间、UUID/token 生成器和 `Asia/Shanghai` 当前周计算均通过可注入接口控制；安全随机数实现本身只验证长度/编码，测试不得固定生产 secret。
- DB 集成测试使用真实 PostgreSQL 16 Testcontainers，并从空库执行全部 migration；不 mock Drizzle 或事务。
- Android 网络测试使用 MockWebServer；Room 使用独立的 in-memory DB。每个测试创建自己的数据库/dispatcher，不共享顺序依赖状态。
- 同步顺序测试使用两个可观察点而非不可达的双事务屏障：先让 A/B 都停在“请求全局 advisory lock 前”，释放 A 并观察“A 已取得锁”，再释放 B 并观察“B 正等待”；只有 A 提交后 B 才能取得锁、分配更高版本并提交。其它不涉及全局互斥锁的并发测试才允许双方到达同一 barrier；一律禁止固定 sleep 猜测竞态顺序。
- 后端崩溃恢复测试以子进程运行 app，在“工具业务写入已提交、聊天回执尚未完成”的命名 barrier 精确终止进程，再使用同一 PostgreSQL 测试库重启；之后由测试客户端以同一 `chatRequestId` 重试并断言工具不重复写入、旧 generation 被 fencing。不得用随机 kill 或 sleep 代替故障注入点。
- Room 进程恢复测试直接预置 `sending`、`attempt_id`、`claimed_at`，通过注入 Clock 跨过 5 分钟阈值并重建 Repository/Coordinator，断言旧 claim 回到 pending 且仍使用原 `actionId`；前台触发与两个 Worker 同时进入时用测试 dispatcher/barrier 断言网络上传最多一份。
- Compose smoke/integration 测试必须使用唯一 `COMPOSE_PROJECT_NAME=mealmate_test_<run-id>`、生产文件 + test override 和仅属于该次测试的临时 named volumes；清理脚本只可删除该前缀下测试资源，绝不引用生产 Compose 项目名或 `pg_data`。测试需断言无 ACME/公网请求、随机端口可探测，并覆盖 db 不健康、migration 非零、secret 缺失、app readiness 503 与正常启动链。

后端公开契约清单：

- [ ] Auth API｜集成｜bootstrap 首次成功、并发仅一个成功、初始化后关闭、register 错码、5 次失败限流、轮换、注销、自撤销/撤销其它设备、所有受保护路由 401；barrier 控制旧码验证与轮换交错，轮换提交后旧验证快照不得签发 token
- [ ] Recipe API + 8 FC｜单元+集成｜每个工具正常/边界/schema 错误；重名澄清；软删除、引用拒绝、显式恢复；批量预览零写入、全部同名返回 NO_NEW_RECIPES 且无草稿、修改预览 supersede、确认一次性
- [ ] Plan API/FC｜单元+集成｜周一/21 餐/餐型/菜谱有效性；目标周前 7 天候选分区、nonRecent≥21 强制避开、候选不足复用与 reusedRecipeIds；整批回滚；新周直写、同周预览、stale confirm；名称快照不随改名变化
- [ ] Chat/SSE｜集成｜事件顺序、流前 JSON 错误、流中 error、确认 token 不进入 provider、按 toolIndex 重放多份有效/失效确认面板、超时、同 ID 异内容冲突、同 ID 活动租约、另一 ID 设备忙、两新 ID 并发仅一项获租约、过期租约 CAS 接管、暂停旧 worker 后改发新 ID 并断言 generation/status/owner fencing、活动设备撤销中止、进程中断后用户触发恢复
- [ ] Models/Settings｜集成｜静态 capabilities allowlist 不泄密、目录 schema/唯一默认项、verify 命令的成功/超时/非法 tool call、不可用模型 422、偏好长度/在线写入、设备模型选择互不影响
- [ ] Sync｜集成｜首次快照跨页并发写不漏失、snapshot/incremental cursor 签名与 limit/phase 篡改、1 MB 截断、同 action 重放/异 payload 冲突、批内部分拒绝、服务端接收顺序、连接池/全局锁超时返回 SERVICE_BUSY 且零部分写入、墓碑、崩溃原子性
- [ ] Recovery/health｜集成｜migration 失败 readiness=503、缺配置 fail-fast、部署者恢复重置保留业务数据并吊销全部 token

Android 公开行为清单：

- [ ] ViewModel｜单元｜对话 start/delta/tool/error/done 状态、失败 delta 在同 ID 重试时被替换而不重复、请求中发送禁用、设备忙提示、断网草稿保留、只有点击重新发送才发起新 ID
- [ ] Repository/Room｜单元+集成｜sync page 与 cursor 同事务、rejected 回滚后保留失败项、duplicate 清队列、偏好离线仅草稿
- [ ] Auth/confirmation storage｜仪器｜device token 只进 Keystore 保护存储、401 清凭证；confirmation token 只存在当前进程内存，Room/普通 SharedPreferences/保存状态/日志扫描均无两类 token，进程重建后只能靠同 ID 服务端重放恢复确认面板
- [ ] Compose UI｜UI｜4 页基本导航、菜谱搜索、周计划 21 餐、只读确认预览（无面板内编辑入口）、失败重试和设备撤销状态

验收追踪：

| Roadmap AC | 最低自动化证据 |
|---|---|
| AC1、AC3、AC9、AC11 | FC service 单元 + PostgreSQL API 集成 |
| AC2 | FC/确认 PostgreSQL 集成 + Android confirmation storage/进程重建仪器测试 |
| AC4、AC8 | models/settings API 集成 + Android ViewModel 单元 |
| AC5、AC10 | auth PostgreSQL 集成 + Android 注册/撤销仪器测试 |
| AC6、AC12 | sync 并发集成 + Room repository 集成 |
| AC7 | MockWebServer 断网/恢复 + Compose 重发交互测试 |
| AC13 | scripted provider SSE/崩溃恢复集成 |
| AC14 | Compose smoke test + readiness/migration 失败测试 |

关键认证、确认、持久化和同步路径的分支必须全部被测试触发；核心 service 行覆盖率下限 90%，基础设施 80%，胶水配置 60%。覆盖率不能替代上述行为断言。

### v0.1 容量与性能基线

以下是验收测试包络，不是面向用户的硬配额；超出包络不得静默丢数据，但可以不承诺性能：

| 维度 | 基线 |
|---|---|
| 家庭/设备 | 单家庭，最多 10 台已加入设备；最多 10 条并发 SSE 连接，每设备仍只允许 1 条有效聊天 |
| 业务数据 | 10,000 个未删除 Recipe；520 个 WeeklyPlan（10 年）及 10,920 个 PlanItem |
| 同步历史 | 1,000,000 条 SyncChange、100,000 条 SyncActionReceipt；继续遵循 v0.1 永久保留，不据此新增清理 |
| 测试主机 | Linux amd64，2 vCPU、4 GiB RAM，本地 PostgreSQL/Caddy/app Compose；Provider 使用 scripted fake，排除公网与客户端无线网络 |
| 普通 API | 预热 100 次后串行/10 并发合计 1,000 次；非 AI GET/PATCH p95 ≤ 300 ms、p99 ≤ 800 ms |
| 同步页 | 100 项或接近 1 MB 的页面 p95 ≤ 500 ms；snapshot 和 incremental 各测 1,000 次 |
| 资源 | app 在 10 条 SSE + 10 并发普通请求下稳定 10 分钟，RSS 峰值 ≤ 512 MiB；无连接、timer 或 DB client 持续增长 |

app PostgreSQL pool 固定最多 10 个连接、普通语句 `statement_timeout=5s`、连接获取超时 2 秒；migration 使用独立单连接。等待全局同步锁的事务也受 5 秒语句超时约束；连接/锁超时完整回滚并返回 `503 SERVICE_BUSY` 与 `Retry-After: 1`，不得产生部分写入。容量数据集使用固定 seed 生成并记录 schema 版本；大规模 1,000,000 SyncChange 测试可作为 nightly 门禁，PR 至少运行缩小但分布相同的 10,000 条数据集。数据库、volume 与日志磁盘使用率必须进入部署观测，达到 80% 时告警；v0.1 仍不自动删除回执/墓碑，也不声称自动备份。

## v0.1 可靠性与安全约束

- `/api/v1` 的 JSON 请求体上限为 1 MB；同步动作每次最多 100 项，菜品列表 cursor 分页的 `limit` 最大为 100。所有入参使用 Zod strict schema 校验。
- 公开路由 allowlist 仅包含 `GET /health/live`、`GET /health/ready`、`POST /api/v1/auth/bootstrap` 与 `POST /api/v1/auth/register`；其余接口均要求未吊销 device token。认证失败统一返回 `401 UNAUTHORIZED`，不泄露令牌状态。令牌不自然过期，注销、设备撤销和恢复重置会使其失效。
- bootstrap secret 必须为部署环境中至少 256 位随机值；AuthConfig 以数据库唯一约束和事务 compare-and-set 初始化，竞争请求返回 `409 ALREADY_INITIALIZED`。家庭码由 CSPRNG 生成 12 位 Crockford Base32（60 bit），按 `XXXX-XXXX-XXXX` 展示；输入忽略大小写、ASCII 空格和连字符，并兼容 `O→0`、`I/L→1`。服务端以 Argon2id（64 MiB、t=3、p=1、16-byte salt、32-byte output）保存 PHC 字符串。device token 为 CSPRNG 生成的 32-byte 值；confirmation token 为隔离 HKDF key 的 HMAC-SHA256 32-byte 输出；两者都以无 padding base64url 传输并只保存 SHA-256。确认 token 只能出现在发起设备的 HTTPS SSE 事件和提交 JSON body。bootstrap、注册和轮换成功时的敏感明文仅向发起设备返回一次。
- bootstrap/register 分 scope 对 Caddy 验证后的来源限流：IPv4 完整地址、IPv6 /64 经 HMAC 后作为 AuthAttemptThrottle 键；第 5 次连续凭证失败在数据库行锁事务中设置 15 分钟锁定并返回 `429 RATE_LIMITED`/`Retry-After`，成功清零、到期重开周期、服务重启保留。Caddy 覆盖客户端传入的转发地址头，后端仅在直连对端为 Caddy 私有网络时信任其客户端地址头。家庭码轮换使旧码立即失效，部署者恢复重置会吊销所有设备令牌但不删除业务数据。
- 所有已加入设备权限相同：可编辑家庭偏好、轮换家庭码、列出和撤销其它设备。设备撤销后，聊天 worker 最迟在下一次 10 秒心跳或任何工具/最终提交前发现，并中止 provider/SSE；撤销设备不得再产生业务写入或追加对话。确认令牌仅绑定创建预览的设备，10 分钟后失效；同设备同 kind 新预览使旧预览 superseded。token 使用从 bootstrap secret 隔离派生的 HKDF/HMAC key 确定性生成，服务端只保存其 hash，因此可安全重放有效面板。App 只在内存持有，模型不可见。提交事务校验未过期、未消费、未 superseded 和目标版本；目标周计划版本变化返回 `409 CONFIRMATION_STALE`，同一 `commitActionId` 只返回原结果。
- “首 token”从服务端完成鉴权并接受 `/chat` 请求的单调时钟时刻开始，到写出首个非空 `delta` 事件为止；目标 p95 ≤ 3 秒。CI 先预热 10 次，再串行执行 100 次固定延迟 2 秒的 scripted provider 请求，按同一单调时钟定义计算 p95，并验证服务端额外开销 ≤ 500 ms；真实 provider 指标只作部署观测，不把公网波动伪装成确定性发布门禁。SSE 60 秒无事件或总计 5 分钟后为可重试错误。模型不可用不自动切换提供方。
- 周计划的周起始、当前/未来引用判定和“近 7 天”去重统一使用服务端 `Asia/Shanghai` 时区，不随设备时区变化。
- API/Sync DTO 中数据库 bigint `serverVersion` 一律使用十进制字符串；Kotlin 使用 String 包装值对象，TypeScript 在 DB 边界使用 bigint、在 JSON 边界显式转字符串，禁止转换为 number。
- WeeklyPlan 是同步聚合根；PlanItem 不单独分配同步版本。创建、覆盖或调整单餐都原子更新 WeeklyPlan 版本，并发布一条包含完整 21 餐的 SyncChange。
- 聊天请求以 `(deviceId, chatRequestId)` 与请求哈希幂等持久化，原 modelId/message 仅存数据库用于恢复且不得进入日志。worker 使用 30 秒租约、10 秒心跳和递增 generation；接受请求前锁定 DeviceToken 行，使每设备最多一个有效聊天租约。同 ID 同内容按状态重放、报告活动或由用户重试 CAS 接管，不同 ID 活动冲突返回 `409 CHAT_DEVICE_BUSY`，同 ID 不同内容返回 `409 IDEMPOTENCY_KEY_REUSED`；创建新 ID 会终结同设备已过期/可重试的旧请求，防止旧上下文稍后插入。写入型工具以聊天请求 ID 和工具序号派生幂等键，并将业务写入、工具结果及 generation 校验置于同一事务；旧 generation 不得继续写入。请求移出最近 20 个完整轮次时，回执清除正文与工具内容、转为 expired 幂等墓碑，同内容重试返回 `410 CHAT_REQUEST_EXPIRED`。
- 同步上传以逐项 ACK 为准；所有 SyncChange 写事务先取得固定 key `1296911409` 的 `pg_advisory_xact_lock` 并持有到提交，再分配版本，严格保证版本可见顺序；快照读取使用同 key 的 shared lock，客户端时间仅用于展示。`GET /sync` 按 `serverVersion` 升序返回 `{ changes, nextCursor, hasMore }`，每页至多 100 项或 1 MB；首次同步必须持续分页至 `hasMore=false`。被拒绝动作必须带权威资源快照与 `serverVersion`，客户端回滚后保留失败原因；无快照时要求完整重同步。同步回执和删除墓碑在 v0.1 永久保留。
- API 成功响应为 `{ success: true, data }`；失败响应为 `{ success: false, errCode, errMessage, requestId, retryable, details? }`，HTTP/status/retryable/Retry-After 必须遵循 `brainstorm.md` 的唯一错误目录。日志只记录 requestId、模型、耗时、错误、工具名等元数据；不得记录对话正文、工具参数、API Key、家庭码、bootstrap secret 或 device token。
- 对话消息、菜谱字段和偏好文本作为不可信输入传给模型；只允许服务端定义的 Zod 工具 schema，且批量创建和同周计划覆盖必须经设备绑定确认令牌后写入。
- v0.1 不实现自动备份；数据丢失风险由家庭接受，现有服务器快照或备份不属于 App 功能契约。

---

## 开发环境要求

| 依赖 | 版本 |
|---|---|
| Node.js | 22.22.3；由仓库 mise 配置固定，CI 使用同一精确版本 |
| pnpm | 10.11.0；根与服务端 `packageManager` 固定相同精确版本，本地与 CI 均通过 mise 的 Node + Corepack 执行 |
| JDK | Temurin 21.0.7+6；由仓库 mise 配置固定 vendor/版本，并作为 Gradle 的运行 JDK |
| Android Studio | 仅作为 IDE；必须兼容仓库固定的 AGP，不能成为构建版本来源 |
| Android SDK | `minSdk=26`、`compileSdk=36`、`targetSdk=36`；`app/scripts/provision-android-sdk.sh` 在本地与 CI 固定安装 `platforms;android-36`、`build-tools;36.0.0`。Gradle Managed Devices 自动获取定义所需的 AOSP 系统镜像 |
| Gradle / AGP / Kotlin / Compose | Gradle Wrapper、Version Catalog 与 Compose BOM 固定精确版本；依赖升级单独评审，不使用动态版本 |
| Docker Engine | ≥ 24 |
| Docker Compose plugin | ≥ 2.20；必须支持 `--wait` 和长格式 `depends_on.condition` |

阶段 0 创建仓库骨架时必须同时提交仓库根 `.mise.toml`、`package.json#packageManager`、`pnpm-lock.yaml`、Gradle Wrapper、Version Catalog 与依赖校验元数据；根与子项目 `packageManager` 的 pnpm 版本必须一致，本地和 CI 都不得绕过这些版本入口。后端 install 使用 frozen lockfile，Gradle 禁止 `+`、`latest.release` 等动态依赖。
