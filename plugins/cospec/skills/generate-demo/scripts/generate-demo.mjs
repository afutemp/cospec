#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
import {
  access,
  lstat,
  readFile,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const HANDOFF_PATH = '/api/integrations/workflows/handoff';
export const MAX_DOCUMENTS = 20;
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 60_000;
export const VALID_STATUSES = new Set([
  'queued',
  'ready',
  'running',
  'succeeded',
  'failed',
  'canceled',
]);

export class DemoGenerationError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'DemoGenerationError';
    this.code = code || 'demo_generation_error';
    this.status = status;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compactTitle(value, fallback) {
  const title = String(value || '').replace(/\s+/g, ' ').trim() || fallback;
  return title.length <= 160 ? title : `${title.slice(0, 157)}...`;
}

export function extractMarkdownTitle(content, fallback) {
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/);
    if (match?.[1]?.trim()) return compactTitle(match[1], fallback);
  }
  return compactTitle('', fallback);
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function findProjectRoot(startDirectory) {
  const startingRoot = await realpath(path.resolve(startDirectory));
  let current = startingRoot;

  while (true) {
    try {
      await access(path.join(current, '.git'));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return startingRoot;
      current = parent;
    }
  }
}

async function readSelectedDocuments(documentPaths, projectRoot) {
  if (!Array.isArray(documentPaths) || documentPaths.length === 0) {
    throw new DemoGenerationError('At least one --document path is required.', {
      code: 'missing_documents',
    });
  }
  if (documentPaths.length > MAX_DOCUMENTS) {
    throw new DemoGenerationError(`No more than ${MAX_DOCUMENTS} documents may be selected.`, {
      code: 'too_many_documents',
    });
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const seen = new Set();
  const documents = [];
  let totalBytes = 0;

  for (const inputPath of documentPaths) {
    const absolutePath = path.resolve(inputPath);
    let stat;
    try {
      stat = await lstat(absolutePath);
    } catch {
      throw new DemoGenerationError(`Document does not exist: ${inputPath}`, {
        code: 'document_not_found',
      });
    }

    if (stat.isSymbolicLink()) {
      throw new DemoGenerationError(`Symbolic links are not allowed: ${inputPath}`, {
        code: 'document_symlink',
      });
    }
    if (!stat.isFile()) {
      throw new DemoGenerationError(`Document is not a regular file: ${inputPath}`, {
        code: 'document_not_file',
      });
    }
    if (path.extname(absolutePath).toLowerCase() !== '.md') {
      throw new DemoGenerationError(`Only .md documents are supported: ${inputPath}`, {
        code: 'unsupported_document_type',
      });
    }

    const resolvedPath = await realpath(absolutePath);
    if (!isWithinRoot(projectRoot, resolvedPath)) {
      throw new DemoGenerationError(`Document is outside the current project root: ${inputPath}`, {
        code: 'document_outside_project',
      });
    }
    if (seen.has(resolvedPath)) {
      throw new DemoGenerationError(`Document was selected more than once: ${inputPath}`, {
        code: 'duplicate_document',
      });
    }
    seen.add(resolvedPath);

    const buffer = await readFile(resolvedPath);
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw new DemoGenerationError(`Document exceeds ${MAX_DOCUMENT_BYTES} bytes: ${inputPath}`, {
        code: 'document_too_large',
      });
    }

    let content;
    try {
      content = decoder.decode(buffer);
    } catch {
      throw new DemoGenerationError(`Document is not valid UTF-8: ${inputPath}`, {
        code: 'invalid_document_encoding',
      });
    }
    if (!content.trim()) {
      throw new DemoGenerationError(`Document is empty: ${inputPath}`, {
        code: 'empty_document',
      });
    }

    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
      throw new DemoGenerationError(`Selected documents exceed ${MAX_TOTAL_DOCUMENT_BYTES} bytes in total.`, {
        code: 'documents_too_large',
      });
    }

    const relativePath = path.relative(projectRoot, resolvedPath).split(path.sep).join('/');
    const fallbackTitle = path.basename(relativePath, path.extname(relativePath));
    documents.push({
      absolutePath: resolvedPath,
      relativePath,
      bytes: buffer.byteLength,
      id: `doc-${sha256(relativePath).slice(0, 16)}`,
      title: extractMarkdownTitle(content, fallbackTitle),
      format: 'markdown',
      content,
    });
  }

  return { documents, totalBytes };
}

