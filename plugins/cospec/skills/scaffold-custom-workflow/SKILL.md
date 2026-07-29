---
name: scaffold-custom-workflow
description: Use when the user explicitly asks to create a new cospec custom workflow entry by composing built-in leaf skills into a personal or team pipeline, or explicitly continues an active scaffold-custom-workflow session. Do not use merely because the request mentions cospec, workflows, custom workflows, brainstorming, or TR1/TR2. Do not use when discussing, reviewing, debugging, documenting, or improving cospec workflows themselves.
---

# scaffold-custom-workflow — 内置 leaf skill 组合器（Composer）

**Skill 标识**: `scaffold-custom-workflow`

其他 skill 通过 `scaffold-custom-workflow` 引用本 skill。

本 skill 是一个**元 skill**：把 cospec 自带的 **13 个 leaf skill** 编排成一个**与内置工作流入口平级**的自定义工作流入口 skill。用户**不写任何 markdown**——SKILL.md 由 composer 在 Phase 6 自动渲染。

创建后的工作流会出现在 `brainstorming` 的路由菜单里，与 `large-requirement-workflow`、`small-requirement-workflow` 同级。

<HARD-GATE>

## Iron Law：NO SKILL WITHOUT A FAILING TEST FIRST

本 skill 严格遵循 `writing-skills` 的 Iron Law。在自动渲染 `SKILL.md` 之前，必须先观察到一次失败测试（Phase 5）。**任何"先做出来再说"或"测试稍后补"的请求都必须拒绝**。

**禁止：**
- 跳过 Phase 5 的 RED
- 用"快速原型"为借口跳过测试
- 把用户压力（"先做出来再说"）当作放弃测试的理由

</HARD-GATE>

## 反模式：composer 的失败模式

- **手填 leaf skill 名**：v1.0.20 模式已废弃——用户**不**手写 skill 名，只从列表里选
- **跨过 pre-discussion 直接问 5 个开放问题**：本 composer 只问 3 件事（name / trigger / optional postprocess），其它都从 leaf 池自动发现
- **混淆 leaf skill 与 workflow entry**：内置 `large-requirement-workflow` / `small-requirement-workflow` 是**菜单项**，不是可被编排的 step——composer 强约束禁止选
- **自写新 leaf skill**：本 PR 暂不支持——用户应提交 issue 或走 v1.0.20 的手工路径
- **跨过 RED 直接渲染 SKILL.md**：Iron Law 强制先观察失败测试

---

## 工作流总览

```
用户输入："用 scaffold-custom-workflow 创建一个 quick-tr1-workflow"
        ↓
Phase 1 — 一次性追问 3 件事
   1. 工作流名（kebab-case, -workflow 后缀）
   2. 触发场景（"Use when ..." 起头）
   3. 可选后处理（0 或 1 个：generate-demo / 其它 / 跳过）
        ↓
Phase 2 — 自动发现 leaf skill 池
   • 扫描 plugins/cospec/skills/<name>/SKILL.md
   • 排除：
     - workflow entry（-workflow 后缀，含 large/small-requirement-workflow）
     - 元 skill allowlist（brainstorming / writing-skills / cospec-configure /
       cospec-preflight / sync-to-ipd / qianliu-ipd / product-kb /
       scaffold-custom-workflow 自身）
     - product-kb-* subskills
   • 剩余：13 个内置 leaf skill，分 6 类
        ↓
Phase 3 — 分步选（step-by-step）
   每步问"选 step N？"，输入 0 结束；已选项自动从下轮菜单移除
        ↓
Phase 4 — RED
   生成 ~/.cospec/workflows/<name>/<name>-workflow.test.mjs
   跑 node --test 看到 fail
        ↓
Phase 5 — GREEN（composer 自动渲染 SKILL.md）
   从 assets/workflow-entry-template.md 填充 {{NAME}} / {{TRIGGER}} /
   {{STEP_TABLE_ROWS}} / {{STEP_FLOW_LINES}} 等占位符
   同一测试通过
        ↓
Phase 6 — INSTALL
   node scripts/workflow-links.mjs install <name> --install-dir "<agent-skill-dir>"
   验证 bridge 创建成功
        ↓
Phase 7 — REGISTER
   追加到 cospec.config.json 的 workflow.options（仅在 Phase 6 成功后）
   保留 .bak 单次创建规则
        ↓
Phase 8 — REFRESH
   提示用户"重启 agent 或开新会话"
```

