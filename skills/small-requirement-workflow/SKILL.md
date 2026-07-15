---
name: small-requirement-workflow
description: 编排小需求产品规划管线——需求澄清、用户旅程设计、TR1 需求说明书（不做研究、不做 TR2），基于 skill 级 DAG 执行。
---

# 小需求工作流（Small Requirement Workflow）

**Skill 标识**: `small-requirement-workflow`

其他 skill 通过 `small-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**小需求**（无需共创/客户反馈/竞品研究，也无需 TR2 产物，到 TR1 即止），`brainstorming` 调用本 skill。本 skill 是一个 workflow entry skill：它生成 skill 级 DAG 产物，然后调用 `cospec-dag-executor` 调度 leaf skills。

本工作流对应 `docs/workflow-skill-steps.md` 中的「小需求工作流」，是大需求工作流的精简版：没有研究/分析步骤，没有 TR2（EPIC/Feature/Story/Tech）产物。

## 职责

- 编排小需求主链：`product-planning-requirement-clarification` → `user-journey-design` → `tr1-requirements-spec`。
- 生成 `.cospec/runs/<RUN_DIR>/` 下的 DAG 产物。
- 调用 `cospec-dag-executor` 执行 DAG。
- 汇总最终产物（小需求评审版 TR1）。

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

DAG 完全静态（3 个节点，线性串行）。下表是生成 `dag.json` 的**权威契约**——`depends_on` 列即 `dag.json` 中每个 task 的依赖，AI 直接照表逐行转录。

| 步骤 | 节点 (skill) | depends_on |
|------|-------------|------------|
| 1 | `product-planning-requirement-clarification` | — |
| 2 | `user-journey-design` | `product-planning-requirement-clarification` |
| 3 | `tr1-requirements-spec` | `user-journey-design` |

## 执行流程

0. **生成 RUN_DIR**（一次生成，所有产物复用）：
   ```bash
   RUN_DIR=".cospec/runs/$(date '+%y-%m-%d-%H%M%S')-small-requirement-workflow"
   ```
   下文每个 `<RUN_DIR>` 均解析为此具体目录。
1. **在 `$RUN_DIR/` 下创建 DAG 产物**：
   - `index.md`
   - `dag.json`
   - `tasks/product-planning-requirement-clarification.md`
   - `tasks/user-journey-design.md`
   - `tasks/tr1-requirements-spec.md`
2. **（可选）用 `cospec-dag-evaluator` 评估 DAG**。
3. **调用 `cospec-dag-executor`** 派发 skill-invoker SubAgents。
4. **等待完成**并汇总交付物。

> 也可用 `cospec-dag-planner` 生成上述产物（传入 workflow_name、nodes、output_dir），本 skill 直接内联生成亦可。

## 任务卡片

为 DAG 表中每个节点生成一张 `tasks/<skill>.md`，供 `skill-invoker` 读取。卡片 schema 见 `cospec-dag-planner`；逐节点内容机械填充——**拓扑取自 DAG 表，契约取自各 leaf skill 自身**（skill-invoker 调用时会加载 leaf skill 的 SKILL.md）。

**生成规则**（对 DAG 表每一行）：`Skill`=节点名；`Source`=`小需求工作流 — <step> <职责>`；`Depends on`=该行 `depends_on`（无则 `(none)`）；`Input Artifacts`=`depends_on` 各节点 manifest 路径；`Task Spec`=调用 `<skill>` 遵循其 SKILL.md；`Required Output Artifacts`=`.cospec/runs/<RUN_DIR>/<skill>/manifest.json` + `results.md`。

> 任务卡片的字段名（`Skill`/`Depends on`/`Input Artifacts`/`Task Spec`/`Required Output Artifacts` 等）保留英文——这是与 `cospec-dag-planner`/`cospec-dag-executor` 共享的 schema 契约。

通用卡片模板：

```markdown
# Task: <skill>

## Skill
<skill>

## Source
小需求工作流 — <step> <职责>

## Depends on
<depends_on from DAG table, or (none)>

## Input Artifacts
- <upstream manifest paths from depends_on>

## Task Spec
调用 `<skill>`，遵循其 SKILL.md。

## Required Output Artifacts
- `.cospec/runs/<RUN_DIR>/<skill>/manifest.json`
- `.cospec/runs/<RUN_DIR>/<skill>/results.md`
```

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行。
- TR1 文档位置（小需求评审版）。
- 任何待确认/待验证项。
- 推荐的下一步。

## 红线

- 禁止让用户跳过阶段而未经显式批准。
- 禁止在主 agent 中直接执行叶子 skill。
- 禁止生成 TR2 产物（EPIC/Feature/Story/Tech）——本工作流到 TR1 即止；如需 TR2 应改走 `large-requirement-workflow`。
- 禁止在 `cospec-dag-executor` 报告 `BLOCKED` 且未升级时继续推进。
- 禁止修改核心工作流的步骤顺序。
