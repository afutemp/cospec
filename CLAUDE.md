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
| `product-planning-workflow` | Dispatched by `brainstorming` to orchestrate the pipeline |

### Pipeline（一条主链）

`brainstorming` 是所有产品规划工作的唯一入口，判断用户所处阶段后路由到对应节点：

```
用户意图 ──→ brainstorming ──→ product-planning-workflow ──→ requirement-clarification ──→ user-journey-design ──→ tr1-requirements-spec
```

brainstorming 内部按用户输入判断从哪个节点进入：

| 用户输入特征 | 进入节点 |
|-------------|---------|
| 原始想法、口头需求、需求不清晰、"想全面" | → `requirement-clarification` |
| 已有清晰需求方向，但未做旅程设计 | → `user-journey-design` |
| 已有用户旅程文档 / 结构化需求文档 / 直接要写 TR1 | → `tr1-requirements-spec` |

### 管线阶段明细

| # | 阶段 | Skill | 核心产物 |
|---|------|-------|----------|
| 1 | **需求澄清** | `requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、核心共识） |
| 2 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） |
| 3 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） |

### Skill List（9 个）

| Skill | 角色 |
|-------|------|
| `using-spec-developer` | 入口引导：如何使用 skill |
| `session-context` | 跨 compact/重启的会话状态持久化 |
| `brainstorming` | 中央路由器：评估规划阶段，分发至工作流编排器 |
| `product-planning-workflow` | 产品规划工作流编排器：串联三阶段与质量门 |
| `requirement-clarification` | 需求澄清：原始想法 → "想全面"的澄清结果 |
| `user-journey-design` | 用户旅程设计：4 阶段状态机确认流程 |
| `tr1-requirements-spec` | TR1 用户需求说明书生成（大/小需求，评审版 + AI 上下文版） |
| `cospec-configure` | 交互式配置：设置 project info 或替换内置模板路径 |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |

## Skill Authoring Rules

1. **SKILL.md** — English, loaded into AI context.
2. **README.zh.md** — Chinese, human reference only.
3. **Skill 标识** — Every skill must have a `Skill 标识` block after the H1 title.
4. **Standards references** — Skills that involve document generation must reference applicable templates in `templates/`.
5. **No platform prefixes** — Skills are referenced by name only.

## General

- One logical change per commit
- Describe the problem you solved, not just what you changed
