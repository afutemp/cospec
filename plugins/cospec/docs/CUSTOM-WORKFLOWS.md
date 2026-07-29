# 自定义工作流使用指南

本文档面向 cospec 的最终用户：想让 `brainstorming` 路由菜单里多出**自己团队专属工作流**的产品 / 研发 / 运营人员。

读完本文你将知道：

- 从哪里开始
- 自定义工作流存放在哪里
- 它是如何生效的（从 vault 到路由菜单的完整链路）
- 如何管理（列出、卸载、跨 agent 同步）

---

## 1. 一句话总览

```text
说 "我想加一个 X 工作流"
   ↓
Skill("scaffold-custom-workflow") 会引导你从零创建
   ↓
~/.cospec/workflows/<name>-workflow/  ← 你的工作流存在这里
   ↓
<agent-skill-dir>/<name>-workflow      ← 自动挂载到当前 agent
   ↓
cospec.config.json 的 workflow.options ← 自动注册到路由表
   ↓
重启 agent → brainstorming 路由菜单出现新条目
```

---

## 2. 从哪里开始

### 2.1 入口 skill：`scaffold-custom-workflow`（composer 模式）

在 Codex 或 Claude Code 里**显式说出**你的意图即可触发：

> "帮我用 scaffold-custom-workflow 创建一个快速 TR1 工作流。"
>
> "我想新增一个发版说明工作流，让 brainstorming 可以路由过去。"

skill 启动后会**一次性追问 3 件事**（不要循环反复问）：

| 问题 | 示例回答 |
|---|---|
| 工作流名（kebab-case，必须以 `-workflow` 结尾） | `quick-tr1-workflow` |
| 触发场景（一句话，中文/英文均可） | `准备一个不涉及竞品分析的小改动 TR1 规格说明书` |
| 可选后处理 | 0 或 1 个：generate-demo / 其它 / 跳过 |

回答完 3 个问题，composer **自动发现 13 个内置 leaf skill**，按分类列出：

```
--- clarify ---
  product-planning-requirement-clarification
--- research (5) ---
  co-create-customer-minutes-analysis
  customer-experience-feedback-analysis-v2
  competitor-feature-research
  competitor-pain-points
  competitor-problem-solving
--- journey ---
  user-journey-design
--- tr1 ---
  tr1-requirements-spec
--- tr2 (4) ---
  tr2-epic-creator / tr2-feature-creator / tr2-story-creator / tr2-tech-creator
--- demo ---
  generate-demo
```

**你不需要手写任何 leaf skill 名**——composer 已经从 31 个内置 skill 里筛出可编排的 13 个，剔除 workflow entry、元 skill、KB subskills。

然后**分步选**：

```
选 step1（必选）：
  [1] product-planning-requirement-clarification
  [2] co-create-customer-minutes-analysis
  [3] customer-experience-feedback-analysis-v2
  ...
  [13] generate-demo
  [0] 结束（必须选 ≥ 1 个）
输入序号：1

选 step2：
  [0] 结束
  [2] co-create-customer-minutes-analysis   ← 已选过的自动剔除
  ...
输入序号：7

选 step3：
  [0] 结束
  [2] co-create-customer-minutes-analysis
  ...
输入序号：0
```

（不需要选 HARD-GATE——cospec 全插件的硬约定是每个 step 跑完后默认停下来让你确认产物，与 `large-requirement-workflow` / `small-requirement-workflow` 行为一致。）

最后 composer 自动执行：

```
RED   → 生成失败测试，node --test 看到 fail
GREEN → 自动渲染 SKILL.md（你完全不写 markdown），同一测试通过
INSTALL → scripts/workflow-links.mjs install
REGISTER → 追加到 cospec.config.json 的 workflow.options
REFRESH → 提示你重启 agent
```

### 2.2 不走 composer 的等价路径（高级）

如果你已经清楚契约、不希望交互式引导，也可以手工路径（不推荐，但保留）：

```bash
# 1. 在 vault 中编写 SKILL.md + 失败测试
mkdir -p ~/.cospec/workflows/<name>-workflow
# 写 SKILL.md（参考 assets/workflow-entry-template.md，但 template 已是 composer 占位符）
# 写 <name>-workflow.test.mjs，先观察到 RED 再看到 GREEN

# 2. 调用 bridge helper 把 vault 挂到当前 agent
node <plugin-root>/scripts/workflow-links.mjs install <name> \
  --install-dir "~/.agents/skills"          # Codex
# 或
  --install-dir "~/.claude/skills"          # Claude Code

# 3. 注册到路由表（用 cospec-configure 或手工编辑）
```

