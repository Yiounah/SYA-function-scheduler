# Agent SDLC And GitHub Quality Gates

FocusFlow uses a repository-local BMAD and TEA installation so product discovery, specification, UX, architecture, implementation, review, testing, and evidence handoff share the same project rules.

## Installed Toolchain

| Component | Pin |
| --- | --- |
| BMAD Core and BMM | `6.12.0` |
| Test Engineering Architecture (TEA) | `v1.24.0`, commit `7ba2130193c473b53d2e323b4da9a80697eef88e` |
| OpenCode validation target | `1.18.29` |
| CI uv validation target | `0.12.10` |
| Repository skills | 39 under `.agents/skills/` |

The machine-readable pins are in `agent-sdlc.lock.json` and `_bmad/_config/manifest.yaml`. The lock also records npm package integrities, the TEA commit, the expected `_bmad` file inventory, the complete skill-payload digest, and GitHub Action commit SHAs. Installer-managed files live under `_bmad/` and `.agents/skills/`; repository-specific overrides live under `_bmad/custom/`.

## Start A Workstream

Restart OpenCode after installing or updating skills, then launch the pinned version from the repository root when a global binary is unavailable:

```bash
npx --yes opencode-ai@1.18.29 .
```

Start with `/bmad-help`. A full product change normally moves through product brief or focused spec, PRD and UX impact, architecture, epics and sprint planning, test design or ATDD, build, code review, test review, trace, walkthrough, and retrospective. Brownfield fixes may use a shorter path, but still need an explicit requirement or user request, acceptance criteria, and evidence.

BMAD drafts are written under ignored `_bmad-output/`. Merge accepted durable requirements into `docs/research-timeline-ui/` or a new document under `docs/`, and executable acceptance into `tests/`. Do not treat generated planning output as a second active PRD. Parent SYA requirement IDs stay owned by SYA-UI.

## GitHub Handoff

Open a PR with `.github/pull_request_template.md` completed. At minimum, identify requirement IDs or the explicit user request, acceptance criteria, changed contracts, evidence level, and whether the parent SYA-UI gitlink must move. Template completion is reviewer-enforced; the read-only workflow does not interpret free-form PR text.

`.github/workflows/pr-quality.yml` runs without deployment credentials and has read-only repository permissions:

| Check | Evidence |
| --- | --- |
| Agent SDLC and specification contracts | Tool pins, complete 39-skill payload, FocusFlow project identity, accepted spec IDs, and the root OpenAPI / manifest contract |
| App contracts and tests | `npm ci`, Python 3.11 dependency install, `npm test` |
| PR Quality Gate | Aggregate result for branch protection |

`npm test` is Python unittest discovery plus a syntax check of the Electron shell. It does not install or launch a packaged app. `.github/workflows/ci.yml` still builds the macOS package on push; that workflow is separate from the PR gate and must not be folded into the read-only check.

Configure the repository ruleset to require `PR Quality Gate` on `main` and enable merge-queue checks if the repository uses a merge queue. Require code-owner review for `.github/workflows/`, `scripts/verify-agent-sdlc.mjs`, `agent-sdlc.lock.json`, and the package scripts that the gate executes, or enforce the gate as an organization-level required workflow. Otherwise a PR can weaken the in-repository check that evaluates it. GitHub-side rules cannot be inferred from the local clone; verify `main` in repository settings.

The PR workflow never publishes releases, uploads the macOS package, or reads `SYA_OPENAI_API_KEY`. Packaging remains in `.github/workflows/ci.yml`.

## Local Verification

Install Git, uv with Python `>=3.11`, Node `>=22.12.0`, and npm `>=10.9.0`. OpenCode validation uses pinned `npx` packages and therefore needs network access or populated npm caches. Then run the framework and repository-governance checks:

```bash
scripts/verify-agent-sdlc.sh
```

Before the framework files are committed, local verification reports untracked installation files as an atomic-commit note. `CI=true` or `node scripts/verify-agent-sdlc.mjs --strict-tracked` promotes the same condition to a failure so a partial installation cannot pass the repository gate.

Run `npm test` for service and shell-syntax evidence. Use `npm run app:dev` for the current desktop UI, and `npm run app:dist:mac` only when acceptance criteria require a packaged Mac app. Record a missing model key, unsigned local build, or skipped package run as a gap rather than a pass.

## Updating The Installation

Change version, package-integrity, TEA commit, and GitHub Action pins deliberately in `agent-sdlc.lock.json`, update matching workflow references and the installed-toolchain table above, then run:

```bash
scripts/install-agent-sdlc.sh
```

The installer and verifier read tool versions from the lock. The installer regenerates `_bmad/config.toml`, module configuration, and `.agents/skills/`, pins the product name back to FocusFlow, refreshes normalized configuration hashes, and preserves `_bmad/custom/`. For an intentional BMAD or TEA upgrade, review the generated skill payload before updating its file count and SHA-256 in the lock. Update the locked `_bmad` inventory when deliberately adding or removing a tracked team override. Never replace pins with `latest`; review generated diffs and run the full verifier before proposing an upgrade.
