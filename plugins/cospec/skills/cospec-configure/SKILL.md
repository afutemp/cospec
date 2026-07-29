---
name: cospec-configure
description: Use when configuring cospec for a new project, or when the user wants to manage custom workflows — interactively guides replacement of templates, rules, evaluators, knowledge base, workflow defaults, and project info, plus install/uninstall/register/deregister/delete operations on custom workflow entries (vault + bridge + workflow.options). Writes to cospec.config.json in the plugin root. Do not use merely because the user mentions cospec; do not use for running cospec planning workflows (use brainstorming instead).
---

# cospec Configure

**Skill 标识**: `cospec-configure`

其他 skill 通过 `cospec-configure` 引用本 skill。

Interactive configuration wizard. Reads the current `cospec.config.json`, guides the user through replacing any built-in defaults with their own paths, skill names, or credentials, then writes the updated config back.

**This skill does NOT modify any skill files.** It only updates `cospec.config.json`. cospec skills read this file at runtime to override their built-in defaults.

---

## When to Use

- First time setting up cospec in a project
- Setting the product name for the current project
- Replacing built-in templates with team-specific versions
- Replacing built-in requirement checklists with team-specific rules
- Replacing built-in quality gate evaluators with team-specific evaluators
- Configuring knowledge base access or telemetry credentials
- Setting the default workflow entry skill

---

## Checklist

1. **Load current config** — The plugin root is 2 levels above this skill's base directory. Read `<plugin-root>/cospec.config.json`. Parse and display current values.
2. **Ask which category to configure** — Present a menu; user may configure one or all categories.
3. **Run the wizard for each selected category** — One question per field, provide recommended answer each time.
4. **Validate all provided values** — Verify file/directory paths exist before writing.
5. **Write updated config** — Merge changes into `cospec.config.json` and display a diff summary.
6. **Offer to continue** — Ask if the user wants to configure another category.

---

## Step 1: Display Current State

First, run the drift detector to surface any unrecovered custom workflows
(this works even when SessionStart hooks are unavailable, e.g. Codex):

```bash
HOME=$HOME node <plugin-root>/hooks/lib/check-vault-drift.mjs <plugin-root>
```

The output is one of:

- `⚠️ cospec vault drift 检测：...` — vault workflows not registered or bridged; recovery needed
- `✅ cospec vault drift 检测：vault 为空，无需处理` — no custom workflows exist yet
- `✅ cospec vault drift 检测：vault 含 N 个工作流，全部已注册...` — clean state

Surface the result to the user as part of the menu display (so drift is
visible immediately, not only on plugin upgrade). Then proceed with the
normal config status output:

```
📋 cospec.config.json 当前状态

✅ 已配置:
  project.product = "SCP"

⬜ 使用内置默认:
  templates (user-requirement, user-journey, tr1-large-review, tr1-large-ai, tr1-small-review)
  rules (requirement-checklists)
  evaluators (product-planning-requirement-clarification, user-journey-design, tr1-requirements-spec)
  kb (skill: product-kb-query, localPath: null)
  env (DAEDALUS_URL, DAEDALUS_API_KEY)
  workflow (default: large-requirement-workflow, options: [large-requirement-workflow, small-requirement-workflow], install-dirs: {})

要配置哪个类别？
  1. project      — 项目信息（产品名称）
  2. templates    — 模板文件
  3. rules        — 规范/检查清单目录
  4. evaluators   — 质量门评估器 skill
  5. workflows    — 工作流入口管理（默认 / 注册表 / install / uninstall / sync）
  6. kb           — 知识库访问
  7. env          — 环境变量与凭证
  8. 全部配置
  9. 还原默认配置
```

---

## Restore: 还原默认配置

If the user selects **9. 还原默认配置**, execute the following:

1. Check if `<plugin-root>/cospec.config.json.bak` exists.
2. **If backup exists**: Copy the backup over the current config, then output:
   ```
   ✅ 已从 cospec.config.json.bak 还原默认配置。
   ```
3. **If backup does not exist**: Output:
   ```
   ⚠️ 未找到 cospec.config.json.bak 备份文件。
   尚未执行过配置操作，没有可还原的备份。请先通过选项 1-8 完成首次配置。
   ```

