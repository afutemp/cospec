---
name: test-enrich
description: Use only inside test-dag-workflow — expands the seed word into 3 descriptive phrases. Non-interactive test skill.
---

# Test Enrich

**Skill 标识**: `test-enrich`

其他 skill 通过 `test-enrich` 引用本 skill。

Test leaf skill for `test-dag-workflow`. Reads the seed word from `test-gather-input` and generates 3 related descriptive phrases. Non-interactive. Runs in parallel with `test-explode`.

## When to Use

- Only when invoked by `cospec-dag-executor` as part of `test-dag-workflow`.

## Behavior

1. Read `.cospec/runs/<RUN_DIR>/test-gather-input/results.md` to get the seed word.
2. Generate 3 descriptive phrases (adjective-style or action-style) related to the seed word.
3. Write:
   - `.cospec/runs/<RUN_DIR>/test-enrich/results.md`:
     ```markdown
     ## Descriptive Phrases
     - phrase 1
     - phrase 2
     - phrase 3
     ```
   - `.cospec/runs/<RUN_DIR>/test-enrich/manifest.json`:
     ```json
     {
       "task_id": "test-enrich",
       "skill": "test-enrich",
       "status": "DONE",
       "summary": "Generated 3 descriptive phrases.",
       "artifacts": { "results": ".cospec/runs/<RUN_DIR>/test-enrich/results.md" },
       "pending_question": null,
       "blocking_reason": null,
       "ready_for_downstream": true
     }
     ```

## Output Contract

- `results.md` lists 3 descriptive phrases under a `## Descriptive Phrases` heading.
- `manifest.json` reports `status: DONE`.
