# Today Cockpit Contract

## Purpose

The Today cockpit is the first real cockpit surface. It should answer what is happening, what the operator recommends next, what needs approval, what is at risk, and which operating rails are locked.

It is not a landing page, chat clone, note tree, graph view, or raw source browser.

## First-Screen Sections

1. **Situation Bar**
   - Reads `state/board.json.project` and active project health.
   - Shows current phase, last update, and local operating state.

2. **Chief-of-Staff Brief**
   - Computed from project health, active tasks, pending approvals, and blocked work.
   - Must be short enough to understand in one glance.

3. **Next Command**
   - Reads the highest-priority active task from `state/tasks.json`.
   - Falls back to active project `next_action`.

4. **Approvals**
   - Reads pending items from `reviews/queue.json`.
   - Shows risk, target file, approval mode, and summary.

5. **At Risk**
   - Reads projects where `health != green` and tasks with `blocked_by`.

6. **Operating Loop**
   - Reads routines from `state/routines.json`.
   - Shows cadence, approval mode, and steps.

7. **Memory Signals**
   - Reads only approved, active, high-confidence claims from `wiki/memory-claims.json`.
   - Does not expose a full memory browser in V0.

8. **Locked Decisions**
   - Reads locked decisions from `state/decisions.json`.
   - Keeps architecture rails visible.

## 10-Second Acceptance Test

Within 10 seconds, the user should understand:

- The current project phase.
- The one recommended next command.
- Whether approvals are waiting.
- Whether important work is at risk.
- Which routine or operating loop is planned.
- Which memory signals and decisions are controlling the current path.
- That finance, contacts, graph view, raw source browsing, and automation controls are not part of V0.

## V0 Exclusions

Do not show:

- Full note tree.
- Graph view.
- Raw source browser.
- Chat transcript as the main surface.
- Finance or contacts.
- Relationship CRM.
- Large memory explorer.
- Automation controls beyond visible approval mode.
- Generic analytics charts.
- Long research documents.
- Notion-style databases as the primary visual metaphor.
