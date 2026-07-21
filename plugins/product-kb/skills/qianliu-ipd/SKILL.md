---
name: qianliu-ipd
description: 千流IPD系统 - 查询需求详情、按标题搜索需求、查询子需求列表、按项目/版本/团队/迭代范围查需求列表、创建/更新/评论 Epic/Feature/Story/Tech 需求、创建版本（含定制项目集自定义字段）、搜索项目、查询项目版本列表、按名称检查版本是否存在、按工号/姓名查询用户ID、批量同步本地需求文档或 cospec manifest 到IPD、查询项目阶段/活动/交付物/质量标准/评审记录、上传交付物文件、更新质量要求信息、查询需求附件列表/上传需求附件/下载需求附件。当用户需要查询、创建、更新或评论IPD需求，查询项目或项目版本，查询项目阶段活动交付物信息，安全预览并同步 cospec 产物，更新质量要求，或管理需求附件时调用。
version: 1.19.0
---

# 千流 IPD 管理系统 (qianliu-ipd)

## 能做什么

帮你在对话中直接操作 IPD 需求，无需打开浏览器：

- **查需求**：说出需求 ID，立刻看到名称、状态、优先级、负责人、链接
- **搜需求**：用关键词搜索相关需求，快速定位条目
- **查子需求**：获取某个需求（Epic/Feature）下的所有直接子需求列表
- **按范围查需求**：按项目 / 项目+版本 / 项目+版本+团队 / 团队+迭代 查询需求列表，支持按类型过滤
- **按名称取详情**：直接用标题关键词获取第一条匹配的需求详情
- **搜索项目**：按名称关键词搜索 IPD 项目
- **查询项目版本**：获取指定项目下的所有版本列表（含状态、计划时间）
- **检查版本是否存在**：根据项目 ID 和版本名称，查询该版本是否已存在
- **查询迭代**：获取指定团队下的迭代列表（如迭代0、迭代1）
- **查询用户**：按工号（如 34385）或姓名搜索 IPD 用户，获取用户内部 ID
- **创建需求**：支持创建 Epic、Feature、Story、Tech 四级层级需求，可指定所属项目、版本、团队、迭代
- **创建任务**：在需求下创建任务（task），支持指定团队、计划时间
- **创建版本**：在项目下创建计划版本（plan_version_v2），支持普通项目和定制项目集（含自定义字段）
- **更新需求**：修改需求的名称、描述、优先级等任意字段
- **评论需求**：在需求下添加评论，支持 @提及用户
- **查看评论**：获取需求下的评论列表，包含回复
- **批量同步需求**：将本地需求文档（Epic→Feature→Story→Tech-系统级→Tech-服务级）批量同步到 IPD，支持工作量同步
- **同步 cospec manifest**：先计算远端差异和计划哈希，确认后按 Epic→Feature→Story→Tech 顺序同步，并上传 TR1 交付物或根 Epic 附件
- **批量删除条目**：按 ipd_index.yaml 中的 ID 批量删除 IPD 条目，预览模式显示名称便于确认
- **查询项目阶段**：获取项目下某个版本的所有阶段信息（如立项阶段、计划阶段等）
- **查询阶段活动**：获取阶段下的流程活动列表或评审活动列表
- **查询活动详情**：获取活动的详细信息
- **查询活动质量标准**：获取活动关联的质量标准列表
- **查询活动交付物**：获取活动关联的交付物信息（含模板文件下载地址）
- **上传交付物文件**：一步完成交付物文件上传（上传文件+更新交付物状态）
- **查询活动前置依赖**：获取活动的前置活动列表
- **查询活动评审记录**：获取评审活动的评审记录信息
- **更新质量要求**：更新质量标准/质量要求的结果和描述信息
- **查询需求附件**：获取需求下的附件列表（含文件名、类型、下载地址）
- **上传需求附件**：上传文件并自动关联到需求附件列表
- **下载需求附件**：下载指定附件到本地文件
- **查询产品列表**：获取全部产品列表（分页），支持按启用/停用状态过滤
- **查询产品项目**：获取指定产品下的项目列表，支持按名称和状态过滤
- **查询项目交付物**：获取指定项目下的全部交付物列表，支持按名称、状态、阶段等过滤
- **导出交付物 CSV**：链式查询产品→项目→交付物，导出为 CSV 文件（支持全部产品或指定范围）

## 使用场景示例

