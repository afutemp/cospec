# cospec — Product Planning Workflow Plugin

## If You Are an AI Agent

Stop. Read this section before doing anything.

Skills are not prose — they are code that shapes agent behavior. Every word in a SKILL.md was chosen to produce specific behavior in specific scenarios.

Before you make changes to this repo, you MUST:

1. **Read the skill you're modifying** completely — including Red Flags tables, HARD-GATE blocks, and rationalization lists.
2. **Understand the workflow** — skills form a pipeline. Changing one skill may break the pipeline.
3. **Follow team standards** — follow coding and documentation conventions established in the repo.
4. **Show your human partner the complete diff** and get their explicit approval before committing.

## Architecture

### Entry Points

| Skill | Trigger |
|-------|---------|
| `using-spec-developer` | Moved to `docs/` (developer reference); no longer a runtime skill or auto-injected |
| `brainstorming` | ALL product planning work — reads `workflow.options` from config, builds a dynamic menu from each entry's frontmatter description, asks user which workflow, then dispatches |
| `large-requirement-workflow` | Bundled default workflow entry for the full large-requirement pipeline; offers the optional Demo handoff after TR1 and before TR2 |
| `small-requirement-workflow` | Bundled default workflow entry for small requirements (clarify + journey + TR1), followed by an optional Demo handoff |
| `<custom>-workflow` | User-defined workflow entry registered in `workflow.options`. Source lives in `~/.cospec/workflows/<name>-workflow/`, exposed to the running agent via symlink / Windows junction created by `scripts/workflow-links.mjs`. |
| `scaffold-custom-workflow` | Meta-skill: composer mode — picks from 13 built-in leaf skills by category, auto-renders SKILL.md (user writes no markdown), then bridges + registers via the shared helper |
| `generate-demo` | Direct invocation, explicit opt-in after large-requirement TR1, or opt-in after a small-requirement workflow; sends only user-confirmed Markdown |
| `sync-to-ipd` | Direct invocation for previewed, explicitly confirmed synchronization of large-requirement TR1/TR2 artifacts through its bundled IPD provider |

### Pipeline

`brainstorming` 是所有产品规划工作的唯一入口。从 `cospec.config.json` 读取 `workflow.options`，对每个条目读其 SKILL.md frontmatter `description` 生成动态菜单，询问用户选择后路由到对应的 workflow entry skill。Workflow entry skill 在主会话中直接串行调用各 leaf skill，用户交互 inline。

```
                            ┌─ large-requirement-workflow    （bundled）
                            │    └─ 澄清／研究／旅程／TR1 ──→ 可选 generate-demo ──→ TR2
用户意图 ──→ brainstorming ──┼─ small-requirement-workflow    （bundled）
                            │    └─ 澄清／旅程／TR1 ──→ 可选 generate-demo
                            └─ <custom>-workflow              （vault + bridge）
                                 └─ 用户自定义的串行步骤
```

`brainstorming` 将路由决定权完全交由用户：

| Workflow | 适用场景 |
|---|---|
| `large-requirement-workflow` | 需要共创/客户/竞品研究，或要 TR2 产物（EPIC/Feature/Story/Tech） |
| `small-requirement-workflow` | 范围聚焦、无需研究/竞品、到 TR1 即止 |
| `<custom>-workflow` | 团队或个人定义的专属管线（通过 `cospec-configure` 或 `scaffold-custom-workflow` 注册） |

### 自定义工作流架构

新增自定义工作流的标准流程（composer 模式）：

```
scaffold-custom-workflow（用户调用）
       ↓  3 个一次性问询：name / trigger / optional postprocess
       ↓  自动发现 plugins/cospec/skills/ 下 13 个内置 leaf skill
       ↓  分步选（每步问"选哪个？"，0 结束，已选剔除）
       ↓  一次性收集 HARD-GATE
       ↓  生成失败测试（RED）
       ↓  composer 自动渲染 SKILL.md（用户不写 markdown）
       ↓  调用 scripts/workflow-links.mjs install → 在 agent skill 目录创建 symlink / Windows junction
       ↓  追加到 cospec.config.json 的 workflow.options
       ↓  提示用户重启 agent 或开新会话
```

