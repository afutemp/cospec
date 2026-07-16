#!/usr/bin/env node
'use strict';

/**
 * IPD 交付物 CSV 导出脚本
 * 链式查询：产品列表 → 项目列表 → 交付物列表 → 输出 CSV
 *
 * 使用方式：
 *   node export_deliverables.js                              # 导出全部产品
 *   node export_deliverables.js --products 9,15,23           # 导出指定产品（逗号分隔）
 *   node export_deliverables.js --product-id 9               # 导出单个产品
 *   node export_deliverables.js --product-id 9 --project-id 1234  # 导出单个项目
 *   node export_deliverables.js --output ./my_export.csv     # 自定义输出路径
 *   node export_deliverables.js --help                       # 显示帮助
 *
 * CSV 列：
 *   产品ID, 产品名称, 项目ID, 项目名称, 项目状态,
 *   交付物ID, 交付物名称, 交付物状态, 阶段编码, 阶段名称,
 *   活动计划ID, 活动名称, 类型, 文件链接
 */

const fs   = require('fs');
const path = require('path');

// ── 导入 API ────────────────────────────────────────────────────
const api = require('./ipd_api');

// ── 参数解析 ────────────────────────────────────────────────────
function parseArgs(args) {
  const opts = {
    help:       false,
    productIds: null,    // 逗号分隔的产品 ID 列表
    productId:  null,    // 单个产品 ID
    projectId:  null,    // 单个项目 ID
    output:     null,    // 输出文件路径
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (a === '--products') {
      const raw = args[++i];
      if (!raw) throw new Error('--products 需要指定产品 ID 列表（逗号分隔）');
      opts.productIds = raw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      if (!opts.productIds.length) throw new Error('--products 需要有效的产品 ID');
    } else if (a === '--product-id') {
      const raw = args[++i];
      if (!raw) throw new Error('--product-id 需要指定产品 ID');
      opts.productId = Number(raw);
      if (isNaN(opts.productId)) throw new Error('--product-id 参数无效');
    } else if (a === '--project-id') {
      const raw = args[++i];
      if (!raw) throw new Error('--project-id 需要指定项目 ID');
      opts.projectId = Number(raw);
      if (isNaN(opts.projectId)) throw new Error('--project-id 参数无效');
    } else if (a === '--output' || a === '-o') {
      opts.output = args[++i];
      if (!opts.output) throw new Error('--output 需要指定文件路径');
    }
  }

  // 校验
  if (opts.productIds && opts.productId) {
    throw new Error('--products 和 --product-id 不能同时使用');
  }
  if (opts.projectId && !opts.productId) {
    throw new Error('--project-id 需要配合 --product-id 使用');
  }

  return opts;
}

function showHelp() {
  console.log([
    'IPD 交付物 CSV 导出脚本 — 链式查询产品→项目→交付物',
    '',
    '用法:',
    '  node export_deliverables.js [选项]',
    '',
    '选项:',
    '  --products <ids>    导出指定产品（逗号分隔，如 9,15,23）',
    '  --product-id <id>   导出单个产品下的所有项目',
    '  --project-id <id>   导出单个项目（需配合 --product-id）',
    '  --output, -o <path> 自定义输出路径（默认: deliverables_export_<时间戳>.csv）',
    '  --help, -h          显示此帮助信息',
    '',
    '示例:',
    '  node export_deliverables.js                              # 导出全部产品',
    '  node export_deliverables.js --products 9,15,23           # 导出指定产品',
    '  node export_deliverables.js --product-id 9               # 导出单个产品',
    '  node export_deliverables.js --product-id 9 --project-id 1234  # 导出单个项目',
    '  node export_deliverables.js --output ./my_export.csv     # 自定义输出路径',
  ].join('\n'));
}

// ── CSV 工具函数 ────────────────────────────────────────────────

const CSV_COLUMNS = [
  'productId', 'productName',
  'projectId', 'projectName', 'projectState',
  'deliverableId', 'deliverableName', 'deliverableState',
  'stageCode', 'stageName',
  'activityPlanId', 'activityName',
  'type', 'fileLink',
];

const CSV_HEADER_ZH = [
  '产品ID', '产品名称',
  '项目ID', '项目名称', '项目状态',
  '交付物ID', '交付物名称', '交付物状态',
  '阶段编码', '阶段名称',
  '活动计划ID', '活动名称',
  '类型', '文件链接',
];

/**
 * CSV 字段转义
 * 包含逗号、双引号、换行符的字段需要包裹在双引号中，内部双引号转义为 ""
 */
