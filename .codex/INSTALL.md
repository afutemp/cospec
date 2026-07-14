# Installing cospec for Codex

Enable cospec skills in Codex via native skill discovery or the plugin marketplace.

## Prerequisites

- Git
- Access to the cospec repository

---

## Option 1: Install via Plugin Marketplace (Recommended)

Codex in the ChatGPT desktop app can install plugins from a marketplace catalog.

### For plugin users

If someone has already added the cospec marketplace to their Codex:

1. Open the ChatGPT desktop app.
2. Go to **Plugins**.
3. Select the cospec marketplace.
4. Find **cospec** and install/enable it.
5. Restart Codex if prompted.

### For plugin developers / marketplace maintainers

Add cospec to a marketplace file so Codex can discover it:

**Repo-level marketplace:**

Create `$REPO_ROOT/.agents/plugins/marketplace.json`:

```json
{
  "name": "cospec-marketplace",
  "interface": {
    "displayName": "cospec Marketplace"
  },
  "plugins": [
    {
      "name": "cospec",
      "source": {
        "source": "local",
        "path": "./"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

**Personal marketplace:**

Create `~/.agents/plugins/marketplace.json` with the same content, and adjust `source.path` to point at your local cospec clone (e.g., `"./.codex/cospec"`).

**CLI:**

```bash
codex plugin marketplace add ./
```

Then restart the ChatGPT desktop app and install cospec from the plugin directory.

---

## Option 2: Manual Symlink Install

Use this when you are iterating locally or don't want to set up a marketplace.

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

3. **Restart Codex** (quit and relaunch the CLI or desktop app) to discover the skills.

## How It Works

Codex has native skill discovery — it scans `~/.agents/skills/` at startup, parses SKILL.md frontmatter, and loads skills on demand. cospec skills are made visible through a single symlink:

```
~/.agents/skills/cospec/ → ~/.codex/cospec/skills/
```

When installed via marketplace, Codex copies the plugin into its plugin cache and loads `skills/` from the plugin manifest (`skills: "./skills/"`).

The `using-spec-developer` skill is discovered automatically and enforces skill usage discipline — no additional configuration needed.

## Environment Variables

See `README.md` for configuration options.

## Verify

```bash
ls -la ~/.agents/skills/cospec
```

You should see a symlink (or junction on Windows) pointing to your cospec skills directory.

## Updating

**Marketplace install:**

Update the plugin source and restart the ChatGPT desktop app. For Git-backed marketplaces, run:

```bash
codex plugin marketplace upgrade
```

**Manual symlink install:**

```bash
cd ~/.codex/cospec && git pull
# or copy the updated files
```

Skills update instantly through the symlink.

## Uninstalling

**Marketplace install:**

Disable or remove cospec from the ChatGPT desktop app **Plugins** page.

**Manual symlink install:**

```bash
rm ~/.agents/skills/cospec
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.agents\skills\cospec"
```

Optionally remove the copy: `rm -rf ~/.codex/cospec`.