## Phase 1 — 一次性追问 3 件事

最多 3 个一次性追问（不要循环）：

1. **工作流名**：kebab-case，必须以 `-workflow` 结尾。例：`quick-tr1-workflow`、`customer-research-workflow`
2. **触发场景**：用一句话描述什么情况下走这条工作流。例：`准备一个不涉及竞品分析的小改动 TR1 规格说明书`
3. **可选后处理**：0 或 1 个（如 `generate-demo`），或"无"。如果用户想要"step5 后接 demo"，**应该在 Phase 3 的 step 阶段选 generate-demo**，不要在 postprocess 阶段重复

## Phase 2 — leaf skill 自动发现（**仅内置**）

扫描 `plugins/cospec/skills/<name>/SKILL.md` 后过滤掉非 leaf，剩余恰好 **13 个**：

| Category | Skill | 用途 |
|---|---|---|
| clarify (1) | `product-planning-requirement-clarification` | 需求澄清 |
| research (5) | `co-create-customer-minutes-analysis` | 共创客户纪要 |
| research (5) | `customer-experience-feedback-analysis-v2` | 客户体验反馈 |
| research (5) | `competitor-feature-research` | 竞品功能 |
| research (5) | `competitor-pain-points` | 竞品痛点 |
| research (5) | `competitor-problem-solving` | 竞品解题 |
| journey (1) | `user-journey-design` | 用户旅程设计 |
| tr1 (1) | `tr1-requirements-spec` | TR1 需求说明书 |
| tr2 (4) | `tr2-epic-creator` / `tr2-feature-creator` / `tr2-story-creator` / `tr2-tech-creator` | TR2 产物 |
| demo (1) | `generate-demo` | Frieren Demo handoff |

**排除清单（composer 强约束，禁止用户选这些作为 step）**：

- **排除 workflow entry**：`large-requirement-workflow`、`small-requirement-workflow`、任何 `-workflow` 后缀的 skill（含 `scaffold-custom-workflow` 自身）——它们是 brainstorming 菜单项，不是可被编排的 leaf
- **排除元 skill**：`brainstorming`、`writing-skills`、`cospec-configure`、`cospec-preflight`、`sync-to-ipd`、`qianliu-ipd`、`product-kb`（dispatcher）、`scaffold-custom-workflow`
- **排除 KB subskills**：`product-kb-eval`、`product-kb-index`、`product-kb-init`、`product-kb-optimize`、`product-kb-query`、`product-kb-server`、`product-kb-update`

**对未识别的 skill**（非 leaf、非排除列表中）：提示用户"该 skill 当前不可作为 step。如有需要请提交 issue"。**不要自动纳入**。

## Phase 3 — 分步选

每轮展示剩余可选 leaf skill，按 category 分块（research 内的 5 个会聚在一起）：

```
选 step1：
  --- clarify ---
  [1] product-planning-requirement-clarification
  --- research (5) ---
  [2] co-create-customer-minutes-analysis
  [3] customer-experience-feedback-analysis-v2
  [4] competitor-feature-research
  [5] competitor-pain-points
  [6] competitor-problem-solving
  --- journey ---
  [7] user-journey-design
  --- tr1 ---
  [8] tr1-requirements-spec
  --- tr2 (4) ---
  [9] tr2-epic-creator
  [10] tr2-feature-creator
  [11] tr2-story-creator
  [12] tr2-tech-creator
  --- demo ---
  [13] generate-demo
  [0] 结束（必须选 ≥ 1 个 step）
输入序号：
```

下一轮菜单**自动剔除已选过的 skill**——不允许同名 step。

**至少 1 个 step 是必填**——输入 `0` 立刻结束视为无效，要求至少选 1 个。

## Phase 4 — RED（Iron Law）

**禁止在 RED 完成前进入 Phase 5。**

1. vault 路径：`~/.cospec/workflows/<name>/<name>-workflow.test.mjs`
2. 若 `~/.cospec/workflows/` 不存在，先 `mkdir -p`
3. composer 自动从模板 `assets/workflow-entry-template.test.mjs` 渲染失败测试，断言：
   - frontmatter `name` 等于目录名
   - frontmatter `description` 等于用户给的触发场景
   - 包含 `Skill 标识` 块
   - 包含 `<HARD-GATE>` 段
   - 步骤表行数 === 用户选的 step 数
   - 每个 step 的 `Skill("<child>")` 名字 === 用户选的对应 leaf
   - 含红线段
