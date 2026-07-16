---
name: tr2-epic-creator
description: 当用户需要创建 TR2 EPIC、从 TR1 AI 上下文版的 VAL/REQ/EPIC/PB/OPEN 生成可追溯 EPIC 文档、从 DCP2-1 价值点沉淀高层特性需求和价值实现目标时使用。
---

# EPIC 创建器

**Skill 标识**: `tr2-epic-creator`

其他 skill 通过 `tr2-epic-creator` 引用本 skill。

## Purpose

创建 EPIC 级需求文档。EPIC 是需求层级中的最高层，承接 DCP2-1 关键价值点或 TR1 AI 上下文版中的 `VAL/REQ/EPIC`，并向下拆解为 Feature、Story、Tech、SubStory 和 SubTech。

EPIC 聚焦业务价值和高层能力边界，不写过细技术实现，也不细化到 Story 或 Tech 粒度。

## When To Use

当用户提出以下任务时使用本 Skill：

- 创建 EPIC。
- 编写 TR2 EPIC 文档。
- 从 TR1 AI 上下文版生成 EPIC。
- 从 DCP2-1 价值点生成 EPIC。
- 定义高层功能特性和业务价值边界。
- 沉淀 EPIC 级价值实现目标。
- 记录战略价值目标、价值实现程度、主场景 Playbook、关键注意事项和责任人。

## Inputs

优先读取 TR1 AI 上下文版，其次读取 DCP2-1 或 TR1 评审材料。

当输入为 TR1 AI 上下文版时，优先读取以下 ID：

| AI 上下文 ID | EPIC 使用方式 |
|--------------|---------------|
| `VAL-*` | 作为 EPIC 关键价值点来源 |
| `REQ-*` | 作为 EPIC 需求目标和范围来源 |
| `EPIC-*` | 作为 EPIC 草案或直接生成对象 |
| `PB-*` / `DEMO-*` | 作为主场景 Playbook 和验证材料 |
| `OPEN-*` | 作为关键注意事项或待确认事项 |

输入不足时：

- 普通缺失写“待补充”。
- 影响 EPIC 价值范围、价值分类、主场景、评审决策或后续 Feature 拆解的关键不确定项进入 `OPEN-*`。
- 不得把待确认事项写成已确认结论。

## Workflow

1. **确定 EPIC 来源**
   - 优先从 TR1 AI 上下文版读取 `VAL/REQ/EPIC`。
   - 没有 AI 上下文版时，从 DCP2-1 读取关键价值点、目标客户、场景、痛点和价值主张。
   - 保留来源 ID，尤其是 `VAL/REQ/EPIC/PB/OPEN`。

2. **提取关键价值点**
   - 直接承接 DCP2-1 材料中的价值点，或 TR1 AI 上下文版中的 `VAL/REQ`。
   - 明确客户、场景、痛点和预期收益。
   - 不把技术方案写成价值点。

3. **定义价值实现程度**
   - 说明该 EPIC 如何实现价值、如何衡量、如何验收。
   - 尽量使用可衡量指标，例如覆盖率、成功率、响应时间、风险降低比例。
   - 写清楚设计、开发、测试验收过程中要持续检查的目标。

4. **选择价值分类**
   - 至少选择一个分类：基本可用、满足主流体验、构建竞争优势。
   - 分类要与 DCP2-1 规划一致。
   - 如果选择“构建竞争优势”，必须说明相对竞品或现有能力的差异。

5. **填写 TR1 结论**
   - 功能规划：计划用什么功能满足价值目标。
   - 创新点：关键创新点、差异化点或设计突破。
   - 产品主场景 Playbook：关联主场景验证文档。
   - 关键注意事项：风险、边界、依赖、特殊约束和 `OPEN-*`。

6. **分配责任人和辅助材料**
   - 明确用户需求设计责任人、技术需求设计责任人、开发实现责任人。
   - 关联 DCP2-1 立项报告、技术需求设计结论、TR1 用户需求设计结论等材料。

7. **检查 EPIC 粒度**
   - 每个 EPIC 只承接一组强相关价值点。
   - 过宽时拆分多个 EPIC。
   - 过细、已接近用户场景或实现任务时，应下沉到 Feature、Story 或 Tech。

## Output Contract

每个 EPIC 创建独立目录：

```text
{output-directory}/
└── EPIC-{epic-name}/
    └── EPIC-{epic-name}.md
```

完整路径：

```text
{root-directory}/EPIC-{name}/EPIC-{name}.md
```

EPIC 文档使用模板：`assets/templates/EPIC.md`。

输出文档必须包含以下结构：

1. `【DCP2-1--关键价值点】`
   - 写与本 EPIC 相关的关键价值点。
   - 保留 `VAL/REQ/EPIC` 来源 ID。

2. `【DCP2-1--价值实现程度】`
   - 写价值实现程度、衡量方式和验收关注点。
   - 尽量可衡量、可验收。

3. `【DCP2-1--关联价值分类】`
   - 至少选择一个分类：基本可用 / 满足主流体验 / 构建竞争优势。
   - 选择竞争优势时说明差异化依据。

4. `【TR1-用户需求/技术需求设计结论】`
   - 本特性价值规划结论。
   - 创新点总结。
   - 产品主场景 Playbook。
   - 关键注意事项、风险、边界和 `OPEN-*`。

5. `【责任人】`
   - 用户需求设计责任人。
   - 技术需求设计责任人。
   - 开发实现责任人。

6. `【相关的辅助材料】`
   - DCP2-1 立项报告。
   - 技术需求设计结论。
   - TR1 用户需求设计结论。

7. `【其他备注信息】`
   - 按需补充，不承载主结论。

层级位置：

```text
EPIC
├── Feature 1
│   ├── Story 1.1
│   │   └── SubStory 1.1.1（可选）
│   └── Tech 1.1
│       └── SubTech 1.1.1（可选）
└── Feature 2
```

## Acceptance Criteria

完成任务前逐项检查：

- EPIC 是否直接映射到 DCP2-1 关键价值点，或 TR1 AI 上下文版中的 `VAL/REQ/EPIC`。
- 如输入为 TR1 AI 上下文版，EPIC 是否保留 `VAL/REQ/EPIC/PB/OPEN` 来源 ID。
- 是否没有把 `OPEN-*` 或待确认事项写成已确认结论。
- 关键价值点是否明确客户、场景、痛点和预期收益。
- 价值实现程度是否具体、可衡量、可验收。
- 价值分类是否与立项规划一致。
- 如果选择“构建竞争优势”，是否说明相对竞品或现有能力的差异。
- TR1 功能规划、创新点、Playbook 和关键注意事项是否完整。
- 是否明确责任人；缺失时是否写“待补充”。
- 是否关联相关辅助材料；缺失时是否写“待补充”。
- EPIC 是否能够继续拆解为 Feature，而不是已经细到 Story 或 Tech。
- EPIC 范围是否聚焦；过宽时是否拆分多个 EPIC。
- 输出目录和文件名是否符合 `EPIC-{name}/EPIC-{name}.md` 结构。
- 是否使用 `assets/templates/EPIC.md` 的章节结构。

## Resources

Templates:

- EPIC 模板：`assets/templates/EPIC.md`

