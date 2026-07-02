# AIOS Product Thesis

## One-Line Thesis

Build a local, Codex-operated chief-of-staff app that turns the user's life context into visible operating state: today, projects, memory, routines, decisions, approvals, and next actions.

## Non-Negotiables

- **Codex-powered:** V1 is operated by Codex/Codex app, not by a custom OpenAI API backend.
- **App-first:** the user interacts with a local browser app, not a terminal or text-only messenger.
- **Fresh start:** create a clean operating system first; import Obsidian/Notion later if useful.
- **Chief-of-staff posture:** strict, proactive, operational, and willing to challenge weak plans.
- **Local source of truth:** files and/or SQLite stay inspectable, versionable, and recoverable.
- **Permissioned action:** the system can suggest, draft for approval, or execute low-risk actions based on topic.

## Product Shape

The system is not a note app and not a chatbot. It is a personal operating layer with two halves:

1. **Visible app layer:** a local browser app showing the current state of life and work.
2. **Codex operating layer:** Codex reads/writes the source-of-truth files, runs workflows, performs research, updates memory, and prepares actions.

The browser app should be the place the user returns to every day. Codex should be the operator behind the scenes.

## Recommended V1 Surface

Use a local browser app for V1.

Reasons:

- Fastest iteration loop.
- Works naturally with Codex editing local files.
- Avoids native Mac app build friction.
- Avoids a custom API-backed assistant product.
- Lets us design the UI as a real cockpit instead of another markdown editor.

Native Mac can come later if the browser app proves daily value.

## Core Screens

### Today

The command center for the day: schedule, commitments, active projects, reminders, unresolved decisions, review queue, and one strict recommendation for what matters most.

### Projects

Active outcomes, owners, deadlines, next actions, blocked items, proof/assets, and latest updates.

### Brain

Compiled memory and knowledge: goals, facts, preferences, decisions, people, resources, routines, open questions, and source-backed claims.

### Routines

Daily, weekly, monthly, travel, family, health, learning, and business cadences.

### Assistant

Conversation and command surface for Codex-operated workflows: brief me, plan this, review this, update memory, draft action, run check, research topic.

### Review

Approval queue for drafts, sensitive actions, memory changes, automations, and source-ingest diffs.

## Data Scope

Long-term scope is broad: calendar, files, email, browser/history, family logistics, projects, routines, health, travel, finance, contacts, and business context.

V1 should prioritize:

- Calendar/schedule.
- Files and local documents.
- Projects and tasks.
- Email-derived commitments if accessible.
- Browser/history or manually saved sources.
- Family/logistics.
- Health/routine notes.
- Travel plans.

Finance and contacts should be deferred or kept read-only until the permission model is proven.

## Memory Model

Use a layered memory model:

- `raw/`: immutable user-provided and imported sources.
- `state/`: current operating state: today, projects, routines, tasks, decisions.
- `wiki/`: compiled second-brain pages maintained by Codex.
- `logs/`: append-only operation history.
- `skills/`: reusable workflow instructions.
- `reviews/`: pending approvals, diffs, and proposed actions.

Every important memory should carry:

- source
- date
- confidence
- owner/domain
- last reviewed
- actionability
- sensitivity

## Permission Model

Every workflow gets an action mode:

- **Suggest-only:** advice, prioritization, reminders, summaries.
- **Draft-for-approval:** emails, calendar changes, messages, external posts, memory rewrites, project changes.
- **Automatic low-risk:** local indexing, linting, stale reminder detection, dashboard refresh, source catalog updates.

Sensitive domains start at draft-for-approval or suggest-only.

## Research Hypothesis

The product will stick if the user sees the system as a living operational cockpit, not as another place to store notes. The value is not memory alone. The value is memory plus pressure, prioritization, review, and action.

## First Build Hypothesis

The smallest useful version is:

- local browser UI
- file-backed source of truth
- Today dashboard
- Projects dashboard
- Brain index
- Review queue
- Codex workflow instructions
- manual source ingestion
- daily/weekly review workflows

This can be built without API integration. It becomes more powerful as Codex-operated workflows and local automations are added.
