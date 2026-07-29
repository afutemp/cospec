---
name: brainstorming
description: "Use only when the user explicitly asks to run cospec for product-planning work, or explicitly continues an active cospec workflow. Do not use merely because the request mentions cospec, cospowers, requirements, planning, research, TR1, or TR2. Do not use when discussing, reviewing, debugging, documenting, or improving cospec itself."
---

# Brainstorming —— 中央路由器

**Skill 标识**: `brainstorming`

其他 skill 通过 `brainstorming` 引用本 skill。

brainstorming 是所有产品规划工作的唯一入口，承担两项职责：

- **路由器**：对所有产品规划任务，询问用户需要哪种 workflow，确认后分发到对应的 workflow entry skill。
- **分发前体检**：调用 `cospec-preflight` 探测知识库 / IPD / Demo 连通性，警告但不阻塞。

<HARD-GATE>
在用户明确选择 workflow 之前，禁止执行以下任一动作：

- 调用任何 workflow entry skill（无论是内置还是 `workflow.options` 里的自定义条目）；
- 调用任何下游叶子 skill；
- 产出任何正式文档；
- 自行判断需求类型、替用户做出选择；
- 因 `workflow.default` 而跳过显式询问——`workflow.default` 仅作 brainstorming 自身判断失败时的回退提示，**不能、不得、never** 授权自动派发。

适用于所有产品规划任务，无论看起来多简单、需求倾向多明显。

</HARD-GATE>

## 反模式：跳过路由 / 自行选择 workflow

每个产品规划任务都要经过路由流程。以下均属违规：

- **自行选择**：根据需求描述自行判断类型，不询问用户就直接调用 `workflow.options` 里的某个 workflow；
- **直接产出**：跳过路由直接进入需求澄清、用户旅程设计、TR1 文档生成等下游环节；
- **把 `workflow.default` 当作自动派发依据**：必须显式询问用户；
- **把已注册但未在当前 agent 安装的 workflow 静默忽略或强行派发**——必须向用户报告"未安装"，并指引走 `cospec-configure` 安装。

无一例外。

---

## 路由流程

### 1. 读取 `workflow.options`

从插件根目录（本 skill 基目录上两级）的 `cospec.config.json` 读取 `workflow.options`（扁平字符串数组）。同时读取 `workflow.default` 仅用于校验（必须 ∈ `options`），不作为派发依据。

- 内置工作流（`large-requirement-workflow`、`small-requirement-workflow`）的 SKILL.md 在 `plugins/cospec/skills/<name>/SKILL.md`。
- 自定义工作流的 SKILL.md 真实源在 `~/.cospec/workflows/<name>-workflow/SKILL.md`（vault），通过 symlink / Windows junction 暴露在 agent 的 skill 目录。
- 每个工作流的菜单解释**直接来自其 SKILL.md frontmatter 的 `description` 字段**——不在 config 里另存 label / description。
- 若某个 `options` 项无效（如 frontmatter 缺失、name 与目录不一致、或当前 agent 未安装），**报告为"未安装 / 无效"并提示用户走 `cospec-configure`**，禁止派发。

兼容性回退：若 `workflow.options` 为 `null` 或缺失，沿用内置的两个工作流作为默认。

#### 1.5 检测 vault drift（plugin 升级后常见）

读完 `workflow.options` 后**立即**跑一次 drift 检测——这是用户在升级后最常踩的坑：vault 里的自定义工作流还在，但 registry 被重置，菜单里看不到。

```bash
HOME=$HOME node <plugin-root>/hooks/lib/check-vault-drift.mjs <plugin-root>
```

输出三类：

- `⚠️ ...` → 有 drift（vault 工作流没注册到 `workflow.options`、或 bridge 丢失）→ **必须**告诉用户，并列出孤儿工作流，再问他要不要：
  - 现在选内置 workflow，把孤儿先放一边（推荐：不动现有工作流）
  - 先调 `cospec-configure` 5.5 sync 补登记册，再回到本菜单
- `✅ ... vault 含 N 个工作流，全部已注册...` → 干净，正常显示菜单
- `✅ ... vault 为空...` → 没有自定义工作流，正常显示菜单

drift 警告放在菜单**上方**——让用户在决定路由前就看到。

### 2. 询问用户

按 `workflow.options` 的顺序生成菜单（保留 `workflow.options` 顺序即是菜单顺序），用 frontmatter `description` 作解释：

```
当前需求您希望走哪条工作流？
  - <name1> — <frontmatter.description>
  - <name2> — <frontmatter.description>
  - <name3> — <frontmatter.description>
  ...
请选择（输入序号 / 名称）。
```

**输出提问后立即停止本轮输出，等待用户回复。** 无论需求看起来多明确、倾向多明显，都禁止自行选择。路由决定权完全交由用户。

### 3. 用户确认后

调用 `Skill("cospec-preflight")` 对三个外部依赖（知识库 / IPD / Demo）做连通性体检，逐项转述结果（连通/不通 + 影响）。

### 4. 体检后**条件性**停下

**preflight 是条件阻塞，不是无差别停下**：

- **全通**：直接进入 Phase 5 派发，**不询问**"是否继续？"——preflight 的"不阻塞"语义就是这种情况
- **任意一项不通**：停下告知具体哪项失败 + 影响，并询问"**部分依赖不通，是否继续？**"。用户回复"继续"才派发；回复"取消"则 brainstorming 结束

### 5. 派发

调用选中的 workflow entry skill：`Skill("<user-selected-name>")`。

### 6. 调用后，**brainstorming 结束**

被调用的 workflow entry skill 会按业务流程继续推进。

---

## 流程全景

brainstorming 只负责**路由**——询问用户选择 workflow、确认（条件性）、分发，随后结束。**各 workflow 的具体步骤（澄清/研究/旅程/TR1/TR2 的串行编排）由其自身 SKILL.md 定义**，brainstorming 不重复维护，避免与下游 workflow 产生耦合。

```text
用户意图
    │
    ▼
brainstorming（读 workflow.options → 询问 → 等用户回复 → preflight → [全通? 直接派发 : 等用户确认] → 派发）
    │
    ▼
cospec-preflight（探活 KB / IPD / Demo，报告后停下等用户确认，不阻塞）
    │
    ▼
Skill("<user-selected-workflow>")  ← 来自 workflow.options，可能是内置也可能是 vault 自定义
```

`workflow.options` 当前默认包含：`large-requirement-workflow`、`small-requirement-workflow`。用户通过 `cospec-configure` 或 `scaffold-custom-workflow` 追加的自定义工作流与内置项平级。