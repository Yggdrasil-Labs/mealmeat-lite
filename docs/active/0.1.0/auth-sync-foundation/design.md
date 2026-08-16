---
version: "0.1.0"
feature: auth-sync-foundation
status: approved
created: 2026-07-11
approved: 2026-07-11
---

# Design — 阶段 2：认证与同步底座

> 完整型 Design。行为契约见同目录 `spec.md`；wire 契约一律引用 `contracts/v1`。
> 约束来源：`docs/design-docs/brainstorm.md` §2/§4/§6、`tech-stack.md` §可靠性约束、`roadmap.md` 阶段 2。

## 1. Context

阶段 1 已交付冻结 v1 契约与 12 张表 migration。阶段 2 首次把这些表接上业务：
认证闭环 + 同步底座。核心难度不在 CRUD，而在四类并发/安全不变量：
全局同步写锁的顺序语义、AuthConfig 行的 compare-and-set、来源限流的行锁原子性、
cursor 的签名与 watermark 稳定性。

### 实施中出现的歧义决策（显式记录，按解释执行）

冻结文档未逐字覆盖的点，按以下解释实现并记录，接受评审：

- **C1 回执 result 的存储形态**：`sync_action_receipts.result` 按版本化 JSONB 存储
  「含 actionId 的完整 SyncActionResultDto（applied/rejected 分支）」；重放 duplicate 时
  剥离 actionId 得到 `original`。依据：`versioned-jsonb.ts` 已把该 carrier 固定映射到
  `SyncActionResultDto` schema，存储形态必须通过该校验。
- **C2 已删除菜谱再 delete（新 actionId）**：返回 applied + 既有墓碑，不分配新版本、
  不发新 SyncChange（幂等语义，与「重复上传不重复执行」一致）。
- **C3 带 cursor 请求的 query limit**：cursor payload 内的 limit 为准，query limit 被忽略；
  limit 篡改必然破坏签名 → INVALID_CURSOR。例外：非法 query limit（非 1..100 整数）无论
  是否带 cursor 一律 400 BAD_REQUEST。
- **C4 家庭码明文返回展示格式**（XXXX-XXXX-XXXX），注册端规范化兼容两种输入。
- **C5 bootstrap 的 ALREADY_INITIALIZED 判定**：AuthConfig 单例唯一约束（23505）映射 409；
  token hash 唯一冲突在概率上不可达，不做区分。
- **C6 HKDF context 字符串**（内部细节，不进 wire）：`mealmate/v1/auth-source-key`、
  `mealmate/v1/sync-cursor`（`confirmation-token` 留阶段 3）。
- **C7 撤销/注销只软置 `revoked_at`**，不物理删除（与 frozen 数据模型一致）。
- **C8 快照 hasMore=false 时不携带 nextCursor**（schema 中 nextCursor 可选）。

## 2. Goals / Non-goals

**Goals（可衡量）**：阶段 2 交付后，AC5、AC6、AC10、AC12 通过——
设备认证闭环（bootstrap/register/token、注销/撤销/轮换、来源限流）与同步底座
（签名 cursor 快照/增量、离线动作逐项 ACK、回执幂等）以 PostgreSQL 集成测试为自动化证据，
且 lint/typecheck/unit/integration 四道门禁全绿。

**Non-goals（后续阶段）**：聊天/SSE 与 FC、Recipe/Plan 领域 API、确认草稿、
模型目录与 readiness 配置校验、恢复重置的部署演练、confirmation-token 派生。

## 3. 架构与模块布局

沿用 `ARCHITECTURE.md` 分层：`routes → services → db`，middleware 横切。新增/改动：

