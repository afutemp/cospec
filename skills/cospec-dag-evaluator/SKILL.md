---
name: cospec-dag-evaluator
description: Use before executing a skill-level DAG plan — evaluates DAG acyclicity, skill references, task coverage, and placeholder contamination.
---

# cospec DAG Evaluator

**Skill 标识**: `cospec-dag-evaluator`

其他 skill 通过 `cospec-dag-evaluator` 引用本 skill。

评估 `cospec-dag-planner` 生成的 skill 级 DAG 计划质量，采用逐项检查扫描、加权评分和问题报告。

## When to Use

- `cospec-dag-planner` 生成计划后、执行前。
- Workflow entry skill 想确认 DAG 合法性。

## Input Contract

调用方传入 workflow 目录路径（例如 `.cospec/runs/<RUN_DIR>/`）。本 skill 读取：

- `index.md`
- `dag.json`
- `tasks/<task-id>.md`

## Output Contract

返回：

- 等级（A/B/C/D/F）和总分
- 红线状态（R1/R2/R3）
- 质量报告路径

质量报告写入：

```text
.cospec/runs/<RUN_DIR>/quality-reports/YYYY-MM-DD-cospec-dag-quality-report.md
```

## Evaluation Dimensions

### 维度 1: 结构完整性（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-STR-01 | `dag.json` 存在且可读 | Critical |
| COS-STR-02 | `index.md` 存在且包含 Workflow / Goal / Task DAG | Error |
| COS-STR-03 | 每个任务有 Source 注解 | Warning |
| COS-STR-04 | 每个任务有 Depends on 声明 | Error |
| COS-STR-05 | 每个任务有 Skill 字段 | Critical |
| COS-STR-06 | DAG 图已呈现 | Warning |

### 维度 2: DAG 正确性（权重 35%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-DAG-01 | DAG 是无环的 | Critical |
| COS-DAG-02 | 每个 `depends_on` 指向存在的 task id | Critical |
| COS-DAG-03 | 每个 task id 唯一 | Critical |
| COS-DAG-04 | 每个任务都有 `id`、`task_file`、`depends_on`、`produces` | Error |
| COS-DAG-05 | 每个 `task_file` 路径对应文件存在 | Error |
| COS-DAG-06 | `Skill` 字段对应的 `skills/<name>/SKILL.md` 存在 | Critical |

### 维度 3: 任务质量（权重 25%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-TSK-01 | 无占位符 | Critical |
| COS-TSK-02 | 验收标准存在且非空 | Error |
| COS-TSK-03 | Task Spec 具体明确 | Error |
| COS-TSK-04 | Required Output Artifacts 完整 | Error |
| COS-TSK-05 | Skill 名称不是占位符 | Error |

### 维度 4: 一致性（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-CNS-01 | DAG 中的依赖与 task card 中的 Depends on 一致 | Error |
| COS-CNS-02 | 交付物边界清晰 | Warning |
| COS-CNS-03 | 所有 workflow nodes 都出现在 DAG 中 | Error |

## 红线检查（一票否决 → F）

| 红线 | 检查内容 |
|---|---|
| R1 | DAG 存在循环依赖 |
| R2 | 发现任何占位符 |
| R3 | 任一 task card 缺少 Skill 字段或 Required Output Artifacts |

## 评分与决策

- Critical: -40
- Error: -20
- Warning: -8
- 每维度从 100 起扣，最低 0。
- A/B (≥80): 通过，进入执行。
- C (65–79): 修复 Error+ 后重评。
- D/F: 返工。

## Red Flags

- Do NOT evaluate from memory; always read the actual files.
- Do NOT skip red-line checks.
- Do NOT return a grade without a written report.
