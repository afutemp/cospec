---
name: cospec-dag-executor
description: Use when a cospec DAG plan exists and needs to be executed — orchestrates section-writing subagents using ready-set scheduling and assembles the final document.
---

# cospec DAG Executor

**Skill 标识**: `cospec-dag-executor`

其他 skill 通过 `cospec-dag-executor` 引用本 skill。

Execute document-generation plans by acting as an orchestrator-only main agent: read scheduling artifacts, dispatch fresh subagents for ready tasks, run per-section review gates, then dispatch an assembler to produce the final document. Subagents exchange context through artifacts on disk, not through main-agent summaries.

## When to Use

- A cospec DAG plan has been created (`.cospec/plans/YY-MM-DD-<project>/dag.json` exists).
- The current stage or sub-skill is configured for parallel document generation.
- You need to produce a final assembled document from parallel section-writing tasks.

## HARD GATE: Orchestrator-only Main Agent

The main agent in this skill only:

1. Reads plan index, `dag.json`, task card paths, manifests, review status, and blocker reasons.
2. Computes the current ready set from DAG dependencies and manifest status.
3. Dispatches all independent ready tasks in the same scheduling batch.
4. Dispatches document-reviewer and assembler subagents by artifact path.
5. Updates task state and escalates blockers after retry limits.

The main agent must not:

- Write document sections directly.
- Paste full plan/task/results text into subagent prompts.
- Read detailed `results.md` unless escalating `BLOCKED` / `NEEDS_CONTEXT`.
- Decide document correctness directly; reviewer subagents own that judgment.

## Input Contract

Caller provides the plan directory path (e.g., `.cospec/plans/YY-MM-DD-<project>/`). From there this skill loads:

- `index.md`
- `dag.json`
- `tasks/<task-id>.md`

## Output Contract

The executor and its subagents write:

```text
.cospec/
  execution/
    run-state.json              # scheduling state
    time-stats.log              # T_EXEC_START, T_FIRST_COMPLETE
  tasks/
    <task-id>/
      manifest.json             # task status and artifact paths
      results.md                # generated section body
      contract.json             # downstream-stable contract
      changed-files.txt         # files touched
      review-quality.md         # per-section review report
  outputs/
    <stage>/
      <document-name>.md       # final assembled document
```

## The Process

1. Load `dag.json` and validate every task has `id`, `task_file`, `depends_on`, `produces`.
2. Validate every `task_file` exists.
3. Initialize/read `.cospec/execution/run-state.json`.
4. Record `T_EXEC_START` in `.cospec/execution/time-stats.log`.
5. Compute ready set and dispatch document-writer subagents in parallel.
6. Read returned manifests.
7. For each `DONE` task, dispatch document-reviewer subagent (Gate 1).
8. On review FAIL, dispatch fixer subagent and re-run reviewer (max 3 rounds).
9. Repeat ready-set computation until all tasks are complete.
10. Dispatch document-assembler subagent to merge sections into final document.
11. Record `T_FIRST_COMPLETE` in `.cospec/execution/time-stats.log`.
12. Return final document path and completion summary.

## DAG Ready-Set Scheduling

1. A task is ready when every dependency manifest has `status == DONE` and `ready_for_downstream == true`.
2. All tasks in the same ready set must be dispatched in the same scheduling batch when their deliverables do not overlap and no task declares `exclusive: true`.
3. Dependent tasks must not run before upstream manifests are `DONE` and ready for downstream.
4. If a ready set is empty while unfinished tasks remain, inspect only manifest statuses and blocking reasons, then dispatch fixer/normalizer subagents or escalate to the user.
5. Respect `config.parallel.max_parallel_tasks` from `cospec.config.json` as the upper bound for a single batch.

## Document-Writer Subagent

Dispatch with artifact paths only:

```markdown
- DAG file: `.cospec/plans/YY-MM-DD-<project>/dag.json`
- Task card: `.cospec/plans/YY-MM-DD-<project>/tasks/<task-id>.md`
- Upstream manifests:
  - `.cospec/tasks/<upstream-id>/manifest.json`
```

Required behavior:

