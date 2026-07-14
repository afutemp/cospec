# cospec DAG Planner

人类参考文档。

## 职责

将一次产品规划文档生成任务拆分为可并行执行的文档片段（section/chapter/ID cluster），生成 cospowers 风格的调度产物：

```text
.cospec/plans/YY-MM-DD-<project>/
  index.md
  dag.json
  tasks/<task-id>.md
```

## 何时使用

- 当前 stage 或子 skill 被配置为并行生成模式。
- 未来新增的 cospec 子 skill 需要把文档拆成多个部分并行产出。

## 输入

调用方提供：stage、output_template_path、input_artifacts、output_path、可选 decomposition_hint。

## 输出

人类可读的总计划、机器可读的 DAG、每个子 Agent 的 task card。

## 拆分维度

- by-chapter：按模板章节拆分。
- by-id-cluster：按 AI 上下文版的 ID 簇拆分。
- by-playbook：按用户旅程的 playbook 拆分。
- by-aspect：按需求澄清的方面拆分。

## 注意

- 本 skill 不直接执行，只负责生成计划产物。
- 必须包含最终的 assemble 任务。
- 产物中禁止出现 TBD/TODO 等占位符。
