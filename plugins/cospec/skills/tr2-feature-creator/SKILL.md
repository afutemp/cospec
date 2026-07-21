---
name: tr2-feature-creator
description: 当用户需要创建 TR2 Feature、从 EPIC 拆解 Feature、从 TR1 AI 上下文版的 FEAT/BR/AC/DEMO/NFR 生成可追溯 Feature 文档，并定义功能边界、Playbook、验收标准和 Feature 级 DFX 约束时使用。
---

# Feature 创建器

**Skill 标识**: `tr2-feature-creator`

其他 skill 通过 `tr2-feature-creator` 引用本 skill。

## Purpose

创建 Feature 级需求文档。Feature 承接 EPIC 价值点，也可以直接承接 TR1 AI 上下文版中的 `FEAT`，并向下拆解为 Story 和 Tech，是连接业务价值与研发实现的关键层级。

Feature 应聚焦可交付功能、功能边界、功能级 Playbook、验收标准和 Feature 特有 DFX 约束。

## When To Use

当用户提出以下任务时使用本 Skill：

- 创建 Feature。
- 从 EPIC 拆解 Feature。
- 从 TR1 AI 上下文版生成 Feature。
- 编写 TR2 Feature 文档。
- 定义特性级需求。
- 为 Feature 编写功能级 Playbook。
- 定义 Feature 级验收标准和 DFX 约束。

## Inputs

优先读取 TR1 AI 上下文版，其次读取父 EPIC 文档或 TR1 评审材料。

当输入为大需求 AI 上下文版时，优先读取以下 ID：

| AI 上下文 ID | Feature 使用方式 |
|--------------|------------------|
| `FEAT-*` | 作为 Feature 主体 |
| `EPIC-*` / `VAL-*` / `REQ-*` | 作为父级价值和需求来源 |
| `BR-*` | 作为业务规则和边界 |
| `AC-*` | 作为验收标准来源 |
| `DEMO-*` / `PB-*` | 作为功能级 Playbook 或 Demo 关联 |
| `NFR-*` | 作为 Feature 特有非功能约束 |
| `OPEN-*` | 作为待确认事项 |

输出 Feature 时必须保留来源 ID，尤其是 `FEAT/BR/AC/DEMO/NFR`。待确认事项不得写成已确认结论。

## Workflow

1. **关联父 EPIC**
   - 确认父 EPIC 的价值点、目标和范围边界。
   - 从 `EPIC/VAL/REQ` 继承价值来源。
   - 说明本 Feature 解决哪个客户问题、贡献哪个价值点。

2. **定义 Feature 主体**
   - 优先读取 `FEAT-*`。
   - 明确 Feature 名称、功能说明、优先级、对应 Demo 和状态。
   - Feature 应能继续拆解为 Story 和 Tech，不要细到单个开发任务。

3. **细化特性分类**
   - 在 EPIC 分类基础上进一步细化。
   - 至少判断是否属于：基本可用、满足主流体验、构建竞争优势。
   - 如果选择“构建竞争优势”，说明差异化能力、创新点和竞争优势。

4. **创建功能级 Playbook**
   - 给出 1-3 个可验证业务场景。
   - 每个 Playbook 都要能验证一个真实用户场景。
   - 不只列功能点，要写出场景、痛点、操作和价值。

5. **补充关键交互说明**
   - 如存在关键界面、复杂流程、状态切换或用户操作风险，补充交互说明、设计稿或原型链接。
   - 如果不涉及，写“无”或“不涉及”。

6. **定义验收标准**
   - 功能验收和非功能验收都要可测量。
   - 同时覆盖正常场景和异常场景。
   - 验收标准必须能关联 `BR/AC/DEMO/NFR`。

7. **补充 DFX 约束**
   - 只写本 Feature 特有要求。
   - 通用 DFX 仅引用自检文档，不复制整份 DFX 基线。
   - 不涉及的维度说明“不涉及”或“无”。

8. **分配责任人**
   - 明确用户需求设计责任人、技术需求设计责任人、开发实现责任人。
   - 缺失时写“待补充”。

## Output Contract

Feature 创建在父 EPIC 目录下：

