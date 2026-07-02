# Groundplane

**See everything. Approve anything. Your agent touches nothing without clearance.**

Groundplane is a local-first cockpit for agent-operated work. It compiles plain JSON files — your projects, tasks, decisions, sources, and approvals — into an explorable spatial map with evidence trails, permission modes, and a review queue. The human surface is **read-only by design**: the browser app provably writes nothing, and an agent can only change your workspace through validated, human-approved review packets.

> Demo GIF coming with v0.1.0 — run the 60-second quickstart below to see it live.

## Why

Delegating real work to AI agents has an oversight problem: either you read every diff in a terminal, or you stop looking. Groundplane takes a third position — your workspace is plain files on your disk, a deterministic compiler turns them into a relationship graph, and a spatial cockpit renders that graph so state, provenance, and pending approvals are visible *in place*. Intelligence lives outside the trusted surface. The surface itself cannot act.

## Quickstart (60 seconds, no config, no API key)

```bash
git clone <this-repo>
cd groundplane
npm install
npm run app:local
```

Open **http://127.0.0.1:5175/app/** — you'll land in a demo workspace: *Ridgeline Studio*, a fictional two-person team shipping their app "Skylark 1.0". Health-check the server anytime with `npm run app:local:check`.

Things to try:

1. Fly the map — clusters are domains of work; click any node for details.
2. Open a task's **evidence trail** — every claim resolves to a registered source.
3. Open **Reviews** — one packet is pending: the operator proposes a change, and it is not applied until a human resolves it.
4. Kill the server, open the JSON in `state/` — that's the whole database.

## How it works

```
authored files                 generated               read-only surface
state/ sources/ reviews/  →   scripts/graph:build  →   indexes/relationship-graph.json  →  browser app
wiki/ logs/                    (deterministic)                                              (writes nothing)
                ▲
                └── the only write path: review packets, validated by
                    scripts/lib/review-packet.mjs and resolved by a human
```

- **Files are the database.** No server, no cloud, no telemetry. Delete the folder and the product is gone.
- **The compiler is deterministic.** Same input bytes → byte-identical graph, including its timestamp (derived from input timestamps, not the wall clock). CI rebuilds the committed index and fails on any diff.
- **The browser cannot write.** No localStorage, no POST, no beacon — enforced by contract tests that scan the app source and fail on any storage or mutation API.
- **The write gate is explicit.** Agents propose review packets (typed, shape-validated, path-allowlisted, evidence-linked). Humans approve or reject. Today, resolution updates the queue and the *operator* applies approved changes and rebuilds the graph — in-app apply is deliberately out of scope for the browser.

## Run it on your own workspace

The app reads eleven JSON files from fixed paths (`state/*.json`, `reviews/queue.json`, `wiki/memory-claims.json`, `sources/catalog.json`, `indexes/relationship-graph.json`). Replace the demo content with your own records — shapes are documented in [`docs/schema/v0-state-schema.md`](docs/schema/v0-state-schema.md) — then rebuild the graph:

```bash
npm run graph:build && npm run app:local
```

## What this is / what this is not

| It is | It is not |
|---|---|
| A read-only spatial cockpit over local files | A chat assistant or autonomous agent |
| A permission + review gate for agent writes | An agent framework or LLM runtime |
| A deterministic graph compiler with provenance | A vector database or note-taking app |
| Local-first: your data never leaves your disk | A hosted or collaborative product |

## Verification

```bash
npm run verify:local   # graph build → Python contract tests → world-model checks
                       # → graph assertions → leak scan → app build
```

Around a hundred contract tests guard the state schemas, the permission matrix, the review-packet lifecycle, and — most importantly — the read-only invariant of the browser surface. `npm run leak:scan` fails the build if secret-shaped or personal-path strings enter the repo.

## Current limitations (honest list)

- Approving a packet updates the queue; applying the change to state files is an operator-side step, not automated.
- Node positions are computed per load; pinning/persistent layout is on the roadmap.
- No LLM integration ships in this repo — by design the surface is deterministic; an operator CLI (`ask`/`propose` through the same review gate) is the next milestone.
- Two large modules (`app/src/instruments.js`, `app/src/viewModel.js`) predate the module split planned in the issue tracker.

## Compared to…

Obsidian/Notion graph views visualize notes but have no operational objects, no provenance, and no agent governance. Agent frameworks (LangGraph and friends) orchestrate autonomy but don't give the human an owned, read-only surface. Approval APIs gate actions but have no map. Groundplane's bet is the combination: local files + spatial map + human approval plane.

## Roadmap (near-term)

Pinned/persistent layout · pending-approval halos on the map · region → context-bundle export · operator CLI (`ask`, `propose`) with Anthropic/Ollama adapters writing through the existing review gate. See the issue tracker for the full backlog.

## Docs

[Architecture](ARCHITECTURE.md) · [Security model](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Agent operator contract](AGENTS.md) · [State schema](docs/schema/v0-state-schema.md) · design research in [`research/`](research/) (historical design notes that shaped the system)

## License

[MIT](LICENSE)
