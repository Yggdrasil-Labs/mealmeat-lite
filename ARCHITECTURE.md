# MealMate Lite 架构总览

## 文档定位

本文件描述 MealMate Lite 当前认可的工程事实，覆盖技术栈、模块分层、依赖方向和部署架构。

## 1. 系统目标

MealMate Lite 是一个以 AI 对话为核心交互的家庭饮食规划 App。用户通过自然语言对话完成菜品管理、周计划生成、库存追踪等操作。

当前版本（v0.1）聚焦对话内核：AI 多轮对话管理菜谱 + 生成周计划。

## 2. 技术栈

| 层 | 选择 |
|---|---|
| 后端框架 | Node.js 22 + Hono |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/openai`) + Zod |
| ORM | Drizzle |
| 数据库 | PostgreSQL 16 |
| Android | Kotlin + Jetpack Compose + Material 3 |
| 本地存储 | Room |
| DI | Hilt |
| 网络 | Retrofit + OkHttp + kotlinx.serialization |
| 流式 | OkHttp SSE |
| 后台任务 | WorkManager |
| 反代 | Caddy（自动 HTTPS） |
| 部署 | Docker Compose |
| Lint | Biome（后端）、ktlint + detekt（Android） |
| 测试 | Vitest（后端）、JUnit 5 + Turbine（Android） |
| 版本管理 | mise |

## 3. 仓库结构

```
mealmate-lite/
├── server/              # Node.js + Hono 后端
│   ├── src/
│   │   ├── index.ts     # 服务入口
│   │   ├── app.ts       # Hono 应用
│   │   ├── cli.ts       # CLI 入口（migrate、verify、recovery-reset）
│   │   ├── routes/      # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── db/          # Drizzle schema + migrations
│   │   └── middleware/  # 认证、错误处理
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── app/                 # Android (Kotlin + Compose)
│   ├── app/             # App module
│   ├── gradle/          # Version Catalog + Wrapper
│   └── build.gradle.kts
├── docs/                # 产品/技术文档
├── biome.json           # 后端 lint/format 配置（仓库根）
├── docker-compose.yml   # 部署编排
└── Caddyfile            # 反代配置
```

## 4. 后端分层

```
routes/     → 协议适配（HTTP/SSE）、参数校验
services/   → 业务逻辑、AI 编排、FC executor
db/         → Drizzle schema、migrations、查询
middleware/ → 认证、错误处理、request-id
```

依赖方向：`routes → services → db`。middleware 横切所有层。

## 5. Android 分层

```
UI Layer (Compose Screen/Component)
  → ViewModel (StateFlow, 单向数据流)
    → Repository (数据协调)
      → Local (Room) + Remote (Retrofit)
```

## 6. 部署架构

```
┌─────────────────────────────────┐
│         Docker Compose           │
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

网络分离：
- `internal`：db、migrate、app、caddy（服务间通信）
- `edge`：caddy（暴露 80/443，通过 internal 反代 app）

## 7. 关键约束

- 单家庭单部署：一个后端实例只服务一个家庭
- 固定时区 `Asia/Shanghai`
- API Key 仅在部署端配置，不进入数据库/客户端/日志
- 对话按设备隔离，菜谱和计划家庭共享
- 同步使用服务端接收顺序，非客户端时间戳
- 所有依赖精确版本，禁止浮动

## 8. 验证命令

```bash
# 后端
pnpm --dir server lint
pnpm --dir server typecheck
pnpm --dir server test:unit
pnpm --dir server test:integration

# Android
cd app && ./gradlew ktlintCheck detekt :app:lintDebug :app:testDebugUnitTest

# Docker
docker compose -f docker-compose.yml -f docker-compose.test.yml config --quiet
```

## 9. 相关文档

- 产品语义：`docs/PRODUCT_SENSE.md`
- 技术选型详情：`docs/design-docs/tech-stack.md`
- 完整产品设计：`docs/design-docs/product-design.md`
- 探索记录与数据契约：`docs/design-docs/brainstorm.md`
- 版本路线：`docs/roadmap.md`