> "帮我查一下 IPD 892558 的详情"
> "查一下 Feature 1093660 下面的子需求列表"
> "查一下项目 100672 下的所有需求"
> "查一下项目 100672 版本 5368 下的所有需求"
> "查一下项目 100672 版本 5368 团队 8070 下的所有需求"
> "查一下团队 8070 迭代 32963 下的所有需求"
> "搜一下标题包含「千流灵测通用化」的需求"
> "查一下名称里有「gitlab评审」的需求详情"
> "帮我在 IPD 创建一个 Epic：「千流 AI 辅助研发」"
> "在 Epic 1093659 下创建 Feature：「代码审查能力」"
> "在 Feature 1093660 下创建 Story：「支持 MR diff 展示」"
> "创建一个 Epic 到 项目：千流IPD平台项目(2026年) 版本：IPD260330 团队：IPD管理效能组"
> "在需求 1094882 下创建一个任务：「实现接口对接」"
> "在项目 102198 下创建版本 IPD260430，时间 4月1日到4月30日，关联团队 4906"
> "在定制项目集 100696 下创建版本 2026.04.01，时间 8月2日到8月10日，项目类型 KA定制，单号 20260302015，基础版本 V1.0.0，外包人员需求 10"
> "更新需求 1094382 的描述"
> "把需求 1094382 的优先级改为高"
> "在需求 1094407 下添加评论：已完成初步设计"
> "查看需求 1094407 的评论列表"
> "搜索项目：XDR-2026上半年"
> "查询项目 XDR-2026上半年Q2定制-项目集 的版本列表"
> "查一下项目 102198 下版本 IPD260430 是否已存在"
> "帮我查一下工号 34385 对应的 IPD 用户 ID"
> "创建一个 Epic 到项目 102198 版本 IPD260430 迭代 5001"
> "查询项目 102198 版本 13089 下的阶段信息"
> "获取阶段 500 下的流程活动列表"
> "获取活动 12345 的详情"
> "查看活动 12345 的质量标准"
> "查看活动 12345 的交付物信息"
> "上传交付物文件到活动 12345 的交付物 678"
> "查看活动 12345 的前置依赖"
> "查看评审活动 12345 的评审记录"
> "更新质量要求 678 的结果为通过，描述为符合要求"
> "查看需求 1096252 的附件列表"
> "上传附件 test.txt 到需求 1096252"
> "下载需求 1096252 的附件 357050 到本地"
> "列出所有已启用的产品"
> "产品 9 下有哪些进行中的项目"
> "项目 102198 下有哪些未提交的交付物"
> "导出全部产品下所有项目的交付物到 CSV"


## 配置

### 配置文件路径

| 操作系统 | 默认路径 |
|---------|------|
| Windows | `C:\Users\<用户名>\.qianliu\config.json` |
| macOS/Linux | `~/.qianliu/config.json` |

可通过环境变量 `QIANLIU_CONFIG_PATH` 自定义配置文件路径。

### 配置文件内容

```json
{
  "ipd": {
    "token": "your-ipd-token",
    "product": "千流平台"
  }
}
```

`product` 字段填写产品名称，创建需求时自动按名称查找产品 ID（首次调用后缓存）。

### 如何获取 Token

