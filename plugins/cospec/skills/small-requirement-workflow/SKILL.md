---
name: small-requirement-workflow
description: 编排小需求产品规划管线——需求澄清、用户旅程设计、TR1 需求说明书（不做研究、不做 TR2），串行执行；完成后可由用户选择是否调用 generate-demo。
---

# 小需求工作流（Small Requirement Workflow）

**Skill 标识**: `small-requirement-workflow`

其他 skill 通过 `small-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**小需求**（无需共创/客户反馈/竞品研究，也无需 TR2 产物，到 TR1 即止），`brainstorming` 调用本 skill。本 skill 在主会话中按步骤串行调用各 leaf skill。

本工作流对应 `docs/workflow-skill-steps.md` 中的「小需求工作流」，是大需求工作流的精简版：没有研究/分析步骤，没有 TR2（EPIC/Feature/Story/Tech）产物。

## 职责

按以下顺序串行调用 3 个规划 leaf skill。**每步调用 `Skill("<skill-name>")`，等待完成后再进入下一步。** 全部规划节点完成后，`generate-demo` 仅作为用户显式选择的可选后处理步骤。

| 步骤 | 调用 |
|------|------|
| step1 | `Skill("product-planning-requirement-clarification")` |
| step2 | `Skill("user-journey-design")` |
| step3 | `Skill("tr1-requirements-spec")` |
| 可选后处理 | 用户确认后调用 `Skill("generate-demo")` |

## 扩展点

开始前，从插件根目录（本 skill 基目录上两级）读取 `cospec.config.json`。无需 fallback——配置始终有有效默认值。

| 配置字段 | 用途 |
|---|---|
| `config.workflow.default` | `brainstorming` 未覆盖时使用的默认 workflow 名 |

## 执行流程

1. 按上表顺序，依次调用每个规划 leaf skill：`Skill("<skill-name>")`，并记录它实际生成的产物路径。
2. **每个规划 skill 调用完成后**：向用户简要汇报该步骤的产出摘要，并明确询问 **"是否继续下一步？"**，等待用户确认后再调用下一个 `Skill()`。
3. 全部 3 个规划 skill 执行完毕后，先汇总交付物并明确规划工作流已经完成。
4. 单独询问 **"是否使用本次产物生成 Demo？"**。用户拒绝时直接结束；用户同意时，将本次记录的准确产物路径交给 `Skill("generate-demo")` 作为候选清单，并将小需求 TR1 评审版标记为默认预选。`generate-demo` 仍须让用户选择文件、执行 dry-run 并在发送前再次确认。
5. Demo 生成被拒绝、取消或失败时，只汇报 Demo 状态，不得改变规划工作流的完成状态或回滚规划产物。

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行
- TR1 文档位置
- 任何待确认/待验证项
- 是否进入 Demo 生成；如已生成，给出 handoff 状态和链接
- 推荐的下一步

## 红线

- 禁止跳过任何必选节点——3 个节点全部必选
- 禁止修改节点顺序
- 禁止生成 TR2 产物（EPIC/Feature/Story/Tech）——本工作流到 TR1 即止；如需 TR2 应改走 `large-requirement-workflow`
- 禁止在当前 step 未完成时启动下一步
- 禁止在用户未确认的情况下自动进入下一个 step——每步完成后必须等待用户明确确认
- 禁止把最后一个规划节点后的“继续”解释为上传文档或生成 Demo 的授权——必须单独询问 Demo 生成问题
- 禁止向 `generate-demo` 传递本次运行记录之外的目录扫描结果
- 禁止在 Demo 失败时把已经完成的规划工作流标记为失败
