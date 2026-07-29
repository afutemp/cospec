#!/usr/bin/env node
// scripts/workflow-links.mjs — cospec custom-workflow bridge helper.
//
// Exposes three operations:
//   install(name, { installDir })   → { ok, action, source, dest, reason }
//   uninstall(name, { installDir }) → { ok, action, source, dest, reason }
//   status(name, { installDir })    → { installed, conflict, misdirected, source, dest, reason }
//
// Source of truth:  $COSPEC_HOME/.cospec/workflows/<name>/
//                   (default: $HOME/.cospec/workflows/<name>)
// Bridge:           <installDir>/<name> → source (symlink or Windows directory junction)
//
// Cross-platform: Node fs.symlink(target, dst, 'junction') works on both
// Unix (as a normal symlink) and Windows (as a directory junction equivalent
// to `mklink /J`), without admin or Developer Mode.

import { homedir } from 'node:os';
import {
  access,
  constants,
  lstat,
  mkdir,
  readlink,
  realpath,
  rm,
  symlink,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}-workflow$/;

function vaultRoot() {
  // Tests set COSPEC_HOME for isolation; users get the real ~/.cospec.
  return join(process.env.COSPEC_HOME || homedir(), '.cospec', 'workflows');
}

function vaultSource(name) {
  return join(vaultRoot(), name);
}

function expandHome(input) {
  if (typeof input !== 'string') return input;
  if (input === '~') return homedir();
  if (input.startsWith('~/') || input.startsWith(`~${sep}`)) {
    return join(homedir(), input.slice(2));
  }
  // ~user syntax is explicitly rejected.
  if (input.startsWith('~')) return null;
  return input;
}

function validateName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    return 'name must be a non-empty string';
  }
  if (!NAME_PATTERN.test(name)) {
    return `invalid workflow name ${JSON.stringify(name)}: must match ${NAME_PATTERN} (lowercase, digits, hyphens; end with -workflow)`;
  }
  return null;
}

function fail(reason, extra = {}) {
  return { ok: false, reason, ...extra };
}

async function pathExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function describeDestination(dest) {
  let stat;
  try {
    stat = await lstat(dest);
  } catch {
    return { exists: false };
  }
  if (stat.isSymbolicLink()) {
    let linkTarget = null;
    try {
      linkTarget = await readlink(dest);
    } catch {
      linkTarget = null;
    }
    return { exists: true, isLink: true, linkTarget, kind: 'link' };
  }
  if (stat.isDirectory()) {
    return { exists: true, isDirectory: true, kind: 'dir' };
  }
  return { exists: true, isFile: true, kind: 'file' };
}

