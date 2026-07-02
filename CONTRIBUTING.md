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
| `npm run leak:scan` | Personal/secret string gate |
| `npm run verify:local` | All of the above + production build |

## The one rule that matters

**Generated vs authored files.** `indexes/` is generated — never edit it by hand; run `graph:build` after changing anything under `state/`, `sources/`, `reviews/`, or `wiki/`, and commit the rebuilt index (CI diffs it). Everything else is authored and owned by humans or the review gate.

## Code style

Vanilla ES modules, no framework, no build-time magic. Two legacy modules are oversized (`instruments.js`, `viewModel.js`) — a panel-by-panel split is tracked in the issues; new UI code should land as separate modules, not grow those files. Python tests intentionally use only the standard library.

## Changing UI copy

Several contract tests assert user-facing strings and even source substrings. If you rename copy, update the corresponding assertions in the same PR — `npm run verify:local` will point at them.

## Demo fixtures

The demo workspace ("Ridgeline Studio") is hand-authored fiction. Keep it that way: no real names, companies, absolute paths, or non-reserved email domains — `npm run leak:scan` enforces the obvious cases. Every record needs `source_ids` that resolve to `sources/catalog.json` entries, or the compiler will drop it with a warning (CI requires zero warnings).

## Pull requests

Small, focused, green `verify:local`. If you touch the review-gate library (`scripts/lib/review-packet.mjs`), include a rejection-path test for any new validation.
