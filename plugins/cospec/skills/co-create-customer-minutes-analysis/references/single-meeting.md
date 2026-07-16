# Single Meeting Analysis

Use this workflow for one complete meeting note, transcript, interview record, or customer conversation.

## Deliverable

Create a Markdown file named `会议价值提取报告_vN.md` unless the user specifies another name. Do not overwrite an existing report; increment `vN`.

## Steps

1. Read source metadata:
   - Meeting title, date, customer or organization, participants, file path.
   - If missing, mark `not reflected`.
2. Read the meeting once for comprehension before producing the report:
   - Identify unclear speaker identities, customer roles, terms, product names, acronyms, business context, or transcript errors.
   - For unclear transcript words, first try matching likely terms from `云计算`、`网络安全`、`AI 应用`领域.
   - Record suspected corrections as `疑似术语` with domain and confidence; do not silently replace the original wording.
   - If these uncertainties affect product interpretation, pause and ask the user concise clarification questions before continuing.
   - Ask at most 3 questions at one time. Prioritize questions that affect demand priority, customer authority, or the meaning of a key challenge.
   - If the user cannot clarify, continue only after marking the uncertainty explicitly in the report.
3. Identify discussion themes:
   - Extract 3-8 real discussion themes.
   - Write themes as business/product alignment topics, not agenda labels.
4. Extract customer responses to our ideas:
   - `Approved`: customer explicitly agrees, shows interest, asks for next step, or confirms value.
   - `Challenged`: customer questions feasibility, priority, value, cost, risk, deployment, accuracy, responsibility, or current timing.
   - `Reframed`: customer accepts the direction but shifts the use case, priority, owner, phase, or success criteria.
5. Derive deeper needs and pain points:
   - Separate explicit pain points from inferred pain points.
   - Tie each pain point to environment, process, risk, user, or decision constraint.
6. Convert to product validation input:
   - Product assumptions validated, challenged, or unverified.
   - Candidate product capability, feature direction, value proposition, or product strategy adjustment.
   - Exclude pure operations, deployment arrangements, onsite handling, manual support, staffing, scheduling, or customer coordination.
   - Include deployment or support topics only when they reveal a product requirement, such as 自助接入、自动诊断、回滚、可观测性、可靠性、配置简化.

## Product Input Filter

Chapter 5 should focus on product-related inputs only.

Include:

- Product value proposition changes.
- Product capability gaps.
- Feature direction or feature priority.
- Product assumptions validated or challenged.
- Product strategy, packaging, policy, or workflow design implications.
- Productized ways to reduce operational burden, such as 自助配置、自动诊断、回滚、配置模板、内置指引.

Exclude:

- Onsite support arrangements.
- Who will deploy or help the customer.
- Test user recruitment.
- Project scheduling.
- Manual document delivery.
- Temporary workaround operations.
- Internal staffing or coordination issues.

## Clarification Triggers

Ask before writing the final Markdown report when any of these are unclear and materially affect interpretation:

- Whether a speaker is `我方` or `客户方`.
- A customer speaker's岗位/角色, especially decision-maker,信安,IT,研发,使用方.
- A product or internal term that changes the meaning of a requirement.
- A transcript word that is likely a `云计算`、`网络安全`、`AI 应用`术语 but cannot be confidently identified.
- Whether a statement is customer approval, customer challenge, or our own explanation.
- Whether a topic is short-term trial scope or long-term roadmap.

## Markdown Report Structure

```markdown
# 会议价值提取报告

## 0. 来源与参与人

| 项目 | 内容 |
|---|---|
| 来源文件 |  |
| 会议时间 |  |
| 客户/组织 |  |
| 参与人及代号 |  |

## 1. 这次会议主要讲了什么

| 主题 | 讨论内容 | 对产品判断的影响 | 客户原话 |
|---|---|---|---|

## 2. 客户认可了什么

| 被认可方向 | 客户原话 | 为什么说明认可 |
|---|---|---|

## 3. 客户挑战、质疑或重新定义了什么

| 被挑战方向 | 客户原话 | 挑战点 |
|---|---|---|

## 4. 更深层需求与痛点

| 需求/痛点 | 类型 | 客户原话 | 解读 | 影响对象 | 紧急程度 |
|---|---|---|---|---|---|

## 5. 可转化为产品输入

| 产品输入 | 对应客户问题/痛点 | 价值判断 | 产品能力/方向 | 客户原话 | 建议处理 |
|---|---|---|---|---|---|

## 6. 产品结论

- 结论 1：
- 结论 2：
- 结论 3：

## 7. 术语校正与不确定点

| 原文词语/不确定点 | 疑似术语/解释 | 参考领域 | 置信度 | 需要补充什么 |
|---|---|---|---|---|
```

## Interpretation Notes

- `认可` requires customer-side evidence. Our own explanation is not approval.
- `挑战` includes soft signals such as repeated concerns, scope narrowing, owner transfer, or asking for proof.
- `更深层需求` should explain why the customer said it, not only what they said.
- `产品输入` should focus on product capability, value proposition, feature direction, product strategy, or requirement pool. Do not include pure operations, deployment, onsite support, manual handling, or scheduling items.
- `术语校正` should prioritize `云计算`、`网络安全`、`AI 应用` terminology. Keep the original wording visible and mark corrections as suspected.
- Final report tables should show customer quotes directly. Do not include full file paths, source links, or line-number links in quote cells.
