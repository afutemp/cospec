# cospec Plugin

适用于 Claude Code 及兼容 AI Agent 的 AI 原生产品规划工作流插件。以 `brainstorming` 为唯一入口，一条主链串联需求澄清、用户旅程设计与 TR1 需求说明书生成。

## 工作流路由

一条主链，按节点进入：

```
用户意图 ──→ brainstorming ──→ requirement-clarification ──→ user-journey-design ──→ tr1-requirements-spec
```

| 用户状态 | 进入节点 | 说明 |
|---------|---------|------|
| 原始想法、口头需求、"想全面" | → `requirement-clarification` | 从链头开始，走完整流程 |
| 已有清晰需求方向，无旅程设计 | → `user-journey-design` | 跳过澄清，从旅程开始 |
| 已有旅程文档 / 结构化需求 / 直出 TR1 | → `tr1-requirements-spec` | 跳过前两阶段，直出 TR1 |

## 流水线阶段明细

| # | 阶段 | 入口 | 核心产物 | 结束标识 |
|---|------|------|----------|----------|
| 1 | **需求澄清** | `requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、3-5 条核心共识） | 用户确认澄清结果充分 |
| 2 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） | 用户确认 Step 0/1/2/3 全部通过 |
| 3 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） | 用户确认文档内容 |

## 安装

### Claude Code 插件方式

```bash
# 添加插件市场
/plugin marketplace add git@github.com:afutemp/cospec.git

# 安装插件
/plugin install cospec
```

### Codex 插件方式

在 ChatGPT desktop app 的 Codex 中：

1. 添加 marketplace：
   ```bash
   codex plugin marketplace add ./
   ```
   或手动创建 `.agents/plugins/marketplace.json`（参考 `.codex/INSTALL.md`）。
2. 在 ChatGPT desktop app 中打开 **Plugins**，选择 cospec marketplace，安装并启用 **cospec**。
3. 重启 Codex。

详细说明见 `.codex/INSTALL.md`。

### 手动安装

将 `hooks/hooks.json` 中的 hook 配置合并到项目的 `.claude/settings.json`。

## 配置

所有配置项均为**可选**。推荐使用 `cospec-configure` skill 进行交互式配置，它会将结果写入插件根目录的 `cospec.config.json`。

### `project.product`

**用途**：产品标识符。

**示例**（在 `cospec.config.json` 中）：
```json
"project": { "product": "SCP" }
```

## Skills 清单

| Skill | 职责 |
|-------|------|
| `using-spec-developer` | 入口点：指导如何使用 skill |
| `session-context` | 跨 compact/重启的会话状态持久化 |
| `brainstorming` | 中央路由器：评估规划阶段，选择 workflow entry skill |
| `product-planning-workflow` | 默认工作流编排器：编排完整产品规划管线 |
| `tr1-only-workflow` | 直出 TR1 工作流编排器 |
| `requirement-clarification` | 需求澄清：原始想法 → "想全面"的澄清结果 |
| `user-journey-design` | 用户旅程设计：4 阶段状态机确认流程 |
| `tr1-requirements-spec` | TR1 用户需求说明书生成（大/小需求，评审版 + AI 上下文版） |
| `cospec-configure` | 交互式配置：设置 project info、模板、默认 workflow 等 |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |
| `cospec-dag-planner` | DAG 计划生成：为 workflow entry skill 生成 `dag.json` 和 task cards |
| `cospec-dag-executor` | DAG 执行器：按 ready-set 并行调度 `skill-invoker` SubAgents |
| `cospec-dag-evaluator` | DAG 计划评估：检查 DAG 无环性、skill 引用、占位符等 |

## 扩展与接入

需要调整工作流、新增 Skill 或集成自己的模板？请参考 [docs/INTEGRATION.md](docs/INTEGRATION.md)。

## 许可证

MIT
