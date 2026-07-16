---
name: large-requirement-workflow
description: 编排大需求产品规划管线——需求澄清、5 个研究/竞品分析、用户旅程设计、TR1 需求说明书、4 个 TR2（EPIC/Feature/Story/Tech）。所有步骤串行执行，每步在主会话中直接调用 leaf skill。
---

# 大需求工作流（Large Requirement Workflow）

**Skill 标识**: `large-requirement-workflow`

其他 skill 通过 `large-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**大需求**（共创/客户反馈/竞品研究 + TR1 + TR2 完整产物），`brainstorming` 调用本 skill。本 skill 在主会话中按步骤串行调用各 leaf skill，每步的产出由对应 skill 自身契约决定。

**所有节点默认执行**，但同一 step 内包含多个 skill 时（step2 的 5 个研究、step5 的 4 个 TR2），进入该 step 前先询问用户跳过哪些。单个 skill 的 step（step1/3/4）不询问，直接执行。

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

1. **进入多 skill 的 step 前**（step2、step5）：列出当前 step 内的全部 skill，询问用户 **"以下哪些需要跳过？"**，用户选择后只执行剩余的 skill。单个 skill 的 step（step1/3/4）直接执行，不询问。
2. 依次调用当前 step 内未跳过的 leaf skill：`Skill("<skill-name>")`
3. **每个 skill 调用完成后**：向用户简要汇报该步骤的产出摘要，并明确询问 **"是否继续下一步？"**，等待用户确认后再进入下一个 skill 或 step
4. 全部未跳过的 skill 执行完毕后，汇总交付物

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行、哪些被跳过
- 各产物位置
- 任何待确认/待验证项
- 推荐的下一步

## 红线

- 禁止未经询问直接跳过 step2 或 step5 中的 skill——进入多 skill 的 step 前必须先列出清单并询问用户
- 禁止修改节点顺序——必须按 step1 → step2(5个) → step3 → step4 → step5(4个) 严格执行
- 禁止在当前 step 未全部完成时启动下一步
- 禁止在用户未确认的情况下自动进入下一个 step——每步完成后必须等待用户明确确认
