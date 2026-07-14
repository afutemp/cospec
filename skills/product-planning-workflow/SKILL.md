---
name: product-planning-workflow
description: Orchestrate the default cospec product planning pipeline — requirement clarification, user journey design, and TR1 requirements spec generation — using skill-level DAG execution.
---

# Product Planning Workflow

**Skill 标识**: `product-planning-workflow`

其他 skill 通过 `product-planning-workflow` 引用本 skill。

`brainstorming` 是默认入口。对于完整产品规划流程，`brainstorming` 调用本 skill 执行三阶段管线。本 skill 是一个 workflow entry skill：它生成 skill 级 DAG 产物，然后调用 `cospec-dag-executor` 调度 leaf skills。

## Responsibility

- 编排默认产品规划主链：`requirement-clarification` → `user-journey-design` → `tr1-requirements-spec`。
- 生成 `.cospec/workflow/` 下的 DAG 产物。
- 调用 `cospec-dag-executor` 执行 DAG。
- 汇总最终产物。

## Extension Points

Before starting, read `cospec.config.json` from the plugin root (2 levels above this skill's base directory). No fallback needed — the config always has valid defaults.

| Config Field | Purpose |
|---|---|
| `config.workflow.default` | Default workflow name when `brainstorming` does not override |
| `config.evaluators["requirement-clarification"]` | Evaluator after clarification; `false` = disable gate |
| `config.evaluators["user-journey-design"]` | Evaluator after user journey design; `false` = disable gate |
| `config.evaluators["tr1-requirements-spec"]` | Evaluator after TR1 generation; `false` = disable gate |

## Workflow DAG

```text
requirement-clarification
        │
        ▼
user-journey-design
        │
        ▼
tr1-requirements-spec
```

当前默认 workflow 为线性 DAG。未来可在本 skill 中增加并行辅助 skill 节点。

## The Process

1. **Create DAG artifacts** under `.cospec/workflow/`:
   - `index.md`
   - `dag.json`
   - `tasks/requirement-clarification.md`
   - `tasks/user-journey-design.md`
   - `tasks/tr1-requirements-spec.md`
2. **Optionally evaluate** the DAG with `cospec-dag-evaluator`.
3. **Call `cospec-dag-executor`** to dispatch skill-invoker SubAgents.
4. **Wait for completion** and summarize deliverables.

## Task Card Templates

### requirement-clarification

```markdown
# Task: requirement-clarification

## Skill
requirement-clarification

## Source
Default product planning workflow — stage 1.

## Depends on
(none)

## Input Artifacts
(none)

## Task Spec
Clarify the user's raw idea into a structured clarification deliverable.

## Interface Contract
- Output: clarification deliverable with overview, panoramic conclusions, exceptions/risks, downstream impact, facts/assumptions/open questions, and 3-5 core agreements.

## Acceptance Criteria
- No placeholders.
- Covers all key aspects of the user's request.

## Required Output Artifacts
- `.cospec/workflow/requirement-clarification/manifest.json`
- `.cospec/workflow/requirement-clarification/results.md`
```

### user-journey-design

```markdown
# Task: user-journey-design

## Skill
user-journey-design

## Source
Default product planning workflow — stage 2.

## Depends on
requirement-clarification

## Input Artifacts
- `.cospec/workflow/requirement-clarification/manifest.json`

## Task Spec
Design the user journey based on the clarified requirements.

## Interface Contract
- Output: user journey design document with background, solution design, future journey, and goal achievement analysis.

## Acceptance Criteria
- No placeholders.
- Aligned with clarification output.

## Required Output Artifacts
- `.cospec/workflow/user-journey-design/manifest.json`
- `.cospec/workflow/user-journey-design/results.md`
```

### tr1-requirements-spec

```markdown
# Task: tr1-requirements-spec

## Skill
tr1-requirements-spec

## Source
Default product planning workflow — stage 3.

## Depends on
user-journey-design

## Input Artifacts
- `.cospec/workflow/user-journey-design/manifest.json`

## Task Spec
Generate the TR1 requirements specification from the user journey.

## Interface Contract
- Output: TR1 review edition and/or AI-context edition following the configured templates.

## Acceptance Criteria
- No placeholders.
- Follows configured TR1 template.

## Required Output Artifacts
- `.cospec/workflow/tr1-requirements-spec/manifest.json`
- `.cospec/workflow/tr1-requirements-spec/results.md`
```

## Output

At workflow completion, summarize:

- Which skills were executed.
- Where the deliverables are located.
- Any open issues or待确认 items.
- Recommended next steps.

## Red Flags

- Do NOT let the user skip a stage without explicit approval.
- Do NOT execute leaf skills directly in the main agent.
- Do NOT proceed if `cospec-dag-executor` reports `BLOCKED` without escalation.
- Do NOT modify the core workflow sequence; only parallel auxiliary skills may be added.
