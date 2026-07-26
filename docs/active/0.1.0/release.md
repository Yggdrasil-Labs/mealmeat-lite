---
version: "0.1.0"
date: "2026-07-26"
status: "in-progress"
---

# Release — 0.1.0

## 版本目标

交付 MealMate Lite 的 v0.1 对话内核。当前先完成阶段 1“契约与持久化”，其余阶段继续以 [`../../roadmap.md`](../../roadmap.md) 的开发顺序和门禁为准。

## 需求交付

| 需求 | 规模 | 状态 | 说明 |
|---|---|---|---|
| [`contracts-persistence`](./contracts-persistence/) | 大 | spec/design/plan 已定稿，待实施 | JSON Schema 唯一事实源、TS/Ajv/Provider/Kotlin 投影、统一错误/SSE、不变量、Drizzle migration、Room entities、跨端 fixtures |

## 独立提交

| 提交 | 类型 | 说明 |
|---|---|---|
| — | — | 当前无独立提交 |

## Changelog

### Features

- 当前无已交付功能。

### Fixes

- 当前无已交付修复。

## 接口变更

| 类型 | 路径 | 说明 |
|---|---|---|
| 已定稿，待实施 | `/api/v1`、SSE、Function Calling、Sync DTO | 阶段 1 固化并验证 v0.1 契约，不实现业务路由 |

## 数据变更

| 类型 | 表/字段 | 说明 |
|---|---|---|
| 已定稿，待实施 | PostgreSQL 12 个逻辑实体、Android Room 9 张本地表 | 阶段 1 建立首版 schema、迁移和显式 mapper |

## 依赖变更

| 操作 | 依赖 | 版本 |
|---|---|---|
| 规划中 | Ajv 8.20.0、ajv-formats 3.0.1、json-schema-to-ts 3.1.1、OpenAPI Generator 7.22.0、PostgreSQL 集成测试依赖 | 实施时按 design/plan 精确锁定 |

## 配置变更

| 环境 | Key | 说明 |
|---|---|---|
| 无 | — | 阶段 1 不新增运行时配置 |
