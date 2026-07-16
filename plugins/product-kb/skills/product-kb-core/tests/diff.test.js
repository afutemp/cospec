'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {fingerprint} = require('../scripts/collect');
const {computeDiff, buildUpdatePlan, writeUpdatePreview} = require('../scripts/diff');

function issue(id, fields = {}) {
  const value = {id: String(id), category: 'feature', parentId: null, name: `F${id}`, status: '规划中', ...fields};
  value.fingerprint = fingerprint({...value, fingerprint: undefined});
  return value;
}

test('computeDiff classifies added modified deleted relationship and unchanged', () => {
  const oldSnapshot = {issues: [issue(1), issue(2), issue(3), issue(4)]};
  const newSnapshot = {issues: [issue(1), issue(2, {name: 'changed'}), issue(4, {parentId: '9'}), issue(5)]};
  const diff = computeDiff(oldSnapshot, newSnapshot);
  assert.deepEqual(diff.unchanged, ['1']);
  assert.deepEqual(diff.modified, ['2']);
  assert.deepEqual(diff.deleted, ['3']);
  assert.deepEqual(diff.relationshipChanged, ['4']);
  assert.deepEqual(diff.added, ['5']);
});

test('buildUpdatePlan maps feature changes and managed conflicts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-kb-'));
  const rel = '03-功能规划/2-F2.md';
  fs.mkdirSync(path.join(root, '03-功能规划'), {recursive: true});
  fs.writeFileSync(path.join(root, rel), 'changed externally');
  const oldSnapshot = {fingerprint: 'old', issues: [issue(2), issue(3)]};
  const newSnapshot = {fingerprint: 'new', issues: [issue(2, {name: 'new'}), issue(4)]};
  const meta = {managedFiles: {[rel]: {fingerprint: 'sha256:not-current', sourceIds: ['IPD-2']}}, documentSources: {[rel]: ['IPD-2'], '03-功能规划/3-F3.md': ['IPD-3']}};
  const plan = buildUpdatePlan({root, oldSnapshot, newSnapshot, meta, now: '2026-07-13T00:00:00Z'});
  assert.ok(plan.conflicts.some(item => item.path === rel));
  assert.ok(plan.operations.some(item => item.type === 'replaceManaged' && item.path === rel));
  assert.ok(plan.operations.some(item => item.type === 'deleteManaged' && item.path.includes('/3-')));
  assert.ok(plan.operations.some(item => item.type === 'createManaged' && item.sourceIds.includes('IPD-4')));
});

test('writeUpdatePreview writes user readable counts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-preview-'));
  const target = writeUpdatePreview(dir, {planId: 'p1', createdAt: 'now', changes: {added: ['1'], modified: [], deleted: [], relationshipChanged: [], unchanged: []}, conflicts: [], operations: []});
  assert.match(fs.readFileSync(target, 'utf8'), /新增: 1/);
});
