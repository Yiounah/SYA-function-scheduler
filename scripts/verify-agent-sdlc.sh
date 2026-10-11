#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
ROOT="$(cd -- "$ROOT" && pwd)"
LOCK="$ROOT/agent-sdlc.lock.json"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

for command_name in node npm npx git uv; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing prerequisite: $command_name"
done
[[ -f "$LOCK" ]] || fail 'agent-sdlc.lock.json is missing'
EXPECTED_SKILLS="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(String(lock.opencode.skillCount))' "$LOCK")"
BMAD_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.bmad.version)' "$LOCK")"
TEA_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.tea.version)' "$LOCK")"
OPENCODE_VERSION="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.opencode.version)' "$LOCK")"
OPENCODE_INTEGRITY="$(node -e 'const lock = require(process.argv[1]); process.stdout.write(lock.opencode.npmIntegrity)' "$LOCK")"
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' || fail 'Node.js 22.12+ is unavailable'
node -e 'const [major, minor] = process.argv[1].split(".").map(Number); process.exit(major > 10 || (major === 10 && minor >= 9) ? 0 : 1)' "$(npm --version)" || fail 'npm 10.9+ is unavailable'
uv python find '>=3.11' >/dev/null || fail 'Python 3.11+ is unavailable to uv'
[[ "$(npm view "opencode-ai@${OPENCODE_VERSION}" dist.integrity)" == "$OPENCODE_INTEGRITY" ]] || \
  fail "OpenCode $OPENCODE_VERSION npm integrity differs from agent-sdlc.lock.json"

node "$ROOT/scripts/verify-agent-sdlc.mjs" "$ROOT"

manifest="$ROOT/_bmad/_config/manifest.yaml"
[[ -f "$manifest" ]] || fail 'BMAD manifest is missing'
grep -Fqx "  version: $BMAD_VERSION" "$manifest" || fail "BMAD $BMAD_VERSION is not installed"
grep -Fqx "    version: $TEA_VERSION" "$manifest" || fail "TEA $TEA_VERSION is not installed"
grep -q '^    channel: pinned$' "$manifest" || fail 'TEA is not pinned'
grep -q '^  - opencode$' "$manifest" || fail 'OpenCode target is not registered'
grep -q '^project_knowledge: "{project-root}/docs/bmad-project-knowledge"$' \
  "$ROOT/_bmad/bmm/config.yaml" || fail 'BMM project knowledge path is not customized'
grep -q '^tea_use_playwright_utils: false$' "$ROOT/_bmad/tea/config.yaml" || fail 'Playwright Utils must be disabled'
grep -q '^tea_use_pactjs_utils: false$' "$ROOT/_bmad/tea/config.yaml" || fail 'Pact.js Utils must be disabled'
grep -q '^test_stack_type: fullstack$' "$ROOT/_bmad/tea/config.yaml" || fail 'TEA stack is not fullstack'
grep -q '^ci_platform: github-actions$' "$ROOT/_bmad/tea/config.yaml" || fail 'TEA CI platform is not GitHub Actions'
grep -q '^test_framework: playwright$' "$ROOT/_bmad/tea/config.yaml" || fail 'TEA framework is not Playwright'
for config in "$ROOT/_bmad/core/config.yaml" "$ROOT/_bmad/bmm/config.yaml" "$ROOT/_bmad/tea/config.yaml"; do
  grep -q '^project_name: FocusFlow$' "$config" || fail "project name is not FocusFlow in $config"
done
grep -q '^project_name = "FocusFlow"$' "$ROOT/_bmad/config.toml" || fail 'project name is not FocusFlow in _bmad/config.toml'

