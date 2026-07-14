# cospec DAG Evaluator

人类参考文档。

## 职责

评估 `cospec-dag-planner` 生成的 DAG 计划质量，检查 DAG 无环性、任务结构、占位符、验收标准、一致性等。

## 输入

Plan 目录路径，例如 `.cospec/plans/YY-MM-DD-<project>/`。

## 输出

质量报告路径：

```text
.cospec/plans/YY-MM-DD-<project>/quality-reports/YYYY-MM-DD-cospec-plan-quality-report.md
```

返回：等级（A/B/C/D/F）、总分、红线状态、报告路径。

## 评估维度

- 结构完整性（20%）
- DAG 正确性（35%）
- 任务质量（25%）
- 一致性（20%）

## 红线

- R1：DAG 存在循环依赖
- R2：出现占位符
- R3：任务缺少验收标准

## 决策规则

- A/B (≥80)：进入执行
- C (65–79)：修复 Error+ 后重评，最多 2 轮
- D/F：返工后重评，最多 2 轮

## 注意

- 必须从实际文件读取，不能凭记忆评估。
- 不能跳过红线检查。
- 必须输出书面报告。
