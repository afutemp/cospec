# 工作流与 SKILL 步骤对照

> 来源：从上层目录截图 `企业微信截图_17835611213928.png` 提取的工作流步骤。  
> 记录时间：2026-07-15

---

## 大需求工作流

| 步骤 | skill 名称 | 中文简称 | 备注 |
|---|---|---|---|
| step1 | `product-planning-prompt` | 产品规划输入需求+Prompt | |
| step2 | `co-create-customer-minutes-analysis` | 共创客户验证分析 | |
| step2 | `customer-experience-feedback-analysis-v2` | 用户体验反馈分析 | |
| step2 | `competitor-feature-research` | 竞品功能研究 | 竞品分析三个 skill 按需选择 |
| step2 | `competitor-pain-points` | 竞品痛点收集 | 竞品分析三个 skill 按需选择 |
| step2 | `competitor-problem-solving` | 竞品解法研究 | 竞品分析三个 skill 按需选择 |
| step3 | `user-journey-design` | 用户旅程设计 | |
| step4 | `tr1-requirements-spec` | TR1 需求规格 | |
| step5 | `tr2-epic-creator` | EPIC 生成 | |
| step5 | `tr2-feature-creator` | Feature 生成 | |
| step5 | `tr2-story-creator` | Story 生成 | |
| step5 | `tr2-tech-creator` | Tech 需求 | |

---

## 小需求工作流

| 步骤 | skill 名称 | 中文简称 | 备注 |
|---|---|---|---|
| step1 | `product-planning-prompt` | 产品规划输入需求+Prompt | |
| step2 | `user-journey-design` | 用户旅程设计 | |
| step3 | `tr1-requirements-spec` | TR1 需求规格 | |

---

## 说明

- **实现映射**：本对照表定义的两条工作流已在 cospec 中实现为 `large-requirement-workflow`（大需求）与 `small-requirement-workflow`（小需求）两个 workflow entry skill，由 `brainstorming` 按需求规模路由。
- **step1 的 skill 名称**：本表沿用截图标签 `product-planning-prompt`；实际导入并调用的 skill 名称为 `product-planning-requirement-clarification`（`skills/product-planning-requirement-clarification/`）。两个工作流的 step1 均调用该 skill。
- **大需求工作流**的 step2 包含多个研究/分析类 skill。本对照表沿用截图原始标注「竞品三个 skill 按需选择」；**实现中 step2 全部 5 个研究 skill 均为必选并发**（不做按需裁剪），缺少输入材料时由对应 skill 通过 `NEEDS_CONTEXT` 向用户索取。
- **大需求工作流**的 step5 生成 TR2 相关产物：`tr2-epic-creator`（EPIC）、`tr2-feature-creator`（Feature）、`tr2-story-creator`（Story）、`tr2-tech-creator`（Tech 需求）。
- **小需求工作流**相当于大需求工作流的精简版：
  - 没有共创/客户反馈/竞品分析步骤；
  - 没有 TR2 相关产物（EPIC、Feature、Story、Tech 需求）；
  - 到 `tr1-requirements-spec` 结束。
