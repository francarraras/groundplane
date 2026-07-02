# Product UX

## Thesis

The UI should be an attention-routing cockpit, not a chat transcript and not a document tree. The user should open the app and immediately see what matters, what is risky, what needs approval, and what the assistant recommends.

## UX Principles

- Today first.
- Review queue first-class.
- Chat adjacent to work, not the whole product.
- Memory shown as operational context, not a note graph.
- Every screen answers: what is true, what changed, what needs a decision, what happens next.
- Files are the truth layer, not the visible product model.
- The assistant's judgment should be visible.

## First Five Screens

### 1. Today Cockpit

Sections:

- command bar
- current day timeline
- top 3 priorities
- approvals waiting
- active project health
- routine checklist
- assistant brief
- recently changed truth
- next recommended action

Acceptance criteria:

- Within 10 seconds, the user sees what matters today.
- Approvals are visible.
- Projects at risk are visible.
- Next routine is visible.
- What changed since last session is visible.
- A command input can act on current state.
- No document tree dominates.
- No chat transcript dominates.

### 2. Projects

Project list with:

- health
- target date
- next action
- blocker
- last update
- proof/evidence
- preview drawer
- detail page

### 3. Triage / Approvals

Queue for:

- assistant proposals
- imports
- ambiguous captures
- risky edits
- stale projects
- unresolved decisions
- memory diffs

Actions:

- approve
- revise
- snooze
- reject
- split
- assign

### 4. Brain / Memory

Show:

- commitments
- decisions
- preferences
- facts
- routines
- source files
- confidence
- last verified date
- recently used memory

Do not lead with graph view.

### 5. Routines / Reviews

Show:

- daily startup
- daily shutdown
- weekly review
- project review
- health/admin routines
- cadence
- streak/skipped reason
- evidence

## Interaction Modes

- Talk: natural language command or reflection.
- Command: one-shot instruction.
- Review: inspect proposed changes.
- Browse: read state, memory, and history.
- Edit: make manual correction.
- Approve: allow an action or memory write.

## Visual Direction

The app should feel like a calm executive cockpit:

- dense but readable
- not decorative
- not marketing-style
- minimal chrome
- strong status indicators
- clear hierarchy
- preview drawers instead of page-hopping

Emotionally sticky should come from visible momentum:

- routines completed
- projects rescued
- stale items closed
- decisions made
- assistant calling out reality

## Risks

- Building Obsidian with AI.
- Building a ChatGPT clone.
- Too many dashboard cards without next actions.
- Hiding approvals.
- Memory creep without provenance.

## Sources

- [Notion Home and My Tasks](https://www.notion.com/help/home-and-my-tasks)
- [Notion Projects and Tasks](https://www.notion.com/help/guides/getting-started-with-projects-and-tasks)
- [Notion Agent](https://www.notion.com/help/notion-agent)
- [Linear Projects](https://linear.app/docs/projects)
- [Linear Triage](https://linear.app/docs/triage)
- [Linear My Issues](https://linear.app/docs/my-issues)
- [Linear Peek](https://linear.app/docs/peek)
- [Apple Reminders user guide](https://support.apple.com/guide/reminders/welcome/mac)
- [OpenAI Apps SDK UX principles](https://developers.openai.com/apps-sdk/concepts/ux-principles)

## Open Questions

- Should V1 optimize first for daily execution, career/projects, or full personal OS breadth?
- Should people/relationship memory wait until contacts are added?
- Should the tone be austere operations room or calmer executive cockpit?
