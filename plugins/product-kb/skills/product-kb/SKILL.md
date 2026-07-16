---
name: product-kb
description: 产品规划知识库全生命周期总入口。根据用户意图和目标目录状态调度初始化、增量更新、质量评估、证据内优化或本地查询。触发词：产品知识库、规划知识库、生成更新评估知识库、管理产品规划。
---

# 产品规划知识库总调度

本 Skill 只路由，不复制采集、生成、更新、评分、修复或查询规则。

## 先检查目录状态

- 无 `.product-kb-meta.json`：未受管。
- 有合法 Meta、快照和 Manifest：已受管。
- 文件存在但不可解析：损坏状态，先路由 `product-kb-eval`/Validate，不猜测。

## 路由

| 意图 | 状态 | 目标 Skill |
|---|---|---|
| 生成、初始化、从 IPD 建库 | 未受管 | `product-kb-init` |
| 生成、初始化 | 已受管 | 推荐 `product-kb-update`；显式全量重建进入 Init 的受管重建分支 |
| 更新、同步、刷新 | 已受管 | `product-kb-update` |
| 更新 | 未受管 | 先 `product-kb-init` |
| 评估、评分、检查质量 | 已受管 | `product-kb-eval` |
| 修复、优化 | 有当前有效评估报告 | `product-kb-optimize` |
| 修复、优化 | 无报告或报告过期 | 先 `product-kb-eval`，再由用户决定是否优化 |
| 查询、列出、追溯 | 已受管 | `product-kb-query` |

## 组合流程

- 生成并评估：Init 校验后 Eval。
- 更新并评估：Update Plan 等待确认，Apply 后 Eval。
- 评估并修复：Eval 后生成 Optimize Plan，再等待确认。
- 更新、评估并优化：Update 写入与 Optimize 写入必须**分别确认**，一次确认不能覆盖两个阶段。
- 查询最新：先显示快照时间；用户选择刷新后执行 Update，再 Query。

意图有歧义时只问一个决定路由的问题。任一阶段 fatal 或结构损坏时停止组合流程并给出恢复入口。
