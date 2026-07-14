---
name: product-planning-workflow
description: Orchestrate the full cospec product planning pipeline — requirement clarification, user journey design, and TR1 requirements spec generation — with optional evaluator quality gates between stages.
---

# Product Planning Workflow

**Skill 标识**: `product-planning-workflow`

其他 skill 通过 `product-planning-workflow` 引用本 skill。

`brainstorming` 是所有产品规划任务的唯一入口。`brainstorming` 完成阶段判断后，必须调用 `product-planning-workflow` 执行后续完整管线。`product-planning-workflow` 负责编排三个叶子 skill 并在阶段间调度 evaluator 质量门。

## Responsibility

- 从合适的阶段启动主链（requirement-clarification → user-journey-design → tr1-requirements-spec）。
- 调用叶子 skill 完成每个阶段的产物。
- 根据 `cospec.config.json` 中的 `evaluators` 配置，在阶段后运行 evaluator 质量门。
- 阶段通过后推进到下一个阶段；不通过则返工当前阶段。
- 维护会话上下文，记录当前阶段和状态。

## Extension Points

Before starting, read `cospec.config.json` from the plugin root (2 levels above this skill's base directory). No fallback needed — the config always has valid defaults.

| Config Field | Purpose |
|---|---|
| `config.templates["user-requirement"]` | TR1 user requirement template path |
| `config.templates["user-journey"]` | User journey document template path |
| `config.templates["tr1-large-review"]` | Large-requirement review edition template path |
| `config.templates["tr1-large-ai"]` | Large-requirement AI-context edition template path |
| `config.templates["tr1-small-review"]` | Small-requirement review edition template path |
| `config.rules["requirement-checklists"]` | Requirement checklists directory used for self-review |
| `config.evaluators["requirement-clarification"]` | Evaluator after clarification; `false` = disable gate |
| `config.evaluators["user-journey-design"]` | Evaluator after user journey design; `false` = disable gate |
| `config.evaluators["tr1-requirements-spec"]` | Evaluator after TR1 generation; `false` = disable gate |
| `config.parallel.enabled` | Reserved: master switch for DAG-based parallel document generation |
| `config.parallel.stages["<stage-name>"]` | Reserved: enable parallel mode for a specific stage |
| `config.parallel.max_parallel_tasks` | Max tasks dispatched in one ready-set batch |
| `config.parallel.evaluator` | DAG plan evaluator skill name; `false` = disable |

## Entry Determination

`product-planning-workflow` determines the starting stage by reading session context and the latest conversation:

1. If `session-context` indicates an active stage, resume from that stage.
2. Otherwise, infer from the user's request and available materials:
   - Raw idea / unclear requirement / "想全面" → start at `requirement-clarification`
   - Clear requirement but no journey design → start at `user-journey-design`
   - Existing journey document / structured requirement / "写 TR1" → start at `tr1-requirements-spec`

Announce the chosen starting stage to the user before proceeding.

## Pipeline

```
requirement-clarification
        │
        ▼
[evaluator: requirement-clarification]  (optional, configured)
        │
        ▼
user-journey-design
        │
        ▼
[evaluator: user-journey-design]  (optional, configured)
        │
        ▼
tr1-requirements-spec
        │
        ▼
[evaluator: tr1-requirements-spec]  (optional, configured)
        │
        ▼
     完成
```

## Stage Orchestration Rules

1. **Run leaf skill**: Call the current stage's leaf skill by name (`requirement-clarification`, `user-journey-design`, or `tr1-requirements-spec`).
2. **User confirmation**: After the leaf skill finishes, confirm the deliverable with the user. Do not proceed until the user approves.
3. **Evaluator gate** (if configured and user approved):
   - Read `config.evaluators["<stage-name>"]`.
   - If `false`, skip evaluation.
   - If a string (skill name), call that evaluator skill with the current stage's output.
   - Expect return format: grade (A/B/C/D/F) + issue list, or pass/fail.
   - If grade < B or fail, show issues and return to the current stage leaf skill for rework.
   - If grade ≥ B or pass, proceed to the next stage.
4. **Advance**: Move to the next stage in the pipeline. If no next stage, the workflow completes.
5. **Session context**: After each stage transition, update session context via `session-context` skill so compact/resume works correctly.

## Stage Transitions

| Current Stage | Next Stage | Condition |
|---|---|---|
| `requirement-clarification` | `user-journey-design` | User approves clarification output and evaluator passes (or disabled) |
| `user-journey-design` | `tr1-requirements-spec` | User approves journey design and evaluator passes (or disabled) |
| `tr1-requirements-spec` | — | Workflow completes |

## Output

At workflow completion, summarize:

- Which stages were executed
- Where the deliverables are located
- Any open issues or待确认 items
- Recommended next steps (e.g., implementation planning, demo preparation)

## DAG-based Parallel Mode (Reserved Extension Point)

cospec now includes DAG-based parallel document generation skills (`cospec-dag-planner`, `cospec-dag-executor`, `cospec-dag-evaluator`) for future sub-skills that need to split a document into parallel sections. **The existing stages remain linear by default.**

When a future stage or sub-skill is configured for parallel mode (`config.parallel.enabled=true` and `config.parallel.stages["<stage-name>"]=true`), the workflow may use this path instead of calling the leaf skill directly:

```text
product-planning-workflow
        │
        ▼
cospec-dag-planner          (writes .cospec/plans/.../dag.json + task cards)
        │
        ▼
[cospec-dag-evaluator]      (optional, configured by parallel.evaluator)
        │
        ▼
cospec-dag-executor         (dispatches section writers, assembles final document)
        │
        ▼
[existing stage evaluator]  (configured by evaluators.<stage-name>)
```

Rules:

1. Parallel mode is opt-in per stage and disabled for all existing stages by default.
2. The leaf skill remains responsible for user-facing SOP and stage-specific decisions.
3. `product-planning-workflow` decides whether to invoke the DAG path based on `config.parallel.stages[<stage-name>]`.
4. After the DAG executor returns the assembled document, the workflow continues to user confirmation and the existing stage evaluator (if configured).

## Red Flags

- Do NOT let the user skip a stage without explicit approval.
- Do NOT call evaluator if the user has not approved the current stage output.
- Do NOT proceed to the next stage if the evaluator gate fails.
- Do NOT modify core workflow sequence; only the configured extension points may vary.
