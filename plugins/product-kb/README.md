# Product KB

面向产品规划的 Claude Code / OpenAI Codex Plugin。它以千流 IPD 为首个权威数据源，将 Epic、Feature、Story、评论、附件正文和项目生命周期信息转换为可追溯的产品规划知识库，并提供生成、增量更新、质量评估、证据内优化和本地查询能力。

## 核心能力

| Skill | 用途 |
|---|---|
| `/product-kb:product-kb` | 根据用户意图和知识库状态调度生命周期操作 |
| `/product-kb:product-kb-init` | 从 IPD 项目范围或一个/多个根需求首次生成知识库 |
| `/product-kb:product-kb-update` | 采集新快照、预览差异，确认后更新受管文档 |
| `/product-kb:product-kb-eval` | 执行确定性规则校验和基于来源证据的语义评估 |
| `/product-kb:product-kb-optimize` | 根据评估报告预览并应用有 IPD 证据支持的修复 |
| `/product-kb:product-kb-query` | 查询本地规划文档、元数据和生成时 IPD 快照 |

共享的确定性实现位于 `scripts/product-kb-core/`，它不是用户可直接触发的 Skill。

## 使用示例

```text
从 IPD 项目 100672 版本 5368 生成产品规划知识库到 ./product-kb
从 Epic 1093659 初始化规划知识库
预览 ./product-kb 的 IPD 增量变化
评估 ./product-kb 的规划质量
根据评估报告优化 ./product-kb
查询 ./product-kb 中开发中的高优先级 Feature 由谁负责
```

## IPD 配置

产品知识库复用 `qianliu-ipd` 的只读查询能力。默认配置文件：

```text
~/.qianliu/config.json
```

示例：

```json
{
  "ipd": {
    "token": "your-ipd-token",
    "product": "产品名称"
  }
}
```

也可以通过 `QIANLIU_CONFIG_PATH` 指定其他配置文件。Token、认证 Header 和配置正文不会写入知识库快照或评估报告。

## 生成目录

```text
product-kb/
├── README.md
├── .product-kb-meta.json
├── 00-综述/
├── 01-用户与机会/
├── 02-规划与范围/
├── 03-功能规划/          # 每个 Feature 一份文档
├── 04-质量与约束/
├── 05-协作与依赖/
├── 06-验证与反馈/
├── 附录/
└── .source/
    ├── source-snapshot.json
    ├── attachments/              # 按 Issue/Attachment 保存下载原文件
    ├── managed-manifest.json
    ├── validation-report.json
    ├── evaluation-report.json
    ├── pending-update/
    ├── pending-optimize/
    └── backups/
```

## 内容与安全约束

- 同一轮生成只读取一个固定源快照，各文档生成任务不会分别访问 IPD。
- 关键结论附 `IPD-<id>` 和来源链接；证据不足写 `[OPEN] IPD 未提供`。
- 默认下载需求附件并解析正文；支持文本、Markdown、HTML、JSON、CSV、PDF、DOCX、XLSX、PPTX。原文件保存在 `.source/attachments/`，快照记录来源、指纹、解析器、状态和正文。
- 空文件、超限、下载失败、解析失败或不支持格式会保留可用元数据/原文件并生成结构化 warning，禁止静默忽略或把未解析附件当证据。
- 生成文档采用整文件受管；非受管文件不会被 Update 或 Optimize 修改、覆盖或删除。
- Update 和 Optimize 都先生成预览，并分别等待用户确认。
- 删除受管文件必须同时满足 Meta、Manifest 和管理标记三重证明。
- Core 拒绝路径穿越、符号链接逃逸和通过受管操作覆盖非受管文件。

## 仓库结构

```text
.claude-plugin/
  plugin.json
.codex-plugin/
  plugin.json
skills/
  qianliu-ipd/           # IPD API 查询和管理能力
  product-kb/            # 生命周期总调度
  product-kb-init/
  product-kb-update/
  product-kb-eval/
  product-kb-optimize/
  product-kb-query/
scripts/
  product-kb-core/       # 共享脚本、契约和测试
templates/
  product-planning-kb/   # 产品规划文档模板
```

## 测试与验证

```bash
node --test scripts/product-kb-core/tests/*.test.js
claude plugin validate .
python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

当前自动化测试覆盖采集、HTML 规范化、附件下载与解析、空文件/不支持格式/下载失败降级、层级树、稳定指纹、真实 IPD 字段兼容、增量差异、受管文件安全、路径与符号链接防护、确定性校验、评估合并、查询及 Skill 路由契约。

## 本地加载

### Claude Code

```bash
claude --plugin-dir .
```

加载后 Skills 位于 `product-kb` namespace。

### OpenAI Codex

在仓库根目录执行：

```bash
codex plugin marketplace add .
codex plugin add product-kb@cospec-marketplace
```

安装后新建 Codex 对话，使新增 Skills 生效。
