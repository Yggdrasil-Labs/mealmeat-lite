# MealMate Lite — Roadmap

## 里程碑总览

```
v0.1  对话内核       菜品 CRUD + 周计划生成/调整 + AI 多轮对话（MVP）
v0.2  食材字典       ingredients 从自由文本升级为结构化食材
v0.3  库存管理       食材入库、查询、过期追踪、对话操作
v0.4  采购清单       基于计划+库存差值生成、勾选确认、采购入库
v0.5  一餐多菜       Meal + MealDish 结构，荤素搭配
v0.6  剩菜与复用     剩菜池、优先消耗快过期、食材复用约束
v0.7  角色与偏好     FamilyRole、角色口味、动态 System Prompt
v0.8  提醒通知       备菜/过期/计划未确认/自定义，本地通知
v0.9  体验打磨       流式混合渲染、冷启动引导、快捷 refine
v0.10 每周回顾       统计卡片、频次分析、品类分布
v1.0  CV 拍照        拍照识别菜品/食材、拍照盘库存
v1.1  智能推荐       口味学习、季节推荐、复购预测
v1.2  语音交互       做菜时语音对话、语音操作库存
v1.3  生态扩展       多家庭共享、菜谱分享、团购对接
```

不绑时间线，兴趣驱动，按里程碑顺序推进。

### 版本依赖关系

```
v0.1 ─┬→ v0.2（食材字典）─→ v0.3（库存）─→ v0.4（采购清单）
      │                                    ↗
      ├→ v0.5（一餐多菜）─→ v0.6（剩菜复用）
      ├→ v0.7（角色偏好）         ← 独立，可随时做
      ├→ v0.9（体验打磨）         ← 独立，依赖 v0.1 即可
      └→ v0.10（每周回顾）        ← 独立，依赖 v0.1 即可
v0.3 ─→ v0.8（提醒通知）          ← 依赖库存（过期提醒）
v0.3 ─→ v1.0（CV 拍照）           ← 依赖库存（拍照盘库存）
```

| 里程碑 | 前置依赖 | 独立性 |
|---|---|---|
| v0.1 对话内核 | — | 起点 |
| v0.2 食材字典 | v0.1 | 必须先做 |
| v0.3 库存管理 | v0.2 | 必须先做 |
| v0.4 采购清单 | v0.2 + v0.3 | 必须先做 |
| v0.5 一餐多菜 | v0.1 | ⚡ 可独立 |
| v0.6 剩菜与复用 | v0.3 + v0.5 | 需等前置 |
| v0.7 角色与偏好 | v0.1 | ⚡ 可独立 |
| v0.8 提醒通知 | v0.3 | 需等库存 |
| v0.9 体验打磨 | v0.1 | ⚡ 可独立 |
| v0.10 每周回顾 | v0.1 | ⚡ 可独立 |
| v1.0 CV 拍照 | v0.3 | 需等库存 |
| v1.1 智能推荐 | v0.3 + v0.7 | 需等前置 |
| v1.2 语音交互 | v0.3 | 需等库存 |
| v1.3 生态扩展 | v0.1 | ⚡ 可独立 |

---

## v0.1 对话内核（MVP）

**一句话**：AI 多轮对话管理菜谱 + 生成周计划。证明"有数据 + 有上下文"比通用 ChatGPT 强。

### 范围

| 维度 | 内容 |
|---|---|
| 数据模型 | Recipe, WeeklyPlan, PlanItem, Conversation（按 `device_id` 隔离）, Settings（家庭共享偏好）, AuthConfig, DeviceToken, PendingConfirmation, ChatRequestReceipt, SyncActionReceipt, SyncChange, AuthAttemptThrottle（12 实体） |
| Function Calling | add_recipe, update_recipe, delete_recipe, restore_recipe, search_recipes, batch_generate_recipes, generate_weekly_plan, update_plan_item（8 functions） |
| API | `/api/v1` 下的 chat、models、recipes、plans、settings、auth、confirmations、sync；包含 `GET /sync`、`POST /sync/actions`、设备管理与家庭码轮换 |
| App 页面 | 对话主页、菜品库、周计划、设置（模型/偏好/同步状态/家庭码轮换/设备列表与撤销/注销），共 4 页 |
| 导航 | Bottom Nav（对话、菜品、计划、设置） |
| 认证 | 单家庭单部署；部署者提供的一次性 bootstrap secret 初始化，家庭码注册设备，device token 鉴权 |
| 同步 | Room 本地缓存；可离线轻操作以幂等 pending_actions 上传，按服务端接收顺序应用 |

### 关键约束

