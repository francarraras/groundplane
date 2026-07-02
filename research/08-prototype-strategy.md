# Prototype Strategy

## Thesis

Build the smallest local system that feels like an operating cockpit and can be improved by Codex every week. Do not build a custom AI API product in V1.

## V0: Source And Operating Contract

Goal: create the local source-of-truth and Codex operating rules.

Create:

- `AGENTS.md`
- `state/`
- `sources/`
- `inbox/`
- `wiki/`
- `logs/`
- `reviews/`
- `skills/`

Minimum workflows:

- source ingest
- daily brief
- project update
- weekly review
- memory lint

Success:

- Codex can read the repo and know how to operate it.
- The user can add captures and get structured outputs.
- Important changes are visible as diffs.

## V1: Local Browser Cockpit

Goal: app-first daily use.

Screens:

- Today
- Projects
- Triage/Approvals
- Brain
- Routines/Reviews
- Assistant

Architecture:

- app renders local state files
- Codex edits state and wiki files
- review queue shows pending proposals
- no custom OpenAI API backend
- optional local server only for serving UI/state

Success:

- user can open the app and see what matters today in 10 seconds
- projects at risk are visible
- approvals are visible
- assistant recommendations are visible
- no markdown tree dominates

## V2: Codex Workflow Integration

Goal: make Codex operation smoother.

Add:

- repo skills
- command shortcuts
- generated run logs
- better review diffs
- local search/index
- scheduled manual workflows

Consider:

- Codex app-server if available and practical
- read-only connector experiments
- thread/automation routing

Success:

- daily and weekly loops run reliably
- memory updates are reviewable
- app reflects changes without manual file digging

## V3: Permissioned Automation

Goal: allow low-risk automatic execution.

Add:

- automation registry
- per-domain permission modes
- action preflight
- approval history
- rollback/undo notes
- red-team probes

Only then consider:

- email actions
- calendar writes
- contact workflows
- finance visibility

## Recommended Build Sequence

1. Lock schema.
2. Add `AGENTS.md`.
3. Add initial state files.
4. Add skills for daily brief, project review, source ingest, and memory lint.
5. Build static/local browser UI over state.
6. Add review queue.
7. Add local search.
8. Add automation registry.

## Build / No-Build Decision Criteria

Build if:

- the Today cockpit can be useful without live connectors
- manual Codex workflows produce durable state
- review queue reduces chaos
- user wants to return to the app daily

Stop or redesign if:

- it becomes a markdown vault
- chat becomes the main UI
- state files are too hard to maintain
- approvals are hidden
- the assistant cannot explain sources

## Open Questions

- Should V0 be markdown/JSON only, or start with SQLite?
- Should V1 app be static HTML/JS first or a small Python/Node local server?
- Should Codex app-server be researched as a direct integration before or after the first UI?
