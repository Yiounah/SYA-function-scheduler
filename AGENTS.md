<!-- bmad:context -->
<!-- Core context written for the FocusFlow scheduler repository. Managed by bmad-project-context; refresh after material architecture or workflow changes. -->

## FocusFlow

FocusFlow is the user-facing desktop app in this repository and the SYA scheduler function (`id=scheduler`, `runtime=local-http`). It decomposes a long-horizon goal into stages and a next step the user can do now. Product and engineering source rules live in `docs/bmad-project-knowledge/README.md`; BMAD working artifacts go to ignored `_bmad-output/`, while accepted long-lived decisions return to the canonical repository documents.

## Policy

- Resolve specification authority by question, not by file age: use `docs/research-timeline-ui/` for accepted FocusFlow behavior, OpenAPI and `manifest.json` for the host contract, and executable tests for current behavior.
- Scheduler requirement IDs such as `SCH-001` are defined by the SYA-UI product analysis. This repository records the IDs it accepts or explicitly defers; do not vendor or silently rewrite the parent PRD from here.
- Flag contradictions and propose the owning document change; never silently merge stale status text with current code.
- Never hand-edit `_bmad/config.toml`, `_bmad/*/config.yaml`, or `.agents/skills/`; put durable team changes in `_bmad/custom/` and rerun `scripts/install-agent-sdlc.sh` for framework updates.
- The static UI may use only same-origin fetch and WebSocket. Electron owns process spawn, the dynamic port, and native integration. Never put service ports, filesystem access, native APIs, or credentials in `app/static/`.
- Never commit real credentials, recordings, screenshots, or private user data; use `.env.example` and GitHub secrets.
- Treat `.github/workflows/ci.yml` macOS packaging as side-effecting artifact production. The PR quality workflow is read-only and must not gain publish, deploy, or secret access.

## Research And Auto Update

- Before designing or implementing any requirement, and whenever a problem is encountered during execution, search the web for established solutions. Start with official documentation, then maintained open-source projects and reputable community discussions; cross-check important claims against the dependency versions actually used by this repository.
- Prefer a mature, actively maintained, license-compatible, and security-reviewed library, tool, protocol, or reference implementation over a custom replacement. Build a custom solution only when no suitable established option exists, keep it minimal, and record why the existing options were unsuitable. Never invent a complex framework from assumptions.
- Before substantive work on every task, inspect the worktree, current branch, configured remotes, upstream tracking branch, and recent commits, then run `git fetch --prune`. Fetch must update remote-tracking refs without rewriting the worktree.
- After fetching and before integration, review `HEAD..@{upstream}` commits and the task-relevant diff. Understand effects on requirements, architecture, dependencies, generated files, and the OpenAPI or manifest contract before updating the branch.
- Only when the worktree is clean, the current branch has an upstream, history is not divergent, and the update is a pure fast-forward, run `git merge --ff-only @{upstream}`. Afterward, re-read the updated status, log, documentation, and task-relevant code before planning edits.
- If the worktree is dirty, histories diverge, incoming work conflicts, or a non-fast-forward merge is required, preserve all local changes and ask before integration. Never auto-stash, rebase, reset, force-update, or overwrite files to synchronize.
- If the directory is not a Git repository, has no remote or upstream, or network access is unavailable, state that synchronization was skipped and continue from local state only when safe.
- This repository is itself the scheduler submodule consumed by SYA-UI. Fetching this repository does not move the parent gitlink. Shipping a change inside the parent app requires a separate reviewed pointer update in SYA-UI.

## Where Things Are

- Accepted timeline behavior: `docs/research-timeline-ui/`; operating guide: `docs/agent-sdlc.md`; curated rules: `docs/bmad-project-knowledge/README.md`
- Host contract: `api.openapi.json`, `manifest.json`, `module.json`, `config.example.json`
- Service: `app/` (`uvicorn app.main:app`); desktop UI: `app/static/`; Electron shell: `desktop/`; shared entry: `bin/scheduler-server`
- Voyage loop: `app/agents/voyage/`; tests: `tests/`

## Running And Verifying

- CI pins Node `22.17.1` from `.nvmrc`. Local framework verification also requires Git, uv, Python `>=3.11`, Node `>=22.12.0`, npm `>=10.9.0`, and network access or populated `npx` caches.
- App checks are `npm test`: Python unittest discovery plus `node --check` on the Electron shell. macOS packaging is `npm run app:dist:mac` and is not part of the read-only PR gate.
- A green unittest run proves the in-process service and task tree. It does not prove a packaged `.dmg`, code signing, or a live model provider.
- Without `SYA_OPENAI_API_KEY`, planning uses the built-in sample plan. Do not describe that path as a live GLM-5.3 decomposition.

## Conventions That Differ From Defaults

- Preserve accepted IDs `SCH-001`, `SCH-002`, and `SCH-003`, and local capabilities `CAP-1` through `CAP-5`, until an explicit spec change says otherwise. Deferred parent IDs `SCH-004` through `SCH-009` stay deferred unless the task accepts them.
- Keep mock-free sample planning and live model planning on the same task API. Do not add a second UI contract for the no-key path.
- `module.json` `sourceAnchors` still name parent-repository paths (`function/scheduler/`, `app/src/features/scheduler/`). They describe how SYA-UI locates this module; they are not a map of files inside this checkout.

## Known Pitfalls

- The parent PRD's implementation-status text can disagree with this repository. Verify claims here against `docs/research-timeline-ui/`, current code, and `tests/` before reporting progress.
- The remote default branch is `main`. `.github/workflows/ci.yml` runs tests on Ubuntu and builds a macOS package on push; passing `.github/workflows/pr-quality.yml` does not publish that package.
- `package.json` contains two `build` keys. JSON parsers keep the last one. Do not treat `npm run build` as an application bundle.
- The task model has no stored calendar fields. The desktop UI places leaves on the real system calendar from today, six hours per day, and shows that schedule as day, week, and month views. The service still stores one in-memory tree.
- macOS system `python3` is often 3.9. Framework and app tests need Python 3.11 or newer.

<!-- /bmad:context -->
