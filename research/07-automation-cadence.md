# Automation Cadence

## Thesis

Cadence is the product. Automations should not start as magical background agents; they should begin as repeatable review workflows that become scheduled only after they prove useful.

## Automation Modes

### Suggest-Only

No side effects.

Use for:

- daily priority recommendation
- stale project detection
- overload warning
- decision framing
- contradiction alert

### Draft-For-Approval

Creates proposed changes.

Use for:

- email drafts
- calendar changes
- project updates
- memory writes
- weekly memo
- task rescheduling

### Automatic Low-Risk

Runs without explicit approval only when local, reversible, and non-destructive.

Use for:

- local index refresh
- stale item report
- dashboard refresh
- source catalog update
- non-destructive lint report

## Daily Automations

### Morning Brief

Mode: suggest-only.

Output:

- top 3 outcomes
- schedule pressure
- approvals
- risk
- one strict recommendation

### Midday Drift Check

Mode: suggest-only.

Output:

- off-track items
- overloaded blocks
- changed priorities
- decisions needed

### Evening Closeout

Mode: draft-for-approval.

Output:

- completed items
- missed items
- proposed reschedules
- proposed memory updates

## Weekly Automations

### Weekly Review

Mode: draft-for-approval.

Output:

- wins
- misses
- stale projects
- risks
- next week focus

### Project Health Audit

Mode: suggest-only.

Output:

- projects without next action
- projects without proof
- projects with stale reviews
- blocked projects

### Memory Lint

Mode: suggest-only.

Output:

- unsupported claims
- stale claims
- contradictions
- orphan pages

## Monthly Automations

### Area Review

Mode: suggest-only.

Output:

- ongoing responsibilities
- standards slipping
- neglected domains

### Archive Sweep

Mode: draft-for-approval.

Output:

- inactive projects
- obsolete notes
- stale routines

## Automation Promotion Rule

A workflow can move from manual to scheduled only after:

- it has run manually at least 3 times
- outputs were useful at least twice
- false positives were tolerable
- required data is stable
- permission mode is clear
- rollback/undo path exists for side effects

## First 3 Safe Automations

1. Morning Brief: suggest-only.
2. Project Health Audit: suggest-only.
3. Local Index/Lint Refresh: automatic low-risk.

## Risks

- Background behavior before trust.
- Notification fatigue.
- Automations acting on stale data.
- Hidden memory writes.
- Sensitive data pulled into logs without need.

## Open Questions

- What time should daily startup and shutdown run?
- Should missed commitments escalate after 1, 2, or 3 misses?
- Which low-risk automation can run without approval first?
