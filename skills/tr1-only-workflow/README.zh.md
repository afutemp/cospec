# TR1-Only Workflow

人类参考文档。

## 职责

当用户已有用户旅程或结构化需求，只想直接生成 TR1 时使用。本 workflow 只编排一个 leaf skill：`tr1-requirements-spec`。

## 触发条件

- 用户说「直接写 TR1」。
- 用户提供了用户旅程文档或结构化需求。
- `brainstorming` 根据已有材料路由到本 skill。

## 流程

1. 生成 `.cospec/runs/<RUN_DIR>/` 下的 DAG 产物。
2. 可选调用 `cospec-dag-evaluator`。
3. 调用 `cospec-dag-executor` 执行 `tr1-requirements-spec`。
4. 汇总产物路径。

## DAG

```text
tr1-requirements-spec
```

## 输出

TR1 文档路径。
