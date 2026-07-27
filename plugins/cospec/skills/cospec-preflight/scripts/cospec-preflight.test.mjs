import test from 'node:test';
import assert from 'node:assert/strict';
import { probeTarget, probeAll, classifyError, getTargets } from './cospec-preflight.mjs';

// Behavior tests. fetch is injected (never hits real network), mirroring
// generate-demo.test.mjs's dependency-injection pattern.

// ---- mock fetch factories ----
const reachable = (status) => async () => ({ status });
const abortFetch = async () => {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  throw e;
};
const dnsFetch = async () => {
  const e = new TypeError('fetch failed');
  e.cause = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND ipd.sangfor.com' };
  throw e;
};
const refusedFetch = async () => {
  const e = new TypeError('fetch failed');
  e.cause = { code: 'ECONNREFUSED' };
  throw e;
};
const resetFetch = async () => {
  const e = new TypeError('fetch failed');
  e.cause = { code: 'ECONNRESET' };
  throw e;
};

const T = { name: 'x', label: 'X', url: 'http://x/', impact: '影响说明' };

test('reachable when fetch returns any HTTP status', async () => {
  for (const status of [200, 301, 404, 500]) {
    const r = await probeTarget(T, { fetchFn: reachable(status) });
    assert.equal(r.ok, true, `status ${status} should count as reachable`);
    assert.equal(r.status, status);
  }
});

test('classifies AbortError as timeout', async () => {
  const r = await probeTarget(T, { fetchFn: abortFetch });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'timeout');
  assert.equal(r.error, '连接超时');
  assert.equal(r.impact, '影响说明');
});

test('classifies ENOTFOUND cause as dns', async () => {
  const r = await probeTarget(T, { fetchFn: dnsFetch });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'dns');
});

test('classifies ECONNREFUSED cause as refused', async () => {
  const r = await probeTarget(T, { fetchFn: refusedFetch });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'refused');
});

test('classifies ECONNRESET cause as reset', async () => {
  const r = await probeTarget(T, { fetchFn: resetFetch });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'reset');
});

test('classifyError maps error shapes to stable codes', () => {
  assert.equal(classifyError({ name: 'AbortError' }), 'timeout');
  assert.equal(classifyError({ code: 'ABORT_ERR' }), 'timeout');
  assert.equal(classifyError({ cause: { code: 'ENOTFOUND' } }), 'dns');
  assert.equal(classifyError({ cause: { code: 'EAI_AGAIN' } }), 'dns');
  assert.equal(classifyError({ cause: { code: 'ECONNREFUSED' } }), 'refused');
  assert.equal(classifyError({ cause: { code: 'ECONNRESET' } }), 'reset');
  assert.equal(classifyError({ message: 'something weird' }), 'other');
});

test('probeAll summarizes reachability across targets', async () => {
  const fetchFn = async (url) => {
    if (url.includes('ipd.sangfor')) return { status: 200 }; // only IPD up
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  };
  const report = await probeAll({ fetchFn });
  assert.equal(report.ok, false);
  assert.equal(report.summary, '1/3 reachable');
  assert.equal(report.results.length, 3);
  const ipd = report.results.find((r) => r.name === 'ipd');
  assert.equal(ipd.ok, true);
  const kb = report.results.find((r) => r.name === 'kb');
  assert.equal(kb.ok, false);
  assert.equal(kb.code, 'dns');
});

test('probeAll runs targets in parallel (total time ≈ slowest, not sum)', async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const fetchFn = async () => {
    await delay(50);
    return { status: 200 };
  };
  const start = Date.now();
  const report = await probeAll({ fetchFn });
  const elapsed = Date.now() - start;
  assert.equal(report.ok, true);
  assert.ok(elapsed < 120, `probes should run in parallel, took ${elapsed}ms (serial would be ~150ms)`);
});

test('getTargets exposes kb/ipd/demo probing root paths with impact text', () => {
  const targets = getTargets();
  assert.deepEqual(targets.map((t) => t.name), ['kb', 'ipd', 'demo']);
  for (const t of targets) {
    assert.ok(t.url.endsWith('/'), `${t.name} url should probe root path`);
    assert.ok(t.impact, `${t.name} should carry impact text`);
  }
});
