#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { markdownToHtml } = require('./sync_from_docs');

const TYPE_ORDER = { epic: 0, feature: 1, story: 2, tech: 3 };
const ALLOWED_TYPES = new Set(Object.keys(TYPE_ORDER));

class ManifestSyncError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ManifestSyncError';
    this.code = code;
    this.details = details;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hashObject(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function stripFrontmatter(content) {
  return String(content).replace(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}

async function readJson(filePath, label) {
  let content;
  try {
    content = await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    throw new ManifestSyncError(`${label} not found: ${filePath}`, 'file_not_found');
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new ManifestSyncError(`${label} is not valid JSON: ${filePath}`, 'invalid_json');
  }
}

function normalizedTarget(target) {
  const value = {
    productId: Number(target?.productId),
    projectId: Number(target?.projectId),
    versionId: Number(target?.versionId),
    teamId: Number(target?.teamId),
  };
  for (const [key, id] of Object.entries(value)) {
    if (!Number.isInteger(id) || id <= 0) throw new ManifestSyncError(`Invalid target ${key}.`, 'invalid_target');
  }
  return value;
}

function sameTarget(first, second) {
  if (!first || !second) return false;
  return ['productId', 'projectId', 'versionId', 'teamId'].every((key) => Number(first[key]) === Number(second[key]));
}

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.items) || !manifest.tr1 || !manifest.artifactRoot) {
    throw new ManifestSyncError('Unsupported or incomplete sync manifest.', 'invalid_manifest');
  }
  const ids = new Set();
  for (const item of manifest.items) {
    if (!item.artifactId || !ALLOWED_TYPES.has(item.type) || !item.relativePath || !item.contentHash) {
      throw new ManifestSyncError('Manifest contains an incomplete artifact item.', 'invalid_manifest_item');
    }
    if (ids.has(item.artifactId)) throw new ManifestSyncError(`Duplicate artifact id: ${item.artifactId}`, 'duplicate_artifact_id');
    ids.add(item.artifactId);
  }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function readVerifiedFile(manifest, descriptor) {
  const root = path.resolve(manifest.artifactRoot);
  const filePath = path.resolve(root, descriptor.relativePath);
  if (!isInside(root, filePath)) throw new ManifestSyncError(`Path escapes artifact root: ${descriptor.relativePath}`, 'path_escape');
  const stat = await fsp.lstat(filePath).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    throw new ManifestSyncError(`Artifact is not a regular file: ${descriptor.relativePath}`, 'invalid_artifact_file');
  }
  const buffer = await fsp.readFile(filePath);
  if (sha256(buffer) !== descriptor.contentHash) {
    throw new ManifestSyncError(`Artifact changed after manifest generation: ${descriptor.relativePath}`, 'local_file_changed');
  }
  return { filePath, buffer, content: buffer.toString('utf8') };
}

function normalizeRemote(raw) {
  const value = raw?.data || raw || {};
  return {
    id: Number(value.id),
    name: value.name || '',
    type: value.issueCategory || value.issue_category?.key || '',
    parentId: Number(value.parentId || value.parent_id || value.parent?.id || 0) || null,
    desc: value.desc || '',
    updatedAt: value.updatedAt || value.update_at || '',
    projectId: Number(value.ipdProjectId || value.ipd_project_id || value.ipd_project?.id || 0) || null,
    versionId: Number(value.planVersionId || value.plan_version_v2_id || value.plan_version_v2?.id || 0) || null,
    teamId: Number(value.teamVersionId || value.version_id || value.version?.id || 0) || null,
  };
}

function remoteFingerprint(remote) {
  return hashObject({
    id: remote.id,
    name: remote.name,
    type: remote.type,
    parentId: remote.parentId,
    desc: remote.desc,
    updatedAt: remote.updatedAt,
    projectId: remote.projectId,
    versionId: remote.versionId,
    teamId: remote.teamId,
  });
}

async function listIssues(ipdApi, target) {
  const result = [];
  const seen = new Set();
  for (let page = 1; page <= 100; page += 1) {
    let response;
    try {
      response = await ipdApi.getIssuesByScope({
        projectId: target.projectId,
        per: 500,
        page,
      });
    } catch {
      throw new ManifestSyncError('IPD read failed while building the preview.', 'preview_query_failed');
    }
    const list = response?.list || [];
    let added = 0;
    for (const item of list) {
      if (seen.has(Number(item.id))) continue;
      seen.add(Number(item.id));
      result.push(normalizeRemote(item));
      added += 1;
    }
    if (!list.length || !added || result.length >= Number(response?.total || result.length)) break;
  }
  return result;
}

