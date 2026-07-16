'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = '1.1.0';
const KNOWN_CATEGORIES = new Set(['epic', 'feature', 'story', 'tech']);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.html', '.htm', '.xml', '.yaml', '.yml', '.log']);
const DOCUMENT_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.pptx']);

function safePathSegment(value, fallback) {
  const segment = String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+$/, '_').trim();
  return segment || fallback;
}

function attachmentWarning(code, issueId, attachmentId, message) {
  return {code, operation: 'collectAttachment', sourceId: String(issueId), attachmentId: String(attachmentId), message};
}

function decodeTextBuffer(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return new TextDecoder('utf-16le').decode(swapped);
  }
  const utf8 = new TextDecoder('utf-8', {fatal: false}).decode(buffer);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('gb18030', {fatal: false}).decode(buffer);
}

function parseAttachmentContent(metadata = {}, buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('attachment buffer must be a Buffer');
  if (!buffer.length) return {status: 'empty', parser: null, content: '', contentFingerprint: fingerprint('')};
  const extension = path.extname(metadata.fileName || '').toLowerCase();
  const fileType = String(metadata.fileType || '').toLowerCase();
  const isText = fileType.startsWith('text/') || TEXT_ATTACHMENT_EXTENSIONS.has(extension);
  if (!isText) return {status: 'unsupported', parser: null, content: '', contentFingerprint: null};
  let content = decodeTextBuffer(buffer).replace(/^﻿/, '').replace(/\u0000/g, '').trim();
  if (extension === '.html' || extension === '.htm' || fileType === 'text/html') content = htmlToMarkdown(content);
  return {status: content ? 'parsed' : 'empty', parser: extension === '.html' || extension === '.htm' || fileType === 'text/html' ? 'html' : 'text', content, contentFingerprint: fingerprint(content)};
}

function runParserCommand(command, args, timeout) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, {encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout}, (error, stdout) => {
      if (error) reject(error);
      else {
        try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
      }
    });
  });
}

