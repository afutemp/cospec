---
name: brainstorming
description: "You MUST use this before any product planning work - clarifying requirements, designing user journeys, or writing TR1 spec documents. Explores user intent, assesses the planning stage, and routes to the product-planning-workflow orchestrator."
---

# Brainstorming —— 中央路由器

**Skill 标识**: `brainstorming`

其他 skill 通过 `brainstorming` 引用本 skill。

brainstorming 是所有产品规划工作的唯一入口，承担单一职责：

- **路由器**：对所有产品规划任务，先理解上下文、追问想法、判断用户处于产品规划的哪个阶段，然后分发到 `product-planning-workflow` 执行完整管线。

<HARD-GATE>
在完成 Phase 1（共享发现）、判断规划阶段、向用户确认路由、并调用 `product-planning-workflow` 之前，禁止调用任何下游叶子 skill 或产出任何正式文档。适用于所有产品规划任务，无论看起来多简单。
</HARD-GATE>

## 反模式：跳过路由直接产出

每个产品规划任务都要经过路由流程。需求澄清、用户旅程设计、TR1 文档生成——无一例外。跳过路由环节是最浪费工作的做法，因为未审视的假设会导致大量返工。完成 checklist，评估阶段，执行路由——禁止跳过路由直接进入下游。

---

## 一、Phase 1：共享发现（所有路由共用）

你必须为以下每项创建任务，并按顺序完成：

1. **恢复会话上下文（如适用）** —— 如果 session-context 目录中存在 `active-*.md` 文件，必须先调用 `session-context` skill 完成盘点，决定是恢复已有任务还是开始新任务。只有盘点完成后方可进入步骤 2。
2. **探索项目上下文** —— 检查已有材料：用户需求文档、PRD 草稿、用户旅程文档、DCP2-1 材料、竞品分析报告、客户反馈报告。
3. **追问想法** —— 对产品需求的每个关键方面进行深入追问。对于每个问题，**先给出你的推荐答案**，然后等待反馈再继续。应用追问技巧（见下方"追问技巧"章节）。
4. **判断规划阶段** —— 确定用户当前处于产品规划的哪个阶段，然后进入 Phase 2 路由分发。

---

## 二、Phase 2：路由分发

根据用户的输入特征和已有材料，判断从主链的哪个节点进入。**必须先向用户确认再执行路由。禁止不经确认直接分发：**

| 用户输入特征 | 推荐进入阶段 | 说明 |
|-------------|-------------|------|
| 原始想法、口头需求、需求不清晰、"想全面" | `requirement-clarification` | 从链头开始，走完整流程 |
| 已有清晰需求方向，但未做旅程设计 | `user-journey-design` | 跳过澄清，从旅程开始 |
| 已有用户旅程文档 / 结构化需求文档 / 直接要写 TR1 | `tr1-requirements-spec` | 跳过前两阶段，直出 TR1 |

**路由判断依据**：
1. 用户意图关键词：澄清相关（"想全面""帮我理清""这个需求靠谱吗"）→ 从 clarification 进入；旅程相关（"用户旅程""操作流程""客户怎么用"）→ 从 journey 进入；文档生成相关（"写 TR1""生成需求说明书"）→ 从 TR1 进入。
2. 已有材料：口头需求、会议记录 → 从 clarification 开始；已有用户旅程文档或 PRD 草稿 → 从 journey 或 TR1 进入。
3. 目标产物：用户想要输出什么？（需求澄清稿 / 用户旅程文档 / TR1 需求说明书）

**向用户确认路由**：

1. 向用户说明你的阶段判断和推荐的起始阶段。
2. 确认用户认可后，调用 `product-planning-workflow`。
3. 调用 `product-planning-workflow` 后，**brainstorming 结束**。`product-planning-workflow` 会按业务流程继续推进（clarification → journey → TR1），并在阶段间调度 evaluator 质量门。

---

## 流程全景

```
用户意图
    │
    ▼
brainstorming（Phase 1：共享发现）
    │
    ▼
product-planning-workflow
    │
    ├─ 原始想法 / "想全面" ──→ requirement-clarification
    │                              │
    │                              ▼
    │                        [evaluator]
    │                              │
    │                              ▼
    │                        user-journey-design
    │                              │
    │                              ▼
    │                        [evaluator]
    │                              │
    │                              ▼
    │                        tr1-requirements-spec
    │                              │
    │                              ▼
    │                        [evaluator]
    │
    ├─ 已有清晰需求 ──→ user-journey-design
    │                        │
    │                        ▼
    │                  [evaluator]
    │                        │
    │                        ▼
    │                  tr1-requirements-spec
    │                        │
    │                        ▼
    │                  [evaluator]
    │
    └─ 已有旅程文档 / 直出 TR1 ──→ tr1-requirements-spec
                                      │
                                      ▼
                                [evaluator]
```

---

## 追问技巧

三种技巧在步骤 3 中全程应用。它们不是顺序阶段——根据每个问题的特性选用合适的技巧。

**1. 用具体场景做压力测试**

讨论需求时，构造具体场景来探测边缘情况，迫使用户精确界定需求边界。场景必须足够具体，能回答：在这个确切情况下会发生什么？谁在什么环境下遇到这个问题？

**2. 对照已有材料挑战假设**

当用户描述的与已有材料（用户旅程文档、竞品分析、客户反馈报告）中的结论不一致时，立即指出。如果问题可以通过检查已有材料来回答，就不要问用户。

**3. 追问"为什么不"**

当用户快速跳到一个方案时，追问"为什么不用另一种做法？"或"竞品有做 X 吗，为什么我们不参考？" 帮助用户从多个角度审视需求。
