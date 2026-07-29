#!/usr/bin/env node
// hooks/lib/check-vault-drift.mjs — SessionStart drift detector.
//
// Detects when cospec custom workflows exist in the user vault
// (~/.cospec/workflows/<name>-workflow/) but are missing from the
// runtime registry (cospec.config.json's workflow.options) or the
// agent bridge directory.
//
// Exits 0 always (drift is a soft warning, never blocks the session).
// Prints a markdown-formatted drift report on stdout that the
// caller (session-start bash hook) injects into the session context.
//
// Usage: node check-vault-drift.mjs <plugin-root>
//   plugin-root: the absolute path to the cospec plugin (so we can
//                read its bundled cospec.config.json for the registry)
//
// Detects when cospec custom workflows exist in the user vault
// (~/.cospec/workflows/<name>-workflow/) but are missing from the
// runtime registry (cospec.config.json's workflow.options) or the
// agent bridge directory.
//
// Exits 0 always (drift is a soft warning, never blocks the session).
// Prints a markdown-formatted drift report on stdout that the
// caller (session-start bash hook) injects into the session context.
//
// Usage: node check-vault-drift.mjs <plugin-root>
//   plugin-root: the absolute path to the cospec plugin (so we can
//                read its bundled cospec.config.json for the registry)

import { access, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const VAULT_DIR = join(homedir(), '.cospec', 'workflows');
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}-workflow$/;

// Heuristic agent skill dirs to check for bridges. The vault is the
// source of truth — bridges are runtime projections, so missing
// bridges are recoverable but worth surfacing.
//
// Note: Codex splits between CLI (~/.agents/skills) and the desktop app
// (~/.codex/skills). Both must be present for full coverage.
const AGENT_DIRS = [
  join(homedir(), '.agents', 'skills'),       // Codex CLI
  join(homedir(), '.codex', 'skills'),        // Codex desktop app
  join(homedir(), '.claude', 'skills'),       // Claude Code
];

export async function listVaultWorkflows(vaultDir = VAULT_DIR) {
  let entries;
  try {
    entries = await readdir(vaultDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!NAME_PATTERN.test(entry.name)) continue;
    const skillPath = join(vaultDir, entry.name, 'SKILL.md');
    try {
      await access(skillPath);
      out.push(entry.name);
    } catch {
      // No SKILL.md inside — incomplete vault entry, ignore.
    }
  }
  return out;
}

export async function loadRegistry(pluginRoot) {
  const configPath = join(pluginRoot, 'cospec.config.json');
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    return { options: [], installDirs: {} };
  }
  try {
    const cfg = JSON.parse(raw);
    return {
      options: Array.isArray(cfg.workflow?.options) ? cfg.workflow.options : [],
      installDirs:
        cfg.workflow?.installDirs && typeof cfg.workflow.installDirs === 'object'
          ? cfg.workflow.installDirs
          : {},
    };
  } catch {
    return { options: [], installDirs: {} };
  }
}

