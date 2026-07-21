---
name: tr2-tech-creator
description: 当用户需要创建 TR2 Tech、从 Feature 或 Story 拆解技术需求、从 TR1 AI 上下文版的 OBJ/INT/NFR/RISK/OPEN 生成可追溯技术方案、接口、数据、部署和技术验收时使用。
---

# Tech 创建器

**Skill 标识**: `tr2-tech-creator`

其他 skill 通过 `tr2-tech-creator` 引用本 skill。

## Purpose

创建 Tech 级技术需求文档。Tech 与 Story 平级，同属于 Feature 层级下，重点说明支撑用户需求所需的技术实现、验收标准、依赖风险和实施方案。

Tech 用来回答“研发怎么实现、如何验收、有什么技术风险”。输入可以来自 Feature/Story，也可以来自 TR1 AI 上下文版的结构化技术上下文。

## When To Use

当用户提出以下任务时使用本 Skill：

- 创建 Tech。
- 从 Feature 拆解技术需求。
- 从 Story 拆解技术实现方案。
- 从 TR1 AI 上下文版生成 Tech。
- 编写 TR2 Tech 文档。
- 定义技术实现方案。
- 补充技术验收标准。
- 编写架构、模块、数据、API 或部署设计。
- 把 DFX 自检项转成 Tech 级技术约束、测试点和质量门禁。

Tech 阶段重点承接相关 DFX 自检项，但不要复制整份 DFX 自检文档。

## Inputs

优先读取父 Feature、对应 Story 和 TR1 AI 上下文版。

当输入为大需求 AI 上下文版时，优先读取以下 ID：

| AI 上下文 ID | Tech 使用方式 |
|--------------|---------------|
| `FEAT-*` / `ST-*` | 作为 Tech 支撑对象 |
| `OBJ-*` | 作为数据对象和字段来源 |
| `INT-*` | 作为接口、集成和依赖来源 |
| `BR-*` / `PERM-*` | 作为技术规则、权限和边界 |
| `NFR-*` | 作为非功能技术约束 |
| `RISK-*` / `OPEN-*` | 作为技术风险和待确认事项 |
| `AC-*` / `TC-*` | 作为技术验收和测试参考 |

输出 Tech 时必须保留 `OBJ/INT/NFR/RISK/OPEN` 来源 ID。未确认技术方案进入 `OPEN-*`，不要直接假设。

## Workflow

1. **明确支撑对象**
   - 确认 Tech 支撑哪个 Feature 或 Story。
   - 保留 `FEAT/ST` 父级追溯。
   - 复杂 Tech 可进一步拆成 SubTech，SubTech 使用同一模板。

2. **定义技术故事**
   - 描述技术目标、范围和边界。
   - 说明涉及模块和模块职责。
   - 写技术方案概述，不只写任务名。

3. **编写功能性验收条件**
   - 写业务规则、技术规则、边界条件和预期结果。
   - 写系统功能约束、具体要求和验证方法。
   - 覆盖正常场景和异常场景。
   - 验收标准必须可测试、可量化。

4. **编写非功能性验收条件**
   - 把相关 DFX 自检项转成 Tech 级技术约束、测试点和质量门禁。
   - 覆盖性能、可靠性、可维护性、开放性、安全性、兼容性、可测试性、可扩展性和产线自定义维度。
   - 不复制整份 DFX 自检文档；如涉及某 DFX 维度，引用并完成对应自检项，不涉及需说明原因。

5. **识别依赖与风险**
   - 写内部功能依赖和外部跨团队协作。
   - 写技术风险、测试风险、影响程度和缓解措施。
   - 普通缺失写“待补充”。
   - 影响技术方案、接口、数据、验收、测试或风险判断的关键不确定项进入 `OPEN-*`。

6. **设计技术思路**
   - 写架构设计、技术选型、核心算法或核心逻辑。
   - 输出系统架构、模块设计、数据设计、数据流转、接口设计、部署方案和回滚方案。
   - 技术方案需要足够指导开发实现。

## Output Contract

