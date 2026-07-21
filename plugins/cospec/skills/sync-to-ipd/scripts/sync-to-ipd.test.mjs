import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  bindIndex,
  buildManifest,
  discoverArtifactSets,
  SyncPreparationError,
} from './sync-to-ipd.mjs';

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cospec-sync-to-ipd-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

function artifact(type, id, parentId, title) {
  const parent = parentId ? `  parent_artifact_id: ${parentId}\n` : '';
  const estimate = type === 'tech' ? '  estimated_day: 1.5\n' : '';
  return `---\ncospec_artifact:\n  schema_version: 1\n  artifact_id: ${id}\n  artifact_type: ${type}\n${parent}${estimate}  source_ids:\n    - ${id}\n---\n# ${title}\n\n正文\n`;
}

async function completeSet(root, { secondEpic = false } = {}) {
  await write(root, '域控_大需求用户需求规格说明书_评审版.md', '# 评审版\n');
  await write(root, '域控_大需求用户需求规格说明书_AI上下文版.md', '# AI 上下文版\n');
  await write(root, 'EPIC-登录/EPIC-登录.md', artifact('epic', 'EPIC-001', null, '登录'));
  await write(root, 'EPIC-登录/Feature-认证/Feature-认证.md', artifact('feature', 'FEAT-001', 'EPIC-001', '认证'));
  await write(root, 'EPIC-登录/Feature-认证/Story-口令.md', artifact('story', 'ST-001', 'FEAT-001', '口令登录'));
  await write(root, 'EPIC-登录/Feature-认证/Tech-接口.md', artifact('tech', 'TECH-001', 'ST-001', '认证接口'));
  if (secondEpic) {
    await write(root, 'EPIC-审计/EPIC-审计.md', artifact('epic', 'EPIC-002', null, '审计'));
  }
}

async function legacyFlatSet(root) {
  await write(root, 'docs/03-TR1用户需求说明书-评审版.md', '# 大需求评审版\n');
  await write(root, 'docs/04-TR1用户需求说明书-AI上下文版.md', '# AI上下文版\n');
  await write(root, 'docs/05-TR2-EPIC.md', '# TR2 EPIC\n\n## EPIC-001：登录能力\n\nEpic 正文\n');
  await write(root, 'docs/06-TR2-Feature.md', [
    '# TR2 Feature 拆解',
    '',
    '| Feature ID | 所属 EPIC | Feature 名称 |',
    '|---|---|---|',
    '| FEAT-001 | EPIC-001 | 认证能力 |',
    '',
    '# FEAT-001：认证能力',
    '',
    'Feature 正文',
    '',
  ].join('\n'));
  await write(root, 'docs/07-TR2-Story.md', [
    '# TR2 Story 文档',
    '',
    '# EPIC-001 登录能力 / Feature-001 认证能力',
    '',
    '## Story-001：口令登录',
    '',
    'Story 正文',
    '',
  ].join('\n'));
  await write(root, 'docs/08-TR2-Tech.md', [
    '# Tech-认证接口',
    '',
    '> **父级**：FEAT-001',
    '',
    'Tech 正文',
    '',
  ].join('\n'));
}

test('discovers complete large-requirement artifact sets', async (t) => {
  const root = await workspace(t);
  const set = path.join(root, 'product-planning', '域控');
  await completeSet(set);

  const found = await discoverArtifactSets(path.join(root, 'product-planning'));
  assert.equal(found.length, 1);
  assert.equal(found[0].root, set);
  assert.equal(found[0].reviewFile.endsWith('_评审版.md'), true);
  assert.equal(found[0].aiContextFile.endsWith('_AI上下文版.md'), true);
});

test('discovers a legacy flat cospec artifact bundle', async (t) => {
  const root = await workspace(t);
  await legacyFlatSet(root);

  const found = await discoverArtifactSets(root);
  assert.equal(found.length, 1);
  assert.equal(found[0].root, path.join(root, 'docs'));
  assert.equal(found[0].format, 'legacy-flat');
});

