# Workflow Run Protocol

Project-owned skills run as reviewable packets. They should never make invisible durable changes.

## Run Packet

Every workflow output should include:

- `run_id`
- `workflow`
- `trigger`
- `actor`
- `started_at`
- `permission_mode`
- `input_files`
- `source_ids`
- `findings`
- `proposed_state_changes`
- `review_items`
- `log_entries`
- `blocked_by`

## Standard Steps

1. Preflight: identify workflow, permission mode, target files, and source IDs.
2. Read: load required state files, `sources/catalog.json`, `reviews/queue.json`, and relevant logs.
3. Classify: mark findings as `info`, `risk`, `contradiction`, `missing-source`, `stale`, `permission-boundary`, or `proposed-change`.
4. Produce output: return a human-readable summary plus machine-updatable proposals.
5. Propose changes: durable memory, state, external, or sensitive changes go to `reviews/queue.json`.
6. Log: append each run to `logs/operations.jsonl`; memory events also use `logs/memory-events.jsonl`.
7. Promote only after approval: no automatic memory promotion in V0.

## Failure Handling

- Contradiction: create a review item with both claims, source IDs, confidence, and recommendation.
- Missing source: block durable memory promotion.
- Stale task: flag in brief/review; draft a review item for state changes.
- Permission boundary: stop before action and request approval with target, risk, and undo path.

## Cadence

Manual first:

- Daily brief: manual daily until useful three times.
- Project review: manual weekly.
- Source ingest: manual per source.
- Memory lint: manual before promotion and weekly.

Automation comes later only after repeated useful manual runs and clear permission modes.
