// Tests for hooks/lib/check-vault-drift.mjs.
//
// Run: node --test plugins/cospec/hooks/lib/check-vault-drift.test.mjs

import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const helperUrl = new URL('./check-vault-drift.mjs', import.meta.url);

async function importFresh() {
  return import(`${helperUrl.href}?t=${Date.now()}-${Math.random()}`);
}

async function makeTmp() {
  return mkdtemp(join(tmpdir(), 'cospec-drift-'));
}

async function seedVault(home, entries) {
  const vaultDir = join(home, '.cospec', 'workflows');
  await mkdir(vaultDir, { recursive: true });
  for (const name of entries) {
    const dir = join(vaultDir, name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), `# ${name}\n`);
  }
}

async function writePlugin(home, options) {
  const pluginRoot = join(home, 'plugin');
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, 'cospec.config.json'),
    JSON.stringify({ workflow: { options } }, null, 2),
  );
  return pluginRoot;
}

test('detectDrift returns empty when vault is missing', async () => {
  const home = await makeTmp();
  try {
    const pluginRoot = await writePlugin(home, []);
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({ vaultDir: join(home, 'absent'), pluginRoot, agentDirs: [] });
    assert.equal(drift.vaultCount, 0);
    assert.deepEqual(drift.unregistered, []);
    assert.deepEqual(drift.bridgeMissing, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift finds unregistered vault workflows', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, ['quick-tr1-workflow', 'customer-research-workflow']);
    const pluginRoot = await writePlugin(home, []); // empty registry
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({
      vaultDir: join(home, '.cospec', 'workflows'),
      pluginRoot,
      agentDirs: [],
    });
    assert.equal(drift.vaultCount, 2);
    assert.deepEqual(drift.unregistered.sort(), ['customer-research-workflow', 'quick-tr1-workflow']);
    assert.deepEqual(drift.bridgeMissing, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift reports missing bridge for registered workflow', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, ['foo-workflow']);
    const pluginRoot = await writePlugin(home, ['foo-workflow']);
    const { detectDrift } = await importFresh();
    const agentDir = join(home, 'agents-skills');
    const drift = await detectDrift({
      vaultDir: join(home, '.cospec', 'workflows'),
      pluginRoot,
      agentDirs: [agentDir],
    });
    assert.deepEqual(drift.unregistered, []);
    assert.deepEqual(drift.bridgeMissing, ['foo-workflow']);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift reports no drift when vault, registry, and bridge all line up', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, ['good-workflow']);
    const pluginRoot = await writePlugin(home, ['good-workflow']);
    const agentDir = join(home, 'agents-skills');
    await mkdir(agentDir, { recursive: true });
    await symlink(
      join(home, '.cospec', 'workflows', 'good-workflow'),
      join(agentDir, 'good-workflow'),
      'junction',
    );
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({
      vaultDir: join(home, '.cospec', 'workflows'),
      pluginRoot,
      agentDirs: [agentDir],
    });
    assert.equal(drift.vaultCount, 1);
    assert.deepEqual(drift.unregistered, []);
    assert.deepEqual(drift.bridgeMissing, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift ignores vault entries that lack SKILL.md', async () => {
  const home = await makeTmp();
  try {
    const vaultDir = join(home, '.cospec', 'workflows');
    await mkdir(join(vaultDir, 'incomplete-workflow'), { recursive: true });
    // No SKILL.md written — should be skipped.
    await seedVault(home, ['valid-workflow']);
    const pluginRoot = await writePlugin(home, []);
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({ vaultDir, pluginRoot, agentDirs: [] });
    assert.equal(drift.vaultCount, 1);
    assert.deepEqual(drift.unregistered, ['valid-workflow']);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift tolerates malformed cospec.config.json', async () => {
  const home = await makeTmp();
  try {
    const pluginRoot = join(home, 'plugin');
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(join(pluginRoot, 'cospec.config.json'), '{ this is not json');
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({
      vaultDir: join(home, 'absent'),
      pluginRoot,
      agentDirs: [],
    });
    // Malformed config means empty registry → no crash.
    assert.equal(drift.vaultCount, 0);
    assert.deepEqual(drift.unregistered, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('detectDrift ignores vault entries whose names fail the workflow pattern', async () => {
  const home = await makeTmp();
  try {
    const vaultDir = join(home, '.cospec', 'workflows');
    // "no-suffix" violates the -workflow suffix rule.
    await mkdir(join(vaultDir, 'no-suffix'), { recursive: true });
    await writeFile(join(vaultDir, 'no-suffix', 'SKILL.md'), 'x');
    // "UPPER-workflow" violates the lowercase rule.
    await mkdir(join(vaultDir, 'UPPER-workflow'), { recursive: true });
    await writeFile(join(vaultDir, 'UPPER-workflow', 'SKILL.md'), 'x');
    const pluginRoot = await writePlugin(home, []);
    const { detectDrift } = await importFresh();
    const drift = await detectDrift({ vaultDir, pluginRoot, agentDirs: [] });
    assert.equal(drift.vaultCount, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('formatReport returns clean status when vault empty', async () => {
  const { formatReport } = await importFresh();
  const out = formatReport({
    vaultCount: 0,
    unregistered: [],
    bridgeMissing: [],
  });
  assert.match(out, /✅/);
  assert.match(out, /vault 为空/);
});

test('formatReport returns clean status when vault in sync', async () => {
  const { formatReport } = await importFresh();
  const out = formatReport({
    vaultCount: 2,
    unregistered: [],
    bridgeMissing: [],
  });
  assert.match(out, /✅/);
  assert.match(out, /全部已注册/);
  assert.doesNotMatch(out, /⚠️/);
});

test('formatReport includes recovery instructions for unregistered vault', async () => {
  const { formatReport } = await importFresh();
  const out = formatReport({
    vaultCount: 1,
    unregistered: ['quick-tr1-workflow'],
    bridgeMissing: [],
  });
  assert.match(out, /⚠️/);
  assert.match(out, /quick-tr1-workflow/);
  assert.match(out, /workflow\.options/);
  assert.match(out, /5\.5 sync/);
  assert.match(out, /恢复/);
  // Recovery instructions reference Skill(cospec-configure) without quotes
  // so the helper output can be safely embedded in a JSON string.
  assert.match(out, /Skill\(cospec-configure\)/);
  assert.doesNotMatch(out, /Skill\("cospec-configure"\)/, 'unescaped " would break JSON embedding');
});

test('formatReport includes bridge recovery instructions', async () => {
  const { formatReport } = await importFresh();
  const out = formatReport({
    vaultCount: 1,
    unregistered: [],
    bridgeMissing: ['quick-tr1-workflow'],
  });
  assert.match(out, /⚠️/);
  assert.match(out, /quick-tr1-workflow/);
  assert.match(out, /workflow-links\.mjs install/);
  assert.match(out, /恢复/);
});

test('CLI entry exits 0 and prints report when drift exists', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, ['cli-test-workflow']);
    const pluginRoot = await writePlugin(home, []);
    // Invoke the helper as a subprocess with the plugin root as argv[2].
    const { spawn } = await import('node:child_process');
    const child = spawn(
      process.execPath,
      [join(here, 'check-vault-drift.mjs'), pluginRoot],
      { env: { ...process.env, HOME: home }, encoding: 'utf8' },
    );
    let stdout = '';
    let stderr = '';
    for await (const chunk of child.stdout) stdout += chunk;
    for await (const chunk of child.stderr) stderr += chunk;
    const code = await new Promise((res) => child.on('close', res));
    assert.equal(code, 0);
    assert.match(stdout, /drift 检测/);
    assert.match(stdout, /cli-test-workflow/);
    assert.match(stdout, /5\.5 sync/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('CLI entry exits 0 with clean status when no drift', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, []);
    const pluginRoot = await writePlugin(home, []);
    const { spawn } = await import('node:child_process');
    const child = spawn(
      process.execPath,
      [join(here, 'check-vault-drift.mjs'), pluginRoot],
      { env: { ...process.env, HOME: home }, encoding: 'utf8' },
    );
    let stdout = '';
    for await (const chunk of child.stdout) stdout += chunk;
    const code = await new Promise((res) => child.on('close', res));
    assert.equal(code, 0);
    // CLI now always emits a clean status (✅) so the agent has a clear signal.
    assert.match(stdout, /✅/);
    assert.match(stdout, /vault 为空/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('CLI entry works on Windows-style paths (isMain check uses pathToFileURL)', async () => {
  // Regression test for the Windows isMain bug. On Windows, import.meta.url
  // is `file:///C:/path/to/file` and argv[1] is `C:\path\to\file` — these
  // differ in slash count and direction. The naive `file://${process.argv[1]}`
  // form always returned false on Windows, silently skipping the CLI block.
  // This test runs the script as a subprocess and verifies it produces output
  // (proving the CLI block ran), regardless of the host platform.
  const home = await makeTmp();
  try {
    await seedVault(home, ['winpath-test-workflow']);
    const pluginRoot = await writePlugin(home, []);
    const { spawn } = await import('node:child_process');
    const child = spawn(
      process.execPath,
      [join(here, 'check-vault-drift.mjs'), pluginRoot],
      { env: { ...process.env, HOME: home }, encoding: 'utf8' },
    );
    let stdout = '';
    for await (const chunk of child.stdout) stdout += chunk;
    const code = await new Promise((res) => child.on('close', res));
    assert.equal(code, 0);
    // The fix: the isMain check now uses pathToFileURL so the CLI block
    // executes regardless of platform. We assert non-empty output and the
    // presence of the drift marker.
    assert.ok(stdout.length > 0, `expected non-empty stdout, got: ${JSON.stringify(stdout)}`);
    assert.match(stdout, /⚠️/);
    assert.match(stdout, /winpath-test-workflow/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});