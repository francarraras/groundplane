---
name: project-review
description: Review active Groundplane projects for health, next actions, blockers, and proof gaps.
---

# Project Review

## Trigger

Use during weekly review, when a project stalls, or when the user asks for project status.

## Inputs

- `state/board.json`
- project state files
- recent logs
- review queue

## Process

1. Check each active project for next action, blocker, deadline, and proof.
2. Flag stale or vague projects.
3. Recommend promote, pause, archive, or escalate.
4. Draft board updates if needed.

## Output

- project health summary
- stale projects
- blockers
- next actions
- proposed updates

## Permission Mode

`suggest-only` for analysis, `draft-for-approval` for state changes

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

Use `logs/operations.jsonl` for the run log. Health, owner, status, or next-action changes must be proposed through `reviews/queue.json`.

## Failure Handling

- Stale task: flag it and draft a review item for status or next-action changes.
- Missing source: mark affected recommendation as unsupported.
- Contradiction: draft a review item instead of silently resolving.
- Permission boundary: stop and request approval through `reviews/queue.json`.
