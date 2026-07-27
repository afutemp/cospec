import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const skillPath = new URL('./SKILL.md', import.meta.url);

// Guards the cospec-preflight integration: after the user confirms which
// workflow, brainstorming must probe dependencies (non-blocking) before
// dispatching. Mirrors large-requirement-workflow.test.mjs's text-assertion
// style — a cheap regression guard on prompt content.

test('cospec-preflight runs after routing, then stops for user confirmation before dispatching', async () => {
  const skill = await readFile(skillPath, 'utf8');
  const ask = skill.indexOf('请选择：大需求 还是 小需求');
  const preflight = skill.indexOf('Skill("cospec-preflight")');
  const confirm = skill.indexOf('是否继续进入工作流？');
  assert.ok(ask >= 0, 'routing ask must exist');
  assert.ok(preflight > ask, 'cospec-preflight must be invoked after the routing ask');
  assert.ok(confirm > preflight, 'must stop and ask user to confirm after preflight, before dispatching');
  assert.match(skill, /不阻塞/, 'preflight must remain non-blocking (does not force-stop)');
});