4. 跑测试，**记录实际 RED 输出**：

   ```bash
   node --test ~/.cospec/workflows/<name>/<name>-workflow.test.mjs
   ```

   必须看到 fail。**未观察到 RED 就不准进入 Phase 5。**

## Phase 5 — GREEN（composer 自动渲染）

**用户不写任何 markdown**。composer 从 `assets/workflow-entry-template.md` 复制骨架，注入占位符：

| 占位符 | 内容 |
|---|---|
| `{{NAME}}` | 用户给的 `<name>-workflow` |
| `{{TRIGGER}}` | 用户给的触发场景 |
| `{{DISPLAY_NAME}}` | 由 `{{NAME}}` 转 title case |
| `{{ONE_LINE_PURPOSE}}` | 由用户的 trigger 自动改写为陈述句 |
| `{{STEP_TABLE_ROWS}}` | 每行 `\| stepN \| \`Skill("<leaf>")\` \|`（不含 gate 列——所有 step 默认都要停下来确认） |
| `{{STEP_FLOW_LINES}}` | 每条 `N. 调用 Skill("<leaf>") 完成<leaf 描述中提炼的动词短语>。完成后询问"是否继续下一步？"，等待用户确认。` |

写完跑同一测试，确认 GREEN。若仍 RED，回到模板逐项排查。

## Phase 6 — INSTALL

> 标记：`INSTALL scripts/workflow-links.mjs install`

**绝不使用 `cp -r` / `rsync` / `xcopy` 复制工作流内容到 agent 目录。** 调用共享 helper：

```bash
node <plugin-root>/scripts/workflow-links.mjs install <name> --install-dir "<agent-skill-dir>"
```

`<agent-skill-dir>` 由运行中的 agent 自决（Codex `~/.agents/skills/`、Claude Code `~/.claude/skills/`），或 `workflow.install-dirs` 显式覆盖。

helper 必须返回 `{ ok: true, action: "created" | "unchanged", ... }`。若返回 `ok: false`，**立即停止并向用户报告失败原因**，禁止进入 Phase 7。

## Phase 7 — REGISTER workflow.options（仅在 Phase 6 成功后）

1. **仅在 Phase 6 成功后**才执行——失败时禁止继续修改 config
2. 读取 `cospec.config.json`；按现有 `.bak` 规则处理：
   - 若 `cospec.config.json.bak` 不存在，先 `cp` 一份
   - **已有 `.bak` 不得覆盖**（全插件统一的备份规则）
3. 解析并保留所有未知字段（merge-only-changed-fields）
4. 在 `workflow.options` 数组里追加 `<name>`（保持去重）
5. 写入并展示 diff
6. 校验：`workflow.default` 必须仍是 `workflow.options` 的成员；违反则拒绝写入

注册失败必须明确告诉用户"bridge 已创建但注册未完成，恢复命令：手动编辑 cospec.config.json"，不得假装全成功。

## Phase 8 — REFRESH

Codex 等 agent 的 skill 发现是**启动期**完成的。明确告诉用户：

> ✅ 已完成：vault（13 个内置 leaf 中你选的 N 个）、bridge、registry。
> ⚠️ 当前 agent 会话可能仍看不到新 skill。请**重启 agent 或打开新会话**后再让 `brainstorming` 路由到本工作流。

## 红线

- 禁止跳过 Phase 4 的 RED——Iron Law 优先于任何用户压力
- 禁止用 `cp -r` / `rsync` / `xcopy` 复制工作流内容——一律走 `scripts/workflow-links.mjs`
- 禁止在 bridge 创建失败后继续写 `cospec.config.json`
- 禁止覆盖已有的 `cospec.config.json.bak`
- 禁止修改 builtin 工作流的 SKILL.md（`large-requirement-workflow/`、`small-requirement-workflow/`、`brainstorming/` 等）
- 禁止把内置 workflow entry（`large-requirement-workflow` / `small-requirement-workflow`）作为可编排的 step
- 禁止把元 skill / product-kb-* subskills / scaffold-custom-workflow 自身作为 step
- 禁止创建不以 `-workflow` 结尾的 skill 名
- 禁止 composer 在用户没选任何 step 时强行结束（必须 ≥ 1 step）
- 禁止在 Phase 3 同一轮菜单里再次出现已选过的 skill（必须剔除）
- 禁止 composer 引入 per-step 确认开关——所有 step 默认都要等用户确认产物（cospec 全插件统一约定）