async function runDocumentParser({filePath, extension}) {
  const parserPath = path.join(__dirname, 'parse_attachment.py');
  const parserArgs = [parserPath, filePath, extension];
  const commands = process.platform === 'win32' ? [['py', ['-3', ...parserArgs]], ['python', parserArgs]] : [['python3', parserArgs], ['python', parserArgs]];
  let lastError;
  for (const [command, args] of commands) {
    try { return await runParserCommand(command, args, 30_000); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('未找到可用的 Python 文档解析器');
}

function documentExtension(metadata, filePath) {
  const byName = path.extname(metadata.fileName || filePath).toLowerCase();
  if (DOCUMENT_ATTACHMENT_EXTENSIONS.has(byName)) return byName;
  const byMime = {'application/pdf': '.pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'};
  return byMime[String(metadata.fileType || '').toLowerCase()] || byName;
}

function hasExpectedSignature(extension, buffer) {
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (['.docx', '.xlsx', '.pptx'].includes(extension)) return buffer[0] === 0x50 && buffer[1] === 0x4b;
  return true;
}

async function parseAttachmentFile(metadata, filePath, options = {}) {
  const buffer = fs.readFileSync(filePath);
  const extension = documentExtension(metadata, filePath);
  if (!DOCUMENT_ATTACHMENT_EXTENSIONS.has(extension)) return parseAttachmentContent(metadata, buffer);
  if (!hasExpectedSignature(extension, buffer)) throw new Error(`附件内容与声明格式不一致: ${extension}`);
  const documentParser = options.runDocumentParser || runDocumentParser;
  const parsed = await documentParser({filePath, metadata, extension});
  const content = String(parsed.content || '').trim();
  return {status: content ? 'parsed' : 'empty', parser: parsed.parser || extension.slice(1), content, contentFingerprint: fingerprint(content)};
}

async function collectAttachment(adapter, issueId, metadata = {}, options = {}) {
  if (!metadata.id) throw new Error('附件缺少 ID');
  if (!options.attachmentDir) throw new Error('附件采集缺少 attachmentDir');
  if (typeof adapter.downloadAttachment !== 'function') throw new Error('Source Adapter 未实现 downloadAttachment');
  const attachmentId = String(metadata.id);
  const safeAttachmentId = safePathSegment(attachmentId, 'unknown-attachment');
  const fileName = safePathSegment(metadata.fileName, `attachment-${safeAttachmentId}`);
  const relativePath = [safePathSegment(issueId, 'unknown-issue'), safeAttachmentId, fileName].join('/');
  const attachmentRoot = path.resolve(options.attachmentDir);
  const destination = path.resolve(attachmentRoot, ...relativePath.split('/'));
  if (destination !== attachmentRoot && !destination.startsWith(`${attachmentRoot}${path.sep}`)) throw new Error('附件目标路径越界');
  const maxBytes = options.maxAttachmentBytes || MAX_ATTACHMENT_BYTES;
  const download = await adapter.downloadAttachment(attachmentId, destination, {maxBytes});
  const returnedPath = path.resolve(download?.destPath || destination);
  if (returnedPath !== destination) throw new Error('附件下载结果路径与目标路径不一致');
  const localFile = destination;
  const stat = fs.statSync(localFile);
  const result = {
    ...metadata,
    id: attachmentId,
    issueId: String(issueId),
    fileName: metadata.fileName || download?.fileName || fileName,
    localPath: relativePath,
    size: stat.size,
    fileFingerprint: fileFingerprint(localFile),
  };
  if (!stat.size) {
    return {...result, status: 'empty', parser: null, content: '', contentFingerprint: fingerprint(''), warning: attachmentWarning('ATTACHMENT_EMPTY', issueId, attachmentId, '附件为空，未提取到内容')};
  }
  if (stat.size > maxBytes) {
    return {...result, status: 'too_large', parser: null, content: '', contentFingerprint: null, warning: attachmentWarning('ATTACHMENT_TOO_LARGE', issueId, attachmentId, `附件大小 ${stat.size} 超过解析上限 ${maxBytes}`)};
  }
  let parsed;
  try {
    parsed = await parseAttachmentFile(result, localFile, options);
  } catch (error) {
    return {...result, status: 'parse_failed', parser: null, content: '', contentFingerprint: null, warning: attachmentWarning('ATTACHMENT_PARSE_FAILED', issueId, attachmentId, error.message)};
  }
  if (parsed.status === 'unsupported') {
    return {...result, ...parsed, warning: attachmentWarning('ATTACHMENT_UNSUPPORTED', issueId, attachmentId, `暂不支持解析附件格式: ${result.fileType || path.extname(result.fileName) || 'unknown'}`)};
  }
  if (parsed.status === 'empty') {
    return {...result, ...parsed, warning: attachmentWarning('ATTACHMENT_EMPTY', issueId, attachmentId, '附件正文为空，未提取到内容')};
  }
  return {...result, ...parsed};
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

function fingerprint(value) {
  const content = JSON.stringify(canonicalize(value));
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function fileFingerprint(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function decodeEntities(value) {
  const entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, key) => {
    if (key[0] === '#') {
      const hex = key[1].toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return entities[key.toLowerCase()] ?? match;
  });
}

function htmlToMarkdown(html = '') {
  let value = String(html);
  value = value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  value = value.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n${'#'.repeat(Number(level))} ${text}\n`);
  value = value.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  value = value.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  value = value.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => `\n${row.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, '$1 | ')}`);
  value = value.replace(/<br\s*\/?>/gi, '\n');
  value = value.replace(/<\/(p|div|ul|ol|table)>/gi, '\n');
  value = value.replace(/<[^>]+>/g, '');
  return decodeEntities(value)
    .split('\n').map(line => line.trim().replace(/\s+\|\s*$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function sourceObject(value) {
  if (!value) return {};
  return {id: value.id == null ? '' : String(value.id), name: value.name || ''};
}

function normalizeIssue(raw = {}, context = {}) {
  const data = raw.data || raw;
  const id = String(data.id ?? context.id ?? '');
  const parentId = data.parent_id ?? data.parentId ?? data.parent?.id ?? data.parent_story?.id ?? context.parentId ?? null;
  const issue = {
    id,
    category: data.issue_category?.key || data.issueCategory || context.category || '',
    parentId: parentId == null ? null : String(parentId),
    name: data.name || '（未设置）',
    descHtml: data.desc || '',
    descMarkdown: htmlToMarkdown(data.desc || ''),
    status: data.status?.name || data.status || '（未知）',
    statusKey: data.status?.key || '',
    priority: data.custom_fields?.priority || data.priority || '（未知）',
    assignee: data.assigner?.display_name || data.assignee || '（未分配）',
    product: sourceObject(data.product),
    project: sourceObject(data.ipd_project || data.project),
    version: sourceObject(data.plan_version_v2 || data.versionPlan),
    team: sourceObject(data.version || data.team),
    sprint: sourceObject(data.sprint),
    createdAt: data.create_at || data.createdAt || '',
    updatedAt: data.update_at || data.updatedAt || '',
    plannedStartAt: data.plan_start_at || '',
    plannedEndAt: data.plan_end_at || '',
    effort: data.effort_estimation ?? data.custom_fields?.estimated_day ?? null,
    url: data.url || context.url || '',
    customFields: data.custom_fields || {},
    sourceExtensions: context.sourceExtensions || {},
  };
  issue.fingerprint = fingerprint({...issue, fingerprint: undefined});
  return issue;
}

function buildIssueTree(input) {
  const map = new Map();
  for (const issue of input) if (issue.id && !map.has(issue.id)) map.set(issue.id, {...issue, children: []});
  const warnings = [];
  const roots = [];
  for (const issue of map.values()) {
    if (!KNOWN_CATEGORIES.has(issue.category)) warnings.push({code: 'UNKNOWN_CATEGORY', sourceId: issue.id, message: `未知需求层级: ${issue.category || 'empty'}`});
    const parent = issue.parentId ? map.get(issue.parentId) : null;
    if (issue.parentId && !parent) warnings.push({code: 'ORPHAN_PARENT', sourceId: issue.id, parentId: issue.parentId, message: '父节点不在采集范围'});
    if (parent) parent.children.push(issue); else roots.push(issue);
  }
  const sorter = (a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id, undefined, {numeric: true});
  const sortTree = nodes => nodes.sort(sorter).forEach(node => sortTree(node.children));
  sortTree(roots);
  return {issues: [...map.values()].map(({children, ...issue}) => issue).sort(sorter), tree: roots, warnings};
}

function takeValue(argv, index, name) {
  if (index + 1 >= argv.length) throw new Error(`参数 ${name} 缺少值`);
  return argv[index + 1];
}

function parseArgs(argv) {
  const options = {rootIssueIds: [], comments: true, attachments: true, concurrency: 10, adapter: 'ipd'};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-comments') options.comments = false;
    else if (arg === '--no-attachments') options.attachments = false;
    else if (arg === '--project-id') options.projectId = takeValue(argv, i++, arg);
    else if (arg === '--version-id') options.versionId = takeValue(argv, i++, arg);
    else if (arg === '--team-id') options.teamId = takeValue(argv, i++, arg);
    else if (arg === '--sprint-id') options.sprintId = takeValue(argv, i++, arg);
    else if (arg === '--root-issue-id') options.rootIssueIds.push(takeValue(argv, i++, arg));
    else if (arg === '--output') options.output = takeValue(argv, i++, arg);
    else if (arg === '--adapter') options.adapter = takeValue(argv, i++, arg);
    else if (arg === '--concurrency') options.concurrency = Number(takeValue(argv, i++, arg));
    else throw new Error(`未知参数: ${arg}`);
  }
  if (options.projectId && options.rootIssueIds.length) throw new Error('项目范围和根需求模式不能同时使用');
  if (!options.projectId && !options.rootIssueIds.length) throw new Error('必须提供项目范围或根需求');
  if (options.sprintId && !options.teamId) throw new Error('迭代范围必须同时提供 team-id');
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 20) throw new Error('concurrency 必须在 1-20');
  options.mode = options.rootIssueIds.length ? 'root' : 'scope';
  return options;
}

function warning(code, operation, sourceId, error) {
  return {code, operation, sourceId: String(sourceId), message: error instanceof Error ? error.message : String(error)};
}

async function collectRootSummaries(adapter, rootIssueIds) {
  const found = new Map();
  const queue = rootIssueIds.map(id => ({id: String(id), parentId: null}));
  while (queue.length) {
    const current = queue.shift();
    if (found.has(current.id)) continue;
    found.set(current.id, current);
    const children = await adapter.listChildren(current.id, current);
    for (const child of children || []) queue.push({...child, id: String(child.id), parentId: current.id});
  }
  return [...found.values()];
}

async function collectScopeSummaries(adapter, options) {
  const all = [];
  let page = 1;
  while (true) {
    const result = await adapter.listIssues({...options, page});
    all.push(...(result.items || []));
    if (!result.nextCursor && all.length >= (result.total || all.length)) break;
    if (!result.items?.length) break;
    page = result.nextCursor || page + 1;
  }
  return all;
}

async function collectSnapshot(adapter, options) {
  const source = await adapter.describeSource(options);
  const summaries = options.mode === 'root'
    ? await collectRootSummaries(adapter, options.rootIssueIds)
    : await collectScopeSummaries(adapter, options);
  const byId = new Map(summaries.map(item => [String(item.id), item]));
  const issues = [];
  const comments = {};
  const attachments = {};
  const warnings = [];
  const entries = [...byId.values()];
  for (let start = 0; start < entries.length; start += options.concurrency || 10) {
    const batch = entries.slice(start, start + (options.concurrency || 10));
    await Promise.all(batch.map(async summary => {
      const id = String(summary.id);
      let raw = summary;
      try { raw = await adapter.getIssue(id, summary); } catch (error) { warnings.push(warning('ISSUE_DETAIL_FAILED', 'getIssue', id, error)); }
      issues.push(normalizeIssue(raw, {id, parentId: summary.parentId, url: summary.url}));
      if (options.comments !== false) {
        try { comments[id] = await adapter.listComments(id, summary); } catch (error) { comments[id] = []; warnings.push(warning('COMMENTS_FAILED', 'listComments', id, error)); }
      }
      if (options.attachments !== false) {
        try {
          const metadataItems = await adapter.listAttachments(id, summary);
          attachments[id] = [];
          for (const metadata of metadataItems || []) {
            try {
              const collected = await collectAttachment(adapter, id, metadata, options);
              attachments[id].push(collected);
              if (collected.warning) warnings.push(collected.warning);
            } catch (error) {
              const attachmentId = String(metadata?.id || 'unknown');
              attachments[id].push({...metadata, id: attachmentId, issueId: id, status: 'download_failed', parser: null, content: '', contentFingerprint: null});
              warnings.push({...warning('ATTACHMENT_DOWNLOAD_FAILED', 'downloadAttachment', id, error), attachmentId});
            }
          }
        } catch (error) {
          attachments[id] = [];
          warnings.push(warning('ATTACHMENTS_FAILED', 'listAttachments', id, error));
        }
      }
    }));
  }
  const built = buildIssueTree(issues);
  warnings.push(...built.warnings);
  let lifecycle = {};
  try { lifecycle = await adapter.collectLifecycle(options); } catch (error) { warnings.push(warning('LIFECYCLE_FAILED', 'collectLifecycle', options.projectId || 'scope', error)); }
  const categoryCounts = built.issues.reduce((counts, item) => ({...counts, [item.category || 'unknown']: (counts[item.category || 'unknown'] || 0) + 1}), {});
  const attachmentItems = Object.values(attachments).flat();
  const snapshot = {schemaVersion: SCHEMA_VERSION, adapter: {id: adapter.adapterId, version: adapter.adapterVersion}, collectedAt: new Date().toISOString(), source, issues: built.issues, tree: built.tree, comments, attachments, lifecycle, warnings, stats: {total: built.issues.length, ...categoryCounts, attachments: attachmentItems.length, parsedAttachments: attachmentItems.filter(item => item.status === 'parsed').length}};
  snapshot.fingerprint = fingerprint({...snapshot, collectedAt: undefined, fingerprint: undefined});
  return snapshot;
}

function writeSnapshot(outputDir, snapshot) {
  fs.mkdirSync(outputDir, {recursive: true});
  const snapshotPath = path.join(outputDir, 'source-snapshot.json');
  const summaryPath = path.join(outputDir, 'source-summary.md');
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const summary = [`# IPD 来源摘要`, '', `- 采集时间: ${snapshot.collectedAt}`, `- Issue 总数: ${snapshot.stats.total}`, `- 附件总数: ${snapshot.stats.attachments || 0}`, `- 已解析附件: ${snapshot.stats.parsedAttachments || 0}`, `- Warning 数: ${snapshot.warnings.length}`, '', '## 类型统计', ...Object.entries(snapshot.stats).filter(([key]) => !['total', 'attachments', 'parsedAttachments'].includes(key)).map(([key, value]) => `- ${key}: ${value}`), ''].join('\n');
  fs.writeFileSync(summaryPath, summary);
  return {snapshotPath, summaryPath};
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.output) throw new Error('必须提供 --output');
  options.attachmentDir = path.join(options.output, 'attachments');
  const {createIpdAdapter} = require('../adapters/ipd');
  const adapter = createIpdAdapter();
  const snapshot = await collectSnapshot(adapter, options);
  const output = writeSnapshot(options.output, snapshot);
  process.stdout.write(`${JSON.stringify({ok: true, stats: snapshot.stats, warnings: snapshot.warnings.length, output})}\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`采集 IPD 产品规划数据失败: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {SCHEMA_VERSION, canonicalize, fingerprint, htmlToMarkdown, normalizeIssue, buildIssueTree, parseArgs, parseAttachmentContent, parseAttachmentFile, collectAttachment, collectSnapshot, writeSnapshot, main};