---

## 3. 自定义工作流存在哪里

```
~/.cospec/workflows/                              ← vault，跨升级存活
├── quick-tr1-workflow/
│   ├── SKILL.md                                   ← 工作流本体
│   └── quick-tr1-workflow.test.mjs               ← 失败测试
└── customer-research-workflow/
    ├── SKILL.md
    └── customer-research-workflow.test.mjs
```

**关键点：**

- `~/.cospec/workflows/` 是**你拥有**的目录，跟随用户账号走
- 不在 cospec 插件目录内，所以 `codex plugin marketplace upgrade` **永远不会冲掉**你的工作流
- vault 是**单一源真理**：改 `~/.cospec/workflows/<name>/SKILL.md` → 所有 agent 立即看到（重启后）

### 3.1 Leaf skill 池（composer 的可选范围）

v1.0.21 起，`scaffold-custom-workflow` 是一个 **composer**——它从 31 个内置 skill 里自动筛出可编排的 leaf skill，目前固定 **13 个**：

| Category | 数量 | Skill |
|---|---|---|
| clarify | 1 | `product-planning-requirement-clarification` |
| research | 5 | `co-create-customer-minutes-analysis`、`customer-experience-feedback-analysis-v2`、`competitor-feature-research`、`competitor-pain-points`、`competitor-problem-solving` |
| journey | 1 | `user-journey-design` |
| tr1 | 1 | `tr1-requirements-spec` |
| tr2 | 4 | `tr2-epic-creator`、`tr2-feature-creator`、`tr2-story-creator`、`tr2-tech-creator` |
| demo | 1 | `generate-demo` |

**被 composer 排除的 18 个内置 skill**：

- **workflow entry（菜单项，不可作为 step）**：`large-requirement-workflow`、`small-requirement-workflow`、`scaffold-custom-workflow`（含自身）
- **元 skill（agent 内部使用）**：`brainstorming`、`writing-skills`、`cospec-configure`、`cospec-preflight`、`sync-to-ipd`、`qianliu-ipd`
- **KB dispatcher 与 subskills**：`product-kb`、`product-kb-eval`、`product-kb-index`、`product-kb-init`、`product-kb-optimize`、`product-kb-query`、`product-kb-server`、`product-kb-update`

如果你的团队需要 composer 没列出的 leaf skill（比如自写的研究方法），当前 v1.0.21 **不支持**——这是有意的范围控制，避免 composer 误把元 skill / workflow entry 当成 step。自写 leaf skill 是后续 PR 的范围。

**路径约定：**

- 工作流名 = 目录名 = frontmatter `name`（三者必须一致）
- 必须 kebab-case 且以 `-workflow` 结尾
- 大小写敏感，禁止 `.` / `..` / 绝对路径

---

## 4. 它是怎么生效的：从 vault 到 brainstorming 菜单

完整链路共 4 跳：

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. vault（你拥有）                                                 │
│    ~/.cospec/workflows/quick-tr1-workflow/SKILL.md               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │   symlink / Windows junction
                              │   （由 scripts/workflow-links.mjs 创建）
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. agent skill 目录（agent 自己挑的路径）                           │
│    ~/.agents/skills/quick-tr1-workflow     → 上面的 vault        │
│    或 ~/.claude/skills/quick-tr1-workflow → 上面的 vault        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │   Codex / Claude Code 启动时扫描
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. agent skill registry（运行时）                                   │
│    agent 启动时发现 quick-tr1-workflow，可被 Skill() 调用         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │   brainstorming 读 cospec.config.json
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. 路由菜单（每次 brainstorming 调用时构建）                          │
│    • large-requirement-workflow  （bundled）                       │
│    • small-requirement-workflow  （bundled）                       │
│    • quick-tr1-workflow         ← 你刚加的                        │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 bridge 是什么、为什么用 symlink

**bridge** 是从 agent skill 目录指向 vault 的符号链接（Windows 上是目录 junction）。

**为什么不是复制：**

- 复制 → vault 改了 agent 看不到 → 多 agent 各漂移
- symlink → vault 是单一源 → 改完所有 agent 下次启动立即看到
- 卸载时只删链接，vault 永远不动

