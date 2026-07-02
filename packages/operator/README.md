# Operator CLI

The write-side operator surface. The browser cockpit stays **read-only**; this
Node CLI is where an agent reasons over the graph and proposes changes through
the same review gate as everyone else.

```
node packages/operator/cli.js ask "<question>" [--region <cluster|node>] [--provider mock|ollama|anthropic] [--model <name>]
# or, once linked: atlas ask "..."
```

## `ask` (#18)

1. Builds a **bounded context bundle** from a graph slice — the same serializer
   the browser's Export uses (`app/src/contextBundle.js`). The graph is the
   index; there is no vector DB.
2. Calls one provider through a thin `complete(messages, options)` adapter
   (`provider.js`): `mock` (offline, deterministic — the default and the test
   provider), `ollama` (local, no API key), or `anthropic` (hosted).
3. Writes the answer as a **run packet** under `runs/RUN-<date>-ASK-<n>.json`
   (`permission_mode: suggest-only`, `browser_writes: false`) and appends one
   line to `logs/operations.jsonl`.

Guarantees: every call is timed out with one retry and **fails closed** — a
failed or malformed call writes no run packet (only a `failed` log line). Answers
cite only sources registered in `sources/catalog.json`.

Configure with `.env` (see `.env.example`). Offline demo: keep
`ATLAS_PROVIDER=mock`, or run a local model with `ATLAS_PROVIDER=ollama`.
