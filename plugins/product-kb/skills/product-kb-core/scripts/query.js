'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readJson(target) { return JSON.parse(fs.readFileSync(target, 'utf8')); }

function matches(issue, filters) {
  const fields = {product:issue.product?.name, project:issue.project?.name, version:issue.version?.name, category:issue.category, status:issue.status, priority:issue.priority, owner:issue.assignee, sprint:issue.sprint?.name, sourceId:`IPD-${issue.id}`};
  return Object.entries(filters || {}).every(([key, expected]) => {
    if (key === 'hasOpen' || key === 'hasWarning') return true;
    return String(fields[key] || '').toLowerCase().includes(String(expected).toLowerCase());
  });
}

function excerpt(content, terms) {
  const plain = content.replace(/^---[\s\S]*?---/, '').replace(/<!--[^]*?-->/g, '').replace(/\s+/g, ' ').trim();
  const term = (terms || []).find(value => plain.toLowerCase().includes(value.toLowerCase()));
  const index = term ? plain.toLowerCase().indexOf(term.toLowerCase()) : 0;
  return plain.slice(Math.max(0, index - 60), index + 180);
}

function queryKnowledgeBase(root, options = {}) {
  const meta = readJson(path.join(root, '.product-kb-meta.json'));
  const snapshot = readJson(path.join(root, '.source', 'source-snapshot.json'));
  const warnings = [];
  const snapshotAt = snapshot.collectedAt || meta.snapshot?.collectedAt || '';
  if (options.requireLatest && snapshotAt) {
    const age = (new Date(options.now || Date.now()) - new Date(snapshotAt)) / 86400000;
    if (age > (options.staleAfterDays || 7)) warnings.push({code:'SNAPSHOT_STALE', message:`快照已超过 ${options.staleAfterDays || 7} 天，请先运行 product-kb-update`});
  }
  const terms = options.terms || [];
  const items = [];
  for (const issue of snapshot.issues || []) {
    if (!matches(issue, options.filters)) continue;
    const sourceId = `IPD-${issue.id}`;
    const documentPath = Object.entries(meta.documentSources || {}).find(([, ids]) => (ids || []).includes(sourceId))?.[0] || null;
    const content = documentPath && fs.existsSync(path.join(root, documentPath)) ? fs.readFileSync(path.join(root, documentPath), 'utf8') : issue.descMarkdown || issue.name || '';
    if (terms.length && !terms.every(term => `${issue.name || ''} ${content}`.toLowerCase().includes(term.toLowerCase())) && !options.requireLatest) continue;
    items.push({title:issue.name, category:issue.category, documentPath, excerpt:excerpt(content, terms), sourceIds:[sourceId], sourceUrls:issue.url?[issue.url]:[], fields:{status:issue.status,priority:issue.priority,owner:issue.assignee,version:issue.version?.name || '',sprint:issue.sprint?.name || ''}});
  }
  items.sort((a,b) => a.title.localeCompare(b.title));
  return {schemaVersion:'1.0.0', snapshotAt, query:{filters:options.filters || {},terms}, total:Math.min(items.length, options.limit || 20), items:items.slice(0, options.limit || 20), warnings};
}

module.exports = {queryKnowledgeBase};
