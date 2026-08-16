---
id: mealmate-0.1.0-stage2-original-goal-remediation-spec
version: "0.1.0"
feature: stage2-original-goal-remediation
status: draft
owner: Yggdrasil-Labs
created: 2026-08-16
updated: 2026-08-16
source-of-truth: docs/roadmap.md
---

# Spec — 阶段 2 原始目标端到端补全

## Overview

让已经具备服务端认证和同步语义的 MealMate Lite，真正从 Android 设备完成加入、设置管理、
离线菜品动作同步和撤销中的聊天终止；只有这些用户可观察行为全部可验证，AC5、AC6、AC10、
AC12 才能按原始路线图标记完成。

## Behavior: 设备加入、凭证失效与活动聊天终止（AC5）

### Scenario: 首台设备初始化，后续设备加入

Given 部署尚未初始化，或一个已初始化家庭拥有有效家庭码
When 用户分别完成首台初始化或后续设备加入
Then App 仅在成功响应后保存当前设备凭证
And App 依次完成唯一默认模型校验和初始同步后才进入主导航
And 首台 bootstrap 返回的家庭码仅在当前 UI flow 展示一次，确认后不持久化

### Scenario: 无凭证、切换中或会话不匹配时的加入入口

Given App 启动时没有 active credential、凭证处于 switching，或凭证与本地会话不匹配
When `SessionBootstrapper` 完成恢复检查
Then App 仅显示加入/恢复入口，而不显示四个主导航页面或发送受保护请求
And `ALREADY_INITIALIZED` 且没有 active credential 时显示“联系部署者恢复”，不得循环 bootstrap；只有用户已拥有家庭码时才显示普通注册入口
And 家庭码/secret 错误或网络失败分别显示可操作的输入错误或重试状态

### Scenario: 加入 provisioning 被中断后恢复

Given App 已安全保存新凭证，但默认模型校验或首次同步尚未完成
When App 在失败或进程重启后恢复
Then App 恢复 provisioning 而不进入主导航
And App 仅重试完成默认模型校验和首次同步所需的受保护请求

### Scenario: 撤销设备时有活动聊天

Given 设备 A 正在接收一条尚未结束的聊天响应
When 设备 B 撤销设备 A，或设备 A 自己注销
Then 服务端在下一次心跳或聊天业务提交前停止 A 的流，并且不发送不受冻结契约允许的 SSE `UNAUTHORIZED` frame
And App 最多发起一次受保护 session probe；该 probe 返回 401 时才清除凭证并显示加入/恢复入口，其他失败只显示“聊天已中断”
And 被撤销的聊天 runtime 不得新增 conversation 消息、工具写入或由聊天产生的 sync change

### Scenario: 凭证缺失、失效或被撤销

Given App 没有凭证，或服务端拒绝该凭证
When App 请求受保护的聊天、同步或设置操作
Then App 清除本地凭证并显示加入/恢复入口
And 不重试写入型请求或后台发送聊天草稿

## Behavior: 离线菜品动作的单飞上传与回执处理（AC6）

### Scenario: 两台设备离线编辑后恢复联网

Given 两台已加入设备各自在离线状态修改同一已同步菜品
When 两台设备恢复联网并触发同步
Then 服务端接收顺序最后成功的动作成为两台设备最终显示的状态
And 每个动作以原 actionId 至多执行一次
And 两台客户端均从 `OfflineRecipeRepository` 的 patch/delete 调用产生动作，而不是直接写 pending 表
And 用户从菜品编辑/删除入口完成该操作，离线时立即看到 effective local projection

### Scenario: 网络在上传确认前中断

Given 一个离线动作已被本地声明为正在发送
When 进程终止或网络在收到回执前中断
Then 下次同步恢复该动作并保持原 actionId
And 迟到的旧发送尝试不会覆盖新尝试的结果或删除动作

### Scenario: 服务端拒绝离线动作

Given 本地动作引用了已删除、已不存在或不可修改的菜品
When 同步收到拒绝回执
Then App 在一个原子本地更新中应用服务端权威资源或要求全量同步
And 保留可展示的失败原因，且该动作不再被自动上传