async function loadIndex(indexPath) {
  try {
    const index = await readJson(indexPath, 'Sync index');
    if (index?.schemaVersion !== 1) throw new ManifestSyncError('Unsupported sync index version.', 'invalid_index');
    return { ...index, items: index.items || {}, attachments: index.attachments || {} };
  } catch (error) {
    if (error.code !== 'file_not_found') throw error;
    return { schemaVersion: 1, items: {}, attachments: {} };
  }
}

async function validateRouting(routing, manifest, ipdApi, conflicts) {
  const routes = [
    ['review', manifest.tr1.review],
    ['aiContext', manifest.tr1.aiContext],
  ];
  for (const [key] of routes) {
    const route = routing?.[key];
    if (!route) {
      conflicts.push({ code: 'missing_tr1_route', document: key });
      continue;
    }
    if (key === 'aiContext' && route.kind !== 'issueAttachment') {
      conflicts.push({ code: 'invalid_ai_context_route', document: key, kind: route.kind });
      continue;
    }
    if (route.kind === 'deliverable') {
      const deliverableId = Number(route.deliverableId);
      const activityId = Number(route.activityId);
      if (!deliverableId || !activityId || typeof ipdApi.getActivityDeliverables !== 'function') {
        conflicts.push({ code: 'invalid_deliverable_route', document: key });
        continue;
      }
      let deliverables;
      try {
        deliverables = await ipdApi.getActivityDeliverables(activityId);
      } catch {
        throw new ManifestSyncError('IPD deliverable query failed while building the preview.', 'preview_query_failed');
      }
      if (!(deliverables || []).some((item) => Number(item.id) === deliverableId)) {
        conflicts.push({ code: 'deliverable_not_found', document: key, deliverableId, activityId });
      }
    } else if (route.kind === 'issueAttachment') {
      const artifact = manifest.items.find((item) => item.artifactId === route.rootEpicArtifactId);
      if (!artifact || artifact.type !== 'epic' || artifact.parentArtifactId) {
        conflicts.push({ code: 'invalid_root_epic_route', document: key, rootEpicArtifactId: route.rootEpicArtifactId });
      }
    } else {
      conflicts.push({ code: 'invalid_tr1_route', document: key, kind: route.kind });
    }
  }
}

function operationCounts(operations, unchanged, conflicts) {
  return {
    create: operations.filter((item) => item.action === 'create').length,
    update: operations.filter((item) => item.action === 'update').length,
    upload: operations.filter((item) => item.action === 'upload').length,
    unchanged: unchanged.length,
    conflict: conflicts.length,
  };
}

