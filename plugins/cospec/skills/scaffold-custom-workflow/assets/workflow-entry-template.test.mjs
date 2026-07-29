// Tests for assets/workflow-entry-template.md (composer template).
//
// Run: node --test plugins/cospec/skills/scaffold-custom-workflow/assets/workflow-entry-template.test.mjs
//
// Asserts that the template is a valid composer skeleton:
//   - generator placeholders that the composer substitutes in Phase 6
//   - hard invariants that the composer never overrides (HARD-GATE, 红线, etc.)
//   - no legacy per-step placeholders that the user used to fill in manually

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, 'workflow-entry-template.md');

async function read() {
  return readFile(templatePath, 'utf8');
}

test('template file exists', () => {
  assert.ok(existsSync(templatePath), 'workflow-entry-template.md must exist');
});

test('template has frontmatter with placeholders', async () => {
  const tpl = await read();
  const m = tpl.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, 'template must have frontmatter block');
  const body = m[1];
  assert.match(body, /name:\s*\{\{NAME\}\}/, 'frontmatter name placeholder must be {{NAME}}');
  assert.match(body, /description:\s*\{\{TRIGGER\}\}/, 'frontmatter description placeholder must be {{TRIGGER}}');
});

test('template declares generator placeholders for step table and flow lines', async () => {
  const tpl = await read();
  assert.match(tpl, /\{\{STEP_TABLE_ROWS\}\}/, 'must have {{STEP_TABLE_ROWS}} generator slot');
  assert.match(tpl, /\{\{STEP_FLOW_LINES\}\}/, 'must have {{STEP_FLOW_LINES}} generator slot');
});

test('template does NOT contain legacy per-step placeholders', async () => {
  const tpl = await read();
  assert.doesNotMatch(tpl, /<child-skill-\d+>/, 'no <child-skill-N> legacy placeholder');
  assert.doesNotMatch(tpl, /<STEP_\d+_DESCRIPTION>/, 'no <STEP_N_DESCRIPTION> legacy placeholder');
  assert.doesNotMatch(tpl, /<TRIGGER_CONDITION>/, 'no <TRIGGER_CONDITION> legacy placeholder');
  assert.doesNotMatch(tpl, /<WORKFLOW_NAME>/, 'no <WORKFLOW_NAME> legacy placeholder');
  assert.doesNotMatch(tpl, /<WORKFLOW_DISPLAY_NAME>/, 'no <WORKFLOW_DISPLAY_NAME> legacy placeholder');
  assert.doesNotMatch(tpl, /<ONE_LINE_PURPOSE>/, 'no <ONE_LINE_PURPOSE> legacy placeholder');
});

test('template preserves hard invariants (HARD-GATE, Skill 标识, 红线, 串行禁止并行)', async () => {
  const tpl = await read();
  assert.match(tpl, /<HARD-GATE>[\s\S]*?<\/HARD-GATE>/, 'must keep HARD-GATE block');
  assert.match(tpl, /Skill 标识/, 'must keep Skill 标识 placeholder/text');
  assert.match(tpl, /红线/, 'must keep 红线 section');
  assert.match(tpl, /禁止并行|串行/, 'must keep serial-execution rule');
});

test('template references the cospec.config.json extension points', async () => {
  const tpl = await read();
  assert.match(tpl, /cospec\.config\.json/, 'must reference cospec.config.json');
  assert.match(tpl, /workflow\.options/, 'must mention workflow.options extension point');
  assert.match(tpl, /workflow\.install-dirs/, 'must mention workflow.install-dirs extension point');
});

test('template does NOT have a per-step gate column (all steps wait by default)', async () => {
  const tpl = await read();
  // v1.0.21 simplification: removed the "完成后等待用户确认？" column.
  // Every step waits for user confirmation by default — this is cospec's
  // universal convention, not a per-step toggle. Use \? to specifically
  // match the column header (with question mark), not the universal rule.
  assert.doesNotMatch(
    tpl,
    /完成后等待用户确认\?|完成后是否需要确认|per-step.*gate/i,
    'template must not have a per-step gate column',
  );
  // Universal HARD-GATE rule must still be present.
  assert.match(
    tpl,
    /每个 step 跑完后必须停下来让用户确认产物/,
    'template must state the universal wait-for-confirmation rule',
  );
});