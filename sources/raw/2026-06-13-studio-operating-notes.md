# Ridgeline Studio Operating Notes

Captured 2026-06-13 by the operator. Two-person indie studio: Mara Voss (product and engineering) and Theo Anand (design and community). Flagship: Skylark, a weather-journal app shipping v1.0 this month.

## How we run the launch window

- One gate at a time. The current gate is always visible in the cockpit; finish it or explicitly park it.
- Every durable change (state, memory, pricing, public copy) moves through `reviews/queue.json` as a packet with sources and an undo path.
- The cockpit is read-only in the browser. Writes happen operator-side only, after approval.
- Every record cites source ids. If a claim has no source, it does not get promoted.
- Daily Operations automation stays parked until we explicitly restart it after launch.

## Boundaries

- No finance or contacts actions in V0.
- Raw sources are append-only truth; we never rewrite them.
- Beta tester feedback stays local to the studio; only aggregated stats leave.
