---
version: "0.1.0"
feature: auth-sync-foundation
status: approved
created: 2026-07-11
approved: 2026-07-11
---

# Spec — 阶段 2：认证与同步底座（auth-sync-foundation）

> 本 Spec 是阶段 2 的行为契约（系统做什么）。wire shape 一律引用已冻结的
> `contracts/v1/source/`（fingerprint 见 `contracts/v1/FROZEN.md`），
> 本文件不重新定义 DTO，只定义行为、边界与验收对应关系。

## 1. 目标与非目标

**目标**：单家庭单部署下的设备认证闭环（bootstrap/register/token、设备管理、家庭码轮换、
来源级限流）与同步底座（快照/增量 cursor、离线动作逐项 ACK、回执幂等），
使 AC5、AC6、AC10、AC12 通过。

**非目标**（留在后续阶段）：聊天/SSE、Recipe/Plan 领域 API 与 FC、确认草稿、
模型目录、恢复重置的部署演练、`confirmation-token` 派生。

## 2. 术语

- **设备**：一次 bootstrap/register 签发的 device token 所代表的客户端。
- **来源**：Caddy 验证后的客户端地址（IPv4 完整地址 / IPv6 归一到 /64）；直连对端
  为私有网络地址时才信任 `X-Forwarded-For` 首值。
- **服务端接收顺序**：全局同步写锁的获取顺序；客户端时间戳只用于展示。
- **快照 watermark**：首次快照页在 shared 全局锁下读取的 `max(sync_changes.server_version)`。

## 3. Behaviors

### AUTH-1 bootstrap 初始化（AC5）

**Given** 实例未初始化。
**When** 设备提交正确 bootstrap secret 与合法 deviceName。
**Then** 200：返回 deviceId、deviceToken、familyCode（显示格式 XXXX-XXXX-XXXX），三者明文只此一次；
同一事务创建 AuthConfig、首个 DeviceToken、默认 Settings(`familyPreference=""`) 并为其分配首个同步版本；
该来源限流计数清零。

**边界**：
- secret 错误 → 401 INVALID_BOOTSTRAP_SECRET，计入该来源失败次数。
- 已初始化 → 409 ALREADY_INITIALIZED，不计入失败；并发 bootstrap 恰有一个成功，其余 409。
- deviceName 去除首尾空白后为空 → 400 BAD_REQUEST。
- 任一写入失败 → 整事务回滚，实例仍视为未初始化。

### AUTH-2 register 设备注册（AC5）

**Given** 实例已初始化。
**When** 设备提交规范化后合法的 12 位家庭码与合法 deviceName。
**Then** 200：返回 deviceId、deviceToken；token 只返回一次；该来源限流计数清零。

**边界**：
- 未初始化 → 409 NOT_INITIALIZED（不计失败）。
- 家庭码格式非法或校验失败 → 401 INVALID_FAMILY_CODE；校验失败计入失败次数，格式非法不计。
- 校验通过后、签发前，若家庭码已变化（例如轮换并发提交），一律 401 INVALID_FAMILY_CODE
  且绝不签发 token（轮换交错场景）。

### AUTH-3 设备鉴权（AC5）

