#!/usr/bin/env node
'use strict';

/**
 * IPD 条目批量删除脚本
 * 读取 ipd_index.yaml 中的所有条目 ID，逐个调用 DELETE API 删除
 *
 * 使用场景：
 *   - 重新同步前清理 IPD 上的孤立残留条目
 *   - 同步出错后需要全部重做时批量清除
 *
 * 用法：
 *   # 预览模式：列出待删除条目数量和 ID，不执行删除
 *   node delete_ipd_items.js --indexFile <path>
 *
 *   # 确认删除：
 *   node delete_ipd_items.js --indexFile <path> --confirm --batch
 *
 * 选项：
 *   --indexFile   ipd_index.yaml 路径（必填）
 *   --confirm     跳过确认提示，直接删除（不加则只预览）
 *   --batch       批量模式，每条间隔 100ms（不加则 200ms）
 *
 * 注意：
 *   - 按 ID 降序删除（先删子项再删父项，更安全）
 *   - 自动去重，ipd_index.yaml 中重复 ID 不会重复删除
 *   - ID < 100000 视为元数据（project_id 等），自动跳过
 *   - 若需清理 yaml 中未记录的孤立条目，可手动追加条目到 yaml 的 issues 列表
 *     （标记 local_path: "(orphan)"），然后运行本脚本
 */

const fs = require('fs');
const path = require('path');
const ipdApi = require('./ipd_api.js');

function parseArgs(args) {
  const result = { indexFile: null, confirm: false, batch: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--indexFile') result.indexFile = args[++i];
    else if (arg === '--confirm') result.confirm = true;
    else if (arg === '--batch') result.batch = true;
  }
  return result;
}

// 从 yaml 提取 issues 节点下的所有 ID
// 只解析 issues: 之后的内容，避免误读 meta 段的 project_id / version_id 等
function extractIssueIds(yamlContent) {
  const issuesStart = yamlContent.indexOf('\nissues:');
  if (issuesStart === -1) return [];
  const issuesSection = yamlContent.substring(issuesStart);
  return [...issuesSection.matchAll(/^\s+id:\s*(\d+)\s*$/gm)].map(m => parseInt(m[1]));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.indexFile) {
    console.error('用法: node delete_ipd_items.js --indexFile <ipd_index.yaml路径> [--confirm] [--batch]');
    console.error('');
    console.error('选项:');
    console.error('  --indexFile   ipd_index.yaml 文件路径（必填）');
    console.error('  --confirm     跳过确认，直接删除');
    console.error('  --batch       批量模式，不等逐条确认');
    process.exit(1);
  }

  const indexPath = path.resolve(opts.indexFile);
  if (!fs.existsSync(indexPath)) {
    console.error(`文件不存在: ${indexPath}`);
    process.exit(1);
  }

  const yamlContent = fs.readFileSync(indexPath, 'utf-8');
  const issueIds = extractIssueIds(yamlContent);

  // 去重并按 ID 降序排列（先删子项再删父项更安全）
  const uniqueIds = [...new Set(issueIds)].sort((a, b) => b - a);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️  IPD 条目批量删除脚本');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📄 索引文件: ${indexPath}`);
  console.log(`📊 待删除条目数: ${uniqueIds.length}`);
  console.log(`📋 ID 范围: ${uniqueIds[uniqueIds.length - 1]} ~ ${uniqueIds[0]}`);
  console.log('');

  if (!opts.confirm) {
    console.log('⚠️  即将删除以上条目，此操作不可逆！');
    console.log('如需确认执行，请加 --confirm 参数');
    console.log('');
    console.log('正在查询 IPD 条目名称...\n');

    // 批量查询名称
    const items = [];
    for (const id of uniqueIds) {
      try {
        const detail = await ipdApi.getIssueDetail(id);
        items.push({ id, name: detail.name || '', type: detail.issueCategory || '' });
      } catch {
        items.push({ id, name: '(已不存在)', type: '' });
      }
    }

    // 按类型分组输出
    const byType = {};
    for (const item of items) {
      const type = item.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(item);
    }

    for (const [type, list] of Object.entries(byType)) {
      console.log(`--- ${type} (${list.length}) ---`);
      for (const item of list) {
        console.log(`  ID: ${item.id}  |  ${item.name}`);
      }
      console.log('');
    }

    console.log('ID 列表（便于脚本使用）:');
    console.log(uniqueIds.join(','));
    process.exit(0);
  }

  console.log('🚀 开始删除...\n');

  let deleted = 0;
  let failed = 0;
  const failedIds = [];

  for (const id of uniqueIds) {
    try {
      // 先查一下名称，方便日志
      let name = '';
      try {
        const detail = await ipdApi.getIssueDetail(id);
        name = detail.name || '';
      } catch {
        name = '(已不存在)';
      }

      // 调用 DELETE API
      const result = await ipdApi.deleteIssue(id);
      deleted++;
      console.log(`  ✅ [${deleted}/${uniqueIds.length}] 删除 ID: ${id} ${name}`);

      if (!opts.batch) {
        await sleep(200); // 非批量模式稍慢一点，避免限流
      } else {
        await sleep(100);
      }
    } catch (err) {
      failed++;
      failedIds.push(id);
      console.log(`  ❌ [${deleted + failed}/${uniqueIds.length}] 删除失败 ID: ${id} - ${err.message}`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 删除完成！成功: ${deleted}, 失败: ${failed}`);
  if (failedIds.length > 0) {
    console.log(`❌ 失败 ID: ${failedIds.join(', ')}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('致命错误:', err.message);
  process.exit(1);
});