async function buildSyncPlan({ manifestPath, indexPath, target, routing, ipdApi }) {
  if (!ipdApi) throw new ManifestSyncError('IPD API dependency is required.', 'missing_ipd_api');
  const normalized = normalizedTarget(target);
  const manifest = await readJson(manifestPath, 'Sync manifest');
  validateManifest(manifest);
  const index = await loadIndex(indexPath);
  const conflicts = [...(manifest.conflicts || [])];
  if (index.target && !sameTarget(index.target, normalized)) {
    conflicts.push({ code: 'target_mismatch', indexedTarget: index.target, selectedTarget: normalized });
  }

  for (const item of manifest.items) {
    try {
      await readVerifiedFile(manifest, item);
    } catch (error) {
      conflicts.push({ code: error.code || 'invalid_artifact_file', artifactId: item.artifactId, path: item.relativePath });
    }
  }
  for (const [key, descriptor] of [['review', manifest.tr1.review], ['aiContext', manifest.tr1.aiContext]]) {
    try {
      await readVerifiedFile(manifest, descriptor);
    } catch (error) {
      conflicts.push({ code: error.code || 'invalid_artifact_file', document: key, path: descriptor.relativePath });
    }
  }

  const remoteList = await listIssues(ipdApi, normalized);
  const operations = [];
  const unchanged = [];
  const remoteSnapshots = {};
  const sortedItems = [...manifest.items].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.artifactId.localeCompare(b.artifactId));

  for (const item of sortedItems) {
    const binding = index.items[item.artifactId];
    if (!binding) {
      const sameName = remoteList.filter((remote) => remote.name === item.name);
      if (sameName.length) {
        conflicts.push({
          code: 'unbound_same_name',
          artifactId: item.artifactId,
          name: item.name,
          candidates: sameName.map((candidate) => ({ id: candidate.id, type: candidate.type })),
        });
        continue;
      }
      operations.push({ action: 'create', artifactId: item.artifactId, type: item.type, parentArtifactId: item.parentArtifactId });
      continue;
    }

    let remote;
    try {
      remote = normalizeRemote(await ipdApi.getIssue(binding.issueId));
    } catch {
      remote = null;
    }
    if (!remote?.id) {
      conflicts.push({ code: 'invalid_index_binding', artifactId: item.artifactId, issueId: binding.issueId });
      continue;
    }
    remoteSnapshots[item.artifactId] = remoteFingerprint(remote);
    if (remote.type && remote.type !== item.type) {
      conflicts.push({ code: 'remote_type_mismatch', artifactId: item.artifactId, issueId: remote.id, expected: item.type, actual: remote.type });
      continue;
    }
    const scopeMismatch = (remote.projectId && remote.projectId !== normalized.projectId)
      || (remote.versionId && remote.versionId !== normalized.versionId)
      || (remote.teamId && remote.teamId !== normalized.teamId);
    if (scopeMismatch) {
      conflicts.push({
        code: 'remote_scope_mismatch',
        artifactId: item.artifactId,
        issueId: remote.id,
        expected: normalized,
        actual: { projectId: remote.projectId, versionId: remote.versionId, teamId: remote.teamId },
      });
      continue;
    }
    const expectedParentId = item.parentArtifactId ? Number(index.items[item.parentArtifactId]?.issueId || 0) || null : null;
    if (item.parentArtifactId && !expectedParentId) {
      conflicts.push({ code: 'missing_parent_binding', artifactId: item.artifactId, parentArtifactId: item.parentArtifactId });
      continue;
    }
    if (remote.parentId !== expectedParentId) {
      conflicts.push({ code: 'remote_parent_mismatch', artifactId: item.artifactId, issueId: remote.id, expectedParentId, actualParentId: remote.parentId });
      continue;
    }
    if (binding.contentHash === item.contentHash && binding.name === item.name) {
      unchanged.push({ kind: 'issue', artifactId: item.artifactId, issueId: remote.id });
    } else {
      operations.push({ action: 'update', artifactId: item.artifactId, type: item.type, issueId: remote.id });
    }
  }

  await validateRouting(routing, manifest, ipdApi, conflicts);
  for (const [key, descriptor] of [['review', manifest.tr1.review], ['aiContext', manifest.tr1.aiContext]]) {
    const route = routing?.[key];
    if (!route) continue;
    const prior = index.attachments[key];
    if (prior?.contentHash === descriptor.contentHash
      && prior.kind === route.kind
      && (route.kind !== 'deliverable' || (Number(prior.deliverableId) === Number(route.deliverableId) && Number(prior.activityId) === Number(route.activityId)))
      && (route.kind !== 'issueAttachment' || prior.rootEpicArtifactId === route.rootEpicArtifactId)) {
      unchanged.push({ kind: 'tr1', document: key });
    } else {
      operations.push({ action: 'upload', document: key, route });
    }
  }

  const stablePlan = {
    schemaVersion: 1,
    target: normalized,
    routing,
    manifestFingerprint: hashObject({
      schemaVersion: manifest.schemaVersion,
      artifactRoot: manifest.artifactRoot,
      items: manifest.items,
      tr1: manifest.tr1,
      conflicts: manifest.conflicts || [],
    }),
    remoteSnapshots,
    operations,
    unchanged,
    conflicts,
  };
  return {
    ...stablePlan,
    counts: operationCounts(operations, unchanged, conflicts),
    planHash: hashObject(stablePlan),
  };
}

async function writeJsonAtomic(filePath, value) {
  const absolute = path.resolve(filePath);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, absolute);
}

