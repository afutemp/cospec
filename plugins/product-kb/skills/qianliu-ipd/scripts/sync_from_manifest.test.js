'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, mkdir, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applySyncPlan,
  buildSyncPlan,
  ManifestSyncError,
} = require('./sync_from_manifest');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qianliu-manifest-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.ipd-sync'), { recursive: true });
  const files = {
    epic: 'EPIC-登录/EPIC-登录.md',
    feature: 'EPIC-登录/Feature-认证/Feature-认证.md',
    story: 'EPIC-登录/Feature-认证/Story-口令.md',
    tech: 'EPIC-登录/Feature-认证/Tech-接口.md',
    review: '域控_大需求用户需求规格说明书_评审版.md',
    ai: '域控_大需求用户需求规格说明书_AI上下文版.md',
  };
  for (const [key, relativePath] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `# ${key}\n`, 'utf8');
  }
  const crypto = require('node:crypto');
  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const item = (artifactId, type, parentArtifactId, relativePath, name) => ({
    artifactId,
    type,
    parentArtifactId,
    relativePath,
    name,
    contentHash: hash(`# ${type}\n`),
    sourceIds: [artifactId],
  });
  const manifest = {
    schemaVersion: 1,
    artifactRoot: root,
    conflicts: [],
    rootEpicArtifactIds: ['EPIC-001'],
    items: [
      item('EPIC-001', 'epic', null, files.epic, '登录'),
      item('FEAT-001', 'feature', 'EPIC-001', files.feature, '认证'),
      item('ST-001', 'story', 'FEAT-001', files.story, '口令'),
      item('TECH-001', 'tech', 'ST-001', files.tech, '接口'),
    ],
    tr1: {
      review: { relativePath: files.review, contentHash: hash('# review\n') },
      aiContext: { relativePath: files.ai, contentHash: hash('# ai\n') },
    },
  };
  const manifestPath = path.join(root, '.ipd-sync', 'manifest.json');
  const indexPath = path.join(root, '.ipd-sync', 'index.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(indexPath, `${JSON.stringify({ schemaVersion: 1, items: {}, attachments: {} }, null, 2)}\n`, 'utf8');
  return { root, manifestPath, indexPath };
}

function fakeApi(remote = []) {
  const calls = [];
  let nextId = 1000;
  const byId = new Map(remote.map((item) => [Number(item.id), item]));
  return {
    calls,
    async getIssuesByScope() { return { total: remote.length, list: remote }; },
    async getIssue(id) { return { data: byId.get(Number(id)) }; },
    async getActivityDeliverables() { return [{ id: 77, name: 'TR1' }]; },
    async createIssue(type, name, options) {
      calls.push(['createIssue', type, name, options]);
      const value = { id: nextId++, name, issueCategory: type };
      byId.set(value.id, { ...value, issue_category: { key: type }, parent: options.parentId ? { id: options.parentId } : null });
      return value;
    },
    async updateIssue(id, fields) { calls.push(['updateIssue', id, fields]); },
    async uploadDeliverableFile(deliverableId, activityId, buffer, filename) {
      calls.push(['uploadDeliverableFile', deliverableId, activityId, buffer.toString('utf8'), filename]);
      return { filePath: '/uploaded/review.md' };
    },
    async getIssueAttachments() { return []; },
    async uploadIssueAttachment(issueId, buffer, filename) {
      calls.push(['uploadIssueAttachment', issueId, buffer.toString('utf8'), filename]);
      return { attachmentId: nextId++, issueId, filename };
    },
  };
}

const target = { productId: 9, projectId: 100, versionId: 200, teamId: 300 };
const routing = {
  review: { kind: 'deliverable', deliverableId: 77, activityId: 88 },
  aiContext: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
};

async function writeBoundIndex(paths, remote, { withAttachments = false } = {}) {
  const manifest = JSON.parse(await readFile(paths.manifestPath, 'utf8'));
  const byType = new Map(remote.map((item) => [item.issueCategory, item]));
  const items = {};
  for (const item of manifest.items) {
    const issue = byType.get(item.type);
    items[item.artifactId] = {
      issueId: issue.id,
      type: item.type,
      parentArtifactId: item.parentArtifactId,
      name: item.name,
      contentHash: item.contentHash,
    };
  }
  const attachments = withAttachments ? {
    review: {
      kind: 'deliverable',
      deliverableId: 77,
      activityId: 88,
      contentHash: manifest.tr1.review.contentHash,
    },
    aiContext: {
      kind: 'issueAttachment',
      rootEpicArtifactId: 'EPIC-001',
      contentHash: manifest.tr1.aiContext.contentHash,
    },
  } : {};
  await writeFile(paths.indexPath, `${JSON.stringify({ schemaVersion: 1, target, items, attachments }, null, 2)}\n`, 'utf8');
}

