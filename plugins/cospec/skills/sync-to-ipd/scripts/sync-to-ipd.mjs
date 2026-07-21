#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REVIEW_SUFFIX = '_大需求用户需求规格说明书_评审版.md';
const AI_CONTEXT_SUFFIX = '_大需求用户需求规格说明书_AI上下文版.md';
const LEGACY_REVIEW_PATTERN = /TR1.*评审版\.md$/i;
const LEGACY_AI_CONTEXT_PATTERN = /TR1.*AI上下文版\.md$/i;
const TYPE_ORDER = { epic: 0, feature: 1, story: 2, tech: 3 };
const PARENT_TYPES = {
  epic: new Set(),
  feature: new Set(['epic']),
  story: new Set(['feature', 'story']),
  tech: new Set(['feature', 'story', 'tech']),
};

export class SyncPreparationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SyncPreparationError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function posixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function tr1Kind(filePath) {
  const base = path.basename(filePath);
  if (base.endsWith(REVIEW_SUFFIX) || LEGACY_REVIEW_PATTERN.test(base)) return 'review';
  if (base.endsWith(AI_CONTEXT_SUFFIX) || LEGACY_AI_CONTEXT_PATTERN.test(base)) return 'aiContext';
  return null;
}

function tr1Format(reviewFile, aiContextFile) {
  return reviewFile.endsWith(REVIEW_SUFFIX) && aiContextFile.endsWith(AI_CONTEXT_SUFFIX)
    ? 'structured'
    : 'legacy-flat';
}

async function walkMarkdown(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '竞品资料') continue;
      const candidate = path.join(directory, entry.name);
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) await walk(candidate);
      else if (stat.isFile() && path.extname(entry.name).toLowerCase() === '.md') files.push(candidate);
    }
  }
  await walk(root);
  return files.sort();
}

