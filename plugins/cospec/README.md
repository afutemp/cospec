# cospec Plugin

适用于 Claude Code 及兼容 AI Agent 的 AI 原生产品规划工作流插件。以 `brainstorming` 为唯一入口，按需求规模路由到**大需求**或**小需求**两条工作流，串联需求澄清、共创/客户/竞品研究、用户旅程设计、TR1 需求说明书；大需求进一步产出 TR2（EPIC/Feature/Story/Tech）。

## 工作流路由

`brainstorming` 按需求规模路由到 workflow entry skill，后者在主会话中串行调用各 leaf skill：

```
用户意图 ──→ brainstorming ──→ { large-requirement-workflow | small-requirement-workflow } ──→ 串行调用 leaf skills
```

| 用户状态 | 路由 | 说明 |
|---------|------|------|
| 大需求：需要共创/客户/竞品研究，或要 TR2 产物；范围大、"想全面" | → `large-requirement-workflow` | 澄清 → 研究（5 串行）→ 旅程 → TR1 → TR2 |
| 小需求：范围聚焦、无需研究/竞品、到 TR1 即止 | → `small-requirement-workflow` | 澄清 → 旅程 → TR1 |
| 无法判断 | → `large-requirement-workflow` | 默认大需求管线 |

## 流水线阶段明细

大需求工作流为完整 5 阶段；小需求工作流仅含阶段 1、3、4（无研究、无 TR2）。

| # | 阶段 | Skill | 核心产物 |
|---|------|------|----------|
| 1 | **需求澄清** | `product-planning-requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、3-5 条核心共识） |
| 2 | **研究/分析**（仅大需求，5 个串行） | `co-create-customer-minutes-analysis` / `customer-experience-feedback-analysis-v2` / `competitor-feature-research` / `competitor-pain-points` / `competitor-problem-solving` | 共创验证报告 / 客户体验反馈报告 / 竞品分析报告 |
| 3 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） |
| 4 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） |
| 5 | **TR2 产物**（仅大需求） | `tr2-epic-creator` / `tr2-feature-creator` / `tr2-story-creator` / `tr2-tech-creator` | EPIC / Feature / Story / Tech 需求文档（可追溯至 TR1 AI 上下文版） |

## 安装

### Claude Code 插件方式

```bash
# 添加插件市场（仓库根即为 marketplace）
/plugin marketplace add git@github.com:afutemp/cospec.git

# 安装插件
/plugin install cospec
```

### Codex 插件方式

在 ChatGPT desktop app 的 Codex 中：

1. 添加 marketplace（仓库根即为 marketplace）：
   ```bash
   codex plugin marketplace add git@github.com:afutemp/cospec.git
   # 或本地路径
   codex plugin marketplace add /path/to/cospec
   ```
   或手动创建仓库根的 `.agents/plugins/marketplace.json`（参考 `.codex/INSTALL.md`）。
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
| `brainstorming` | 中央路由器：评估规划阶段，选择 workflow entry skill |
| `large-requirement-workflow` | 大需求工作流编排器：串行调用 12 个 leaf skill（澄清 → 研究 → 旅程 → TR1 → TR2） |
| `small-requirement-workflow` | 小需求工作流编排器：串行调用 3 个 leaf skill（澄清 → 旅程 → TR1） |
| `product-kb-query` | 产品知识库查询：按需为 leaf skills 注入知识库上下文 |
| `download-kb` | 下载预置知识库到当前工作目录（当前支持 `vdi`） |
| `product-planning-requirement-clarification` | 需求澄清：原始想法 → "想全面"的澄清结果 |
| `co-create-customer-minutes-analysis` | 共创客户纪要分析（验证报告） |
| `customer-experience-feedback-analysis-v2` | 客户使用体验反馈分析 |
| `competitor-feature-research` | 资料收集型竞品分析 |
| `competitor-pain-points` | 痛点收集型竞品分析 |
| `competitor-problem-solving` | 问题求解型竞品分析 |
| `user-journey-design` | 用户旅程设计：分阶段状态机确认流程 |
| `tr1-requirements-spec` | TR1 用户需求说明书生成（大/小需求，评审版 + AI 上下文版） |
| `tr2-epic-creator` | TR2 EPIC 生成 |
| `tr2-feature-creator` | TR2 Feature 生成 |
| `tr2-story-creator` | TR2 Story 生成 |
| `tr2-tech-creator` | TR2 Tech 需求生成 |
| `cospec-configure` | 交互式配置：设置 project info、模板、默认 workflow 等 |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |

## 扩展与接入

需要调整工作流、新增 Skill 或集成自己的模板？请参考 [docs/INTEGRATION.md](docs/INTEGRATION.md)。

## 许可证

MIT
