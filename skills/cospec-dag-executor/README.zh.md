# cospec DAG Executor

人类参考文档。

## 职责

读取 `cospec-dag-planner` 生成的 `dag.json`，以 orchestrator-only 主 Agent 的方式调度文档片段撰写子 Agent，执行 ready-set 并行调度，最后合并成完整文档。

## 输入

Plan 目录路径，例如 `.cospec/plans/YY-MM-DD-<project>/`。

## 输出

```text
.cospec/
  execution/
    run-state.json
    time-stats.log
  tasks/
    <task-id>/
      manifest.json
      results.md
      contract.json
      changed-files.txt
      review-quality.md
  outputs/
    <stage>/
      <document-name>.md
```

## 调度规则

- 任务就绪条件：所有 `depends_on` 的 manifest 状态为 `DONE` 且 `ready_for_downstream=true`。
- 同一 ready set 中的独立任务可并行调度。
- 每批数量不超过 `cospec.config.json` 中的 `parallel.max_parallel_tasks`。
- 每个完成的任务必须经过 `document-reviewer` 门控。
- 所有任务完成后由 `document-assembler` 合并。

## 状态

`DONE`、`DONE_WITH_CONCERNS`、`NEEDS_CONTEXT`、`BLOCKED`、`FAILED`。

## 注意

- 主 Agent 不直接写文档片段。
- 不向子 Agent 粘贴大段正文，只传 artifact paths。
- 必须记录 `T_EXEC_START` 和 `T_FIRST_COMPLETE`。