function parseScalar(value) {
  const normalized = String(value || '').trim();
  if (normalized === 'null' || normalized === '~') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  if ((normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

export function parseArtifactMetadata(content) {
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  const lines = frontmatter[1].split(/\r?\n/);
  const marker = lines.findIndex((line) => /^cospec_artifact:\s*$/.test(line.trim()));
  if (marker === -1) return null;
  const result = { sourceIds: [] };
  let inSources = false;
  for (let index = marker + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    if (indent < 2) break;
    const line = raw.trim();
    if (line === 'source_ids:') {
      inSources = true;
      continue;
    }
    if (inSources && line.startsWith('- ')) {
      result.sourceIds.push(parseScalar(line.slice(2)));
      continue;
    }
    inSources = false;
    const match = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!match) continue;
    const keyMap = {
      schema_version: 'schemaVersion',
      artifact_id: 'artifactId',
      artifact_type: 'artifactType',
      parent_artifact_id: 'parentArtifactId',
      estimated_day: 'estimatedDay',
    };
    if (keyMap[match[1]]) result[keyMap[match[1]]] = parseScalar(match[2]);
  }
  return result;
}

function inferType(filePath) {
  const base = path.basename(filePath, '.md');
  const parent = path.basename(path.dirname(filePath));
  if (/^EPIC-/i.test(base) && base === parent) return 'epic';
  if (/^Feature-/i.test(base) && base === parent) return 'feature';
  if (/^Story-/i.test(base)) return 'story';
  if (/^Tech-/i.test(base)) return 'tech';
  return null;
}

function extractTitle(content, filePath, type) {
  const heading = content.match(/^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  const fallback = path.basename(filePath, '.md').replace(/^(EPIC|Feature|Story|Tech)-/i, '');
  const value = !heading || /^(EPIC|Feature|Story|Tech)$/i.test(heading) ? fallback : heading;
  return value.replace(/^(EPIC|Feature|Story|Tech)\s*[-：:]\s*/i, '').trim();
}

function idsIn(content) {
  return [...new Set(content.match(/\b(?:EPIC|FEAT|ST|TECH)-[A-Za-z0-9._-]+\b/g) || [])];
}

function legacyPrimaryId(type, sourceIds) {
  const prefix = { epic: 'EPIC-', feature: 'FEAT-', story: 'ST-', tech: 'TECH-' }[type];
  return sourceIds.find((value) => value.startsWith(prefix)) || null;
}

function nearestAncestor(items, item, type) {
  const directory = path.posix.dirname(item.relativePath);
  return items
    .filter((candidate) => candidate.type === type && directory.startsWith(`${path.posix.dirname(candidate.relativePath)}/`))
    .sort((a, b) => b.relativePath.length - a.relativePath.length)[0] || null;
}

async function readDocument(root, filePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(filePath);
  if (!isInside(resolvedRoot, resolvedFile)) {
    throw new SyncPreparationError(`Document is outside the artifact root: ${filePath}`, 'path_escape');
  }
  const stat = await lstat(resolvedFile);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new SyncPreparationError(`Document must be a regular non-symlink file: ${filePath}`, 'invalid_document');
  }
  const content = await readFile(resolvedFile, 'utf8');
  if (!content.trim()) throw new SyncPreparationError(`Document is empty: ${filePath}`, 'empty_document');
  return { content, contentHash: sha256(content), relativePath: posixRelative(resolvedRoot, resolvedFile) };
}

function sectionMatches(content, pattern) {
  return [...content.matchAll(pattern)].map((match, index, matches) => ({
    match,
    start: match.index,
    end: matches[index + 1]?.index ?? content.length,
    content: content.slice(match.index, matches[index + 1]?.index ?? content.length).trim(),
  }));
}

function frontmatterFor({ artifactId, type, parentArtifactId, sourceIds }) {
  const parent = parentArtifactId ? `  parent_artifact_id: ${parentArtifactId}\n` : '';
  const sources = [...new Set([artifactId, ...sourceIds].filter(Boolean))];
  return `---\ncospec_artifact:\n  schema_version: 1\n  artifact_id: ${artifactId}\n  artifact_type: ${type}\n${parent}  source_ids:\n${sources.map((value) => `    - ${value}`).join('\n')}\n---\n`;
}

async function writeLegacyItem(outputRoot, item, section) {
  const relativePath = `artifacts/${item.artifactId}.md`;
  const filePath = path.join(outputRoot, relativePath);
  const content = `${frontmatterFor(item)}${section.trim()}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return {
    ...item,
    relativePath,
    contentHash: sha256(content),
  };
}

async function writeLegacyTr1(outputRoot, kind, sourceDocument) {
  const relativePath = `tr1/${kind === 'review' ? 'review.md' : 'ai-context.md'}`;
  const filePath = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, sourceDocument.content, 'utf8');
  return { relativePath, contentHash: sourceDocument.contentHash };
}

function findLegacyBundle(files) {
  const byName = (pattern) => files.find((filePath) => pattern.test(path.basename(filePath)));
  return {
    epicFile: byName(/TR2[-_]?EPIC\.md$/i),
    featureFile: byName(/TR2[-_]?Feature\.md$/i),
    storyFile: byName(/TR2[-_]?Story\.md$/i),
    techFiles: files.filter((filePath) => /TR2[-_]?Tech.*\.md$/i.test(path.basename(filePath))),
  };
}

function featureParentMap(content) {
  const result = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(FEAT-[A-Za-z0-9._-]+)\s*\|\s*(EPIC-[A-Za-z0-9._-]+)\s*\|/i);
    if (match) result.set(match[1].toUpperCase(), match[2].toUpperCase());
  }
  return result;
}

async function buildLegacyItems({ sourceRoot, files, outputRoot, legacyTechId, legacyTechParentId }) {
  const bundle = findLegacyBundle(files);
  const conflicts = [];
  const items = [];
  for (const [kind, filePath] of [['epic', bundle.epicFile], ['feature', bundle.featureFile], ['story', bundle.storyFile]]) {
    if (!filePath) conflicts.push({ code: 'legacy_bundle_missing', document: kind });
  }
  if (!bundle.epicFile || !bundle.featureFile || !bundle.storyFile) return { items, conflicts };

  const epicDocument = await readDocument(sourceRoot, bundle.epicFile);
  for (const section of sectionMatches(epicDocument.content, /^##\s+(EPIC-[A-Za-z0-9._-]+)[：:]\s*(.+?)\s*$/gmi)) {
    const artifactId = section.match[1].toUpperCase();
    items.push(await writeLegacyItem(outputRoot, {
      artifactId,
      type: 'epic',
      name: section.match[2].trim(),
      parentArtifactId: null,
      sourceIds: idsIn(section.content),
    }, section.content));
  }

  const featureDocument = await readDocument(sourceRoot, bundle.featureFile);
  const parents = featureParentMap(featureDocument.content);
  for (const section of sectionMatches(featureDocument.content, /^#\s+(FEAT-[A-Za-z0-9._-]+)[：:]\s*(.+?)\s*$/gmi)) {
    const artifactId = section.match[1].toUpperCase();
    items.push(await writeLegacyItem(outputRoot, {
      artifactId,
      type: 'feature',
      name: section.match[2].trim(),
      parentArtifactId: parents.get(artifactId) || null,
      sourceIds: idsIn(section.content),
    }, section.content));
  }

  const storyDocument = await readDocument(sourceRoot, bundle.storyFile);
  const contexts = [...storyDocument.content.matchAll(/^#\s+.*?\bFeature-(\d+)\b.*$/gmi)];
  const storySections = sectionMatches(storyDocument.content, /^##\s+Story-(\d+)[：:]\s*(.+?)\s*$/gmi);
  for (const section of storySections) {
    const context = contexts.filter((candidate) => candidate.index < section.start).at(-1);
    const artifactId = `ST-${section.match[1]}`;
    const parentArtifactId = context ? `FEAT-${context[1]}` : null;
    items.push(await writeLegacyItem(outputRoot, {
      artifactId,
      type: 'story',
      name: section.match[2].trim(),
      parentArtifactId,
      sourceIds: idsIn(section.content),
    }, section.content));
  }

  if (bundle.techFiles.length !== 1 || !legacyTechId || !legacyTechParentId) {
    conflicts.push({
      code: 'legacy_tech_mapping_required',
      paths: bundle.techFiles.map((filePath) => posixRelative(sourceRoot, filePath)),
      proposedArtifactId: bundle.techFiles.length === 1 ? 'TECH-001' : null,
      candidateParentArtifactIds: items.filter((item) => item.type === 'feature' || item.type === 'story').map((item) => item.artifactId),
    });
    return { items, conflicts };
  }
  if (!/^TECH-[A-Za-z0-9._-]+$/i.test(legacyTechId)) {
    conflicts.push({ code: 'invalid_legacy_tech_id', artifactId: legacyTechId });
    return { items, conflicts };
  }
  const techDocument = await readDocument(sourceRoot, bundle.techFiles[0]);
  const heading = techDocument.content.match(/^#\s+Tech[-：:]?\s*(.+?)\s*$/mi);
  const artifactId = legacyTechId.toUpperCase();
  items.push(await writeLegacyItem(outputRoot, {
    artifactId,
    type: 'tech',
    name: heading?.[1]?.trim() || path.basename(bundle.techFiles[0], '.md'),
    parentArtifactId: legacyTechParentId.toUpperCase(),
    sourceIds: idsIn(techDocument.content),
  }, techDocument.content));
  return { items, conflicts };
}

export async function discoverArtifactSets(searchRoot) {
  const root = path.resolve(searchRoot);
  const files = await walkMarkdown(root);
  const byDirectory = new Map();
  for (const filePath of files) {
    const directory = path.dirname(filePath);
    const kind = tr1Kind(filePath);
    if (!kind) continue;
    const entry = byDirectory.get(directory) || { root: directory, reviewFiles: [], aiContextFiles: [] };
    entry[kind === 'review' ? 'reviewFiles' : 'aiContextFiles'].push(filePath);
    byDirectory.set(directory, entry);
  }
  return [...byDirectory.values()]
    .filter((entry) => entry.reviewFiles.length === 1 && entry.aiContextFiles.length === 1)
    .map((entry) => ({
      root: entry.root,
      reviewFile: entry.reviewFiles[0],
      aiContextFile: entry.aiContextFiles[0],
      format: tr1Format(entry.reviewFiles[0], entry.aiContextFiles[0]),
    }))
    .sort((a, b) => a.root.localeCompare(b.root));
}

export async function buildManifest(artifactRoot, {
  legacyOutputRoot,
  legacyTechId,
  legacyTechParentId,
} = {}) {
  const root = path.resolve(artifactRoot);
  const files = await walkMarkdown(root);
  const reviewFiles = files.filter((filePath) => tr1Kind(filePath) === 'review');
  const aiFiles = files.filter((filePath) => tr1Kind(filePath) === 'aiContext');
  if (reviewFiles.length !== 1 || aiFiles.length !== 1) {
    throw new SyncPreparationError(
      `Expected exactly one large-requirement TR1 review file and one AI context file; found ${reviewFiles.length} and ${aiFiles.length}.`,
      'incomplete_tr1_pair',
    );
  }

  const conflicts = [];
  let items = [];
  for (const filePath of files) {
    const type = inferType(filePath);
    if (!type) continue;
    const document = await readDocument(root, filePath);
    const metadata = parseArtifactMetadata(document.content);
    const sourceIds = metadata?.sourceIds?.length ? metadata.sourceIds : idsIn(document.content);
    const artifactId = metadata?.artifactId || legacyPrimaryId(type, sourceIds);
    const item = {
      artifactId: artifactId || null,
      type,
      name: extractTitle(document.content, filePath, type),
      parentArtifactId: metadata?.parentArtifactId || null,
      sourceIds,
      relativePath: document.relativePath,
      contentHash: document.contentHash,
    };
    if (type === 'tech' && metadata?.estimatedDay !== null && metadata?.estimatedDay !== undefined) {
      const estimatedDay = Number(metadata.estimatedDay);
      if (Number.isFinite(estimatedDay) && estimatedDay >= 0.5 && Number.isInteger(estimatedDay * 2)) {
        item.estimatedDay = estimatedDay;
      } else {
        conflicts.push({ code: 'invalid_estimated_day', path: item.relativePath, artifactId, value: metadata.estimatedDay });
      }
    }
    if (metadata?.artifactType && metadata.artifactType.toLowerCase() !== type) {
      conflicts.push({ code: 'artifact_type_mismatch', path: item.relativePath, artifactId, expected: type, actual: metadata.artifactType });
    }
    if (!artifactId) conflicts.push({ code: 'missing_artifact_id', path: item.relativePath, type });
    items.push(item);
  }

  let manifestRoot = root;
  let format = 'structured';
  let review;
  let aiContext;
  if (!items.length) {
    format = 'legacy-flat';
    manifestRoot = path.resolve(legacyOutputRoot || path.join(root, '.ipd-sync', 'legacy-snapshot'));
    await mkdir(manifestRoot, { recursive: true });
    const legacy = await buildLegacyItems({
      sourceRoot: root,
      files,
      outputRoot: manifestRoot,
      legacyTechId,
      legacyTechParentId,
    });
    items = legacy.items;
    conflicts.push(...legacy.conflicts);
    review = await writeLegacyTr1(manifestRoot, 'review', await readDocument(root, reviewFiles[0]));
    aiContext = await writeLegacyTr1(manifestRoot, 'aiContext', await readDocument(root, aiFiles[0]));
  }

  const duplicateIds = new Map();
  for (const item of items) {
    if (!item.artifactId) continue;
    const paths = duplicateIds.get(item.artifactId) || [];
    paths.push(item.relativePath);
    duplicateIds.set(item.artifactId, paths);
  }
  for (const [artifactId, paths] of duplicateIds) {
    if (paths.length > 1) conflicts.push({ code: 'duplicate_artifact_id', artifactId, paths });
  }

  for (const item of items) {
    if (item.type === 'epic') continue;
    if (!item.parentArtifactId) {
      if (item.type === 'feature') item.parentArtifactId = nearestAncestor(items, item, 'epic')?.artifactId || null;
      if (item.type === 'story') item.parentArtifactId = nearestAncestor(items, item, 'feature')?.artifactId || null;
      if (item.type === 'tech') {
        item.parentArtifactId = item.sourceIds.find((value) => value.startsWith('ST-'))
          || item.sourceIds.find((value) => value.startsWith('FEAT-'))
          || nearestAncestor(items, item, 'feature')?.artifactId
          || null;
      }
    }
  }

  const byId = new Map(items.filter((item) => item.artifactId).map((item) => [item.artifactId, item]));
  for (const item of items) {
    if (item.type === 'epic') {
      if (item.parentArtifactId) conflicts.push({ code: 'epic_has_parent', artifactId: item.artifactId, parentArtifactId: item.parentArtifactId });
      continue;
    }
    if (!item.parentArtifactId) {
      conflicts.push({ code: 'missing_parent', artifactId: item.artifactId, path: item.relativePath });
      continue;
    }
    const parent = byId.get(item.parentArtifactId);
    if (!parent) {
      conflicts.push({ code: 'parent_not_found', artifactId: item.artifactId, parentArtifactId: item.parentArtifactId });
    } else if (!PARENT_TYPES[item.type].has(parent.type)) {
      conflicts.push({ code: 'invalid_parent_type', artifactId: item.artifactId, type: item.type, parentArtifactId: parent.artifactId, parentType: parent.type });
    }
  }

  items.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.relativePath.localeCompare(b.relativePath));
  review ||= await readDocument(root, reviewFiles[0]);
  aiContext ||= await readDocument(root, aiFiles[0]);
  const summary = { epic: 0, feature: 0, story: 0, tech: 0 };
  for (const item of items) summary[item.type] += 1;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    format,
    artifactRoot: manifestRoot,
    sourceArtifactRoot: root,
    summary,
    rootEpicArtifactIds: items
      .filter((item) => item.type === 'epic' && item.artifactId)
      .map((item) => item.artifactId)
      .sort(),
    tr1: {
      review: { relativePath: review.relativePath, contentHash: review.contentHash },
      aiContext: { relativePath: aiContext.relativePath, contentHash: aiContext.contentHash },
    },
    items,
    conflicts,
  };
}

async function writeJsonAtomic(filePath, value) {
  const absolute = path.resolve(filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, absolute);
}

export async function bindIndex({ indexPath, artifactId, issueId }) {
  const normalizedArtifactId = String(artifactId || '').trim();
  const normalizedIssueId = Number(issueId);
  if (!normalizedArtifactId || !Number.isInteger(normalizedIssueId) || normalizedIssueId <= 0) {
    throw new SyncPreparationError('Binding requires a non-empty artifact ID and a positive IPD issue ID.', 'invalid_binding');
  }
  let index;
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new SyncPreparationError(`Index is not valid JSON: ${indexPath}`, 'invalid_index');
    index = { schemaVersion: 1, items: {}, attachments: {} };
  }
  if (index.schemaVersion !== 1) throw new SyncPreparationError('Unsupported sync index version.', 'invalid_index');
  index.items ||= {};
  index.attachments ||= {};
  index.items[normalizedArtifactId] = {
    ...(index.items[normalizedArtifactId] || {}),
    issueId: normalizedIssueId,
  };
  await writeJsonAtomic(indexPath, index);
  return { artifactId: normalizedArtifactId, issueId: normalizedIssueId, indexPath: path.resolve(indexPath) };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--discover') options.discover = argv[++index];
    else if (arg === '--root') options.root = argv[++index];
    else if (arg === '--manifest') options.manifest = argv[++index];
    else if (arg === '--index') options.index = argv[++index];
    else if (arg === '--bind-index') options.bindIndex = argv[++index];
    else if (arg === '--artifact-id') options.artifactId = argv[++index];
    else if (arg === '--issue-id') options.issueId = argv[++index];
    else if (arg === '--legacy-output-root') options.legacyOutputRoot = argv[++index];
    else if (arg === '--legacy-tech-id') options.legacyTechId = argv[++index];
    else if (arg === '--legacy-tech-parent-id') options.legacyTechParentId = argv[++index];
    else throw new SyncPreparationError(`Unknown argument: ${arg}`, 'invalid_argument');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.bindIndex) {
    console.log(JSON.stringify(await bindIndex({
      indexPath: options.bindIndex,
      artifactId: options.artifactId,
      issueId: options.issueId,
    }), null, 2));
    return;
  }
  if (options.discover) {
    const sets = await discoverArtifactSets(options.discover);
    console.log(JSON.stringify({ artifactSets: sets }, null, 2));
    return;
  }
  if (!options.root || !options.manifest) {
    throw new SyncPreparationError('Use --discover <directory> or --root <artifact-root> --manifest <path> [--index <path>].', 'missing_argument');
  }
  const manifest = await buildManifest(options.root, {
    legacyOutputRoot: options.legacyOutputRoot || path.join(path.dirname(path.resolve(options.manifest)), 'legacy-snapshot'),
    legacyTechId: options.legacyTechId,
    legacyTechParentId: options.legacyTechParentId,
  });
  await writeJsonAtomic(options.manifest, manifest);
  if (options.index) {
    try {
      await lstat(options.index);
    } catch {
      await writeJsonAtomic(options.index, { schemaVersion: 1, items: {}, attachments: {} });
    }
  }
  console.log(JSON.stringify({
    manifestPath: path.resolve(options.manifest),
    artifactRoot: manifest.artifactRoot,
    summary: manifest.summary,
    rootEpicArtifactIds: manifest.rootEpicArtifactIds,
    tr1: manifest.tr1,
    conflicts: manifest.conflicts,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, code: error.code || 'sync_preparation_error', message: error.message }));
    process.exitCode = 1;
  });
}
