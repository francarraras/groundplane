# Contributing

## Setup

Requirements: Node 22+, Python 3.10+ (standard library only — tests use `unittest`).

```bash
npm install
npm run app:local        # cockpit at http://127.0.0.1:5175/app/
npm run verify:local     # full local verification
```

## Commands

| Command | What it does |
|---|---|
| `npm run app:local` | Dev server on a fixed port (5175) |
| `npm run app:local:check` | Health-check the running app |
| `npm run graph:build` | Recompile `indexes/relationship-graph.json` from state |
| `npm run test:python` | File-shape and workflow contract tests |
| `npm run test:graph` | Graph semantics assertions |
| `npm run test:product-world` | Render-model checks on synthetic fixtures |
| `npm run test:loader-contract` | Loader DI-seam + fixture-derived counts |
| `npm run test:layout-stability` | Positions/palette are id-stable (insertion moves no node) |
| `npm run test:context-bundle` | Context-bundle export: valid, capped, registered-source-only |
| `npm run test:operator` / `test:operator-propose` | Operator CLI `ask` and `propose`/`approve` |
| `npm run leak:scan` | Personal/secret string gate |
| `npm run verify:local` | All of the above + production build |
| `npm run lint` | ESLint (flat config, minimal high-signal rules) |
| `npm run format` / `format:check` | Prettier write / check (code + config; data and hand-formatted files are ignored) |
| `npm run typecheck` | `tsc --checkJs` on `scripts/lib` (JSDoc-typed public functions) |
| `npm run test:browser` | Fixture-based browser QA (needs a browser; see below) |

## Test suites (what guards what)

Verification is layered and runs entirely against the fictional demo fixtures — no snapshots of real data, no magic-number literals (counts are derived from the fixtures themselves):

- **Contract tests** (`tests/test_*.py`) assert file shapes, the permission matrix, the review-packet lifecycle, and the read-only invariant (source scan).
- **Structural verifiers** (`scripts/verify-*.mjs`, all in `verify:local`) assert graph semantics, render-model shape, the loader DI seam (`loadProductState(fetchImpl)`), layout order/insertion stability, the context-bundle contract, and the operator `ask`/`propose` paths.
- **Browser QA** (`tests/e2e/browser-qa.spec.js`, `npm run test:browser`) boots the real app in a headless browser and asserts structural invariants (area/connection counts from fixtures, export downloads a valid bundle) plus the **browser-write invariant at runtime** — it fails if any storage or non-GET write executes. Run it locally with a browser installed: `npx playwright install chromium && npm run test:browser`. It runs as its own CI job.

## The one rule that matters

**Generated vs authored files.** `indexes/` is generated — never edit it by hand; run `graph:build` after changing anything under `state/`, `sources/`, `reviews/`, or `wiki/`, and commit the rebuilt index (CI diffs it). Everything else is authored and owned by humans or the review gate.

## Code style

Vanilla ES modules, no framework, no build-time magic. The renderer and view-model are split panel-by-panel under `app/src/instruments/` and `app/src/viewModel/` (each file under ~800 lines); `instruments.js`/`viewModel.js` are thin barrels re-exporting the public API. New UI code should land as a focused module in the right folder, not grow a barrel. Python tests intentionally use only the standard library.

## Changing UI copy

Several contract tests assert user-facing strings and even source substrings. If you rename copy, update the corresponding assertions in the same PR — `npm run verify:local` will point at them.

## Demo fixtures

The demo workspace ("Ridgeline Studio") is hand-authored fiction. Keep it that way: no real names, companies, absolute paths, or non-reserved email domains — `npm run leak:scan` enforces the obvious cases. Every record needs `source_ids` that resolve to `sources/catalog.json` entries, or the compiler will drop it with a warning (CI requires zero warnings).

## Pull requests

Small, focused, green `verify:local`. If you touch the review-gate library (`scripts/lib/review-packet.mjs`), include a rejection-path test for any new validation.
