---
name: test-merge
description: Use only inside test-dag-workflow — merges explode, enrich, and preflight outputs into one paragraph. Terminal test skill.
---

# Test Merge

**Skill 标识**: `test-merge`

其他 skill 通过 `test-merge` 引用本 skill。

Test leaf skill for `test-dag-workflow`. Reads outputs from `test-explode`, `test-enrich`, and `test-preflight`, then composes one short paragraph. Non-interactive. Terminal node — depends on all other tasks.

## When to Use

- Only when invoked by `cospec-dag-executor` as part of `test-dag-workflow`.

## Behavior

1. Read:
   - `.cospec/workflow/test-explode/results.md` (noun phrases)
   - `.cospec/workflow/test-enrich/results.md` (descriptive phrases)
   - `.cospec/workflow/test-preflight/results.md` (tone)
2. Compose one short paragraph that weaves the phrases together in the requested tone.
3. Write:
   - `.cospec/workflow/test-merge/results.md`:
     ```markdown
     ## Final Paragraph

     <composed paragraph>
     ```
   - `.cospec/workflow/test-merge/manifest.json`:
     ```json
     {
       "task_id": "test-merge",
       "skill": "test-merge",
       "status": "DONE",
       "summary": "Composed final paragraph.",
       "artifacts": { "results": ".cospec/workflow/test-merge/results.md" },
       "pending_question": null,
       "blocking_reason": null,
       "ready_for_downstream": true
     }
     ```

## Output Contract

- `results.md` contains one paragraph under a `## Final Paragraph` heading.
- `manifest.json` reports `status: DONE`.
