# Meeting Input Template

Use this reference when the user asks how to provide meeting notes, wants a standardized template, or when a single-meeting source is too messy for reliable analysis.

## Required Principle

Preserve the original dialogue order and speaker turns. Do not merge multiple speakers into one paragraph. Do not rewrite customer wording before analysis.

For single-meeting analysis, keep the input lean. The most important metadata is who spoke, whether the speaker is our side or the customer side, and the customer speaker's role or position.

## Single-Meeting Markdown Template

```markdown
# 会议纪要输入模板

## 0. 会议源信息

| 字段 | 必选/可选 | 内容 |
|---|---|---|
| 会议标题 | 必选 |  |
| 会议日期 | 可选 | YYYY-MM-DD |
| 会议时间 | 可选 | HH:MM-HH:MM |
| 会议目标 | 可选 | 这次会议希望确认什么 |

## 1. 参与人和说话人代号

| 代号 | 姓名/显示名 | 所属方 | 客户岗位/我方角色 | 身份确定性 |
|---|---|---|---|---|
| Us1 |  | 我方 | 产品/技术/销售/其他 | 确定/推测/未知 |
| C1 |  | 客户方 | 决策者/使用方/信安/IT/研发/业务/其他 | 确定/推测/未知 |
| C2 |  | 客户方 | 决策者/使用方/信安/IT/研发/业务/其他 | 确定/推测/未知 |

## 2. 用户补充背景（可选）

- 我方当前方案/产品假设：
- 本次希望重点分析的问题：
- 需要特别关注的竞品、试点、风险或约束：

## 3. 原始对话

> 推荐格式：每个说话轮次一个段落，必须包含说话人代号、说话人显示名和原话。时间戳可选；如果已有时间戳，可以保留，也可以先用时间戳清理脚本删除。

Us1 赵智鹏：
原话内容。

C1 王宇超：
原话内容。

Us1 赵智鹏：
原话内容。
```

## Minimum Acceptable Transcript Format

If the user cannot provide the full template, require at least:

```text
会议标题：

参与人：
- Us1：姓名，我方，角色
- C1：姓名，客户方，岗位/角色

原始对话：
Us1 姓名：原话
C1 姓名：原话
Us1 姓名：原话
```

## Field Requirements

- `会议标题`: Required. If unknown, write `未知`.
- `会议日期`: Optional for one meeting; useful for later multi-meeting comparison.
- `会议时间`: Optional. Do not require it for analysis.
- `会议目标`: Optional but useful when the meeting is long.
- `所属方`: Required. Must distinguish `我方` from `客户方`.
- `客户岗位/我方角色`: Required when known. Customer role strongly affects interpretation of demand priority.
- `身份确定性`: Required when role or organization is inferred. Use `确定`, `推测`, or `未知`.
- `时间戳`: Optional. It can help locate evidence but should not consume context when the transcript is long.
- `原始对话`: Required. Keep original wording, including awkward transcript text, unless separately marked as corrected.

## Timestamp Handling

When timestamps are dense and do not carry product meaning, remove them before analysis to reduce context cost. Use `scripts/remove_timestamps.py` from this skill root.

Keep timestamps only when the user needs audio/video alignment, legal traceability, or precise meeting playback references.

## Quality Rules

- Keep customer wording intact. Add corrections only in a separate note.
- Preserve speaker turns and chronological order.
- Include names or stable speaker IDs whenever possible.
- Do not remove deployment constraints, support concerns, procurement comments, customer objections, or small remarks about usage difficulty; these often become product requirements.
- It is acceptable to remove greetings, meeting-room logistics, repeated filler, and timestamps when they have no product or customer-value meaning.

## Multi-Meeting Package Format

For multiple meetings, provide either separate files or one Markdown file with this structure:

```markdown
# 多会议输入包

## 会议清单

| 编号 | 文件/章节 | 日期 | 客户/组织 | 主题 | 备注 |
|---|---|---|---|---|---|
| M1 |  |  |  |  |  |
| M2 |  |  |  |  |  |

## M1：会议标题

按单会模板填写。

## M2：会议标题

按单会模板填写。
```
