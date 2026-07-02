# Second Brain Architecture

## Thesis

The second brain should be a compiled operating memory over immutable raw sources. Raw sources are the truth. The wiki is the assistant's working map. The app renders operational state from both.

This is not flat RAG and not a pure Obsidian vault. RAG is useful for lookup, but weak as the main model for multi-hop personal reasoning. A compiled wiki is useful for synthesis, but dangerous if it silently drops facts. Therefore V1 must be source-backed, reviewable, and conservative.

## Source Layers

```text
sources/  -> immutable raw truth
inbox/    -> unprocessed captures and proposed memory changes
state/    -> current operating state
wiki/     -> compiled working memory
indexes/  -> generated search/backlink artifacts
logs/     -> append-only operation history
reviews/  -> pending approvals and diffs
skills/   -> reusable Codex workflows
```

## Layer Responsibilities

### `sources/`

Append-only raw truth:

- user notes
- Codex session summaries
- pasted research
- files/documents
- decisions
- approvals
- rejected suggestions
- future imports

Rule: Codex may read sources, but should not rewrite them.

### `inbox/`

Triage buffer for:

- new tasks
- possible memories
- contradictions
- source ingests
- automation ideas
- uncertain claims

Rule: nothing becomes durable memory without triage.

### `state/`

Current operating state:

- today
- projects
- tasks
- routines
- decisions
- waiting-on
- permissions
- active automations

Rule: this powers the app.

### `wiki/`

Compiled working memory:

- Projects
- Areas
- Resources
- Archives
- people/entities later
- preferences
- decision logs
- procedures
- concepts
- operating rules

Rule: compiled memory must link to sources.

### `indexes/`

Generated artifacts:

- full-text index
- backlinks
- source map
- stale page report
- contradiction ledger

Rule: start with deterministic local search and SQLite FTS before embeddings.

### `logs/`

Append-only audit:

- ingest events
- memory changes
- assistant recommendations
- approved actions
- rejected actions
- automation runs

Rule: every important assistant move should be reconstructable.

## Required Metadata

Every memory, task, claim, and decision should carry:

- `id`
- `type`
- `source_id`
- `created_at`
- `updated_at`
- `last_verified_at`
- `domain`
- `confidence`
- `status`
- `sensitivity`
- `approval_mode`
- `supersedes`
- `contradicts`
- `review_date`

## Memory Classes

- Facts
- Preferences
- Goals
- Commitments
- Routines
- Projects
- Decisions
- Hypotheses
- Procedures
- Sensitive records

## Operating Loop

```text
Capture raw event
-> classify
-> draft memory/task/decision update
-> show diff in Review
-> approve or revise
-> consolidate into state/wiki
-> update indexes
-> run lint/probes
-> log operation
```

## Lint Rules

Run periodic checks for:

- stale claims
- unsupported summaries
- missing citations
- contradictions
- orphan pages
- dead projects
- tasks without next action
- decisions without deadline
- memory without source
- sensitive memory without approval mode

## V1 Storage Recommendation

Use a hybrid:

- Markdown for readable wiki and source notes.
- JSONL for append-only logs and event streams.
- JSON for simple state files.
- SQLite later if search/query complexity requires it.

Do not start with vector search. V1 has no custom OpenAI API backend, and deterministic local retrieval is easier to inspect.

## Sources

- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Retrieval as Reasoning / LLM-Wiki](https://arxiv.org/abs/2605.25480)
- [WiCER](https://arxiv.org/abs/2605.07068)
- [Memory as Metabolism](https://arxiv.org/abs/2604.12034)
- [PARA method](https://fortelabs.com/blog/para/)
- [MemGPT](https://arxiv.org/abs/2310.08560)
- [Mem0](https://arxiv.org/abs/2504.19413)
- [Zep temporal memory](https://arxiv.org/abs/2501.13956)

## Open Questions

- Should memory writes always require approval in V1?
- Which raw sources enter first: Codex threads, manual notes, calendar exports, files, or browser captures?
- What should decay automatically?
- What should never be remembered?
