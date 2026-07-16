'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {fingerprint} = require('./collect');

function indexIssues(snapshot) {
  return new Map((snapshot.issues || []).map(issue => [String(issue.id), issue]));
}

function computeDiff(oldSnapshot, newSnapshot) {
  const oldMap = indexIssues(oldSnapshot);
  const newMap = indexIssues(newSnapshot);
  const result = {added: [], modified: [], deleted: [], relationshipChanged: [], unchanged: [], warningChanged: []};
  for (const [id, next] of newMap) {
    const previous = oldMap.get(id);
    if (!previous) result.added.push(id);
    else if (previous.parentId !== next.parentId || previous.category !== next.category) result.relationshipChanged.push(id);
    else if (previous.fingerprint !== next.fingerprint) result.modified.push(id);
    else result.unchanged.push(id);
  }
  for (const id of oldMap.keys()) if (!newMap.has(id)) result.deleted.push(id);
  if (fingerprint(oldSnapshot.warnings || []) !== fingerprint(newSnapshot.warnings || [])) result.warningChanged = ['warnings'];
  for (const values of Object.values(result)) values.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
  return result;
}

function featurePath(id, issue) {
  const safe = (issue?.name || `feature-${id}`).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-').slice(0, 80);
  return `03-功能规划/${id}-${safe}.md`;
}

function pathsForSource(meta, id) {
  const source = `IPD-${id}`;
  return Object.entries(meta.documentSources || {}).filter(([, ids]) => (ids || []).includes(source)).map(([file]) => file);
}

function buildUpdatePlan({root, oldSnapshot, newSnapshot, meta = {}, now = new Date().toISOString()}) {
  const changes = computeDiff(oldSnapshot, newSnapshot);
  const newMap = indexIssues(newSnapshot);
  const operations = [];
  const affected = new Set(['README.md']);
  const changedIds = [...changes.added, ...changes.modified, ...changes.deleted, ...changes.relationshipChanged];
  for (const id of changedIds) {
    const issue = newMap.get(id);
    const existingPaths = pathsForSource(meta, id);
    existingPaths.forEach(file => affected.add(file));
    if (changes.deleted.includes(id)) {
      for (const file of existingPaths) if (file.startsWith('03-功能规划/')) operations.push({type: 'deleteManaged', path: file, sourceIds: [`IPD-${id}`]});
    } else if (issue?.category === 'feature') {
      const target = existingPaths.find(file => file.startsWith('03-功能规划/')) || featurePath(id, issue);
      operations.push({type: existingPaths.includes(target) ? 'replaceManaged' : 'createManaged', path: target, sourceIds: [`IPD-${id}`]});
      affected.add(target);
    }
  }
  for (const aggregate of ['00-综述/01-产品战略与价值.md', '00-综述/02-版本演进与里程碑.md', '02-规划与范围/01-需求池与优先级.md', '02-规划与范围/02-版本范围与路线图.md']) {
    if (changedIds.length) { operations.push({type: 'replaceManaged', path: aggregate, aggregate: true}); affected.add(aggregate); }
  }
  const conflicts = [];
  for (const [relative, record] of Object.entries(meta.managedFiles || {})) {
    const target = path.resolve(root, relative);
    if (fs.existsSync(target) && record.fingerprint && fingerprint(fs.readFileSync(target, 'utf8')) !== record.fingerprint) conflicts.push({path: relative, code: 'MANAGED_FILE_CHANGED'});
  }
  return {
    schemaVersion: '1.0.0',
    planId: `update-${fingerprint({now, old: oldSnapshot.fingerprint, next: newSnapshot.fingerprint}).slice(7, 19)}`,
    createdAt: now,
    baseline: {snapshotFingerprint: oldSnapshot.fingerprint, metaFingerprint: meta.__fileFingerprint || null},
    nextSnapshotFingerprint: newSnapshot.fingerprint,
    changes,
    affectedDocuments: [...affected].sort(),
    operations: operations.filter((item, index, all) => all.findIndex(other => other.type === item.type && other.path === item.path) === index),
    conflicts: conflicts.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function writeUpdatePreview(outputDir, plan) {
  fs.mkdirSync(outputDir, {recursive: true});
  fs.writeFileSync(path.join(outputDir, 'update-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const lines = [
    '# 产品知识库更新预览', '', `- 计划 ID: ${plan.planId}`, `- 创建时间: ${plan.createdAt}`,
    `- 新增: ${plan.changes.added.length}`, `- 修改: ${plan.changes.modified.length}`,
    `- 删除: ${plan.changes.deleted.length}`, `- 关系变化: ${plan.changes.relationshipChanged.length}`,
    `- 冲突: ${plan.conflicts.length}`, '', '## 文件操作',
    ...(plan.operations.length ? plan.operations.map(item => `- ${item.type}: ${item.path}`) : ['- 无']), '',
  ];
  const target = path.join(outputDir, 'update-preview.md');
  fs.writeFileSync(target, lines.join('\n'));
  return target;
}

module.exports = {computeDiff, buildUpdatePlan, writeUpdatePreview};