function escapeCsvField(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * 写入 CSV 文件（UTF-8 BOM，兼容 Excel 打开中文）
 */
function writeCsv(rows, destPath) {
  const BOM = '﻿';
  const header = CSV_HEADER_ZH.join(',') + '\r\n';
  const body = rows.map(row =>
    CSV_COLUMNS.map(col => escapeCsvField(row[col])).join(',')
  ).join('\r\n');

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(destPath, BOM + header + body, 'utf8');
}

// ── 主逻辑 ──────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error('参数错误:', e.message);
    process.exit(1);
  }

  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  // ── 1. 解析产品列表 ──────────────────────────────────────────
  /** @type {Array<{id:number, name:string, state:string}>} */
  let products;

  if (opts.productId) {
    // 单个产品：通过 getAllProducts 按 onState 查询（不限定状态），然后过滤
    console.error(`正在获取产品 ${opts.productId} 的信息...`);
    const res = await api.getAllProducts({ per: 300 });
    const all = res.list;
    // 如果第一页没找到，可能不止 300 条，尝试翻页
    let found = all.filter(p => p.id === opts.productId);
    let page = 2;
    while (found.length === 0 && all.length < (res.total || 0)) {
      const next = await api.getAllProducts({ per: 300, page });
      all.push(...next.list);
      found = all.filter(p => p.id === opts.productId);
      page++;
    }
    if (found.length === 0) {
      console.error(`错误: 未找到产品 ID ${opts.productId}`);
      process.exit(1);
    }
    products = found;
    console.error(`产品: ${products[0].name} (${products[0].id})`);
  } else if (opts.productIds) {
    // 指定多个产品 ID
    console.error(`正在获取 ${opts.productIds.length} 个产品信息...`);
    const res = await api.getAllProducts({ per: 300 });
    const all = res.list;
    // 翻页补全
    let page = 2;
    while (all.length < (res.total || 0)) {
      const next = await api.getAllProducts({ per: 300, page });
      all.push(...next.list);
      page++;
    }
    products = all.filter(p => opts.productIds.includes(p.id));
    console.error(`找到 ${products.length}/${opts.productIds.length} 个产品`);
  } else {
    // 全部产品（默认只导出已启用的）
    console.error('正在获取全部产品列表（已启用）...');
    products = await api.fetchAllPages(({ page }) =>
      api.getAllProducts({ page, per: 300, onState: 'on' })
    );
    console.error(`共 ${products.length} 个产品`);
  }

  if (!products.length) {
    console.error('没有找到任何产品，退出');
    process.exit(0);
  }

  // ── 2. 链式查询：产品 → 项目 → 交付物 ─────────────────────────
  /** @type {Array<object>} */
  const rows = [];
  let totalProjects = 0;
  let totalDeliverables = 0;
  let errorCount = 0;

  for (const product of products) {
    console.error(`\n处理产品: ${product.name} (${product.id})`);

    // 获取该项目列表
    let projects;
    try {
      const res = await api.getProductProjects(product.id, { paginate: false });
      projects = res.list;
    } catch (e) {
      console.error(`  错误: 获取产品 ${product.name} (${product.id}) 的项目列表失败: ${e.message}`);
      errorCount++;
      continue;
    }

    if (!projects || !projects.length) {
      console.error(`  该产品下没有项目`);
      continue;
    }

    // 如果指定了 --project-id，只处理该项目
    if (opts.projectId) {
      projects = projects.filter(p => p.id === opts.projectId);
      if (!projects.length) {
        console.error(`  未找到项目 ${opts.projectId}`);
        errorCount++;
        continue;
      }
    }

    totalProjects += projects.length;

    for (const project of projects) {
      // 进度输出
      const stateTag = project.state ? ` [${project.state}]` : '';
      console.error(`  项目: ${project.name} (${project.id})${stateTag}`);

      // 获取交付物列表（自动翻页获取全部）
      let deliverables;
      try {
        deliverables = await api.fetchAllPages(({ page }) =>
          api.getProjectDeliverables(project.id, { page, per: 500 })
        );
      } catch (e) {
        console.error(`    错误: 获取项目 ${project.name} (${project.id}) 的交付物失败: ${e.message}`);
        errorCount++;
        continue;
      }

      if (!deliverables.length) {
        console.error(`    该项目下没有交付物`);
        continue;
      }

      totalDeliverables += deliverables.length;
      console.error(`    交付物: ${deliverables.length} 条`);

      // 添加到结果行
      for (const d of deliverables) {
        rows.push({
          productId:       product.id,
          productName:     product.name,
          projectId:       project.id,
          projectName:     project.name,
          projectState:    project.state,
          deliverableId:   d.id,
          deliverableName: d.name,
          deliverableState: d.state,
          stageCode:       d.stageCode,
          stageName:       d.stageName,
          activityPlanId:  d.activityPlanId,
          activityName:    d.activityName,
          type:            d.type,
          fileLink:        d.fileLink,
        });
      }
    }
  }

  // ── 3. 写入 CSV ──────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outputPath = opts.output || `deliverables_export_${timestamp}.csv`;

  if (!rows.length) {
    console.error('\n没有获取到任何交付物数据，不生成 CSV 文件');
    process.exit(0);
  }

  writeCsv(rows, outputPath);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const errorInfo = errorCount > 0 ? ` (${errorCount} 个错误)` : '';
  console.error([
    `\n完成。`,
    `产品: ${products.length} 个`,
    `项目: ${totalProjects} 个`,
    `交付物: ${totalDeliverables} 条`,
    `耗时: ${elapsed}s${errorInfo}`,
    `输出: ${path.resolve(outputPath)}`,
  ].join(' | '));
}

main().catch(e => {
  console.error('导出失败:', e.message);
  process.exit(1);
});
