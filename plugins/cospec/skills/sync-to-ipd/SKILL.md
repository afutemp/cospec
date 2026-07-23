---
name: sync-to-ipd
description: Use when the user asks to synchronize cospec large-requirement TR1 and TR2 Epic, Feature, Story, or Tech Markdown deliverables to an existing IPD product, project, version, and team.
---

# Sync to IPD

**Skill 标识**: `sync-to-ipd`

Other skills reference this skill as `sync-to-ipd`.

## Overview

Preview and safely synchronize one complete cospec large-requirement artifact set through the deterministic provider bundled with this Skill. The provider reuses the co-located `qianliu-ipd` scripts inside the same cospec plugin; it does not require an MCP tool or nested Skill invocation.

## Hard Gates

- Support only a complete large-requirement set containing both TR1 documents and TR2 Epic, Feature, Story, and Tech documents.
- Execute `scripts/ipd-provider.cjs` for every IPD query, preview, and apply operation. Never treat `getProducts`, `syncManifest`, or another action name as an MCP tool.
- The provider must resolve the sibling `qianliu-ipd/scripts/` directory inside the installed cospec plugin. If it is unavailable, stop and tell the user to reinstall or update cospec. Do not install anything automatically.
- Read credentials only through the bundled IPD provider. Never request, print, persist, or place a Token in a command.
- Never create an IPD product, project, version, or deliverable. Never delete an IPD issue.
- Never write to IPD during discovery or preview.
- Require the literal reply `确认执行` after showing the final preview. No earlier request, short continuation, or previous confirmation authorizes apply.
- Apply only the confirmed `planHash`. Regenerate the preview after any local or remote drift.
- Do not retry failed writes automatically. Stop, preserve completed checkpoints, and report the remaining operations.

## Workflow

### 1. Select one artifact set

If the user supplies a path, inspect only that path. Otherwise search `product-planning/` under the current project root:

```bash
node <skill-dir>/scripts/sync-to-ipd.mjs --discover <search-root>
```

Show each complete set with both TR1 filenames and Epic, Feature, Story, and Tech counts. Select automatically only when exactly one complete set exists; otherwise ask the user to choose one.

Recognize both current hierarchical artifacts and legacy flat bundles such as `03-TR1用户需求说明书-评审版.md` plus `05-TR2-EPIC.md` through `08-TR2-Tech.md`. For a legacy bundle, materialize immutable per-item Markdown fragments under the chosen sync state directory; never upload one combined TR2 file as every issue description.

Prepare local state under `<artifact-root>/.ipd-sync/`:

```bash
node <skill-dir>/scripts/sync-to-ipd.mjs \
  --root <artifact-root> \
  --manifest <artifact-root>/.ipd-sync/manifest.json \
  --index <artifact-root>/.ipd-sync/index.json
```

Stop on any local conflict. Legacy documents without stable IDs require an explicit migration or binding decision; never match them from filenames alone.

If one legacy Tech document has no `TECH-*` ID or names multiple parents, show the candidate Feature and Story IDs and ask the user to choose one stable Tech ID and one IPD-compatible parent. After that explicit decision, regenerate the snapshot with:

```bash
node <skill-dir>/scripts/sync-to-ipd.mjs \
  --root <legacy-docs-root> \
  --manifest <state-root>/manifest.json \
  --index <state-root>/index.json \
  --legacy-output-root <state-root>/legacy-snapshot \
  --legacy-tech-id <user-confirmed-TECH-id> \
  --legacy-tech-parent-id <user-confirmed-parent-id>
```

Do not infer a single parent from a cross-Feature Tech document. Keep the other referenced Feature, Story, and Epic IDs in the generated description for traceability.

### 2. Resolve the existing IPD target

Set `<provider>` to `<this-skill-dir>/scripts/ipd-provider.cjs`. Execute its read-only actions to show names and statuses, then let the user select the existing product, project, version, and team. Do not require the user to know numeric IDs.

```bash
node <provider> --action getProducts --keyword <product-keyword>
node <provider> --action getProductProjects --product-id <product-id>
node <provider> --action getProjectVersions --project-id <project-id>
node <provider> --action getTeamsByProject --project-id <project-id>
```

