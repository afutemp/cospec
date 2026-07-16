'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {managedMarker} = require('../scripts/managed_files');
const {validateKnowledgeBase} = require('../scripts/validate');

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, content);
}

function completeKb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-kb-'));
  const aggregate = ['README.md','00-综述/01-产品战略与价值.md','00-综述/02-版本演进与里程碑.md','01-用户与机会/01-目标客户与角色.md','01-用户与机会/02-客户问题与JTBD.md','01-用户与机会/03-用户旅程与机会地图.md','02-规划与范围/01-需求池与优先级.md','02-规划与范围/02-版本范围与路线图.md','04-质量与约束/01-非功能需求与合规.md','05-协作与依赖/01-依赖风险与协作.md','06-验证与反馈/01-指标实验与反馈.md','附录/01-原型与资料索引.md'];
  const marker = managedMarker({sourceIds: ['IPD-1'], fingerprint: 'sha256:x', generationId: 'g'});
  for (const file of aggregate) write(root, file, `---\nname: ${file}\ndescription: x\nsource: IPD-1\nproduct: P\nversion: V\nscope: FULL\nstatus: DRAFT\nowner: PM\nupdated: 2026-07-13\n---\n${marker}\n# ${file}\n`);
  for (const id of ['2','5']) write(root, `03-功能规划/${id}-F.md`, `---\nname: F${id}\ndescription: x\nsource: IPD-${id}\nproduct: P\nversion: V\nscope: FULL\nstatus: DRAFT\nowner: PM\nupdated: 2026-07-13\n---\n${managedMarker({sourceIds: [`IPD-${id}`], fingerprint: 'sha256:x', generationId: 'g'})}\n# F${id}\n[IPD-${id}](https://ipd.test/${id})\n`);
  const snapshot = {schemaVersion:'1.0.0', issues:[{id:'1',category:'epic'},{id:'2',category:'feature',url:'https://ipd.test/2'},{id:'5',category:'feature',url:'https://ipd.test/5'}]};
  write(root, '.source/source-snapshot.json', JSON.stringify(snapshot));
  const files = [...aggregate, '03-功能规划/2-F.md','03-功能规划/5-F.md'];
  write(root, '.product-kb-meta.json', JSON.stringify({schemaVersion:'1.0.0', managedFiles:Object.fromEntries(files.map(file => [file,{sourceIds:file.includes('/2-')?['IPD-2']:file.includes('/5-')?['IPD-5']:['IPD-1']}]))}));
  write(root, '.source/managed-manifest.json', JSON.stringify({schemaVersion:'1.0.0',files:files.map(file => ({path:file,sourceIds:file.includes('/2-')?['IPD-2']:file.includes('/5-')?['IPD-5']:['IPD-1']}))}));
  return root;
}

test('validator accepts complete knowledge base', () => {
  const root = completeKb();
  const report = validateKnowledgeBase(root);
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.stats.features, 2);
  assert.ok(fs.existsSync(path.join(root, '.source/validation-report.json')));
});

test('validator detects missing feature source placeholder and broken README link', () => {
  const root = completeKb();
  fs.rmSync(path.join(root, '03-功能规划/5-F.md'));
  fs.appendFileSync(path.join(root, 'README.md'), '\n{{占位符}}\n[bad](missing.md)\n');
  fs.writeFileSync(path.join(root, '03-功能规划/2-F.md'), '# no source');
  const report = validateKnowledgeBase(root);
  const codes = report.errors.map(item => item.code);
  assert.ok(codes.includes('MISSING_FEATURE_DOCUMENT'));
  assert.ok(codes.includes('MISSING_IPD_SOURCE'));
  assert.ok(codes.includes('TEMPLATE_PLACEHOLDER'));
  assert.ok(codes.includes('BROKEN_README_LINK'));
});

test('validator reports invalid JSON without crashing', () => {
  const root = completeKb();
  fs.writeFileSync(path.join(root, '.product-kb-meta.json'), '{bad');
  const report = validateKnowledgeBase(root);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some(item => item.code === 'INVALID_JSON'));
});
