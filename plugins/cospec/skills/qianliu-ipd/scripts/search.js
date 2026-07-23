'use strict';

/**
 * 按需求标题搜索需求
 * 用法: node search.js <标题关键词> [product_id]
 * 示例: node search.js 千流灵测通用化
 *       node search.js 千流灵测通用化 9
 */

const { searchIssues } = require('./ipd_api');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('用法: node search.js <标题关键词> [product_id]');
  console.log('示例: node search.js 千流灵测通用化');
  console.log('      node search.js 千流灵测通用化 9');
  process.exit(1);
}

const name       = args[0];
const productIds = args[1] ? [Number(args[1])] : undefined;

searchIssues(name, { productIds, per: 20 })
  .then(({ total, list }) => {
    console.log(`共找到 ${total} 条，显示前 ${list.length} 条：\n`);
    list.forEach((d, i) => {
      console.log(`[${i + 1}] ID: ${d.id}`);
      console.log(`    名称: ${d.name}`);
      console.log(`    状态: ${d.status}  优先级: ${d.priority}  负责人: ${d.assignee}`);
      console.log(`    链接: ${d.url}`);
      console.log();
    });
  })
  .catch((e) => {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  });
