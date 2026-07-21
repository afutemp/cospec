# cospec Roadmap

## Current Stage

Product-planning workflow integration and delivery hardening.

## Completed

- 2026-07-21: Moved the large-requirement optional Demo prompt to immediately after TR1 completion and before TR2. Demo completion, rejection, cancellation, or failure remains independent from subsequent TR2 planning; small-requirement timing is unchanged.
- 2026-07-20: Added the `generate-demo` Skill for explicit Frieren Demo generation from user-confirmed Markdown documents. The flow enforces document selection, dry-run review, final send confirmation, environment-only credentials, bounded files, deterministic identifiers, HMAC signing, safe errors, and no automatic retries.
- 2026-07-20: Added optional Demo handoff prompts to both large and small requirement workflows without changing their required planning-node order or completion semantics.

## In Progress

None.

## Planned

To be confirmed.

## Blockers

None.

## Recent Validation

- 2026-07-21: A RED workflow-order check confirmed the previous large-requirement Skill prompted for Demo only after all planning nodes. After moving the gate, the GREEN order check and the combined large-workflow/generate-demo suite passed all 13 tests; targeted `git diff --check` also passed.
- 2026-07-20: `node --test plugins/cospec/skills/generate-demo/scripts/generate-demo.test.mjs` passed all 12 tests.
- 2026-07-20: Three RED baseline evaluations and three GREEN forward evaluations confirmed consistent file-selection, consent, and no-retry behavior after loading `generate-demo`.
- 2026-07-20: Node syntax checks, JSON parsing, `git diff --check`, Skill frontmatter validation, `agents/openai.yaml` validation, and the plugin version audit passed.
- 2026-07-20: The official `quick_validate.py` could not start because both available Python runtimes lack `PyYAML`; an equivalent validation using the validator's own accepted keys and constraints passed without installing a global dependency.
- 2026-07-20: User-confirmed live Frieren smoke tests sent non-sensitive Markdown documents and returned successful handoff responses with accessible links; no automatic retry was performed and no credential or document content was logged.
