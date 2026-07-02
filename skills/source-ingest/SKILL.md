---
name: source-ingest
description: Ingest raw source material into the workspace without silently promoting it to durable memory.
---

# Source Ingest

## Trigger

Use when new source material is added to `sources/` or pasted into an operator thread.

## Inputs

- raw source file
- existing `wiki/`
- existing `state/`
- `reviews/`

## Process

1. Identify source type and trust level.
2. Summarize useful content.
3. Extract proposed memories, tasks, decisions, and contradictions.
4. Create reviewable proposals instead of silently writing durable memory.
5. Link every proposed claim to the source.

## Output

- source summary
- proposed memory changes
- contradictions
- follow-up questions

## Permission Mode

`draft-for-approval`

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

Use `logs/operations.jsonl` for the run log. Use `reviews/queue.json` for catalog, memory, task, or decision proposals. Do not automatically promote memory.

## Failure Handling

- Missing source: block ingest and report the missing path.
- Contradiction: create a review item with old claim, new evidence, and source IDs.
- Sensitive source: mark sensitivity and require explicit approval.
- Permission boundary: stop before writing and request approval through `reviews/queue.json`.
