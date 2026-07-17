# Brainstorming — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

产品规划工作的唯一入口。询问用户需要哪种 workflow（大需求 / 小需求），确认后路由到对应的下游 skill。

## 核心机制

### 硬门禁（HARD-GATE）

向用户确认路由并调用 workflow entry skill 之前，**禁止调用任何下游 skill 或产出正式文档**。

### 两条工作流

```
brainstorming → { large-requirement-workflow | small-requirement-workflow }
```

- **大需求** → `large-requirement-workflow`：含共创/客户/竞品研究 + TR2 的完整管线。
- **小需求** → `small-requirement-workflow`：精简管线，到 TR1 即止。

brainstorming 只做路由；路由决定权完全交由用户判断。各工作流的内部步骤（澄清/研究/旅程/TR1/TR2 的编排）由其自身 SKILL.md 定义。

## 路由流程

1. **询问用户** — 给出两个选项（大需求 / 小需求）和简短说明
2. **等待用户选择** — 不做过多判断
3. **分发** — 调用选中的 workflow entry skill
4. **结束** — 被调用的 workflow skill 接手后续流程