```
server/src/
├── config.ts                      # 启动 fail-fast：bootstrap secret 熵校验 + TZ=Asia/Shanghai
├── errors.ts                      # PublicError + {success:false,...} envelope + 错误目录映射
├── db/
│   ├── pool.ts                    # 生产池：max10、connect 2s、statement/lock 5s（GUC startup 参数）
│   ├── postgres-error.ts          # PostgresError 解包（drizzle 包 DrizzleQueryError，按 cause）
│   ├── transactions/sync-write.ts # [既有] 全局写锁（key=1296911409）+ 资源行锁 + 版本分配
│   ├── migration-status.ts        # [既有] schema 版本就绪校验
│   └── migrations/                # [既有] 阶段 1 全量迁移
├── security/
│   ├── crypto.ts                  # HKDF/HMAC/SHA-256、Crockford 家庭码、RFC8785 JCS、签名 cursor
│   └── passwords.ts               # Argon2id 封装（64MiB, t=3, p=1, 16B salt, 32B out）
├── middleware/
│   ├── request-id.ts              # 每请求 UUID → X-Request-Id + 错误 envelope
│   ├── body-limit.ts              # /api/v1 JSON ≤ 1 MB（hono/body-limit 流式字节计数，chunked 不可绕过）
│   ├── device-auth.ts             # Bearer token → SHA-256 → 未吊销行；401 统一（scheme 大小写不敏感）
│   ├── on-error.ts                # PublicError/HTTPException/PostgresError(55P03,57014,08*)→SERVICE_BUSY
│   ├── on-not-found.ts            # [既有] 404 兜底（见 §11 文档化偏离）
│   └── context-variables.ts       # Hono ContextVariableMap 类型
├── services/auth/
│   ├── source-key.ts              # 客户端地址规范化 + 私有网段信任判定（判定与规范化同源）
│   ├── throttle.ts                # (scope,sourceHash) 行锁原子失败计数/锁定/重置
│   └── auth-service.ts            # bootstrap/register/rotate/logout/devices/revoke
├── services/sync/
│   ├── cursor.ts                  # 封闭联合 payload 校验 + 编码/解码
│   ├── paging.ts                  # limit + UTF-8 字节双重截断纯函数
│   └── sync-service.ts            # 快照/增量分页、patch/delete 执行器、回执幂等
├── routes/{auth,sync,index}.ts    # 路由 + 严格 Ajv 校验（400 BAD_REQUEST + details）
├── routes/health.ts               # [既有] live/ready（阶段 2 修正 503 冻结 wire）
├── utils/{db,validation,dates}.ts # db 连接、Ajv 适配、Asia/Shanghai 周一计算
├── test-support/pg.ts             # Testcontainers PG16 + 全量 migration + makeTestApp 依赖注入
├── app.ts                         # createApp(deps) 依赖注入；默认实例惰性解析 env 依赖
├── index.ts / healthcheck.ts      # 启动 fail-fast / 容器健康探针
└── cli.ts                         # auth recovery-reset（单事务换码+吊销设备+清限流）
```

## 4. 关键流程

### 4.1 bootstrap（单事务，原子）

```text
限流检查(行锁tx) → 已初始化? 409 → 常量时间比较 secret
  ├─ 错: recordFailure → 429/401
  └─ 对: 单事务 [
        删限流行 → insert auth_config(家庭码 Argon2id 哈希) →
        全局同步写锁 → 锁 settings 行(不存在) → nextval 分配版本 v →
        insert settings(familyPreference="", v) + sync_changes(settings upsert, v) →
        insert device_tokens(gen_random_uuid) returning id
      ]；23505 → 409 ALREADY_INITIALIZED（回滚整包，含限流清零）
```

依据：bootstrap 成功事务必须同时创建 AuthConfig、首个 DeviceToken、默认 Settings 并分配
首个可同步版本（brainstorm §2 事务不变量）。

### 4.2 register（校验在事务外，签发 compare-and-set）

```text
规范化家庭码 → 限流检查 → 读 auth_config 快照(hash, version)
→ [事务外] Argon2id verify
  ├─ 错: recordFailure → 429/401
  └─ 对: 单事务 [删限流行 → SELECT auth_config FOR UPDATE →
        复核 hash/version == 快照? 否 → 401 不签发
        → insert device_tokens returning id]
```

轮换并发：rotate 与 register 都锁定同一 auth_config 行；行锁顺序即生效顺序，
轮换提交后 register 复核必然发现 hash/version 变化 → 401，满足 AC10。

### 4.3 限流（AuthAttemptThrottle 行锁）

```text
insert on conflict do nothing → SELECT ... FOR UPDATE
锁定未到期 → 429(剩余秒数)；到期 → 重置计数开新周期
失败: count+1; count>=5 → locked_until=now+15min → 429
成功: 在成功事务内删行（同提交，崩溃回滚不留脏计数）
```

来源键：HKDF(bootstrapSecret, auth-source-key) → HMAC-SHA256("v1:<scope>:<canonicalSource>") 十六进制。
直连对端非私有地址时忽略 X-Forwarded-For（Caddy 覆盖外来头，后端只信任私有网段一跳）。

### 4.4 GET /sync 分页状态机

