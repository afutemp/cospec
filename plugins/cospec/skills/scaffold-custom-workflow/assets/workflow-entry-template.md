---
name: {{NAME}}
description: {{TRIGGER}}
---

# {{DISPLAY_NAME}}

**Skill 标识**: `{{NAME}}`

{{ONE_LINE_PURPOSE}}

<HARD-GATE>

在用户明确选择本工作流之前，禁止：

- 调用本工作流串联的任何 leaf skill
- 产出任何正式文档
- 跳过任意步骤自行简化流程

**每个 step 跑完后必须停下来让用户确认产物，再进入下一步**——这是 cospec 全插件的硬约定，不是用户的可选项（与 `large-requirement-workflow` / `small-requirement-workflow` 一致）。

</HARD-GATE>

## 职责

按以下顺序串行调用本工作流编排的 leaf skill。**每步调用 `Skill("<child>")`，等待用户确认产物后再进入下一步。** 严禁并行派发多个 `Skill()`。

| 步骤 | 调用 |
|------|------|
{{STEP_TABLE_ROWS}}

## 扩展点

开始前，从插件根目录（本 skill 基目录上两级）读取 `cospec.config.json`。

| 配置字段 | 用途 |
|---|---|
| `workflow.options` | 当前所有可用的工作流入口 skill 名称 |
| `workflow.install-dirs` | 可选的 agent-id → 路径 覆盖映射 |

## 执行流程

{{STEP_FLOW_LINES}}

## 产出

工作流完成后，汇总：

- 哪些 skill 被执行 / 跳过
- 各产物位置
- 任何待确认 / 待验证项
- 推荐的下一步

## 红线

- 禁止修改节点顺序
- **禁止并行执行**——同一工作流内的多个 skill 必须逐个串行调用
- 禁止在用户未确认的情况下自动进入下一个 step
- 禁止把本次运行记录之外的目录扫描结果当作本工作流产物