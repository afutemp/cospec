# Brainstorming — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

产品规划工作的唯一入口。通过自然对话理解用户意图、追问需求细节、判断所处规划阶段，然后路由到对应的下游 skill。

## 核心机制

### 硬门禁（HARD-GATE）

阶段判断和路由确认完成之前，**禁止调用任何下游 skill 或产出正式文档**。

### 两条工作流，按需求规模进入

```
brainstorming → { large-requirement-workflow | small-requirement-workflow }
```

- **大需求** → `large-requirement-workflow`：含共创/客户/竞品研究 + TR2 的完整管线。
- **小需求** → `small-requirement-workflow`：精简管线，到 TR1 即止。

brainstorming 只做路由；各工作流的内部步骤（澄清/研究/旅程/TR1/TR2 的编排与并发）由其自身 SKILL.md 定义。

## 检查清单

所有任务按顺序完成：

1. **恢复会话上下文** — 如有 `active-*.md`，先调用 `session-context`
2. **探索项目上下文** — 检查已有材料（需求文档、旅程文档、竞品报告等），搜索知识库
3. **追问想法** — 先推荐再提问，一次一个问题
4. **判断规划阶段** — 确定从哪个节点进入
5. **确认路由** — 向用户确认后分发到下游 skill

## 阶段路由

| 用户状态 | 路由 |
|---------|------|
| 大需求：需要共创/客户/竞品研究，或要 TR2 产物；范围大、"想全面" | → `large-requirement-workflow` |
| 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | → `small-requirement-workflow` |
| 无法判断 | → `large-requirement-workflow`（默认） |

## 核心原则

- 先推荐，再提问
- 一次一个问题
- 尽量提供选项
- 严格 YAGNI — 聚焦本次规划范围
- 材料优于假设 — 已有材料能回答的，检查材料而不是猜
