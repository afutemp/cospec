'use strict';

/**
 * 查询需求详情
 * 用法: node get.js <需求ID>
 * 示例: node get.js 892558
 */

const { getIssue, getIssueUrl } = require('./ipd_api');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('用法: node get.js <需求ID>');
  console.log('示例: node get.js 892558');
  process.exit(1);
}

const issueId = args[0];

getIssue(issueId)
  .then((res) => {
    const d = res.data || res;
    console.log(`需求 ID:   ${d.id || issueId}`);
    console.log(`需求名称:  ${d.name || '（未设置）'}`);
    console.log(`需求状态:  ${d.status?.name || '（未知）'}`);
    console.log(`优先级:    ${d.custom_fields?.priority || '（未知）'}`);
    console.log(`负责人:    ${d.assigner?.display_name || '（未分配）'}`);
    console.log(`链接:      ${getIssueUrl(issueId)}`);
    console.log(`\n需求描述:\n${d.desc || '（未设置）'}`);
  })
  .catch((e) => {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  });
