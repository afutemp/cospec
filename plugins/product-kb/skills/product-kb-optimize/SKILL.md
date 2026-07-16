---
name: product-kb-optimize
description: 根据最新产品知识库评估报告生成修复预览，并在用户确认后只修复 IPD 快照有证据支持的结构、映射、一致性和表达问题。触发词：优化产品知识库、修复评估问题、提高规划知识库质量。
---

# 产品规划知识库证据内优化

## Plan

1. 读取最新有效 `evaluation-report.json`，验证其 Meta、快照、量表和文件基线未过期。
2. 将 findings 分为：可自动修复、需要产品决策、来源不足、不可修复。
3. 可自动修复仅包括格式/导航、来源明确的映射遗漏、来源明确的跨文档口径冲突和不改变事实的表达改进；`status=parsed` 的附件正文属于可用快照证据。
4. 来源不足始终保留 `[OPEN] IPD 未提供`；禁止以行业常识或 `[ASSUMPTION]` 补造产品事实。
5. 写 `.source/pending-optimize/optimize-plan.json/md`，列出文件、finding、来源、动作和预期关闭项。
6. 展示计划并**等待用户确认**。Plan 不修改正式文件。

## Apply

1. 确认后重新检查 Evaluation、Meta、快照和目标文件指纹；变化则计划失效。
2. 只读取正式快照，在 staging 中整文件重写目标受管文档。
3. 调用 `managed_files.js apply` 创建备份并原子替换；非受管文件不可写。
4. 运行 Validate 和 Eval，输出前后分数和未解决项。
5. 单次调用最多两轮修复→校验→评估；仍不合格则停止，不做无限提分。

Optimize 确认与 Update 确认相互独立。
