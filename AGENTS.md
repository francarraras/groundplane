# Agent operator contract

This file is the operating contract for any AI agent (or automation) working on a Groundplane workspace — including agents contributing to this repository.

## You may, freely

- Read every file in the workspace.
- Run `npm run graph:build`, the test suites, and `npm run verify:local`.
- Draft review-packet **previews** and propose changes.

## You may only through the gate

- Change authored state (`state/`, `sources/`, `wiki/`, `reviews/`): file a review packet via `scripts/create-review-queue-entry.mjs` and wait for a human to resolve it with `scripts/resolve-review-queue-entry.mjs`. After approval, apply exactly the approved diff, append an operations log line, and run `graph:build`.

## You may never

- Write from the browser surface, or add any code path that lets the browser persist anything. The read-only invariant is contract-tested; do not weaken those tests.
- Hand-edit `indexes/` (generated), rewrite raw sources (`raw_source_rewrite` is a forbidden action in the permission matrix), or bypass the queue "just this once."
- Commit personal data, secrets, absolute home paths, or real-world identities into fixtures or docs — `npm run leak:scan` is part of verification and CI.

## Ground rules

Local files are the source of truth. Every durable claim needs a `source_ids` trail into `sources/catalog.json`. Prefer proposing small, reversible packets with an explicit `undo_path`. When in doubt, propose — don't act.
