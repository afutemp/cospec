'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }

test('all six user skills have frontmatter and core is not triggerable', () => {
  const skills = ['product-kb','product-kb-init','product-kb-update','product-kb-eval','product-kb-optimize','product-kb-query'];
  for (const skill of skills) {
    const content = read(`${skill}/SKILL.md`);
    assert.match(content, /^---\nname: /);
    assert.match(content, /description:/);
  }
  assert.equal(fs.existsSync(path.join(root, 'product-kb-core', 'SKILL.md')), false);
});

test('update and optimize have separate confirmation gates', () => {
  assert.match(read('product-kb-update/SKILL.md'), /等待用户明确确认/);
  assert.match(read('product-kb-optimize/SKILL.md'), /等待用户确认/);
  assert.match(read('product-kb/SKILL.md'), /分别确认/);
});

test('dispatcher covers lifecycle routing states', () => {
  const content = read('product-kb/SKILL.md');
  for (const target of ['product-kb-init','product-kb-update','product-kb-eval','product-kb-optimize','product-kb-query']) assert.match(content, new RegExp(target));
  assert.match(content, /未受管/);
  assert.match(content, /已受管/);
});
