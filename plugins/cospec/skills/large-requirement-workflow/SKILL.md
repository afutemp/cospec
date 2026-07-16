---
name: large-requirement-workflow
description: 编排大需求产品规划管线——需求澄清、5 个研究/竞品分析、用户旅程设计、TR1 需求说明书、4 个 TR2（EPIC/Feature/Story/Tech）。所有步骤串行执行，每步在主会话中直接调用 leaf skill。
---

# 大需求工作流（Large Requirement Workflow）

**Skill 标识**: `large-requirement-workflow`

其他 skill 通过 `large-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**大需求**（共创/客户反馈/竞品研究 + TR1 + TR2 完整产物），`brainstorming` 调用本 skill。本 skill 在主会话中按步骤串行调用各 leaf skill，每步的产出由对应 skill 自身契约决定。

**所有节点均为必选**——不对研究/竞品节点做按需裁剪。运行时若缺关键输入，由对应 skill 在执行过程中直接向用户索取。

## 职责

按以下顺序串行调用 12 个 leaf skill。**每步调用 `Skill("<skill-name>")`，等待完成后再进入下一步。**

| 步骤 | 调用 |
|------|------|
| step1 | `Skill("product-planning-requirement-clarification")` |
| step2 | `Skill("co-create-customer-minutes-analysis")` |
| step2 | `Skill("customer-experience-feedback-analysis-v2")` |
| step2 | `Skill("competitor-feature-research")` |
| step2 | `Skill("competitor-pain-points")` |
| step2 | `Skill("competitor-problem-solving")` |
| step3 | `Skill("user-journey-design")` |
| step4 | `Skill("tr1-requirements-spec")` |
| step5 | `Skill("tr2-epic-creator")` |
| step5 | `Skill("tr2-feature-creator")` |
| step5 | `Skill("tr2-story-creator")` |
| step5 | `Skill("tr2-tech-creator")` |

## 扩展点

开始前，从插件根目录（本 skill 基目录上两级）读取 `cospec.config.json`。无需 fallback——配置始终有有效默认值。

| 配置字段 | 用途 |
|---|---|
| `config.workflow.default` | `brainstorming` 未覆盖时使用的默认 workflow 名 |

## 执行流程

1. 按上表顺序，依次调用每个 leaf skill：`Skill("<skill-name>")`
2. **每个 skill 调用完成后**：向用户简要汇报该步骤的产出摘要，并明确询问 **"是否继续下一步？"**，等待用户确认后再调用下一个 `Skill()`
3. 全部 12 个 skill 执行完毕后，汇总交付物

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行（全部 12 个必选节点）
- 各产物位置
- 任何待确认/待验证项
- 推荐的下一步

## 红线

- 禁止跳过任何必选节点——12 个节点全部必选
- 禁止修改节点顺序——必须按 step1 → step2(5个串行) → step3 → step4 → step5(4个串行) 严格执行
- 禁止在当前 step 未全部完成时启动下一步
- 禁止在用户未确认的情况下自动进入下一个 step——每步完成后必须等待用户明确确认
