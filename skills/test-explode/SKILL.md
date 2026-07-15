---
name: test-explode
description: Use only inside test-dag-workflow — expands the seed word into 3 noun phrases. Non-interactive test skill.
---

# Test Explode

**Skill 标识**: `test-explode`

其他 skill 通过 `test-explode` 引用本 skill。

Test leaf skill for `test-dag-workflow`. Reads the seed word from `test-gather-input` and generates 3 related noun phrases. Non-interactive.

## When to Use

- Only when invoked by `cospec-dag-executor` as part of `test-dag-workflow`.

## Behavior

1. Read `.cospec/workflow/test-gather-input/results.md` to get the seed word.
2. Generate 3 noun phrases related to the seed word.
3. Write:
   - `.cospec/workflow/test-explode/results.md`:
     ```markdown
     ## Noun Phrases
     - phrase 1
     - phrase 2
     - phrase 3
     ```
   - `.cospec/workflow/test-explode/manifest.json`:
     ```json
     {
       "task_id": "test-explode",
       "skill": "test-explode",
       "status": "DONE",
       "summary": "Generated 3 noun phrases.",
       "artifacts": { "results": ".cospec/workflow/test-explode/results.md" },
       "pending_question": null,
       "blocking_reason": null,
       "ready_for_downstream": true
     }
     ```

## Output Contract

- `results.md` lists 3 noun phrases under a `## Noun Phrases` heading.
- `manifest.json` reports `status: DONE`.
