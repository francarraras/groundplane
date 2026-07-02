# V0 State Schema

## Purpose

The V0 schema creates the first app-readable operating layer for Groundplane. It keeps raw sources, working state, compiled memory, approvals, and logs separated so the operator agent can act without turning memory into an unreviewable notes vault.

## Layers

- `sources/`: raw source truth and source catalog.
- `state/`: current operational state for projects, tasks, proof artifacts, routines, and decisions.
- `reviews/`: proposed memory, state, or action changes waiting for approval.
- `wiki/`: compiled working memory and human-readable index pages.
- `logs/`: append-only operating history.

## Core Files

| File | Collection | Purpose |
| --- | --- | --- |
| `sources/catalog.json` | `sources` | Indexes raw sources that claims and state can cite. |
| `state/projects.json` | `projects` | Tracks active project operating state. |
| `state/tasks.json` | `tasks` | Tracks atomic execution items. |
| `state/proof-artifacts.json` | `proof_artifacts` | Tracks local proof packages with status, verification, limitations, local paths, and approval boundaries. |
| `state/routines.json` | `routines` | Tracks recurring operating cadences. |
| `state/decisions.json` | `decisions` | Tracks locked and unresolved decisions. |
| `reviews/queue.json` | `reviews` | Tracks proposed changes that need approval or rejection. |
| `wiki/memory-claims.json` | `memory_claims` | Stores durable memory claims with sources and approval status. |
| `wiki/index.md` | Markdown | Human-readable map of compiled memory. |
| `logs/operations.jsonl` | JSONL | Append-only operator operations audit trail. |
| `logs/memory-events.jsonl` | JSONL | Append-only memory promotion/correction trail. |

## Dashboard Read Order

The future V1 cockpit should read app state in this order:

1. `state/projects.json`
2. `state/tasks.json`
3. `state/proof-artifacts.json`
4. `reviews/queue.json`
5. `state/decisions.json`
6. `state/routines.json`
7. `wiki/memory-claims.json`

`state/board.json` remains the build board for this project. The future assistant cockpit should use the V0 state files above as its operating data.

## Guardrails

- Every memory claim must have at least one `source_id`.
- Every review item must have `status`, `risk`, `target_file`, and `approval_mode`.
- Every source catalog entry must point to an existing raw source path.
- No automatic memory promotion in V0.
- Finance and contacts stay as future placeholders until permissioning is proven.
