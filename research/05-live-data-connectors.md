# Live Data And Connectors

## Thesis

Connectors should remove real manual loops, not maximize data access. V1 can allow broad future scope, but should start with low-risk, local, read-first sources.

## V1 Data Priority

Start with:

1. Local files and project documents.
2. Manual daily logs and captures.
3. Codex thread summaries.
4. Calendar exports or readable calendar state.
5. Browser-saved sources or manually captured URLs.
6. Project/task state.
7. Family/logistics notes.
8. Health/routine notes.
9. Travel plans.

Delay or keep read-only:

- finance
- contacts
- external sending/posting
- destructive file operations

## Connector Risk Tiers

### Tier 0: Local Static

Examples:

- markdown files
- JSON state
- downloaded PDFs
- copied notes

Default mode: automatic local indexing allowed.

### Tier 1: Local Dynamic

Examples:

- calendar exports
- browser captures
- local app export files

Default mode: read-only or draft-for-approval.

### Tier 2: External Read

Examples:

- email read access
- web search
- GitHub/Linear read
- Notion import later

Default mode: suggest-only or draft-for-approval.

### Tier 3: External Write

Examples:

- sending email
- changing calendar
- posting content
- updating external systems

Default mode: draft-for-approval only.

### Tier 4: Sensitive Write

Examples:

- finance
- contacts
- credentials
- legal/health records
- file deletion

Default mode: excluded from V1 or explicit approval with preflight and undo path.

## Permission Modes

- `observe`: read/index only.
- `suggest`: recommendation only.
- `draft`: prepare change but do not apply.
- `ask_approval`: require explicit approval.
- `act`: automatic low-risk only.

## Connector Selection Rule

Add a connector only when it satisfies all:

- removes a recurring manual loop
- has clear source identity
- can be logged
- can be disabled
- has narrow permissions
- has a review/undo path for writes

## Sources

- [Codex remote connections](https://developers.openai.com/codex/remote-connections)
- [Codex permissions](https://developers.openai.com/codex/permissions)
- [Codex app features](https://developers.openai.com/codex/app/features)
- [OpenAI MCP/connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

## Open Questions

- Should V1 read calendar from exports/manual files first?
- Should email be excluded until the review queue exists?
- Should contacts be modeled manually before connector access?
