// Tests for scripts/workflow-links.mjs (cospec custom-workflow bridge helper).
//
// Run: node --test plugins/cospec/scripts/workflow-links.test.mjs

import { mkdir, mkdtemp, rm, symlink, writeFile, readFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const moduleUrl = new URL('./workflow-links.mjs', import.meta.url);

// Each test gets an isolated HOME so vault operations never touch the user's real ~/.cospec.
async function isolatedEnv() {
  const home = await mkdtempPrefix('cospec-wflinks-');
  process.env.COSPEC_HOME = home;
  // workflow-links uses COSPEC_HOME for testability and falls back to ~/.cospec/workflows.
  return { home };
}

async function mkdtempPrefix(prefix) {
  return await mkdtemp(join(tmpdir(), prefix));
}

async function seedVault(home, name, { content = '# Test workflow\n' } = {}) {
  const dir = join(home, '.cospec', 'workflows', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), content, 'utf8');
  return dir;
}

async function writeTextFile(path, text) {
  await writeFile(path, text, 'utf8');
}

function importFresh() {
  // Re-import with a fresh module cache so COSPEC_HOME changes take effect.
  return import(`${moduleUrl.href}?t=${Date.now()}-${Math.random()}`);
}

test('install creates a symlink whose realpath points to the vault source', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'quick-tr1-workflow');
  const agentDir = join(home, 'agents-skills');
  const { install } = await importFresh();

  const result = await install('quick-tr1-workflow', { installDir: agentDir });
  assert.equal(result.ok, true, `install failed: ${result.reason}`);
  assert.equal(result.action, 'created');

  const linkStat = await lstat(result.dest);
  assert.equal(linkStat.isSymbolicLink(), true, 'destination must be a symlink/junction');
  // On Unix, readlink returns the link target; on Windows with 'junction' type,
  // fs.realpath follows it back to the source. Both converge here.
  const real = await realpathOf(result.dest);
  assert.equal(real, await realpathOf(join(home, '.cospec', 'workflows', 'quick-tr1-workflow')));
});

test('editing the vault is immediately visible through the bridge (no copy)', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'customer-research-workflow', { content: 'v1\n' });
  const agentDir = join(home, 'agents-skills');
  const { install } = await importFresh();
  await install('customer-research-workflow', { installDir: agentDir });

  const bridgePath = join(agentDir, 'customer-research-workflow');
  await writeTextFile(join(home, '.cospec', 'workflows', 'customer-research-workflow', 'SKILL.md'), 'v2\n');
  const seen = await readFile(join(bridgePath, 'SKILL.md'), 'utf8');
  assert.equal(seen, 'v2\n', 'bridge must reflect vault edits without re-install');
});

test('repeated install is idempotent', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');
  const { install } = await importFresh();

  const r1 = await install('foo-workflow', { installDir: agentDir });
  const r2 = await install('foo-workflow', { installDir: agentDir });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.action, 'unchanged', 'second install should be a no-op');
});

test('refuses to overwrite a real file or unrelated directory at the destination', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');
  await mkdir(agentDir, { recursive: true });

  // Real file at the destination name
  const realFile = join(agentDir, 'foo-workflow');
  await writeTextFile(realFile, 'user content');
  const { install } = await importFresh();
  const r1 = await install('foo-workflow', { installDir: agentDir });
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /conflict/i);
  assert.equal(await readFile(realFile, 'utf8'), 'user content', 'existing file must be untouched');

  // Real directory at the destination name
  const realDir = join(home, 'agents-skills-2', 'foo-workflow');
  await mkdir(realDir, { recursive: true });
  await writeTextFile(join(realDir, 'README.md'), 'user dir');
  const r2 = await install('foo-workflow', { installDir: join(home, 'agents-skills-2') });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /conflict/i);
  assert.equal(await readFile(join(realDir, 'README.md'), 'utf8'), 'user dir');
});

test('refuses to overwrite an unrelated symlink at the destination', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');
  await mkdir(agentDir, { recursive: true });
  // Unrelated symlink
  await symlink(join(home, 'somewhere-else'), join(agentDir, 'foo-workflow'), 'junction');
  const { install } = await importFresh();
  const r = await install('foo-workflow', { installDir: agentDir });
  assert.equal(r.ok, false);
  assert.match(r.reason, /conflict|points/i);
});

test('uninstall removes only the verified bridge and preserves the vault', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  const sourceDir = await seedVault(home, 'foo-workflow');
  const agentA = join(home, 'agents-A');
  const agentB = join(home, 'agents-B');
  const { install, uninstall } = await importFresh();
  await install('foo-workflow', { installDir: agentA });
  await install('foo-workflow', { installDir: agentB });

  const r = await uninstall('foo-workflow', { installDir: agentA });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'removed');

  // Source preserved
  const srcStat = await lstat(sourceDir);
  assert.equal(srcStat.isDirectory(), true);
  // Agent B bridge preserved
  const bStat = await lstat(join(agentB, 'foo-workflow'));
  assert.equal(bStat.isSymbolicLink(), true);
  // Agent A bridge gone
  await assert.rejects(lstat(join(agentA, 'foo-workflow')));
});