test('migrates an explicitly mapped legacy flat bundle into an isolated snapshot', async (t) => {
  const root = await workspace(t);
  await legacyFlatSet(root);
  const snapshotRoot = path.join(root, 'state', 'snapshot');

  const blocked = await buildManifest(path.join(root, 'docs'), { legacyOutputRoot: snapshotRoot });
  assert.equal(blocked.conflicts.some((item) => item.code === 'legacy_tech_mapping_required'), true);

  const manifest = await buildManifest(path.join(root, 'docs'), {
    legacyOutputRoot: snapshotRoot,
    legacyTechId: 'TECH-001',
    legacyTechParentId: 'FEAT-001',
  });
  assert.equal(manifest.format, 'legacy-flat');
  assert.equal(manifest.artifactRoot, snapshotRoot);
  assert.deepEqual(manifest.summary, { epic: 1, feature: 1, story: 1, tech: 1 });
  assert.deepEqual(manifest.conflicts, []);
  assert.equal(manifest.items.find((item) => item.artifactId === 'ST-001').parentArtifactId, 'FEAT-001');
  assert.equal(manifest.items.find((item) => item.artifactId === 'TECH-001').parentArtifactId, 'FEAT-001');
  assert.match(await readFile(path.join(snapshotRoot, 'artifacts', 'TECH-001.md'), 'utf8'), /artifact_id: TECH-001/);
});

test('builds a stable manifest with explicit hierarchy and two TR1 files', async (t) => {
  const root = await workspace(t);
  await completeSet(root);

  const manifest = await buildManifest(root);
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.summary, { epic: 1, feature: 1, story: 1, tech: 1 });
  assert.deepEqual(manifest.rootEpicArtifactIds, ['EPIC-001']);
  assert.equal(manifest.items.find((item) => item.artifactId === 'TECH-001').parentArtifactId, 'ST-001');
  assert.equal(manifest.items.find((item) => item.artifactId === 'TECH-001').estimatedDay, 1.5);
  assert.equal(manifest.tr1.review.relativePath.endsWith('_评审版.md'), true);
  assert.equal(manifest.tr1.aiContext.relativePath.endsWith('_AI上下文版.md'), true);
  assert.deepEqual(manifest.conflicts, []);
});

test('reports multiple root Epics for an explicit routing decision', async (t) => {
  const root = await workspace(t);
  await completeSet(root, { secondEpic: true });

  const manifest = await buildManifest(root);
  assert.deepEqual(manifest.rootEpicArtifactIds, ['EPIC-001', 'EPIC-002']);
});

test('fails closed when either large-requirement TR1 file is missing', async (t) => {
  const root = await workspace(t);
  await write(root, '域控_大需求用户需求规格说明书_评审版.md', '# 评审版\n');

  await assert.rejects(buildManifest(root), (error) => {
    assert(error instanceof SyncPreparationError);
    assert.equal(error.code, 'incomplete_tr1_pair');
    return true;
  });
});

test('marks legacy Tech without a stable TECH id as a migration conflict', async (t) => {
  const root = await workspace(t);
  await completeSet(root);
  await write(root, 'EPIC-登录/Feature-认证/Tech-遗留.md', '# 遗留 Tech\n\n支撑对象：FEAT-001\n');

  const manifest = await buildManifest(root);
  assert.equal(manifest.conflicts.some((item) => item.code === 'missing_artifact_id'), true);
});

test('rejects invalid parent types before any IPD query', async (t) => {
  const root = await workspace(t);
  await completeSet(root);
  await write(root, 'EPIC-登录/Feature-认证/Story-口令.md', artifact('story', 'ST-001', 'EPIC-001', '口令登录'));

  const manifest = await buildManifest(root);
  assert.equal(manifest.conflicts.some((item) => item.code === 'invalid_parent_type'), true);
});

test('binds an explicitly selected IPD issue only in the local index', async (t) => {
  const root = await workspace(t);
  const indexPath = path.join(root, '.ipd-sync', 'index.json');

  const result = await bindIndex({ indexPath, artifactId: 'FEAT-001', issueId: 12345 });
  assert.equal(result.issueId, 12345);
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  assert.deepEqual(index.items['FEAT-001'], { issueId: 12345 });
});
