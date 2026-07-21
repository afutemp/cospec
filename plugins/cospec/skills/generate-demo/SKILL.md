---
name: generate-demo
description: Use when the user asks to generate a Frieren Demo from cospec Markdown deliverables, says "生成 Demo" or "Demo 生成", accepts the optional Demo step after TR1 in a large-requirement workflow, or accepts it after a small-requirement workflow.
---

# Generate Demo

**Skill 标识**: `generate-demo`

Other skills reference this skill as `generate-demo`.

## Overview

Create a Frieren Demo handoff from Markdown files the user explicitly selects. Use the bundled script for validation, deterministic metadata, HMAC signing, and the network request.

## Hard Gate

Never send documents merely because a planning workflow ended or the user replied with a short continuation such as "继续". A short reply authorizes only the immediately preceding question.

Before any network request:

1. Obtain an explicit document selection from the user.
2. Run the script without `--send` and show its dry-run summary.
3. Ask the user to confirm the displayed target host, document list, count, and total bytes.
4. Add `--send` only after that confirmation.

Do not treat a request to generate a Demo as permission to choose arbitrary project files. Do not ask the user to paste secrets into chat.

## Select Documents

- When invoked by a workflow, use only the exact output paths recorded during that workflow run.
- When the user provides paths, use only those paths.
- Otherwise, list likely cospec deliverables in the current working directory and ask the user to select them. Exclude plugin files, templates, rules, knowledge bases, hidden directories, and unrelated Markdown.
- Preselect the TR1 review document when it exists, but still show every candidate and wait for the user's selection.
- Do not preselect requirement-clarification notes, raw customer material, competitor reports, TR1 AI context, or TR2 documents.

The bundled script accepts only non-empty regular `.md` files inside the current project root. It rejects symlinks, duplicates, more than 20 documents, documents over 2 MiB, and selections over 10 MiB total.

## Run the Dry Run

Resolve the directory containing this `SKILL.md` as `<skill-dir>`. Do not hardcode an installation path. In Claude Code, the script is available at `${CLAUDE_PLUGIN_ROOT}/skills/generate-demo/scripts/generate-demo.mjs`.

Run:

```bash
node <skill-dir>/scripts/generate-demo.mjs \
  --document <selected-file> \
  [--document <another-selected-file>] \
  [--title <demo-title>] \
  [--project-key <external-project-key>] \
  [--workflow-id <external-workflow-id>] \
  [--workflow-version <external-workflow-version>] \
  [--workflow-type <workflow-type>] \
  [--template-id <template-id>]
```

The script bundles the default Frieren endpoint and shared HMAC credential, so installed users do not need to configure anything before the dry run. `FRIEREN_DEMO_BASE_URL` and `FRIEREN_DEMO_HMAC_SECRET` remain optional environment overrides for development or private deployments. Never request, print, or copy the bundled credential.

Present the dry-run JSON as a concise confirmation containing:

- target host and whether transport is HTTPS;
- selected relative paths, titles, and byte sizes;
- document count and total bytes;
- generated or overridden external identifiers;
- any warning, especially an HTTP transport warning.

## Send After Confirmation

After the user confirms the dry-run summary, rerun the identical command with `--send` appended. Do not change the document list or metadata between the dry run and the send.

The command performs one request with a 60-second timeout. Do not retry automatically. On failure, report the status and safe error code, then wait for the user to decide whether to diagnose or retry.

On success, report `status`, `handoffId`, and the returned `studioUrl` or `directStudioUrl`. Do not open either URL unless the user explicitly asks.

## Security Rules

- Never copy the bundled credential to `cospec.config.json`, `.env`, command arguments, logs, or responses.
- Treat the bundled shared credential as a distribution convenience, not per-user identity or authorization. Keep document selection, dry-run, and final send confirmation as the authorization gates.
- Never print the HMAC signature, raw request body, document contents, or raw error response body.
- Never send files not shown in the confirmed dry run.
- Warn before sending to an `http://` endpoint; do not silently describe it as secure.
- Treat a failed Demo generation as independent from the completed planning workflow. Do not roll back or downgrade completed planning artifacts.

## Common Rationalizations

| Rationalization | Required response |
|---|---|
| "The user said to hurry, so I can choose the files." | Speed does not replace explicit document selection. |
| "The workflow finished, so Demo generation is the next step." | The Demo step is optional and needs its own consent. |
| "The user said 继续." | Apply it only to the immediately preceding question. |
| "A retry worked before." | Diagnose first and never retry an external write automatically. |
| "The credential is bundled, so I can send immediately." | Bundled configuration removes setup only; document selection, dry-run, and final confirmation still apply. |

## Resource

- Execute `scripts/generate-demo.mjs`; do not reimplement the signing protocol in the conversation.
