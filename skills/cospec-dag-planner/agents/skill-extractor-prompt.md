# Skill Extractor Dispatch Prompt Template

Use this template when dispatching a `skill-extractor` subagent from `cospec-dag-planner`.

```
Agent:
  subagent_type: "general-purpose"
  description: "Skill DAG extractor: [workflow_name]"
  prompt: |
    You are a skill DAG extraction specialist. Your job is to convert a workflow node definition into a skill-level DAG plan.

    **Workflow name:** [workflow_name]
    **Output directory:** `.cospec/runs/<RUN_DIR>/`
    **Nodes:**
    ```json
    [node definitions from caller]
    ```

    ## Instructions

    1. Read the node definitions.
    2. Verify each `skill` name corresponds to an existing skill in the `skills/` directory.
    3. Build the DAG edge list from `depends_on`.
    4. Detect any cycles.
    5. Write the plan artifacts.

    ## Output Artifacts

    Write the following files under `.cospec/runs/<RUN_DIR>/`:

    ```text
    index.md              # human-readable workflow overview
    dag.json              # machine-readable DAG
    tasks/<task-id>.md    # one task card per skill node
    ```

    ### index.md

    ```markdown
    # [Workflow Name] Skill DAG

    **Workflow:** [workflow_name]

    ## Scheduling artifacts
    - DAG: `.cospec/runs/<RUN_DIR>/dag.json`
    - Task cards: `.cospec/runs/<RUN_DIR>/tasks/`

    ## Task DAG
    ```mermaid
    graph TD
        [mermaid graph]
    ```

    ## Tasks

    ### [task-id]
    **Skill:** [skill-name]
    **Task card:** `.cospec/runs/<RUN_DIR>/tasks/[task-id].md`
    **Depends on:** [deps or "(none)"]
    **Produces manifest:** `.cospec/runs/<RUN_DIR>/[task-id]/manifest.json`
    ```

    ### dag.json

    ```json
    {
      "workflow": "[workflow_name]",
      "plan_file": ".cospec/runs/<RUN_DIR>/index.md",
      "tasks": [
        {
          "id": "[task-id]",
          "task_file": ".cospec/runs/<RUN_DIR>/tasks/[task-id].md",
          "depends_on": ["..."],
          "produces": [".cospec/runs/<RUN_DIR>/[task-id]/manifest.json"]
        }
      ]
    }
    ```

    ### Task card

    ```markdown
    # Task: [task-id]

    ## Skill
    [skill-name]

    ## Source
    [...]

    ## Depends on
    [...]

    ## Input Artifacts
    - [...]

    ## Task Spec
    [...]

    ## Interface Contract
    [...]

    ## Acceptance Criteria
    - [...]

    ## Required Output Artifacts
    - `.cospec/runs/<RUN_DIR>/[task-id]/manifest.json`
    - `.cospec/runs/<RUN_DIR>/[task-id]/results.md`
    ```

    ## Self-Check

    Before writing files, verify:
    - All task ids are unique.
    - All `depends_on` ids exist in the node list.
    - The DAG has no cycles.
    - Every task card has `Skill`, `Depends on`, `Task Spec`, `Required Output Artifacts`.
    - No placeholders.

    ## Return

    Return a minimal status report:

    ```markdown
    Status: DONE
    Plan directory: `.cospec/runs/<RUN_DIR>/`
    Tasks: [N]
    Task ids: [list]
    ```
```
