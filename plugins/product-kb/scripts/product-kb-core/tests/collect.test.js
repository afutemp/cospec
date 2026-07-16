'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  htmlToMarkdown,
  normalizeIssue,
  buildIssueTree,
  fingerprint,
  parseArgs,
  collectSnapshot,
  collectAttachment,
  parseAttachmentContent,
  parseAttachmentFile,
  writeSnapshot,
} = require('../scripts/collect');
const { createIpdAdapter } = require('../adapters/ipd');

const fixture = require('./fixtures/ipd-fixture.json');

const temporaryDirectories = [];
function makeTemporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

test.afterEach(() => {
  while (temporaryDirectories.length) fs.rmSync(temporaryDirectories.pop(), {recursive: true, force: true});
});

test('htmlToMarkdown preserves semantic blocks and removes scripts', () => {
  const value = htmlToMarkdown('<h2>标题</h2><p>正文<br>第二行</p><ul><li>一</li><li>二</li></ul><table><tr><td>A</td><td>B</td></tr></table><script>bad()</script>');
  assert.match(value, /## 标题/);
  assert.match(value, /正文\n第二行/);
  assert.match(value, /- 一/);
  assert.match(value, /A \| B/);
  assert.doesNotMatch(value, /bad/);
});

test('normalizeIssue preserves source fields and string IDs', () => {
  const issue = normalizeIssue(fixture.issues[1]);
  assert.equal(issue.id, '2');
  assert.equal(issue.parentId, '1');
  assert.equal(issue.category, 'feature');
  assert.equal(issue.product.name, '千流');
  assert.equal(issue.customFields.priority, '高');
  assert.match(issue.descMarkdown, /生成/);
});

test('normalizeIssue supports real IPD parentId and preserves product ID when name is absent', () => {
  const issue = normalizeIssue({id: 8, parentId: 7, name: '真实形态', product: {id: 2720}, issue_category: {key: 'story'}});
  assert.equal(issue.parentId, '7');
  assert.equal(issue.product.id, '2720');
  assert.equal(issue.product.name, '');
});

test('buildIssueTree deduplicates and reports orphan and unknown nodes', () => {
  const issues = fixture.issues.map(normalizeIssue);
  issues.push({...issues[1]});
  issues.push(normalizeIssue({id: 9, parent_id: 999, name: '孤立', issue_category: {key: 'story'}}));
  issues.push(normalizeIssue({id: 10, name: '任务', issue_category: {key: 'task'}}));
  const result = buildIssueTree(issues);
  assert.equal(result.issues.length, 6);
  assert.equal(result.tree[0].children[0].children[0].children[0].id, '4');
  assert.ok(result.warnings.some(item => item.code === 'ORPHAN_PARENT' && item.sourceId === '9'));
  assert.ok(result.warnings.some(item => item.code === 'UNKNOWN_CATEGORY' && item.sourceId === '10'));
});

test('fingerprint is stable across key order and ignores collectedAt when omitted', () => {
  const left = fingerprint({b: 2, a: 1});
  const right = fingerprint({a: 1, b: 2});
  assert.equal(left, right);
  assert.notEqual(left, fingerprint({a: 2, b: 2}));
});

test('parseArgs validates modes and repeated roots', () => {
  assert.throws(() => parseArgs([]), /项目范围或根需求/);
  assert.throws(() => parseArgs(['--project-id', '1', '--root-issue-id', '2']), /不能同时/);
  const parsed = parseArgs(['--root-issue-id', '2', '--root-issue-id', '3', '--output', './out']);
  assert.deepEqual(parsed.rootIssueIds, ['2', '3']);
  assert.equal(parsed.mode, 'root');
});

test('collectSnapshot captures warnings without failing the run', async () => {
  const adapter = {
    adapterId: 'fixture', adapterVersion: '1',
    async describeSource() { return {product: {id: '9', name: '千流'}}; },
    async listIssues() { return {items: fixture.issues, total: fixture.issues.length}; },
    async getIssue(id) { if (String(id) === '3') throw new Error('detail unavailable'); return fixture.issues.find(item => String(item.id) === String(id)); },
    async listComments(id) { return fixture.comments[String(id)] || []; },
    async listAttachments(id) { return fixture.attachments[String(id)] || []; },
    async collectLifecycle() { return {stages: []}; },
  };
  const snapshot = await collectSnapshot(adapter, {mode: 'scope', projectId: '1', attachments: false});
  assert.equal(snapshot.stats.total, 4);
  assert.ok(snapshot.warnings.some(item => item.code === 'ISSUE_DETAIL_FAILED' && item.sourceId === '3'));
  assert.equal(snapshot.comments['2'][0].content, '需要可追溯');
  assert.doesNotMatch(JSON.stringify(snapshot), /token/i);
});

test('parseAttachmentContent extracts UTF-8 text and records a content fingerprint', () => {
  const parsed = parseAttachmentContent({fileName: '产品说明.txt', fileType: 'text/plain'}, Buffer.from('关键规划证据', 'utf8'));
  assert.equal(parsed.status, 'parsed');
  assert.equal(parsed.parser, 'text');
  assert.equal(parsed.content, '关键规划证据');
  assert.match(parsed.contentFingerprint, /^sha256:/);
});

test('parseAttachmentFile uses an injected document parser for PDF content', async () => {
  const dir = makeTemporaryDirectory('product-kb-pdf-');
  const filePath = path.join(dir, '方案.pdf');
  fs.writeFileSync(filePath, Buffer.from('%PDF-1.7 fixture'));
  const calls = [];
  const parsed = await parseAttachmentFile({fileName: '方案.pdf', fileType: 'application/pdf'}, filePath, {
    runDocumentParser(input) {
      calls.push(input);
      return {parser: 'pdf', content: 'PDF 中的产品方案'};
    },
  });
  assert.equal(calls[0].filePath, filePath);
  assert.equal(parsed.status, 'parsed');
  assert.equal(parsed.parser, 'pdf');
  assert.equal(parsed.content, 'PDF 中的产品方案');
});
test('collectAttachment downloads an attachment into the source directory and preserves provenance', async () => {
  const dir = makeTemporaryDirectory('product-kb-attachment-');
  const calls = [];
  const adapter = {
    async downloadAttachment(attachmentId, destination) {
      calls.push({attachmentId, destination});
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.writeFileSync(destination, '附件中的产品目标', 'utf8');
      return {destPath: destination, fileName: '目标.md', fileSize: Buffer.byteLength('附件中的产品目标')};
    },
  };
  const result = await collectAttachment(adapter, '2', {id: 20, fileName: '目标.md', fileType: 'text/markdown'}, {attachmentDir: dir});
  assert.equal(calls[0].attachmentId, '20');
  assert.equal(result.status, 'parsed');
  assert.equal(result.content, '附件中的产品目标');
  assert.equal(result.issueId, '2');
  assert.equal(result.id, '20');
  assert.match(result.localPath, /^2\/20\//);
  assert.ok(fs.existsSync(path.join(dir, ...result.localPath.split('/'))));
});

test('collectAttachment rejects adapter paths outside the attachment directory', async () => {
  const dir = makeTemporaryDirectory('product-kb-path-');
  const outside = path.join(os.tmpdir(), 'product-kb-outside-secret.txt');
  fs.writeFileSync(outside, 'secret', 'utf8');
  const adapter = {async downloadAttachment() { return {destPath: outside, fileName: 'secret.txt', fileSize: 6}; }};
  await assert.rejects(() => collectAttachment(adapter, '2', {id: 40, fileName: 'safe.txt', fileType: 'text/plain'}, {attachmentDir: dir}), /下载结果路径与目标路径不一致/);
  fs.rmSync(outside, {force: true});
});

test('collectAttachment forwards the byte limit to the adapter', async () => {
  const dir = makeTemporaryDirectory('product-kb-limit-');
  const calls = [];
  const adapter = {async downloadAttachment(attachmentId, destination, options) {
    calls.push(options);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, 'ok', 'utf8');
    return {destPath: destination, fileName: 'safe.txt', fileSize: 2};
  }};
  await collectAttachment(adapter, '2', {id: 41, fileName: 'safe.txt', fileType: 'text/plain'}, {attachmentDir: dir, maxAttachmentBytes: 1024});
  assert.equal(calls[0].maxBytes, 1024);
});

test('parseAttachmentFile recognizes PDF by MIME type when the filename has no extension', async () => {
  const dir = makeTemporaryDirectory('product-kb-pdf-mime-');
  const filePath = path.join(dir, 'attachment');
  fs.writeFileSync(filePath, Buffer.from('%PDF-1.7 fixture'));
  const parsed = await parseAttachmentFile({fileName: 'attachment', fileType: 'application/pdf'}, filePath, {async runDocumentParser() { return {parser: 'pdf', content: '按 MIME 解析'}; }});
  assert.equal(parsed.parser, 'pdf');
  assert.equal(parsed.content, '按 MIME 解析');
});

test('collectAttachment reports parser failures without rejecting the snapshot', async () => {
  const dir = makeTemporaryDirectory('product-kb-parse-failed-');
  const adapter = {async downloadAttachment(attachmentId, destination) {
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, Buffer.from('%PDF-1.7 fixture'));
    return {destPath: destination, fileName: 'bad.pdf', fileSize: 16};
  }};
  const result = await collectAttachment(adapter, '2', {id: 42, fileName: 'bad.pdf', fileType: 'application/pdf'}, {attachmentDir: dir, async runDocumentParser() { throw new Error('parser unavailable'); }});
  assert.equal(result.status, 'parse_failed');
  assert.equal(result.warning.code, 'ATTACHMENT_PARSE_FAILED');
});
test('collectAttachment rejects empty downloads with a structured warning result', async () => {
  const dir = makeTemporaryDirectory('product-kb-empty-');
  const adapter = {
    async downloadAttachment(attachmentId, destination) {
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.writeFileSync(destination, Buffer.alloc(0));
      return {destPath: destination, fileName: '空文件.txt', fileSize: 0};
    },
  };
  const result = await collectAttachment(adapter, '2', {id: 21, fileName: '空文件.txt', fileType: 'text/plain'}, {attachmentDir: dir});
  assert.equal(result.status, 'empty');
  assert.equal(result.content, '');
  assert.equal(result.warning.code, 'ATTACHMENT_EMPTY');
});

