# cospec DAG Evaluator

人类参考文档。

## 职责

评估 skill 级 DAG 计划质量：检查无环性、skill 引用是否存在、task card 结构、占位符等。

## 输入

Workflow 目录路径，例如 `.cospec/runs/<RUN_DIR>/`。

## 输出

质量报告路径：

```text
.cospec/runs/<RUN_DIR>/quality-reports/YYYY-MM-DD-cospec-dag-quality-report.md
```

## 评估维度

- 结构完整性（20%）
- DAG 正确性（35%）
- 任务质量（25%）
- 一致性（20%）

## 红线

- R1：循环依赖
- R2：占位符
- R3：缺少 Skill 字段或 Required Output Artifacts

## 注意

- 必须从实际文件读取。
- 不能跳过红线检查。
- 必须输出书面报告。