- 一餐一菜（PlanItem 1:1）
- 固定使用 `Asia/Shanghai`；同周仅保留当前计划，过往周永久保留。生成计划优先避开近 7 天菜谱，菜谱不足时允许复用并说明
- Recipe.ingredients 为自由文本数组，不做食材字典关联
- 菜谱允许重名；搜索仅对名称、标签和自由文本食材做不区分大小写包含匹配。按名称写操作先搜索，零个或多个候选必须澄清
- 口味偏好 = 设置页一段家庭共享纯文本 → System Prompt 注入；模型选择与 Conversation 都是设备级，不写入共享 Settings
- 对话按设备保留最近 20 个完整 user/assistant 轮次，超出部分从服务端和本地永久删除；对应 ChatRequestReceipt 清除正文、工具内容和最终回复，仅留幂等墓碑并返回 `CHAT_REQUEST_EXPIRED`。离线发送立即失败、保留草稿，用户联网后手动重发
- SSE 以基础文本流为主；仅批量菜谱和周计划覆盖增加固定 `confirmation-required` 面板，不做通用混合消息渲染
- 离线时可浏览本地数据；仅菜品轻操作进入 pending_actions，AI 对话不排队；家庭偏好离线仅存本地草稿、需用户联网后手动保存
- 冲突策略：所有可同步写事务先取得全局 PostgreSQL transaction advisory lock，按锁获取/提交顺序分配版本；后写成功动作覆盖先写成功动作，不按客户端时间戳判定。同步回执与删除墓碑在 v0.1 永久保留
- 批量生成菜品、覆盖已有周计划必须先生成预览并经确认后写入；确认令牌仅发起预览的设备可在 10 分钟内提交，同设备同类新预览会使旧预览失效
- 确认草稿以令牌哈希、发起设备、过期时间和消费状态持久化；确认提交一次性、幂等且原子执行。周计划预览的目标版本变化则拒绝旧确认并要求重新预览
- 在线聊天以设备级 `chatRequestId` 幂等；中断重试复用同一 ID、离线未发送草稿手动重发生成新 ID。同设备仅允许一个有效聊天租约，另一 ID 并发返回 `CHAT_DEVICE_BUSY`，不排队、不提供取消；旧租约过期后若用户改发新 ID，旧可恢复请求转为 `CHAT_REQUEST_SUPERSEDED`。聊天 worker 使用 30 秒租约、10 秒心跳和 generation fencing；仅用户主动重试可接管过期租约并复用已完成工具回执，不做后台恢复。SSE 使用显式事件协议，流前错误为 JSON、流中错误为 SSE 事件；确认 token 只经 `confirmation-required` 交给 App，模型不可见
- 删除当前或未来计划引用的菜谱必须拒绝；历史 PlanItem 保存菜谱名称快照。已删除菜谱只能经 `restore_recipe` 显式恢复
- 计划生成由服务端选择至多 100 条候选菜谱；模型可进一步搜索，但不得自动新建未确认菜谱
- 仅安全读取或尚未产生副作用的模型请求可自动重试；写入型 FC 不盲重试。SSE 60 秒无事件或总计 5 分钟后以可重试错误结束，不自动切换模型
- 用户输入、菜谱和偏好作为不可信数据处理；后端 schema、鉴权与确认机制始终约束工具执行。单条消息不设工具调用次数上限
- 所有已加入设备权限相同，可改共享偏好、轮换家庭码和撤销其它设备；令牌不自然过期。恢复家庭码由部署者受限命令执行，且会撤销全部旧设备令牌而不删除业务数据
- 仅支持服务端已启用、声明 streaming/tools 能力并在发布前通过显式 verify 命令的 OpenAI-compatible 模型；可用目录必须恰有一个默认模型，新设备自动选择它，`modelId` 每次聊天均在服务端 allowlist 校验。bootstrap 初始化用唯一约束防并发；家庭码为 12 位 Crockford Base32、按 `XXXX-XXXX-XXXX` 展示并用固定参数 Argon2id 保存，轮换后的明文仅在成功响应中返回一次
- 不做库存、采购清单、提醒、统计

### 验收标准

