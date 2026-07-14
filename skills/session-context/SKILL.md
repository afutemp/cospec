---
name: session-context
description: Use when session starts/ends, context compacts, user says "保存上下文"/"恢复上下文"/"checkpoint"/"resume"/"沉淀"/"sediment"/"context", or after key events (user correction, task step complete, architecture decision, blocked/waiting)
---

# Session Context

**Skill 标识**: `session-context`

其他 skill 通过 `session-context` 引用本 skill。

<HARD-GATE>
当 session-context 因 SessionStart / compact / resume 事件被加载时，你**必须**在输出任何其他文字、执行任何其他工具调用之前，完整执行"盘点流程"的步骤 1-5。

这不是建议。这不是可选。compaction 发生时上下文正在丢失——此刻跳过盘点就是永久丢失信息。

具体来说：
- 第一个工具调用必须是 `ls` 枚举目录或 `Read` 读取 active 文件
- 在完成盘点并输出清单之前，**禁止**回复用户、回答提问、执行任务
- 即使 SessionStart hook 已经注入了任务列表，也必须亲自再盘一遍——hook 信息可能过时
</HARD-GATE>

## Overview

你是**会话编辑**，不是记录员。记录员只会追加，编辑会审查全局、合并重复、
修正过期、删除废弃。你的工作是维护跨会话知识——让 AI 在 compact/重开对话框后
不掉上下文，越用越聪明。

两层知识：任务进度（`active-<task>.md`，临时备忘）、项目经验（memory/，永久积累）。
完整架构、编辑原则、平台路径见 `references/` 目录。

### 文件命名

- 任务文件格式：`active-<task-name>.md`
- **AI 自主决定 task-name**（简短英文+连字符，2-4 词），如 `active-add-session-context.md`、`active-fix-login-bug.md`
- 不同类型的任务不会冲突（排查、开发、配置各自有独立文件）
- 任务沉淀完成后删除对应文件（无 `active-*` 即无活跃任务）

## 盘点流程（SessionStart / compact / resume 强制执行）

**先枚举，再判断。漏一个不行。**

1. 读取 `references/agent-paths.md` 确定当前平台的 session-context 和 memory 路径
2. `ls` 枚举 memory 目录 + session-context 目录（列出所有 `active-*.md`）
3. 读 `MEMORY.md` 及所有被引用的 `.md`
4. 读所有 `active-*.md` 文件
5. 输出内部盘点清单（每个文件标：评估过 / 要更新 / 不变）

### AI 自主判断：恢复旧任务 vs 开新任务

**原则：AI 自主决定，只在无法判断时询问用户。**

```
存在 active-*.md?
  ├─ 无 → 全新会话，直接开始
  └─ 有（1 个或多个）
       ├─ 用户明确说做新任务 → 旧任务自动 mini-沉淀，创建新 active-<new>.md
       ├─ 用户明确说继续上次 → 恢复对应 active-*.md
       └─ 用户意图不明
            ├─ 只有 1 个 active-*.md，内容与本会话意图明显相关 → 直接恢复，不询问
            ├─ 只有 1 个，但与当前意图不相关 → 呈现摘要，询问：继续 or 新任务？
            └─ 多个 active-*.md → 列出摘要菜单，让用户选
```

呈现格式：

```
📋 **活跃任务上下文**:

1. add-session-context (2026-04-29 16:00)
   进度: 设计阶段，待实现
   
2. fix-login-bug (2026-04-28 10:30)  
   进度: 排查中，假设是 token 过期

要继续哪个？或输入 "新任务 <描述>" 开新任务。
```

## 自动模式：变更影响矩阵

**AI 在会话中主动维护上下文，无需用户提醒。** 不同事件波及不同文件。
完整矩阵见 `references/sync-matrix.md`。

| 触发事件 | active-*.md | memory/feedback | memory/project |
|---------|:--:|:--:|:--:|
| 用户纠正 AI 错误 | ● | ● | ○ |
| 用户澄清非显而易见做法 | ● | ● | ○ |
| 发现代码库关键模式 | ● | ○ | ● |
| 做出架构/实现决策 | ● | ○ | ● |
| 完成任务步骤 | ● | ○ | ○ |
| 遇到阻塞/等待输入 | ● | ○ | ○ |
| 发现 memory 间矛盾 | ○ | ● | ● |

> ●=必须写 ○=视情况

<ENFORCE-IMMEDIATE-WRITE>
以下触发事件发生时，你**必须**在同一个回复中**立即**完成 active-*.md 写入。**禁止**延迟、"等 compact 时再写"、"等会话结束再写"。

- 用户纠正你的错误或澄清做法 → 写 active-*.md + memory/feedback
- 完成任务步骤 → 写 active-*.md 进度
- 做出架构/实现决策 → 写 active-*.md + memory/project
- 学到代码库关键模式 → 写 active-*.md + memory/project
- 遇到阻塞/等待输入 → 写 active-*.md 阻塞状态

