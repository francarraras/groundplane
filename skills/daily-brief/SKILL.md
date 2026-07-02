---
name: daily-brief
description: Produce the Groundplane morning brief from local project state, active tasks, routines, risks, and approvals.
---

# Daily Brief

## Trigger

Use when the user asks for a morning brief, daily startup, or "what should I do today?"

## Inputs

- `state/board.json`
- active project state files
- open review items
- recent logs

## Process

1. Identify top commitments and deadlines.
2. Surface project risks and blocked items.
3. List approvals waiting for the user.
4. Recommend the top 3 outcomes.
5. Give one strict chief-of-staff recommendation.

## Output

Return a concise brief with:

- Today
- Risks
- Approvals
- Top 3 outcomes
- One hard recommendation

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

Use `logs/operations.jsonl` for the run log. Do not write durable state directly; proposed state changes become `review_items`.

## Failure Handling

- Missing source: mark `missing-source` and do not promote memory.
- Stale task: flag it and draft a review item if state should change.
- Contradiction: create a review item with both sides and source IDs.
- Permission boundary: stop and request approval through `reviews/queue.json`.