---

## Step 2: Category Wizards

### `project` — 项目信息

**product**
> "你的产品名称是什么（如 SCC、SCP、DMP）？用于标识当前项目所属产品线。没有则跳过。"

---

### `templates` — 模板文件

For each template key, show the cospec default path and ask:

**user-requirement**
> "你是否有自己的 TR1 用户需求模板？请提供文件路径（相对 plugin 根目录或绝对路径），或跳过使用默认：`templates/user-requirement-template.md`。"

**user-journey**
> "你是否有自己的用户旅程文档模板？请提供文件路径，或跳过使用默认：`skills/user-journey-design/assets/templates/document-template.md`。"

**tr1-large-review**
> "你是否有自己的大需求评审版模板？请提供文件路径，或跳过使用默认：`skills/tr1-requirements-spec/assets/templates/大需求用户需求规格说明书_评审版.md`。"

**tr1-large-ai**
> "你是否有自己的大需求 AI 上下文版模板？请提供文件路径，或跳过使用默认：`skills/tr1-requirements-spec/assets/templates/大需求用户需求规格说明书_AI上下文版.md`。"

**tr1-small-review**
> "你是否有自己的小需求评审版模板？请提供文件路径，或跳过使用默认：`skills/tr1-requirements-spec/assets/templates/小需求用户需求说明_评审版.md`。"

After user provides a path: use `Read` tool to verify the file exists and is non-empty. If not found, warn: "文件不存在，请确认路径后重试，或跳过。"

---

### `rules` — 规范/检查清单目录

**requirement-checklists**
> "你是否有自己的需求检查清单目录？请提供目录路径（相对 plugin 根目录或绝对路径），或跳过使用默认：`rules/requirement-checklists/`。"

After user provides a path: use `Bash` to verify the directory exists. If not found, warn: "目录不存在，请确认路径后重试，或跳过。"

---

### `evaluators` — 质量门评估器

For each evaluator key, ask:

**product-planning-requirement-clarification**
> "需求澄清阶段后是否启用质量门？输入自定义 evaluator skill 名称，输入 `false` 禁用，或跳过使用默认：`product-planning-requirement-clarification-evaluator`。"

**user-journey-design**
> "用户旅程设计阶段后是否启用质量门？输入自定义 evaluator skill 名称，输入 `false` 禁用，或跳过使用默认：`user-journey-design-evaluator`。"

**tr1-requirements-spec**
> "TR1 需求说明书阶段后是否启用质量门？输入自定义 evaluator skill 名称，输入 `false` 禁用，或跳过使用默认：`tr1-requirements-spec-evaluator`。"

Validation: string values must not be empty; `false` is valid; skip is valid.

---

### `workflow` — workflow entry skills（默认 + 自定义）

brainstorming 从 `workflow.options` 读取所有可用工作流入口 skill（每个的解释来自其 SKILL.md frontmatter 的 `description` 字段）。`workflow.default` 是 brainstorming 失败时的回退值，**必须始终是 `workflow.options` 的成员之一**——任何写入前都要校验这条不变量。

`workflow.options` 是一个**扁平字符串数组**——只存 skill 名，**不**存 builtin / enabled / label / description 等元数据。`workflow.install-dirs`（可选）是一个 `agent-id → 路径` 字符串映射，作为 agent skill 目录的显式覆盖。

自定义工作流的来源是 `~/.cospec/workflows/<name>-workflow/`（vault，跨插件升级存活）。bridge 始终通过 `scripts/workflow-links.mjs` 创建（symlink 或 Windows junction），**绝不复制**。

**default**
> "默认的 workflow entry skill 是什么？必须是当前 `workflow.options` 的成员之一。输入 skill 名称，或跳过使用当前值。"

Validation: non-empty string，且必须 ∈ `workflow.options`。