### 4.2 谁决定 install 路径

由**当前运行的 agent**自决，不需要在 cospec 配置里写死：

| Agent | 默认扫描目录 |
|---|---|
| Codex | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| Cursor | 项目级 `.cursor/skills/` |

如果想显式覆盖（如团队统一约定），在 `cospec.config.json` 里设：

```json
{
  "workflow": {
    "install-dirs": {
      "codex":       "~/.agents/skills",
      "claude-code": "~/.claude/skills"
    }
  }
}
```

### 4.3 路由表怎么被填充

`brainstorming` **每次调用时**读 `cospec.config.json` 的 `workflow.options`：

```json
{
  "workflow": {
    "default": "large-requirement-workflow",
    "options": [
      "large-requirement-workflow",
      "small-requirement-workflow",
      "quick-tr1-workflow"
    ]
  }
}
```

- `options` 是扁平字符串数组，按你写的顺序显示
- 每个条目的菜单解释**直接来自 vault 里 SKILL.md 的 frontmatter `description`**——不在 config 里另存
- `default` 只是 brainstorming 自己失败时的回退提示，**不**授权自动派发——用户必须显式选择

### 4.4 何时生效

**Codex / Claude Code 的 skill 发现是启动期完成的**。所以：

1. `scaffold-custom-workflow` 完成后会打印：
   ```
   ✅ 已完成：vault、bridge、registry。
   ⚠️ 当前 agent 会话可能仍看不到新 skill。
      请重启 agent 或打开新会话后再让 brainstorming 路由到本工作流。
   ```
2. 在当前会话里立即调 `Skill("<新名字>")` 可能失败（因为 agent 没重新扫盘）
3. 重启后 `brainstorming` 菜单自动出现新条目——无需手动改 config

---

## 5. 如何管理已存在的工作流

入口：`Skill("cospec-configure")` → 选 `5. workflows`：

```
5. workflows —— 工作流入口管理（默认 / 注册表 / install / uninstall / sync）
   ├─ 5.1 install        从 vault 选一个，挂到当前 agent + 注册到 options
   ├─ 5.2 uninstall      删除某个 agent 的 bridge（vault 永远保留）
   ├─ 5.3 register       手动把已存在的 skill 名追加到 options
   ├─ 5.4 deregister     从 options 移除 skill 名（vault 不动）
   └─ 5.5 sync/reconcile 对照 vault 扫描 options，发现孤儿 / 缺失并报告
```

### 5.1 跨多个 agent 同时安装

如果你装了 Codex + Claude Code 两套，让两个都能看到同一个工作流：

```bash
# 先装到 Codex
node scripts/workflow-links.mjs install quick-tr1-workflow --install-dir ~/.agents/skills

# 再装到 Claude Code（同一个 vault，两条独立 bridge）
node scripts/workflow-links.mjs install quick-tr1-workflow --install-dir ~/.claude/skills
```

或者用 `cospec-configure` → 5.5 sync 一次性把所有已注册的 custom workflow 装到所有已知 agent。

### 5.2 卸载某 agent 的 bridge

```bash
node scripts/workflow-links.mjs uninstall quick-tr1-workflow --install-dir ~/.agents/skills
```

- 只删 bridge，**不删 vault**
- 如果 bridge 已不存在或被破坏，helper 会报错且不动任何东西
- 卸载后该 agent 看不到此工作流；其它 agent 的 bridge 不受影响

### 5.3 彻底删除工作流

```bash
# 1. 删所有 agent 的 bridge（每个 agent 跑一次 uninstall）
# 2. 从 cospec.config.json 的 workflow.options 移除条目（deregister）
# 3. 最后才删 vault
rm -rf ~/.cospec/workflows/quick-tr1-workflow
```

注意：**先删 bridge 再删 vault**——颠倒顺序会导致 agent 留下指向不存在路径的"断桥"。

---

## 6. 常见问题

### Q1：vault 里的 SKILL.md 改了，多久生效？

下次 agent 启动时（Codex / Claude Code 都在启动期重新扫盘）。**不需要**重启 cospec，不需要重跑 sync。

### Q2：我有多个项目，想给某个项目单独的额外工作流？

vault 是用户级的（`~/.cospec/workflows/`），跨项目共享。如果需要项目级隔离：

