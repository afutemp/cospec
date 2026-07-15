# Multiple Meeting Analysis

Use this workflow when the user chooses multi-meeting analysis or asks for common needs, patterns, distribution, cross-customer validation, or trend analysis across several meetings.

## Deliverable

Create a Markdown file named `多会议共性需求分析报告_vN.md` unless the user specifies another name. Do not overwrite an existing report; increment `vN`.

If raw meeting transcripts are provided, also create one single-meeting Markdown report per meeting by following `references/single-meeting.md` before producing the multi-meeting report.

## Core Logic

Analyze multiple raw meetings in two stages:

1. Stage 1: Per-meeting analysis.
   - Treat each raw dialogue transcript as an independent single meeting.
   - Run the single-meeting workflow for each meeting.
   - Generate a standalone `会议价值提取报告_vN.md` for each meeting.
   - Keep customer quotes in those per-meeting reports.
2. Stage 2: Cross-meeting synthesis.
   - Use the generated single-meeting reports as the primary input.
   - Do not reload every full raw transcript unless a specific quote or ambiguity must be checked.
   - Cluster common customer problems, validated values, challenged values, pain points, and product inputs from the per-meeting reports.
   - Calculate distribution from meetings/customers represented by the single-meeting reports, not from raw quote count.

This two-stage process protects context: raw transcripts are condensed into structured reports first; cross-meeting analysis operates on those reports.

## Source Type Decision

- If inputs are raw dialogue transcripts: first generate per-meeting single reports, then synthesize.
- If inputs are already single-meeting reports created by this skill: skip Stage 1 and synthesize directly.
- If inputs mix raw transcripts and existing reports: generate missing single reports only for raw transcripts, then synthesize all reports together.
- If a source boundary is unclear, ask the user which files or sections belong to each meeting.

## Unit of Counting

Default denominator is `valid meetings`, not quote count.

- Need coverage = number of meetings where the need appears / total valid meetings.
- Customer coverage = number of distinct customer organizations where the need appears / total organizations, if organization data exists.
- Role coverage = number of distinct role types where the need appears / role types observed, if role data exists.

If one meeting repeats the same need many times, count it once for meeting coverage. Repetition can be mentioned as signal strength, but not as distribution share.

## Steps

1. Confirm multi-meeting intent:
   - Only use this workflow after the user chooses multi-meeting analysis or explicitly asks for common needs, distribution, cross-meeting comparison, or trend analysis.
   - If the user has provided multiple files but wants each meeting analyzed independently, use the single-meeting workflow for each meeting instead.
2. Build meeting inventory:
   - File or report, date if available, customer/org if available, participant role, source type (`raw transcript` or `single-meeting report`), source quality, whether usable.
3. Produce missing per-meeting reports:
   - For every raw transcript, run `references/single-meeting.md` first.
   - Save the generated report path in the inventory.
   - If a single meeting has clarification blockers, resolve them before using it in the synthesis; otherwise mark its uncertainty in both reports.
4. Extract structured signals from per-meeting reports:
   - Validated customer problems.
   - Accepted value propositions.
   - Challenged or unproven value propositions.
   - Customer current state and pain points.
   - Product inputs from chapter 5 of each single report.
   - Representative customer quotes.
5. Cluster needs and values:
   - Merge semantically equivalent needs even if wording differs.
   - Keep product-facing names concrete.
   - Preserve customer-specific variants inside each cluster.
6. Calculate distribution:
   - Meeting coverage.
   - Customer/org coverage when available.
   - Role coverage when available.
   - Evidence strength: high, medium, low.
7. Identify cross-meeting conclusions:
   - Common customer problems.
   - Common validated values.
   - Repeated challenges to our value proposition.
   - Reusable product inputs.
   - Divergent needs by customer segment, role, deployment environment, or maturity.

## Markdown Report Structure

```markdown
# 多会议共性需求分析报告

## 0. 分析范围

| 会议 | 来源 | 来源类型 | 日期 | 客户/组织 | 参与角色 | 是否纳入统计 | 备注 |
|---|---|---|---|---|---|---|---|

## 1. 共性客户问题与痛点分布

| 共性问题/痛点 | 覆盖会议数 | 覆盖占比 | 覆盖客户/组织 | 典型客户原话 | 证据强度 | 产品启发 |
|---|---:|---:|---|---|---|---|

## 2. 共性价值验证结果

| 价值主张 | 覆盖情况 | 客户反馈 | 代表原话 | 验证结果 | 产品判断 |
|---|---|---|---|---|---|

## 3. 共性挑战或质疑

| 被挑战价值/方向 | 覆盖情况 | 代表原话 | 挑战本质 | 产品启发 |
|---|---|---|---|---|

## 4. 可沉淀的产品输入

| 产品输入 | 来源会议 | 对应客户问题 | 价值判断 | 产品能力/方向 | 建议处理 |
|---|---|---|---|---|---|

## 5. 分歧与细分场景

| 分歧点 | 哪些会议/客户体现 | 可能原因 | 产品策略 |
|---|---|---|---|

## 6. 产品验证结论

- 结论 1：
- 结论 2：
- 结论 3：
```

## Distribution Rules

- If source quality differs, include `source quality` and avoid false precision.
- If customer identity is unknown, calculate meeting coverage only.
- If meetings are from the same customer and same project phase, do not overstate market universality.
- If a need appears in only one meeting but has strong decision impact, mark it as `low coverage, high impact`.
- Provide at least one representative customer quote per major need cluster; include more quotes when customer segments differ.
- Final report quote cells should contain customer wording only. Do not include source file links, full paths, or line-number links.
