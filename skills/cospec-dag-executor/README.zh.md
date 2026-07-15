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
- SubAgent 不能直接问用户，需返回 `NEEDS_CONTEXT`（一次可携带多个**互相独立**的问题）。
- 主 Agent 维护 question queue，对用户**一次只问一个**问题。
- 同一个 `NEEDS_CONTEXT` 的多个问题全部答完后，主 Agent **重新派发一个前景 `skill-invoker` SubAgent**，把全部答案一次性注入 prompt，并指向该 task 自己的 `results.md`（已确认阶段会追加在那里，供新 SubAgent 续跑）；不是每问一次就 dispatch 一次，也不是用 `SendMessage` 唤醒之前已结束的 SubAgent。
- 依赖前面答案的问题（如「没有纪要才追问访谈」）不在本批，等新一轮 SubAgent 拿到答案后再返回新的 `NEEDS_CONTEXT`。
- **禁止后台派发 + 轮询 manifest**：所有 SubAgent 必须是前景调用并等待返回，不能写 Bash 轮询 `manifest.json` 等待后台 SubAgent 完成。

## 门禁识别（skill-invoker）

SubAgent 没有直达用户的通道。很多 leaf skill 当初是按"直接和用户对话"写的，其 SKILL.md 会出现"请确认…确认后进入下一步""输出必须以确认问题收尾""询问用户""不得进入下一阶段，除非用户确认"等措辞——**这些都是向用户索取输入**，SubAgent 必须翻译成 `NEEDS_CONTEXT` 返回，绝不自己问用户，也绝不静默跨过门禁。

- **产出 ≠ 完成**：skill 产出某阶段内容后以"请确认"结尾，不算完成；只要它在等用户确认才能继续，就是被用户输入阻塞 → 返回 `NEEDS_CONTEXT`。
- **分阶段/多门禁 skill**（如 `user-journey-design`、`competitor-problem-solving`）：每个门禁只产当前阶段、追加进 `results.md`、置 `ready_for_downstream=false` 并返回 `NEEDS_CONTEXT`；**同轮不得产出后续阶段**；被重派后先读自己 `results.md` 恢复已确认阶段再续跑，仅最终阶段置 `DONE`。
- **降级产出 / ⛔草稿逃生口不能绕过硬门禁**：task card 里"用户未提供 X → 降级产出"只管缺料和标注质量（证据不足/待确认/待验证），不能用来跳过确认门禁；skill 里"用户要求跳过才输出 ⛔草稿"前提是用户明确选跳过——必须先 `NEEDS_CONTEXT` 问用户是否接受 ⛔草稿，得到肯定答复后才能产出。

## 状态

`RUNNING`、`NEEDS_CONTEXT`、`DONE`、`FAILED`、`BLOCKED`。

## 注意

- 主 Agent 不直接执行 leaf skill。
- 不向 SubAgent 粘贴大段正文，只传 artifact paths。
- 必须记录 `T_EXEC_START` 和 `T_FIRST_COMPLETE`。
- **runs 产物保留，不自动删除**；仅在用户明确要求时手动 `rm -rf .cospec/runs/`。
