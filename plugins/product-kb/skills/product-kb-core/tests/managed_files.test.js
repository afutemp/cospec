'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {fingerprint} = require('../scripts/collect');
const {managedMarker, inspectKnowledgeBase, applyPlan} = require('../scripts/managed_files');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-kb-'));
  fs.mkdirSync(path.join(root, '.source'), {recursive: true});
  return root;
}

function writeManaged(root, rel, sourceIds = ['IPD-2']) {
  const content = `---\nname: 测试\n---\n${managedMarker({sourceIds, fingerprint: 'sha256:source', generationId: 'gen-1'})}\n# 测试\n`;
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content);
  return fingerprint(content);
}

test('inspect classifies only triple-proven managed files', () => {
  const root = setup();
  const rel = '03-功能规划/2-测试.md';
  const fileFingerprint = writeManaged(root, rel);
  fs.writeFileSync(path.join(root, '.product-kb-meta.json'), JSON.stringify({managedFiles: {[rel]: {fingerprint: fileFingerprint, sourceIds: ['IPD-2']}}}));
  fs.writeFileSync(path.join(root, '.source/managed-manifest.json'), JSON.stringify({files: [{path: rel, sourceIds: ['IPD-2'], fingerprint: fileFingerprint}]}));
  const result = inspectKnowledgeBase(root);
  assert.equal(result.managed[0].path, rel);
  fs.writeFileSync(path.join(root, '.source/managed-manifest.json'), JSON.stringify({files: []}));
  assert.equal(inspectKnowledgeBase(root).managed.length, 0);
});

test('apply rejects path traversal and preserves outside file', () => {
  const root = setup();
  const outside = path.join(path.dirname(root), 'outside.txt');
  fs.writeFileSync(outside, 'safe');
  assert.throws(() => applyPlan({root, plan: {operations: [{type: 'deleteManaged', path: '../outside.txt'}]}}), /知识库根目录/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'safe');
});

test('apply rejects symlink escape from knowledge base', () => {
  const root = setup();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-outside-'));
  fs.writeFileSync(path.join(outsideDir, 'protected.md'), 'safe');
  fs.symlinkSync(outsideDir, path.join(root, 'linked'), 'junction');
  assert.throws(() => applyPlan({root, plan: {operations: [{type: 'deleteManaged', path: 'linked/protected.md'}]}}), /符号链接|受管文件/);
  assert.equal(fs.readFileSync(path.join(outsideDir, 'protected.md'), 'utf8'), 'safe');
});

test('apply rejects create through a symlinked directory', () => {
  const root = setup();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-create-outside-'));
  const staging = path.join(root, '.source/staging');
  fs.mkdirSync(path.join(staging, 'linked'), {recursive: true});
  fs.writeFileSync(path.join(staging, 'linked/new.md'), 'new');
  fs.symlinkSync(outsideDir, path.join(root, 'linked'), 'junction');
  assert.throws(() => applyPlan({root, staging, plan: {operations: [{type: 'createManaged', path: 'linked/new.md'}]}}), /符号链接/);
  assert.equal(fs.existsSync(path.join(outsideDir, 'new.md')), false);
});

test('apply preserves unmanaged files and rejects stale baseline', () => {
  const root = setup();
  fs.writeFileSync(path.join(root, 'manual.md'), 'manual');
  assert.throws(() => applyPlan({root, plan: {baseline: {metaFingerprint: 'sha256:stale'}, operations: []}}), /基线/);
  assert.equal(fs.readFileSync(path.join(root, 'manual.md'), 'utf8'), 'manual');
});

test('apply refuses to create over or replace an unmanaged file', () => {
  const root = setup();
  const staging = path.join(root, '.source/staging');
  fs.mkdirSync(staging, {recursive: true});
  fs.writeFileSync(path.join(root, 'manual.md'), 'manual');
  fs.writeFileSync(path.join(staging, 'manual.md'), 'generated');
  for (const type of ['createManaged', 'replaceManaged']) {
    assert.throws(() => applyPlan({root, staging, plan: {operations: [{type, path: 'manual.md'}]}}), /非受管文件/);
    assert.equal(fs.readFileSync(path.join(root, 'manual.md'), 'utf8'), 'manual');
  }
});

test('apply restricts replaceStateFile to lifecycle state paths', () => {
  const root = setup();
  const staging = path.join(root, '.source/staging');
  fs.mkdirSync(staging, {recursive: true});
  fs.writeFileSync(path.join(root, 'manual.json'), 'manual');
  fs.writeFileSync(path.join(staging, 'manual.json'), '{}');
  assert.throws(() => applyPlan({root, staging, plan: {operations: [{type: 'replaceStateFile', path: 'manual.json'}]}}), /状态文件/);
  assert.equal(fs.readFileSync(path.join(root, 'manual.json'), 'utf8'), 'manual');
});

test('apply creates and replaces managed files from staging', () => {
  const root = setup();
  const staging = path.join(root, '.source/staging');
  fs.mkdirSync(staging, {recursive: true});
  const rel = 'README.md';
  fs.writeFileSync(path.join(staging, rel), 'new');
  const result = applyPlan({root, staging, plan: {operations: [{type: 'createManaged', path: rel}]}});
  assert.equal(fs.readFileSync(path.join(root, rel), 'utf8'), 'new');
  assert.equal(result.applied.length, 1);
});
