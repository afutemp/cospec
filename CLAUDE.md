# cospec — Product Planning Workflow Plugin

## If You Are an AI Agent

Stop. Read this section before doing anything.

Skills are not prose — they are code that shapes agent behavior. Every word in a SKILL.md was chosen to produce specific behavior in specific scenarios.

Before you make changes to this repo, you MUST:

1. **Read the skill you're modifying** completely — including Red Flags tables, HARD-GATE blocks, and rationalization lists.
2. **Understand the workflow** — skills form a pipeline. Changing one skill may break the pipeline.
3. **Follow team standards** — follow coding and documentation conventions established in the repo.
4. **Show your human partner the complete diff** and get their explicit approval before committing.

## Architecture

### Entry Points

| Skill | Trigger |
|-------|---------|
| `using-spec-developer` | Session start — teaches how to use skills |
| `session-context` | SessionStart / compact / resume hooks |
| `brainstorming` | ALL product planning work — central router |
| `large-requirement-workflow` | Dispatched by `brainstorming` for the full large-requirement pipeline (research + TR1 + TR2) |
| `small-requirement-workflow` | Dispatched by `brainstorming` for small requirements (clarify + journey + TR1 only) |

### Pipeline（Workflow Entry Skill 路由）

`brainstorming` 是所有产品规划工作的唯一入口，按需求规模路由到合适的 workflow entry skill：

```
用户意图
    │
    ▼
brainstorming（路由器：理解意图 → 选 workflow → 确认 → 分发）
    │
    ├─ 大需求 ──→ large-requirement-workflow   ─┐
    └─ 小需求 ──→ small-requirement-workflow   ─┴─→ cospec-dag-executor → leaf skills

各 workflow 内部的具体步骤与并发编排由其自身 SKILL.md 定义（见下方「管线阶段明细」与各 workflow skill）。
```

`brainstorming` 内部按需求规模判断选择哪个 workflow：

| 用户输入特征 | 选择 Workflow |
|---|---|
| 大需求：需要共创/客户/竞品研究，或要 TR2 产物；范围大、"想全面" | `large-requirement-workflow` |
| 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | `small-requirement-workflow` |
| 无法判断 | `large-requirement-workflow` |

每个 workflow entry skill 生成 skill 级 DAG 产物（`.cospec/runs/<RUN_DIR>/dag.json` + task cards），然后调用 `cospec-dag-executor` 并行调度 `skill-invoker` SubAgents。SubAgents 调用对应的 leaf skills。

### 管线阶段明细

| # | 阶段 | Skill | 核心产物 |
|---|---|---|---|
| 1 | **需求澄清** | `product-planning-requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、核心共识） |
| 2 | **研究/分析**（仅大需求，5 个必选并发） | `co-create-customer-minutes-analysis` / `customer-experience-feedback-analysis-v2` / `competitor-feature-research` / `competitor-pain-points` / `competitor-problem-solving` | 共创验证 / 客户体验反馈 / 竞品分析报告 |
| 3 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） |
| 4 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） |
| 5 | **TR2 产物**（仅大需求） | `tr2-epic-creator` / `tr2-feature-creator` / `tr2-story-creator` / `tr2-tech-creator` | EPIC / Feature / Story / Tech 需求文档 |

### Skill List

| Skill | 角色 |
|-------|------|
| `using-spec-developer` | 入口引导：如何使用 skill |
| `session-context` | 跨 compact/重启的会话状态持久化 |
| `brainstorming` | 中央路由器：评估规划阶段，选择 workflow entry skill |
| `large-requirement-workflow` | 大需求工作流编排器：澄清 → 研究 → 旅程 → TR1 → TR2 |
| `small-requirement-workflow` | 小需求工作流编排器：澄清 → 旅程 → TR1 |
| `product-planning-requirement-clarification` | 需求澄清：原始想法 → "想全面"的澄清结果 |
| `co-create-customer-minutes-analysis` | 共创客户纪要分析（验证报告） |
| `customer-experience-feedback-analysis-v2` | 客户使用体验反馈分析 |
| `competitor-feature-research` | 资料收集型竞品分析 |
| `competitor-pain-points` | 痛点收集型竞品分析 |
| `competitor-problem-solving` | 问题求解型竞品分析 |
| `user-journey-design` | 用户旅程设计：分阶段状态机确认流程 |
| `tr1-requirements-spec` | TR1 用户需求说明书生成（大/小需求，评审版 + AI 上下文版） |
| `tr2-epic-creator` | TR2 EPIC 生成 |
| `tr2-feature-creator` | TR2 Feature 生成 |
| `tr2-story-creator` | TR2 Story 生成 |
| `tr2-tech-creator` | TR2 Tech 需求生成 |
| `cospec-configure` | 交互式配置：设置 project info、模板、默认 workflow 等 |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |
| `cospec-dag-planner` | DAG 计划生成：为 workflow entry skill 生成 `dag.json` 和 task cards |
| `cospec-dag-executor` | DAG 执行器：按 ready-set 并行调度 `skill-invoker` SubAgents |
| `cospec-dag-evaluator` | DAG 计划评估：检查 DAG 无环性、skill 引用、占位符等 |

> `cospec-dag-*` skills 是共享基础设施，被 workflow entry skills 调用。小需求工作流为线性 DAG；大需求工作流按步骤串行、同步骤内并发——step2 研究（5 个必选并发）、step5 TR2（4 个必选并发）均为同步骤并发。

## Skill Authoring Rules

1. **SKILL.md** — English, loaded into AI context.
2. **README.zh.md** — Chinese, human reference only.
3. **Skill 标识** — Every skill must have a `Skill 标识` block after the H1 title.
4. **Standards references** — Skills that involve document generation must reference applicable templates in `templates/`.
5. **No platform prefixes** — Skills are referenced by name only.

## General

- One logical change per commit
- Describe the problem you solved, not just what you changed
