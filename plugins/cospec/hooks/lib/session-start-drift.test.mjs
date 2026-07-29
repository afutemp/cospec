// Tests for hooks/session-start's JSON output format and drift injection.
//
// Verifies that session-start produces valid JSON containing the drift
// hint when drift exists (or a clean status when not).
//
// Run: node --test plugins/cospec/hooks/lib/session-start-drift.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const sessionStart = join(here, '..', 'session-start');

async function makeFixture() {
  const home = await mkdtemp(join(tmpdir(), 'cospec-session-'));
  const pluginRoot = join(home, 'plugin');
  await mkdir(pluginRoot, { recursive: true });
  // Seed a vault workflow so detectDrift reports drift.
  const vaultDir = join(home, '.cospec', 'workflows', 'quick-tr1-workflow');
  await mkdir(vaultDir, { recursive: true });
  await writeFile(join(vaultDir, 'SKILL.md'), '# quick-tr1-workflow\n');
  // Empty config → vault workflow is unregistered.
  await writeFile(join(pluginRoot, 'cospec.config.json'), '{}');
  return { home, pluginRoot };
}

test('session-start output is valid JSON containing the drift hint', async () => {
  const { home, pluginRoot } = await makeFixture();
  try {
    const result = spawnSync('bash', [sessionStart], {
      env: {
        ...process.env,
        HOME: home,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `session-start failed: ${result.stderr}`);

    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (err) {
      assert.fail(`session-start output is not valid JSON: ${err.message}\nstdout:\n${result.stdout}`);
    }

    const ctx = parsed.hookSpecificOutput?.additionalContext ?? parsed.additionalContext ?? '';
    assert.match(ctx, /vault 含 \d+ 个工作流/);
    assert.match(ctx, /quick-tr1-workflow/);
    assert.match(ctx, /5\.5 sync/);
    assert.match(ctx, /<system-reminder priority="high">/);
    assert.match(ctx, /<\/system-reminder>/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('session-start with no vault still produces valid JSON and clean status', async () => {
  const home = await mkdtemp(join(tmpdir(), 'cospec-session-'));
  try {
    const pluginRoot = join(home, 'plugin');
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(join(pluginRoot, 'cospec.config.json'), '{}');

    const result = spawnSync('bash', [sessionStart], {
      env: {
        ...process.env,
        HOME: home,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (err) {
      assert.fail(`output not valid JSON: ${err.message}\n${result.stdout}`);
    }
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? parsed.additionalContext ?? '';
    assert.match(ctx, /vault 为空/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});