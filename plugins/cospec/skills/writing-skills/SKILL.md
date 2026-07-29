---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

**Skill 标识**: `writing-skills`

其他 skill 通过 `writing-skills` 引用本 skill。

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

**Personal skills live in agent-specific directories (`~/.claude/skills` for Claude Code, `~/.agents/skills/` for Codex)**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**Official guidance:** For Anthropic's official skill authoring best practices, see references/anthropic-best-practices.md.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools. Skills help future Claude instances find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides
**Skills are NOT:** Narratives about how you solved a problem once

## SKILL.md Structure

**Frontmatter (YAML):**
- Two required fields: `name` and `description`
- Max 1024 characters total
- `name`: Use letters, numbers, and hyphens only
- `description`: Third-person, describes ONLY when to use (NOT what it does). Start with "Use when..."

```markdown
---
name: Skill-Name-With-Hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
Bullet list with SYMPTOMS and use cases

## Core Pattern
Before/after code comparison

## Quick Reference
Table or bullets for scanning

## Common Mistakes
What goes wrong + fixes
```

## Claude Search Optimization (CSO)

**CRITICAL: Description = When to Use, NOT What the Skill Does**

The description should ONLY describe triggering conditions. Do NOT summarize the skill's process or workflow in the description.

```yaml
# BAD: Summarizes workflow
description: Use when executing plans - dispatches subagent per task with code review between tasks

# GOOD: Just triggering conditions
description: Use when executing implementation plans with independent tasks in the current session
```

## Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

**Flat namespace** - all skills in one searchable namespace.

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS to existing skills.

## RED-GREEN-REFACTOR for Skills

### RED: Write Failing Test (Baseline)
Run pressure scenario with subagent WITHOUT the skill. Document exact behavior.

### GREEN: Write Minimal Skill
Write skill that addresses those specific rationalizations. Run same scenarios WITH skill.

### REFACTOR: Close Loopholes
Agent found new rationalization? Add explicit counter. Re-test until bulletproof.

## Flowchart Usage

**Use flowcharts ONLY for:** Non-obvious decision points, process loops, "when to use A vs B" decisions.
**Never use flowcharts for:** Reference material, code examples, linear instructions.

## Code Examples

**One excellent example beats many mediocre ones.** Choose most relevant language.

## Authoring Workflow Entries

cospec 自定义工作流入口 skill（与 `large-requirement-workflow`、`small-requirement-workflow` 平级）有特殊的工程化约定，**普通 leaf skill 不能直接复用本节的规则**。新工作流不要手写——直接用 `scaffold-custom-workflow` 元 skill 引导生成。

### 工作流入口 vs. 普通 leaf skill

| 项 | 普通 leaf skill | 工作流入口 skill |
|---|---|---|
| 命名 | kebab-case 自由 | kebab-case 且必须以 `-workflow` 结尾 |
| 存放 | `skills/<name>/SKILL.md` 或 `~/.agents/skills/<name>/SKILL.md` | vault: `~/.cospec/workflows/<name>-workflow/SKILL.md`，通过 symlink / Windows junction 暴露到 agent skill 目录 |
| 注册 | 不需要 | 必须显式追加到 `cospec.config.json` 的 `workflow.options`（由 `cospec-configure` 或 `scaffold-custom-workflow` 完成） |
| 创建方式 | 编辑 `SKILL.md` 即可 | 必须遵循 Iron Law：先写失败测试 → 再写 SKILL.md → 再 `node scripts/workflow-links.mjs install` |

### 契约

- frontmatter `name` 必须**等于目录名**
- `description` 字段必须以 "Use when ..." 起头，描述**触发场景**而非功能（CSO 规则）
- 必须含 `<HARD-GATE>` 段，明确"用户未确认前禁止派发"
- 必须含 `Skill 标识` 块
- 步骤表用 `| stepN | \`Skill("<leaf>")\` |` 列出串行调用
- 必须有"红线"段，禁止并行执行、跳过询问等
- **绝不复制 vault 内容到 agent skill 目录**——一律走 `scripts/workflow-links.mjs install`

### 跨 agent 一致性

vault 是单一源真理。多个 agent 通过 symlink / Windows junction 共享同一份 SKILL.md：

```
~/.cospec/workflows/quick-tr1-workflow/SKILL.md   ← vault（永远不动）
       │
       ├─→ ~/.agents/skills/quick-tr1-workflow     (Codex)
       └─→ ~/.claude/skills/quick-tr1-workflow     (Claude Code)
```

改 vault → 下次 agent 启动立即看到。无需同步命令。

### Iron Law（重申）

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

`scaffold-custom-workflow` 强制要求先观察到 RED，再写 SKILL.md。任何"先做出来再说"的请求都必须拒绝。

---

## Skill Creation Checklist (TDD Adapted)

**RED Phase:**
- [ ] Create pressure scenarios
- [ ] Run scenarios WITHOUT skill - document baseline
- [ ] Identify patterns in failures

**GREEN Phase:**
- [ ] Name uses only letters, numbers, hyphens
- [ ] YAML frontmatter with `name` and `description`
- [ ] Description starts with "Use when..."
- [ ] Address specific baseline failures
- [ ] Run scenarios WITH skill - verify compliance

**REFACTOR Phase:**
- [ ] Identify NEW rationalizations from testing
- [ ] Add explicit counters
- [ ] Build rationalization table
- [ ] Re-test until bulletproof

**Deployment:**
- [ ] Commit skill to git

## The Bottom Line

**Creating skills IS TDD for process documentation.**

Same Iron Law: No skill without failing test first.
Same cycle: RED (baseline) -> GREEN (write skill) -> REFACTOR (close loopholes).
