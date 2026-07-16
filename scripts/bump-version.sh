#!/usr/bin/env bash
# Archive-level wrapper for per-plugin version bumping.
# Currently only cospec plugin is managed; extend this when more plugins are added.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_SCRIPT="$REPO_ROOT/plugins/cospec/scripts/bump-version.sh"

if [[ ! -f "$PLUGIN_SCRIPT" ]]; then
  echo "error: plugin bump script not found at $PLUGIN_SCRIPT" >&2
  exit 1
fi

exec "$PLUGIN_SCRIPT" "$@"
