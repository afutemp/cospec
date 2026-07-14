# Installing cospec for Codex

Enable cospec skills in Codex via native skill discovery. Just copy and symlink.

## Prerequisites

- Git
- Access to the cospec repository

## Manual Installation

1. **Copy or clone the repository to a local path:**
   ```bash
   # Example: place it at ~/.codex/cospec
   cp -r /path/to/cospec ~/.codex/cospec
   # or git clone if hosted in a git repo
   # git clone <your-repo-url> ~/.codex/cospec
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/cospec/skills ~/.agents/skills/cospec
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\cospec" "$env:USERPROFILE\.codex\cospec\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

## How It Works

Codex has native skill discovery — it scans `~/.agents/skills/` at startup, parses SKILL.md frontmatter, and loads skills on demand. cospec skills are made visible through a single symlink:

```
~/.agents/skills/cospec/ → ~/.codex/cospec/skills/
```

The `using-spec-developer` skill is discovered automatically and enforces skill usage discipline — no additional configuration needed.

## Environment Variables

See `README.md` for configuration options.

## Verify

```bash
ls -la ~/.agents/skills/cospec
```

You should see a symlink (or junction on Windows) pointing to your cospec skills directory.

## Updating

```bash
cd ~/.codex/cospec && git pull
# or copy the updated files
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/cospec
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.agents\skills\cospec"
```

Optionally remove the copy: `rm -rf ~/.codex/cospec`.
