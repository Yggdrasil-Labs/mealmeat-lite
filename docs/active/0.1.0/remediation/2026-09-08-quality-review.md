---
reviewed-at: 2026-09-08
scope: stage-2-remediation-current-worktree
verdict: fail
---

# 阶段 2 整改质量审查（2026-09-08）

## 结论

服务端认证、同步事务和聊天租约已有可靠的自动化基础，但 Android 同步恢复、版本单调性、离线编辑用户路径和生产 Compose 可复现性存在实际缺陷。本次审查结论为 **FAIL**：在修复 P1 问题并完成两客户端验收前，不能宣称阶段 2 的原始端到端目标完成。

本报告审查当前 `main` 工作区：它比 `origin/main` 超前 4 个提交，并包含 7 个未提交的 Android 文件修改。本报告不改写历史 roadmap 或此前审查结论，也不把阶段 3/4 明确未实现的业务功能计为缺陷。

## 本轮验证

| 检查 | 结果 |
|---|---|
| 后端 lint、typecheck、contract:check | 通过 |
| 后端单元测试 | 189/189 通过 |
| PostgreSQL 集成测试 | 80/80 通过 |
| Android contract model、JVM 测试、ktlint、detekt、lint | 通过；JVM 78/78 通过，lint 有 1 条非阻断警告 |
| `git diff --check` | 通过 |
| Android instrumentation、真机与两客户端端到端验收 | 未执行；当前环境没有可用 `adb` |

静态与 JVM 验证证明已有测试覆盖的路径稳定，但不替代设备、网络中断和两独立客户端的验收。

## P1：同步错误会让离线动作无法恢复

`RetrofitSyncActionClient` 没有解析非成功响应的错误体；`InitialSyncCoordinator.drainActions` 将异常统一交给 `quarantine`。`ContractCacheDao.quarantineAttempt` 只将动作置为 `FAILED`，不创建对应的 `sync_failures` 记录。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:284`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:599`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/local/dao/ContractCacheDao.kt:302`

结果是 401 不会失效会话，429/5xx 不能回到 pending 重试，409 无法只处理冲突 action。应保留错误码和服务端详情，按 401、暂时失败、409 与非法协议回执分别恢复，并覆盖每种 HTTP 状态及批量部分失败。

## P1：重复回执可使缓存版本倒退

`RoomSyncActionStore.applyAuthoritative` 直接写入 ACK 资源和 `replica_versions`，没有比较已有版本；同步 drain 成功后也没有按设计再拉取一次增量页。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:240`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:699`

可复现场景：设备 A 的 v2 action 已在服务端成功但 ACK 丢失；设备 B 产生 v3；A 重连后已拉到 v3，再重传旧 action 并收到 duplicate v2。当前逻辑会把缓存从 v3 写回 v2。快照和 ACK 应共用“仅接受更高 serverVersion”的事务逻辑；旧回执只能确认动作完成，不能回写旧资源；上传完成后执行最终 pull。

## P1：拒绝回执没有原子应用权威资源

收到 rejected action 后，协调器只写 `SyncFailureEntity`，没有把响应中的 authoritative resource 与版本应用到缓存。乐观本地投影可能长期停留在过时状态，不满足 AC12 对服务端权威回滚的要求。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:348`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:681`

应在同一个 Room transaction 内完成版本检查、权威资源更新、action 失败状态和失败原因记录，并覆盖 recipe 与 tombstone 回滚。

## P1：生产 Compose 缺少可复现的模型运行配置

主 Compose 中 app 只在 `internal: true` 网络上，未显式注入 Provider API key；Caddy 也没有收到 `MEALMATE_PUBLIC_DOMAIN`。本机存在未纳入 Git 的 `docker-compose.override.yml` 补充了部分配置，但 README 与 CI 使用显式 `-f` 参数，不会加载该 override。

受影响位置：

- `docker-compose.yml:52`
- `docker-compose.yml:91`
- `docker-compose.override.yml`（未纳入 Git）
- `.github/workflows/ci.yml:156`

应将必需的配置入口纳入版本管理，将密钥值保留在部署端的 secret/env 文件；明确 app 的受控出网路径；在 CI 中增加一次不访问真实 Provider 的启动、ready、反代和脚本化 Provider 验证。现有 CI 仅检查 Compose 语法与镜像构建。

## P1：离线菜谱编辑尚未形成可见的用户闭环

Recipes 页面要求用户手输 recipe ID。ViewModel 在本地写入后只保存 actionId，丢弃 repository 返回的 effective projection；Room 的 `observeRecipes` 没有消费方。因此用户无法从页面确认离线修改已经生效。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/ui/recipes/RecipesScreen.kt:32`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/ui/recipes/RecipeEditorViewModel.kt:102`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/local/dao/ContractCacheDao.kt:42`

这属于当前 T4 的整改范围。先提供来自 Room 的可选择菜谱、即时 effective projection 和失败操作关联；完整搜索/详情体验可以继续留在后续阶段。

## P2：同步锁范围和 ACK 校验与设计不一致

`InitialSyncCoordinator` 在整个网络 fetch、上传和应用阶段持有 `StateMutationMutex`；离线编辑同样使用该锁。弱网会阻塞用户的本地编辑与入队。

`drainActions` 只比较 ACK actionId 集合，不验证服务端回执与上传顺序一致；现有测试还明确断言非法 ACK 不回到 pending，这与 design 要求“整批恢复 pending、保留诊断”相反。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:167`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/sync/SyncCoordinator.kt:296`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/recipes/OfflineRecipeRepository.kt:104`
- `app/app/src/test/java/io/yggdrasil/labs/mealmate/lite/data/sync/InitialSyncCoordinatorTest.kt:193`

应把同步单飞与短暂的 Room 状态修改分开，网络等待不占本地 mutation 锁；ACK 改为按列表逐项匹配；先修正与设计相反的测试断言，再实现恢复逻辑。

## P2：SSE error 事件未绑定当前请求

`ChatViewModel` 接受 requestId 非空的 SSE error，但没有验证它等于当前 requestId。来自旧请求或错误连接的合法 error frame 可能终止当前请求并显示错误。

受影响位置：

- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/ui/chat/ChatViewModel.kt:233`
- `app/app/src/main/java/io/yggdrasil/labs/mealmate/lite/data/chat/SseStreamValidator.kt`

应要求 SSE error 的 requestId 与当前请求一致，并在现有错配输入测试中断言事件被拒绝。

## P3：同步回执指纹与设计记录不一致

服务端目前只哈希 action payload；设计记录要求哈希 `{type, payload}`、排除 `createdAt`。现有重放流程额外比较 action type，未发现可直接利用的功能错误，但数据库中的 `payloadHash` 与约定不一致。

受影响位置：

- `server/src/services/sync/sync-service.ts:277`
- `docs/design-docs/brainstorm.md:371`

应统一为 `canonicalizeRfc8785({ type, payload })`，并增加 receipt 哈希公式及跨类型重放测试。

## 改进顺序

1. 修复 action 上传错误分类、权威资源回滚和版本单调性，并补齐回归测试。
2. 缩小同步锁范围，补齐 post-drain pull 与有序 ACK 校验。
3. 完成最小菜谱离线编辑可见路径及 SSE requestId fencing。
4. 将生产 Compose 配置入口纳入 Git，补运行时 smoke test。
5. 运行 T7 两客户端验收后，再更新 tracker、worklog 和 roadmap 的完成状态。
