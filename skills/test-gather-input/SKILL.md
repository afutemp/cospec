---
name: test-gather-input
description: Use only inside test-dag-workflow — collects a seed word from the user via NEEDS_CONTEXT. Test skill, not for real use.
---

# Test Gather Input

**Skill 标识**: `test-gather-input`

其他 skill 通过 `test-gather-input` 引用本 skill。

Test leaf skill for `test-dag-workflow`. Asks the user for a single seed noun and writes it to `results.md`.

## When to Use

- Only when invoked by `cospec-dag-executor` as part of `test-dag-workflow`.

## Behavior

1. This skill needs user input: a single noun (the "seed word").
2. When run inside a skill-invoker SubAgent, do NOT ask the user directly. Return `NEEDS_CONTEXT`:

   ```markdown
   Status: NEEDS_CONTEXT
   Task: test-gather-input
   Question: 请给我一个名词作为"种子词"，我会围绕它扩展内容。
   Question context: 需要一个种子词来驱动后续的 explode/enrich/merge 任务。
   Manifest: .cospec/runs/<RUN_DIR>/test-gather-input/manifest.json
   ```

3. After the user answers, the answer is routed back. Then write:
   - `.cospec/runs/<RUN_DIR>/test-gather-input/results.md`:
     ```markdown
     ## Seed Word
     <user-provided noun>
     ```
   - `.cospec/runs/<RUN_DIR>/test-gather-input/manifest.json`:
     ```json
     {
       "task_id": "test-gather-input",
       "skill": "test-gather-input",
       "status": "DONE",
       "summary": "Collected seed word.",
       "artifacts": { "results": ".cospec/runs/<RUN_DIR>/test-gather-input/results.md" },
       "pending_question": null,
       "blocking_reason": null,
       "ready_for_downstream": true
     }
     ```

## Output Contract

- `results.md` contains the seed word under a `## Seed Word` heading.
- `manifest.json` reports `status: DONE` and `ready_for_downstream: true`.
