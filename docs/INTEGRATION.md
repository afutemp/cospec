# cospec 接入与扩展指南

本文档面向需要在 cospec 基础上做二次开发或集成自己工作流的外部团队。

---

## 1. 基本概念

cospec 是一个基于 **Skill** 的 AI 工作流插件：

- **Skill**：放在 `skills/<skill-name>/SKILL.md` 的 Markdown 文件，前端带 YAML frontmatter，描述 AI Agent 的触发条件、行为契约和输出格式。
- **主链（Pipeline）**：产品规划的标准流程，由 `brainstorming` 路由给 `product-planning-workflow` 统一编排：

```
brainstorming
    │
    ▼
product-planning-workflow
    ├── requirement-clarification
    ├── [evaluator]
    ├── user-journey-design
    ├── [evaluator]
    ├── tr1-requirements-spec
    └── [evaluator]
```

- **元 Skill**：`using-spec-developer`、`session-context`、`cospec-configure`、`writing-skills` 不参与主链业务，分别负责入口引导、会话持久化、配置向导和 skill 开发方法论。

---

## 2. 调整已有工作流

### 2.1 修改模板

cospec 的文档产物依赖模板，可在不修改 skill 逻辑的前提下替换模板：

1. 准备自己的模板文件（例如 `my-templates/tr1.md`）。
2. 修改 `cospec.config.json` 中的 `templates` 字段，指向新路径：

```json
{
  "templates": {
    "user-requirement": "my-templates/tr1.md",
    "user-journey": "my-templates/journey.md",
    "tr1-large-review": "my-templates/大需求评审版.md",
    "tr1-large-ai": "my-templates/大需求AI上下文版.md",
    "tr1-small-review": "my-templates/小需求评审版.md"
  }
}
```

3. 路径是**相对于插件根目录**的相对路径，也可以是绝对路径。
4. 推荐通过 `cospec-configure` skill 进行交互式配置，它会自动校验文件存在性并写入配置。

### 2.2 修改规范/检查清单（预留扩展点）

如果业务部门有自己的需求检查清单：

1. 准备自己的检查清单目录（例如 `my-rules/checklists/`）。
2. 修改 `cospec.config.json` 中的 `rules.requirement-checklists`：

```json
{
  "rules": {
    "requirement-checklists": "my-rules/checklists/"
  }
}
```

3. 当前 workflow skills 的 **Extension Points** 章节已声明该字段，但尚未在行为层主动读取该目录下的 checklist 文件。
4. 后续接入方式：在 skill 的 Workflow 中增加自审步骤，使用 `Glob`/`Read` 读取 `config.rules["requirement-checklists"]` 目录下的 `.md` 文件，并逐项过 checklist。

### 2.3 启用/替换质量门（Evaluator，预留扩展点）

cospec 在每个 workflow 阶段后预留了 evaluator 配置位：

```json
{
  "evaluators": {
    "requirement-clarification": "requirement-clarification-evaluator",
    "user-journey-design": "user-journey-design-evaluator",
    "tr1-requirements-spec": "tr1-requirements-spec-evaluator"
  }
}
```

- **使用默认 evaluator**：保持为默认 skill 名称。
- **使用自定义 evaluator**：改成你自己的 skill 名称（如 `my-team-tr1-evaluator`）。
- **禁用某个质量门**：将该字段设为 `false`。

当前 workflow skills 的 **Extension Points** 章节已声明这些字段，但尚未在阶段后调度 evaluator。

后续接入方式：在 skill 产出最终交付物后、进入下一阶段前，检查 `config.evaluators["<stage-name>"]`：

- 若为 `false`，跳过；
- 若为字符串，调用对应 skill 名称进行评审，返回等级（如 A/B/C/D/F）和问题列表；
- 评审不通过（如低于 B）则返工，通过才允许进入下一阶段。

### 2.4 修改某个 Skill 的行为

每个 skill 都是纯文本行为契约，修改即改变 AI 行为：