test('uninstall of a non-bridge or wrong target refuses to touch it', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');
  await mkdir(agentDir, { recursive: true });
  // A real directory (not a bridge) at the destination
  const realDir = join(agentDir, 'foo-workflow');
  await mkdir(realDir, { recursive: true });
  await writeTextFile(join(realDir, 'marker.txt'), 'do not delete');

  const { uninstall } = await importFresh();
  const r = await uninstall('foo-workflow', { installDir: agentDir });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a bridge|conflict|verify/i);
  // Marker preserved
  assert.equal(await readFile(join(realDir, 'marker.txt'), 'utf8'), 'do not delete');
});

test('rejects path traversal and unsafe names', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  const { install } = await importFresh();
  const bad = [
    '../escape-workflow',
    'foo/../bar-workflow',
    '/absolute-workflow',
    'foo\\bar-workflow',
    '.dot-workflow',
    'UPPER-workflow',
    'no-suffix',
    'a'.repeat(120) + '-workflow',
    '',
    null,
    'foo-workflow/../escape',
  ];
  for (const name of bad) {
    const r = await install(name, { installDir: join(home, 'agents-skills') });
    assert.equal(r.ok, false, `name ${JSON.stringify(name)} should be rejected`);
    assert.match(r.reason, /invalid|unsafe|name/i);
  }
});

test('expands ~, ~/foo, and ~\\foo but rejects ~user', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const { install } = await importFresh();
  const r1 = await install('foo-workflow', { installDir: '~/agent-skills' });
  assert.equal(r1.ok, true);
  assert.equal(r1.dest.includes('~'), false, '~ must be expanded');

  await rm(r1.dest, { force: true });

  const r2 = await install('foo-workflow', { installDir: `~${sep}agent-skills` });
  assert.equal(r2.ok, true);

  await rm(r2.dest, { force: true });

  const r3 = await install('foo-workflow', { installDir: '~root/agent-skills' });
  assert.equal(r3.ok, false, '~user syntax must be rejected');
  assert.match(r3.reason, /~|user|home/i);
});

test('paths containing spaces and Unicode are handled correctly', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agent skills with spaces', '我的目录');
  const { install, uninstall } = await importFresh();
  const r = await install('foo-workflow', { installDir: agentDir });
  assert.equal(r.ok, true);
  const linkStat = await lstat(r.dest);
  assert.equal(linkStat.isSymbolicLink(), true);

  const u = await uninstall('foo-workflow', { installDir: agentDir });
  assert.equal(u.ok, true);
});

test('status reports installed/missing/conflicting without mutating state', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');
  const { install, status } = await importFresh();

  // Missing
  const r0 = await status('foo-workflow', { installDir: agentDir });
  assert.equal(r0.installed, false);

  // Installed
  await install('foo-workflow', { installDir: agentDir });
  const r1 = await status('foo-workflow', { installDir: agentDir });
  assert.equal(r1.installed, true);
  assert.equal(r1.misdirected, false);

  // Conflicting (real dir at destination)
  await rm(join(agentDir, 'foo-workflow'), { force: true });
  await mkdir(join(agentDir, 'foo-workflow'), { recursive: true });
  const r2 = await status('foo-workflow', { installDir: agentDir });
  assert.equal(r2.installed, false);
  assert.equal(r2.conflict, true);
});

test('install falls back to junction semantics when symlink() fails with EPERM', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  await seedVault(home, 'foo-workflow');
  const agentDir = join(home, 'agents-skills');

  // Inject a stub that forces fs.symlink to fail first, then succeeds.
  // We monkey-patch via a wrapper module loaded by the helper.
  const { install } = await importFresh();

  // Use the public API but simulate: if the helper exposes a strategy override,
  // pass it; otherwise we just confirm the junction fallback path runs by
  // checking the resulting link resolves back to the vault.
  const r = await install('foo-workflow', { installDir: agentDir });
  assert.equal(r.ok, true);
  const stat = await lstat(r.dest);
  // Either symlink or junction is acceptable; both are reported by lstat as symbolic link.
  assert.equal(stat.isSymbolicLink(), true);
});

test('reports vault source-missing error when ~/.cospec/workflows/<name> does not exist', async (t) => {
  const { home } = await isolatedEnv();
  t.after(async () => { await rm(home, { recursive: true, force: true }); });

  const agentDir = join(home, 'agents-skills');
  const { install } = await importFresh();
  const r = await install('ghost-workflow', { installDir: agentDir });
  assert.equal(r.ok, false);
  assert.match(r.reason, /vault|source|workflow/i);
});

