# cospec DAG Planner

人类参考文档。

## 职责

把 workflow entry skill 定义的 leaf skill 节点和依赖关系，转换成 `cospec-dag-executor` 可执行的调度产物：

```text
.cospec/runs/<RUN_DIR>/
  index.md
  dag.json
  tasks/<task-id>.md
```

## 输入

workflow 名称、节点定义（task id → skill / depends_on / description）。

## 输出

人类可读的 workflow 总览、机器可读的 DAG、每个 skill-invoker 的 task card。

## 注意

- 本 skill 不直接执行，只生成计划产物。
- 必须保证 DAG 无环。
- 产物中禁止占位符。
