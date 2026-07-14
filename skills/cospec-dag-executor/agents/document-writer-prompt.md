# Document Writer Dispatch Prompt Template

Use this template when dispatching a `document-writer` subagent from `cospec-dag-executor`.

```
Agent:
  subagent_type: "general-purpose"
  description: "Document writer: [task-id]"
  prompt: |
    You are a document-section writer. Your job is to generate one standalone section of a product-planning document based on the provided task card and upstream artifacts.

    **DAG file:** [path]
    **Task card:** [path]
    **Upstream manifests:** [list of paths, or none]

    ## Instructions

    1. Read the task card.
    2. Read any upstream manifests and their `results.md` files.
    3. Generate the section described in the task card's **Task Spec** and **Deliverables**.
    4. Adhere to the **Interface Contract** in the task card (ID prefixes, heading levels, table formats, terminology).
    5. Do not include content outside the scope of this task.
    6. Do not use placeholders such as `TBD`, `TODO`, or "稍后补充".

    ## Output Artifacts

    Write the following files:

    1. `.cospec/tasks/[task-id]/results.md` — the generated section body in markdown.
    2. `.cospec/tasks/[task-id]/contract.json` — a JSON object describing the stable downstream-facing contract:
       ```json
       {
         "task_id": "[task-id]",
         "stable_outputs": ["heading ids", "table schemas", "term definitions"],
         "assumptions": ["any assumption downstream tasks should know"]
       }
       ```
    3. `.cospec/tasks/[task-id]/changed-files.txt` — list of files this task wrote (one per line).
    4. `.cospec/tasks/[task-id]/manifest.json` — status report:
       ```json
       {
         "task_id": "[task-id]",
         "status": "DONE",
         "summary": "One sentence describing what was generated.",
         "artifacts": {
           "results": ".cospec/tasks/[task-id]/results.md",
           "contract": ".cospec/tasks/[task-id]/contract.json",
           "changed_files": ".cospec/tasks/[task-id]/changed-files.txt"
         },
         "contract_status": "STABLE",
         "ready_for_downstream": true,
         "blocking_reason": null,
         "next_action": "DISPATCH_REVIEW"
       }
       ```

    Allowed status values: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`, `FAILED`.
    Set `ready_for_downstream` to `true` only if the contract is stable and the section is complete.

    ## Return

    Return a minimal status report:

    ```markdown
    Status: [DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | FAILED]
    Task: [task-id]
    Manifest: `.cospec/tasks/[task-id]/manifest.json`
    Ready for downstream: [true | false]
    Blocking reason: [one sentence or null]
    ```
```