```text
无 cursor ──▶ snapshot 首屏（tx: shared 全局锁 → watermark=max(server_version) →
              distinct-on 重建每资源最新态 → 页内 limit+1MB 截断）
snapshot 续页 ── keyset (resource,resource_id) > (last...) 同一 watermark
snapshot 结束 ── 有 server_version>watermark → 增量 cursor(lastServerVersion=watermark)
增量页 ── server_version > last 升序 limit+1；结束 hasMore=false
```

cursor 格式：`<base64url(JCS(payload))>.<base64url(HMAC-SHA256)>`，HMAC key 由 bootstrap
secret 经独立 HKDF context 派生；decode 时对「解码后重新规范化」的字符串验签，杜绝二次编码差异。

### 4.5 POST /sync/actions（逐项单事务）

```text
每项: payloadHash=SHA-256(JCS(payload))
  回执存在? ─ 同 type+hash → duplicate(剥离 actionId 重放 result)
           ─ 异 type/hash → 409 IDEMPOTENCY_KEY_REUSED(整批中止, details.actionId)
  执行(全局同步写锁→资源行锁→nextval→写入):
    patch: 不存在→rejected(fullResync) | 已删除→rejected(RECIPE_DELETED+墓碑)
           | 否则 name/tags 合并更新 + SyncChange(upsert,RecipeView) + 回执
    delete: 不存在→rejected(fullResync) | 已删除→applied(既有墓碑,不分配版本)
           | 当前/未来计划引用→rejected(RECIPE_IN_USE+视图) | 否则墓碑 + SyncChange(delete)
  23505(并发同 actionId 撞主键) → 重读回执重放/按 hash 冲突 409
```

409 整批中止的恢复语义：冲突项之前的动作已各自提交（逐项独立事务）且回执永久保留，
客户端以原 actionId 重发整批 → 已处理项返回 duplicate、冲突项再次 409；
客户端只需丢弃冲突项或换新 actionId，不会重复执行业务写入。

## 5. 数据模型

复用阶段 1 migration，无新表/新迁移。触达表：auth_config、device_tokens、
auth_attempt_throttles、settings、sync_changes、sync_action_receipts、recipes、
weekly_plans/plan_items（仅 delete 引用检查）。

## 6. 错误映射（目录驱动）

| 场景 | errCode | status | Retry-After |
|---|---|---|---|
| schema/JSON/UUID/limit 非法 | BAD_REQUEST | 400 | — |
| cursor 非法/篡改 | INVALID_CURSOR | 400 | — |
| 缺/坏/已撤销 token | UNAUTHORIZED | 401 | — |
| secret/家庭码错 | INVALID_BOOTSTRAP_SECRET / INVALID_FAMILY_CODE | 401 | — |
| 设备不存在/已撤销 | DEVICE_NOT_FOUND | 404 | — |
| 初始化状态冲突 | ALREADY_INITIALIZED / NOT_INITIALIZED | 409 | — |
| 同 actionId 异 payload | IDEMPOTENCY_KEY_REUSED | 409 | — |
| 限流锁定 | RATE_LIMITED | 429 | 剩余秒数 1..900 |
| 锁/语句/连接超时 | SERVICE_BUSY | 503 | 1 |
| 单项 SyncChange > 1MB | SYNC_CHANGE_TOO_LARGE | 500 | — |
| 其余未预期 | INTERNAL_ERROR | 500 | — |

## 7. 安全要点

- 家庭码：CSPRNG 12 位 Crockford（排除 I/L/O/U，映射 O→0、I/L→1），只存 Argon2id PHC。
- device token：CSPRNG 32B base64url，只存 SHA-256；明文仅在签发响应返回一次。
- bootstrap secret：≥256 bit（64 hex / 43 base64url 起），拒绝占位与重复字符；
  同时是 cursor/来源键 HKDF 根密钥，初始化后不可变更。
- 所有日志只记 requestId/错误码/元数据；不含 token、家庭码、secret、正文。
- 生产池 10 连接、语句/锁超时 5s、连接超时 2s；超时完整回滚 → 503。
- 性能基线沿用 tech-stack「v0.1 容量与性能基线」：非 AI GET/PATCH p95 ≤ 300ms、p99 ≤ 800ms；
  同步页 p95 ≤ 500ms；SyncChange/SyncActionReceipt 永久保留（100 万条量级），阶段 2 不做清理。

## 8. 测试策略

