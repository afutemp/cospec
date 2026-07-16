# cospec 接入与扩展指南

本文档面向需要在 cospec 基础上做二次开发或集成自己工作流的外部团队。

---

## 1. 基本概念

cospec 是一个基于 **Skill** 的 AI 工作流插件：

- **Skill**：放在 `skills/<skill-name>/SKILL.md` 的 Markdown 文件，前端带 YAML frontmatter，描述 AI Agent 的触发条件、行为契约和输出格式。
- **主链（Pipeline）**：产品规划的标准流程，由 `brainstorming` 路由到合适的 workflow entry skill，再由 workflow entry skill 在主会话中串行调用各 leaf skill：

```
brainstorming
    │
    ├─→ large-requirement-workflow
    │       │
    │       ▼
    │   product-planning-requirement-clarification
    │   co-create / customer-experience / competitor-*  (step2, 5 个串行)
    │   user-journey-design
    │   tr1-requirements-spec
    │   tr2-epic / tr2-feature / tr2-story / tr2-tech
    │
    └─→ small-requirement-workflow
            │
            ▼
        product-planning-requirement-clarification
        user-journey-design
        tr1-requirements-spec
```

- **Workflow Entry Skill**：编排一组 leaf skills 的入口 skill，例如 `large-requirement-workflow`、`small-requirement-workflow`。它在主会话中直接串行调用各 leaf skill。
- **Leaf Skill**：实际执行业务步骤的 skill，例如 `product-planning-requirement-clarification`、`user-journey-design`、`tr1-requirements-spec`。
- **元 Skill**：`using-spec-developer`、`cospec-configure`、`writing-skills` 不参与主链业务。

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
    "product-planning-requirement-clarification": "product-planning-requirement-clarification-evaluator",
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

### 2.4 工作流编排

cospec 的 workflow entry skills 在主会话中直接串行调用各 leaf skill。

```
large-requirement-workflow
        │
        ▼
Skill("product-planning-requirement-clarification")
        │
        ▼
Skill("co-create-customer-minutes-analysis")
Skill("customer-experience-feedback-analysis-v2")
Skill("competitor-feature-research")
Skill("competitor-pain-points")
Skill("competitor-problem-solving")
        │
        ▼
Skill("user-journey-design")
        │
        ▼
Skill("tr1-requirements-spec")
        │
        ▼
Skill("tr2-epic-creator")
Skill("tr2-feature-creator")
Skill("tr2-story-creator")
Skill("tr2-tech-creator")
```

特点：

- 每个 step 的 leaf skill 通过 `Skill("<skill-name>")` 直接调用，用户交互 inline。
- Skill 按 step1 → step2(5个) → step3 → step4 → step5(4个) 顺序串行执行。
- 各 skill 在执行过程中需要用户输入时直接提问，无需中间层。
- 当前默认 workflow 为线性串行。未来可在 workflow entry skill 中调整编排逻辑。

### 2.5 修改某个 Skill 的行为

每个 skill 都是纯文本行为契约，修改即改变 AI 行为：

1. 进入 `skills/<skill-name>/SKILL.md`。
2. 重点阅读：
   - `<HARD-GATE>` 块：不可逾越的硬性约束；
   - **扩展点（Extension Points）** 章节：该 skill 读取哪些 `cospec.config.json` 字段；
   - 路由表/阶段表：决定流程流转；
   - Output Contract：产物必须包含的字段；
   - Red Flags/反模式：禁止行为。
3. 小步修改，使用 `writing-skills` 中的测试方法验证（见第 5 节）。

### 2.6 调整路由规则

`brainstorming` 是所有产品规划任务的唯一入口，它选择 workflow entry skill 并调用之。要调整入口判断逻辑：

1. 编辑 `skills/brainstorming/SKILL.md` 中 **Phase 2：路由分发** 的表格。
2. 修改推荐的 workflow entry skill（`large-requirement-workflow` / `small-requirement-workflow` / 未来新增的 workflow）。
3. 实际阶段编排和流转逻辑在对应的 workflow entry skill（如 `skills/large-requirement-workflow/SKILL.md`）中维护。

### 2.7 新增 `brainstorming` 出口（新增独立工作流）

`brainstorming` 当前默认出口为 `large-requirement-workflow`，也支持 `small-requirement-workflow`。当你需要增加其它产品规划相关的工作流时，应该新建一个 workflow entry skill 并让 `brainstorming` 路由到它，而不是把逻辑塞进 `large-requirement-workflow`。

示例：新增竞品分析工作流

1. 新建 workflow entry skill：`skills/product-planning-with-competitor-workflow/SKILL.md`
2. 在该 skill 内部编排 `product-planning-requirement-clarification`、`competitor-analysis`、`user-journey-design`、`tr1-requirements-spec` 等子 skill
3. 编辑 `skills/brainstorming/SKILL.md` 的 Phase 2 路由表：

