---
name: product-planning-requirement-clarification
description: Use when helping product planning clarify a product requirement before writing a user requirements document, especially by running focused multi-turn questioning to make user, R&D, testing, marketing, and service impacts explicit.
---

# Product Planning Requirement Clarification

**Skill 标识**: `product-planning-requirement-clarification`

其他 skill 通过 `product-planning-requirement-clarification` 引用本 skill。

## Purpose

Use this skill to help product planning turn an initial requirement idea into a focused "think complete" clarification result before formal user requirements writing.

The goal is not to write the final PRD or system specification. The goal is to identify the key questions that affect later understanding by users, R&D, testing, marketing, and service.

## When To Use

Use this skill when the user asks to:

- Clarify a requirement before writing a user requirements document.
- Make a product requirement "想全面".
- Generate or refine prompts for product planning requirement clarification.
- Extract core conclusions from a multi-turn requirement clarification conversation.
- Prepare requirement background input for later user requirement documents or demos.

## Inputs

Ask the user to provide the minimum requirement input below. If some fields are unknown, keep them as "不确定" rather than inventing details.

- 需求名称
- 一句话需求
- 产品线/模块
- 目标用户
- 使用场景
- 当前问题
- 期望结果
- 已知约束
- 前序材料

Use the full input template in `references/requirement-input-template.md` when the user needs a copyable template.

## Workflow

1. **Fill requirement input**: Help the user complete the minimum input template. Do not require a full PRD.
2. **Run first diagnosis**: Use the first-round prompt in `references/clarification-prompts.md` to identify facts, assumptions, gaps, and up to 5 key questions.
3. **Continue focused questioning**: After the user answers, update facts, assumptions, and unresolved questions. Ask at most 5 more questions only if they affect user, R&D, testing, marketing, or service understanding.
4. **Control scope**: Do not expand into a complete requirements document during the clarification stage.
5. **Extract conclusions**: When information is sufficient or the user asks to close, use the convergence prompt to produce a requirement background clarification deliverable.

## Output Contract

When asked to produce the final clarification deliverable, output:

1. 需求概述
2. 需求全景结论
3. 异常、边界与风险
4. 下游影响
5. 事实、假设与待确认
6. 3 到 5 条最重要共识

Keep the output concise. Mark uncertain information as "待确认" and conflicting information as "信息冲突".

## Acceptance Criteria

- The interaction starts from the user's requirement input rather than generating a full PRD immediately.
- Each clarification round asks no more than 5 key questions.
- Questions explain why they matter and which party they affect: user, R&D, testing, marketing, or service.
- Confirmed facts, reasonable assumptions, and open questions are kept separate.
- The final deliverable does not invent information absent from the conversation.
- The final deliverable can support later user requirements writing and demo input preparation.
- The response remains focused on "想全面" and does not drift into detailed implementation, system design, or marketing copy unless the user asks for that separately.

## Resources

- Requirement input template: `references/requirement-input-template.md`
- Clarification prompts: `references/clarification-prompts.md`
- Underlying methods: `references/methodology.md`
