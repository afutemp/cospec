---
name: large-requirement-workflow
description: 编排大需求产品规划管线——需求澄清、5 个并发的研究/竞品分析、用户旅程设计、TR1 需求说明书、4 个并发的 TR2（EPIC/Feature/Story/Tech），基于 skill 级 DAG 执行。所有步骤必选；同步骤内并发，步骤间串行。
---

# 大需求工作流（Large Requirement Workflow）

**Skill 标识**: `large-requirement-workflow`

其他 skill 通过 `large-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**大需求**（共创/客户反馈/竞品研究 + TR1 + TR2 完整产物），`brainstorming` 调用本 skill。本 skill 是一个 workflow entry skill：它生成 skill 级 DAG 产物，然后调用 `cospec-dag-executor` 调度 leaf skills。

本工作流对应 `docs/workflow-skill-steps.md` 中的「大需求工作流」。**所有节点均为必选**——不对研究/竞品节点做按需裁剪；缺少输入材料时由对应 skill 通过 `NEEDS_CONTEXT` 向用户索取。

## 职责

- 编排大需求主链（**步骤间串行、同步骤内并发，全部必选**）：
  - step1 `product-planning-requirement-clarification`
  - step2（5 个研究 skill **并发**）：`co-create-customer-minutes-analysis`、`customer-experience-feedback-analysis-v2`、`competitor-feature-research`、`competitor-pain-points`、`competitor-problem-solving`
  - step3 `user-journey-design`
  - step4 `tr1-requirements-spec`
  - step5（4 个 TR2 skill **并发**）：`tr2-epic-creator`、`tr2-feature-creator`、`tr2-story-creator`、`tr2-tech-creator`
- 生成 `.cospec/runs/<RUN_DIR>/` 下的 DAG 产物。
- 调用 `cospec-dag-executor` 执行 DAG。
- 汇总最终产物（TR1 评审版 + AI 上下文版、共创/客户/竞品分析、EPIC/Feature/Story/Tech）。

## 扩展点

开始前，从插件根目录（本 skill 基目录上两级）读取 `cospec.config.json`。无需 fallback——配置始终有有效默认值。

| 配置字段 | 用途 |
|---|---|
| `config.workflow.default` | `brainstorming` 未覆盖时使用的默认 workflow 名 |
| `config.evaluators["product-planning-requirement-clarification"]` | 澄清后的 evaluator；`false` = 关闭质量门 |
| `config.evaluators["user-journey-design"]` | 用户旅程设计后的 evaluator；`false` = 关闭质量门 |
| `config.evaluators["tr1-requirements-spec"]` | TR1 生成后的 evaluator；`false` = 关闭质量门 |

> Evaluator 门当前为预留扩展点，尚未在阶段后主动调度；接入方式见 `docs/INTEGRATION.md` §2.3。

## 工作流 DAG

DAG 完全静态（12 个节点，全部必选）。下表是生成 `dag.json` 的**权威契约**——`depends_on` 列即 `dag.json` 中每个 task 的依赖，AI 直接照表逐行转录，无需视觉解析。

**调度规则**：步骤间串行、同步骤内并发。同一 step 的节点 `depends_on` 相同且彼此无依赖 → 构成同一个 ready set，由 `cospec-dag-executor` 一次性并发派发；下一 step 的首节点 `depends_on` 上一 step 的全部节点，形成屏障。

| 步骤 | 节点 (skill) | depends_on |
|------|-------------|------------|
| 1 | `product-planning-requirement-clarification` | — |
| 2 | `co-create-customer-minutes-analysis` | `product-planning-requirement-clarification` |
| 2 | `customer-experience-feedback-analysis-v2` | `product-planning-requirement-clarification` |
| 2 | `competitor-feature-research` | `product-planning-requirement-clarification` |
| 2 | `competitor-pain-points` | `product-planning-requirement-clarification` |
| 2 | `competitor-problem-solving` | `product-planning-requirement-clarification` |
| 3 | `user-journey-design` | `product-planning-requirement-clarification`, `co-create-customer-minutes-analysis`, `customer-experience-feedback-analysis-v2`, `competitor-feature-research`, `competitor-pain-points`, `competitor-problem-solving` |
| 4 | `tr1-requirements-spec` | `user-journey-design` |
| 5 | `tr2-epic-creator` | `tr1-requirements-spec` |
| 5 | `tr2-feature-creator` | `tr1-requirements-spec` |
| 5 | `tr2-story-creator` | `tr1-requirements-spec` |
| 5 | `tr2-tech-creator` | `tr1-requirements-spec` |

**并发批次上限**：调用 `cospec-dag-executor` 时须设置 `max_parallel_tasks` ≥ 5（覆盖 step2 的 5 个并发 skill），否则同一 step 会被拆成多个串行批次，违背「同步骤并发」。

> step2 的 5 个研究 skill 均为状态机型；若缺少输入材料或分析范围未定，会返回 `NEEDS_CONTEXT` 向用户索取（executor 问询队列错峰处理）。这是必选节点的正常行为——索取材料，而非裁剪节点。

## 执行流程

0. **生成 RUN_DIR**（一次生成，所有产物复用）：
   ```bash
   RUN_DIR=".cospec/runs/$(date '+%y-%m-%d-%H%M%S')-large-requirement-workflow"
   ```
   下文每个 `<RUN_DIR>` 均解析为此具体目录。
1. **在 `$RUN_DIR/` 下创建 DAG 产物**：
   - `index.md`
   - `dag.json`（12 个节点；依赖关系按上方 DAG 填写——**同步骤内无相互依赖，跨步骤串行**；四个 TR2 节点的 `depends_on` 都只填 `tr1-requirements-spec`；顶层加 `"max_parallel_tasks": 5`，供 `cospec-dag-executor` 读取以保证同步骤一次性并发派发）
   - `tasks/<task-id>.md`（12 张，每个必选节点一张，模板见下）
2. **（可选）用 `cospec-dag-evaluator` 评估 DAG**。
3. **调用 `cospec-dag-executor`** 派发 skill-invoker SubAgents（按 ready-set 并行；同一 step 的 skill 落在同一 ready set 一次性并发派发；`max_parallel_tasks` ≥ 5）。
4. **等待完成**并汇总交付物。

> 也可用 `cospec-dag-planner` 生成上述产物（传入 workflow_name、nodes、output_dir），本 skill 直接内联生成亦可。

## 任务卡片

为 DAG 表中每个节点生成一张 `tasks/<skill>.md`，供 `skill-invoker` 读取。卡片 schema 见 `cospec-dag-planner`；逐节点内容按下表机械填充——**拓扑取自 DAG 表，契约取自各 leaf skill 自身**（skill-invoker 调用时会加载 leaf skill 的 SKILL.md），workflow 不重复维护。

**生成规则**（对 DAG 表每一行）：

| 字段 | 取值 |
|------|------|
| `Skill` | 节点名 |
| `Source` | `大需求工作流 — <step> <一句话职责>` |
| `Depends on` | DAG 表该行 `depends_on`（无则 `(none)`） |
| `Input Artifacts` | `depends_on` 各节点的 `.cospec/runs/<RUN_DIR>/<dep>/manifest.json`（+ 用户提供的材料路径，见各 leaf skill 的 Inputs） |
| `Task Spec` | 调用 `<skill>`，遵循其 SKILL.md 的 When To Use / Workflow / Output Contract |
| `Interface Contract` / `Acceptance Criteria` | 由 leaf skill 自身契约决定（必选、无占位符、产物可追溯） |
| `Required Output Artifacts` | `.cospec/runs/<RUN_DIR>/<skill>/manifest.json` + `results.md` |

> 任务卡片的字段名（`Skill`/`Depends on`/`Input Artifacts`/`Task Spec`/`Required Output Artifacts` 等）保留英文——这是与 `cospec-dag-planner`/`cospec-dag-executor` 共享的 schema 契约。

通用卡片模板：

```markdown
# Task: <skill>

