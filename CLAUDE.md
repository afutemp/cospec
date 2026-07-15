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
| `product-planning-workflow` | Dispatched by `brainstorming` for the full planning pipeline |
| `tr1-only-workflow` | Dispatched by `brainstorming` when the user already has upstream context and only needs TR1 |

### Pipeline（Workflow Entry Skill 路由）

`brainstorming` 是所有产品规划工作的唯一入口，判断用户所处阶段后路由到合适的 workflow entry skill：

```
用户意图
    │
    ▼
brainstorming
    │
    ├─ 完整产品规划 ──→ product-planning-workflow
    │                       │
    │                       ▼
    │               cospec-dag-executor
    │                       │
    │                       ▼
    │       requirement-clarification → user-journey-design → tr1-requirements-spec
    │
    └─ 直出 TR1 ─────→ tr1-only-workflow
                                │
                                ▼
                        cospec-dag-executor
                                │
                                ▼
                        tr1-requirements-spec
```

`brainstorming` 内部按用户输入判断选择哪个 workflow：

| 用户输入特征 | 选择 Workflow |
|---|---|
| 原始想法、口头需求、需求不清晰、"想全面" | `product-planning-workflow` |
| 已有清晰需求方向，但未做旅程设计 | `product-planning-workflow` |
| 已有用户旅程文档 / 结构化需求文档 / 直接要写 TR1 | `tr1-only-workflow` |
| 无法判断 | `product-planning-workflow` |

每个 workflow entry skill 生成 skill 级 DAG 产物（`.cospec/runs/<RUN_DIR>/dag.json` + task cards），然后调用 `cospec-dag-executor` 并行调度 `skill-invoker` SubAgents。SubAgents 调用对应的 leaf skills。

### 管线阶段明细

| # | 阶段 | Skill | 核心产物 |
|---|---|---|---|
| 1 | **需求澄清** | `requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、核心共识） |
| 2 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） |
| 3 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） |

### Skill List

| Skill | 角色 |
|-------|------|
| `using-spec-developer` | 入口引导：如何使用 skill |
| `session-context` | 跨 compact/重启的会话状态持久化 |
| `brainstorming` | 中央路由器：评估规划阶段，选择 workflow entry skill |
| `product-planning-workflow` | 默认工作流编排器：编排完整产品规划管线 |
| `tr1-only-workflow` | 直出 TR1 工作流编排器 |
| `requirement-clarification` | 需求澄清：原始想法 → "想全面"的澄清结果 |
| `user-journey-design` | 用户旅程设计：4 阶段状态机确认流程 |
| `tr1-requirements-spec` | TR1 用户需求说明书生成（大/小需求，评审版 + AI 上下文版） |
| `cospec-configure` | 交互式配置：设置 project info、模板、默认 workflow 等 |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |
| `cospec-dag-planner` | DAG 计划生成：为 workflow entry skill 生成 `dag.json` 和 task cards |
| `cospec-dag-executor` | DAG 执行器：按 ready-set 并行调度 `skill-invoker` SubAgents |
| `cospec-dag-evaluator` | DAG 计划评估：检查 DAG 无环性、skill 引用、占位符等 |

> `cospec-dag-*` skills 是共享基础设施，被 workflow entry skills 调用。当前默认 workflow 为线性 DAG，未来可在 workflow entry skill 中增加并行辅助 skill 节点。

## Skill Authoring Rules

1. **SKILL.md** — English, loaded into AI context.
2. **README.zh.md** — Chinese, human reference only.
3. **Skill 标识** — Every skill must have a `Skill 标识` block after the H1 title.
4. **Standards references** — Skills that involve document generation must reference applicable templates in `templates/`.
5. **No platform prefixes** — Skills are referenced by name only.

## General

- One logical change per commit
- Describe the problem you solved, not just what you changed
