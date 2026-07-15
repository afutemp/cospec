---
name: test-preflight
description: Use only inside test-dag-workflow — collects a tone preference from the user via NEEDS_CONTEXT. Test skill, not for real use.
---

# Test Preflight

**Skill 标识**: `test-preflight`

其他 skill 通过 `test-preflight` 引用本 skill。

Test leaf skill for `test-dag-workflow`. Asks the user for a tone preference and writes it to `results.md`. Runs as a root node alongside `test-gather-input` to validate staggered questioning.

## When to Use

- Only when invoked by `cospec-dag-executor` as part of `test-dag-workflow`.

## Behavior

1. This skill needs user input: a tone choice (formal or casual).
2. When run inside a skill-invoker SubAgent, do NOT ask the user directly. Return `NEEDS_CONTEXT`:

   ```markdown
   Status: NEEDS_CONTEXT
   Task: test-preflight
   Question: 你想要正式语气还是轻松语气？
   Question context: merge 任务需要知道最终段落的语气风格。
   Manifest: .cospec/runs/<RUN_DIR>/test-preflight/manifest.json
   ```

3. After the user answers, write:
   - `.cospec/runs/<RUN_DIR>/test-preflight/results.md`:
     ```markdown
     ## Tone
     <user-provided tone, e.g. 正式 / 轻松>
     ```
   - `.cospec/runs/<RUN_DIR>/test-preflight/manifest.json`:
     ```json
     {
       "task_id": "test-preflight",
       "skill": "test-preflight",
       "status": "DONE",
       "summary": "Collected tone preference.",
       "artifacts": { "results": ".cospec/runs/<RUN_DIR>/test-preflight/results.md" },
       "pending_question": null,
       "blocking_reason": null,
       "ready_for_downstream": true
     }
     ```

## Output Contract

- `results.md` contains the tone under a `## Tone` heading.
- `manifest.json` reports `status: DONE` and `ready_for_downstream: true`.
