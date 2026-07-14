---
name: cospec-dag-evaluator
description: Use before executing a cospec DAG plan — evaluates plan quality, DAG acyclicity, task coverage, and placeholder contamination.
---

# cospec DAG Evaluator

**Skill 标识**: `cospec-dag-evaluator`

其他 skill 通过 `cospec-dag-evaluator` 引用本 skill。

评估 `cospec-dag-planner` 生成的 DAG 计划质量，采用逐项检查扫描、加权评分和问题报告。

## When to Use

- `cospec-dag-planner` 生成计划后、执行前。
- 配置中 `parallel.evaluator` 指向本 skill 时，由 `product-planning-workflow` 或调用方自动调度。
- 手动检查一个 DAG 计划是否可执行。

## Input Contract

调用方传入 plan directory path（例如 `.cospec/plans/YY-MM-DD-<project>/`）。本 skill 读取：

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
.cospec/plans/YY-MM-DD-<project>/quality-reports/YYYY-MM-DD-cospec-plan-quality-report.md
```

## Evaluation Dimensions

### 维度 1: 结构完整性（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-STR-01 | `dag.json` 存在且可读 | Critical |
| COS-STR-02 | `index.md` 存在且包含 Goal/Stage/Output/Template | Error |
| COS-STR-03 | 每个任务有 Source 注解 | Warning |
| COS-STR-04 | 每个任务有 Depends on / Depended by 声明 | Error |
| COS-STR-05 | 每个任务有 Deliverables | Error |
| COS-STR-06 | 每个任务有 Interface Contract | Error |
| COS-STR-07 | DAG 图已呈现（Mermaid 或 DOT） | Warning |

### 维度 2: DAG 正确性（权重 35%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-DAG-01 | DAG 是无环的 | Critical |
| COS-DAG-02 | 每个 `depends_on` 指向存在的 task id | Critical |
| COS-DAG-03 | 每个 task id 唯一 | Critical |
| COS-DAG-04 | 每个任务都有 `id`、`task_file`、`depends_on`、`produces` | Error |
| COS-DAG-05 | 每个 `task_file` 路径对应文件存在 | Error |
| COS-DAG-06 | 任务按依赖顺序排列 | Warning |

### 维度 3: 任务质量（权重 25%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-TSK-01 | 无占位符：不得出现 TBD / TODO / "稍后补充" / "补充细节" | Critical |
| COS-TSK-02 | 验收标准存在且非空 | Error |
| COS-TSK-03 | Task Spec 具体明确 | Error |
| COS-TSK-04 | Interface Contract 具体 | Error |
| COS-TSK-05 | Deliverables 可识别 | Error |

### 维度 4: 一致性（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| COS-CNS-01 | 同一概念跨任务引用时术语一致 | Warning |
| COS-CNS-02 | 交付物边界清晰，不重复 | Error |
| COS-CNS-03 | 包含最终的 assemble 任务 | Error |
| COS-CNS-04 | DAG 中的依赖与 task card 中的 Depends on 一致 | Error |

## 红线检查（一票否决 → F）

| 红线 | 检查内容 |
|---|---|
| R1 | DAG 存在循环依赖 |
| R2 | 发现任何 TBD / TODO / "稍后补充" / "补充细节" |
| R3 | 任一任务缺少验收标准部分，或该部分为空 |

## 评分权重

| 维度 | 权重 |
|---|---|
| 结构完整性 | 20% |
| DAG 正确性 | 35% |
| 任务质量 | 25% |
| 一致性 | 20% |

### 扣分规则

| 严重程度 | 每问题扣分 |
|---|---|
| Critical | -40 分 |
| Error | -20 分 |
| Warning | -8 分 |

每维度从 100 分起，最低 0 分。

### 总分计算

总分 = 结构完整性×20% + DAG 正确性×35% + 任务质量×25% + 一致性×20%

| 总分 | 等级 | 含义 |
|---|---|---|
| 95-100 | A | 优秀 — 可进入执行 |
| 80-94 | B | 良好 — 可进入执行 |
| 65-79 | C | 勉强 — 必须修复所有 Error + Critical 后重新评估 |
| <65 | D | 不合格 — 需大幅返工 |
| 红线违规 | F | 直接失败 |

## Decision Rules

- **A 或 B (≥ 80)** → 计划就绪，进入执行交接。
- **C (65–79)** → 修复报告中所有 Error + Critical，重新调度本 evaluator，最多 2 轮。
- **D (< 65) 或 F** → 返回 `cospec-dag-planner` 大幅返工，最多 2 轮。

## Workflow

1. 读取 `dag.json` 和所有 task cards。
2. 逐项扫描检查项。
3. 执行红线检查。
4. 计算各维度得分和总分。
5. 生成质量报告。
6. 返回等级、总分、红线状态、报告路径。

## Report Structure

```markdown
# DAG 计划质量评估报告

**计划:** [plan directory]
**日期:** YYYY-MM-DD
**等级:** [A/B/C/D/F] - [分数]/100

---

## I. 红线结果

| 红线 | 状态 | 详情 |
|---|---|---|
| R1 循环依赖 |   /   | [详情] |
| R2 占位符 |   /   | [详情] |
| R3 验收标准 |   /   | [详情] |

---

## II. 评分概览

| 维度 | 权重 | 得分 | 扣分项 |
|---|---|---|---|
| 结构完整性 | 20% | [N]/100 | [...] |
| DAG 正确性 | 35% | [N]/100 | [...] |
| 任务质量 | 25% | [N]/100 | [...] |
| 一致性 | 20% | [N]/100 | [...] |
| **加权总分** | 100% | **[N]** | |

---

## III. 问题列表

### Critical
[ISSUE-XXX] 文档/位置/规则/引用/描述/修复方向

### Error
[...]

### Warning
[...]

---

## IV. 改进建议

1. **[最高]** 修复 Critical 问题
2. **[高]** 修复 Error 问题
3. **[中]** 修复 Warning 问题

---

## V. 下一步

- A/B (>= 80): 进入执行交接
- C (65-79): 修复 Error+ 问题，重新评估（最多 2 轮）
- D (< 65) 或 F: 返工后重新评估（最多 2 轮）
```

## Red Flags

- Do NOT perform the evaluation from memory; always read the actual `dag.json` and task cards.
- Do NOT skip the red-line check even if the dimensional score is high.
- Do NOT return a grade without a written report.
