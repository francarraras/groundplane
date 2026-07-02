# Security model

Groundplane is a **local-first, single-user** tool. Understanding what that does and does not guarantee:

## Guarantees (enforced by code + tests)

- **The browser surface writes nothing.** No localStorage/sessionStorage/indexedDB, no POST/PUT/PATCH/DELETE, no beacons, no cookies. This is enforced two ways: contract tests scan the app source (`tests/test_product_app_contract.py`) and fail if any mutation API appears, and a fixture-based browser-QA test (`tests/e2e/browser-qa.spec.js`) drives the running app in a headless browser and fails if any storage or non-GET-fetch write executes at runtime. The list of permitted storage keys (`tests/e2e/allowed-storage-keys.js`) is empty — adding an unauthorized write breaks CI.
- **The only write path is the review gate.** Queue entries are shape-validated, path-allowlisted (traversal-safe, repo-relative), deduplicated, and require explicit human resolution with actor/reason/undo recorded. The operator CLI (`atlas propose`/`approve`) routes agent-drafted changes through this same validator.
- **No telemetry, no network calls.** The app's only I/O is `fetch()` of local JSON from the local dev server. There are no analytics, no external requests, no accounts.
- **Leak scanning in CI.** Every push is scanned for secret-shaped strings (API keys, tokens, private-key blocks), absolute home paths, and email addresses (reserved `.example`-style fiction domains excepted). Deployment-specific denylist words are injected via the `LEAK_SCAN_EXTRA` CI secret so the denylist itself never ships.

## Boundaries (know these before trusting it with real data)

- **The dev server serves local directories over HTTP on 127.0.0.1.** `vite.config.js` restricts serving to the app and data directories (`app/`, `state/`, `reviews/`, `wiki/`, `sources/`, `indexes/` + `node_modules`), bound to loopback. Anything you place in those directories is readable by local processes that can reach localhost while the server runs.
- **"Read-only" describes the browser, not the machine.** Node scripts (the compiler, the queue CLIs) write files by design. Review what you run.
- **No authentication.** This is a single-user local tool; do not expose the dev server to a network.
- **Demo data is fictional.** Everything in `state/`, `sources/`, `reviews/`, `wiki/`, `logs/` describes "Ridgeline Studio", an invented team. Replace it with your own data knowingly.

## Reporting

Found a vulnerability or a leak-scan gap? Open a GitHub issue with the `security` label (no sensitive details), or use GitHub's private vulnerability reporting on this repository.
