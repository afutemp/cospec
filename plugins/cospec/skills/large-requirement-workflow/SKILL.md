---
name: large-requirement-workflow
description: 编排大需求产品规划管线——需求澄清、5 个研究/竞品分析、用户旅程设计、TR1 需求说明书、4 个 TR2（EPIC/Feature/Story/Tech）；TR1 完成后可由用户选择是否调用 generate-demo，再继续 TR2。所有规划步骤串行执行，同一 step 内的多个 skill 也必须逐个串行、禁止并行。
---

# 大需求工作流（Large Requirement Workflow）

**Skill 标识**: `large-requirement-workflow`

其他 skill 通过 `large-requirement-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于**大需求**（共创/客户反馈/竞品研究 + TR1 + TR2 完整产物），`brainstorming` 调用本 skill。本 skill 在主会话中按步骤串行调用各 leaf skill，每步的产出由对应 skill 自身契约决定。

**所有节点默认执行**，但同一 step 内包含多个 skill 时（step2 的 5 个研究、step5 的 4 个 TR2），进入该 step 前先询问用户跳过哪些。单个 skill 的 step（step1/3/4）不询问，直接执行。

## 职责

按以下顺序串行调用 12 个规划 leaf skill。**每步调用 `Skill("<skill-name>")`，等待完成后再进入下一步。** step4 的 TR1 文档完成后、step5 的 TR2 开始前，`generate-demo` 作为用户显式选择的可选步骤，不计入 12 个必选规划节点。

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
| TR1 后可选 | 用户确认后调用 `Skill("generate-demo")` |
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
2. **逐个串行**调用当前 step 内未跳过的 leaf skill：每次只调一个 `Skill("<skill-name>")`，等它完全结束后再调下一个。**禁止同时派发多个 Skill()、禁止并行执行。** 同时记录每个 leaf skill 实际生成的产物路径，不用目录扫描结果替代本次运行记录。
3. **每个规划 skill 调用完成后**：向用户简要汇报该步骤的产出摘要，并明确询问 **"是否继续下一步？"**，等待用户确认后再进入下一个 skill 或 step；step4 完成后的交互改由下一条专门规则处理，不重复询问。
4. step4 的 `tr1-requirements-spec` 完成后，先汇总本次生成的 TR1 文档，但不要宣称整个大需求规划工作流已经完成。
5. 立即单独询问 **"是否使用本次 TR1 产物生成 Demo？"**。用户拒绝时跳过 Demo；用户同意时，只将本次运行记录中 step4 生成的准确 TR1 产物路径交给 `Skill("generate-demo")` 作为候选清单，并将 TR1 评审版标记为默认预选。`generate-demo` 仍须让用户选择文件、执行 dry-run 并在发送前再次确认。
6. Demo 完成、被拒绝、取消或失败后，只汇报 Demo 状态，不得回滚已完成的 TR1，也不得阻止后续 TR2；随后单独询问 **"是否继续进入 step5 生成 TR2？"**。
7. 用户确认继续后，按既有规则进入 step5，先询问需要跳过哪些 TR2 skill，再串行执行其余项。全部未跳过的规划 skill 执行完毕后，汇总规划交付物并明确大需求规划工作流已经完成。

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行、哪些被跳过
- 各产物位置
- 任何待确认/待验证项
- 是否进入 Demo 生成；如已生成，给出 handoff 状态和链接
- 推荐的下一步

## 红线

- 禁止未经询问直接跳过 step2 或 step5 中的 skill——进入多 skill 的 step 前必须先列出清单并询问用户
- 禁止修改节点顺序——必须按 step1 → step2(5个) → step3 → step4 → step5(4个) 严格执行
- **禁止并行执行**——同一 step 内的多个 skill 必须逐个串行调用，每次只调一个 `Skill()`，等完成后再调下一个。禁止同时派发多个 `Skill()`
- 禁止在当前 step 未全部完成时启动下一步
- 禁止在当前 step 未全部完成时启动下一步
- 禁止在用户未确认的情况下自动进入下一个 step——每步完成后必须等待用户明确确认
- 禁止把 TR1 完成后的“继续”解释为上传文档或生成 Demo 的授权——必须单独询问 Demo 生成问题
- 禁止等到 TR2 完成后才首次询问是否生成 Demo——大需求必须在 TR1 完成后、TR2 开始前询问
- 禁止把当前目录扫描到的文件当作本次工作流产物——只向 `generate-demo` 传递本次运行记录的准确产物路径
- 禁止在 Demo 失败时回滚已完成的 TR1、阻止后续 TR2，或把规划工作流标记为失败