test('collectAttachment keeps unsupported binaries and reports that content was not parsed', async () => {
  const dir = makeTemporaryDirectory('product-kb-unsupported-');
  const adapter = {
    async downloadAttachment(attachmentId, destination) {
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.writeFileSync(destination, Buffer.from([0, 1, 2, 3]));
      return {destPath: destination, fileName: 'diagram.bin', fileSize: 4};
    },
  };
  const result = await collectAttachment(adapter, '2', {id: 22, fileName: 'diagram.bin', fileType: 'application/octet-stream'}, {attachmentDir: dir});
  assert.equal(result.status, 'unsupported');
  assert.equal(result.content, '');
  assert.equal(result.warning.code, 'ATTACHMENT_UNSUPPORTED');
  assert.ok(fs.existsSync(path.join(dir, ...result.localPath.split('/'))));
});

test('collectSnapshot includes parsed attachment evidence and download warnings', async () => {
  const dir = makeTemporaryDirectory('product-kb-snapshot-attachment-');
  const adapter = {
    adapterId: 'fixture', adapterVersion: '1',
    async describeSource() { return {}; },
    async listIssues() { return {items: fixture.issues.slice(0, 2), total: 2}; },
    async getIssue(id) { return fixture.issues.find(item => String(item.id) === String(id)); },
    async listComments() { return []; },
    async listAttachments(id) {
      if (String(id) === '1') return [{id: 30, fileName: '规划.txt', fileType: 'text/plain'}];
      return [{id: 31, fileName: '失败.txt', fileType: 'text/plain'}];
    },
    async downloadAttachment(attachmentId, destination) {
      if (String(attachmentId) === '31') throw new Error('download unavailable');
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.writeFileSync(destination, '来自附件的路线图', 'utf8');
      return {destPath: destination, fileName: '规划.txt', fileSize: Buffer.byteLength('来自附件的路线图')};
    },
    async collectLifecycle() { return {}; },
  };
  const snapshot = await collectSnapshot(adapter, {mode: 'scope', projectId: '1', attachmentDir: dir});
  assert.equal(snapshot.attachments['1'][0].content, '来自附件的路线图');
  assert.equal(snapshot.attachments['1'][0].status, 'parsed');
  assert.ok(snapshot.warnings.some(item => item.code === 'ATTACHMENT_DOWNLOAD_FAILED' && item.sourceId === '2' && item.attachmentId === '31'));
  assert.equal(snapshot.stats.attachments, 2);
  assert.equal(snapshot.stats.parsedAttachments, 1);
});
test('writeSnapshot writes parseable snapshot and summary', () => {
  const dir = makeTemporaryDirectory('product-kb-');
  const snapshot = {schemaVersion: '1.0.0', collectedAt: new Date(0).toISOString(), source: {}, issues: [], tree: [], comments: {}, attachments: {}, lifecycle: {}, warnings: [], stats: {total: 0}, fingerprint: 'sha256:x'};
  const result = writeSnapshot(dir, snapshot);
  assert.equal(JSON.parse(fs.readFileSync(result.snapshotPath, 'utf8')).stats.total, 0);
  assert.match(fs.readFileSync(result.summaryPath, 'utf8'), /Issue 总数: 0/);
});