1. Read task card and upstream manifests.
2. Generate the document section described in the task card.
3. Write artifacts:
   - `.cospec/tasks/<task-id>/results.md`
   - `.cospec/tasks/<task-id>/contract.json`
   - `.cospec/tasks/<task-id>/changed-files.txt`
   - `.cospec/tasks/<task-id>/manifest.json`
4. Return minimal status report.

Allowed return statuses:

- `DONE`
- `DONE_WITH_CONCERNS`
- `NEEDS_CONTEXT`
- `BLOCKED`
- `FAILED`

## Manifest Schema

Each document-writer subagent writes:

```json
{
  "task_id": "<task-id>",
  "status": "DONE",
  "summary": "Generated section X.",
  "artifacts": {
    "results": ".cospec/tasks/<task-id>/results.md",
    "contract": ".cospec/tasks/<task-id>/contract.json",
    "changed_files": ".cospec/tasks/<task-id>/changed-files.txt"
  },
  "contract_status": "STABLE",
  "ready_for_downstream": true,
  "blocking_reason": null,
  "next_action": "DISPATCH_REVIEW"
}
```

## Per-Task Review Gate (Gate 1)

After a document-writer returns `DONE`:

1. Dispatch `document-reviewer` subagent using `agents/document-reviewer-prompt.md`.
2. Pass artifact paths only: task card, manifest, results path, contract path.
3. Reviewer checks:
   - Section covers everything in the task card Source.
   - No placeholders.
   - Consistent with upstream manifest contracts.
   - Output follows the Interface Contract.
4. Gate outcomes:
   - **PASS** → task is complete, downstream tasks may become ready.
   - **FAIL** → reviewer writes `review-quality.md`, dispatch fixer subagent, re-dispatch reviewer (max 3 rounds).
5. After 3 FAIL rounds: escalate to user via `AskUserQuestion`.

## Document-Assembler Subagent

After all tasks pass review:

1. Dispatch `document-assembler` subagent using `agents/document-assembler-prompt.md`.
2. Inputs:
   - `dag.json`
   - All task manifest paths
   - All `results.md` paths
   - Target `output_path`
3. Assembler merges sections in dependency order, applies cross-section consistency fixes, and writes the final document.
4. Output: final assembled document at `output_path`.

## Status Handling

**DONE:** Read the manifest path, proceed to Gate 1 (document-reviewer).
**DONE_WITH_CONCERNS:** Dispatch reviewer subagent to judge whether concerns block downstream work.
**NEEDS_CONTEXT:** Read only `blocking_reason`, supply missing artifact paths or ask the user for the required decision, then re-dispatch writer.
**BLOCKED:** Stop downstream dispatch. Provide context, break task smaller through planner/normalizer subagent, or escalate to user.
**FAILED:** Dispatch fixer subagent using artifact paths. Escalate after 3 rounds.

## Time-Stats Logging (MANDATORY)

Append to `.cospec/execution/time-stats.log`:

### T_EXEC_START

After loading DAG, before first ready set:

```bash
echo "T_EXEC_START: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospec/execution/time-stats.log
```

### T_FIRST_COMPLETE

After all tasks complete and assembler finishes:

```bash
echo "T_FIRST_COMPLETE: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospec/execution/time-stats.log
```

## Red Flags

- Do NOT write document sections in the main agent.
- Do NOT dispatch dependent tasks before upstream manifests are `DONE` and `ready_for_downstream=true`.
- Do NOT paste full section text into subagent prompts.
- Do NOT skip the per-section review gate.
- Do NOT exceed `max_parallel_tasks` in a single batch.
- Do NOT proceed to assembler before all tasks are reviewed.

## Prompt Templates

- `./agents/document-writer-prompt.md` — Dispatch section-writing subagent.
- `./agents/document-reviewer-prompt.md` — Dispatch per-section reviewer subagent.
- `./agents/document-assembler-prompt.md` — Dispatch final assembler subagent.

## Integration

Typical call chain:

```text
caller skill
    -> cospec-dag-planner
    -> [optional] cospec-dag-evaluator
    -> cospec-dag-executor
```
