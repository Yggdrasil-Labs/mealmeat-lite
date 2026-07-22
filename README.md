# MealMate Lite

以 AI 对话为核心交互的家庭饮食规划 App。

## 仓库结构

```
mealmate-lite/
├── server/          # Node.js + Hono 后端
├── app/             # Android (Kotlin + Compose)
├── docs/            # 产品/技术文档
├── docker-compose.yml
├── docker-compose.test.yml
└── Caddyfile
```

## 开发环境

| 依赖 | 版本 |
|---|---|
| Node.js | 22.x（mise 管理） |
| pnpm | 10.11.0（仓库 `packageManager` + Corepack） |
| JDK | 21（mise 管理） |
| Docker Engine | ≥ 24 |
| Docker Compose | ≥ 2.20 |

## 快速开始

```bash
# 后端
cd server
mise exec -- corepack pnpm install
mise exec -- corepack pnpm dev

# Android
cd app
./gradlew assembleDebug
```

## 命令参考

### 后端

```bash
mise exec -- corepack pnpm --dir server lint          # Biome lint + format check
mise exec -- corepack pnpm --dir server typecheck     # TypeScript 类型检查
mise exec -- corepack pnpm --dir server test:unit     # 单元测试
mise exec -- corepack pnpm --dir server test:integration  # 集成测试
```

### Android

```bash
./gradlew ktlintCheck detekt :app:lintDebug :app:testDebugUnitTest
```

### Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.test.yml --profile test up --build --wait
```
