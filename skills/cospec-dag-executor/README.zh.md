# cospec DAG Executor

人类参考文档。

## 职责

读取 skill 级 DAG 计划（`.cospec/runs/<RUN_DIR>/dag.json`），以 orchestrator-only 主 Agent 的方式调度 `skill-invoker` SubAgent，执行 ready set 中的 skill，并处理 `NEEDS_CONTEXT` 错峰提问。

## 输入

Workflow 目录路径，例如 `.cospec/runs/<RUN_DIR>/`。

## 输出

```text
.cospec/runs/<RUN_DIR>/
  execution/
    run-state.json
    time-stats.log
  <task-id>/
    manifest.json
    results.md
```

## 核心规则

- 任务就绪：所有依赖 manifest 为 `DONE` 且 `ready_for_downstream=true`。
- 同一 ready set 中的独立任务可并行 dispatch。
- SubAgent 不能直接问用户，需返回 `NEEDS_CONTEXT`。
- 主 Agent 维护 question queue，一次只问一个。
- 回答后，把答案路由回对应 SubAgent。

## 状态

`RUNNING`、`NEEDS_CONTEXT`、`DONE`、`FAILED`、`BLOCKED`。

## 注意

- 主 Agent 不直接执行 leaf skill。
- 不向 SubAgent 粘贴大段正文，只传 artifact paths。
- 必须记录 `T_EXEC_START` 和 `T_FIRST_COMPLETE`。
- **runs 产物保留，不自动删除**；仅在用户明确要求时手动 `rm -rf .cospec/runs/`。
