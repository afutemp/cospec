// Tests for skills/scaffold-custom-workflow/SKILL.md (composer mode).
//
// Run: node --test plugins/cospec/skills/scaffold-custom-workflow/scaffold-custom-workflow.test.mjs
//
// Composer-mode contract:
//   - 3-question interview (name / trigger / optional postprocess) — not 5
//   - discovers 13 built-in leaf skills by scanning plugins/cospec/skills/
//   - excludes workflow entries (-workflow suffix), meta allowlist, product-kb-*
//   - step-by-step selection with "0" to end, already-picked removed
//   - unified HARD-GATE collection after skill selection
//   - composer auto-generates SKILL.md (user does not write markdown)
//   - retains Iron Law, vault, link helper, .bak, restart hint invariants

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = join(here, 'SKILL.md');
const assetsPath = join(here, 'assets');
const templatePath = join(assetsPath, 'workflow-entry-template.md');

async function read(p) {
  return readFile(p, 'utf8');
}

test('SKILL.md has valid frontmatter with name and description', async () => {
  const skill = await read(skillPath);
  const m = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, 'frontmatter is required');
  const body = m[1];
  assert.match(body, /name:\s*scaffold-custom-workflow\b/);
  assert.match(body, /description:\s*.+/);
});

test('SKILL.md includes the Skill 标识 block right after H1', async () => {
  const skill = await read(skillPath);
  const h1 = skill.search(/^# .+/m);
  assert.ok(h1 >= 0, 'must have an H1');
  const after = skill.slice(h1, h1 + 400);
  assert.match(after, /Skill 标识/);
  assert.match(after, /scaffold-custom-workflow/);
});

test('SKILL.md enforces the Iron Law (RED before SKILL.md)', async () => {
  const skill = await read(skillPath);
  assert.match(skill, /HARD-GATE/i, 'must declare a HARD-GATE block');
  assert.match(
    skill,
    /NO SKILL WITHOUT A FAILING TEST FIRST|failing test first|RED.*GREEN/i,
    'must restate the Iron Law',
  );
  const orderOk =
    /失败测试/.test(skill) ||
    /failing test/.test(skill) ||
    /RED/i.test(skill);
  assert.ok(orderOk, 'skill must describe the failing-test-first ordering');
});

test('SKILL.md references the vault location ~/.cospec/workflows', async () => {
  const skill = await read(skillPath);
  assert.match(skill, /~\/\.cospec\/workflows|\.cospec\/workflows/, 'must reference vault path');
});

test('SKILL.md routes installation through scripts/workflow-links.mjs (no copy)', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /workflow-links|scripts\/workflow-links\.mjs/,
    'must reference the shared link helper',
  );
  const imperativeCopy = /(?:^|\n)\s*(?:请用|使用|用|run|use|执行)\s+(?:cp\s+-r|cp\s+-a|\brsync\b|\bxcopy\b)/m;
  assert.doesNotMatch(
    skill,
    imperativeCopy,
    'must not instruct the agent to copy the workflow into an agent directory',
  );
});

test('SKILL.md registers the workflow in cospec.config.json only after successful install', async () => {
  const skill = await read(skillPath);
  const hasOrdering =
    /(workflow\.options|options\s*数组).*(安装|install|成功后|after|then)/is.test(skill) ||
    /(安装|install).*(workflow\.options|options\s*数组)/is.test(skill);
  assert.ok(
    hasOrdering,
    'skill must specify that workflow.options is updated only after the bridge succeeds',
  );
});

test('workflow-entry-template.md exists and uses generator placeholders', async () => {
  assert.ok(existsSync(templatePath), `template not found: ${templatePath}`);
  const tpl = await read(templatePath);
  assert.match(tpl, /\{\{NAME\}\}/, 'template must have {{NAME}} generator placeholder');
  assert.match(
    tpl,
    /\{\{STEP_TABLE_ROWS\}\}/,
    'template must have {{STEP_TABLE_ROWS}} generator placeholder',
  );
  assert.match(
    tpl,
    /\{\{STEP_FLOW_LINES\}\}/,
    'template must have {{STEP_FLOW_LINES}} generator placeholder',
  );
  assert.match(tpl, /HARD-GATE/, 'template must include HARD-GATE block');
  assert.match(tpl, /Skill 标识/, 'template must include Skill 标识 block');
  // Template should NOT contain the old per-step placeholders anymore.
  assert.doesNotMatch(
    tpl,
    /<child-skill-\d+>|<STEP_\d+_DESCRIPTION>/,
    'template must drop the legacy per-step placeholders (replaced by generator placeholders)',
  );
});

test('scaffold-custom-workflow directory exposes assets/ folder for the template', async () => {
  const entries = await readdir(here);
  assert.ok(entries.includes('assets'), 'assets/ folder must exist');
  assert.ok(existsSync(templatePath), 'workflow-entry-template.md must exist under assets/');
});

test('SKILL.md does not hardcode Claude, Codex, or a specific install path', async () => {
  const skill = await read(skillPath);
  const hardcodedPaths = [
    /ln -s.*~?\/?\.claude\/skills/i,
    /ln -s.*~?\/?\.agents\/skills/i,
    /cp\s+-r.*~?\/?\.claude\/skills/i,
    /cp\s+-r.*~?\/?\.agents\/skills/i,
  ];
  for (const pat of hardcodedPaths) {
    assert.doesNotMatch(skill, pat, `must not hardcode agent path: ${pat}`);
  }
});

