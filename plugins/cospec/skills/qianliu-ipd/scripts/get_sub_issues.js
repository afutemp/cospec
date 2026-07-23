#!/usr/bin/env node
'use strict';
/**
 * 查询某个需求的子需求列表
 * 用法：node get_sub_issues.js <需求ID>
 * 示例：node get_sub_issues.js 892558
 */

const { getSubIssues, getIssueUrl } = require('./ipd_api');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('用法: node get_sub_issues.js <需求ID>');
  console.log('示例: node get_sub_issues.js 892558');
  process.exit(1);
}

const issueId = args[0];

getSubIssues(issueId)
  .then((list) => {
    if (!list.length) {
      console.log(`需求 ${issueId} 下暂无子需求`);
      return;
    }
    console.log(`需求 ${issueId} 的子需求（共 ${list.length} 条）：\n`);
    console.log('ID\t类型\t名称\t状态\t优先级\t负责人');
    console.log('─'.repeat(80));
    for (const item of list) {
      console.log(
        `${item.id}\t${item.issueCategory || '-'}\t${item.name}\t${item.status}\t${item.priority}\t${item.assignee}`
      );
    }
    console.log(`\n链接: ${getIssueUrl(issueId)}`);
  })
  .catch((e) => {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  });