test('IPD adapter uses injected API and collects lifecycle', async () => {
  const calls = [];
  const downloadCalls = [];
  const api = {
    async getIssuesByScope({page}) { calls.push(`page:${page}`); return page === 1 ? {total: 2, list: fixture.issues.slice(0, 1)} : {total: 2, list: fixture.issues.slice(1, 2)}; },
    async getIssue(id) { return {data: fixture.issues.find(item => String(item.id) === String(id))}; },
    async getSubIssues() { return []; }, async getComments() { return {list: []}; }, async getIssueAttachments() { return []; },
    async downloadAttachment(attachmentId, destination) { downloadCalls.push({attachmentId, destination}); return {destPath: destination, fileName: 'file.txt', fileSize: 3}; },
    async getProjectStages() { return [{id: 100, name: '计划'}]; },
    async getStageActivities() { return [{id: 200, name: '设计'}]; }, async getStageReviewActivities() { return []; },
    async getActivityDetail() { return {owner: 'PM'}; }, async getActivityQualityStandards() { return [{id: 300}]; },
    async getActivityDeliverables() { return [{id: 400}]; }, async getActivityDependencies() { return []; }, async getActivityReviewRecords() { return {}; },
    async getProjectVersions() { return []; }, async getTeamsByProject() { return []; }, async getSprints() { return []; },
  };
  const adapter = createIpdAdapter({api});
  const first = await adapter.listIssues({projectId: '1', page: 1, per: 1});
  assert.equal(first.items.length, 1);
  const lifecycle = await adapter.collectLifecycle({projectId: '1', versionId: '2'});
  assert.equal(lifecycle.activities[0].qualityStandards[0].id, 300);
  const result = await adapter.downloadAttachment('20', '/tmp/file.txt');
  assert.equal(result.fileSize, 3);
  assert.equal(downloadCalls[0].attachmentId, '20');
  assert.deepEqual(calls, ['page:1']);
});