打开 [ipd.sangfor.com](http://ipd.sangfor.com/) → 右上角个人头像 → 复制用户 token

详细图文说明：[千流平台token认证获取入口指南](https://wiki.sangfor.com/x/oIFYDw)

## 在对话中调用

# 执行模式

**当你收到的参数中包含 `【操作类型】` 或 `action` 字段时，表示调用方请求执行 API，而非查看文档。**

## 执行流程

1. 解析参数，提取 `【操作类型】` 或 `action` 的值
2. 根据操作类型，构造对应的 Node.js 脚本调用 `ipd_api.js`
3. 执行 API 并返回 JSON 格式结果

## 支持的操作类型

| 操作类型 | 说明 | 必需参数 |
|----------|------|----------|
| getIssueDetail | 查询需求详情 | issueId |
| getSubIssues | 查询子需求列表 | issueId |
| getIssuesByScope | 按范围查需求列表 | projectId[, planVersionId, teamVersionId, sprintId, issueCategory, per, page] |
| searchIssues | 搜索需求 | keyword[, productIds, per, page] |
| createIssue | 创建需求 | issueType(epic/feature/story/tech), name |
| updateIssue | 更新需求 | issueId, fields(JSON对象) |
| addComment | 添加评论 | issueId, content |
| getComments | 获取评论列表 | issueId |
| createTask | 创建任务 | name, parentIssueId |
| createPlanVersion | 创建版本 | versionName, projectId |
| checkVersionExists | 检查版本是否存在 | projectId, versionName |
| searchProjects | 搜索项目 | keyword |
| getProjectVersions | 获取项目版本列表 | projectId |
| getTeamsByProject | 获取项目团队列表 | projectId |
| getSprints | 获取迭代列表 | teamId |
| getProducts | 按名称搜索产品 | keyword |
| searchUsers | 搜索用户 | keyword(工号/姓名/邮箱) |
| resolveAssignerId | 解析指派人ID | keyword(工号或姓名) |
| syncFromDocs | 批量同步需求文档 | docsRoot, projectId, versionId[, productId, indexFile] |
| syncManifest | 预览或执行 cospec manifest 同步 | mode, manifestPath, indexPath, productId, projectId, versionId, teamId, routing[, expectedPlanHash, previewFile] |
| deleteIssue | 删除需求 | issueId |
| getProjectStages | 获取项目版本阶段信息 | ipdProjectId, planVersionId |
| getStageActivities | 获取阶段流程活动 | stageId, planVersionId |
| getStageReviewActivities | 获取阶段评审活动 | stageId, planVersionId |
| getActivityDetail | 获取活动详情 | activityId |
| getActivityQualityStandards | 获取活动质量标准 | activityId, planVersionId |
| getActivityDeliverables | 获取活动交付物 | activityId |
| getActivityDependencies | 获取活动前置依赖 | activityId |
| getActivityReviewRecords | 获取活动评审记录 | activityId |
| updateQualityRequirement | 更新质量要求信息 | qualityRequirementId, result, description |
| uploadDeliverableFile | 上传交付物文件 | deliverableId, activityId, fileBuffer, filename |
| getIssueAttachments | 获取需求附件列表 | issueId |
| uploadIssueAttachment | 上传需求附件 | issueId, fileBuffer, filename |
| downloadAttachment | 下载附件 | attachmentId, destPath |
| getAllProducts | 获取全部产品列表 | 无（可选 onState, page, per） |
| getProductProjects | 获取产品下的项目列表 | productId |
| getProjectDeliverables | 获取项目的交付物列表 | ipdProjectId |
| exportDeliverables | 链式查询导出交付物 CSV | 无（可选 productIds, productId, projectId, output） |

## 执行示例

**调用**:
```
【操作类型】：createPlanVersion
【projectId】：102779
【versionName】：定制-测试-001
【planStartAt】：2026-04-01
【planEndAt】：2026-04-30
```

**执行脚本**:
```javascript
const api = require('.../qianliu-ipd/scripts/ipd_api');
const result = await api.createPlanVersion('定制-测试-001', 102779, {
  planStartAt: '2026-04-01',
  planEndAt: '2026-04-30'
});
console.log(JSON.stringify(result));
```

**返回**: JSON 格式的 API 执行结果

**调用**:
```
【操作类型】：exportDeliverables
【productIds】：9,15
【output】：./交付物导出.csv
```

**执行脚本**:
```javascript
// 方式1：直接用 node 运行导出脚本
// node export_deliverables.js --products 9,15 --output ./交付物导出.csv

// 方式2：在代码中链式调用 API
const api = require('.../qianliu-ipd/scripts/ipd_api');
const products = await api.getAllProducts({ onState: 'on' });
const projects = await api.getProductProjects(9, { paginate: false });
const deliverables = await api.getProjectDeliverables(102198, { per: 500 });
```

**返回**: CSV 文件路径及统计信息

---

```javascript
const path = require('path');
const os   = require('os');

// ── 通用导入方式（适配 Claude Code / Cursor / CoStrcit / 其他 AI 工具）─────────
// 优先读取环境变量 SKILLS_BASE_DIR，否则按工具类型自动推断：
//   - Claude Code:  CLAUDE_CONFIG_DIR/skills  或  ~/.claude/skills
//   - Cursor:       ~/.cursor/skills
//   - costrcit      ~/.costrict/skills
//   - 其他:         SKILLS_BASE_DIR 环境变量
const skillsBase = process.env.SKILLS_BASE_DIR
  || (process.env.CLAUDE_CONFIG_DIR
       ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills')
       : path.join(os.homedir(), '.claude', 'skills'));
const api  = require(path.join(skillsBase, 'qianliu-ipd/scripts/ipd_api'));

// ── 查询 ──────────────────────────────────────────────────────

// 按 ID 查询需求详情
const issue = await api.getIssueDetail(892558);
// { id, name, desc, status, priority, assignee, createdAt, updatedAt, url }

// 按标题关键词搜索需求列表
const { total, list } = await api.searchIssues('千流灵测通用化');

// 获取需求的直接子需求列表（支持 Epic / Feature 下查询）
const subIssues = await api.getSubIssues(1093660);
// subIssues[i] => { id, name, status, priority, assignee, issueCategory, url }

// 按范围查需求（项目 / 版本 / 团队 / 迭代组合）
const { total, list } = await api.getIssuesByScope({ projectId: 100672 });
// 支持：projectId、planVersionId、teamVersionId、sprintId 任意组合
// 可选 issueCategory 过滤：'epic' / 'feature' / 'story' / 'tech'
// list[i] => { id, name, status, priority, assignee, issueCategory, url }
// 注意：底层接口 /api/issues/list 返回的字段不全，会自动批量查询 getIssue 补全 status/priority/assignee
const { total: t2, list: l2 } = await api.getIssuesByScope({ projectId: 100672, planVersionId: 5368, issueCategory: 'tech' });

// 按标题关键词直接获取详情（取第一条匹配）
const issue = await api.getIssueDetailByName('千流灵测通用化');

// 查询项目下的团队列表
const teams = await api.getTeamsByProject(102198);
// teams[i] => { planVersionId, planVersionName, teamId, teamName }

// 按名称关键词搜索项目
const projects = await api.searchProjects('XDR-2026上半年');
// projects[i] => { id, name, planStartAt, planEndAt }

// 查询项目下的版本列表（先搜到项目 ID，再查版本）
const projects = await api.searchProjects('XDR-2026上半年Q2定制-项目集');
const versions = await api.getProjectVersions(projects[0].id);
// versions[i] => { id, name, status, planStartAt, planEndAt }
// status 为中文：规划中 / 待规划 / 执行中 / 已完成

// 按名称检查版本是否已存在（避免重复创建）
const existing = await api.checkVersionExists(102198, 'IPD260430');
// 若存在返回 { id, name, status, planStartAt, planEndAt }，否则返回 null

// 查询团队下的迭代列表
const sprints = await api.getSprints(4906);
// sprints[i] => { id, name, state, planStartAt, planEndAt }
// name 如 "迭代0（默认）"、"迭代1"

// ── 查询用户 ──────────────────────────────────────────────────

// 按工号或姓名搜索用户（获取 IPD 平台用户内部 ID）
const users = await api.searchUsers('34385');       // 按工号搜索
const users = await api.searchUsers('汪家宝');       // 按姓名搜索
// users[i] => { id, name, username }
// 纯数字（如工号 34385）会按 email 34385@sangfor.com 精确匹配

// 快捷方式：直接解析工号/姓名为用户 ID
const userId = await api.resolveAssignerId('34385');
// 返回 number 类型用户 ID，未找到则抛出错误

// ── 创建需求 ──────────────────────────────────────────────────

// 基础创建（productId 默认按 ipd.product 名称自动查找）
const epic    = await api.createIssue('epic',    'Epic 名称',    { desc: '<p>描述</p>' });
const feature = await api.createIssue('feature', 'Feature 名称', { desc: '<p>描述</p>', parentId: epic.id });
const story   = await api.createIssue('story',   'Story 名称',   { desc: '<p>描述</p>', parentId: feature.id });
const tech    = await api.createIssue('tech',    'Tech 名称',    { desc: '<p>描述</p>', parentId: story.id });

// 指定所属项目、版本和团队
const epic2 = await api.createIssue('epic', 'Epic 名称', {
  desc:          '<p>描述</p>',
  ipdProjectId:  102198,  // 所属项目 ID
  planVersionId: 12145,   // 所属版本 ID（plan_version_v2_id）
  teamVersionId: 4906,    // 所属团队 ID（version_id，通过 getTeamsByProject 获取）
  sprintId:      5001,    // 迭代 ID（可选，指定所属迭代）
});

// 指派负责人（支持直接用工号或姓名）
const epic3 = await api.createIssue('epic', 'Epic 名称', {
  assignerKeyword: '34385',   // 按工号指派（自动解析为 IPD 用户 ID）
  // 或者直接传用户 ID：assignerId: 12345
});
// 返回: { id, name, issueType, issueCategory, status, url }

// 使用 descFile 传递长 HTML 描述（避免命令行参数长度限制）
// 通过 run.js 调用时，在 JSON 中使用 descFile 字段指定文件路径
const feature = await api.createIssue('feature', 'Feature 名称', {
  parentId: 1094577,
  planVersionId: 12517,
  descFile: 'D:/project/desc.html',  // 自动读取文件内容作为 desc
});

// ── 创建任务 ──────────────────────────────────────────────────

const task = await api.createTask('任务名称', parentIssueId, {
  desc:          '<p>任务描述</p>',
  priority:      '中',         // 高 / 中 / 低
  teamVersionId: 4906,
  planStartAt:   '2026-04-01',
  planEndAt:     '2026-04-30',
});
// 返回: { id, name, status, url }

// ── 创建版本（普通项目）──────────────────────────────────────

const version = await api.createPlanVersion('IPD260430', 102198, {
  planStartAt: '2026-04-01',
  planEndAt:   '2026-04-30',
  teamIds:     [4906],        // 未传时自动继承项目最新版本的团队
});
// 返回: { id, name, status, url }

// ── 创建版本（定制项目集，含自定义字段）─────────────────────

const version = await api.createPlanVersion('2026.04.01', 100696, {
  planStartAt:   '2024-08-02',
  planEndAt:     '2024-08-10',
  versionStatus: 'PLANNING',   // PLANNING / TO_BE_PLANNED / EXECUTING / DONE
  customFields: {
    custom_properties_project_type:                  'KA定制',      // 项目类型
    custom_properties_software_sustainable_upgrades: '是',          // 可持续升级
    custom_properties_software_order_number:         '20260302015', // 单号
    custom_properties_basic_version_number:          'V1.0.0',      // 基础版本号
    custom_properties_integrated_into_main:          '是',          // 需求合入主线
    custom_properties_outsourced_personnel_demand:   10,            // 外包人员需求量
  },
});
// 返回: { id, name, status, url }

// ── 更新需求 ──────────────────────────────────────────────────

const updated = await api.updateIssue(1094382, { desc: '<p>新描述</p>', priority: '高' });
// 返回: { id, name, status, url }

// ── 评论 ──────────────────────────────────────────────────────

await api.addComment(1094407, '已完成初步设计，请相关同学 review');
await api.addComment(1094407, '请 review', [10379]);  // 第三个参数为 @提及用户 ID 列表
// 返回: { content, url }

const { total: commentTotal, list: comments } = await api.getComments(1094407);
// comments[i] => { id, content, author, createdAt, children: [{id, content, author, createdAt}] }

// ── 项目活动计划（IPD 流程管理）──────────────────────────────

// 获取项目下某个版本的阶段信息
const stages = await api.getProjectStages(102198, 13089);
// stages[i] => { id, name, status, progress }

// 获取阶段下的流程活动列表
const activities = await api.getStageActivities(500, 13089);
// activities[i] => { id, name, status }

// 获取阶段下的评审活动列表
const reviewActivities = await api.getStageReviewActivities(500, 13089);
// reviewActivities[i] => { id, name, status }

// 获取活动详情
const activity = await api.getActivityDetail(12345);

// 获取活动质量标准
const standards = await api.getActivityQualityStandards(12345, 13089);

// 获取活动交付物信息
const deliverables = await api.getActivityDeliverables(12345);
// deliverables[i] => { id, name, type, state, fileLink }
// fileLink 字段拼接服务域名即可获取模板文件下载地址

// 上传交付物文件（一步完成：上传文件 + 更新交付物）
const fs = require('fs');
const fileBuffer = fs.readFileSync('/path/to/document.pdf');
const result = await api.uploadDeliverableFile(678, 12345, fileBuffer, 'document.pdf');
// result => { filePath, deliverable }

// 也可以分步执行：
// 第一步：上传文件
const { filePath } = await api.uploadAttachment(fileBuffer, 'document.pdf');
// 第二步：更新交付物
const deliverable = await api.updateDeliverable(678, {
  filePath,
  activityId: 12345,
});

// 获取活动前置依赖
const dependencies = await api.getActivityDependencies(12345);
// dependencies[i] => { id, name, status }

// 获取活动评审记录（仅评审活动有）
const reviewRecords = await api.getActivityReviewRecords(12345);

// 更新质量要求信息
const updated = await api.updateQualityRequirement(678, {
  result: '通过',        // 质量要求结果，默认"通过"
  description: '符合要求', // 描述信息，默认"1"
});

// ── 需求附件 ──────────────────────────────────────────────────

// 获取需求的附件列表（含文件名、类型、下载地址等详细信息）
const attachments = await api.getIssueAttachments(1096252);
// attachments[i] => { id, fileName, filePath, fileType, fileUrl, createdAt }
// fileUrl 可直接用于浏览器下载，如 http://ipd.sangfor.com/static/attachments/...

// 上传附件到需求（自动关联到需求附件列表）
const fs = require('fs');
const fileBuffer = fs.readFileSync('/path/to/file.pdf');
const result = await api.uploadIssueAttachment(1096252, fileBuffer, 'file.pdf');
// result => { attachmentId, issueId, filename, url }

// 下载附件到本地文件
const downloadResult = await api.downloadAttachment(357050, '/path/to/save/file.pdf');
// downloadResult => { destPath, fileName, fileSize }
```

// ── 产品与项目列表（新增）──────────────────────────────────────

// 获取全部产品列表（分页）
const { total, list } = await api.getAllProducts({ onState: 'on', per: 300 });
// list[i] => { id, name, state }
// state: '已启用' / '已停用'

// 获取产品下的项目列表
const { total: projectTotal, list: projects } = await api.getProductProjects(9, {
  paginate: false,  // 不分页，获取全部
  state: 'project_todo,project_backlog',  // 多选：进行中 + 未启动
});
// projects[i] => { id, name, state, stateKey, productId }
// state: '未启动' / '进行中' / '终止' / '已完成'

// 获取项目下的全部交付物
const { total: dTotal, list: deliverables } = await api.getProjectDeliverables(102198, {
  state: 'not_submitted',  // 筛选未提交的交付物
  per: 500,
});
// deliverables[i] => { id, name, state, stateKey, stageCode, stageName, activityPlanId, activityName, type, fileLink }
// state: '已提交' / '未提交'

// 自动翻页获取全部数据（工具函数）
const allDeliverables = await api.fetchAllPages(({ page }) =>
  api.getProjectDeliverables(102198, { page, per: 500 })
);

// ── CSV 导出（CLI）─────────────────────────────────────────────

// 导出全部已启用产品下所有项目交付物到 CSV
// node export_deliverables.js --output ./交付物导出.csv

// 导出指定产品的交付物
// node export_deliverables.js --product-id 9

// 导出多个产品
// node export_deliverables.js --products 9,15,23

// 导出单个项目
// node export_deliverables.js --product-id 9 --project-id 1234
```
## 创建版本：识别项目类型

创建版本前，先判断目标项目是**普通项目**还是**定制项目集**：

- **普通项目**：只需版本名、计划时间、团队 ID
- **定制项目集**：额外需要填写 `customFields` 中的自定义字段

| 自定义字段 key | 说明 | 类型 | 示例值 |
|---|---|---|---|
| `custom_properties_project_type` | 项目类型 | string | `KA定制` |
| `custom_properties_software_sustainable_upgrades` | 定制和主线是否可持续升级 | string | `是` / `否` |
| `custom_properties_software_order_number` | 单号 | string | `20260302015` |
| `custom_properties_basic_version_number` | 基础版本号 | string | `V1.0.0` |
| `custom_properties_integrated_into_main` | 需求是否合入主线 | string | `是` / `否` |
| `custom_properties_outsourced_personnel_demand` | 外包人员需求量 | number | `10` |

**版本状态（versionStatus）可选值：**
`PLANNING`（规划中）/ `TO_BE_PLANNED`（待规划）/ `EXECUTING`（执行中）/ `DONE`（已完成）


## 需求层级说明

| 层级 | issueCategory | 父级约束 |
|------|--------------|---------|
| Epic | `epic` | 无 |
| Feature | `feature` | 必须是 Epic |
| Story | `story` | 必须是 Feature 或 Story |
| Tech | `tech` | 必须是 Feature、Story 或 Tech |

## 注意事项

- 搜索需求不传 `productIds` 时自动搜索全部产品（约300个），速度较慢；已知产品可传 `{ productIds: [id] }` 加速
- **`searchProjects` 受限于配置产品**：内部通过 `resolveDefaultProductId()` 限定在当前 `ipd.product` 配置的产品下搜索，搜其他产品的项目会返回空。跨产品搜索项目时，先用 `getProducts('产品名')` 找到目标产品 ID，再用 `searchIssues(keyword, { productIds: [id] })` 在该产品下搜索需求，从需求中提取项目信息
- **`getIssuesByScope` 自动过滤已删除需求**（`deleted=true`），无需手动排除
- **需求未直接关联项目/版本时**，通过 `teamVersionId` + `sprintId` 组合查询比 `projectId` + `planVersionId` 更可靠（部分需求的 `ipd_project`、`plan_version_v2` 字段可能为空，但 `version` 和 `sprint` 字段有值）
- **搜索产品**：`getProducts('关键词')` 可按名称搜索产品，返回 `[{ id, name }]`，用于获取目标产品 ID
- 定制项目集创建版本时，计划时间必须在项目的计划时间范围内，否则接口返回 400
- 支持通过 `IPD_TOKEN` 环境变量覆盖配置文件中的 token
- 支持通过 `QIANLIU_CONFIG_PATH` 环境变量自定义配置文件路径
- 支持通过 `SKILLS_BASE_DIR` 环境变量自定义 skills 目录路径（适配非 Claude Code 工具）
- 无需安装任何依赖，仅使用 Node.js 内置模块

---

## 同步 cospec manifest

`syncManifest` 是 `sync-to-ipd` 的安全写入接口。必须先运行 `preview`，向用户展示返回的 `planHash`、目标、创建、更新、上传、不变和冲突数量；只有用户针对该预览回复“确认执行”后，才能运行 `apply`。

```javascript
const sync = require('.../qianliu-ipd/scripts/sync_from_manifest');

const target = {
  productId: Number(process.env.IPD_PRODUCT_ID),
  projectId: Number(process.env.IPD_PROJECT_ID),
  versionId: Number(process.env.IPD_VERSION_ID),
  teamId: Number(process.env.IPD_TEAM_ID),
};

const input = {
  manifestPath: '/project/product-planning/example/.ipd-sync/manifest.json',
  indexPath: '/project/product-planning/example/.ipd-sync/index.json',
  target,
  routing: {
    review: {
      kind: 'deliverable',
      deliverableId: Number(process.env.IPD_DELIVERABLE_ID),
      activityId: Number(process.env.IPD_ACTIVITY_ID),
    },
    aiContext: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
  },
  ipdApi: api,
};

const preview = await sync.buildSyncPlan(input);
// 用户确认 preview.planHash 后：
const result = await sync.applySyncPlan({ ...input, expectedPlanHash: preview.planHash });
```

也可运行 `sync_from_manifest.js` CLI；缺少适合的 TR1 交付物时不要创建交付物，省略 `--reviewDeliverableId`，让两份 TR1 都回退到 `--rootEpicArtifactId` 对应根 Epic 的附件。

```bash
node sync_from_manifest.js \
  --mode preview \
  --manifest <manifest.json> \
  --index <index.json> \
  --productId <id> \
  --projectId <id> \
  --versionId <id> \
  --teamId <id> \
  --rootEpicArtifactId <EPIC-id> \
  --reviewDeliverableId <id> \
  --reviewActivityId <id> \
  --previewFile <preview.md>

node sync_from_manifest.js <相同参数> \
  --mode apply \
  --expectedPlanHash <已确认的-planHash>
```

安全约束：

- `preview` 只调用查询 API，可写本地预览文件，但不得调用任何 IPD 写接口。
- 无索引绑定的同名需求一律返回冲突，不按名称自动复用。
- 类型、父级、索引 ID 或目标不一致时停止，不自动改父级。
- `apply` 只接受当前远端和本地状态重新计算后仍一致的 `planHash`。
- 不删除需求，不修改状态、负责人或优先级，不创建产品、项目、版本或交付物。
- 写入失败后立即停止，不自动重试；成功项实时写入本地索引，供下一次预览跳过。

## 批量同步需求文档

将本地需求文档目录批量同步到 IPD，支持以下层级结构：
> 每当提及同步前，请先调用/requirement-output-auditor 协助校验IPD产物的格式，提示用户完成修复后再进行同步IPD
```
docsRoot/
├── Epic-新三员角色体系/
│   ├── README.md
│   ├── Feature1-安全保密管理员更名为授权管理员/
│   │   ├── README.md
│   │   ├── Story1.1-将安全保密管理员更名为授权管理员/
│   │   │   ├── README.md
│   │   │   ├── Tech-系统级-角色中心/
│   │   │   │   ├── README.md
│   │   │   │   └── Tech-服务级/
│   │   │   │       ├── 更名安全保密管理员为授权管理员.md
│   │   │   │       └── 迁移历史审计日志角色引用.md
│   │   │   └── Tech-系统级-权限中心/
│   │   └── Story1.2-限制授权管理员的用户创建编辑权限/
│   └── Feature2-用户申请与审批流程/
└── ...
```

### 目录命名规则

| 层级 | 目录名格式 | 说明 |
|------|-----------|------|
| Epic | `Epic-名称` 或 `Epic名称` | README.md 为描述 |
| Feature | `Feature1-名称` 或 `Feature-名称` | README.md 为描述 |
| Story | `Story1.1-名称` | 支持带小数点的编号 |
| Tech-系统级 | `Tech-系统级-名称` | README.md 为描述 |
| Tech-服务级 | `Tech-服务级/名称.md` | 每个 .md 文件对应一个条目 |

### CLI 调用

```bash
# 基本用法
node sync_from_docs.js <docsRoot> --projectId <id> --versionId <id>

# 完整参数
node sync_from_docs.js ./docs/output \
  --productId 2796 \
  --projectId 102702 \
  --versionId 12486 \
  --indexFile ./ipd_index.yaml \
  --dry-run  # 预览模式，只扫描不创建
```

### 工作量同步（v1.13.0+）

同步脚本支持将 Tech 层级的「预计工作量」同步到 IPD。

#### 工作量规则

| 需求类型 | 是否填写工作量 | 说明 |
|---------|--------------|------|
| Epic | ❌ 不填写 | 不累加，仅统计叶子节点 |
| Feature | ❌ 不填写 | 不累加，仅统计叶子节点 |
| Story | ❌ 不填写 | 不累加，仅统计叶子节点 |
| Tech-系统级 | ❌ 不填写 | 有子节点时不累加 |
| Tech-服务级 | ✅ 需要填写 | 叶子节点，最小单位 0.5 天，默认 1 天 |

**统计规则**：`total_estimated_days` 仅统计叶子节点（没有 children 的 Tech）的工作量总和。

#### YAML 索引文件

同步后会生成 `ipd_index.yaml` 文件，记录需求映射和工作量：

```yaml
# IPD 需求索引

# 统计（仅叶子节点 Tech 统计工作量）
stats:
  epic: 1
  feature: 2
  story: 2
  tech: 16
  total: 21
  # 叶子节点工作量：仅没有 children 的 Tech
  total_estimated_days: 16

# 元信息
meta:
  project_id: 102972
  version_id: 12818
  team_id: 8763

# 需求列表
# estimated_day: 仅叶子节点 Tech 填写，默认 1 天，最小单位 0.5 天
issues:
  - id: 1099431
    type: epic
    name: 灾备服务全生命周期管理
    children:
      - id: 1099434
        type: tech
        level: 系统级
        name: XaaS服务注册模块
        # 有 children，非叶子节点，不填 estimated_day
        children:
          - id: 1099435
            type: tech
            level: 服务级
            name: 更新服务状态
            estimated_day: 1  # 叶子节点

          - id: 1099436
            type: tech
            level: 服务级
            name: 注册灾备服务
            estimated_day: 0.5  # 最小单位 0.5 天
```

#### 修改工作量

直接编辑 `ipd_index.yaml` 文件，修改 `estimated_day` 字段，然后重新运行同步脚本：

```bash
# 修改工作量后重新同步
node sync_from_docs.js ./docs/output --projectId 102972 --versionId 12818
```

#### 旧格式兼容

如果存在旧的 `ipd_index.md` 文件，同步脚本会自动：
1. 检测到旧格式文件
2. 转换为 YAML 格式
3. 为 Tech 类型设置默认工作量 1 天
4. 生成新的 `ipd_index.yaml` 文件

#### API 参数

创建/更新 Tech 需求时可指定工作量：

```javascript
// 创建 Tech 并设置工作量
const tech = await api.createIssue('tech', 'Tech 名称', {
  parentId: storyId,
  desc: '<p>描述</p>',
  estimatedDay: 2,  // 预计工作量：2天
});

// 更新工作量
await api.updateIssue(techId, {
  estimated_day: 1.5,  // 更新工作量：1.5天
});
```

### 批量删除 IPD 条目

同步时可能在 IPD 存在同名残留，同步脚本会匹配但不会链接节点导致层级断开，此时如果量少，可以手动修改parent，如果量多，用户可能希望全部删除后重新同步。

```bash
# 预览（查名称，不删除）
node delete_ipd_items.js --indexFile ./ipd_index.yaml

# 确认删除
node delete_ipd_items.js --indexFile ./ipd_index.yaml --confirm --batch
```

yaml 未记录的孤立条目可手动追加到 issues 列表（标记 `local_path: "(orphan)"`），再跑删除脚本。
