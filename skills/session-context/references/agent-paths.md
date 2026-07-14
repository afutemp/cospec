# Agent 平台路径速查

session-context skill 在不同 agent 平台上的存储路径不一样。
执行盘点时按使用的平台查这张表。

## Claude Code

| 用途 | 路径 |
|------|------|
| 任务进度 | `.claude/session-context/active-*.md`（glob 匹配，支持多任务并行） |
| 项目经验（memory） | `memory/`（auto-memory 目录） |
| memory 索引 | `memory/MEMORY.md` |
| 全局指令 | `~/.claude/CLAUDE.md` |
| 项目级指令 | 项目根 `CLAUDE.md` |

memory 文件使用 YAML frontmatter：`name`、`description`、`type`（可选值：`user`、`feedback`、`project`、`reference`）。
session-context 只使用 `feedback` 和 `project` 类型。

## OpenAI Codex

| 用途 | 路径 |
|------|------|
| 任务进度 | `.codex/session-context/active-*.md`（glob 匹配） |
| 项目经验 | 无独立 memory 系统，沉淀到 `AGENTS.md` |
| 项目级指令 | 项目根 `AGENTS.md` |

Codex 无独立 memory 机制。任务沉淀时，将会话经验写入 `AGENTS.md` 的 "项目经验" 章节。
若 `AGENTS.md` 不存在，先判断项目是否到"有可运行代码"的阶段再决定是否创建。

## OpenCode

| 用途 | 路径 |
|------|------|
| 任务进度 | `.opencode/session-context/active-*.md`（glob 匹配） |
| 项目经验 | 复用 Claude Code 的 `memory/` 目录（OpenCode 同时扫描 `.claude/` 和 `.codex/`） |

## OpenClaw

| 用途 | 路径 |
|------|------|
| 任务进度 | `.openclaw/session-context/active-*.md`（glob 匹配） |
| 项目经验 | 无独立 memory 系统，沉淀到项目根 markdown（CLAUDE.md / AGENTS.md / 等价文件） |

## 当前平台没有独立 memory 时的 fallback

1. **active-*.md 始终创建** — 这是跨会话恢复的最低保障
2. **项目经验沉淀到项目根 markdown** — CLAUDE.md / AGENTS.md / 或平台等价文件
3. **docs/ 和 README 是平台中立的** — 所有平台可读，也是知识保障
4. **不强行创建 memory/ 目录** — 只在平台原生支持时使用

## 跨平台共存

若项目同时被 Claude Code 和 Codex 用户使用：
- 项目根可同时保留 `CLAUDE.md` 和 `AGENTS.md`
- `active-*.md` 按平台分目录，互不冲突
- `memory/` 仅 Claude Code 使用（其他平台通过项目根 markdown 获取相同信息）
