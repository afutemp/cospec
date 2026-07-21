# sync-to-ipd 实施计划

## 目标

新增独立 Skill `sync-to-ipd`，将 cospec 大需求流程生成的 Epic、Feature、Story、Tech 同步为 IPD 需求条目，并同步大需求 TR1 评审版和 AI 上下文版文档。

`sync-to-ipd` 作为 cospec 侧适配器，复用 product-kb 插件提供的 `qianliu-ipd` 能力，不复制 IPD API 实现。

## 调用与交互

支持 Claude Code 的 `/sync-to-ipd [产物目录]`、Codex 的 `$sync-to-ipd [产物目录]`，以及“把当前 cospec 产物同步到 IPD”等自然语言触发。

执行流程固定如下：

1. 扫描指定目录；未指定时扫描当前工作目录下的 `product-planning/`。展示 TR1 文件和 Epic、Feature、Story、Tech 数量；存在多套完整产物时要求用户选择。
2. 检查 `qianliu-ipd` 和本地 Token。依赖缺失时停止并给出安装指引；Token 缺失时要求用户在本地配置，禁止在对话、文件和日志中输入或输出 Token。
3. 查询并选择现有 IPD 产品、项目、版本和团队。可复用上次目标，但必须让用户确认；v1 不创建产品、项目或版本。
4. 查询真实阶段、活动和交付物列表，由用户明确选择 TR1 评审版对应的交付物，不做模糊匹配。
5. TR1 评审版上传至所选交付物，AI 上下文版上传至根 Epic 附件；没有合适交付物时，两份文档都上传至根 Epic 附件。只有一个根 Epic时自动选择，多个时要求用户选择。
6. 生成只读预览，展示目标环境、创建、更新、不变、冲突数量，TR1 上传位置，以及明确不会执行的删除、状态修改等动作。
7. 冲突只允许绑定已有 IPD ID、修正本地产物或取消。绑定只更新本地同步索引，然后重新生成预览。
8. 用户必须回复“确认执行”才能写入。确认只对当前 `planHash` 有效；文件、目标或远端状态变化后必须重新预览和确认。
9. 按 Epic、Feature、Story、Tech、TR1 评审版、TR1 AI 上下文版的顺序执行。中途失败立即停止，报告成功项和待处理项；重跑时跳过已成功且内容未变化的项目。

## 接口与状态

`qianliu-ipd` 新增 `syncManifest` 动作和 `sync_from_manifest.js`，保留原有 `sync_from_docs.js`。动作接收 `mode=preview|apply`、`manifestPath`、`indexPath`、产品、项目、版本、团队 ID、TR1 路由和 `expectedPlanHash`。`preview` 禁止调用写接口，`apply` 必须校验哈希一致。

新生成的 TR2 文档增加稳定元数据：

```yaml
cospec_artifact:
  schema_version: 1
  artifact_id: FEAT-001
  artifact_type: feature
  parent_artifact_id: EPIC-001
  source_ids:
    - REQ-001
    - FEAT-001
```

Epic、Feature、Story 继承 TR1 可追溯 ID，Tech 使用稳定的 `TECH-*` ID。已有文档进入显式迁移预览，禁止仅凭文件名静默关联。

同步状态保存到产物目录下的 `.ipd-sync/manifest.json`、`.ipd-sync/index.json` 和 `.ipd-sync/preview.md`。索引以稳定产物 ID 映射 IPD ID，并保存类型、父级、内容哈希、附件哈希和上次目标。

远端匹配优先使用索引中的 IPD ID，并校验项目、类型和父级。同名但无可靠 ID、类型不一致、父级不一致、重复稳定 ID 均视为冲突。Tech 可直接归属 Feature 或 Story，不创建隐含 Story。

v1 仅同步名称、描述、层级、项目、版本、团队和 Tech 工作量；不修改状态、负责人和优先级，不删除远端条目。TR1 附件按文件哈希去重；内容变化时先上传新文件，成功后再更新关联。

## 验证标准

- 按 `writing-skills` 完成 RED、GREEN、REFACTOR：记录至少三个未加载 `sync-to-ipd` 的失败场景，再加载 Skill 复测。
- 单元测试覆盖产物发现、缺失 TR1、多套产物、多个根 Epic、旧文档迁移、层级错误、稳定 ID 冲突、创建、更新、重命名、幂等、部分失败恢复和索引失效。
- 安全测试证明 `preview` 零写调用、Token 不进入输出、计划漂移阻断执行、未确认不得写入、依赖或配置缺失时安全停止。
- TR1 测试覆盖交付物上传、无交付物回退、根 Epic 选择、哈希跳过和内容变化后的替换。
- 保持 product-kb 和 cospec 既有测试通过，并运行 Node 语法检查、Skill 校验、JSON、YAML 校验和 `git diff --check`。
- 真实 IPD 冒烟测试只在用户另行确认后使用非生产项目执行。

## 边界

- v1 只支持生成 TR1 和 TR2 的 cospec 大需求流程。
- 不自动安装依赖，不修改 `.env`，不创建 IPD 产品、项目或版本，不删除需求，不发布插件，不部署生产。
- 实施过程中保留工作区已有未跟踪文件和无关改动；提交前展示完整 diff 并取得明确确认。

## 实施验证记录

### RED：未加载 `sync-to-ipd`

使用三个隔离场景验证模型在没有本 Skill 约束时的默认行为。其中直接同步场景出现了跳过最终逐项确认、先同步 TR1 后创建需求层级、外部写入失败后自动重试等偏差；无合适交付物场景错误地建议选择或新建顶层交付物，没有回退到用户选择的根 Epic；计划漂移场景作为安全对照，能够主动重新预览。三个场景共暴露了至少四项需要由 Skill 固化的高风险偏差。

### GREEN：加载 `sync-to-ipd`

对相同场景加载本 Skill 后复测：所有场景都要求最终回复字面量“确认执行”；同名条目必须通过本地索引显式绑定；没有合适交付物时，两份 TR1 文档都路由到用户选择的根 Epic；文件、目标或远端状态变化会使旧确认失效；父级不一致会阻断执行；外部失败后停止且不自动重试。

### 自动化与静态验证

- cospec 侧 `generate-demo` 与 `sync-to-ipd` 合并测试共 22 项通过，其中 `sync-to-ipd` 覆盖产物发现、TR1 完整性、稳定 ID、层级、旧文档冲突、索引绑定和 Tech 工作量校验。
- product-kb 侧核心测试与 `syncManifest` 合并测试共 50 项通过，覆盖只读预览、计划哈希、冲突、幂等、部分失败检查点、TR1 路由和敏感错误清洗。
- Node 语法检查、JSON 解析、YAML 解析、插件版本审计、Claude 插件校验和 `git diff --check` 通过。
- 官方 Python Skill 校验器因当前环境未安装 `PyYAML` 无法启动；未越权安装依赖，改用 Ruby 标准库按相同 YAML 约束完成等价校验。
- 经用户逐次确认后，已在既有 IPD 测试目标完成正向测试：需求层级与两份 TR1 文档全部写入成功；随后重新执行只读预览，所有操作均判定为 unchanged，冲突为 0。记录不包含目标名称、ID 或凭据。