## Skill
<skill>

## Source
大需求工作流 — <step> <职责>

## Depends on
<depends_on from DAG table, or (none)>

## Input Artifacts
- <upstream manifest paths from depends_on>
- <user-provided material paths, per leaf skill Inputs>

## Task Spec
调用 `<skill>`，遵循其 SKILL.md。

## Required Output Artifacts
- `.cospec/runs/<RUN_DIR>/<skill>/manifest.json`
- `.cospec/runs/<RUN_DIR>/<skill>/results.md`
```

**TR2 并发与 ID 映射（step5）**：四个 TR2 skill 全部 `depends_on: tr1-requirements-spec`，并发执行。各 skill 从 TR1 AI 上下文版的对应 ID 段抽取：EPIC←`VAL/REQ/EPIC/PB/OPEN`、Feature←`FEAT/BR/AC/DEMO/NFR`、Story←`ST/BR/AC/ERR/PERM/NFR`、Tech←`OBJ/INT/NFR/RISK/OPEN`。Inputs 中的「父 EPIC/父 Feature/对应 Story」是**可追溯引用**而非调度依赖——并发时直接以 TR1 AI 上下文版为唯一上游来源。

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行（全部 12 个必选节点）。
- 各产物位置（共创/客户/竞品分析、TR1 评审版/AI 上下文版、EPIC/Feature/Story/Tech）。
- 任何待确认/待验证项。
- 推荐的下一步。

## 红线

- 禁止让用户跳过阶段而未经显式批准。
- 禁止在主 agent 中直接执行叶子 skill。
- 禁止在同一 step 的 skill 之间建立调度依赖（step2 的 5 个研究、step5 的 4 个 TR2 必须并发）；并要求 `max_parallel_tasks` ≥ 5，否则同步骤会被串行化。
- 禁止裁剪任何必选节点——5 个研究 skill 均必选；缺少材料时由 skill 通过 `NEEDS_CONTEXT` 索取，而非移除节点。
- 禁止在 `cospec-dag-executor` 报告 `BLOCKED` 且未升级时继续推进。
- 禁止修改核心工作流的步骤顺序。
