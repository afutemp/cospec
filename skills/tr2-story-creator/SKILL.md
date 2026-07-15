---
name: tr2-story-creator
description: 当用户需要创建 TR2 Story、从 Feature 拆解用户故事、从 TR1 AI 上下文版的 ST/BR/AC/ERR/PERM/NFR 生成可追溯 Story 文档，并补充 A/C 验收、异常场景、权限约束和 Story 级 DFX 验收时使用。
---

# Story 创建器

**Skill 标识**: `tr2-story-creator`

其他 skill 通过 `tr2-story-creator` 引用本 skill。

## Purpose

创建 Story 级用户需求文档。Story 需要从用户视角描述客户问题、需求方案、业务价值、A/C 验收条件、Story 特有 DFX 非功能验收、依赖和风险，并与父 Feature 或 TR1 AI 上下文版中的 `ST/FEAT` 保持可追溯。

Story 必须从用户视角编写，不要写成纯技术任务。复杂 Story 可进一步拆成 SubStory，SubStory 使用同一模板。

## When To Use

当用户提出以下任务时使用本 Skill：

- 创建 Story。
- 从 Feature 拆解用户故事。
- 从 TR1 AI 上下文版生成 Story。
- 编写 TR2 Story 文档。
- 定义用户视角需求。
- 补充 A/C 验收标准。
- 编写 Story 级 DFX 或非功能验收要求。
- 记录开发关注点、测试关注点、依赖、风险和 Story 级 DFX 要求。

通用 DFX 基线只引用自检文档，不复制整份内容。

## Inputs

优先读取父 Feature 和 TR1 AI 上下文版。

当输入为大需求 AI 上下文版时，优先读取以下 ID：

| AI 上下文 ID | Story 使用方式 |
|--------------|----------------|
| `ST-*` | 作为 Story 主体，生成用户需求描述 |
| `FEAT-*` / `EPIC-*` | 作为父级追溯和需求关联 |
| `BR-*` | 进入业务规则、边界和系统功能约束 |
| `AC-*` | 进入 Given/When/Then 场景验收 |
| `ERR-*` | 进入异常场景、边界条件和测试关注点 |
| `PERM-*` | 进入权限、角色约束、业务规则和安全性说明 |
| `NFR-*` | 进入非功能性验收条件 |
| `DEMO-*` / `PB-*` | 作为交互稿、Demo 验证、场景验收和补充材料来源 |
| `OBJ-*` / `INT-*` | 进入开发关注点、开放性、依赖与风险 |
| `OPEN-*` | 进入依赖与风险或待确认事项，不得写成已确认结论 |

输出 Story 时必须保留 `ST/FEAT/BR/AC/ERR/PERM/NFR/OPEN` 来源 ID。

## Workflow

1. **明确父级 Feature 和 Story 来源 ID**
   - 确认 Story 属于哪个 Feature。
   - 保留 `ST/FEAT/EPIC` 父级追溯。
   - Story 过大时拆成 SubStory。

2. **定义客户问题**
   - 说明目标客户或用户角色。
   - 描述客户痛点和影响程度。
   - 不要把技术任务写成客户问题。

3. **设计需求方案**
   - 写解决方案概述、核心功能和预期效果。
   - 核心功能应与父 Feature、业务规则和验收标准保持一致。

4. **补充交互稿、开发关注点和测试关注点**
   - 交互稿地址没有时写“无”或“待补充”。
   - 开发关注点可包括技术难点、接口、对象、权限、边界等。
   - 测试关注点可包括测试重点、特殊场景、数据准备、异常路径等。

5. **编写功能性验收条件**
   - 写业务规则、边界和系统功能约束。
   - 正常场景和异常场景都使用 Given/When/Then。
   - A/C 验收条件必须可测试、可量化。
   - 正常场景和异常场景必须同时覆盖。

6. **编写非功能性验收条件**
   - 覆盖性能、可靠性、可维护性、开放性、安全性、兼容性、可测试性、可扩展性和产线自定义维度。
   - 每个维度都要给出结论；不涉及也要明确写明。
   - 只写 Story 特有约束，通用 DFX 引用自检文档。
   - 不复制整份 DFX 自检文档；如涉及某 DFX 维度，引用并完成对应自检项，不涉及需说明原因。

