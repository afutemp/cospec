#!/usr/bin/env node

/**
 * Cross-platform Node.js wrapper for hook scripts.
 *
 * Replaces run-hook.cmd with a pure Node.js implementation.
 * On Windows: locates Git Bash and runs the hook script via bash.
 * On Unix: directly executes the hook script via bash.
 *
 * Hook scripts use extensionless filenames (e.g. "session-start") so that
 * Claude Code's Windows auto-detection (which prepends "bash" to .sh files)
 * does not interfere.
 *
 * Usage: node run-hook.mjs <script-name> [args...]
 */

import { accessSync, constants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptName = process.argv[2];
const scriptArgs = process.argv.slice(3);

if (!scriptName) {
  console.error('run-hook.mjs: missing script name');
  process.exit(1);
}

const hookScript = join(__dirname, scriptName);

/**
 * Check if a file exists and is executable (where possible).
 */
function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    try {
      // On Windows, accessSync with X_OK may not behave as expected,
      // so fall back to checking if the file exists.
      accessSync(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Attempt to locate bash.exe on Windows.
 * Returns the full path if found, or 'bash' as a fallback.
 */
function findBashOnWindows() {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  // Fall back to PATH
  return 'bash.exe';
}

/**
 * Run the hook script and return its exit code.
 */
function runHook() {
  const isWindows = platform() === 'win32';
  const bashCmd = isWindows ? findBashOnWindows() : 'bash';

  try {
    execFileSync(bashCmd, [hookScript, ...scriptArgs], {
      stdio: 'inherit',
      windowsHide: true,
    });
    return 0;
  } catch (err) {
    if (err.status !== undefined) {
      // The hook script ran but exited with a non-zero status.
      return err.status;
    }
    // bash itself could not be launched — exit silently.
    // The plugin still works, just without SessionStart context injection.
    return 0;
  }
}

const exitCode = runHook();
process.exit(exitCode);