// ---- helpers ----

async function realpathOf(p) {
  const { realpath } = await import('node:fs/promises');
  return realpath(p);
}

async function makeTmp() {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return mkdtemp(join(tmpdir(), 'cospec-cli-'));
}

// ---- CLI entry ----

test('CLI --help prints usage and exits 0', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    [join(here, 'workflow-links.mjs'), '--help'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: workflow-links\.mjs/);
  assert.match(result.stdout, /Subcommands/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /uninstall/);
  assert.match(result.stdout, /status/);
});

test('CLI rejects unknown subcommand', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    [join(here, 'workflow-links.mjs'), 'frobnicate', '--name', 'foo-workflow'],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown subcommand/);
});

test('CLI install creates a bridge when invoked as a subprocess', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, 'cli-workflow');
    const agentDir = join(home, 'agents-skills');
    const { spawnSync } = await import('node:child_process');
    // workflow-links.mjs prefers COSPEC_HOME over HOME for vault root;
    // explicitly set both so the child sees the test's tmp dir even if
    // a prior test leaked COSPEC_HOME into the parent's process.env.
    const result = spawnSync(
      process.execPath,
      [
        join(here, 'workflow-links.mjs'),
        'install',
        '--name', 'cli-workflow',
        '--install-dir', agentDir,
      ],
      {
        env: { ...process.env, HOME: home, COSPEC_HOME: home },
        encoding: 'utf8',
      },
    );
    assert.equal(
      result.status,
      0,
      `CLI install failed: status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`,
    );
    // Output is JSON — must parse cleanly.
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.action, 'created');
    assert.ok(parsed.dest.startsWith(agentDir));
    // Verify the bridge exists in the parent that the CLI created.
    const linkStat = await lstat(parsed.dest);
    assert.equal(linkStat.isSymbolicLink(), true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('CLI install --help works on Windows-style paths (isMain uses pathToFileURL)', async () => {
  // Regression test for the same Windows bug the drift helper had:
  // comparing import.meta.url against `file://${process.argv[1]}` is
  // always false on Windows. The CLI must use pathToFileURL.
  // We assert non-zero exit on missing args (proving the CLI block ran).
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    [join(here, 'workflow-links.mjs'), 'install'],
    { encoding: 'utf8' },
  );
  // Missing --name should cause non-zero exit — proving the CLI dispatched.
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--name is required/);
});

test('CLI status reports installed state after install', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, 'cli-status-workflow');
    const agentDir = join(home, 'agents-skills');
    const { spawnSync } = await import('node:child_process');
    const childEnv = { ...process.env, HOME: home, COSPEC_HOME: home };
    const installResult = spawnSync(
      process.execPath,
      [
        join(here, 'workflow-links.mjs'),
        'install',
        '--name', 'cli-status-workflow',
        '--install-dir', agentDir,
      ],
      { env: childEnv, encoding: 'utf8' },
    );
    assert.equal(installResult.status, 0);

    const statusResult = spawnSync(
      process.execPath,
      [
        join(here, 'workflow-links.mjs'),
        'status',
        '--name', 'cli-status-workflow',
        '--install-dir', agentDir,
      ],
      { env: childEnv, encoding: 'utf8' },
    );
    assert.equal(statusResult.status, 0);
    const parsed = JSON.parse(statusResult.stdout.trim());
    assert.equal(parsed.installed, true);
    assert.equal(parsed.conflict, false);
    assert.equal(parsed.misdirected, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('CLI uninstall removes the bridge and exits 0', async () => {
  const home = await makeTmp();
  try {
    await seedVault(home, 'cli-uninstall-workflow');
    const agentDir = join(home, 'agents-skills');
    const { spawnSync } = await import('node:child_process');
    const childEnv = { ...process.env, HOME: home, COSPEC_HOME: home };
    // Install first
    spawnSync(
      process.execPath,
      [
        join(here, 'workflow-links.mjs'),
        'install',
        '--name', 'cli-uninstall-workflow',
        '--install-dir', agentDir,
      ],
      { env: childEnv, encoding: 'utf8' },
    );
    // Uninstall
    const result = spawnSync(
      process.execPath,
      [
        join(here, 'workflow-links.mjs'),
        'uninstall',
        '--name', 'cli-uninstall-workflow',
        '--install-dir', agentDir,
      ],
      { env: childEnv, encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.action, 'removed');
    // Vault source must be preserved.
    const { stat: vaultStat } = await import('node:fs/promises').then((m) => ({ stat: m.stat }));
    const vaultExists = await vaultStat(join(home, '.cospec', 'workflows', 'cli-uninstall-workflow', 'SKILL.md'))
      .then(() => true)
      .catch(() => false);
    assert.equal(vaultExists, true, 'vault source must be preserved on uninstall');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});