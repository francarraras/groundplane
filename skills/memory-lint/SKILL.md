---
name: memory-lint
description: Audit Groundplane memory for stale claims, contradictions, unsupported summaries, and unsafe persistent context.
---

# Memory Lint

## Trigger

Use before promoting memory, during weekly review, or after importing external material.

## Inputs

- `sources/`
- `wiki/`
- `state/`
- `reviews/`

## Process

1. Find claims without sources.
2. Find stale or contradicted claims.
3. Identify sensitive memory without approval mode.
4. Flag orphan wiki pages and decisions without deadlines.
5. Draft review items for the user.

## Output

- lint findings
- contradiction ledger
- proposed review items
- recommended deletes/decays

## Permission Mode

`suggest-only`

## Run Packet

Return a reviewable packet with:

- `run_id`
- `workflow`
- `trigger`
- `permission_mode`
- `input_files`
- `source_ids`
- `findings`
- `review_items`
- `log_entries`
- `blocked_by`

Use `logs/operations.jsonl` for the run log. Memory corrections, supersessions, decays, and deletes must be proposed through `reviews/queue.json` before `logs/memory-events.jsonl` changes.

## Failure Handling

- Unsupported claim: create a review item and do not treat it as truth.
- Contradiction: create a review item with both claims and source IDs.
- Sensitive memory: require explicit approval before persistence.
- Permission boundary: stop and request approval through `reviews/queue.json`.