7. **识别依赖与风险**
   - 写内部功能依赖、外部跨团队协作、技术风险和测试风险。
   - 缺少普通输入时写“待补充”。
   - 影响验收、开发、测试或风险判断的关键不确定项进入 `OPEN-*`。

8. **补充材料链接**
   - 补充需求讨论贴、竞品分析材料、Demo、原型、Feature、TR1 AI 上下文版等。
   - 可选字段如不涉及，写“无”或“不涉及”，不允许留空。

## Output Contract

Story 创建在父 Feature 目录下，与 Tech 平级：

```text
{root-directory}/
└── EPIC-{epic-name}/
    └── Feature-{feature-name}/
        ├── Feature-{feature-name}.md
        ├── Story-{story-name}.md
        └── Tech-{tech-name}.md
```

完整路径：

```text
{root-directory}/EPIC-{epic-name}/Feature-{feature-name}/Story-{story-name}.md
```

Story 文档使用模板：`assets/templates/Story.md`。

输出文档必须包含以下结构：

1. `1. 责任人`
   - 规划、交互等责任人。
   - 缺失时写“待补充”。

2. `2. 用户需求描述`
   - 解决什么客户的什么问题。
   - 需求方案。
   - 目标客户、客户痛点、影响程度、解决方案概述、核心功能和预期效果。

3. `3. 交互稿地址（可选）`
   - 交互稿链接、Demo 链接或“无/待补充”。

4. `4. 需要开发关注的补充说明（可选）`
   - 技术难点、实现注意事项、接口、对象、权限约束。
   - 不涉及写“无”。

5. `5. 需要测试关注的补充说明（可选）`
   - 测试重点、特殊场景、数据准备、异常路径。
   - 不涉及写“无”。

6. `6. 【A/C验收条件 *】`
   - 功能性验收条件：
     - 业务规则、边界。
     - 系统功能约束。
     - 正常场景和异常场景。
   - 场景验收必须使用 `AC ID / Given / When / Then / 指标/证据`。
   - 非功能性验收条件必须覆盖性能、可靠性、可维护性、开放性、安全性和其他维度。

7. `7. 【依赖与风险 *】`
   - 需求关联性。
   - 技术风险、测试风险。

8. `8. 其他补充说明（可选）`
   - 需求讨论贴、竞品分析材料等补充资料。

层级位置：

```text
EPIC
└── Feature
    ├── Story
    │   └── SubStory（可选，使用同一模板）
    └── Tech
        └── SubTech
```

## Acceptance Criteria

完成任务前逐项检查：

- Story 是否从用户视角编写，而不是纯技术任务。
- Story 是否明确父级 Feature 和 `ST/FEAT/EPIC` 来源 ID。
- 如输入为 TR1 AI 上下文版，Story 是否保留 `ST/FEAT/BR/AC/ERR/PERM/NFR/OPEN` 来源 ID。
- 是否没有把 `OPEN-*` 或待确认事项写成已确认结论。
- 是否填写目标客户、客户痛点、影响程度、需求方案、核心功能和预期效果。
- 交互稿、开发关注点、测试关注点如不涉及，是否写“无”或“不涉及”，而不是留空。
- 标记为 `*` 的章节是否填写，尤其是 `6. 【A/C验收条件 *】` 和 `7. 【依赖与风险 *】`。
- 功能性验收是否包含业务规则/边界、系统功能约束、正常场景和异常场景。
- A/C 验收条件是否可测试、可量化，并使用 Given/When/Then。
- 正常场景和异常场景是否同时覆盖。
- 非功能性验收条件的每个维度是否给出结论；不涉及是否明确写明。
- 是否没有复制整份 DFX 自检文档；涉及 DFX 维度时是否引用并完成对应自检项。
- 是否识别内部功能依赖、外部跨团队协作、技术风险和测试风险。
- 普通缺失是否写“待补充”。
- 影响验收、开发、测试或风险判断的关键不确定项是否进入 `OPEN-*`。
- Story 过大时是否拆成 SubStory。
- 输出目录和文件名是否符合 `EPIC-{epic-name}/Feature-{feature-name}/Story-{story-name}.md` 结构。
- 是否使用 `assets/templates/Story.md` 的章节结构。

## Resources

Templates:

- Story 模板：`assets/templates/Story.md`

