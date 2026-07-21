---
name: cospec-configure
description: Use when configuring cospec for a new project — interactively guides replacement of templates, rules, evaluators, knowledge base, workflow defaults, and project info by writing to cospec.config.json in the plugin root.
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

After reading the config, output:

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
  workflow (default: large-requirement-workflow)

要配置哪个类别？
  1. project      — 项目信息（产品名称）
  2. templates    — 模板文件
  3. rules        — 规范/检查清单目录
  4. evaluators   — 质量门评估器 skill
  5. workflow     — 默认 workflow entry skill
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

### `workflow` — 默认 workflow entry skill

**default**
> "默认的 workflow entry skill 是什么？输入 skill 名称（`large-requirement-workflow` 或 `small-requirement-workflow`），或跳过使用默认：`large-requirement-workflow`。当 `brainstorming` 无法判断用户意图时会回退到该默认值。"

Validation: non-empty string.

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

是否确认写入？(y/n)
```

---

## Step 4: Write Config

Merge the new values into the existing `cospec.config.json` — only update the changed fields, preserve all existing values. Write using the Write tool.

**Before writing**: create a backup of the current config if one does not already exist:
```bash
cp <plugin-root>/cospec.config.json <plugin-root>/cospec.config.json.bak
```

After writing:

```
✅ cospec.config.json 已更新。

配置立即生效——cospec skills 下次运行时会自动读取新配置，无需重启。

是否继续配置其他类别？
```

---

## Validation Rules

| Value Type | Validation |
|---|---|
| File path | Use `Read` tool to verify file exists and is non-empty |
| Directory path | Use `Bash` to verify directory exists |
| Evaluator name | Non-empty string or `false` |
| Workflow default | Non-empty string |
| `null` / skip | Always valid — resets to cospec default |

---

## Extension Principle

`cospec.config.json` is the **only** supported extension mechanism. Core workflow skills (`brainstorming`, `large-requirement-workflow`, `small-requirement-workflow`) enforce their own SOP and cannot be overridden by other plugins or skills. Only the leaf extension points declared in this config (templates, rules, evaluators, kb, env, workflow default) are replaceable.

Workflow topology itself is defined in the workflow entry skill prompts, not in config.
