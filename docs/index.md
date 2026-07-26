# MealMate Lite 文档索引

## 入口

| 文档 | 负责回答 |
|------|----------|
| `../AGENTS.md` | 仓库入口、常用命令、工作约定 |
| `../ARCHITECTURE.md` | 技术栈、分层、部署、约束 |
| `PRODUCT_SENSE.md` | 产品定位、范围、统一语言 |
| `roadmap.md` | 版本里程碑、开发阶段、验收标准 |

## 推荐阅读路径

1. 从 `roadmap.md` 确认当前里程碑、阶段门禁和验收标准。
2. 需要理解产品边界时阅读 `PRODUCT_SENSE.md`；v0.1 的实现范围以 `roadmap.md` 为准。
3. 需要实现或评审技术方案时阅读 `../ARCHITECTURE.md` 和 `design-docs/tech-stack.md`。
4. 追溯设计取舍、数据契约或竞品依据时阅读 `design-docs/brainstorm.md`；它是探索记录，不替代路线图中的范围与验收。

## 设计文档

| 文档 | 内容 |
|------|------|
| `design-docs/product-design.md` | 完整产品功能设计 |
| `design-docs/tech-stack.md` | 技术选型决策与理由 |
| `design-docs/brainstorm.md` | 探索记录、竞品、数据契约 |

## 文档落点规则

- 长期稳定的架构事实 → `../ARCHITECTURE.md`
- 产品语义和范围 → `PRODUCT_SENSE.md`
- 技术选型决策 → `design-docs/`
- 版本路线与验收 → `roadmap.md`