skill_count=0
shopt -s nullglob
for skill_file in "$ROOT"/.agents/skills/*/SKILL.md; do
  ((skill_count += 1))
done
[[ "$skill_count" -eq "$EXPECTED_SKILLS" ]] || fail "expected $EXPECTED_SKILLS skills, found $skill_count"

uv run "$ROOT/_bmad/scripts/resolve_config.py" \
  --project-root "$ROOT" \
  --key modules.bmm.project_knowledge \
  --key modules.tea.test_stack_type \
  --key modules.tea.ci_platform \
  --key modules.tea.test_framework \
  --key modules.tea.tea_use_playwright_utils \
  --key modules.tea.tea_use_pactjs_utils \
  --key modules.tea.tea_pact_mcp \
  --key modules.tea.risk_threshold \
  --key core.project_name | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const config = JSON.parse(input);
      const expected = {
        "modules.bmm.project_knowledge": "{project-root}/docs/bmad-project-knowledge",
        "modules.tea.test_stack_type": "fullstack",
        "modules.tea.ci_platform": "github-actions",
        "modules.tea.test_framework": "playwright",
        "modules.tea.tea_use_playwright_utils": false,
        "modules.tea.tea_use_pactjs_utils": false,
        "modules.tea.tea_pact_mcp": "none",
        "modules.tea.risk_threshold": "p1",
        "core.project_name": "FocusFlow",
      };
      if (Object.entries(expected).some(([key, value]) => config[key] !== value)) process.exit(1);
    });
  ' || fail 'resolved BMAD/TEA project configuration is invalid'
for skill_name in \
  bmad-agent-analyst \
  bmad-agent-pm \
  bmad-agent-ux-designer \
  bmad-agent-architect \
  bmad-agent-dev \
  bmad-tea; do
  uv run "$ROOT/_bmad/scripts/resolve_customization.py" \
    --skill "$ROOT/.agents/skills/$skill_name" \
    --project-root "$ROOT" \
    --key agent.persistent_facts | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const facts = JSON.parse(input)["agent.persistent_facts"] || [];
        if (!facts.includes("file:{project-root}/docs/bmad-project-knowledge/README.md")) process.exit(1);
      });
    ' || fail "$skill_name does not resolve the FocusFlow project knowledge"
done

opencode_config="$(mktemp "${TMPDIR:-/tmp}/focusflow-opencode-config.XXXXXX")"
opencode_skills="$(mktemp "${TMPDIR:-/tmp}/focusflow-opencode-skills.XXXXXX")"
trap 'rm -f -- "$opencode_config" "$opencode_skills"' EXIT
(
  cd -- "$ROOT"
  npx --yes "opencode-ai@${OPENCODE_VERSION}" debug config --pure >"$opencode_config"
  npx --yes "opencode-ai@${OPENCODE_VERSION}" debug skill --pure >"$opencode_skills"
)
node -e '
  const fs = require("node:fs");
  const [outputPath, lockPath] = process.argv.slice(1);
  const config = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const expected = require(lockPath).opencode.skills;
  const commands = config.command && typeof config.command === "object" ? config.command : {};
  const collisions = expected.filter((name) => Object.hasOwn(commands, name));
  if (collisions.length) {
    console.error(`OpenCode commands shadow locked skills: ${collisions.join(", ")}`);
    process.exit(1);
  }
' "$opencode_config" "$LOCK" || fail 'OpenCode resolved command configuration shadows a locked BMAD skill'
node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const [outputPath, lockPath, root] = process.argv.slice(1);
  const discovered = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const expected = require(lockPath).opencode.skills;
  for (const name of expected) {
    const matches = discovered.filter((skill) => skill.name === name);
    const expectedLocation = path.join(root, ".agents", "skills", name, "SKILL.md");
    if (matches.length !== 1 || path.resolve(matches[0].location) !== expectedLocation) process.exit(1);
  }
' "$opencode_skills" "$LOCK" "$ROOT" || fail 'OpenCode did not discover every locked repository skill at its project path'
rm -f -- "$opencode_config" "$opencode_skills"
trap - EXIT

printf 'PASS: FocusFlow Agent SDLC, BMAD %s, TEA %s, %d repository skills discovered by OpenCode\n' \
  "$BMAD_VERSION" "$TEA_VERSION" "$skill_count"
