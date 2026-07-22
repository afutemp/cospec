---
name: product-kb-init
description: 从千流 IPD 项目/版本/团队/迭代范围或 Epic/Feature 根需求首次生成完整产品规划知识库。生成标准快照、聚合文档、每 Feature 文档、元数据、受管清单和校验报告。触发词：从IPD生成产品知识库、初始化规划知识库、项目版本生成知识库。
---

# 初始化产品规划知识库

## 参数

- Scope 模式：`projectId` 必需；可选 `versionId`、`teamId`、`sprintId`。
- Root 模式：一个或多个 `rootIssueId`。Root 与 Scope 互斥。
- `output` 默认 `product-kb`。
- `template` 默认 `${CLAUDE_PLUGIN_ROOT}/templates/product-planning-kb`。
- 默认查询、下载并解析需求附件。原文件保存到 `.source/attachments/<issueId>/<attachmentId>/`，解析正文、状态、解析器、文件指纹和来源信息写入快照。
- 支持文本、Markdown、HTML、JSON、CSV、PDF、DOCX、XLSX、PPTX；空文件、超限、下载失败、解析失败和不支持格式必须产生 warning，不能静默忽略。

## 阶段 1：预检

1. 输出目录为空才允许首次初始化。
2. 非空且无合法 `.product-kb-meta.json` 时立即停止；`force` 不能覆盖未受管目录。
3. 已受管目录建议使用 `product-kb-update`。显式全量重建也只能替换受管文件并保留非受管文件。
4. 检查模板和 Core 脚本可读。

## 阶段 2：采集

调用 `scripts/product-kb-core/scripts/collect.js` 写入 `.source/pending-init/`。采集完成后先检查快照 JSON 和 warning。详情/评论/附件的单条 warning 可继续；范围、分页或快照写入 fatal 必须停止。

## 阶段 3：从同一快照生成

所有任务只读取 pending `source-snapshot.json`，禁止重复调用 IPD：

1. Batch 1：战略价值、角色、问题/JTBD、版本里程碑。
2. Batch 2：旅程、需求池/优先级、版本范围/路线图。
3. Batch 3：每个 Feature 一份 `03-功能规划/<ID>-<安全名称>.md`。
4. Batch 4：质量合规、依赖风险、指标实验、资料索引。
5. 最后根据真实文件生成 README。

遵循 Core `mapping.md` 和 `generation-contract.md`。每项关键结论引用 `IPD-<issueId>/ATTACHMENT-<attachmentId>` 或 `IPD-<issueId>`；证据不足写 `[OPEN] IPD 未提供`。Tech 不得提升为客户价值。只有 `status=parsed` 的附件正文可作为内容证据，其他状态只能进入资料索引和 warning。

## 阶段 4：元数据与受管状态

生成 `.product-kb-meta.json` 和 `.source/managed-manifest.json`，记录 Adapter、查询范围、快照、Issue 指纹、文档来源双向映射、受管文件指纹、统计和 warning。受管 Markdown 必须包含管理注释。

## 阶段 5：校验与定向重试

调用 `validate.js`。只重试报告明确失败的文档，最多两轮。仍有 error 时状态写为 `INVALID`，保留快照、文档和报告并列出恢复入口，不声称初始化完全成功。

若进程中断且 pending 快照有效，从已完成批次恢复，不重新访问 IPD。

## 阶段 6：生成导航索引

校验通过后，路由 `product-kb-index`（`root` = 本次 output 目录）生成 `INDEX.md`：脚本出行号骨架并自检 → 语义步骤补主题速查表 → `--verify` 校验行号。

- 校验状态为 `INVALID` 时跳过本阶段（正文都没通过，索引无意义）。
- 索引校验按 `product-kb-index` 的规则最多修补两轮；仍失败则不回滚正文，但**最终状态门禁**必须区分：正文校验通过、索引已产出且 `--verify` 通过 → 报告"初始化完成，含导航索引"；正文通过但索引缺失或未通过校验 → 报告"初始化完成，但导航索引未生成/未校验，可重跑 `product-kb-index`"。不得在索引缺失时笼统声称"全部完成"。
