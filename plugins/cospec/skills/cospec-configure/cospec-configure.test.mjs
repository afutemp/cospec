// Tests for skills/cospec-configure/SKILL.md custom-workflow contracts.
//
// Run: node --test plugins/cospec/skills/cospec-configure/cospec-configure.test.mjs
//
// Static contract tests; mirrors brainstorming/scaffold tests style.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = join(here, 'SKILL.md');

async function read() {
  return readFile(skillPath, 'utf8');
}

test('cospec-configure/SKILL.md has a workflows category with install / uninstall / sync', async () => {
  const skill = await read();
  assert.match(skill, /workflows/, 'must mention workflows category');
  assert.match(skill, /install/, 'must expose install action');
  assert.match(skill, /uninstall/, 'must expose uninstall action');
  assert.match(skill, /sync|sync\/reconcile|reconcile/, 'must expose sync/reconcile action');
});

test('cospec-configure/SKILL.md keeps workflow.options as a flat string array', async () => {
  const skill = await read();
  // The description or docs must call workflow.options a "flat string array"
  // or "扁平字符串数组" and explicitly forbid registry objects / per-option flags.
  const isFlat =
    /workflow\.options[^.\n]*flat[^.\n]*string|workflow\.options[^.\n]*扁平|workflow\.options[^.\n]*string\s*array/i.test(
      skill,
    );
  assert.ok(isFlat, 'must describe workflow.options as a flat string array');
  // Must NOT introduce builtin/enabled/label fields per option.
  assert.doesNotMatch(
    skill,
    /builtin\s*:\s*true/,
    'must not introduce a builtin flag per option',
  );
});

test('cospec-configure/SKILL.md documents workflow.install-dirs as optional override', async () => {
  const skill = await read();
  assert.match(skill, /workflow\.install-dirs/, 'must reference the install-dirs field');
  // Should describe it as optional / 覆盖 / override.
  assert.match(
    skill,
    /(optional|可选|覆盖|override)/i,
    'must describe install-dirs as optional override',
  );
});

test('cospec-configure/SKILL.md enforces workflow.default must be in workflow.options', async () => {
  const skill = await read();
  // The constraint should be stated somewhere in the skill.
  const enforces =
    /workflow\.default[^.\n]*(workflow\.options|members|成员|必须 in)/i.test(skill) ||
    /workflow\.options[^.\n]*workflow\.default/i.test(skill);
  assert.ok(enforces, 'must state workflow.default must remain a member of workflow.options');
});

test('cospec-configure/SKILL.md preserves the one-time .bak backup rule', async () => {
  const skill = await read();
  // Must NOT overwrite an existing .bak. Look for explicit "不得覆盖"/"不覆盖"
  // near a "bak" mention, or the rule that .bak is created only when absent.
  const preserved =
    /\bbak\b[^.\n]*不存在|不存在时|首次写入|if one does not already exist/i.test(skill) ||
    /(?:不得|不)?覆盖[^.\n]*\bbak\b|\bbak\b[^.\n]*(?:不得|不)?覆盖/i.test(skill) ||
    /do not overwrite backup/i.test(skill);
  assert.ok(preserved, 'must preserve the one-time .bak rule (do not overwrite existing backup)');
});

test('cospec-configure/SKILL.md routes all bridge operations through scripts/workflow-links.mjs', async () => {
  const skill = await read();
  assert.match(
    skill,
    /workflow-links|scripts\/workflow-links\.mjs/,
    'must reference the shared link helper',
  );
});

test('cospec-configure/SKILL.md forbids copying workflow directories to agent dirs', async () => {
  const skill = await read();
  const imperativeCopy = /(?:^|\n)\s*(?:请用|使用|用|run|use|执行)\s+(?:cp\s+-r|cp\s+-a|\brsync\b|\bxcopy\b)/m;
  assert.doesNotMatch(
    skill,
    imperativeCopy,
    'must not instruct the agent to copy workflow directories',
  );
});

test('cospec-configure/SKILL.md never deletes the vault when removing a bridge', async () => {
  const skill = await read();
  assert.match(
    skill,
    /vault[^.\n]*(保留|不动|preserve|survive|never delete)/i,
    'must state the vault is preserved on uninstall',
  );
});

test('cospec-configure/SKILL.md extension principle acknowledges custom workflows', async () => {
  const skill = await read();
  // Extension Principle should no longer claim "core workflow skills cannot be overridden" entirely —
  // it should allow additional workflow entries via workflow.options.
  assert.match(
    skill,
    /(额外|additional|custom|registry|workflow\.options)[^.\n]*(入口|entry|注册|register)/i,
    'extension principle must mention additional workflow entries are registrable',
  );
});

test('cospec-configure/SKILL.md surfaces vault drift on Step 1 (fallback path)', async () => {
  // The SessionStart hook fires automatically, but agents don't always
  // surface embedded <system-reminder> drift hints. So cospec-configure
  // also runs the drift detector on Step 1 — guaranteeing the user sees
  // drift status when they explicitly invoke the configure skill.
  const skill = await read();
  assert.match(
    skill,
    /check-vault-drift\.mjs/,
    'Step 1 must invoke the drift detector helper',
  );
  assert.match(
    skill,
    /Surface the result|drift/,
    'Step 1 must surface drift status to the user',
  );
});

test('cospec-configure workflows category offers a delete action', async () => {
  const skill = await read();
  assert.match(
    skill,
    /\*\*delete\*\*[^\n]*彻底删除|delete[^\n]*不可逆/,
    'must document the delete action with irreversibility warning',
  );
});

test('cospec-configure delete requires double confirmation', async () => {
  const skill = await read();
  // Must require explicit `YES` (uppercase) or re-typed name as second
  // confirmation. Lowercase `yes`, `y`, `ok` must NOT be accepted.
  assert.match(
    skill,
    /YES.*全大写|精确.*工作流名.*二次确认/,
    'must require uppercase YES or re-typed name as second confirmation',
  );
  assert.match(
    skill,
    /不[^\n]*接受.*其它|其它[^\n]*不[^\n]*接受/,
    'must explicitly reject other inputs (lowercase yes, y, ok)',
  );
});

test('cospec-configure delete uses workflow-links.mjs CLI for bridge removal', async () => {
  const skill = await read();
  // Delete must route through the existing CLI helper, not invent its
  // own bridge-deletion mechanism.
  assert.match(
    skill,
    /workflow-links\.mjs uninstall/,
    'delete must invoke workflow-links.mjs uninstall',
  );
  // And must include the rm -rf vault step.
  assert.match(skill, /rm -rf[^\n]*workflows/);
});

test('cospec-configure delete preserves cospec.config.json.bak', async () => {
  const skill = await read();
  assert.match(
    skill,
    /\.bak[^\n]*保留|\.bak[^\n]*不[^\n]*删/,
    'delete must explicitly preserve .bak (not delete it)',
  );
});

test('cospec-configure delete runs drift detector for final verification', async () => {
  const skill = await read();
  assert.match(
    skill,
    /drift[^\n]*验证|check-vault-drift\.mjs/,
    'delete must run drift check after teardown to confirm clean state',
  );
});