1. 进入 `skills/<skill-name>/SKILL.md`。
2. 重点阅读：
   - `<HARD-GATE>` 块：不可逾越的硬性约束；
   - **扩展点（Extension Points）** 章节：该 skill 读取哪些 `cospec.config.json` 字段；
   - 路由表/阶段表：决定流程流转；
   - Output Contract：产物必须包含的字段；
   - Red Flags/反模式：禁止行为。
3. 小步修改，使用 `writing-skills` 中的测试方法验证（见第 5 节）。

### 2.5 调整路由规则

`brainstorming` 是所有产品规划任务的唯一入口，但只有一个出口：`product-planning-workflow`。要调整阶段判断逻辑：

1. 编辑 `skills/brainstorming/SKILL.md` 中 **Phase 2：路由分发** 的表格。
2. 修改推荐进入阶段（`requirement-clarification` / `user-journey-design` / `tr1-requirements-spec`）。
3. 实际阶段编排和流转逻辑在 `skills/product-planning-workflow/SKILL.md` 中维护。

### 2.6 新增 `brainstorming` 出口（新增独立工作流）

`brainstorming` 当前只有一个出口 `product-planning-workflow`，但设计上支持多个 workflow skill 出口。当你需要增加与产品规划无关的独立工作流时（例如竞品分析、客户反馈分析），应该新建一个 workflow skill 并让 `brainstorming` 路由到它，而不是把逻辑塞进 `product-planning-workflow`。

示例：新增竞品分析工作流

1. 新建 workflow skill：`skills/competitor-analysis-workflow/SKILL.md`
2. 在该 skill 内部编排 `competitor-analysis` 等子 skill
3. 编辑 `skills/brainstorming/SKILL.md` 的 Phase 2 路由表：

```markdown
| 用户输入特征 | 推荐工作流 | 说明 |
|-------------|-----------|------|
| 产品规划相关 | → `product-planning-workflow` | 需求澄清/旅程/TR1 主链 |
| 要做竞品分析 | → `competitor-analysis-workflow` | 独立竞品分析管线 |
```

4. 更新 `README.md`、`CLAUDE.md` 的架构图和 Skill 清单

**原则**：`brainstorming` 判断任务类型，workflow skill 编排子 skill。不要把非产品规划的阶段硬塞进 `product-planning-workflow`。

---

## 3. 新增工作流

### 3.1 在 `product-planning-workflow` 中插入新阶段

当前 `brainstorming` 只有一个出口：`product-planning-workflow`。所有产品规划相关的新阶段都应该在这个工作流 skill 内部编排，而不是直接接入 `brainstorming`。

假设要在 `requirement-clarification` 和 `user-journey-design` 之间新增一个 `competitor-analysis` 阶段：

1. **创建叶子 Skill 目录**：

```
skills/competitor-analysis/
├── SKILL.md
├── README.zh.md          # 可选，人工阅读用
└── references/
    └── analysis-framework.md
```

2. **编写 `SKILL.md`**：

```markdown
---
name: competitor-analysis
description: Use when the user needs to analyze competitors before designing the user journey
---

# Competitor Analysis

**Skill 标识**: `competitor-analysis`

其他 skill 通过 `competitor-analysis` 引用本 skill。

## When To Use
...

## Inputs
...

## Workflow
...

## Output Contract
...
```

3. **接入 `product-planning-workflow`**：
   编辑 `skills/product-planning-workflow/SKILL.md` 的 Pipeline 和 Stage Transitions 章节，在 `requirement-clarification` 之后、`user-journey-design` 之前插入 `competitor-analysis` 阶段。

4. **更新文档**：在 `README.md` 和 `CLAUDE.md` 的 Skill 清单和流程图中补充新阶段。

### 3.2 新增独立工作流（非产品规划主链）

如果是与产品规划无关的独立能力（例如代码评审、测试用例生成）：

1. 同样新建 `skills/<skill-name>/SKILL.md`。
2. **不要接入 `brainstorming`**，避免污染主链。
3. 用户通过直接调用 skill 名称使用，例如 `/skill code-review`。
4. 如果需要在会话启动时自动引导，参考 `using-spec-developer` 的模式。

### 3.3 新增配置项

