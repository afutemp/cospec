#!/usr/bin/env node
// cospec-preflight — Connectivity probe for cospec's external dependencies.
//
// Run before starting a cospec workflow to verify that downstream services
// (product knowledge base / IPD / Demo endpoint) are reachable, so the user
// does not discover mid-workflow that e.g. sync-to-ipd or generate-demo is down.
//
// Probe = HTTP GET on each service's root path. Any HTTP response (any status
// code, including 404/302/500) counts as reachable. Timeout / DNS failure /
// connection refused counts as unreachable, with a classified reason.
//
// Read-only: never writes, uploads, creates, or syncs anything. No credentials
// (tokens / HMAC secrets) are read or printed.
//
// Zero runtime dependencies — Node.js 18+ built-ins only (uses global fetch).

import { pathToFileURL } from 'node:url';

// ---- Defaults mirror each service's own configuration conventions ----
// KB:    product-kb-server.cjs KB_SERVER_URL default (env-overridable).
// IPD:   ipd_api.js hardcoded base (NOT configurable).
// Demo:  generate-demo.mjs DEFAULT_FRIEREN_DEMO_BASE_URL (env-overridable).
const DEFAULT_KB_URL = 'http://product-kb.sangfor.com';
const IPD_URL = 'http://ipd.sangfor.com';
const DEFAULT_DEMO_URL = 'http://ui.sangfor.com.cn/';

const PROBE_TIMEOUT_MS = 5000;

function resolveKbUrl() {
  return (process.env.KB_SERVER_URL ?? DEFAULT_KB_URL).replace(/\/+$/, '');
}
function resolveDemoUrl() {
  return (process.env.FRIEREN_DEMO_BASE_URL ?? DEFAULT_DEMO_URL).replace(/\/+$/, '');
}

export function getTargets() {
  return [
    {
      name: 'kb',
      label: '知识库',
      url: resolveKbUrl() + '/',
      impact: 'product-kb-server（下载/上传）与 product-kb-query（查询）将不可用',
    },
    {
      name: 'ipd',
      label: 'IPD',
      url: IPD_URL + '/',
      impact: 'sync-to-ipd 同步 TR1/TR2 产物将不可用',
    },
    {
      name: 'demo',
      label: 'Demo',
      url: resolveDemoUrl() + '/',
      impact: 'generate-demo 生成 Demo 将不可用',
    },
  ];
}

const CODE_LABEL = {
  timeout: '连接超时',
  dns: '域名解析失败',
  refused: '连接被拒绝',
  reset: '连接被重置',
  other: '网络错误',
};

// Classify a fetch failure into a stable machine code for reporting.
// Node's fetch surfaces network errors as TypeError('fetch failed') with a
// `cause` carrying the raw errno (ENOTFOUND / ECONNREFUSED / ...).
export function classifyError(err) {
  const msg = String(err?.message ?? err?.cause?.message ?? err ?? '');
  const code = String(err?.code ?? err?.cause?.code ?? '');
  if (err?.name === 'AbortError' || code === 'ABORT_ERR' || /timed?\s*out|abort/i.test(msg)) return 'timeout';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /getaddrinfo ENOTFOUND|resolve host/i.test(msg)) return 'dns';
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) return 'refused';
  if (code === 'ECONNRESET' || /ECONNRESET/i.test(msg)) return 'reset';
  return 'other';
}

// Probe one target: GET root path. Any HTTP response => reachable.
export async function probeTarget(target, { fetchFn = globalThis.fetch, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(target.url, { method: 'GET', signal: controller.signal });
    return {
      name: target.name,
      label: target.label,
      url: target.url,
      ok: true,
      status: res.status,
    };
  } catch (err) {
    const c = classifyError(err);
    return {
      name: target.name,
      label: target.label,
      url: target.url,
      ok: false,
      code: c,
      error: CODE_LABEL[c],
      impact: target.impact,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Probe all (or a subset) in parallel; total wall-time ≈ slowest single probe.
export async function probeAll({ fetchFn, timeoutMs, names } = {}) {
  const all = getTargets();
  const selected = names ? all.filter((t) => names.includes(t.name)) : all;
  if (selected.length === 0) throw new Error(`No targets matched names: ${JSON.stringify(names)}`);
  const results = await Promise.all(selected.map((t) => probeTarget(t, { fetchFn, timeoutMs })));
  const reachable = results.filter((r) => r.ok).length;
  return {
    ok: results.every((r) => r.ok),
    summary: `${reachable}/${results.length} reachable`,
    results,
  };
}

// ---- CLI ----
function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unknown argument: ${a}`);
    const eq = a.indexOf('=');
    if (eq >= 0) {
      values[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      values[a.slice(2)] = argv[++i];
    }
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target || 'all';
  const valid = ['all', 'kb', 'ipd', 'demo'];
  if (!valid.includes(target)) {
    throw new Error(`Invalid --target "${target}". Use one of: ${valid.join(', ')}.`);
  }
  const names = target === 'all' ? undefined : [target];
  const report = await probeAll({ names });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  // Always exit 0: this is a non-blocking health check; the JSON `ok` field
  // conveys status. A non-zero exit would let callers treat "a dependency is
  // down" as a hard failure, which contradicts the warn-and-continue design.
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`cospec-preflight: ${err.message}\n`);
    process.exit(2); // exit 2 = CLI misuse only, never for unreachable deps
  });
}