async function checkpoint(indexPath, index) {
  await writeJsonAtomic(indexPath, index);
}

async function applySyncPlan(options) {
  const plan = await buildSyncPlan(options);
  if (!options.expectedPlanHash || options.expectedPlanHash !== plan.planHash) {
    throw new ManifestSyncError('The preview is stale; generate a new preview and confirm it again.', 'stale_plan', {
      expectedPlanHash: options.expectedPlanHash || null,
      actualPlanHash: plan.planHash,
    });
  }
  if (plan.conflicts.length) throw new ManifestSyncError('The plan contains unresolved conflicts.', 'unresolved_conflicts', { conflicts: plan.conflicts });

  const manifest = await readJson(options.manifestPath, 'Sync manifest');
  const index = await loadIndex(options.indexPath);
  index.target = plan.target;
  const byId = new Map(manifest.items.map((item) => [item.artifactId, item]));
  const resolvedIssueIds = new Map(Object.entries(index.items).map(([artifactId, binding]) => [artifactId, Number(binding.issueId)]));
  let completed = 0;

  for (const operation of plan.operations) {
    try {
      if (operation.action === 'create' || operation.action === 'update') {
        const item = byId.get(operation.artifactId);
        const document = await readVerifiedFile(manifest, item);
        const description = markdownToHtml(stripFrontmatter(document.content));
        const parentId = item.parentArtifactId ? resolvedIssueIds.get(item.parentArtifactId) : undefined;
        if (item.parentArtifactId && !parentId) throw new Error(`Parent is not resolved: ${item.parentArtifactId}`);
        let issueId;
        if (operation.action === 'create') {
          const created = await options.ipdApi.createIssue(item.type, item.name, {
            productId: plan.target.productId,
            ipdProjectId: plan.target.projectId,
            planVersionId: plan.target.versionId,
            teamVersionId: plan.target.teamId,
            parentId,
            desc: description,
            ...(item.type === 'tech' && item.estimatedDay !== undefined ? { estimatedDay: item.estimatedDay } : {}),
          });
          issueId = Number(created.id);
        } else {
          issueId = Number(operation.issueId);
          const fields = { name: item.name, desc: description };
          if (item.type === 'tech' && item.estimatedDay !== undefined) {
            fields.estimated_day = item.estimatedDay;
            fields.effort_estimation = item.estimatedDay * 480;
          }
          await options.ipdApi.updateIssue(issueId, fields);
        }
        resolvedIssueIds.set(item.artifactId, issueId);
        index.items[item.artifactId] = {
          issueId,
          type: item.type,
          parentArtifactId: item.parentArtifactId,
          name: item.name,
          contentHash: item.contentHash,
        };
      } else if (operation.action === 'upload') {
        const descriptor = manifest.tr1[operation.document];
        const document = await readVerifiedFile(manifest, descriptor);
        const filename = path.basename(descriptor.relativePath);
        if (operation.route.kind === 'deliverable') {
          const uploaded = await options.ipdApi.uploadDeliverableFile(
            Number(operation.route.deliverableId),
            Number(operation.route.activityId),
            document.buffer,
            filename,
          );
          index.attachments[operation.document] = {
            kind: 'deliverable',
            deliverableId: Number(operation.route.deliverableId),
            activityId: Number(operation.route.activityId),
            contentHash: descriptor.contentHash,
            filePath: uploaded.filePath || '',
          };
        } else {
          const issueId = resolvedIssueIds.get(operation.route.rootEpicArtifactId);
          if (!issueId) throw new Error(`Root Epic is not resolved: ${operation.route.rootEpicArtifactId}`);
          const previous = index.attachments[operation.document];
          const uploaded = await options.ipdApi.uploadIssueAttachment(issueId, document.buffer, filename);
          if (previous?.attachmentId && typeof options.ipdApi.getIssueAttachments === 'function') {
            const attachments = await options.ipdApi.getIssueAttachments(issueId);
            const retained = (attachments || []).filter((item) => Number(item.id) !== Number(previous.attachmentId)).map((item) => Number(item.id));
            if (retained.length !== attachments.length && typeof options.ipdApi.updateIssue === 'function') {
              await options.ipdApi.updateIssue(issueId, { attachment_ids: retained });
            }
          }
          index.attachments[operation.document] = {
            kind: 'issueAttachment',
            rootEpicArtifactId: operation.route.rootEpicArtifactId,
            issueId,
            attachmentId: Number(uploaded.attachmentId),
            contentHash: descriptor.contentHash,
          };
        }
      }
      completed += 1;
      await checkpoint(options.indexPath, index);
    } catch (error) {
      throw new ManifestSyncError(`Sync stopped after ${completed} successful operation(s). The external operation failed.`, 'apply_failed', {
        completed,
        operation,
      });
    }
  }
  return { completed, counts: plan.counts, planHash: plan.planHash };
}