test('SKILL.md preserves cospec.config.json.bak behavior (do not overwrite backup)', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /\.bak|backup|备份/,
    'skill must acknowledge the existing one-time .bak rule',
  );
});

test('SKILL.md instructs the agent to refresh after install (restart / new session)', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /重启|restart|新会话|new session|restart/i,
    'must inform the user that some agents only discover skills at startup',
  );
});

// ---- composer-mode contract (v1.0.21) ----

test('SKILL.md composer interview asks 3 questions (not 5)', async () => {
  const skill = await read(skillPath);
  // Must mention name + trigger + optional postprocess as the 3 things the composer gathers.
  assert.match(skill, /工作流名|name.*kebab-case/i);
  assert.match(skill, /触发场景|trigger/i);
  assert.match(skill, /可选后处理|optional.*postprocess|post-process/i);
  // Must NOT prompt the user to type leaf skill names — that was the v1.0.20 model.
  const legacyManualStepHint = /追问.*串行步骤|列出.*leaf.*skill.*名字|user.*list.*skills/i;
  assert.doesNotMatch(
    skill,
    legacyManualStepHint,
    'composer must not ask the user to type leaf skill names manually',
  );
});

test('SKILL.md describes automatic leaf-skill discovery by scanning plugins/cospec/skills/', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /plugins\/cospec\/skills|扫描.*skills\/.*SKILL\.md|scan.*skills\//,
    'must describe scanning plugins/cospec/skills/ for leaf pool',
  );
});

test('SKILL.md explicitly excludes workflow entries from the leaf pool', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /-workflow\s*后缀|workflow\s*entry|\bworkflow entry\b/i,
    'must explain the -workflow suffix exclusion rule',
  );
  // Must NOT offer large/small as selectable steps.
  assert.match(
    skill,
    /(排除|exclud)[^\n]*(large-requirement-workflow|small-requirement-workflow)/i,
    'must explicitly exclude the bundled workflow entries from selection',
  );
});

test('SKILL.md excludes meta skills and product-kb cluster from the leaf pool', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /brainstorming|cospec-preflight|writing-skills/,
    'must mention at least some meta skills that are excluded',
  );
  assert.match(
    skill,
    /product-kb/,
    'must mention product-kb cluster exclusion',
  );
});

test('SKILL.md describes step-by-step selection with "0" to end', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /step\s*\d+|step\s*N/i,
    'must describe step-by-step selection (step1, step2, ...)',
  );
  assert.match(
    skill,
    /\b0\b[^.\n]*结束|结束[^.\n]*\b0\b|输入\s*0|end[^.\n]*0/i,
    'must describe entering 0 to end the selection',
  );
  // Must describe removing already-picked skills from later rounds.
  assert.match(
    skill,
    /(移除|剔除|去掉).*(已选|已选过|已选择)|(已选|已选过|已选择).*(移除|剔除|去掉)/i,
    'must remove already-picked skills from later step menus',
  );
});

test('SKILL.md does NOT ask per-step gate question (all steps wait by default)', async () => {
  const skill = await read(skillPath);
  // Per-step gate question was removed (v1.0.21 simplification): all steps
  // default to waiting for user confirmation, matching cospec's existing
  // convention in large-requirement-workflow / small-requirement-workflow.
  assert.doesNotMatch(
    skill,
    /(哪些 step|哪些step).*(必须.*确认|需要.*gate|gate.*收集|gate.*选择)/i,
    'composer must not ask per-step gate question — every step waits by default',
  );
  // Composer must not recommend or pre-fill answers either.
  assert.doesNotMatch(
    skill,
    /(推荐把|一般 step\d+)/i,
    'composer must not make recommendations about which steps need gates',
  );
});

test('SKILL.md composer auto-generates the workflow SKILL.md (user does not write markdown)', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /(自动生成|自动渲染|auto-generate|composer)[^\n]*(SKILL\.md|工作流 SKILL)/i,
    'must state that composer auto-generates the SKILL.md',
  );
  // Must explicitly tell the user they do NOT need to write markdown.
  assert.match(
    skill,
    /(不写|无需|用户不写|do not write)[^\n]*(markdown|SKILL\.md|内容)/i,
    'must state the user does not need to write markdown',
  );
});

test('SKILL.md composer still routes through scripts/workflow-links.mjs install', async () => {
  const skill = await read(skillPath);
  // Composer Phase 7 still calls the shared link helper.
  const installPath = skill.search(/INSTALL.*scripts\/workflow-links\.mjs|workflow-links\.mjs.*install/i);
  const registerPath = skill.search(/REGISTER.*workflow\.options|workflow\.options.*REGISTER/i);
  assert.ok(installPath >= 0, 'must still reference scripts/workflow-links.mjs install');
  assert.ok(registerPath > installPath, 'REGISTER must come after INSTALL (install-then-register ordering preserved)');
});

test('SKILL.md mentions the 13-leaf pool size', async () => {
  const skill = await read(skillPath);
  assert.match(
    skill,
    /\b13\b[^\n]*(内置|leaf|leaf skill)/i,
    'must mention the 13 built-in leaf skill pool size',
  );
});