# sync-to-ipd

`sync-to-ipd` 将 cospec 大需求流程生成的 TR1 评审版、TR1 AI 上下文版和 Epic／Feature／Story／Tech 文档安全同步到现有 IPD 项目。

使用前需要安装并配置 product-kb 插件中的 `qianliu-ipd`。Token 只通过 `~/.qianliu/config.json`、`QIANLIU_CONFIG_PATH` 或 `IPD_TOKEN` 提供，不要写入 cospec 配置或对话。

调用示例：

```text
/sync-to-ipd product-planning/某大需求
$sync-to-ipd product-planning/某大需求
把当前 cospec 大需求产物同步到 IPD
```

Skill 会依次选择已有产品、项目、版本、团队和 TR1 交付物，生成 `.ipd-sync/manifest.json`、`.ipd-sync/index.json` 和 `.ipd-sync/preview.md`。只有用户针对当前 `planHash` 回复“确认执行”后才写入 IPD。

旧版 cospec 的扁平文件产物也可识别。Skill 会先拆成隔离的单条需求快照；如果旧 Tech 没有稳定 `TECH-*` ID 或同时声明多个父级，必须由用户明确选择一个稳定 ID 和一个 Feature／Story 父级，不能自动猜测。

默认路由为：TR1 评审版上传至用户选择的交付物，TR1 AI 上下文版上传至根 Epic 附件；没有合适交付物时，两份 TR1 都上传至根 Epic 附件。同步不会创建产品、项目、版本或交付物，不删除需求，不修改状态、负责人或优先级，也不会自动重试失败写入。