function previewMarkdown(plan) {
  const reviewRoute = plan.routing?.review;
  const aiRoute = plan.routing?.aiContext;
  const lines = [
    '# IPD 同步预览',
    '',
    `- Plan Hash：\`${plan.planHash}\``,
    `- 目标：产品 ${plan.target.productId}／项目 ${plan.target.projectId}／版本 ${plan.target.versionId}／团队 ${plan.target.teamId}`,
    `- 创建：${plan.counts.create}`,
    `- 更新：${plan.counts.update}`,
    `- 上传：${plan.counts.upload}`,
    `- 不变：${plan.counts.unchanged}`,
    `- 冲突：${plan.counts.conflict}`,
    `- TR1 评审版：${reviewRoute?.kind === 'deliverable' ? `交付物 ${reviewRoute.deliverableId}／活动 ${reviewRoute.activityId}` : reviewRoute?.rootEpicArtifactId ? `根 Epic ${reviewRoute.rootEpicArtifactId} 附件` : '未配置'}`,
    `- TR1 AI 上下文版：${aiRoute?.rootEpicArtifactId ? `根 Epic ${aiRoute.rootEpicArtifactId} 附件` : '未配置'}`,
    '',
    '## 不会执行',
    '',
    '- 不删除 IPD 需求。',
    '- 不修改状态、负责人或优先级。',
    '- 不创建产品、项目或版本。',
  ];
  if (plan.conflicts.length) {
    lines.push('', '## 冲突', '');
    for (const conflict of plan.conflicts) lines.push(`- ${conflict.code}：${conflict.artifactId || conflict.document || conflict.name || ''}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new ManifestSyncError(`Unknown argument: ${arg}`, 'invalid_argument');
    values[arg.slice(2)] = argv[++index];
  }
  return values;
}

function routingFromArgs(args) {
  const rootEpicArtifactId = args.rootEpicArtifactId;
  const review = args.reviewDeliverableId
    ? { kind: 'deliverable', deliverableId: Number(args.reviewDeliverableId), activityId: Number(args.reviewActivityId) }
    : { kind: 'issueAttachment', rootEpicArtifactId };
  return {
    review,
    aiContext: { kind: 'issueAttachment', rootEpicArtifactId },
  };
}

function loadIpdApi() {
  if (fs.existsSync(path.join(__dirname, 'ipd_api.js'))) return require('./ipd_api');
  const skillsBase = process.env.SKILLS_BASE_DIR
    || (process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills') : path.join(os.homedir(), '.claude', 'skills'));
  return require(path.join(skillsBase, 'qianliu-ipd/scripts/ipd_api.js'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    manifestPath: args.manifest,
    indexPath: args.index,
    target: { productId: args.productId, projectId: args.projectId, versionId: args.versionId, teamId: args.teamId },
    routing: routingFromArgs(args),
    expectedPlanHash: args.expectedPlanHash,
    ipdApi: loadIpdApi(),
  };
  if (args.mode === 'preview') {
    const plan = await buildSyncPlan(options);
    if (args.previewFile) {
      await fsp.mkdir(path.dirname(path.resolve(args.previewFile)), { recursive: true });
      await fsp.writeFile(args.previewFile, previewMarkdown(plan), 'utf8');
    }
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  if (args.mode === 'apply') {
    console.log(JSON.stringify(await applySyncPlan(options), null, 2));
    return;
  }
  throw new ManifestSyncError('Use --mode preview or --mode apply.', 'invalid_mode');
}

module.exports = {
  ManifestSyncError,
  applySyncPlan,
  buildSyncPlan,
  previewMarkdown,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, code: error.code || 'manifest_sync_error', message: error.message }));
    process.exitCode = 1;
  });
}