```markdown
| 用户输入特征 | 推荐工作流 | 说明 |
|-------------|-----------|------|
| 产品规划相关 | → `large-requirement-workflow` | 需求澄清/旅程/TR1 主链 |
| 要做竞品分析 | → `product-planning-with-competitor-workflow` | 带竞品分析的管线 |
| 直接写 TR1 | → `small-requirement-workflow` | 直出 TR1 |
```

4. 更新 `README.md`、`CLAUDE.md` 的架构图和 Skill 清单

**原则**：`brainstorming` 判断任务类型并选择 workflow entry skill，workflow entry skill 编排子 skill。不要把不同 workflow 的阶段硬塞进 `large-requirement-workflow`。

---

## 3. 接入知识库（KB）

cospec 支持通过 `cospec.config.json` 的 `kb` 字段接入产品知识库，并默认启用 `product-kb-query` skill 在调用 leaf skills 前统一注入 KB 上下文。

**默认不内置任何具体知识库内容**。插件提供 `download-kb` skill，用于把预置知识库下载到当前工作目录。

### 3.1 下载预置知识库

当前支持下载 `vdi` 知识库：

```
/download-kb vdi
```

执行后会将知识库复制到当前工作目录的 `vdi-kb/` 下。

### 3.2 配置方式

下载后，修改 `cospec.config.json` 的 `kb.localPath` 指向该目录（相对插件根目录或绝对路径）。例如下载到当前目录时：

```json
{
  "kb": {
    "skill": "product-kb-query",
    "localPath": "vdi-kb/"
  }
}
```

`kb.localPath` 默认为 `null`（不启用文件型 KB）。配置后 `product-kb-query` 仅使用该路径，不做自动探测。**推荐运行 `/download-kb vdi` 自动下载并配置，无需手动修改。**

| 字段 | 说明 |
| :--- | :--- |
| `kb.skill` | 主 KB 查询 skill 名称。默认 `product-kb-query`；设为 `null` 可禁用 skill 查询。 |
| `kb.localPath` | 本地知识库目录（相对插件根目录或绝对路径）。默认 `null`（不启用）。必须显式配置才能使用文件型 KB。 |

### 3.3 KB 上下文注入

当 leaf skill 需要产品知识库上下文时，在其 SKILL.md 的 Workflow 中显式调用 `product-kb-query`：

1. 读取 `cospec.config.json` 检查 `kb.skill` 和 `kb.localPath` 是否已配置。
2. 如果配置可用，调用 `kb.skill` 并传入查询，将返回结果作为背景上下文。

### 3.4 替换为自己的知识库

如果你有自己的产品知识库：

1. 准备按 `product-planning-kb` 目录结构整理的 markdown 文件（`00-综述/`、`01-用户与机会/`、`02-规划与范围/`、`03-功能规划/`、`04-质量与约束/`、`05-协作与依赖/`、`06-验证与反馈/`、`附录/`、`README.md`）。
2. 将目录放到当前工作目录或插件根目录下，例如 `my-product-kb/`。
3. 修改 `cospec.config.json`：
   ```json
   {
     "kb": {
       "skill": "product-kb-query",
       "localPath": "my-product-kb/"
     }
   }
   ```
4. 运行 `/product-kb-query "你的问题"` 验证查询是否正常。

### 3.5 替换为自己的 KB 查询 skill

如果你希望用自定义 skill 替代 `product-kb-query`：

1. 新建 `skills/<my-kb-skill>/SKILL.md`，实现同样的输入输出契约：接收一个具体问题字符串，返回带来源标注的结构化 Markdown 回答。
2. 修改 `cospec.config.json`：
   ```json
   {
     "kb": {
       "skill": "my-kb-skill",
       "localPath": "my-product-kb/"
     }
   }
   ```
3. 自定义 skill 会在对应 leaf skill 的 Workflow 中被按需调用。

### 3.6 禁用 KB 注入

将 `cospec.config.json` 中的 `kb.skill` 设为 `null`：

```json
{
  "kb": {
    "skill": null,
    "localPath": "doc/kb/"
  }
}
```

此时不再调用任何 KB skill，workflow 仍正常运行，只是 leaf skills 不会收到额外知识库上下文。

### 3.7 扩展 download-kb 支持更多知识库

`download-kb` 当前内置 `vdi` 映射。要增加新的预置知识库：

1. 编辑 `skills/download-kb/SKILL.md` 的 **Inputs** 表格和 **Workflow** 中的源路径映射。
2. 更新 README、CLAUDE.md 中 `download-kb` 的职责说明。

---

## 4. 新增工作流

### 4.1 修改现有 Workflow Entry Skill

当前 `brainstorming` 默认出口为 `large-requirement-workflow`。所有产品规划相关的新阶段都应该在对应的 workflow entry skill 内部编排，而不是直接接入 `brainstorming`。

假设要在 `large-requirement-workflow` 的 `product-planning-requirement-clarification` 和 `user-journey-design` 之间新增一个 `competitor-analysis` 节点：

1. **创建 Leaf Skill 目录**：

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

3. **接入 `large-requirement-workflow`**：
   编辑 `skills/large-requirement-workflow/SKILL.md`，在 step 列表中插入 `Skill("competitor-analysis")`。

