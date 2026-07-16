'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {fingerprint} = require('./collect');

function managedMarker({sourceIds, fingerprint: sourceFingerprint, generationId}) {
  return `<!-- product-kb-managed\nschema: 1.0\nsources: ${(sourceIds || []).join(',')}\nfingerprint: ${sourceFingerprint || ''}\ngeneration_id: ${generationId || ''}\n-->`;
}

function parseMarker(content) {
  const match = content.match(/<!-- product-kb-managed\n([\s\S]*?)\n-->/);
  if (!match) return null;
  const fields = Object.fromEntries(match[1].split('\n').map(line => {
    const index = line.indexOf(':');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  return {schema: fields.schema, sourceIds: (fields.sources || '').split(',').filter(Boolean), fingerprint: fields.fingerprint, generationId: fields.generation_id};
}

function readJson(target, fallback = null) {
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function toRelativePath(value) {
  return value.replace(/\\/g, '/');
}

function rejectSymlinkPath(root, relative) {
  const segments = toRelativePath(relative).split('/').filter(Boolean);
  let current = path.resolve(root);
  for (const segment of segments) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`路径包含符号链接，拒绝写入: ${relative}`);
  }
}

function safePath(root, relative) {
  if (path.isAbsolute(relative)) throw new Error(`路径不在知识库根目录: ${relative}`);
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(root, relative);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`路径不在知识库根目录: ${relative}`);
  rejectSymlinkPath(resolvedRoot, relative);
  return target;
}

function inspectKnowledgeBase(root) {
  const meta = readJson(path.join(root, '.product-kb-meta.json'), {managedFiles: {}});
  const manifest = readJson(path.join(root, '.source', 'managed-manifest.json'), {files: []});
  const manifestMap = new Map((manifest.files || []).map(item => [toRelativePath(item.path), item]));
  const managed = [];
  for (const [relative, record] of Object.entries(meta.managedFiles || {})) {
    const normalized = toRelativePath(relative);
    const target = safePath(root, normalized);
    const manifestRecord = manifestMap.get(normalized);
    if (!manifestRecord || !fs.existsSync(target)) continue;
    const content = fs.readFileSync(target, 'utf8');
    const marker = parseMarker(content);
    const sourcesMatch = marker && JSON.stringify([...marker.sourceIds].sort()) === JSON.stringify([...(record.sourceIds || [])].sort());
    if (sourcesMatch) managed.push({path: normalized, marker, record, currentFingerprint: fingerprint(content)});
  }
  return {managed, meta, manifest};
}

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.cpSync(source, target, {recursive: true});
}

function validateBaseline(root, plan) {
  if (!plan.baseline?.metaFingerprint) return;
  const metaPath = path.join(root, '.product-kb-meta.json');
  const current = fs.existsSync(metaPath) ? fingerprint(fs.readFileSync(metaPath, 'utf8')) : fingerprint(null);
  if (current !== plan.baseline.metaFingerprint) throw new Error('更新计划基线已变化，请重新生成计划');
}

const ALLOWED_STATE_FILES = new Set([
  '.product-kb-meta.json',
  '.source/source-snapshot.json',
  '.source/source-summary.md',
  '.source/managed-manifest.json',
  '.source/validation-report.json',
  '.source/semantic-evaluation.json',
  '.source/evaluation-report.json',
  '.source/evaluation-report.md',
]);

function currentManagedPaths(root) {
  return new Set(inspectKnowledgeBase(root).managed.map(item => item.path));
}

function validateOperationOwnership(root, operation, managedPaths) {
  const relative = toRelativePath(operation.path);
  const target = safePath(root, relative);
  if (operation.type === 'replaceStateFile') {
    if (!ALLOWED_STATE_FILES.has(relative)) throw new Error(`不允许替换非生命周期状态文件: ${relative}`);
    return;
  }
  if (operation.type === 'createManaged' && fs.existsSync(target) && !managedPaths.has(relative)) throw new Error(`拒绝覆盖非受管文件: ${relative}`);
  if (operation.type === 'replaceManaged' && !managedPaths.has(relative)) throw new Error(`拒绝替换非受管文件: ${relative}`);
}

function applyPlan({root, plan, staging, backup}) {
  validateBaseline(root, plan);
  const operations = plan.operations || [];
  for (const operation of operations) safePath(root, operation.path);
  const managedPaths = currentManagedPaths(root);
  for (const operation of operations) validateOperationOwnership(root, operation, managedPaths);
  const applied = [];
  if (backup) {
    fs.mkdirSync(backup, {recursive: true});
    for (const operation of operations) {
      const target = safePath(root, operation.path);
      if (fs.existsSync(target)) copyRecursive(target, path.join(backup, operation.path));
    }
  }
  for (const operation of operations) {
    const target = safePath(root, operation.path);
    if (operation.type === 'preserveUnmanaged') continue;
    if (operation.type === 'deleteManaged') {
      const managed = inspectKnowledgeBase(root).managed.some(item => item.path === toRelativePath(operation.path));
      if (!managed) throw new Error(`拒绝删除非受管文件: ${operation.path}`);
      fs.rmSync(target, {force: true});
    } else if (['createManaged', 'replaceManaged', 'replaceStateFile'].includes(operation.type)) {
      if (!staging) throw new Error('写操作缺少 staging 目录');
      const source = safePath(staging, operation.path);
      if (!fs.existsSync(source)) throw new Error(`staging 文件不存在: ${operation.path}`);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      const temp = `${target}.product-kb-tmp`;
      fs.copyFileSync(source, temp);
      fs.renameSync(temp, target);
    } else throw new Error(`未知文件操作: ${operation.type}`);
    applied.push(operation);
  }
  return {applied, backup: backup || null};
}

module.exports = {managedMarker, parseMarker, safePath, inspectKnowledgeBase, applyPlan};
