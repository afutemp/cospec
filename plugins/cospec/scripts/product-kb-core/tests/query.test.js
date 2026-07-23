'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {queryKnowledgeBase} = require('../scripts/query');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'query-kb-'));
  fs.mkdirSync(path.join(root, '.source'), {recursive:true});
  fs.mkdirSync(path.join(root, '03-功能规划'), {recursive:true});
  fs.writeFileSync(path.join(root, '.product-kb-meta.json'), JSON.stringify({snapshot:{collectedAt:'2026-07-01T00:00:00Z'},documentSources:{'03-功能规划/2-F.md':['IPD-2']}}));
  fs.writeFileSync(path.join(root, '.source/source-snapshot.json'), JSON.stringify({collectedAt:'2026-07-01T00:00:00Z',issues:[{id:'2',category:'feature',name:'智能规划',status:'开发中',priority:'高',assignee:'张三',url:'https://ipd.test/2'}]}));
  fs.writeFileSync(path.join(root, '03-功能规划/2-F.md'), '# 智能规划\n支持权限和知识库更新。');
  return root;
}

test('query filters local snapshot and includes traceability', () => {
  const root = setup();
  const result = queryKnowledgeBase(root, {filters:{status:'开发中',owner:'张三'}, terms:['权限'], limit:20});
  assert.equal(result.total, 1);
  assert.equal(result.items[0].documentPath, '03-功能规划/2-F.md');
  assert.deepEqual(result.items[0].sourceIds, ['IPD-2']);
  assert.equal(result.items[0].sourceUrls[0], 'https://ipd.test/2');
  assert.equal(result.snapshotAt, '2026-07-01T00:00:00Z');
});

test('query latest warns without accessing IPD', () => {
  const root = setup();
  const result = queryKnowledgeBase(root, {terms:['最新'], requireLatest:true, now:'2026-07-13T00:00:00Z', staleAfterDays:7});
  assert.ok(result.warnings.some(item => item.code === 'SNAPSHOT_STALE'));
});
