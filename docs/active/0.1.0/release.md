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
| [`contracts-persistence`](./contracts-persistence/) | 大 | 阶段 1 已完成，v1 已冻结 | JSON Schema 唯一事实源、TS/Ajv/Provider/Kotlin 投影、统一错误/SSE、不变量、Drizzle migration、Room entities、跨端 fixtures；fingerprint 见 `../../../contracts/v1/FROZEN.md` |

## 独立提交

| 提交 | 类型 | 说明 |
|---|---|---|
| — | — | 当前无独立提交 |

## Changelog

### Features

- 完成阶段 1 契约与持久化基线：21 HTTP、8 FC、6 SSE 的确定性投影与跨端 fixture 门禁。
- 固化 PostgreSQL 12 个实体与 Android Room 9 张表的迁移、映射和回滚验证。

### Fixes

- 当前无已交付修复。

## 接口变更

| 类型 | 路径 | 说明 |
|---|---|---|
| 已冻结 | `/api/v1`、SSE、Function Calling、Sync DTO | 阶段 1 已固化并验证 v1 契约；本阶段未实现业务路由 |

## 数据变更

| 类型 | 表/字段 | 说明 |
|---|---|---|
| 已交付 | PostgreSQL 12 个逻辑实体、Android Room 9 张本地表 | 阶段 1 已建立首版 schema、迁移和显式 mapper |

## 依赖变更

| 操作 | 依赖 | 版本 |
|---|---|---|
| 已锁定 | Ajv 8.20.0、ajv-formats 3.0.1、json-schema-to-ts 3.1.1、OpenAPI Generator 7.22.0、PostgreSQL 集成测试依赖 | 按 design/plan 精确版本实现 |

## 配置变更

| 环境 | Key | 说明 |
|---|---|---|
| 无 | — | 阶段 1 不新增运行时配置 |
