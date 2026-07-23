#!/usr/bin/env node
'use strict';

/**
 * 导出：已启用产品 → 进行中项目 → 已提交交付物 → CSV
 */

const fs   = require('fs');
const path = require('path');
const api  = require('./ipd_api');

// ── CSV 配置 ──────────────────────────────────────────────────
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

function escapeCsvField(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsv(rows, destPath) {
  const BOM = '﻿';
  const header = CSV_HEADER_ZH.join(',') + '\r\n';
  const body = rows.map(row =>
    CSV_COLUMNS.map(col => escapeCsvField(row[col])).join(',')
  ).join('\r\n');

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, BOM + header + body, 'utf8');
}

// ── 主逻辑 ────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const rows = [];
  let totalProjects = 0;
  let totalDeliverables = 0;
  let errorCount = 0;
  let skippedNotInProgress = 0;
  let skippedNoDeliverables = 0;

  // 1. 获取所有已启用产品
  console.error('正在获取全部已启用产品...');
  const products = await api.fetchAllPages(({ page }) =>
    api.getAllProducts({ page, per: 300, onState: 'on' })
  );
  console.error(`共 ${products.length} 个已启用产品`);

  // 2. 遍历产品 → 项目 → 交付物
  for (let pi = 0; pi < products.length; pi++) {
    const product = products[pi];
    const progress = `[${pi + 1}/${products.length}]`;
    console.error(`\n${progress} 产品: ${product.name} (${product.id})`);

    // 获取项目列表（不分页，进行中）
    let projects;
    try {
      const res = await api.getProductProjects(product.id, {
        paginate: false,
        state: 'project_todo',  // 进行中
      });
      projects = res.list;
    } catch (e) {
      console.error(`  ✗ 获取项目列表失败: ${e.message}`);
      errorCount++;
      continue;
    }

    if (!projects.length) {
      console.error(`  该产品下没有进行中的项目`);
      continue;
    }
    console.error(`  ${projects.length} 个进行中项目`);

    for (const project of projects) {
      totalProjects++;
      console.error(`    项目: ${project.name} (${project.id}) [${project.state}]`);

      // 获取已提交的交付物
      let deliverables;
      try {
        deliverables = await api.fetchAllPages(({ page }) =>
          api.getProjectDeliverables(project.id, {
            page,
            per: 500,
            state: 'submitted',  // 已提交
          })
        );
      } catch (e) {
        console.error(`      ✗ 获取交付物失败: ${e.message}`);
        errorCount++;
        continue;
      }

      if (!deliverables.length) {
        console.error(`      无已提交交付物`);
        skippedNoDeliverables++;
        continue;
      }

      totalDeliverables += deliverables.length;
      console.error(`      ${deliverables.length} 条已提交交付物`);

      for (const d of deliverables) {
        rows.push({
          productId:        product.id,
          productName:      product.name,
          projectId:        project.id,
          projectName:      project.name,
          projectState:     project.state,
          deliverableId:    d.id,
          deliverableName:  d.name,
          deliverableState: d.state,
          stageCode:        d.stageCode,
          stageName:        d.stageName,
          activityPlanId:   d.activityPlanId,
          activityName:     d.activityName,
          type:             d.type,
          fileLink:         d.fileLink,
        });
      }
    }
  }

  // 3. 写入 CSV
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outputPath = `deliverables_submitted_${timestamp}.csv`;

  if (!rows.length) {
    console.error('\n没有获取到任何已提交的交付物数据，不生成 CSV 文件');
    process.exit(0);
  }

  writeCsv(rows, outputPath);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error([
    '\n========== 导出完成 ==========',
    `产品:       ${products.length} 个（已启用）`,
    `项目:       ${totalProjects} 个（进行中）`,
    `交付物:     ${totalDeliverables} 条（已提交）`,
    `无交付物:   ${skippedNoDeliverables} 个项目`,
    `错误:       ${errorCount} 个`,
    `耗时:       ${elapsed}s`,
    `输出文件:   ${path.resolve(outputPath)}`,
  ].join('\n'));
}

main().catch(e => {
  console.error('导出失败:', e.message);
  process.exit(1);
});