### Scenario: 重复动作重放原拒绝

Given App 在中断后用原 actionId 重投一个此前已被服务端拒绝的动作
When 服务端返回 duplicate 及其原始拒绝结果
Then App 与首次拒绝一样应用权威资源或进入全量同步
And 保留失败记录，而不是把 duplicate 当作成功删除

## Behavior: 设置页设备管理（AC10）

### Scenario: 轮换家庭码

Given 当前设备已加入家庭
When 用户在设置页确认轮换家庭码
Then 页面只显示本次新家庭码一次
And 旧家庭码立即不能加入新设备，现有设备继续可用

### Scenario: 查看和撤销设备

Given 当前设备已加入家庭且存在至少一个其它设备
When 用户打开设备列表并撤销指定设备
Then 列表明确标识当前设备，撤销操作仅影响选中的设备
And 被撤销设备的下一次受保护请求进入未授权状态

### Scenario: 本机注销或管理请求失败

Given 用户注销本机，或网络/服务端拒绝设置操作
When App 处理响应
Then 注销只在服务端确认后清除本机凭证
And 失败时保留现有会话与可重试错误，不误报已完成
And 当前设备在设备列表中使用 logout，而不是 revoke，二者对本机的结果均为当前 token 失效

## Behavior: 快照同步与可见失败记录（AC12）

### Scenario: 新设备拉取多页快照

Given 新加入设备没有本地同步游标
When 它在联网状态运行同步
Then 它按服务端 cursor 逐页应用所有变更，并只在整页成功后推进本地游标
And 缓存中不出现半页状态或重复变更

### Scenario: 快照分页期间有新写入

Given 设备正在读取多页快照
When 另一设备在服务端结束快照水位前写入新变更，并且服务端在快照页后返回增量 cursor
Then 当前快照保持一致视图
And App 在本次 run 跟随该增量 cursor 获取新变更，不漏失也不重复

### Scenario: 快照终页没有后续 cursor

Given App 成功应用快照终页，且响应为 hasMore=false 并且没有 nextCursor
When App 提交该页
Then App 将本地 cursor 清为 null
And 下一次同步从新快照开始，不丢失已缓存的资源

### Scenario: cursor 或响应无效

Given App 收到无效 cursor、无效响应或无法应用的变更
When 它处理该页
Then 本地游标和缓存保持在上一页的完整状态
And App 向同步状态显示可诊断的失败而不是继续推进游标

### Scenario: 同步失败保持可见直到用户处理

Given App 已收到 rejected、cursor 或协议失败并记录其失败原因
When 用户查看菜品或同步状态
Then 页面显示该失败的错误码、文案和关联资源，且不会自动重传失败动作
And action failure 只能由用户丢弃或重新编辑该资源后解除，重新编辑使用新的 actionId
And cursor/protocol diagnostic 不关联 actionId，只能由用户 dismiss 或在下一次完整同步成功后清除

## Constraints

- device token 仅可存放在 Android Keystore 保护的存储中；不得进入 Room、普通 SharedPreferences 或日志。非敏感本地 sessionId 只用于与 Room 协调状态匹配，不能成为认证凭证或写入日志。
- 全 App 只能存在一个同步执行器；前台、启动和后台任务必须复用它。
- 后台周期同步为 30 分钟；同一动作的本地 sending claim 超过 5 分钟必须恢复为 pending，并保持原 actionId。
- 聊天租约为 30 秒、心跳间隔最多 10 秒；流 60 秒无事件或总时长达到 5 分钟即以可重试失败结束。
- `UNAUTHORIZED` 只允许 JSON 响应；已经发出 `start` 的 SSE 在撤销时仅安全关闭，App 以一次受保护 session probe 确认 401，不能伪造未授权 SSE frame。
- Android 网络行为使用 MockWebServer 验证，服务端事务行为使用 PostgreSQL 16 验证；不依赖真实模型或公网服务。
