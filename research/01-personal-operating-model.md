# Personal Operating Model

## Thesis

The assistant must manage commitments, not just notes or tasks. A real chief-of-staff system tracks promises, deadlines, decisions, routines, waiting-on items, project risk, and what the user is ignoring.

The active loop is:

```text
Capture -> Clarify -> Decide -> Schedule -> Execute -> Review -> Archive
```

PARA is useful as a storage/navigation spine, but the operating system needs a stronger active layer that forces decisions and review.

## Domain Model

### Domains

Stable life categories:

- Work
- Business
- Personal projects
- Health
- Home
- Family
- Learning
- Hobbies
- Travel
- Admin

### Areas

Ongoing standards inside each domain. Areas do not end; they need periodic review.

Examples:

- Health baseline
- Family logistics
- Career growth
- Home operations
- Learning pipeline
- Financial hygiene

### Projects

Outcome-based efforts with a start, target state, owner, next action, risk, and review date.

Required fields:

- title
- domain
- target outcome
- status
- health
- next action
- blocker
- target date
- last reviewed
- proof or evidence

### Tasks

Atomic actions tied to a project, area, routine, decision, or waiting-on item.

Required fields:

- action
- context
- owner
- due date
- energy level
- priority
- source
- status

### Decisions

Unresolved choices that need a recommendation or deadline.

Required fields:

- decision
- options
- stakes
- deadline
- recommendation
- source/evidence
- status

### Waiting On

External dependencies: people, approvals, responses, deliveries, or events.

Required fields:

- item
- owner/person
- expected date
- consequence
- follow-up date
- status

### Signals

Inputs the assistant uses to judge state:

- calendar pressure
- stale projects
- missed routines
- overloaded day
- repeated deferrals
- unprocessed captures
- unresolved decisions
- user notes
- changed files

## Daily Cadence

### Morning Brief

Purpose: choose the day before the day chooses the user.

The assistant should show:

- calendar pressure
- top 3 outcomes
- hard deadlines
- approvals waiting
- project risks
- next routine
- one blunt recommendation

### Midday Drift Check

Purpose: detect slippage early.

The assistant should ask:

- Are the top outcomes still realistic?
- What became blocked?
- What needs to be dropped?
- Is the schedule fragmented?
- Does anything need approval?

### Evening Closeout

Purpose: prevent open-loop accumulation.

The assistant should:

- close completed tasks
- reschedule misses
- capture lessons
- update project state
- prepare tomorrow's first recommendation

## Weekly Cadence

The weekly review is the system's accountability engine.

The assistant should:

- review all active projects
- promote/demote priorities
- identify stale work
- inspect areas against standards
- clean inbox/capture queue
- escalate decisions
- archive dead items
- produce a blunt weekly memo

Weekly memo sections:

- wins
- misses
- risks
- ignored commitments
- decisions needed
- next week's focus

## Chief-Of-Staff Behaviors

The assistant must be strict and operational:

- says no to overload
- asks what gets dropped when the user adds too much
- flags vague tasks
- forces next actions
- escalates stale projects
- challenges goals without visible proof
- protects focus blocks
- distinguishes urgent, important, emotionally noisy, and optional
- converts passive notes into commitments, decisions, or archive
- keeps an audit trail of recommendations

Acceptable direct language:

- "This is slipping."
- "You need to decide."
- "This is not a real project yet."
- "This has no next action."
- "You are overloaded. Drop, defer, or delegate something."

## V1 Priorities

V1 should manage:

1. Today
2. Active projects
3. Decisions
4. Routines/reviews
5. Triage/approvals

Do not chase total life coverage before the daily and weekly loops are excellent.

## Risks

- Becoming a prettier notes app.
- Treating all tasks equally.
- Over-automating before trust is earned.
- Letting PARA become passive storage.
- Covering every life area before the core review cadence works.

## Open Questions

- What are the first 3 domains V1 must manage daily?
- What counts as visible proof for personal, business, and learning projects?
- How aggressive should the assistant be after repeated ignored commitments?
- Should family/home management be modeled before people/contact memory?