```text
{root-directory}/
└── EPIC-{epic-name}/
    ├── EPIC-{epic-name}.md
    └── Feature-{feature-name}/
        └── Feature-{feature-name}.md
```

完整路径：

```text
{root-directory}/EPIC-{epic-name}/Feature-{feature-name}/Feature-{feature-name}.md
```

Feature 文档使用模板：`assets/templates/Feature.md`。

Keep the template YAML frontmatter as the first block in the document. Use the primary `FEAT-*` as `artifact_id`, the parent `EPIC-*` as `parent_artifact_id`, and list every directly used traceability ID under `source_ids`. Do not derive IDs from filenames.

输出文档必须包含以下结构：

1. `【关联关键价值点】`
   - 明确来自哪个 EPIC。
   - 说明本 Feature 解决哪个客户问题、贡献哪个价值点。
   - 保留 `EPIC/VAL/REQ/FEAT` 来源 ID。

2. `【TR1--特性需求分类】`
   - 选择基本可用、满足主流体验、构建竞争优势中的适用分类。
   - 说明分类依据。

3. `【TR1-功能级Playbook】`
   - 说明该 Feature 如何解决客户问题。
   - 至少包含场景、痛点、操作和价值。

4. `【TR1-关键交互说明--可选】`
   - 记录交互设计说明、原型链接或关键状态。
   - 不涉及时写“无”或“不涉及”。

5. `【TR1/TR2-特性验收条件】`
   - 功能性验收条件：验收项、预期效果、验收指标、验收结果。
   - 非功能性验收条件：性能、可靠性、安全性等。
   - 验收标准必须具体、可量化、可测试。

6. `【TR1/TR2非功能需求约束--DFX等】`
   - 只填写本 Feature 特有 DFX 要求。
   - 通用 DFX 不复制到本文档，只引用对应 DFX 自检项。
   - 不涉及的维度说明“无”或“不涉及”。

7. `【责任人】`
   - 用户需求设计责任人。
   - 技术需求设计责任人。
   - 开发实现责任人。

8. `【其他备注信息】`
   - 放需求讨论贴、竞品分析材料等补充资料，不承载主结论。

层级位置：

```text
EPIC
├── Feature
│   ├── Story
│   │   └── SubStory（可选）
│   └── Tech
│       └── SubTech（可选）
└── Feature
```

下一步：

- 使用 `tr2-story-creator` 创建 Story。
- 使用 `tr2-tech-creator` 创建 Tech。

## Acceptance Criteria

完成任务前逐项检查：

- Feature 是否映射到明确客户问题。
- Feature 是否继承父 EPIC 的价值点和范围。
- 如输入为 TR1 AI 上下文版，Feature 是否保留 `FEAT/BR/AC/DEMO/NFR` 来源 ID。
- 是否没有把 `OPEN-*` 或待确认事项写成已确认结论。
- Feature 名称、功能说明、优先级、对应 Demo 和状态是否明确。
- 特性分类是否有依据，且与父 EPIC 或 TR1 规划一致。
- Playbook 是否能说明真实使用场景，而不只是功能点列表。
- 关键交互说明是否在存在复杂界面、流程或状态时补充；不涉及时是否写“无”或“不涉及”。
- 功能验收和非功能验收是否具体、可量化、可测试。
- 是否同时考虑正常场景和异常场景。
- DFX 是否只补充 Feature 特有约束，通用要求是否仅引用自检文档。
- 是否明确责任人；缺失时是否写“待补充”。
- Feature 范围是否聚焦；过宽时是否拆分多个 Feature。
- Feature 是否能够继续拆解为 Story 和 Tech，而不是已经细到单个 Story 或技术任务。
- 输出目录和文件名是否符合 `EPIC-{epic-name}/Feature-{feature-name}/Feature-{feature-name}.md` 结构。
- 是否使用 `assets/templates/Feature.md` 的章节结构。
- YAML frontmatter 是否包含唯一稳定的 `FEAT-*`、正确的 `artifact_type: feature`、父 `EPIC-*` 和完整 `source_ids`。

## Resources

Templates:

- Feature 模板：`assets/templates/Feature.md`