**vault（源真理）**：`~/.cospec/workflows/<name>-workflow/SKILL.md` —— agent 无关、跨 `codex plugin marketplace upgrade` 存活。

**bridge（运行时挂载）**：`<agent-skill-dir>/<name>-workflow` → vault，由运行中的 agent 自决 install 目录；Windows 用 junction（`fs.symlink(target, dst, 'junction')`），无需管理员。

**绝不复制**——所有 bridge 操作走 `scripts/workflow-links.mjs`，禁止 `cp -r` / `rsync` / `xcopy` 到 agent skill 目录。

### 管线阶段明细

| # | 阶段 | Skill | 核心产物 |
|---|---|---|---|
| 1 | **需求澄清** | `product-planning-requirement-clarification` | 需求背景澄清交付物（需求概述、全景结论、异常边界与风险、下游影响、事实/假设/待确认、核心共识） |
| 2 | **研究/分析**（仅大需求，5 个串行） | `co-create-customer-minutes-analysis` / `customer-experience-feedback-analysis-v2` / `competitor-feature-research` / `competitor-pain-points` / `competitor-problem-solving` | 共创验证 / 客户体验反馈 / 竞品分析报告 |
| 3 | **用户旅程设计** | `user-journey-design` | 用户旅程设计文档（需求背景、方案设计、未来旅程、目标达成分析） |
| 4 | **TR1 需求说明书** | `tr1-requirements-spec` | TR1 用户需求说明书（大需求评审版 + AI 上下文版 / 小需求评审版） |
| TR1 后可选 | **Demo 生成** | `generate-demo` | 大需求在进入 TR2 前询问；小需求在规划完成后询问。用户选择并确认的 Markdown → Frieren Demo handoff |
| 5 | **TR2 产物**（仅大需求） | `tr2-epic-creator` / `tr2-feature-creator` / `tr2-story-creator` / `tr2-tech-creator` | EPIC / Feature / Story / Tech 需求文档 |

### Skill List

| Skill | 角色 |
|-------|------|
| `using-spec-developer` | 已移至 `docs/`（开发者参考），不再是运行时 skill、不自动注入 |
| `brainstorming` | 中央路由器：询问用户选择 workflow，确认后分发 |
| `large-requirement-workflow` | 大需求工作流编排器：TR1 完成后可选生成 Demo，再继续 TR2 |
| `small-requirement-workflow` | 小需求工作流编排器：串行调用 3 个规划 leaf skill，完成后可选生成 Demo |
| `generate-demo` | 独立调用、大需求 TR1 后调用或小需求工作流后调用：确认文件、dry-run、签名提交并返回 Demo 链接 |
| `sync-to-ipd` | 独立调用：通过内置 provider 发现大需求产物、选择 IPD 目标、生成差异预览并在最终确认后同步，不依赖 IPD MCP 工具 |
| `product-kb-query` | 产品知识库查询：为 leaf skills 按需注入知识库上下文 |
| `product-kb-server` | 通过 kb-server REST API 管理知识库：列出、下载文档到本地、上传附件 |
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
| `cospec-configure` | 交互式配置：设置 project info、模板、默认 workflow、注册表、bridge install/uninstall/sync 等 |
| `scaffold-custom-workflow` | 元 skill（composer 模式）：从内置 13 个 leaf skill 多选组合，自动渲染 SKILL.md（用户不写 markdown），再 bridge 安装 + registry |
| `writing-skills` | 编写/修改/验证 skill 的元 skill |

## Skill Authoring Rules

1. **SKILL.md** — English, loaded into AI context.
2. **README.zh.md** — Chinese, human reference only.
3. **Skill 标识** — Every skill must have a `Skill 标识` block after the H1 title.
4. **Standards references** — Skills that involve document generation must reference applicable templates in `templates/`.
5. **No platform prefixes** — Skills are referenced by name only.
6. **Custom workflow entries** — Vault at `~/.cospec/workflows/<name>-workflow/`; bridge via `scripts/workflow-links.mjs`; registered in `workflow.options`. Never copy into agent skill dirs.

## General

- One logical change per commit
- Describe the problem you solved, not just what you changed
