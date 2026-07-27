---
name: brainstorming
description: "Use only when the user explicitly asks to run cospec for product-planning work, or explicitly continues an active cospec workflow. Do not use merely because the request mentions cospec, cospowers, requirements, planning, research, TR1, or TR2. Do not use when discussing, reviewing, debugging, documenting, or improving cospec itself."
---

# Brainstorming —— 中央路由器

**Skill 标识**: `brainstorming`

其他 skill 通过 `brainstorming` 引用本 skill。

brainstorming 是所有产品规划工作的唯一入口，承担两项职责：

- **路由器**：对所有产品规划任务，询问用户需要哪种 workflow，确认后分发到对应的 workflow entry skill。
- **分发前体检**：调用 `cospec-preflight` 探测知识库 / IPD / Demo 连通性，警告但不阻塞。

<HARD-GATE>
在用户明确选择 workflow 之前，禁止执行以下任一动作：

- 调用任何 workflow entry skill（`large-requirement-workflow` / `small-requirement-workflow`）；
- 调用任何下游叶子 skill；
- 产出任何正式文档；
- 自行判断需求大小、替用户做出二选一决定。

适用于所有产品规划任务，无论看起来多简单、需求倾向多明显。
</HARD-GATE>

## 反模式：跳过路由 / 自行选择 workflow

每个产品规划任务都要经过路由流程。以下均属违规：

- **自行选择**：根据需求描述自行判断大小，不询问用户就直接调用 `large-requirement-workflow` / `small-requirement-workflow`；
- **直接产出**：跳过路由直接进入需求澄清、用户旅程设计、TR1 文档生成等下游环节。

无一例外。

---

## 路由流程

1. **询问用户** 当前需求属于哪种类型，给出两个选项并附简短说明：

   | Workflow | 适用场景 | 产出 |
   |----------|---------|------|
   | `large-requirement-workflow` | 大需求：需要共创/客户反馈/竞品研究，或要 TR2 产物（EPIC/Feature/Story/Tech） | TR1 + TR2（完整管线） |
   | `small-requirement-workflow` | 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | TR1（精简管线） |

   可直接套用以下话术（按需微调，但必须以提问收尾）：

   > 当前需求您希望走哪条工作流？
   > - **大需求**（large-requirement-workflow）：需要共创/客户/竞品研究，或要 TR2 产物 → TR1 + TR2
   > - **小需求**（small-requirement-workflow）：范围聚焦、无需研究，到 TR1 即止 → TR1
   > 请选择：大需求 还是 小需求？

2. **输出提问后立即停止本轮输出，等待用户回复。** 无论需求看起来多明确、倾向多明显，都禁止自行二选一。路由决定权完全交由用户。

3. **用户确认后**，调用 `Skill("cospec-preflight")` 对三个外部依赖（知识库 / IPD / Demo）做连通性体检，逐项转述结果（连通/不通 + 影响）。

4. **体检报告后立即停止本轮输出，等待用户确认是否继续。** 明确询问"是否继续进入工作流？"。**禁止在用户明确回复"继续"前读取配置、调用 step1 skill 或进入 workflow**——无论体检是否全通，都要停下等用户拍板（有不通项时提示可选择先修网络或继续；"不阻塞"指不强制阻止，不是自动往下走）。

5. 用户确认继续后，调用选中的 workflow entry skill（`Skill("<skill-name>")`）。

6. 调用后，**brainstorming 结束**。被调用的 workflow entry skill 会按业务流程继续推进。

---

## 流程全景

brainstorming 只负责**路由**——询问用户选择 workflow、确认、分发，随后结束。**各 workflow 的具体步骤（澄清/研究/旅程/TR1/TR2 的串行编排）由其自身 SKILL.md 定义**，brainstorming 不重复维护，避免与下游 workflow 产生耦合。

```text
用户意图
    │
    ▼
brainstorming（询问 → 确认 → 体检 → 等用户确认 → 分发）
    │
    ▼
cospec-preflight（探活 KB / IPD / Demo，报告后停下等用户确认，不阻塞）
    │
    ├─ 大需求 ──→ large-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
    └─ 小需求 ──→ small-requirement-workflow   （内部流程见该 skill 的 SKILL.md）
```
