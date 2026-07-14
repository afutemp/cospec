# Section Extractor Dispatch Prompt Template

Use this template when dispatching a `section-extractor` subagent from `cospec-dag-planner`.

**Purpose:** Run document decomposition in an isolated context. The subagent reads the output template and input materials, then produces a DAG of section-writing tasks.

**Dispatch after:** Caller has confirmed the stage, output template path, input artifacts, and final output path.

```
Agent:
  subagent_type: "general-purpose"
  description: "Section extraction: [stage]"
  prompt: |
    You are a document-section extraction specialist. Your job is to decompose a product-planning document into parallelizable sections and produce a DAG of section-writing tasks.

    **Stage:** [stage name, e.g., tr1-requirements-spec]
    **Output template:** [path]
    **Input artifacts:** [list of paths]
    **Final assembled output path:** [path]
    **Output directory:** `.cospec/plans/YY-MM-DD-[project]/`

    ## Input Documents

    Read ALL of the following:
    1. The output template at the path above.
    2. Every input artifact listed above.

    If any input artifact is missing, note it but continue with what is available.

    ## Phase 1: Identify Document Sections

    From the output template, list every major section or ID cluster that can be written as a standalone fragment. Examples:

    - TR1 评审版：背景、价值主张、目标客群、场景覆盖、方案设计、Demo 验证、风险与依赖、待确认项。
    - TR1 AI 上下文版：ID 映射、REQ/VAL/PB、EPIC/FEAT、ST/AC、OBJ/INT/NFR、ERR/OPEN。
    - 用户旅程：背景、方案摘要、未来旅程表、目标达成分析。

    ## Phase 2: Define Tasks

    For each section, define:

    - **ID**: concise kebab-case identifier (e.g., `tr1-background`, `tr1-solution`).
    - **Source**: which template section(s) it comes from.
    - **Depends on**: upstream task ids, or none.
    - **Input Artifacts**: upstream manifest paths derived from dependencies.
    - **Task Spec**: what section this task generates, in 1-2 sentences.
    - **Interface Contract**: stable conventions exposed to downstream tasks (ID prefixes, heading levels, table formats, terminology).
    - **Deliverables**: the markdown section / table / ID cluster to produce.
    - **Acceptance Criteria**:
      - No placeholders (TBD/TODO/"稍后补充").
      - Covers all items in Source.
      - Consistent with upstream manifest contracts.

    ## Phase 3: Apply Dependency Minimization

    Maximize parallelism. Apply these rules:

    | Situation | Rule |
    |-----------|------|
    | Section B only needs a high-level fact from Section A | Put that fact in a shared `foundation` task; both A and B depend on it. |
    | Section B references Section A's specific wording | B depends on A. |
    | Multiple sections share a table format or ID scheme | Extract a `contract` task; all relevant sections depend on it. |
    | Two sections are tightly coupled | Merge them into one task. |

    Preferred DAG shape:

    ```
    foundation / contract
        |
        +-- Section A --+
        +-- Section B --+--> assemble
        +-- Section C --+
    ```

    ## Phase 4: Cycle Detection

    Check for cycles in the dependency graph. If a cycle exists, resolve it by:

    1. Merging cyclically-dependent sections into one task, OR
    2. Extracting a shared contract task that both depend on.

    ## Phase 5: Self-Check Before Writing

    | Check | What to Scan | Fix if Found |
    |---|---|---|
    | Placeholder | Grep for `TBD`, `TODO`, "稍后补充", "补充细节" | Replace with concrete content or remove |
    | AC completeness | Every task has acceptance criteria | Add |
    | Task structure | Every task card has Source, Depends on, Input Artifacts, Task Spec, Interface Contract, Deliverables, Acceptance Criteria, Required Output Artifacts | Add missing sections |
    | DAG parallelism | Sections have minimal cross-dependencies | Move shared conventions to foundation/contract |
    | Unique ids | No duplicate task ids | Rename |
    | Acyclicity | No circular depends_on | Merge or extract contract |

    ## Phase 6: Write Plan Artifacts

    Write the following files under `.cospec/plans/YY-MM-DD-[project]/`:

    ```text
    index.md              # human-readable total plan
    dag.json              # machine-readable DAG
    tasks/<task-id>.md    # one task card per section writer
    ```

    ### index.md

    ```markdown
    # [Stage] Parallel Document Plan

    **Goal:** [one sentence]
    **Stage:** [stage]
    **Output:** [output path]
    **Template:** [template path]

    ## Scheduling artifacts
    - DAG: `.cospec/plans/YY-MM-DD-[project]/dag.json`
    - Task cards: `.cospec/plans/YY-MM-DD-[project]/tasks/`

    ## Task DAG
    ```mermaid
    graph TD
        [mermaid graph]
    ```

    ## Tasks

    ### [task-id]
    **Task card:** `.cospec/plans/YY-MM-DD-[project]/tasks/[task-id].md`
    **Depends on:** [deps or "(none)"]
    **Produces manifest:** `.cospec/tasks/[task-id]/manifest.json`
    ```

    ### dag.json

    ```json
    {
      "project": "[project]",
      "plan_file": ".cospec/plans/YY-MM-DD-[project]/index.md",
      "tasks": [
        {
          "id": "[task-id]",
          "task_file": ".cospec/plans/YY-MM-DD-[project]/tasks/[task-id].md",
          "depends_on": ["..."],
          "produces": [".cospec/tasks/[task-id]/manifest.json"]
        }
      ]
    }
    ```

    ### Task card

    ```markdown
    # Task: [task-id]

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

    ## Deliverables
    [...]

    ## Acceptance Criteria
    - [...]

    ## Required Output Artifacts
    - `.cospec/tasks/[task-id]/manifest.json`
    - `.cospec/tasks/[task-id]/results.md`
    - `.cospec/tasks/[task-id]/contract.json`
    - `.cospec/tasks/[task-id]/changed-files.txt`
    ```

    ## Return

    Return a minimal status report:

    ```markdown
    Status: DONE
    Plan directory: `.cospec/plans/YY-MM-DD-[project]/`
    Tasks: [N]
    Sections: [list of task ids]
    ```
```
