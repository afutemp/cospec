import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillPath = new URL('./SKILL.md', import.meta.url);

test('places the optional Demo gate after TR1 and before TR2', async () => {
  const skill = await readFile(skillPath, 'utf8');

  const tr1Row = skill.indexOf('| step4 | `Skill("tr1-requirements-spec")` |');
  const demoRow = skill.indexOf('| TR1 后可选 | 用户确认后调用 `Skill("generate-demo")` |');
  const tr2Row = skill.indexOf('| step5 | `Skill("tr2-epic-creator")` |');

  assert.ok(tr1Row >= 0, 'TR1 step must be declared');
  assert.ok(demoRow > tr1Row, 'Demo gate must follow TR1');
  assert.ok(tr2Row > demoRow, 'TR2 must follow the Demo gate');
  assert.match(skill, /是否使用本次 TR1 产物生成 Demo？/);
  assert.match(skill, /是否继续进入 step5 生成 TR2？/);
  assert.match(skill, /禁止等到 TR2 完成后才首次询问是否生成 Demo/);
});