**options（注册表管理）**
> "请选择要执行的操作：
>   1. **install** — 从 `~/.cospec/workflows/` 选一个 vault 工作流，安装到当前 agent（symlink/junction）+ 注册到 `options`
>   2. **uninstall** — 删除某个 agent 的 bridge（vault 永远保留）
>   3. **register** — 手动把一个已存在的 skill 名追加到 `options`（用于团队共享或恢复）
>   4. **deregister** — 从 `options` 移除一个 skill 名（vault 不动）
>   5. **sync / reconcile** — 对照 vault 扫描 `options`，发现未注册的 vault 工作流并报告 + 让用户决定是否补登；发现孤立 bridge 报告 + 让用户决定是否清理
>   6. **delete** — **彻底删除一个自定义工作流**（uninstall 所有 agent 的 bridge + deregister + 删 vault 目录）。不可逆——必须输入工作流名并二次确认
>   7. **跳过**"

所有 bridge 操作（install / uninstall）必须通过：

```bash
node <plugin-root>/scripts/workflow-links.mjs install <name> --install-dir "<agent-skill-dir>"
node <plugin-root>/scripts/workflow-links.mjs uninstall <name> --install-dir "<agent-skill-dir>"
```

#### 6. delete（彻底删除自定义工作流）

**不可逆操作**——必须**二次确认**（输入工作流名 + 明确 `YES`）才执行。

执行序列：

1. **先扫所有 agent skill 目录**：对 `~/.agents/skills`、`~/.codex/skills`、`~/.claude/skills`（以及 `workflow.install-dirs` 里所有 override）逐个跑 `workflow-links.mjs uninstall <name>`。每个 agent 的 uninstall 结果（removed / absent / not-a-bridge）记下来，不报错就跳过。
2. **从 `workflow.options` 移除**（按 §workflow.options 的写入规则，merge-only-changed-fields、保留 `.bak`）。
3. **删 vault 目录**：`rm -rf ~/.cospec/workflows/<name>`。**这是不可逆步骤**——删前必须完成 step 1 和 2，否则下次 `sync / reconcile` 会报告孤儿。
4. **跑 drift 验证**：`node hooks/lib/check-vault-drift.mjs <plugin-root>`，输出应包含 `✅`（没有 vault 工作流或全部已注册），不再有 `<name>`。
5. **报告摘要**给用户：
   - 哪些 agent 卸了 bridge（removed）/ 没装（absent）/ 有冲突（skipped）
   - workflow.options 改动
   - vault 删成功
   - drift 检测最终结果

确认机制（**必须**遵守）：

- 第一步：问工作流名 + 警告「此操作不可逆」+ 显示当前 vault + registry + bridge 现状摘要
- 第二步：用户必须**显式输入** `YES`（全大写）或**精确重新输入**工作流名作为二次确认。其它任何输入（包括 `yes` 小写、`y`、`ok`）**都不接受**——直接退出
- 任意一步用户拒绝 → 不做任何修改，原状退出

**保留哪些、不删哪些**：

- ✅ 删：vault 目录（`~/.cospec/workflows/<name>/`）
- ✅ 删：所有 agent 的 bridge（`~/.agents/skills/<name>` 等）
- ✅ 删：workflow.options 里的名字
- ❌ **不**删：`<plugin-root>/cospec.config.json.bak`（一次性基线，必须保留）
- ❌ **不**删：插件源里的任何文件（不是用户拥有的）

错误处理：

- 任何一步失败，**不**回滚已成功的步骤——继续往下做（best-effort），最后在摘要里告诉用户哪步失败、哪步成功
- 失败不假装成功；摘要里所有 `uninstall` 都列出实际状态

agent-skill-dir 由运行中的 agent 自决：Codex 通常是 `~/.agents/skills/`、Claude Code 是 `~/.claude/skills/`、`workflow.install-dirs` 里有显式覆盖则优先使用。

校验：
- `options` 是非空、唯一的字符串数组
- `default` 必须是 `options` 的成员
- 已存在的 `cospec.config.json.bak` **不得覆盖**
- 不得复制 workflow 目录；vault 必须保留

---

### `kb` — 知识库

**skill**
> "是否启用知识库查询 skill？输入 skill 名称（默认：`product-kb-query`），输入 `null` 禁用 skill 查询并仅使用本地路径，或跳过使用默认。"

**localPath**
> "本地知识库目录路径是什么？请提供路径（相对 plugin 根目录或绝对路径），或跳过使用默认：`null`（不启用文件型 KB）。使用 `/product-kb-server download --kb <kb-name-or-id>` 下载时，默认会保存到 `~/.cospec/kb/<kb-name>/` 并自动配置本项。"

