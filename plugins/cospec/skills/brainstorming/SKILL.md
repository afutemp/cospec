---
name: brainstorming
description: "You MUST use this before any product planning work - clarifying requirements, designing user journeys, or writing TR1 spec documents. Explores user intent, assesses the planning stage, selects the appropriate workflow entry skill, and dispatches it."
---

# Brainstorming —— 中央路由器

**Skill 标识**: `brainstorming`

其他 skill 通过 `brainstorming` 引用本 skill。

brainstorming 是所有产品规划工作的唯一入口，承担单一职责：

- **路由器**：对所有产品规划任务，先理解上下文、追问想法、判断用户处于产品规划的哪个阶段以及需要哪个 workflow，然后分发到对应的 workflow entry skill。

<HARD-GATE>
在完成 Phase 1（共享发现）、判断规划阶段与 workflow、向用户确认路由、并调用 workflow entry skill 之前，禁止调用任何下游叶子 skill 或产出任何正式文档。适用于所有产品规划任务，无论看起来多简单。
</HARD-GATE>

## 反模式：跳过路由直接产出

每个产品规划任务都要经过路由流程。需求澄清、用户旅程设计、TR1 文档生成——无一例外。跳过路由环节是最浪费工作的做法，因为未审视的假设会导致大量返工。完成 checklist，评估阶段，执行路由——禁止跳过路由直接进入下游。

---

## 一、Phase 1：共享发现（所有路由共用）

你必须为以下每项创建任务，并按顺序完成：

1. **探索项目上下文** —— 检查已有材料：用户需求文档、PRD 草稿、用户旅程文档、DCP2-1 材料、竞品分析报告、客户反馈报告。
2. **追问想法** —— 对产品需求的每个关键方面进行深入追问。对于每个问题，**先给出你的推荐答案**，然后等待反馈再继续。应用追问技巧（见下方"追问技巧"章节）。
3. **判断规划阶段与 workflow** —— 确定用户当前处于产品规划的哪个阶段、需要哪种 workflow，然后进入 Phase 2 路由分发。

---

## 二、Phase 2：路由分发

根据用户的输入特征和已有材料，判断应该进入哪个 workflow entry skill。**必须先向用户确认再执行。禁止不经确认直接分发：**

| 用户输入特征 | 推荐 Workflow Entry Skill | 说明 |
|-------------|--------------------------|------|
| 大需求：需要共创/客户反馈/竞品研究，或要 TR2（EPIC/Feature/Story/Tech）产物 | `large-requirement-workflow` | 完整大需求管线 |
| 范围较大、涉及多方影响、"想全面" | `large-requirement-workflow` | 完整大需求管线 |
| 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | `small-requirement-workflow` | 精简管线（到 TR1 即止） |
| 无法判断 | `large-requirement-workflow` | 默认大需求管线 |

> 大需求 vs 小需求的判断依据见下方「路由判断依据」。未来可增加更多 workflow entry skill；届时在路由表中补充对应条目。

**路由判断依据**（大需求 vs 小需求）：
1. 是否需要研究/分析：有共创纪要、客户反馈、竞品材料，或用户明确要做竞品/客户研究 → `large-requirement-workflow`；都没有 → 倾向 `small-requirement-workflow`。
2. 是否需要 TR2 产物：用户要 EPIC/Feature/Story/Tech → `large-requirement-workflow`；只到 TR1 → `small-requirement-workflow`。
3. 需求范围与影响面：范围大、涉及多方影响、"想全面" → `large-requirement-workflow`；范围聚焦、影响面小 → `small-requirement-workflow`。
4. 目标产物：TR1 + TR2 → `large-requirement-workflow`；仅 TR1 → `small-requirement-workflow`。

**向用户确认路由**：

1. 向用户说明你的阶段判断和推荐的 workflow entry skill。
2. 确认用户认可后，调用选中的 workflow entry skill。
3. 调用后，**brainstorming 结束**。被调用的 workflow entry skill 会按业务流程继续推进。

---

## 三、流程全景

brainstorming 只负责**路由**——判断需求规模、向用户确认、分发到对应的 workflow entry skill，随后结束。**各 workflow 的具体步骤（澄清/研究/旅程/TR1/TR2 的编排与并发）由其自身 SKILL.md 定义**，brainstorming 不重复维护，避免与下游 workflow 产生耦合。

```text
用户意图
    │
    ▼
brainstorming（Phase 1：共享发现 → Phase 2：路由确认 → 分发）
    │
    ├─ 大需求 ──→ large-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
    └─ 小需求 ──→ small-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
```

---

## 四、追问技巧

三种技巧在步骤 3 中全程应用。它们不是顺序阶段——根据每个问题的特性选用合适的技巧。

**1. 用具体场景做压力测试**

讨论需求时，构造具体场景来探测边缘情况，迫使用户精确界定需求边界。场景必须足够具体，能回答：在这个确切情况下会发生什么？谁在什么环境下遇到这个问题？

**2. 对照已有材料挑战假设**

当用户描述的与已有材料（用户旅程文档、竞品分析、客户反馈报告）中的结论不一致时，立即指出。如果问题可以通过检查已有材料来回答，就不要问用户。

**3. 追问"为什么不"**

当用户快速跳到一个方案时，追问"为什么不用另一种做法？"或"竞品有做 X 吗，为什么我们不参考？" 帮助用户从多个角度审视需求。
