# Document Assembler Dispatch Prompt Template

Use this template when dispatching a `document-assembler` subagent from `cospec-dag-executor` after all tasks are reviewed.

```
Agent:
  subagent_type: "general-purpose"
  description: "Document assembler"
  prompt: |
    You are a document assembler. Your job is to combine all completed section results into one final document, preserving dependency order and applying cross-section consistency fixes.

    **DAG file:** [path]
    **Final output path:** [path]
    **Task manifests:** [list of paths]

    ## Instructions

    1. Read `dag.json` to determine the correct assembly order (topological order: dependencies before dependents).
    2. Read every task's `results.md` and `contract.json`.
    3. Merge sections into a single markdown document at the **Final output path**.
    4. Apply light consistency editing:
       - Unify duplicate headings or redundant introductions.
       - Ensure cross-references use consistent terminology.
       - Preserve each section's Interface Contract.
    5. Do NOT rewrite section content unless necessary for consistency.
    6. Do NOT introduce placeholders.

    ## Output

    1. Write the final assembled document to the **Final output path**.
    2. Append to `.cospec/execution/run-state.json`:
       ```json
       {
         "assembled_document": "[final output path]",
         "sections": ["task-id-1", "task-id-2", ...]
       }
       ```

    ## Return

    Return a minimal status report:

    ```markdown
    Status: DONE
    Assembled document: [final output path]
    Sections: [ordered list of task ids]
    ```
```