function remoteTree({ featureParentId = 10 } = {}) {
  return [
    { id: 10, name: '登录', issueCategory: 'epic', parent: null },
    { id: 11, name: '认证', issueCategory: 'feature', parent: { id: featureParentId } },
    { id: 12, name: '口令', issueCategory: 'story', parent: { id: 11 } },
    { id: 13, name: '接口', issueCategory: 'tech', parent: { id: 12 } },
  ];
}

test('preview computes creates and performs no writes', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();
  const plan = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });

  assert.equal(plan.counts.create, 4);
  assert.equal(plan.counts.upload, 2);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(api.calls.length, 0);
  assert.match(plan.planHash, /^[a-f0-9]{64}$/);
});

test('same-name remote issues without an index binding are conflicts', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi([{ id: 42, name: '登录', issueCategory: 'epic' }]);
  const plan = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });

  assert.equal(plan.conflicts.some((item) => item.code === 'unbound_same_name'), true);
  assert.equal(plan.operations.some((item) => item.artifactId === 'EPIC-001'), false);
});

test('a second preview is fully unchanged when issue and TR1 hashes match the index', async (t) => {
  const paths = await fixture(t);
  const remote = remoteTree();
  await writeBoundIndex(paths, remote, { withAttachments: true });
  const api = fakeApi(remote);
  const plan = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.counts.unchanged, 6);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(api.calls.length, 0);
});

test('an indexed parent drift is a blocking conflict, not an automatic move', async (t) => {
  const paths = await fixture(t);
  const remote = remoteTree({ featureParentId: 999 });
  await writeBoundIndex(paths, remote);
  const api = fakeApi(remote);
  const plan = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });

  assert.equal(plan.conflicts.some((item) => item.code === 'remote_parent_mismatch' && item.artifactId === 'FEAT-001'), true);
  assert.equal(api.calls.length, 0);
});

test('apply requires the exact preview hash and writes parent-first', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();
  const preview = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });
  const result = await applySyncPlan({ ...paths, target, routing, expectedPlanHash: preview.planHash, ipdApi: api });

  assert.equal(result.completed, 6);
  assert.deepEqual(api.calls.slice(0, 4).map((call) => [call[0], call[1]]), [
    ['createIssue', 'epic'],
    ['createIssue', 'feature'],
    ['createIssue', 'story'],
    ['createIssue', 'tech'],
  ]);
  assert.equal(api.calls[4][0], 'uploadDeliverableFile');
  assert.equal(api.calls[5][0], 'uploadIssueAttachment');
  const index = JSON.parse(await readFile(paths.indexPath, 'utf8'));
  assert.equal(Object.keys(index.items).length, 4);
  assert.equal(index.attachments.review.contentHash.length, 64);
});

test('falls back to two root Epic attachments when no deliverable is selected', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();
  const fallbackRouting = {
    review: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
    aiContext: { kind: 'issueAttachment', rootEpicArtifactId: 'EPIC-001' },
  };
  const preview = await buildSyncPlan({ ...paths, target, routing: fallbackRouting, ipdApi: api });
  await applySyncPlan({ ...paths, target, routing: fallbackRouting, expectedPlanHash: preview.planHash, ipdApi: api });

  assert.equal(api.calls.filter((call) => call[0] === 'uploadIssueAttachment').length, 2);
  assert.equal(api.calls.some((call) => call[0] === 'uploadDeliverableFile'), false);
});

test('AI context can only be routed to a root Epic attachment', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();
  const invalidRouting = {
    review: { kind: 'deliverable', deliverableId: 77, activityId: 88 },
    aiContext: { kind: 'deliverable', deliverableId: 77, activityId: 88 },
  };
  const plan = await buildSyncPlan({ ...paths, target, routing: invalidRouting, ipdApi: api });

  assert.equal(plan.conflicts.some((item) => item.code === 'invalid_ai_context_route'), true);
  assert.equal(api.calls.length, 0);
});

test('apply rejects stale confirmation without a write', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();

  await assert.rejects(applySyncPlan({
    ...paths,
    target,
    routing,
    expectedPlanHash: '0'.repeat(64),
    ipdApi: api,
  }), (error) => {
    assert(error instanceof ManifestSyncError);
    assert.equal(error.code, 'stale_plan');
    return true;
  });
  assert.equal(api.calls.length, 0);
});

test('partial failure stops immediately and preserves successful checkpoints', async (t) => {
  const paths = await fixture(t);
  const api = fakeApi();
  const originalCreate = api.createIssue;
  api.createIssue = async (type, name, options) => {
    if (type === 'story') throw new Error('network down');
    return originalCreate(type, name, options);
  };
  const preview = await buildSyncPlan({ ...paths, target, routing, ipdApi: api });

  await assert.rejects(applySyncPlan({ ...paths, target, routing, expectedPlanHash: preview.planHash, ipdApi: api }), {
    code: 'apply_failed',
  });
  const index = JSON.parse(await readFile(paths.indexPath, 'utf8'));
  assert.deepEqual(Object.keys(index.items), ['EPIC-001', 'FEAT-001']);
  assert.equal(api.calls.filter((call) => call[0] === 'createIssue').length, 2);
});
