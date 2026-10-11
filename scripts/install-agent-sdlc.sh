#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCK="$ROOT/agent-sdlc.lock.json"
COMMUNICATION_LANGUAGE="Chinese"
DOCUMENT_LANGUAGE="Chinese"

for command_name in node npm npx git uv; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing prerequisite: %s\n' "$command_name" >&2
    exit 1
  fi
done

[[ -f "$LOCK" ]] || {
  printf 'Missing version lock: %s\n' "$LOCK" >&2
  exit 1
}

BMAD_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.bmad.version)' "$LOCK")"
BMAD_INTEGRITY="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.bmad.npmIntegrity)' "$LOCK")"
TEA_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.tea.version)' "$LOCK")"
TEA_COMMIT="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.tea.commit)' "$LOCK")"
TEA_REPOSITORY="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.tea.repository)' "$LOCK")"
OPENCODE_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.opencode.version)' "$LOCK")"

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  printf 'Node.js 22.12 or newer is required; found %s\n' "$(node --version)" >&2
  exit 1
fi

if ! node -e 'const [major, minor] = process.argv[1].split(".").map(Number); process.exit(major > 10 || (major === 10 && minor >= 9) ? 0 : 1)' "$(npm --version)"; then
  printf 'npm 10.9 or newer is required; found %s\n' "$(npm --version)" >&2
  exit 1
fi

uv python find '>=3.11' >/dev/null

PUBLISHED_BMAD_INTEGRITY="$(npm view "bmad-method@${BMAD_VERSION}" dist.integrity)"
[[ "$PUBLISHED_BMAD_INTEGRITY" == "$BMAD_INTEGRITY" ]] || {
  printf 'BMAD %s npm integrity differs from agent-sdlc.lock.json\n' "$BMAD_VERSION" >&2
  exit 1
}

if ! IFS=$'\t' read -r RESOLVED_TEA_COMMIT _ < <(
  git ls-remote "$TEA_REPOSITORY" "refs/tags/${TEA_VERSION}^{}"
); then
  printf 'Cannot resolve TEA tag %s from %s\n' "$TEA_VERSION" "$TEA_REPOSITORY" >&2
  exit 1
fi
[[ "$RESOLVED_TEA_COMMIT" == "$TEA_COMMIT" ]] || {
  printf 'TEA tag %s resolved to %s, expected %s\n' "$TEA_VERSION" "$RESOLVED_TEA_COMMIT" "$TEA_COMMIT" >&2
  exit 1
}

npx --yes "bmad-method@${BMAD_VERSION}" install \
  --yes \
  --directory "$ROOT" \
  --modules bmm,tea \
  --tools opencode \
  --pin "tea=${TEA_VERSION}" \
  --no-shims \
  --user-name "SYA Team" \
  --communication-language "$COMMUNICATION_LANGUAGE" \
  --document-output-language "$DOCUMENT_LANGUAGE" \
  --output-folder _bmad-output \
  --set "bmm.project_knowledge=docs/bmad-project-knowledge" \
  --set "tea.test_stack_type=fullstack" \
  --set "tea.ci_platform=github-actions" \
  --set "tea.test_framework=playwright" \
  --set "tea.tea_use_playwright_utils=false" \
  --set "tea.tea_use_pactjs_utils=false" \
  --set "tea.tea_pact_mcp=none" \
  --set "tea.risk_threshold=p1"

# The installer infers a directory name. Keep the product identity explicit.
node -e '
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[1];
const updates = [
  ["_bmad/config.toml", /^project_name = ".*"$/m, "project_name = \"FocusFlow\""],
  ["_bmad/core/config.yaml", /^project_name: .*$/m, "project_name: FocusFlow"],
  ["_bmad/bmm/config.yaml", /^project_name: .*$/m, "project_name: FocusFlow"],
  ["_bmad/tea/config.yaml", /^project_name: .*$/m, "project_name: FocusFlow"],
];
for (const [relativePath, pattern, replacement] of updates) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, "utf8");
  if (!pattern.test(original)) {
    console.error(`Missing project_name in ${relativePath}`);
    process.exit(1);
  }
  const next = original.replace(pattern, replacement);
  if (next !== original) fs.writeFileSync(filePath, next);
}
' "$ROOT"

# BMAD 6.12 serializes false single-select values as strings. Normalize the
# generated compatibility configs before skills consume them.
node "$SCRIPT_DIR/normalize-agent-sdlc-config.mjs" "$ROOT"

# BMAD 6.12 pointers shadow OpenCode's native skill-backed commands.
shopt -s nullglob
for pointer in "$ROOT"/.opencode/commands/bmad-*.md; do
  if node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const filePath = process.argv[1];
    const expectedName = path.basename(filePath, ".md");
    const contents = fs.readFileSync(filePath, "utf8");
    const match = contents.match(/^---\r?\ndescription: [^\r\n]+\r?\n---\r?\n\r?\n@skills\/(bmad-[a-z0-9-]+)\r?\n?$/);
    process.exit(match?.[1] === expectedName ? 0 : 1);
  ' "$pointer"; then
    rm -f -- "$pointer"
  else
    printf 'Refusing to remove non-generated OpenCode command: %s\n' "$pointer" >&2
    exit 1
  fi
done
rmdir "$ROOT/.opencode/commands" 2>/dev/null || true
rmdir "$ROOT/.opencode" 2>/dev/null || true

"$SCRIPT_DIR/verify-agent-sdlc.sh" "$ROOT"

printf 'FocusFlow Agent SDLC installed and verified at %s\n' "$ROOT"
printf 'Validated with OpenCode %s\n' "$OPENCODE_VERSION"
