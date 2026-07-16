---
name: product-kb-eval
description: 评估受管产品规划知识库质量。先执行结构、来源、Feature覆盖、链接和文件安全规则，再按语义量表评价战略、用户问题、功能闭环、路线图、风险验证和无虚构质量。触发词：评估产品知识库、检查规划质量、知识库评分、找知识库问题。
---

# 产品规划知识库评估

1. 读取 `.product-kb-meta.json`、正式快照和 Manifest，确认基线可评估。
2. 调用 `product-kb-core/scripts/validate.js` 生成规则报告。Eval **不得修改规划 Markdown**。
3. 按 `references/semantic-rubric.md` 独立评估每个维度。每项必须包含本地文件、IPD 来源 ID、理由、分数和 finding；缺来源时明确标记阻塞。
4. 快照/Meta 不可读时不猜测来源真实性，只输出阻塞报告。个别文档缺失时可做受限评估并降低覆盖率。
5. 将结构化语义结果写 `.source/semantic-evaluation.json`，调用 Core `evaluate.js` 合并为 `.source/evaluation-report.json/md`。
6. 红线：缺来源、无来源关键结论、Feature 严重遗漏、改写非受管文件、状态 JSON 损坏仍宣称通过、把 `status` 非 `parsed` 的附件当作正文证据。任一红线等级 F。
7. 输出分数、等级、覆盖率、红线、问题和 repairQueue。仅评估，不自动进入 Optimize；用户要求修复时再调用 `product-kb-optimize`。

失败维度可单独重试，最多两次。量表版本固定为 1.0.0。