- [ ] AC1: 对话"加个红烧肉"→ 菜品创建 + AI 确认回复
- [ ] AC2: 对话"帮我生成 20 个家常川菜"→ App 收到只读固定确认面板且菜谱表零新增；面板不能直接删项或改名，修改必须通过继续对话生成会 supersede 旧草稿的新预览；token 不进入模型/日志/持久化客户端存储，发起设备在 10 分钟内点击确认后才批量创建，相同提交 ID 重试不重复写入；若候选全部与现有菜谱同名，则返回 `NO_NEW_RECIPES`、不创建确认草稿
- [ ] AC3: 对话"安排下周的菜，少辣"→ 无同周计划时原子生成 7 天 × 3 餐并可调整单餐；已有计划时仅返回覆盖预览，确认前原计划不变；目标周前 7 天外的可用菜谱至少 21 个时不得选近期菜谱，不足时允许复用且回复明确列出复用项
- [ ] AC4: 设置页切换模型 → 下轮对话生效；修改偏好文字 → System Prompt 更新
- [ ] AC5: 首台设备仅能通过 bootstrap secret 初始化；后续设备用家庭码注册，注销或被撤销后的 device token 访问受保护 API 返回 `UNAUTHORIZED`，其已启动聊天最迟在下一次心跳或业务提交前中止且不再写入
- [ ] AC6: 两台设备离线修改同一菜品后同步，最终状态等于全局同步写锁获取顺序最后一个成功动作；低版本事务不可能晚于高版本提交并被 cursor 漏掉，重复上传同一 `actionId` 不重复执行
- [ ] AC7: 断网发送 AI 消息提示失败并保留草稿；联网后只在用户点击“重新发送”时创建新的对话请求
- [ ] AC8: 新设备自动选择服务端唯一默认模型；两台设备拥有独立对话历史和后续模型选择，一个设备切换模型不影响另一个设备，且只可选择服务端已启用的兼容模型
- [ ] AC9: 被当前或未来计划引用的菜谱删除被拒绝；显式恢复只匹配已删除菜谱；超出 20 轮的设备对话及回执正文不再保留，旧请求不能重新执行
- [ ] AC10: 设置页可轮换家庭码、列出设备并单独撤销；轮换使旧码失效，旧码验证与轮换并发时不得在轮换提交后签发 token；同一规范化来源/scope 的 bootstrap secret 或家庭码第 5 次连续失败即返回 `429 RATE_LIMITED` 并带最多 15 分钟 `Retry-After`，成功清零、重启保留且并发不能绕过
- [ ] AC11: 同一确认令牌只能成功提交一次；目标周计划版本变化时返回 `CONFIRMATION_STALE`；相同 `chatRequestId` 重试不重复执行工具写入
- [ ] AC12: 新设备以分页 cursor 拉取完整同步快照；离线动作被拒绝后，客户端回滚到服务端返回的资源版本并保留失败原因
- [ ] AC13: SSE 严格以 `start` 开始、以 `done|error` 结束，中间只允许 `delta/tool-status/confirmation-required`；断流重试同一 `chatRequestId` 时，App 替换失败的半条回复而不重复文本，已完成请求重放结果及有效确认面板，活动租约返回 `CHAT_IN_PROGRESS`，过期租约由用户重试接管且旧 generation 无法再写入；同设备另一 ID 并发返回 `CHAT_DEVICE_BUSY`，旧请求过期后改发新 ID 会使旧请求不可恢复
- [ ] AC14: 生产 Compose 按 db healthy → migration completed → app ready → caddy 的顺序启动；未迁移或缺必填配置时 readiness 失败且 App 不接收业务流量。本地/CI 叠加 test override 后不访问 DNS/ACME、使用随机宿主端口，并通过同一健康链

### 开发顺序与进入门禁

| 阶段 | 可开始条件 | 交付物 | 退出条件 |
|---|---|---|---|
| 0. 仓库与运行骨架 | 四文档范围稳定 | pnpm/Gradle monorepo、Biome、Android lint、Compose、健康检查、CI 命令 | 本地空实现可构建，DB migration 可重复执行 |
| 1. 契约与持久化 | 数据/API/FC/sync schema 无待确认项 | Drizzle migration、Zod DTO、统一错误、Room entities、契约 fixtures | 后端和 Android 对同一 fixture 双向解析；迁移集成测试通过 |
| 2. 认证与同步底座 | 阶段 1 完成 | bootstrap/register/token、设备管理、SyncChange、pending_actions | AC5、AC6、AC10、AC12 通过 |
| 3. 菜谱与计划领域 | 阶段 2 完成 | Recipe/WeeklyPlan/PlanItem service、8 个 FC executor、确认草稿 | AC1、AC2、AC3、AC9、AC11 通过 |
| 4. 对话与 Android 闭环 | 阶段 3 完成 | provider adapter、SSE、4 个页面、Room/WorkManager | AC4、AC7、AC8、AC13 通过 |
| 5. 发布候选 | 阶段 4 完成 | 镜像、Caddy、部署说明、恢复重置命令 | AC14 和全部自动化门禁通过 |

