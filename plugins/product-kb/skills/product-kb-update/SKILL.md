---
name: product-kb-update
description: 增量更新受管产品规划知识库。重新采集 IPD 快照，生成新增/修改/删除/关系变化/冲突预览，等待用户确认后才应用更新并重新校验。触发词：更新产品知识库、同步IPD变化、刷新规划知识库、增量更新。
---

# 产品规划知识库增量更新

## 输入

- `root`：受管知识库根目录，必需。
- 默认复用 `.product-kb-meta.json` 中的 Adapter 和 sourceQuery。
- 可显式覆盖项目/版本/团队/迭代或 Root 范围；范围变化必须醒目标记。

## 阶段一：Plan（只读正式知识库）

1. 检查 `.product-kb-meta.json`、正式快照和 Manifest 可读。
2. 使用 `product-kb-core/scripts/collect.js` 采集到 `.source/pending-update/`，包括重新下载和解析范围内需求附件。附件正文、文件指纹或解析状态变化必须进入快照差异。
3. 使用 `diff.js` 生成 `update-plan.json` 和 `update-preview.md`。
4. 展示新增、修改、删除、关系变化、warning 变化、冲突、受影响文档和文件操作。
5. **必须等待用户明确确认。此阶段不得修改正式快照、Meta、Manifest 或规划 Markdown。**

## 阶段二：Apply（用户确认后）

1. 重新验证计划的 Meta、快照和受管文件基线指纹；过期则停止并重新 Plan。
2. 所有 AI 生成任务只读取 pending 新快照，不调用 IPD。
3. 在 pending staging 中重建受影响聚合文档和 Feature 文档。
4. 调用 `managed_files.js apply` 创建备份并原子替换。
5. 删除仅限同时满足 Manifest、管理注释和来源映射的受管 Feature 文档。
6. 非受管文件始终保留；受管文件冲突按整文件重建处理，确认前提示用户迁移需保留内容。
7. 将 pending 快照提升为正式快照，更新 Meta/Manifest，执行 `validate.js`。
8. 校验含 error 时状态为 `INVALID`，保留报告和备份，不声称更新完全成功。

Update 和后续 Optimize 是两个独立写入门禁；确认 Update 不代表授权 Optimize。