After user provides a path: verify the directory exists.

---

### `env` — 环境变量

**DAEDALUS_URL**
> "遥测上报服务器 URL 是什么？没有则跳过。"

**DAEDALUS_API_KEY**
> "遥测 API Key 是什么？没有则跳过。"

---

## Step 3: Validation Summary

Before writing, display what will be changed:

```
📝 即将写入 cospec.config.json：

  project.product:              null → "SCP"
  templates.user-requirement:   null → "my-templates/tr1.md"  ✅ 文件已验证
  rules.requirement-checklists: null → "my-rules/checklists/"  ✅ 目录已验证
  evaluators.tr1-requirements-spec: null → false  ⚠️ 将禁用 TR1 质量门控
  workflow.default:             null → "large-requirement-workflow"
  workflow.options:            []  → ["large-requirement-workflow", "small-requirement-workflow", "quick-tr1-workflow"]

是否确认写入？(y/n)
```

---

## Step 4: Write Config

Merge the new values into the existing `cospec.config.json` — only update the changed fields, preserve all existing values. Write using the Write tool.

**Before writing**: create a backup of the current config if one does not already exist. **若 `cospec.config.json.bak` 已存在则不得覆盖**——首次配置时创建一份基线，后续操作复用同一份基线以便"还原默认配置"始终回到同一状态：
```bash
cp <plugin-root>/cospec.config.json <plugin-root>/cospec.config.json.bak
```

After writing:

```
✅ cospec.config.json 已更新。

配置立即生效——cospec skills 下次运行时会自动读取新配置，无需重启。

如果本次修改了 `workflow.options`，新增的自定义工作流依赖 vault → bridge 链路：
- vault 在 `~/.cospec/workflows/<name>-workflow/`（永远不动）
- bridge 通过 symlink / Windows junction 暴露在 agent 的 skill 目录
- 多数 agent 的 skill 发现是**启动期**完成——可能需要**重启 agent 或开新会话**才能在 brainstorming 里看到新条目

是否继续配置其他类别？
```

---

## Validation Rules

| Value Type | Validation |
|---|---|
| File path | Use `Read` tool to verify file exists and is non-empty |
| Directory path | Use `Bash` to verify directory exists |
| Evaluator name | Non-empty string or `false` |
| Workflow default | Non-empty string，且 ∈ `workflow.options` |
| Workflow options | 非空、唯一的字符串数组；每个名字 kebab-case 且以 `-workflow` 结尾；未知字段保留 |
| Workflow install-dirs | 可选 `agent-id → 路径` 字符串映射；每个值需 `~`/`~/...` 形式或绝对路径 |
| `null` / skip | Always valid — resets to cospec default |

**Bridge 操作约束：**
- 所有 install / uninstall 必须通过 `<plugin-root>/scripts/workflow-links.mjs`
- 禁止复制 workflow 目录到 agent skill 目录
- uninstall 只删 bridge，vault 必须保留
- install / uninstall 失败时，禁止修改 `cospec.config.json`

---

## Extension Principle

`cospec.config.json` 是**唯一受支持**的扩展机制。

- **bundled 工作流的拓扑不可改**：`brainstorming`、`large-requirement-workflow`、`small-requirement-workflow`、`cospec-preflight` 等内置 skill 的 SOP 由各自 SKILL.md 锁定，不被本配置覆盖。
- **bundled 工作流实现不可替换**：不能通过注册表把内置名字改成另一个 skill——`options` 里的名字必须能在 `skills/<name>/SKILL.md` 或 `~/.cospec/workflows/<name>-workflow/SKILL.md` 实际加载到。
- **可扩展点**：
  - **叶子级**：templates / rules / evaluators / kb / env（与之前一致）
  - **工作流入口注册表**：通过 `workflow.options` 追加**额外**的工作流入口 skill，与内置项平级共存
- 工作流拓扑（步骤顺序、串行/并行、跳过规则）**写在每个工作流入口 SKILL.md 里**，不在 config 里。

新增自定义工作流的标准流程见 `scaffold-custom-workflow`（元 skill）。任何对 `workflow.options` 的修改，都必须保持 `workflow.default ∈ workflow.options` 的不变量。