文档侧开发进入门禁（以下全部满足；仍不替代阶段 0 的实际退出条件）：

- [x] `brainstorm.md` 中逻辑数据表的类型、约束、索引、FK 与事务不变量均已确定
- [x] 所有 HTTP、SSE、FC 与 Sync DTO 可直接转写为 Zod/Kotlin schema，不含泛化 `object` 占位
- [x] 家庭码格式与 KDF 参数已完成产品确认
- [x] 聊天请求崩溃恢复状态机已完成产品确认
- [x] `tech-stack.md` 已给出可复制执行的目标命令、外部依赖替身、并发测试屏障和 Compose 启动/健康约束
- [x] 四份文档的 v0.1 范围、错误码、确认语义和验收标准交叉一致

---

## v0.2 食材字典

**目标**：Recipe.ingredients 从自由文本数组升级为结构化食材关联，为后续库存和采购打基础。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 Ingredient（name, category, unit, shelfLife）；Recipe.ingredients → RecipeIngredient 关联表 |
| FC 新增 | — （对话录入菜品时 AI 自动解析食材并关联） |
| 后端 | services/ingredient.ts；迁移脚本（自由文本 → 结构化） |
| App | 菜品详情页展示结构化食材列表 |

### 关键决策

- 已有 Recipe 的自由文本 ingredients 先保留原文，再由 AI 生成候选 Ingredient 映射供用户确认；未确认或解析失败的条目继续保留自由文本，不得丢失
- Ingredient 表做去重，同义词合并（"西红柿" = "番茄"）
- 食材类别（蔬菜/肉类/调料/…）用于后续采购分组

---

## v0.3 库存管理

**目标**：追踪家里有什么食材、多少量、什么时候过期。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 Stock（ingredient_id, quantity, unit, expiry_date, created_at） |
| FC 新增 | update_stock, check_stock, batch_init_stock |
| 后端 | services/stock.ts |
| App | 库存页（分类浏览、过期预警标记） |

### 关键体验

- 对话"买了鸡蛋 30 个"→ 库存更新
- 对话"家里还有多少鸡蛋"→ 查询库存
- 对话"冰箱里有鸡蛋牛奶西红柿"→ 批量建库存（30 秒内完成首次建立）
- 对话"有什么快过期的"→ 列出临期食材

---

## v0.4 采购清单

**目标**：基于周计划所需食材 - 现有库存 = 需要买的东西。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 ShoppingList, ShoppingItem（ingredient_id, quantity, checked） |
| FC 新增 | generate_shopping_list |
| 后端 | services/shopping.ts |
| App | 采购清单页（勾选确认、按食材类别分组） |

### 关键体验

- 对话"出采购清单"→ AI 基于计划食材 vs 库存差值生成清单
- 清单项可勾选完成
- 勾选完成后相关食材自动入库（关联 v0.3 库存）

---

## v0.5 一餐多菜

**目标**：PlanItem 从一餐一菜升级为一餐 N 道菜，支持荤素搭配。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | PlanItem → Meal + MealDish（一餐 N 道菜） |
| FC 变更 | generate_weekly_plan / update_plan_item 适配多菜结构 |
| App | 周计划卡片展示多道菜 |

### 关键体验

- AI 生成计划时自动搭配荤素、干稀
- 对话"周三中午再加个汤"→ 追加菜品到该餐

### 迁移与历史兼容

- 采用新增 `Meal`/`MealDish` 表的加法迁移，不直接删除 `PlanItem`。
- 为每个既有 `PlanItem` 回填一个 Meal 和一个 MealDish，并保留当时的菜谱名称快照；历史计划在迁移后仍可读取和展示，即使原菜谱后来被删除。
- 在所有受支持客户端完成升级前，服务端继续兼容读取旧结构；删除旧结构必须另行进行版本迁移评审。

---

## v0.6 剩菜与复用

**目标**：减少食材浪费——剩菜记录、优先消耗临期、食材复用约束。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 Leftover（recipe_id, quantity, created_at） |
| FC 新增 | add_leftover, consume_leftover, suggest_use_expiring |
| 后端 | 剩菜池逻辑；计划生成时注入临期/复用约束 |

### 关键体验

- 做完饭后 AI 追问"有剩吗？"→ 记录剩菜池
- 下轮计划优先消耗剩菜和临期食材
- AI 生成计划时优先安排共享食材的菜品组合

---

## v0.7 角色与偏好

**目标**：从"一段文本偏好"升级为多角色口味管理。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 FamilyRole（name, taste_preferences, restrictions） |
| FC 变更 | System Prompt 动态注入当前角色偏好 |
| App | 角色设置页；对话时可切换"当前谁在说话" |