如果新 skill 需要可配置项：

1. 在 `cospec.config.json` 中添加新的顶层或嵌套字段（推荐放在 `templates`、`rules`、`evaluators`、`kb` 或 `env` 下）。
2. 在 `skills/cospec-configure/references/config-schema.md` 中补充 schema 说明。
3. 在 `skills/cospec-configure/SKILL.md` 中增加交互式配置步骤。
4. 在 skill 的 `SKILL.md` 中增加 **Extension Points** 章节，声明读取哪些 config 字段。
5. 在 skill 内部使用 `Read` 工具读取 `cospec.config.json` 获取配置。

---

## 4. 子 SKILL 的放置规范

### 4.1 目录结构

每个 skill 必须是一个独立目录，且 workflow skill 建议包含 **Extension Points** 章节：

```
skills/<skill-name>/
├── SKILL.md                       # 必填，AI 加载的行为契约
│   ├── When to Use
│   ├── Extension Points           # 声明读取的 cospec.config.json 字段
│   ├── Inputs
│   ├── Workflow
│   ├── Output Contract
│   └── Resources
├── README.zh.md                   # 可选，中文人工参考
├── assets/                        # 可选，模板、图片、示例
│   └── templates/
└── references/                    # 可选，skill 引用的辅助文档
    └── some-reference.md
```

### 4.2 命名规范

- 目录名与 `SKILL.md` frontmatter 中的 `name` 必须一致。
- 使用小写字母、数字和连字符 `-`。
- 禁止带平台前缀（如 `claude-`、`cursor-`）。

### 4.3 子 Skill 引用方式

Skill 之间通过**名称**引用，不带路径前缀：

```markdown
在完成澄清后，调用 `user-journey-design` 继续设计用户旅程。
```

不要写：

```markdown
调用 skills/user-journey-design/SKILL.md
```

### 4.4 静态资源路径

如果 skill 需要引用 templates 或 references 中的文件，路径应相对于 skill 自身目录或插件根目录：

```markdown
Use the template in `assets/templates/document-template.md`.
```

对于跨 skill 的公共资源，使用从插件根目录开始的相对路径：

```markdown
See `templates/user-requirement-template.md` for the default TR1 template.
```

---

## 5. 验证新 Skill

新增或修改 skill 后，必须验证：

1. **结构检查**：`SKILL.md` 是否包含 `name` 和 `description` frontmatter。
2. **行为测试**：参考 `skills/writing-skills/references/testing-skills-with-subagents.md`，使用子 agent 构造压力场景，观察无 skill 和有 skill 时的行为差异。
3. **路由测试**：验证 `brainstorming` 能正确把用户意图路由到新 skill。
4. **配置测试**：如果涉及 `cospec.config.json`，验证 `cospec-configure` 能正确读写。

---

## 6. 插件元数据

发布或fork后，可能需要更新以下文件中的元数据：

| 文件 | 需要关注的内容 |
|------|---------------|
| `.claude-plugin/plugin.json` | name、description、author、homepage、repository |
| `.claude-plugin/marketplace.json` | owner、plugins 列表 |
| `.codex-plugin/plugin.json` | name、version、author |
| `.cursor-plugin/plugin.json` | name、version、author、skills、hooks |
| `.version-bump.json` | 版本号同步的文件路径 |

---

## 7. 快速清单

- [ ] 新建 skill 目录并编写 `SKILL.md`
- [ ] `name` 与目录名一致，仅使用小写和连字符
- [ ] 如需替换模板、规则或 evaluator，更新 `cospec.config.json`
- [ ] 在 workflow skill 的 `SKILL.md` 中声明 Extension Points
- [ ] 如需接入主链，更新 `skills/product-planning-workflow/SKILL.md` 的 Pipeline 和 Stage Transitions
- [ ] 如需调整入口判断，更新 `skills/brainstorming/SKILL.md` 路由表
- [ ] 更新 `README.md` 和 `CLAUDE.md` 的 Skill 清单与流程图
- [ ] 使用 `writing-skills` 方法做行为测试
- [ ] 检查插件元数据是否需要同步修改