4. **更新文档**：在 `README.md` 和 `CLAUDE.md` 的 Skill 清单和流程图中补充新节点。

### 4.2 新增 Workflow Entry Skill

如果要新增一个完整 workflow（例如 `product-planning-with-competitor-workflow`）：

1. 新建 workflow entry skill 目录：

```
skills/product-planning-with-competitor-workflow/
├── SKILL.md
└── README.zh.md
```

2. 在 `SKILL.md` 中声明本 workflow 的节点列表和串行调用步骤（参考 `large-requirement-workflow`）。

3. 在 `skills/brainstorming/SKILL.md` 路由表中增加该 workflow 的触发条件。

4. 更新 `README.md`、`CLAUDE.md`、`docs/INTEGRATION.md`。

### 4.3 新增独立工作流（非产品规划主链）

如果是与产品规划无关的独立能力（例如代码评审、测试用例生成）：

1. 同样新建 `skills/<skill-name>/SKILL.md`。
2. **不要接入 `brainstorming`**，避免污染主链。
3. 用户通过直接调用 skill 名称使用，例如 `/skill code-review`。
4. 如果需要在会话启动时自动引导，参考 `using-spec-developer` 的模式。

### 4.4 新增配置项

如果新 skill 需要可配置项：

1. 在 `cospec.config.json` 中添加新的顶层或嵌套字段（推荐放在 `templates`、`rules`、`evaluators`、`kb`、`env` 或 `workflow` 下）。
2. 在 `skills/cospec-configure/references/config-schema.md` 中补充 schema 说明。
3. 在 `skills/cospec-configure/SKILL.md` 中增加交互式配置步骤。
4. 在 skill 的 `SKILL.md` 中增加 **Extension Points** 章节，声明读取哪些 config 字段。
5. 在 skill 内部使用 `Read` 工具读取 `cospec.config.json` 获取配置。

> 注意：workflow 拓扑本身定义在 workflow entry skill 的 prompt 中，不由 `cospec.config.json` 配置节点关系。`cospec.config.json` 中只保留 `workflow.default` 等轻量入口配置。

---

## 5. 子 SKILL 的放置规范

### 5.1 目录结构

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

### 5.2 命名规范

- 目录名与 `SKILL.md` frontmatter 中的 `name` 必须一致。
- 使用小写字母、数字和连字符 `-`。
- 禁止带平台前缀（如 `claude-`、`cursor-`）。

### 5.3 子 Skill 引用方式

Skill 之间通过**名称**引用，不带路径前缀：

```markdown
在完成澄清后，调用 `user-journey-design` 继续设计用户旅程。
```

不要写：

```markdown
调用 skills/user-journey-design/SKILL.md
```

### 5.4 静态资源路径

如果 skill 需要引用 templates 或 references 中的文件，路径应相对于 skill 自身目录或插件根目录：

```markdown
Use the template in `assets/templates/document-template.md`.
```

对于跨 skill 的公共资源，使用从插件根目录开始的相对路径：

```markdown
See `templates/user-requirement-template.md` for the default TR1 template.
```

---

## 6. 验证新 Skill

新增或修改 skill 后，必须验证：

1. **结构检查**：`SKILL.md` 是否包含 `name` 和 `description` frontmatter。
2. **行为测试**：参考 `skills/writing-skills/references/testing-skills-with-subagents.md`，使用子 agent 构造压力场景，观察无 skill 和有 skill 时的行为差异。
3. **路由测试**：验证 `brainstorming` 能正确把用户意图路由到新 skill。
4. **配置测试**：如果涉及 `cospec.config.json`，验证 `cospec-configure` 能正确读写。

---

## 7. 插件元数据

发布或fork后，可能需要更新以下文件中的元数据：

| 文件 | 需要关注的内容 |
|------|---------------|
| `.claude-plugin/plugin.json` | name、description、author、homepage、repository |
| `.claude-plugin/marketplace.json` | owner、plugins 列表 |
| `.codex-plugin/plugin.json` | name、version、author |
| `.cursor-plugin/plugin.json` | name、version、author、skills、hooks |
| `.version-bump.json` | 版本号同步的文件路径 |

---

## 8. 快速清单

- [ ] 新建 skill 目录并编写 `SKILL.md`
- [ ] `name` 与目录名一致，仅使用小写和连字符
- [ ] 如需替换模板、规则或 evaluator，更新 `cospec.config.json`
- [ ] 如需接入知识库，更新 `cospec.config.json` 的 `kb` 字段
- [ ] 在 workflow skill 的 `SKILL.md` 中声明 Extension Points
- [ ] 如需修改现有 workflow，更新对应的 workflow entry skill
- [ ] 如需新增 workflow，新建 workflow entry skill 并在 `brainstorming` 路由表中注册
- [ ] 如需调整入口判断，更新 `skills/brainstorming/SKILL.md` 路由表
- [ ] 更新 `README.md` 和 `CLAUDE.md` 的 Skill 清单与流程图
- [ ] 使用 `writing-skills` 方法做行为测试
- [ ] 检查插件元数据是否需要同步修改
