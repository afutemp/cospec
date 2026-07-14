---
name: tr1-only-workflow
description: Use when the user already has a user journey or structured requirements and only needs to generate the TR1 requirements specification.
---

# TR1-Only Workflow

**Skill 标识**: `tr1-only-workflow`

其他 skill 通过 `tr1-only-workflow` 引用本 skill。

This workflow entry skill orchestrates a single leaf skill: `tr1-requirements-spec`. It is used when the user already has sufficient upstream context (user journey, structured requirements, or prior clarification) and wants to produce the TR1 document directly.

## When to Use

- User says "直接写 TR1".
- User provides an existing user journey document or structured requirements.
- `brainstorming` routes here based on user intent and available materials.

## Workflow

1. **Generate DAG artifacts** under `.cospec/workflow/`:
   - `index.md`
   - `dag.json`
   - `tasks/tr1-requirements-spec.md`
2. **Optionally evaluate** the DAG with `cospec-dag-evaluator`.
3. **Call `cospec-dag-executor`** to dispatch the skill-invoker SubAgent.
4. **Wait for completion** and summarize the final TR1 document path.

## DAG

```text
tr1-requirements-spec
```

## Task Card: tr1-requirements-spec

```markdown
# Task: tr1-requirements-spec

## Skill
tr1-requirements-spec

## Source
Direct TR1 generation from existing materials.

## Depends on
(none)

## Input Artifacts
(none — user provides context in conversation or existing files)

## Task Spec
Generate the TR1 requirements specification based on the user's existing journey document or structured requirements.

## Interface Contract
- Output filenames follow `tr1-requirements-spec` convention.
- Large requirement: `{project}_大需求用户需求规格说明书_评审版.md` + `_AI上下文版.md`
- Small requirement: `{project}_小需求用户需求说明_评审版.md`

## Acceptance Criteria
- No placeholders.
- Follows the configured TR1 template.
- Produces the required TR1 artifacts.

## Required Output Artifacts
- `.cospec/workflow/tr1-requirements-spec/manifest.json`
- `.cospec/workflow/tr1-requirements-spec/results.md`
```

## Output

- Final TR1 document path(s).
- Summary of what was generated.

## Red Flags

- Do NOT ask clarifying questions that should have been answered in earlier stages.
- Do NOT generate full TR1 if the user only wants a specific section or feature.
- Do NOT skip the configured TR1 template.