These are CLI actions, not tool names. If the local index contains a previous target, show it and ask the user to confirm reuse.

### 3. Select TR1 destinations

Use the same provider to show the real stages, activities, and deliverables in the selected project version. Do not fuzzy-match a deliverable name.

```bash
node <provider> --action getProjectStages \
  --project-id <project-id> \
  --version-id <version-id>
node <provider> --action getStageActivities \
  --stage-id <stage-id> \
  --version-id <version-id>
node <provider> --action getActivityDeliverables \
  --activity-id <activity-id>
```

- Upload the TR1 review document to the deliverable explicitly selected by the user.
- Upload the TR1 AI context document as an attachment on the selected root Epic.
- If there is no suitable deliverable, upload both TR1 documents as attachments on the selected root Epic.
- Select the root Epic automatically only when the manifest has exactly one root Epic. Ask when it has more than one.

### 4. Preview

Execute the bundled provider in preview mode with the manifest and index paths, selected target IDs, TR1 routing, and `<artifact-root>/.ipd-sync/preview.md`:

```bash
node <provider> \
  --action syncManifest \
  --mode preview \
  --manifest <artifact-root>/.ipd-sync/manifest.json \
  --index <artifact-root>/.ipd-sync/index.json \
  --product-id <product-id> \
  --project-id <project-id> \
  --version-id <version-id> \
  --team-id <team-id> \
  --root-epic-artifact-id <root-epic-artifact-id> \
  --review-deliverable-id <deliverable-id> \
  --review-activity-id <activity-id> \
  --preview-file <artifact-root>/.ipd-sync/preview.md
```

When both TR1 documents route to the root Epic, omit `--review-deliverable-id` and `--review-activity-id`.

Show the target names, counts for create/update/upload/unchanged/conflict, TR1 destinations, and the plan hash. State that the plan will not delete issues, create project containers, or modify status, owner, or priority.

Treat these as blocking conflicts: same name without an index binding, missing or duplicate artifact ID, invalid indexed issue, type mismatch, parent mismatch, or invalid TR1 destination. Offer only these resolutions:

1. Bind the artifact to a user-selected existing IPD issue ID in the local index, then regenerate preview:

   ```bash
   node <skill-dir>/scripts/sync-to-ipd.mjs \
     --bind-index <artifact-root>/.ipd-sync/index.json \
     --artifact-id <artifact-id> \
     --issue-id <user-selected-ipd-id>
   ```
2. Correct the local artifact ID, type, name, or parent, then regenerate the manifest and preview.
3. Cancel.

### 5. Confirm and apply

Ask exactly:

```text
以上预览将创建 {create} 条、更新 {update} 条、上传 {upload} 份 TR1 文档。请回复“确认执行”或“取消”。
```

Only after `确认执行`, execute the identical provider command with `--mode apply` and `--expected-plan-hash <confirmed-plan-hash>`. Never call apply through an inferred action or a previous plan hash.

The provider applies Epic → Feature → Story → Tech → TR1 review → TR1 AI context. On failure, report the completed count, failed operation, and remaining work. A rerun must start with a fresh preview and skip unchanged checkpoints.

## Common Rationalizations

| Rationalization | Required response |
|---|---|
| “The user already said to sync.” | That authorizes preparation, not the final IPD writes. |
| “There is only one same-name issue.” | Same name is not stable identity; require an explicit binding. |
| “No deliverable matches, so create one.” | Creation is out of scope; use the root Epic attachment fallback. |
| “A network retry is probably safe.” | The write may have succeeded remotely; stop and re-preview. |
| “The old confirmation is close enough.” | Apply only the exact confirmed plan hash. |

## Resource

- Execute `scripts/sync-to-ipd.mjs` for deterministic artifact discovery, validation, hashing, and manifest generation.
- Execute `scripts/ipd-provider.cjs` for deterministic target discovery, preview, and apply through the bundled `qianliu-ipd` implementation. No IPD MCP tool is required.
