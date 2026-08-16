# 阶段 2 原始目标补全跟踪

| ID | 原始目标 | 当前缺口 | 依赖 | 状态 |
|---|---|---|---|---|
| R2-01a | AC5：首台初始化、后续设备加入、家庭码一次性展示与恢复入口 | 没有 credential gate、加入/恢复页面或 Auth ViewModel | Keystore 凭证、root navigation | planned |
| R2-01b | AC5 前置：新设备取得合法默认模型 | 没有 models route、默认模型选择或 session 内选择存储 | ModelCatalog、Auth 成功流 | planned |
| R2-01c | AC5：撤销设备后停止其活动聊天且不再写入 | 没有 chat route/runtime，Android 对话页为占位 | R2-01a、R2-01b、聊天执行与凭证生命周期 | planned |
| R2-02 | AC6：两台设备从菜品编辑/删除入口真实离线修改后同步 | 没有 RecipeEditor、OfflineRecipeRepository、Android API、Coordinator 或上传 Worker | Android 网络、Room 操作队列与菜品输入 UI | planned |
| R2-03 | AC10：设置页轮换家庭码、列设备、撤销/注销 | 服务端 API 存在；Android 设置页为占位 | 安全 token 存储、Settings ViewModel | planned |
| R2-04 | AC12：新设备拉全量快照，拒绝后原子回滚并保留/展示原因 | `SyncPageApplier` 未由网络循环调用；失败记录未接入 UI | SyncCoordinator、Room 事务、SyncFailure UI | planned |
| R2-05 | 验收口径 | roadmap/阶段 2 文档把服务端证据写成完整 AC 完成 | R2-01a..R2-04 全部通过 | blocked-by-implementation |

规则：一次只允许一个条目为 `in-progress`。每个条目完成前必须在 `worklog.md` 追加提交范围、
新鲜命令输出摘要和未覆盖的外部状态；不得用旧阶段文档的完成标记替代证据。