### 关键体验

- App 选择角色 → System Prompt 动态调整
- AI 计划兼顾多角色口味和忌口

---

## v0.8 提醒通知

**目标**：主动推送关键时间节点提醒。

### 新增/变更

| 模块 | 内容 |
|---|---|
| 数据模型 | 新增 NotifyRule（type, trigger_config, enabled） |
| FC 新增 | set_reminder |
| 后端 | jobs/（cron 扫描触发）；pending_notifications 表 |
| App | WorkManager 拉取 + 本地 Notification；提醒设置页 |

### 提醒类型

| 类型 | 触发 | 示例 |
|---|---|---|
| 备菜提醒 | 计划餐次前 N 小时 | "明天中午做糖醋排骨，今晚记得腌肉" |
| 过期提醒 | 库存 expiry_date 前 N 天 | "牛奶后天过期" |
| 计划未确认 | 每周固定时间 | "这周还没安排菜单" |
| 自定义 | 用户对话设置 | "明早提醒我泡黄豆" |

---

## v0.9 体验打磨

**目标**：App 交互从"能用"到"好用"。

### 内容

- **流式混合渲染**：AI 回复中嵌入可交互组件（菜谱卡片、可勾选清单、计划日历）
- **冷启动引导**：首次打开 AI 主动问 3-5 个问题 → 自动生成 System Prompt + 推荐首批菜品
- **快捷 refine**：AI 推荐后附带按钮（"换一批""少辣""只要素的""做快一点的"）
- **家庭菜谱书**：标记"咱家拿手菜"，记录首次尝试日期
- **"差什么"检查**：对比今日菜品 × 库存 → 一键加入采购清单

---

## v0.10 每周回顾

**目标**：简单统计，帮助感知饮食习惯。

### 内容

- 周日生成回顾卡片："本周 12 道菜，最常用食材猪肉，尝试了 2 道新菜"
- 频次统计：最常做的菜、最常用的食材
- 品类分布：荤素比、菜系分布
- 时间趋势：月度变化

---

## v1.0 CV 拍照

**目标**：视觉输入降低操作成本。

- 拍照识别菜品 → 录入 Recipe
- 拍照识别冰箱/菜篮食材 → 批量更新库存
- 与"一句话批量建库存"互补：文字适合初始化，拍照适合日常快速更新

---

## v1.1 智能推荐

**目标**：系统主动帮助，不只被动响应。

- 动态口味学习：从历史数据推断偏好变化
- 季节推荐：换季时主动推荐应季菜品
- 复购预测：追踪消耗速度 → 预测补货时机 → 自动加入采购清单
- 浪费追踪：记录过期丢弃 → 计算浪费金额 → 调整采购量建议

---

## v1.2 语音交互

**目标**：解放双手，做菜时可用。

- 做菜时语音对话（"鸡蛋用完了"→ 扣库存）
- 逐步骤语音烹饪引导 + 实时替代问答

---

## v1.3 生态扩展

**目标**：从单家庭工具向轻社交延伸。

> 前置架构评审：v0.1 为单家庭单部署。开始本版本前，必须单独设计 Household 聚合、全表数据归属、设备授权和数据迁移；不得把多家庭作为对 v0.1 设置或设备表的局部补丁。

- 多家庭共享：家庭码分享给亲友，各自独立数据
- 菜谱分享："咱家红烧肉"做法导出为卡片/图片
- 社区团购对接：采购清单 → 美团优选/多多买菜跳转

---

## 技术决策

完整技术选型见 [`tech-stack.md`](../../design-docs/tech-stack.md)，此处仅列核心选择：

| 维度 | 选择 |
|---|---|
| 后端 | Node.js + Hono + Drizzle + PostgreSQL |
| AI | Vercel AI SDK + Zod，部署端配置唯一默认模型 + OpenAI-compatible 多模型切换 |
| Android | Kotlin + Jetpack Compose + Room + Hilt + Retrofit |
| 部署 | Docker Compose（Node + PG + Caddy） |
| 仓库 | Monorepo（server/ + app/） |

## 仓库

独立 Git 仓库，位于 `mealmate-project/` 下，与 `mealmate-service`、`mealmate-web`、`mealmate-e2e` 平级。

## 相关文档

- 产品功能全景：[`product-design.md`](../../design-docs/product-design.md)
- 技术选型：[`tech-stack.md`](../../design-docs/tech-stack.md)
- 探索记录与竞品调研：[`brainstorm.md`](../../design-docs/brainstorm.md)
