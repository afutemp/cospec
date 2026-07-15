---
name: test-dag-workflow
description: Use to validate cospec skill-level DAG scheduling — exercises dependency ordering, parallel dispatch, and NEEDS_CONTEXT staggered questioning with five trivial leaf skills. Intended for testing, not real product planning.
---

# Test DAG Workflow

**Skill 标识**: `test-dag-workflow`

其他 skill 通过 `test-dag-workflow` 引用本 skill。

This is a **throwaway validation workflow**. It orchestrates five trivial leaf skills around a simple "word expansion" task to exercise the `cospec-dag-executor` machinery without touching real product planning.

## When to Use

- You want to verify that `cospec-dag-executor` schedules correctly.
- You want to confirm parallel dispatch, dependency waiting, and `NEEDS_CONTEXT` staggered questioning all work.

## What It Validates

| Mechanism | How |
|---|---|
| **Dependency ordering** | `test-merge` runs only after `test-explode`, `test-enrich`, and `test-preflight` are all `DONE`. |
| **Parallel dispatch** | `test-explode` and `test-enrich` both depend only on `test-gather-input` → dispatched together once `gather-input` is `DONE`. |
| **NEEDS_CONTEXT staggered questioning** | `test-gather-input` and `test-preflight` are both root nodes and both interactive → the executor must ask the user one question at a time, never two at once. |

## DAG

```text
test-gather-input (interactive, root)
        │
        ├──→ test-explode ──┐
        │                    ├──→ test-merge
        └──→ test-enrich  ──┤
                             │
test-preflight (interactive, root) ──┘
```

Expected scheduling rounds:

```
Round 1 (roots): test-gather-input (interactive) + test-preflight (interactive)
                 → ask user ONE question at a time (staggered)

Round 2 (after gather-input DONE): test-explode + test-enrich  → run in parallel

Round 3 (after explode + enrich + preflight DONE): test-merge
```

## The Process

1. **Create DAG artifacts** under `.cospec/workflow/`:
   - `index.md`
   - `dag.json`
   - `tasks/test-gather-input.md`
   - `tasks/test-preflight.md`
   - `tasks/test-explode.md`
   - `tasks/test-enrich.md`
   - `tasks/test-merge.md`
2. **Call `cospec-dag-executor`** to dispatch the skill-invoker SubAgents.
3. **Observe** the scheduling behavior and confirm the three mechanisms work.
4. **Summarize** which skills ran, in what order, and where the final merged output lives.

## `dag.json`

```json
{
  "workflow": "test-dag-workflow",
  "plan_file": ".cospec/workflow/index.md",
  "tasks": [
    {
      "id": "test-gather-input",
      "task_file": ".cospec/workflow/tasks/test-gather-input.md",
      "depends_on": [],
      "produces": [".cospec/workflow/test-gather-input/manifest.json"]
    },
    {
      "id": "test-preflight",
      "task_file": ".cospec/workflow/tasks/test-preflight.md",
      "depends_on": [],
      "produces": [".cospec/workflow/test-preflight/manifest.json"]
    },
    {
      "id": "test-explode",
      "task_file": ".cospec/workflow/tasks/test-explode.md",
      "depends_on": ["test-gather-input"],
      "produces": [".cospec/workflow/test-explode/manifest.json"]
    },
    {
      "id": "test-enrich",
      "task_file": ".cospec/workflow/tasks/test-enrich.md",
      "depends_on": ["test-gather-input"],
      "produces": [".cospec/workflow/test-enrich/manifest.json"]
    },
    {
      "id": "test-merge",
      "task_file": ".cospec/workflow/tasks/test-merge.md",
      "depends_on": ["test-explode", "test-enrich", "test-preflight"],
      "produces": [".cospec/workflow/test-merge/manifest.json"]
    }
  ]
}
```

## Task Cards

### test-gather-input (interactive, root)

```markdown
# Task: test-gather-input

## Skill
test-gather-input

## Source
Test workflow root — collect the seed word from the user.

## Depends on
(none)

## Input Artifacts
(none)

## Task Spec
Ask the user for a single noun (the "seed word"). This skill is interactive and returns NEEDS_CONTEXT.

## Interface Contract
- Writes the chosen seed word to results.md under a `## Seed Word` heading.

## Acceptance Criteria
- Returns NEEDS_CONTEXT with a clear question.
- After the user answers, writes the seed word.

## Required Output Artifacts
- `.cospec/workflow/test-gather-input/manifest.json`
- `.cospec/workflow/test-gather-input/results.md`
```

### test-preflight (interactive, root)

```markdown
# Task: test-preflight

## Skill
test-preflight

## Source
Test workflow root — collect tone preference from the user.

## Depends on
(none)

## Input Artifacts
(none)

## Task Spec
Ask the user whether they want a formal or casual tone. This skill is interactive and returns NEEDS_CONTEXT.

## Interface Contract
- Writes the chosen tone to results.md under a `## Tone` heading.

## Acceptance Criteria
- Returns NEEDS_CONTEXT with a clear question.
- After the user answers, writes the tone.

## Required Output Artifacts
- `.cospec/workflow/test-preflight/manifest.json`
- `.cospec/workflow/test-preflight/results.md`
```

### test-explode (parallel)

```markdown
# Task: test-explode

## Skill
test-explode

## Source
Test workflow — expand the seed word into noun phrases.

## Depends on
test-gather-input

## Input Artifacts
- `.cospec/workflow/test-gather-input/manifest.json`

## Task Spec
Read the seed word from test-gather-input and generate 3 related noun phrases. Non-interactive.

## Interface Contract
- Writes 3 noun phrases to results.md as a bulleted list.

## Acceptance Criteria
- Each phrase relates to the seed word.

## Required Output Artifacts
- `.cospec/workflow/test-explode/manifest.json`
- `.cospec/workflow/test-explode/results.md`
```

### test-enrich (parallel)

```markdown
# Task: test-enrich

## Source
Test workflow — expand the seed word into descriptive phrases.

## Depends on
test-gather-input

## Input Artifacts
- `.cospec/workflow/test-gather-input/manifest.json`

## Task Spec
Read the seed word from test-gather-input and generate 3 related descriptive phrases. Non-interactive.

## Interface Contract
- Writes 3 descriptive phrases to results.md as a bulleted list.

## Acceptance Criteria
- Each phrase relates to the seed word.

## Required Output Artifacts
- `.cospec/workflow/test-enrich/manifest.json`
- `.cospec/workflow/test-enrich/results.md`
```

### test-merge (terminal, multi-dependency)

```markdown
# Task: test-merge

## Skill
test-merge

## Source
Test workflow — merge all upstream outputs into one paragraph.

## Depends on
test-explode, test-enrich, test-preflight

## Input Artifacts
- `.cospec/workflow/test-explode/manifest.json`
- `.cospec/workflow/test-enrich/manifest.json`
- `.cospec/workflow/test-preflight/manifest.json`

## Task Spec
Read the noun phrases, descriptive phrases, and tone from upstream results. Compose one short paragraph in the requested tone. Non-interactive.

## Interface Contract
- Writes the final paragraph to results.md.

## Acceptance Criteria
- Paragraph uses the seed word's expansions.
- Paragraph respects the chosen tone.

## Required Output Artifacts
- `.cospec/workflow/test-merge/manifest.json`
- `.cospec/workflow/test-merge/results.md`
```

## Red Flags

- Do NOT route this through `brainstorming` — it is a standalone test workflow.
- Do NOT modify any existing skill.
- Do NOT execute leaf skills directly in the main agent; always go through `cospec-dag-executor`.
