# Skylark User-Guide Draft (Import)

Imported 2026-06-13 from the working draft of the Skylark 1.0 user guide. Used as operating context for the launch loop.

## Daily loop

1. Open Today and check the current gate.
2. Triage new beta feedback into the feedback log.
3. Advance the gate task in one small, reviewable slice.
4. Queue a review packet for anything durable before promoting it.

## Tab meanings

- Today: the current gate and the one recommended move.
- Projects: launch state for Skylark, the website, and the beta community.
- Reviews: the approval queue; nothing durable skips it.

## Proof rules

- Judge launch readiness only on repo-backed, visible proof.
- Every claim needs a source id from the catalog.
- Run the smoke check before showing the demo.

## v1.0 limits

- No live store API connection; submission is manual.
- Weather fixtures in the demo package are synthetic and deterministic.
- No auto-publishing of any public copy.
- No memory writes without an approved review packet.
