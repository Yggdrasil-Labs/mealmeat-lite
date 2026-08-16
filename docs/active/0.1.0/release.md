---
version: "0.1.0"
date: "2026-07-26"
status: "in-progress"
---

# Release — 0.1.0

## 版本目标

交付 MealMate Lite 的 v0.1 对话内核。阶段 1“契约与持久化”与阶段 2“认证与同步底座”已完成，其余阶段继续以 [`../../roadmap.md`](../../roadmap.md) 的开发顺序和门禁为准。

## 需求交付

| 需求 | 规模 | 状态 | 说明 |
|---|---|---|---|
| [`contracts-persistence`](./contracts-persistence/) | 大 | 阶段 1 已完成，v1 已冻结 | JSON Schema 唯一事实源、TS/Ajv/Provider/Kotlin 投影、统一错误/SSE、不变量、Drizzle migration、Room entities、跨端 fixtures；fingerprint 见 `../../../contracts/v1/FROZEN.md` |
| [`auth-sync-foundation`](./auth-sync-foundation/spec.md) | 大 | 阶段 2 已完成（AC5/6/10/12） | bootstrap/register/token、设备管理与家庭码轮换、来源级限流（5 次锁定 15 分钟）、签名 cursor 快照/增量同步、pending_actions 逐项 ACK 与回执幂等；auth 25 例 + sync 18 例 PostgreSQL 集成测试 |

## 独立提交

| 提交 | 类型 | 说明 |
|---|---|---|
| `2f12b9d` | docs | 阶段 2 设计文档（spec/design/plan）与 roadmap/AGENTS/active/release 状态记录 |
| `39270f5` | feat | security：安全原语、Argon2id、运行时配置与单测 |
| `d4177d2` | feat | errors：公开错误 envelope 与横切中间件 |
| `f1df107` | feat | db：生产连接池 |
| `b69dd1e` | feat | auth：bootstrap/register、设备管理与来源限流 |
| `2045a52` | feat | sync：签名 cursor 同步与离线动作逐项 ACK |
| `7d2ccde` | feat | routes：路由接线、启动 fail-fast 与 recovery-reset |
| `aa41aa2` | test | AC5/6/10/12 PostgreSQL 集成测试 |

## Changelog

### Features

- 完成阶段 1 契约与持久化基线：21 HTTP、8 FC、6 SSE 的确定性投影与跨端 fixture 门禁。
- 固化 PostgreSQL 12 个实体与 Android Room 9 张表的迁移、映射和回滚验证。
- 完成阶段 2 认证与同步底座：设备认证闭环（bootstrap/register/token、注销/撤销/轮换）、HKDF 隔离的 HMAC 来源限流、签名 cursor 的快照+增量同步、recipe.patch/delete 离线动作逐项 ACK 与 (deviceId, actionId) 回执幂等、cli auth recovery-reset。

### Fixes

- 当前无已交付修复。

## 接口变更

| 类型 | 路径 | 说明 |
|---|---|---|
| 已冻结 | `/api/v1`、SSE、Function Calling、Sync DTO | 阶段 1 已固化并验证 v1 契约 |
| 已交付 | `/api/v1/auth/*`（bootstrap/register/logout/devices/family-code/rotate） | 阶段 2 实现，成功 `{success:true,data}`、失败按错误目录 envelope |
| 已交付 | `/api/v1/sync`、`/api/v1/sync/actions` | 阶段 2 实现：签名 cursor 快照/增量分页（limit+1MB 截断）、逐项 ACK |

## 数据变更

| 类型 | 表/字段 | 说明 |
|---|---|---|
| 已交付 | PostgreSQL 12 个逻辑实体、Android Room 9 张本地表 | 阶段 1 已建立首版 schema、迁移和显式 mapper |
| 无变更 | 阶段 2 复用阶段 1 migration | bootstrap/register/sync 直接触达既有 auth/settings/sync 表，无新迁移 |

## 依赖变更

| 操作 | 依赖 | 版本 |
|---|---|---|
| 已锁定 | Ajv 8.20.0、ajv-formats 3.0.1、json-schema-to-ts 3.1.1、OpenAPI Generator 7.22.0、PostgreSQL 集成测试依赖 | 按 design/plan 精确版本实现 |
| 已新增 | @node-rs/argon2 2.1.0（精确版本） | 家庭码 Argon2id（64MiB/t=3/p=1/16B salt/32B output），PHC 与 auth_config CHECK 匹配 |

## 配置变更

| 环境 | Key | 说明 |
|---|---|---|
| 已生效 | `MEALMATE_BOOTSTRAP_SECRET` / `MEALMATE_BOOTSTRAP_SECRET_FILE`、`TZ` | 启动 fail-fast：secret ≥256 bit 熵（64 hex / 43 base64url 起，拒绝占位值），TZ 固定 Asia/Shanghai；secret 同时是 cursor/限流来源键的 HKDF 根密钥 |