export function buildDemoUrl(baseUrl, handoffPath = HANDOFF_PATH) {
  let url;
  try {
    url = new URL(handoffPath, String(baseUrl || '').trim());
  } catch {
    throw new DemoGenerationError('FRIEREN_DEMO_BASE_URL is not a valid URL.', {
      code: 'invalid_base_url',
    });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new DemoGenerationError('FRIEREN_DEMO_BASE_URL must use http:// or https://.', {
      code: 'invalid_base_url_protocol',
    });
  }
  return url.toString();
}

export function createDemoSignature({ timestamp, method = 'POST', handoffPath = HANDOFF_PATH, rawBody, secret }) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${method}.${handoffPath}.${rawBody}`)
    .digest('hex');
}

function getEnvironment(env) {
  const baseUrl = String(env.FRIEREN_DEMO_BASE_URL || '').trim();
  const secret = String(env.FRIEREN_DEMO_HMAC_SECRET || '').trim();
  if (!baseUrl) {
    throw new DemoGenerationError('FRIEREN_DEMO_BASE_URL is not configured.', {
      code: 'missing_base_url',
    });
  }
  if (!secret) {
    throw new DemoGenerationError('FRIEREN_DEMO_HMAC_SECRET is not configured.', {
      code: 'missing_hmac_secret',
    });
  }
  return { baseUrl, secret };
}

function appendOptional(payload, key, value) {
  const normalized = String(value || '').trim();
  if (normalized) payload[key] = normalized;
}

export async function prepareDemoRequest({
  documentPaths,
  cwd = process.cwd(),
  env = process.env,
  title,
  projectKey,
  workflowId,
  workflowVersion,
  workflowType,
  templateId,
}) {
  const { baseUrl, secret } = getEnvironment(env);
  const projectRoot = await findProjectRoot(cwd);
  const { documents, totalBytes } = await readSelectedDocuments(documentPaths, projectRoot);
  const sortedPaths = documents.map((document) => document.relativePath).sort();
  const pathIdentity = sortedPaths.join('\n');
  const contentIdentity = documents
    .map((document) => `${document.relativePath}\0${sha256(document.content)}`)
    .sort()
    .join('\n');
  const resolvedProjectKey = String(projectKey || '').trim()
    || `cospec-${sha256(projectRoot).slice(0, 16)}`;
  const resolvedWorkflowId = String(workflowId || '').trim()
    || `demo-${sha256(pathIdentity).slice(0, 16)}`;
  const resolvedWorkflowVersion = String(workflowVersion || '').trim()
    || sha256(contentIdentity);
  const resolvedTitle = compactTitle(title, documents[0].title);
  const requestUrl = buildDemoUrl(baseUrl);

  const payload = {
    externalWorkflowId: resolvedWorkflowId,
    externalWorkflowVersion: resolvedWorkflowVersion,
    externalProjectKey: resolvedProjectKey,
    title: resolvedTitle,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      format: document.format,
      content: document.content,
    })),
  };
  appendOptional(payload, 'workflowType', workflowType);
  appendOptional(payload, 'templateId', templateId);

  const secureTransport = new URL(requestUrl).protocol === 'https:';
  return {
    projectRoot,
    baseUrl,
    requestUrl,
    secret,
    payload,
    documentCount: documents.length,
    totalBytes,
    documents: documents.map(({ relativePath, bytes, id, title: documentTitle }) => ({
      path: relativePath,
      bytes,
      id,
      title: documentTitle,
    })),
    secureTransport,
    warnings: secureTransport
      ? []
      : ['The Demo endpoint uses HTTP. Document contents will not be protected by TLS.'],
  };
}

function parseSuccessBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.ok !== true) {
    throw new DemoGenerationError('Demo handoff response is invalid.', {
      code: 'invalid_response',
    });
  }
  const data = body.data;
  if (
    !data
    || typeof data !== 'object'
    || Array.isArray(data)
    || typeof data.handoffId !== 'string'
    || typeof data.studioUrl !== 'string'
    || typeof data.status !== 'string'
    || !VALID_STATUSES.has(data.status)
  ) {
    throw new DemoGenerationError('Demo handoff response is missing valid required data.', {
      code: 'invalid_response_data',
    });
  }
  return data;
}

function resolveReturnedUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value.trim();
  }
}

export async function sendPreparedDemoRequest({
  prepared,
  fetchFn = globalThis.fetch,
  now = Date.now,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  if (typeof fetchFn !== 'function') {
    throw new DemoGenerationError('This Node.js runtime does not provide fetch().', {
      code: 'fetch_unavailable',
    });
  }

  const rawBody = JSON.stringify(prepared.payload);
  const timestamp = String(now());
  const signature = createDemoSignature({
    timestamp,
    rawBody,
    secret: prepared.secret,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let responseText;

  try {
    response = await fetchFn(prepared.requestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-frieren-timestamp': timestamp,
        'x-frieren-signature': `sha256=${signature}`,
      },
      body: rawBody,
      signal: controller.signal,
    });
    responseText = await response.text();
  } catch {
    if (controller.signal.aborted) {
      throw new DemoGenerationError(`Demo handoff request timed out after ${timeoutMs} ms.`, {
        code: 'request_timeout',
      });
    }
    throw new DemoGenerationError('Demo handoff request could not be completed.', {
      code: 'request_error',
    });
  } finally {
    clearTimeout(timeout);
  }

  let responseBody = null;
  if (responseText.trim()) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = null;
    }
  }

  if (!response.ok) {
    throw new DemoGenerationError(`Demo handoff request failed with status ${response.status}.`, {
      code: 'request_failed',
      status: response.status,
    });
  }
  if (responseBody && typeof responseBody === 'object' && responseBody.ok === false) {
    throw new DemoGenerationError('Demo handoff request was rejected by the service.', {
      code: 'handoff_rejected',
      status: response.status,
    });
  }

  const data = parseSuccessBody(responseBody);
  return {
    ok: true,
    mode: 'send',
    requestUrl: prepared.requestUrl,
    status: data.status,
    handoffId: data.handoffId,
    projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : undefined,
    agentSessionId: typeof data.agentSessionId === 'string' || data.agentSessionId === null
      ? data.agentSessionId
      : undefined,
    studioUrl: resolveReturnedUrl(data.studioUrl, prepared.baseUrl),
    directStudioUrl: resolveReturnedUrl(data.directStudioUrl, prepared.baseUrl),
  };
}

export async function runDemoGeneration(options) {
  const prepared = await prepareDemoRequest(options);
  if (!options.send) {
    return {
      ok: true,
      mode: 'dry-run',
      requestUrl: prepared.requestUrl,
      targetHost: new URL(prepared.requestUrl).host,
      secureTransport: prepared.secureTransport,
      warnings: prepared.warnings,
      title: prepared.payload.title,
      externalProjectKey: prepared.payload.externalProjectKey,
      externalWorkflowId: prepared.payload.externalWorkflowId,
      externalWorkflowVersion: prepared.payload.externalWorkflowVersion,
      documentCount: prepared.documentCount,
      totalBytes: prepared.totalBytes,
      documents: prepared.documents,
    };
  }
  return sendPreparedDemoRequest({
    prepared,
    fetchFn: options.fetchFn,
    now: options.now,
    timeoutMs: options.timeoutMs,
  });
}

export function parseArguments(argv) {
  const options = { documentPaths: [], send: false };
  const valueFlags = new Map([
    ['--title', 'title'],
    ['--project-key', 'projectKey'],
    ['--workflow-id', 'workflowId'],
    ['--workflow-version', 'workflowVersion'],
    ['--workflow-type', 'workflowType'],
    ['--template-id', 'templateId'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--send') {
      options.send = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--document') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new DemoGenerationError('--document requires a file path.', {
          code: 'invalid_arguments',
        });
      }
      options.documentPaths.push(value);
      index += 1;
      continue;
    }
    if (valueFlags.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new DemoGenerationError(`${argument} requires a value.`, {
          code: 'invalid_arguments',
        });
      }
      options[valueFlags.get(argument)] = value;
      index += 1;
      continue;
    }
    throw new DemoGenerationError(`Unknown argument: ${argument}`, {
      code: 'invalid_arguments',
    });
  }
  return options;
}

function usage() {
  return `Usage:
  node generate-demo.mjs --document <path> [--document <path> ...] [options]

Options:
  --title <text>
  --project-key <text>
  --workflow-id <text>
  --workflow-version <text>
  --workflow-type <text>
  --template-id <text>
  --send                 Send the request. Omit for a dry run.
  --help                  Show this help.
`;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const result = await runDemoGeneration(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const normalized = error instanceof DemoGenerationError
      ? error
      : new DemoGenerationError('Unexpected Demo generation failure.', { code: 'unexpected_error' });
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.status ? { status: normalized.status } : {}),
      },
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