Tech 创建在父 Feature 目录下，与 Story 平级：

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
{root-directory}/EPIC-{epic-name}/Feature-{feature-name}/Tech-{tech-name}.md
```

Tech 文档使用模板：`assets/templates/Tech.md`。

Keep the template YAML frontmatter as the first block in the document. Allocate a stable `TECH-*` ID that is not derived from the filename; use the directly supported `FEAT-*`, `ST-*`, or parent `TECH-*` as `parent_artifact_id`; and list the technical traceability IDs under `source_ids`. Set `estimated_day` only when an estimate is available, using increments of 0.5 day; otherwise keep it `null`.

输出文档必须包含以下结构：

1. `1. 【技术故事 *】`
   - 技术故事描述。
   - 涉及模块。
   - 技术方案概述。
   - 说明该 Tech 支撑哪个 Feature 或 Story。

2. `2. 【A/C验收条件 *】`
   - 功能性验收条件：
     - 业务规则、边界。
     - 系统功能约束。
     - 正常场景和异常场景。
   - 非功能性验收条件：
     - 性能分析。
     - 可靠性。
     - 可维护性。
     - 开放性。
     - 安全性。
     - 兼容性、可测试性、可扩展性和产线自定义维度。

3. `3. 【依赖与风险 *】`
   - 需求关联性。
   - 技术风险、测试风险。
   - 缓解措施。

4. `4. 【技术思路 *】`
   - 架构设计。
   - 技术选型。
   - 核心算法或逻辑。
   - 系统架构。
   - 模块设计。
   - 数据设计和数据流转。
   - 接口设计。
   - 部署方案和回滚方案。

层级位置：

```text
EPIC
└── Feature
    ├── Story
    │   └── SubStory
    └── Tech
        └── SubTech（可选，使用同一模板）
```

## Acceptance Criteria

完成任务前逐项检查：

- Tech 是否直接支撑父 Feature 或对应 Story。
- 是否明确 `FEAT/ST` 父级追溯。
- 如输入为 TR1 AI 上下文版，Tech 是否保留 `OBJ/INT/NFR/RISK/OPEN` 来源 ID。
- 是否没有把 `OPEN-*` 或待确认事项写成已确认结论。
- 技术故事是否说明技术目标、范围、边界、涉及模块和技术方案概述。
- 功能性验收是否包含业务规则/边界、系统功能约束、正常场景和异常场景。
- 验收标准是否可测试、可量化。
- 非功能性验收是否把相关 DFX 自检项转成 Tech 级技术约束、测试点和质量门禁。
- 是否没有复制整份 DFX 自检文档；涉及 DFX 维度时是否引用并完成对应自检项。
- 依赖与风险是否包含内部功能依赖、外部跨团队协作、技术风险、测试风险和缓解措施。
- 技术思路是否包含架构设计、技术选型、核心算法或逻辑。
- 技术方案是否包含系统架构、模块设计、数据设计、接口设计、部署方案和回滚方案。
- API、数据、模块和部署设计是否足够指导开发实现。
- 标记为 `*` 的章节是否填写。
- 普通缺失是否写“待补充”。
- 影响技术方案、接口、数据、验收、测试或风险判断的关键不确定项是否进入 `OPEN-*`。
- 可选字段不涉及时是否写“无”或“不涉及”，而不是留空。
- 输出目录和文件名是否符合 `EPIC-{epic-name}/Feature-{feature-name}/Tech-{tech-name}.md` 结构。
- 是否使用 `assets/templates/Tech.md` 的章节结构。
- YAML frontmatter 是否包含唯一稳定的 `TECH-*`、正确的 `artifact_type: tech`、直接支撑对象 ID 和完整 `source_ids`。
- `estimated_day` 有值时是否至少为 0.5 且以 0.5 天为增量；无估算时是否保持 `null`。

## Resources

Templates:

- Tech 模板：`assets/templates/Tech.md`

DFX references:

- 可靠性自检：`assets/DFX自检文档/DFX自检_可靠性.md`
- 可维护性自检：`assets/DFX自检文档/DFX自检_可维护性.md`
- 开放性自检：`assets/DFX自检文档/DFX自检_开放性.md`
- 安全性自检：`assets/DFX自检文档/DFX自检_安全性.md`
