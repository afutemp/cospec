// Skill 激活路由回归测试（Phase 1 止血版）。
//
// 本 runner 只覆盖“可静态验证”的激活边界，对应
// skill-trigger-false-positive-analysis.md 第 9.1 / 11 节的验收标准：
//   - using-spec-developer 已移出 skills/，不再被自由路由发现
//   - SessionStart 不再强制注入全文 / EXTREMELY_IMPORTANT / “1% 必须调用”
//   - 收紧后的 guard skill description 含显式守卫、移除低阈值措辞
//
// 模型实际路由行为（正例触发、硬负例沉默）需要隔离会话复测，
// 本 runner 只校验用例集合存在并打印回归清单（见最后一个 test），
// 不假装在 CI 里跑 LLM 路由判断。
//
// 运行：node --test plugins/cospec/tests/skill-activation-routing.test.mjs

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');
const casesPath = join(__dirname, 'skill-activation-cases.json');

async function readSkill(skill) {
  return readFile(join(pluginRoot, `skills/${skill}/SKILL.md`), 'utf8');
}

/** 取出 SKILL.md frontmatter 里的 description（去掉两端引号）。 */
async function frontmatterDesc(skill) {
  const md = await readSkill(skill);
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${skill}: 缺少 frontmatter`);
  const line = m[1].split('\n').find((l) => l.startsWith('description:'));
  assert.ok(line, `${skill}: 缺少 description`);
  return line.slice('description:'.length).trim().replace(/^"|"$/g, '');
}

// ---- 守卫 1：using-spec-developer 不在 skills/，已移到 docs/ ----
test('using-spec-developer 已移出 skills/（不再参与自由路由）', async () => {
  const entries = await readdir(join(pluginRoot, 'skills'), { withFileTypes: true });
  const names = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(
    !names.includes('using-spec-developer'),
    `skills/ 仍含 using-spec-developer: ${names.join(', ')}`,
  );
  assert.ok(
    existsSync(join(pluginRoot, 'docs/using-spec-developer/SKILL.md')),
    'docs/using-spec-developer/SKILL.md 应存在',
  );
});

// ---- 守卫 2：SessionStart 不再强制注入全文 / EXTREMELY_IMPORTANT / 1% ----
test('session-start 不再强制注入 skill-discipline 全文', async () => {
  const hook = await readFile(join(pluginRoot, 'hooks/session-start'), 'utf8');
  assert.ok(!hook.includes('EXTREMELY_IMPORTANT'), 'hook 仍包裹 EXTREMELY_IMPORTANT');
  assert.ok(!/\b1%\b/.test(hook), 'hook 仍含 1% 规则');
  assert.ok(
    !hook.includes('skills/using-spec-developer/SKILL.md'),
    'hook 仍 cat skills/using-spec-developer/SKILL.md',
  );
  assert.ok(hook.includes('system-reminder'), 'hook 应注入范围明确的中性 system-reminder 提示');
});

// ---- 守卫 3：收紧后的 guard skill description ----
test('brainstorming 要求显式使用 cospec', async () => {
  const d = await frontmatterDesc('brainstorming');
  assert.match(d, /explicitly/i);
  assert.match(d, /do not use/i);
});

test('product-kb-query 禁止用于任意 markdown/日志/总结', async () => {
  const d = await frontmatterDesc('product-kb-query');
  assert.match(d, /明确/);
  assert.match(d, /不要用于|不用于/);
});

test('product-kb-server 不再“没明确说也该触发”', async () => {
  const d = await frontmatterDesc('product-kb-server');
  assert.match(d, /明确/);
  assert.ok(
    !/即使[^\n]*没有明确说[^\n]*都应该触发/.test(d),
    'description 仍含低阈值“即使用户没明确说也该触发”条款',
  );
});

for (const s of ['competitor-feature-research', 'competitor-pain-points', 'competitor-problem-solving']) {
  test(`${s} 仅在 cospec 流程内或显式竞品研究时调用`, async () => {
    const d = await frontmatterDesc(s);
    assert.match(d, /仅在|只在/);
    assert.match(d, /不要因|不要因为|不因/);
  });
}

// ---- 守卫 5：scaffold-custom-workflow 仅在显式创建请求时激活 ----
test('scaffold-custom-workflow 仅在用户显式要求创建自定义工作流时激活', async () => {
  const d = await frontmatterDesc('scaffold-custom-workflow');
  assert.match(d, /explicitly|显式/i, 'description 应强调显式触发');
  assert.match(d, /do not use|不要|禁止/i, 'description 应有反向守卫词');
  // Must NOT mention generic phrases like "create workflow" without a cospec scope.
  assert.match(
    d,
    /custom workflow|自定义工作流/,
    'description 应明确"自定义工作流"语义，避免与普通 skill 创作混淆',
  );
});

// ---- 守卫 6：cospec-configure 必须能因"删除自定义工作流"而激活 ----
test('cospec-configure description mentions delete so agent can trigger on "delete workflow" intent', async () => {
  const d = await frontmatterDesc('cospec-configure');
  assert.match(
    d,
    /delete/i,
    'description must include "delete" so the agent routes delete-workflow requests here',
  );
  // Must keep the reverse-guard against over-trigger on "cospec" alone.
  assert.match(
    d,
    /Do not use merely/i,
    'description must keep the reverse-guard against trivial "cospec" mentions',
  );
});

// ---- 守卫 7：竞品研究 skill 优先 headless 浏览器 + 降级链 ----

const COMPETITOR_SKILLS = [
  'competitor-feature-research',
  'competitor-pain-points',
  'competitor-problem-solving',
];

for (const name of COMPETITOR_SKILLS) {
  test(`${name} description prefers headless browser and indicates fallback exists`, async () => {
    const d = await frontmatterDesc(name);
    assert.match(
      d,
      /headless/i,
      `${name}: must mention headless mode (no popup windows)`,
    );
    // Must indicate a fallback exists (without naming specific tools,
      // which we don't know the agent has).
    assert.match(
      d,
      /降级|fallback|不可用|降级链/,
      `${name}: must indicate a fallback path when headless browser is unavailable`,
    );
  });
}

// ---- 守卫 4：用例集合存在，并打印需隔离会话复测的回归清单 ----
test('路由用例集合完整 + 打印回归清单（需隔离会话手动复测）', async () => {
  const cases = JSON.parse(await readFile(casesPath, 'utf8'));
  assert.ok(cases.positives?.length >= 6, '正例应 >=6（含 P5 自定义工作流创建 + P6 删除）');
  assert.ok(cases.hardNegatives?.length >= 9, '硬负例应 >=9（含 N9 讨论自定义工作流架构）');
  assert.ok(cases.ambiguous?.length >= 3, '模糊例应 >=3');

  const fmt = (tag, c) => `[${tag}] expect=${c.expect.padEnd(22)} | ${c.input}`;
  console.log('\n===== Skill 激活路由回归清单（在隔离会话中逐条复测，首启 / clear / compact / 否定后 各一遍）=====');
  for (const c of cases.hardNegatives) console.log(fmt('NEG', c));
  for (const c of cases.positives) console.log(fmt('POS', c));
  for (const c of cases.ambiguous) console.log(fmt('AMB', c));
  console.log('=================================================================================================\n');
});