- 团队共享 → 把 vault 本身放到 git 仓库里，团队成员各自 `ln -s` 到 `~/.cospec/workflows/`
- 项目级临时工作流 → 暂时不支持——所有 custom workflow 都在用户 vault

### Q3：plugin 升级会清掉我的 workflow.options 吗？

**可能**。如果你用 `codex plugin marketplace upgrade` 重装插件，`cospec.config.json` 可能被重置为默认（不带 `workflow.options` 里的 custom 条目）。**vault 永远不动**，但 registry 与 bridge 可能丢。

**自动检测**（三条路径，看哪个最先触发）：

- **SessionStart hook**（`hooks/session-start`）——每次会话启动时跑 drift 检测，把结果作为 `<system-reminder priority="high">` 注入 session context。客户端是否 surface 给用户由 agent 行为决定，**不保证可见**
- **`brainstorming` Step 1.5**——任何 cospec 入口都会触发，drift 显示在菜单**上方**。用户主动调用就一定能看到
- **`cospec-configure` Step 1**——打开 cospec-configure 立即看到 drift 状态

任一入口触发，drift 都能浮现。

恢复方法：

```bash
# 跑 cospec-configure 5.5 sync——它会扫描 vault，对比 registry，
# 报告未注册的 vault 工作流，让用户决定是否补登
Skill("cospec-configure")

# 然后对每个 agent 重建 bridge
node <plugin-root>/scripts/workflow-links.mjs install <name> \
  --install-dir ~/.agents/skills
node <plugin-root>/scripts/workflow-links.mjs install <name> \
  --install-dir ~/.claude/skills
```

手动验证当前 drift：

```bash
HOME=$HOME \
  node <plugin-root>/hooks/lib/check-vault-drift.mjs \
  <plugin-root>
```

输出 `⚠️ ...` 表示有 drift；`✅ ...` 表示 clean。

### Q4：Windows 上需要管理员吗？

**不需要**。helper 用 `fs.symlink(target, dst, 'junction')`，在 Windows 上等价 `mklink /J`，不需开发者模式或提权。

### Q5：能不用 scaffold-custom-workflow 直接手写吗？

可以。手工路径见 §2.2。**但你必须遵守 Iron Law**：先写失败测试再写 SKILL.md，先观察到 RED 再看到 GREEN。`scaffold-custom-workflow` 帮你强制这条纪律。

### Q6：bridge 删除后 vault 还在，能否重新挂回去？

可以。bridge 是无状态的 symlink——任何时候重跑 install 都会重建。

### Q7：怎么调试"brainstorming 看不到我的工作流"？

1. 检查 vault 是否存在：`ls ~/.cospec/workflows/<name>/SKILL.md`
2. 检查 bridge 是否在：`ls -la ~/.agents/skills/<name>`（应该是指向 vault 的 symlink）
3. 检查 registry：`cat cospec.config.json | grep -A2 workflow.options`
4. 检查 name 一致性：`SKILL.md` 的 frontmatter `name` 必须 = 目录名
5. **重启 agent** —— 启动期才会发现新 skill

---

## 7. 一张图说清所有路径

```
┌─────────────────────────────────────────────────────────────┐
│  USER FILES（用户拥有）                                       │
│   ~/.cospec/workflows/<name>-workflow/SKILL.md  ← 源真理      │
└─────────────────────────────────────────────────────────────┘
        │
        │  symlink / junction（scripts/workflow-links.mjs 创建）
        │
        ├─→ ~/.agents/skills/<name>-workflow       (Codex)
        ├─→ ~/.claude/skills/<name>-workflow       (Claude Code)
        └─→ <project>/.cursor/skills/<name>        (Cursor 项目级)
                                          ▲
                                          │  agent 启动期扫描发现
                                          │
┌─────────────────────────────────────────────────────────────┐
│  PLUGIN FILES（cospec 仓库，可能被升级覆盖）                   │
│   plugins/cospec/cospec.config.json                          │
│     workflow.options: [..., "<name>-workflow"]              │
│   plugins/cospec/skills/brainstorming/SKILL.md                │
│     每次调用读 workflow.options → 生成菜单                   │
└─────────────────────────────────────────────────────────────┘
```

vault 永远在 USER FILES，plugin 升级不会动它。registry 在 PLUGIN FILES，可能被覆盖——sync 可以从 vault 重建。