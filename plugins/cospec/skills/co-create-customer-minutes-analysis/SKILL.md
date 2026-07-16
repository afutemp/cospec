---
name: co-create-customer-minutes-analysis
description: Use when analyzing customer co-creation meeting notes, raw transcripts, interview records, or multiple meeting files to produce Markdown product-validation reports with customer quote evidence, approvals, challenges, needs, pain points, product inputs, cross-meeting common needs, and distribution ratios.
---

# 共创客户纪要分析

**Skill 标识**: `co-create-customer-minutes-analysis`

其他 skill 通过 `co-create-customer-minutes-analysis` 引用本 skill。

## Purpose

把客户共创会议、产品验证会议、客户访谈、原始对话转写或多场会议材料，转化为可用于产品判断的验证输入，而不是普通会议摘要。

核心要求：所有重要结论、客户挑战、客户认可、需求痛点和产品建议，都必须能追溯到客户原话。证据不足时，必须标为 `Inferred` 或 `Not reflected`。

最终必须生成 Markdown 报告文件，不能只在聊天中回答。聊天回复只返回报告路径、关键结论摘要和覆盖限制。

## When To Use

- 用户提供客户共创会议纪要、客户访谈、产品价值验证会议、销售/解决方案/产品经理与客户的沟通记录。
- 用户要求识别客户认可、客户挑战、深层需求、痛点、产品假设、价值主张、产品能力或需求池输入。
- 用户提供多份会议材料，要求做共性需求、覆盖比例、跨会议价值验证、趋势分析或分歧场景分析。
- 用户索要客户会议分析输入模板。

不用于只整理普通会议待办、内部会议纪要、实施排期、人员分工或现场支持计划，除非这些内容反映出明确的产品能力要求。

## Inputs

- 会议原始内容：会议纪要、逐字稿、访谈记录、聊天记录或已生成的单会分析报告。
- 分析模式：`single meeting analysis` 或 `multi-meeting analysis`。
- 可选元信息：会议标题、日期、客户/组织、参与人、说话人身份、客户岗位、会议目标。

如果用户没有明确分析模式，必须先暂停并询问：`这次是做单次会议分析，还是多次会议共性分析？` 不要只根据文件数量推断。

如果用户询问如何提供会议材料，使用模板：`assets/templates/meeting-input-template.md`。

## Workflow

1. 确认分析模式。
   - 用户明确说单次会议、完整会议、多个会议、共性需求、分布分析或跨会议对比时，按其表达选择模式。
   - 用户只提供一堆文件或粘贴内容但模式不清楚时，先问模式。
2. 选择对应资源。
   - 单次会议：读取 `references/single-meeting.md`。
   - 多次会议：读取 `references/multi-meeting.md`。
   - 内容很长、文件很多或可能超上下文：同时读取 `references/large-context.md`。
   - 用户要输入模板：读取 `assets/templates/meeting-input-template.md`。
3. 建立来源清单。
   - 记录文件名、会议日期、客户名称、参与角色和粗略内容长度。
   - 身份影响判断但缺失时，询问用户是否补充；无法补充则在报告中标为 `identity not provided, inferred from wording`。
4. 创建说话人代号。
   - 客户用 `C1`、`C2`，我方用 `Us1`、`Us2`，其他角色可用 `PM1` 等紧凑代号。
   - 不得虚构组织、职务或决策权。
5. 保留证据并区分事实层级。
   - 优先使用客户原话，不把我方陈述当成客户验证。
   - 内部分析可用文件和行号定位证据；最终报告表格只展示客户原话，不展示完整路径、行号或 Markdown 链接。
   - 将结论标为 `Observed`、`Inferred` 或 `Not reflected`。
6. 处理转写和长上下文。
   - 密集时间戳且无分析价值时，运行 `scripts/remove_timestamps.py <input> -o <cleaned-output>`。
   - 清理脚本不可用时，手工忽略无产品意义的时间戳，但保留说话人、顺序和原话。
   - 对疑似转写错误，优先结合 `云计算`、`网络安全`、`AI 应用`术语，标为 `疑似术语` 并说明置信度。
7. 生成决策导向报告。
   - 单次会议报告命名为 `会议价值提取报告_vN.md`。
   - 多次会议报告命名为 `多会议共性需求分析报告_vN.md`。
   - 同名文件已存在时递增版本，不覆盖已有文件。
   - 尽量保存到用户当前项目根目录，除非用户指定其他路径。

## Output Contract

单次会议报告必须遵循 `references/single-meeting.md` 的 Markdown 结构，至少包含：

- 来源与参与人。
- 会议主要讨论主题。
- 客户认可内容。
- 客户挑战、质疑或重新定义内容。
- 深层需求与痛点。
- 可转化为产品输入。
- 产品结论。
- 术语校正与不确定点。

多次会议报告必须遵循 `references/multi-meeting.md` 的 Markdown 结构，至少包含：

- 分析范围。
- 共性客户问题与痛点分布。
- 共性价值验证结果。
- 共性挑战或质疑。
- 可沉淀的产品输入。
- 分歧与细分场景。
- 产品验证结论。

报告默认使用中文。表格优先用于比较、需求、挑战、证据和分布统计。

## Acceptance Criteria

- 已明确使用单次会议分析或多次会议共性分析；模式不清时已先询问用户。
- 已按模式读取对应资源：单会读取 `references/single-meeting.md`，多会读取 `references/multi-meeting.md`，长上下文场景读取 `references/large-context.md`。
- 已生成 Markdown 文件，并在同名文件存在时递增版本号，没有覆盖旧报告。
- 关键结论、客户认可、客户挑战、需求痛点和产品输入均有客户原话支撑；证据不足处已标为 `Inferred` 或 `Not reflected`。
- 最终报告表格中的证据只展示客户原话，没有暴露完整文件路径、行号链接或外部链接。
- 没有把我方陈述当作客户认可，也没有把同一会议内重复表达误算为多次客户验证。
- 产品输入章节只保留产品能力、价值主张、功能方向、产品策略或需求池相关内容；纯运营、部署、现场支持、排期和协调内容已排除，除非它们体现产品能力要求。
- 多会分析的覆盖比例按有效会议数、客户/组织数或角色数计算，不按 quote 数或 chunk 数计算。
- 疑似转写错误或术语不确定点已在报告中标注原文、疑似术语、参考领域、置信度和需要补充的信息。
- 聊天收尾包含报告文件路径、最重要发现摘要、来源覆盖限制或缺失信息。

## Resources

- Input template: `assets/templates/meeting-input-template.md`
- Single meeting workflow: `references/single-meeting.md`
- Multi-meeting workflow: `references/multi-meeting.md`
- Large-context handling: `references/large-context.md`
- Timestamp cleanup script: `scripts/remove_timestamps.py`

脚本用途：清理原始转写中密集且无产品分析意义的时间戳，保留说话人标签和原始表达。

运行方式：

```bash
python3 scripts/remove_timestamps.py <input-transcript> -o <cleaned-output>
```