export async function install(name, { installDir } = {}) {
  const nameError = validateName(name);
  if (nameError) return fail(nameError, { name });

  const expandedDir = expandHome(installDir);
  if (expandedDir === null) {
    return fail('installDir must not use ~user syntax; use ~ or ~/... only', { name });
  }
  if (typeof expandedDir !== 'string' || expandedDir.length === 0) {
    return fail('installDir is required', { name });
  }

  const sourceAbs = resolve(vaultSource(name));
  const baseInstallDir = resolve(
    isAbsolute(expandedDir) ? expandedDir : join(process.cwd(), expandedDir),
  );
  const destAbs = join(baseInstallDir, name);
  const destParent = dirname(destAbs);

  if (!(await pathExists(sourceAbs))) {
    return fail(`vault source missing: ${sourceAbs}`, { name, source: sourceAbs, dest: destAbs });
  }
  // Ensure the source is a directory; never follow a misnamed file.
  try {
    const sourceStat = await lstat(sourceAbs);
    if (!sourceStat.isDirectory()) {
      return fail(`vault source is not a directory: ${sourceAbs}`, {
        name,
        source: sourceAbs,
        dest: destAbs,
      });
    }
  } catch (err) {
    return fail(`cannot stat vault source: ${err.message}`, {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  await mkdir(destParent, { recursive: true });

  const existing = await describeDestination(destAbs);
  if (existing.exists) {
    if (existing.isLink) {
      // Already a link — verify it points to the vault source.
      let resolvedTarget = null;
      try {
        resolvedTarget = await realpath(destAbs);
      } catch {
        resolvedTarget = null;
      }
      if (resolvedTarget && resolvedTarget === sourceAbs) {
        return { ok: true, action: 'unchanged', name, source: sourceAbs, dest: destAbs };
      }
      return fail(
        `conflict: destination already exists as a symlink/junction pointing elsewhere: ${existing.linkTarget || '?'}`,
        { name, source: sourceAbs, dest: destAbs },
      );
    }
    if (existing.isDirectory) {
      return fail('conflict: destination already exists as a real directory; refusing to overwrite', {
        name,
        source: sourceAbs,
        dest: destAbs,
      });
    }
    return fail('conflict: destination already exists as a file; refusing to overwrite', {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  try {
    // 'junction' = Unix symlink semantics on Linux/macOS; Windows directory
    // junction (mklink /J equivalent) on Windows. Both resolve to the same
    // directory-link behaviour without admin privileges.
    await symlink(sourceAbs, destAbs, 'junction');
  } catch (err) {
    return fail(`symlink creation failed: ${err.message}`, {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  // Confirm the bridge resolves back to the source.
  let verified = false;
  try {
    verified = (await realpath(destAbs)) === sourceAbs;
  } catch {
    verified = false;
  }
  if (!verified) {
    // Roll back: remove the broken link so we don't leave an unusable artifact.
    await rm(destAbs, { force: true }).catch(() => {});
    return fail('post-install verification failed; bridge does not resolve to vault source', {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  return { ok: true, action: 'created', name, source: sourceAbs, dest: destAbs };
}

export async function uninstall(name, { installDir } = {}) {
  const nameError = validateName(name);
  if (nameError) return fail(nameError, { name });

  const expandedDir = expandHome(installDir);
  if (expandedDir === null) {
    return fail('installDir must not use ~user syntax', { name });
  }
  if (typeof expandedDir !== 'string' || expandedDir.length === 0) {
    return fail('installDir is required', { name });
  }

  const sourceAbs = resolve(vaultSource(name));
  const baseInstallDir = resolve(
    isAbsolute(expandedDir) ? expandedDir : join(process.cwd(), expandedDir),
  );
  const destAbs = join(baseInstallDir, name);

  if (!(await pathExists(destAbs))) {
    return { ok: true, action: 'absent', name, source: sourceAbs, dest: destAbs };
  }

  const stat = await lstat(destAbs);
  if (!stat.isSymbolicLink()) {
    return fail(
      'destination is not a bridge (symlink/junction); refusing to remove a real directory or file',
      { name, source: sourceAbs, dest: destAbs },
    );
  }

  let resolvedTarget = null;
  try {
    resolvedTarget = await realpath(destAbs);
  } catch {
    resolvedTarget = null;
  }
  if (resolvedTarget !== sourceAbs) {
    return fail('destination bridge does not point to the expected vault source', {
      name,
      source: sourceAbs,
      dest: destAbs,
      actualTarget: resolvedTarget,
    });
  }

  try {
    await rm(destAbs, { force: true });
  } catch (err) {
    return fail(`bridge removal failed: ${err.message}`, {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  // Source must still exist.
  const sourceStillExists = await pathExists(sourceAbs);
  if (!sourceStillExists) {
    return fail('vault source disappeared during uninstall; aborting', {
      name,
      source: sourceAbs,
      dest: destAbs,
    });
  }

  return { ok: true, action: 'removed', name, source: sourceAbs, dest: destAbs };
}

export async function status(name, { installDir } = {}) {
  const nameError = validateName(name);
  if (nameError) return { installed: false, reason: nameError, name };

  const expandedDir = expandHome(installDir);
  if (!expandedDir || typeof expandedDir !== 'string' || expandedDir.length === 0) {
    return { installed: false, reason: 'installDir is required', name };
  }

  const sourceAbs = resolve(vaultSource(name));
  const baseInstallDir = resolve(
    isAbsolute(expandedDir) ? expandedDir : join(process.cwd(), expandedDir),
  );
  const destAbs = join(baseInstallDir, name);

  if (!(await pathExists(destAbs))) {
    return {
      installed: false,
      conflict: false,
      misdirected: false,
      source: sourceAbs,
      dest: destAbs,
      reason: 'bridge absent',
      name,
    };
  }

  const stat = await lstat(destAbs);
  if (!stat.isSymbolicLink()) {
    return {
      installed: false,
      conflict: true,
      misdirected: false,
      source: sourceAbs,
      dest: destAbs,
      reason: 'destination is not a bridge',
      name,
    };
  }

  let resolvedTarget = null;
  try {
    resolvedTarget = await realpath(destAbs);
  } catch {
    resolvedTarget = null;
  }

  if (resolvedTarget === sourceAbs) {
    return {
      installed: true,
      conflict: false,
      misdirected: false,
      source: sourceAbs,
      dest: destAbs,
      name,
    };
  }

  return {
    installed: false,
    conflict: false,
    misdirected: true,
    source: sourceAbs,
    dest: destAbs,
    actualTarget: resolvedTarget,
    reason: 'bridge points elsewhere',
    name,
  };
}

export const _internal = { expandHome, validateName, vaultRoot, vaultSource };

// ---- CLI entry ---------------------------------------------------------

// Tiny argv parser: `--name foo --install-dir ~/agents/skills` and
// positional subcommand (`install` / `uninstall` / `status`). Avoids
// pulling in a dependency just for arg parsing.
function parseArgs(argv) {
  const out = { subcommand: null, name: null, installDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--help' || tok === '-h') out.help = true;
    else if (tok === '--name') out.name = argv[++i];
    else if (tok === '--install-dir') out.installDir = argv[++i];
    else if (!out.subcommand) out.subcommand = tok;
    else throw new Error(`unexpected positional arg: ${tok}`);
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: workflow-links.mjs <subcommand> [--name NAME] [--install-dir DIR]',
      '',
      'Subcommands:',
      '  install     create a symlink/junction bridge from install-dir/NAME to ~/.cospec/workflows/NAME',
      '  uninstall   remove the bridge (vault source is preserved)',
      '  status      report whether a bridge exists and where it points',
      '',
      'Examples:',
      '  workflow-links.mjs install   quick-tr1-workflow --install-dir ~/.agents/skills',
      '  workflow-links.mjs uninstall quick-tr1-workflow --install-dir ~/.agents/skills',
      '  workflow-links.mjs status    quick-tr1-workflow --install-dir ~/.agents/skills',
      '',
    ].join('\n'),
  );
}

async function cliMain(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`workflow-links.mjs: ${err.message}\n`);
    printHelp();
    process.exit(2);
  }

  if (parsed.help || !parsed.subcommand) {
    printHelp();
    process.exit(parsed.help ? 0 : 2);
  }

  // Validate subcommand first — "unknown subcommand" is more useful than
  // "--install-dir is required" when the user typed the wrong verb.
  if (!['install', 'uninstall', 'status'].includes(parsed.subcommand)) {
    process.stderr.write(`workflow-links.mjs: unknown subcommand ${parsed.subcommand}\n`);
    printHelp();
    process.exit(2);
  }

  if (!parsed.name) {
    process.stderr.write('workflow-links.mjs: --name is required\n');
    process.exit(2);
  }
  if (!parsed.installDir && parsed.subcommand !== 'status') {
    process.stderr.write('workflow-links.mjs: --install-dir is required\n');
    process.exit(2);
  }

  let result;
  try {
    if (parsed.subcommand === 'install') {
      result = await install(parsed.name, { installDir: parsed.installDir });
    } else if (parsed.subcommand === 'uninstall') {
      result = await uninstall(parsed.name, { installDir: parsed.installDir });
    } else if (parsed.subcommand === 'status') {
      result = await status(parsed.name, { installDir: parsed.installDir });
    }
  } catch (err) {
    process.stderr.write(`workflow-links.mjs: ${err.message}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // status() doesn't return { ok }; it returns { installed }. For install/uninstall,
  // exit 0 only when ok=true. For status, exit 0 when we got an answer at all.
  const exitCode =
    parsed.subcommand === 'status'
      ? 0
      : result.ok
        ? 0
        : 1;
  process.exit(exitCode);
}

const isCliMain =
  import.meta.url === pathToFileURL(process.argv[1] ?? '').href ||
  // Fallback for environments where argv[1] doesn't match (e.g. some bundlers).
  // require.main === module when run via CommonJS interop. Not applicable to
  // ESM by default but harmless to check.
  (typeof require !== 'undefined' && require.main === module);

if (isCliMain) {
  cliMain(process.argv.slice(2));
}