---
name: small-requirement-workflow
description: 编排小需求产品规划管线——需求澄清、用户旅程设计、TR1 需求说明书（不做研究、不做 TR2），串行执行。
---

# 小需求工作流（Small Requirement Workflow）

**Skill 标识**: `small-requirement-workflow`

其他 skill 通过 `small-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**小需求**（无需共创/客户反馈/竞品研究，也无需 TR2 产物，到 TR1 即止），`brainstorming` 调用本 skill。本 skill 在主会话中按步骤串行调用各 leaf skill。

本工作流对应 `docs/workflow-skill-steps.md` 中的「小需求工作流」，是大需求工作流的精简版：没有研究/分析步骤，没有 TR2（EPIC/Feature/Story/Tech）产物。

## 职责

按以下顺序串行调用 3 个 leaf skill。**每步调用 `Skill("<skill-name>")`，等待完成后再进入下一步。**

| 步骤 | 调用 |
|------|------|
| step1 | `Skill("product-planning-requirement-clarification")` |
| step2 | `Skill("user-journey-design")` |
| step3 | `Skill("tr1-requirements-spec")` |

## 扩展点

开始前，从插件根目录（本 skill 基目录上两级）读取 `cospec.config.json`。无需 fallback——配置始终有有效默认值。

| 配置字段 | 用途 |
|---|---|
| `config.workflow.default` | `brainstorming` 未覆盖时使用的默认 workflow 名 |

## 执行流程

1. 按上表顺序，依次调用每个 leaf skill：`Skill("<skill-name>")`
2. 每个 skill 调用完成后，在其自身的对话上下文中产出结果
3. 全部 3 个 skill 执行完毕后，汇总交付物

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行
- TR1 文档位置
- 任何待确认/待验证项
- 推荐的下一步

## 红线

- 禁止跳过任何必选节点——3 个节点全部必选
- 禁止修改节点顺序
- 禁止生成 TR2 产物（EPIC/Feature/Story/Tech）——本工作流到 TR1 即止；如需 TR2 应改走 `large-requirement-workflow`
- 禁止在当前 step 未完成时启动下一步
