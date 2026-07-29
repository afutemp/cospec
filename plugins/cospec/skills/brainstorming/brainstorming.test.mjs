// Tests for skills/brainstorming/SKILL.md dynamic-routing invariants.
//
// Run: node --test plugins/cospec/skills/brainstorming/brainstorming.test.mjs
//
// Invariants verified:
//   - Workflow options come from cospec.config.json's workflow.options
//   - Each option's explanation comes from its SKILL.md frontmatter description
//   - HARD-GATE before any dispatch (user must explicitly select)
//   - Skill("cospec-preflight") runs after the user's explicit selection
//   - "是否继续进入工作流？" stop happens after preflight, before dispatch
//   - The literal two-choice prompt is no longer the routing contract
//   - workflow.default never authorises automatic dispatch
//   - Unknown / missing options are reported, not silently skipped

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = new URL('./SKILL.md', import.meta.url);
const configPath = join(here, '..', '..', 'cospec.config.json');

async function read() {
  return readFile(skillPath, 'utf8');
}

async function readConfig() {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

test('brainstorming reads workflow.options from cospec.config.json', async () => {
  const skill = await read();
  const cfg = await readConfig();
  assert.ok(Array.isArray(cfg.workflow?.options), 'workflow.options must exist in config');
  assert.ok(cfg.workflow.options.length >= 2, 'options should include the two bundled entries');

  // SKILL.md must reference workflow.options
  assert.match(
    skill,
    /workflow\.options/,
    'brainstorming must read workflow.options from config',
  );
});

test('each option menu explanation comes from its SKILL.md frontmatter description', async () => {
  const skill = await read();
  assert.match(
    skill,
    /frontmatter|description/,
    'skill must describe reading explanations from frontmatter description',
  );
  // Should NOT mention per-option label/description config fields
  assert.doesNotMatch(
    skill,
    /workflow\.options\[\d+\]\.label|workflow\.options\[\d+\]\.description|options\[i\]\.label/,
    'must not introduce per-option label/description config fields',
  );
});

test('HARD-GATE: brainstorming never dispatches before explicit user selection', async () => {
  const skill = await read();
  assert.match(skill, /HARD-GATE/i);
  // The HARD-GATE block must forbid pre-selection dispatch.
  const gateBlock = skill.match(/<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/);
  assert.ok(gateBlock, 'must declare a HARD-GATE block');
  assert.match(
    gateBlock[1],
    /禁止|不得|must not|禁止.*派发|禁止.*调用/i,
    'HARD-GATE must forbid dispatch before explicit selection',
  );
});

test('routing order: drift check → explicit selection → preflight (all-pass auto-dispatch, fail-paths ask)', async () => {
  const skill = await read();
  const drift = skill.indexOf('check-vault-drift.mjs');
  // Use the actual selection prompt ("请选择") to anchor ordering,
  // not the early "选择" mention in the description.
  const select = skill.indexOf('请选择');
  const preflight = skill.indexOf('Skill("cospec-preflight")');
  const dispatch = skill.search(/Skill\("<\w+-workflow>"\)|Skill\("<selected>"\)|Skill\("<\w+>"\)/);

  assert.ok(drift >= 0, 'must run drift detection before showing the menu');
  assert.ok(select >= 0, 'must ask user to select');
  assert.ok(
    drift < select,
    'drift check must come before asking user to select',
  );
  assert.ok(preflight > select, 'cospec-preflight must run after user selection');
  assert.ok(
    dispatch === -1 || dispatch > preflight,
    'dispatch (Skill()) must come after preflight',
  );
});

test('brainstorming surfaces drift warning above the menu', async () => {
  const skill = await read();
  // Must explain all three drift outcomes (⚠️ has drift, ✅ clean).
  assert.match(skill, /⚠️/, 'must include the drift-detected marker');
  assert.match(skill, /✅/, 'must include the clean-status marker');
  // Drift warning should be displayed ABOVE the menu (before "请选择").
  const driftIdx = skill.indexOf('check-vault-drift.mjs');
  const menuIdx = skill.indexOf('请选择');
  assert.ok(
    driftIdx >= 0 && menuIdx > driftIdx,
    'drift check instruction must come before the user-selection prompt',
  );
});

test('preflight is conditionally blocking (all-pass → no stop; any fail → ask before dispatch)', async () => {
  const skill = await read();
  // Must explicitly state the conditional rule.
  assert.match(
    skill,
    /(条件|conditional).*(阻塞|block|停|stop)|全通.*不询问|全通.*直接|不阻塞/i,
    'must describe preflight as conditionally blocking (not unconditional stop)',
  );
  // Must NOT contain the unconditional-stop pattern.
  assert.doesNotMatch(
    skill,
    /无论体检是否全通|不管.*全通.*都要停下/,
    'must not unconditionally stop after preflight regardless of all-pass',
  );
  // The failure-path question is still mentioned for the any-fail case.
  assert.match(
    skill,
    /是否继续|部分依赖不通/,
    'failure-path must still surface a confirmation prompt',
  );
});

test('the literal two-choice prompt is no longer the routing contract', async () => {
  const skill = await read();
  // The old hardcoded phrase must be gone — brainstorming now reads from config.
  assert.doesNotMatch(
    skill,
    /请选择：大需求 还是 小需求/,
    'must not hardcode the two-choice phrase; menu is generated from workflow.options',
  );
});

test('workflow.default never authorises automatic routing', async () => {
  const skill = await read();
  assert.match(
    skill,
    /workflow\.default[^.\n]*(不能|不得|never|cannot|不允许)/i,
    'skill must state that workflow.default never bypasses explicit user selection',
  );
});

test('unknown / missing options are reported, not silently dispatched', async () => {
  const skill = await read();
  assert.match(
    skill,
    /(无效|invalid|missing|not installed|未安装)/i,
    'skill must handle invalid / not-installed options gracefully',
  );
});

test('cospec-preflight is referenced by name as a sibling skill', async () => {
  const skill = await read();
  assert.match(skill, /Skill\("cospec-preflight"\)/);
});