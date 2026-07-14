# cospec Configuration Schema

This document describes every field in `cospec.config.json`. It lives in the plugin root and is read at runtime by cospec skills before they execute. All fields are optional — set to `null` (or omit) to use cospec's built-in default.

## Reading Priority

For every field, cospec applies this priority order:

```
cospec.config.json (non-null value)
  → OS environment variable of the same name (env block only)
  → cospec built-in default
```

## `project`

| Field | Type | Default | Description |
|---|---|---|---|
| `product` | string \| null | null | Product line identifier (e.g., SCC, SCP, DMP). |

## `env`

| Field | Type | Default | Used By |
|---|---|---|---|
| `DAEDALUS_URL` | string \| null | `http://10.65.232.32:8081/` | Telemetry/usage report endpoint. |
| `DAEDALUS_API_KEY` | string \| null | null | API key for telemetry endpoint. |

## `kb`

| Field | Type | Default | Description |
|---|---|---|---|
| `skill` | string \| null | null | Replace the default KB query method with your own skill name. |
| `localPath` | string \| null | `doc/kb/` | Local knowledge base directory for file-based lookups. |

**KB discovery order:**

```
config.kb.skill (if set) → config.kb.localPath (if set) → code-first (Glob + Grep + Read)
```

## `templates`

Replace individual cospec template files with your own. Paths are relative to the plugin root unless they start with `/` or `~/`.

| Key | Default | Used By |
|---|---|---|
| `user-requirement` | `templates/user-requirement-template.md` | `tr1-requirements-spec` |
| `user-journey` | `skills/user-journey-design/assets/templates/document-template.md` | `user-journey-design` |
| `tr1-large-review` | `skills/tr1-requirements-spec/assets/templates/大需求用户需求规格说明书_评审版.md` | `tr1-requirements-spec` |
| `tr1-large-ai` | `skills/tr1-requirements-spec/assets/templates/大需求用户需求规格说明书_AI上下文版.md` | `tr1-requirements-spec` |
| `tr1-small-review` | `skills/tr1-requirements-spec/assets/templates/小需求用户需求说明_评审版.md` | `tr1-requirements-spec` |

## `rules`

Replace entire cospec rules directories with your own.

| Key | Default | Used By |
|---|---|---|
| `requirement-checklists` | `rules/requirement-checklists/` | `requirement-clarification`, `user-journey-design`, `tr1-requirements-spec` |

## `evaluators`

Replace or disable individual quality gate evaluator skills.

| Key | Default | Gate Location |
|---|---|---|
| `requirement-clarification` | `requirement-clarification-evaluator` | After `requirement-clarification` |
| `user-journey-design` | `user-journey-design-evaluator` | After `user-journey-design` |
| `tr1-requirements-spec` | `tr1-requirements-spec-evaluator` | After `tr1-requirements-spec` |

- **Non-null string** — use this skill name instead of the default evaluator.
- **`false`** — disable this gate entirely.
- **`null`** — use cospec default.

## `parallel`

Reserved extension point for DAG-based parallel document generation. Existing stages remain linear by default.

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Master switch for parallel document generation. |
| `max_parallel_tasks` | number | `4` | Maximum tasks dispatched in one ready-set batch. |
| `evaluator` | string \| `false` | `"cospec-dag-evaluator"` | Skill name used to evaluate DAG plans before execution. Set to `false` to disable. |
| `stages.requirement-clarification` | boolean | `false` | Reserved: enable parallel mode for the requirement-clarification stage. |
| `stages.user-journey-design` | boolean | `false` | Reserved: enable parallel mode for the user-journey-design stage. |
| `stages.tr1-requirements-spec` | boolean | `false` | Reserved: enable parallel mode for the tr1-requirements-spec stage. |

## Extension Principle

`cospec.config.json` is the **only** supported extension mechanism. Core workflow skills (`brainstorming`, `requirement-clarification`, `user-journey-design`, `tr1-requirements-spec`) enforce their own SOP and cannot be overridden by other plugins. Only the leaf extension points declared in this config (templates, rules, evaluators, kb, env) are replaceable.