**Given** 受保护路由（/auth 其余端点与 /sync/*），请求带 `Authorization: Bearer <token>`。

- **When** token 为 43 字符 base64url 且命中未撤销设备。
  **Then** 放行请求并刷新该设备 lastUsedAt。
- **When** 缺失 token、格式非法、未命中或已撤销。
  **Then** 统一 401 UNAUTHORIZED，不泄露令牌状态差异。

### AUTH-4 注销与设备管理（AC5、AC10）

- **Given** 已鉴权设备调用 logout。
  **When** 请求成功提交。
  **Then** 当前 token 立即失效，返回 `{revoked:true}`；随后用该 token 访问受保护路由 → 401。
- **Given** 已鉴权设备请求设备列表。
  **When** 查询未撤销设备。
  **Then** 返回全部未撤销设备，isCurrent 恰有一个（当前设备）；不含已注销/被撤销设备。
- **Given** 已鉴权设备请求撤销目标设备。
  **When** 目标为未撤销设备（含自身）。
  **Then** 返回 `{id, revoked:true}`，目标 token 立即 401；目标不存在或已撤销 → 404 DEVICE_NOT_FOUND；
  路径参数非法 UUID → 400 BAD_REQUEST。
- **Given** 已鉴权设备请求轮换家庭码。
  **When** 轮换成功提交。
  **Then** 旧码立即失效（旧码注册 → 401），新码只在此次响应返回一次。

### AUTH-5 来源限流（AC10）

**Given** scope ∈ {bootstrap, register}。
**When** 同一 `(scope, 规范化来源)` 连续凭证失败。
**Then** 前 4 次 → 401；第 5 次 → 429 RATE_LIMITED 且 Retry-After ∈ [1,900]；
锁定期内直接 429 不执行昂贵校验；15 分钟到期后首次尝试重置计数；
正确凭证提交成功时清零；计数持久化、重启保留、行锁并发下不可绕过第 5 次阈值。

### SYNC-1 快照与增量分页（AC12）

**Given** 已鉴权设备。
**When** `GET /api/v1/sync`（无 cursor）。
**Then** 从永久 SyncChange 重建 watermark 内每个资源的最新状态，固定按
`(resource ASC, resource_id ASC)` 分页；每页 ≤ limit（1..100）且 ≤ 1 MB；
`{changes, nextCursor?, hasMore}`；hasMore=true 时必须继续拉取至 false。

**边界**：
- 首屏在 shared 全局同步写锁下确定 watermark；后续页沿用签名 watermark，分页期间的新写入
  在快照结束后经增量 cursor（lastServerVersion=watermark）继续返回，不漏失。
- 增量页按 serverVersion 升序返回 `> lastServerVersion` 的 change。
- cursor 为 `<RFC8785 payload>.base64url HMAC-SHA256` 签名封装；payload 为封闭联合
  `{schemaVersion:1, phase, ..., limit}`；任何篡改 → 400 INVALID_CURSOR。
- limit 非法 → 400 BAD_REQUEST。
- 单项超过 1 MB → 500 SYNC_CHANGE_TOO_LARGE。

### SYNC-2 离线动作逐项 ACK（AC6）

**Given** 已鉴权设备。
**When** `POST /api/v1/sync/actions` 提交 1..100 个合法动作。
**Then** 严格按数组顺序逐项处理，每项一个事务；`recipe.patch`/`recipe.delete` 的
资源写入、SyncChange 与回执同事务提交；结果与输入顺序一致：
`applied`（含资源视图/墓碑 + serverVersion）、`duplicate`（重放原结果）、
`rejected`（含 errCode；有快照时附 authoritative+serverVersion，无快照时 requiresFullResync=true）。

**边界**：
- 重复上传同 actionId 同 payload → duplicate，不重复执行。
- 同 actionId 异 payload → 409 IDEMPOTENCY_KEY_REUSED，整批中止（见 design 裁决 D1）。
  恢复语义：该 action 之前已处理项已提交并留存回执，客户端以原 actionId 重发整批即可
  幂等重放（duplicate），冲突项必须丢弃或换新 actionId。
- patch 不存在菜谱 → rejected RECIPE_NOT_FOUND requiresFullResync；已删除 → RECIPE_DELETED + 墓碑。
- delete 被当前/未来（Asia/Shanghai 周一之后）计划引用 → rejected RECIPE_IN_USE + 权威视图。
- 并发动作按全局同步写锁获取顺序串行，后写成功覆盖先写；低版本事务不可能晚于高版本提交。
- 整包 schema/鉴权失败不处理任何 action。

## 4. 接口契约

全部 DTO 引用冻结契约：`auth.schema.json`（Bootstrap/Register/Logout/Device*/Rotate）
与 `sync.schema.json`（SyncResponse/SyncChangeDto/SyncActionsRequest/Response）。
成功 envelope `{success:true,data}`；失败 envelope `{success:false,errCode,errMessage,requestId,retryable,details?}`，
status/retryable/Retry-After 以 `openapi.yaml#x-mealmate-errors` 为唯一目录。

## 5. 验收对应

| AC | Behavior | 最低自动化证据 |
|---|---|---|
| AC5 | AUTH-1..4 | auth PostgreSQL 集成（HTTP 全链路） |
| AC10 | AUTH-4、AUTH-5 | 同上 + 轮换/校验交错屏障测试 + 时钟注入锁过期 |
| AC6 | SYNC-2 | sync PostgreSQL 集成：双设备 patch 终态、duplicate 不重复执行、版本单调 |
| AC12 | SYNC-1 | sync PostgreSQL 集成：多页快照、分页期间写入经增量续传、cursor 篡改 400 |

