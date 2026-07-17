---
name: brainstorming
description: "You MUST use this before any product planning work - clarifying requirements, designing user journeys, or writing TR1 spec documents. Asks the user which workflow they need, then dispatches to the chosen workflow entry skill."
---

# Brainstorming —— 中央路由器

**Skill 标识**: `brainstorming`

其他 skill 通过 `brainstorming` 引用本 skill。

brainstorming 是所有产品规划工作的唯一入口，承担单一职责：

- **路由器**：对所有产品规划任务，询问用户需要哪种 workflow，确认后分发到对应的 workflow entry skill。

<HARD-GATE>
在向用户确认路由并调用 workflow entry skill 之前，禁止调用任何下游叶子 skill 或产出任何正式文档。适用于所有产品规划任务，无论看起来多简单。
</HARD-GATE>

## 反模式：跳过路由直接产出

每个产品规划任务都要经过路由流程。需求澄清、用户旅程设计、TR1 文档生成——无一例外。禁止跳过路由直接进入下游 workflow。

---

## 路由流程

1. **询问用户** 当前需求属于哪种类型，给出两个选项并附简短说明：

   | Workflow | 适用场景 | 产出 |
   |----------|---------|------|
   | `large-requirement-workflow` | 大需求：需要共创/客户反馈/竞品研究，或要 TR2 产物（EPIC/Feature/Story/Tech） | TR1 + TR2（完整管线） |
   | `small-requirement-workflow` | 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | TR1（精简管线） |

2. **等待用户选择**，不做过多判断。路由决定权完全交由用户。

3. **用户确认后**，调用选中的 workflow entry skill（`Skill("<skill-name>")`）。

4. 调用后，**brainstorming 结束**。被调用的 workflow entry skill 会按业务流程继续推进。

---

## 流程全景

brainstorming 只负责**路由**——询问用户选择 workflow、确认、分发，随后结束。**各 workflow 的具体步骤（澄清/研究/旅程/TR1/TR2 的串行编排）由其自身 SKILL.md 定义**，brainstorming 不重复维护，避免与下游 workflow 产生耦合。

```text
用户意图
    │
    ▼
brainstorming（询问 → 确认 → 分发）
    │
    ├─ 大需求 ──→ large-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
    └─ 小需求 ──→ small-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
```
