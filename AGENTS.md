# AGENTS.md

本文件是 `mealmate-lite` 的仓库入口，服务人类开发者和 AI Agent。

## 仓库定位

MealMate Lite 是一个以 AI 对话为核心交互的家庭饮食规划 Android App。Monorepo 包含 Node.js 后端和 Android 客户端。

## 先读什么

| 任务 | 入口 |
|------|------|
| 理解仓库结构、技术栈和分层 | `ARCHITECTURE.md` |
| 确认产品功能和业务范围 | `docs/PRODUCT_SENSE.md` |
| 查看 MVP 范围和验收标准 | `docs/roadmap.md` |
| 技术选型和部署架构 | `docs/design-docs/tech-stack.md` |
| 完整产品设计 | `docs/design-docs/product-design.md` |
| 探索记录和数据契约 | `docs/design-docs/brainstorm.md` |

## 项目事实

- 后端：Node.js 22 + Hono + Drizzle + PostgreSQL 16
- AI：Vercel AI SDK + Zod，OpenAI-compatible 多模型
- Android：Kotlin + Jetpack Compose + Room + Hilt + Retrofit
- 部署：Docker Compose（Node + PG + Caddy）
- 包管理：pnpm（后端）、Gradle Kotlin DSL（Android）
- 版本管理：mise（Node 22.22.3 + JDK temurin-21.0.7+6）；pnpm 10.11.0 由仓库 `packageManager` + Corepack 固定；Gradle Wrapper 9.1.0
- Lint/Format：Biome（后端）、ktlint + detekt（Android）
- 测试：Vitest（后端）、JUnit 5 + Turbine（Android）

## 常用命令

```bash
# 后端
cd server
mise exec -- corepack pnpm install
mise exec -- corepack pnpm dev              # 开发服务器
mise exec -- corepack pnpm lint             # Biome check
mise exec -- corepack pnpm typecheck        # TypeScript 类型检查
mise exec -- corepack pnpm test:unit        # 单元测试
mise exec -- corepack pnpm test:integration # 集成测试

# Android
cd app
./gradlew assembleDebug
./gradlew ktlintCheck detekt :app:lintDebug :app:testDebugUnitTest

# Docker
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile test up --build --wait
```

## 开发阶段

| 阶段 | 交付物 | 状态 |
|------|--------|------|
| 0. 仓库与运行骨架 | Monorepo、构建命令、健康检查 | ✅ 当前 |
| 1. 契约与持久化 | Drizzle migration、Zod DTO、Room entities | 待开始 |
| 2. 认证与同步底座 | bootstrap/register/token、SyncChange | 待开始 |
| 3. 菜谱与计划领域 | Recipe/Plan service、8 个 FC executor | 待开始 |
| 4. 对话与 Android 闭环 | SSE、4 个页面、WorkManager | 待开始 |
| 5. 发布候选 | 镜像、Caddy、部署说明 | 待开始 |

## Agent 工作约定

- 先尊重现有架构，再实现功能
- 后端代码遵循 Biome 格式化规则
- Android 代码遵循 ktlint + detekt 规则
- 依赖使用精确版本，不使用 ^ 或 ~
- 未经用户明确要求，不主动执行提交、推送或发布动作