- 单元：crypto（家庭码字符集/规范化/JCS/签名篡改）、passwords（PHC 往返）、config（熵校验）。
- 集成（Testcontainers PG16 + 全量 migration + HTTP 全链路）：
  AUTH-1..5、SYNC-1..2 的行为逐条映射测试（见 spec §5 验收对应）。
  并发用例用可观察屏障（注入 hasher 挂起 + 完成信号），禁止固定 sleep。
  AC6 服务端接收顺序依赖阶段 1 已有的双事务屏障测试 + 本阶段版本单调断言。

## 9. 开放决策与裁决记录

> C2、C3 已由产品方裁决（2026-07-11）；其余按冻结文档唯一合理解释执行。

| # | 决策点 | 当前选择 | 替代方案 | 裁决 |
|---|---|---|---|---|
| D1 | 同 actionId 异 payload | 整批中止 409 + details.actionId | 逐项 rejected(errCode=IDEMPOTENCY_KEY_REUSED) 于 200 内 | 冻结文档要求 409 且 wire 无逐项 409 分支 → 采纳整批中止（恢复语义见 §4.5） |
| D2 | cursor 与 query limit 不一致 | 忽略 query limit，以 cursor.limit 为准 | 不一致即 400 INVALID_CURSOR | 已确认（2026-07-11）采纳前者 |
| D3 | 已删除菜谱再 delete | applied + 既有墓碑（幂等） | rejected RECIPE_DELETED + 墓碑 | 已确认（2026-07-11）采纳前者 |
| D4 | Argon2 库 | @node-rs/argon2@2.1.0（napi prebuilt，PHC 与 DB CHECK 匹配） | argon2（node-pre-gyp） | 采纳；集成测试验证 PHC 与 DB CHECK 匹配 |
| D5 | bootstrap 409 判定 | 唯一约束 23505 → ALREADY_INITIALIZED | 先 compare-and-set 再并发兜底 | 采纳；token hash 唯一冲突概率不可达，不做区分 |
| D6 | limit 缺省 | 100 | — | 采纳 |

## 10. 实现注记（坑位记录）

- drizzle 的 `sql` 模板会**展开数组参数**为多参数，`coalesce($arr, tags)` 会退化为
  单元素类型冲突；tags 更新走条件 SET + 单参数 `pgTextArrayLiteral(...)::text[]`。
- drizzle 把 postgres-js 的 `PostgresError` 包成 `DrizzleQueryError`（`cause` 保留原错误）；
  业务代码（bootstrap 的 23505→409、sync 的 23505→duplicate 重放）与 on-error
  统一经 `db/postgres-error.ts` 解包，不得直接 `instanceof PostgresError`。

## 11. Review 修复记录（2026-07-11）

三域独立审查（auth/安全、sync/事务、接线/契约/文档漂移）后修复：

- 全局同步写锁 key 从 `hashtext('mealmate_sync_write_v1')` 改为冻结字面量
  `1296911409`（实测 PG16 下 hashtext = -986392774，与契约不符）；barrier 测试断言精确 key。
- 1MB 页截断改为按 wire 实际 **UTF-8 字节**度量（原 UTF-16 度量中文可超限约 3 倍），
  抽取纯函数 `paging.ts` 并补截断/超限测试。
- `isPrivateAddress` 与 `canonicalizeSourceAddress` 同源：私有判定基于规范化结果，
  修复 `::ffff:x.x.x.x`、`::1`、zone id、IPv4 前导零的判定裂缝（双栈下限流塌缩单桶）。
- `/health/ready` 503 移除未冻结的 `code` 字段（HealthNotReadyResponse 为 additionalProperties:false）。
- body 上限改用 hono/body-limit 流式字节计数，chunked 传输不可绕过（原仅查 content-length）。
- bootstrap 与 sync 的 23505 兜底修复 DrizzleQueryError 解包（并发用例暴露）。
- recovery-reset 顺带清空 auth_attempt_throttles；Bearer scheme 大小写不敏感。

**文档化偏离**（冻结契约约束下的已知取舍，升级契约版本前保持）：

- 未匹配路由的 404 使用非 envelope 形状：错误目录无通用 404 码，合规 envelope 无法构造；
  X-Request-Id 头仍由全局中间件附加。补码需新契约版本。
- 连接池无「获取超时」：postgres-js 原生不支持，`connect_timeout` 仅覆盖建连；
  饱和请求排队由 statement_timeout(5s) 兜底，阶段 5 容量基线前重评。
- 根路由 `GET /` 返回 name/version 元数据，不在 allowlist 内（非业务接口，阶段 0 骨架遗留）。

