# cospec Multi-Plugin Archive

This repository is an archive of AI coding-agent plugins. Each plugin lives under `plugins/<name>/` and can ship manifests for multiple agents (Claude Code, OpenAI Codex, Cursor, etc.).

## Plugins

| Plugin | Description | Platforms |
|--------|-------------|-----------|
| [cospec](./plugins/cospec) | AI-native product planning workflow: requirement clarification, user journey design, TR1/TR2, confirmed Frieren Demo handoff, and previewed synchronization to IPD. | Claude Code, Codex, Cursor |
| [product-kb](./plugins/product-kb) | Traceable product-planning knowledge bases plus preview-first cospec manifest synchronization to IPD. | Claude Code, Codex |

## Usage as a Marketplace

### Claude Code

```bash
/plugin marketplace add git@github.com:afutemp/cospec.git
/plugin install cospec
```

### OpenAI Codex

```bash
codex plugin marketplace add git@github.com:afutemp/cospec.git
```

Then open the Plugins page in the ChatGPT desktop app, select the **cospec Marketplace**, and install/enable **cospec**.

### Cursor

Add this repository as a Cursor plugin source and enable the **cospec** plugin.

## Repository Layout

```text
.
├── .claude-plugin/marketplace.json   # Claude Code marketplace index
├── .agents/plugins/marketplace.json  # Codex marketplace index
├── plugins/
│   └── cospec/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── .cursor-plugin/plugin.json
│       ├── skills/                   # agent-agnostic skills
│       ├── hooks/                    # lifecycle hooks and scripts
│       ├── rules/                    # requirement checklists
│       ├── templates/                # document templates
│       ├── docs/                     # integration and workflow docs
│       ├── cospec.config.json
│       └── README.md
└── scripts/
    └── bump-version.sh               # archive-level version-bump wrapper
```

## Adding a New Plugin

1. Create `plugins/<plugin-name>/`.
2. Add platform manifests: `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, etc.
3. Put shared skills/assets in `plugins/<plugin-name>/skills/`, `rules/`, `templates/`, `docs/`.
4. Put platform-specific components in `plugins/<plugin-name>/claude/`, `codex/`, `cursor/` as needed.
5. Add the plugin to the root marketplace files:
   - `.claude-plugin/marketplace.json`
   - `.agents/plugins/marketplace.json`

## License

MIT
