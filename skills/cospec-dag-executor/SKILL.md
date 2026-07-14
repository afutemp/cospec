---
name: cospec-dag-executor
description: Use when a skill-level DAG plan exists and needs to be executed — orchestrates skill-invoker subagents using ready-set scheduling and handles NEEDS_CONTEXT via the main agent question queue.
---

# cospec DAG Executor

**Skill 标识**: `cospec-dag-executor`

其他 skill 通过 `cospec-dag-executor` 引用本 skill。

Execute skill-level DAG plans by acting as an orchestrator-only main agent: read scheduling artifacts, dispatch fresh subagents for ready tasks, handle `NEEDS_CONTEXT` via a question queue, and wait until all tasks complete. Subagents exchange context through artifacts on disk, not through main-agent summaries.

## When to Use

- A skill-level DAG plan has been created (`.cospec/workflow/dag.json` exists).
- A workflow entry skill needs to orchestrate multiple leaf skills in parallel.
- You need to run multiple skills concurrently while ensuring only one skill actively asks the user a question at a time.

## HARD GATE: Orchestrator-only Main Agent

The main agent in this skill only:

1. Reads plan index, `dag.json`, task card paths, manifests, review status, and blocker reasons.
2. Computes the current ready set from DAG dependencies and manifest status.
3. Dispatches all independent ready tasks in the same scheduling batch.
4. Collects `NEEDS_CONTEXT` responses into a question queue.
5. Asks the user one question at a time and routes answers back to the corresponding subagent.
6. Updates task state and escalates blockers after retry limits.

The main agent must not:

- Execute leaf skills directly.
- Paste full plan/task/results text into subagent prompts.
- Ask the user more than one question at a time.
- Decide skill correctness directly; subagents and the invoked skills own that judgment.

## Input Contract

Caller provides the workflow directory path (e.g., `.cospec/workflow/`). From there this skill loads:

- `index.md`
- `dag.json`
- `tasks/<task-id>.md`

## Output Contract

The executor and its subagents write:

```text
.cospec/workflow/
  execution/
    run-state.json              # scheduling state
    time-stats.log              # T_EXEC_START, T_FIRST_COMPLETE
  <task-id>/
    manifest.json               # task status and artifact paths
    results.md                  # skill output summary
```

## The Process

1. Load `dag.json` and validate every task has `id`, `task_file`, `depends_on`, `produces`.
2. Validate every `task_file` exists.
3. Initialize/read `.cospec/workflow/execution/run-state.json`.
4. Record `T_EXEC_START` in `.cospec/workflow/execution/time-stats.log`.
5. Compute ready set and dispatch `skill-invoker` subagents in parallel.
6. Read returned manifests.
7. For each `NEEDS_CONTEXT`, extract the question and add it to the question queue.
8. If the queue has a question and no question is currently active, ask the user.
9. When an answer is received, re-dispatch the corresponding `skill-invoker` subagent with the answer.
10. Repeat ready-set computation until all tasks are `DONE`, `FAILED`, or `BLOCKED`.
11. Record `T_FIRST_COMPLETE` in `.cospec/workflow/execution/time-stats.log`.
12. Return final summary.

## DAG Ready-Set Scheduling

1. A task is ready when every dependency manifest has `status == DONE` and `ready_for_downstream == true`.
2. All tasks in the same ready set must be dispatched in the same scheduling batch when their deliverables do not overlap and no task declares `exclusive: true`.
3. Dependent tasks must not run before upstream manifests are `DONE` and ready.
4. If a ready set is empty while unfinished tasks remain, inspect only manifest statuses and blocking reasons, then dispatch fixer/normalizer subagents or escalate to the user.
5. Respect `max_parallel_tasks` from the caller's workflow config as the upper bound for a single batch.

## Question Queue Rules

1. Only the main agent may ask the user questions.
2. When a subagent returns `NEEDS_CONTEXT`, add its question to the queue.
3. At most one question is presented to the user at a time.
4. After the user answers, route the answer to the corresponding subagent and re-dispatch it.
5. Other running subagents continue in the background; they are not blocked unless they also return `NEEDS_CONTEXT`.
6. If the queue has multiple questions, process them in the order the corresponding tasks became ready.

## skill-invoker Subagent

Dispatch with artifact paths only:

```markdown
- DAG file: `.cospec/workflow/dag.json`
- Task card: `.cospec/workflow/tasks/<task-id>.md`
- Upstream manifests:
  - `.cospec/workflow/<upstream-id>/manifest.json`
```

Required behavior:

1. Read task card and upstream manifests.
2. Invoke the skill named in the task card's `Skill` field.
3. If the invoked skill needs user input, do NOT ask the user directly. Return `NEEDS_CONTEXT` with the question.
4. Write artifacts:
   - `.cospec/workflow/<task-id>/results.md`
   - `.cospec/workflow/<task-id>/manifest.json`
5. Return minimal status report.

Allowed return statuses:

- `DONE`
- `DONE_WITH_CONCERNS`
- `NEEDS_CONTEXT`
- `BLOCKED`
- `FAILED`

## Manifest Schema

Each skill-invoker subagent writes:

```json
{
  "task_id": "<task-id>",
  "skill": "<skill-name>",
  "status": "DONE",
  "summary": "Executed skill X.",
  "artifacts": {
    "results": ".cospec/workflow/<task-id>/results.md"
  },
  "pending_question": null,
  "blocking_reason": null,
  "ready_for_downstream": true
}
```

Allowed `status` values: `RUNNING`, `NEEDS_CONTEXT`, `DONE`, `FAILED`, `BLOCKED`.

## Status Handling

**DONE:** Read the manifest path; downstream tasks may become ready.  
**DONE_WITH_CONCERNS:** Treat as `DONE` for scheduling, but record concerns in the final summary.  
**NEEDS_CONTEXT:** Add question to queue. Do not dispatch downstream tasks until resolved.  
**BLOCKED:** Stop downstream dispatch. Provide context or escalate to user.  
**FAILED:** Dispatch fixer subagent using artifact paths. Escalate after 3 rounds.

## Time-Stats Logging (MANDATORY)

Append to `.cospec/workflow/execution/time-stats.log`:

### T_EXEC_START

After loading DAG, before first ready set:

```bash
echo "T_EXEC_START: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospec/workflow/execution/time-stats.log
```

### T_FIRST_COMPLETE

After all tasks complete:

```bash
echo "T_FIRST_COMPLETE: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospec/workflow/execution/time-stats.log
```

## Red Flags

- Do NOT execute leaf skills in the main agent.
- Do NOT dispatch dependent tasks before upstream manifests are `DONE` and `ready_for_downstream=true`.
- Do NOT paste full skill output into subagent prompts.
- Do NOT ask the user more than one question at a time.
- Do NOT exceed `max_parallel_tasks` in a single batch.
- Do NOT ignore `NEEDS_CONTEXT` responses.

## Prompt Templates

- `./agents/skill-invoker-prompt.md` — Dispatch skill-invoker subagent.

## Integration

Typical call chain:

```text
workflow entry skill
    -> cospec-dag-planner (optional)
    -> [cospec-dag-evaluator] (optional)
    -> cospec-dag-executor
```