这不是建议。compact 随时可能发生，延迟写入 = 数据永久丢失。
</ENFORCE-IMMEDIATE-WRITE>

### 写入时机（主动执行，不等用户说）

- 用户纠正了你 → **立刻**写入 memory/feedback + 更新当前 active-*.md
- 学到代码库的重要事实 → **立刻**写入 memory/project + 更新当前 active-*.md
- 完成一个任务步骤 → **立刻**更新当前 active-*.md 进度
- 遇到阻塞 → **立刻**更新当前 active-*.md 阻塞状态

### 写入原则

- **合并优于追加**：旧结论被推翻时改旧条目，不新增
- **删除优于保留**：已解决的临时假设、已过期的状态，删掉
- **绝对时间**：永远 `2026-04-29`，不写 "今天""最近"
- **一条一事**：一个条目讲清楚一个事实

详细规则见 `references/editing-rules.md`。

### active-*.md 格式

```markdown
# Session Context
> Updated: 2026-04-29 15:30 | Task: <task-identifier>

## Current Task
- 目标: <one-line>
- 进度: <current-phase>
- 下一步: <next-action>

## Key State
- 决策: <key-decisions>
- 活跃文件: <files>
- 阻塞: <if-any>

## Recent Context
- <fact-1>
- <fact-2>
```

## 手动命令

| 命令 | 行为 |
|------|------|
| "保存上下文" / "checkpoint" | 执行盘点 → 全量写入当前 active-*.md + 检查 pending memory |
| "恢复上下文" / "resume" | 执行盘点 → 呈现所有 active-*.md 摘要 |
| "查看上下文" / "context" | 显示当前 active-*.md 内容 |
| "沉淀" / "sediment" | 执行任务结束仪式 |

## 任务切换（AI 自动）

当检测到用户意图从当前任务转向新任务时，AI 自动执行：

1. **mini-沉淀** — 旧任务的活跃 active-*.md 中如有值得保留的经验，沉淀到 memory
2. **删除旧 active-*.md** — 旧任务结束
3. **创建新 active-<new-task>.md** — 新任务开始
4. **不需要用户说 "沉淀"** — 切换任务是 AI 自主判断

## 任务结束仪式

当用户说 "沉淀" / "sediment"，或任务自然结束，或任务切换时执行：

1. **盘点回顾** — 读对应 active-*.md 和本次对话，识别可跨任务复用的经验
2. **按矩阵写入** — 用户纠正 → memory/feedback；架构决策 → memory/project
3. **冲突检查** — 新写入与已有 memory 有无矛盾，有则合并修正
4. **自检清单** — 逐项过 `references/editing-rules.md` 中的 checklist
5. **删除该 active-*.md 文件**
6. **输出变更摘要**

> 任务沉淀完成后，删除对应的 `active-<task>.md`。若目录下无 `active-*` 文件，表示无活跃任务。

## 集成

**上下文保持模型（即时写入 + hook 读写）：**

```
关键事件发生 → ENFORCE-IMMEDIATE-WRITE → AI 立刻写 active-*.md
     ↓
  compact 执行 → 上下文缩小（active-*.md 已是新鲜状态）
     ↓
SessionStart hook → 加载 session-context skill → AI 执行盘点 + 恢复上下文
     ↓
SessionEnd hook → 加载 session-context skill → AI 最终 checkpoint + 提议沉淀
```

| Hook | 触发时机 | 方向 | 作用 |
|------|---------|------|------|
| **SessionStart** | startup/clear/compact | **读** | 注入任务列表，触发 skill 加载，AI 盘点并恢复上下文 |
| **SessionEnd** | 会话结束 | **写** | 指示 AI 调用 Skill 工具加载 session-context，执行 checkpoint + 提议 sediment |

- **brainstorming**：进入新任务前先盘点，若 active-*.md 存在则询问是否继续上次
- **requirement-clarification**：澄清过程中主动更新 active-*.md（已确认事实、待确认事项）
- **user-journey-design**：每个阶段确认后自动更新 active-*.md 进度

## Red Flags

| 想法 | 现实 |
|------|------|
| "先 ls 太慢，我大概知道有哪些文件" | 不枚举就改的翻车率最高 |
| "这个纠正不重要，不用记" | 用户的每一次纠正都是最宝贵知识 |
| "加一条新记录就行，旧的不管" | 合并优于追加——旧信息要同步修正 |
| "这个发现太简单" | 对未来的 AI 也是新知 |
| "自检清单跳过吧" | 这是 skill 的灵魂 |
| "等用户说保存再写" | 自动模式：关键事件后立刻写入，不等 |
| "等 compact 时再写 active" | compact 前没写的东西 compact 后就丢了——写入必须在关键事件发生的时刻完成 |
| "compact 刚发生，我先回答用户再盘点" | compact 后上下文已在丢失，拖延盘点就是永久丢失 |
