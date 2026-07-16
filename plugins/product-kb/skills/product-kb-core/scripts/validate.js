'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_FILES = [
  'README.md', '00-综述/01-产品战略与价值.md', '00-综述/02-版本演进与里程碑.md',
  '01-用户与机会/01-目标客户与角色.md', '01-用户与机会/02-客户问题与JTBD.md',
  '01-用户与机会/03-用户旅程与机会地图.md', '02-规划与范围/01-需求池与优先级.md',
  '02-规划与范围/02-版本范围与路线图.md', '04-质量与约束/01-非功能需求与合规.md',
  '05-协作与依赖/01-依赖风险与协作.md', '06-验证与反馈/01-指标实验与反馈.md',
  '附录/01-原型与资料索引.md',
];
const REQUIRED_FRONTMATTER = ['name','description','source','product','version','scope','status','owner','updated'];

function finding(code, file, message, severity = 'error') { return {code, file, message, severity}; }

function readJsonSafe(root, relative, errors) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
  catch (error) { errors.push(finding('INVALID_JSON', relative, error.message)); return null; }
}

function markdownFiles(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name === '.source') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  walk(root);
  return files.sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return Object.fromEntries(match[1].split(/\r?\n/).filter(line => line.includes(':')).map(line => {
    const index = line.indexOf(':'); return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
}

function validateLinks(root, file, content, errors) {
  if (file !== 'README.md') return;
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content))) {
    if (/^(https?:|#)/.test(match[1])) continue;
    const target = path.resolve(path.dirname(path.join(root, file)), decodeURI(match[1].split('#')[0]));
    if (!fs.existsSync(target)) errors.push(finding('BROKEN_README_LINK', file, `链接不存在: ${match[1]}`));
  }
}

function validateMarkdown(root, file, errors) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\{\{[^}]+\}\}/.test(content)) errors.push(finding('TEMPLATE_PLACEHOLDER', file, '存在模板占位符'));
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) errors.push(finding('MISSING_FRONTMATTER', file, '缺少 YAML frontmatter'));
  else for (const field of REQUIRED_FRONTMATTER) if (!frontmatter[field]) errors.push(finding('MISSING_FRONTMATTER_FIELD', file, `缺少字段: ${field}`));
  validateLinks(root, file, content, errors);
  return content;
}

function validateKnowledgeBase(root, {output} = {}) {
  const errors = [];
  const warnings = [];
  for (const file of REQUIRED_FILES) if (!fs.existsSync(path.join(root, file))) errors.push(finding('MISSING_REQUIRED_FILE', file, '缺少必需文档'));
  const snapshot = readJsonSafe(root, '.source/source-snapshot.json', errors);
  readJsonSafe(root, '.product-kb-meta.json', errors);
  readJsonSafe(root, '.source/managed-manifest.json', errors);
  const markdown = markdownFiles(root);
  const contents = new Map(markdown.map(file => [file, validateMarkdown(root, file, errors)]));
  const features = (snapshot?.issues || []).filter(issue => issue.category === 'feature');
  for (const feature of features) {
    const matching = markdown.filter(file => file.startsWith('03-功能规划/') && (contents.get(file).includes(`IPD-${feature.id}`)));
    if (!matching.length) errors.push(finding('MISSING_FEATURE_DOCUMENT', '03-功能规划', `缺少 Feature IPD-${feature.id} 文档`));
  }
  for (const file of markdown.filter(item => item.startsWith('03-功能规划/'))) {
    const content = contents.get(file);
    if (!/IPD-\d+/.test(content) || !/https?:\/\//.test(content)) errors.push(finding('MISSING_IPD_SOURCE', file, 'Feature 文档缺少 IPD ID 或 URL'));
  }
  const report = {schemaVersion: '1.0.0', valid: errors.length === 0, errors: errors.sort((a,b) => a.code.localeCompare(b.code) || a.file.localeCompare(b.file)), warnings, stats: {files: markdown.length, features: features.length}};
  const reportPath = output || path.join(root, '.source', 'validation-report.json');
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function main(argv = process.argv.slice(2)) {
  const root = argv[0];
  if (!root) throw new Error('用法: validate.js <knowledge-base-root>');
  const report = validateKnowledgeBase(path.resolve(root));
  process.stdout.write(`${JSON.stringify({valid: report.valid, errors: report.errors.length, warnings: report.warnings.length})}\n`);
  if (!report.valid) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`校验产品知识库失败: ${error.message}`); process.exitCode = 1; }
}

module.exports = {REQUIRED_FILES, parseFrontmatter, validateKnowledgeBase, main};