async function bridgeExists(installDir, name) {
  const target = join(installDir, name);
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function detectDrift({ vaultDir = VAULT_DIR, pluginRoot, agentDirs = AGENT_DIRS } = {}) {
  const vault = await listVaultWorkflows(vaultDir);
  const { options, installDirs } = await loadRegistry(pluginRoot);

  const unregistered = [];        // vault workflow not in workflow.options
  const bridgeMissing = [];      // registered workflow but no bridge on any agent

  for (const name of vault) {
    if (!options.includes(name)) {
      unregistered.push(name);
    }
  }

  for (const name of options) {
    if (!vault.includes(name)) continue; // orphan registry entry — not our concern here
    let anyBridge = false;
    for (const dir of agentDirs) {
      // Allow installDirs overrides too.
      const override = installDirs[Object.keys(installDirs).find((k) => installDirs[k] === dir)];
      const target = override || dir;
      if (await bridgeExists(target, name)) {
        anyBridge = true;
        break;
      }
    }
    if (!anyBridge) bridgeMissing.push(name);
  }

  return { unregistered, bridgeMissing, vaultCount: vault.length };
}

export function formatReport(drift) {
  const { unregistered, bridgeMissing, vaultCount } = drift;
  const lines = [];

  // Always emit a status — clean or drift — so the agent has a clear
  // signal to either report drift or proceed normally. The output is
  // intentionally free of unescaped `"` characters so it can be safely
  // embedded inside a JSON string by session-start.
  if (unregistered.length === 0 && bridgeMissing.length === 0) {
    if (vaultCount === 0) {
      lines.push('✅ cospec vault drift 检测：vault 为空（未创建任何自定义工作流），无需处理');
    } else {
      lines.push(
        `✅ cospec vault drift 检测：vault 含 ${vaultCount} 个工作流，全部已注册到 workflow.options 且 agent bridge 完整`,
      );
    }
    return lines.join('\\n');
  }

  lines.push('⚠️ cospec vault drift 检测：检测到以下工作流漂移');
  lines.push(`- vault 含 ${vaultCount} 个工作流`);
  if (unregistered.length > 0) {
    lines.push(
      `- 未注册到 \`workflow.options\`：${unregistered.map((n) => `\`${n}\``).join('、')}`,
    );
    lines.push(
      '  → 恢复：运行 Skill(cospec-configure) 菜单 **5. workflows** → **5.5 sync / reconcile**',
    );
  }
  if (bridgeMissing.length > 0) {
    lines.push(
      `- 未在当前 agent skill 目录挂载 bridge：${bridgeMissing.map((n) => `\`${n}\``).join('、')}`,
    );
    lines.push(
      '  → 恢复：对每个 agent 跑 `node <plugin>/scripts/workflow-links.mjs install <name> --install-dir <agent-skill-dir>`',
    );
  }
  return lines.join('\\n');
}

/**
 * Wrap the drift report in a complete <system-reminder priority="high">
 * block with the JSON-escaped quotes already in place. Returns "" when
 * there's no drift to report.
 *
 * Uses JSON.stringify to ensure correct escaping — manual backslash
 * juggling in source is too error-prone (verified by the bash session-start
 * integration test in this directory).
 */
export function wrapAsSystemReminder(report) {
  if (!report) return '';
  const instruction =
    'If drift is detected (⚠️ prefix), explicitly mention it to the user in your FIRST reply ' +
    'and offer to run Skill(cospec-configure) 5.5 sync to recover. ' +
    'If drift is clean (✅ prefix), do NOT mention drift to the user — just proceed normally.';
  // Build the human-readable reminder. Use real newlines for human readability,
  // then JSON.stringify() to get the properly-escaped form for embedding.
  const reminder =
    `<system-reminder priority="high">\n` +
    report.replace(/\\n/g, '\n') +
    '\n\n' + instruction +
    '\n</system-reminder>';
  return JSON.stringify(reminder).slice(1, -1);
}

// CLI entry: read plugin root from argv, print drift report (empty if none).
// Use pathToFileURL on argv[1] to compare against import.meta.url — works on
// both POSIX (file:///abs/path) and Windows (file:///C:/abs/path). The naive
// `file://${process.argv[1]}` form fails on Windows because argv[1] uses
// backslashes and 2 slashes while import.meta.url uses forward slashes and
// 3 slashes, so the comparison is always false and the CLI block never runs.
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const pluginRoot = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  try {
    const drift = await detectDrift({ pluginRoot });
    const report = formatReport(drift);
    const wrapped = wrapAsSystemReminder(report);
    process.stdout.write(wrapped);
    process.exit(0);
  } catch (err) {
    // Drift detection is best-effort; never block session start.
    process.stderr.write(`check-vault-drift: ${err.message}\n`);
    process.exit(0);
  }
}