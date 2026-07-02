# Agent And Skill System

## Thesis

Reusable workflows are the assistant's muscles. The local app shows state; Codex operates the system through repo instructions, skills, plans, scripts, and review gates.

V1 should avoid a giant all-knowing prompt. Use small skills with clear triggers and outputs.

## Codex Operating Stack

- `AGENTS.md`: repository operating contract.
- `skills/`: project-owned reusable workflows.
- `docs/superpowers/plans/`: implementation/research plans.
- `research/`: design and research outputs.
- `state/`: current operating state.
- `logs/`: append-only run history.
- `reviews/`: pending approvals.

## Core Skills For V1

### Daily Brief

Trigger: user asks for morning brief or daily startup.

Inputs:

- today state
- project state
- routines
- decisions
- review queue

Output:

- top 3 outcomes
- risks
- approvals
- one strict recommendation

Permission mode: suggest-only.

### Daily Shutdown

Trigger: end of day.

Output:

- completed items
- missed items
- reschedule proposals
- memory/task updates for approval

Permission mode: draft-for-approval.

### Weekly Review

Trigger: weekly cadence.

Output:

- wins
- misses
- stale projects
- project health changes
- next week focus

Permission mode: draft-for-approval.

### Source Ingest

Trigger: new source added.

Output:

- source summary
- proposed memory changes
- contradictions
- citations

Permission mode: draft-for-approval.

### Project Update

Trigger: project changed or user asks.

Output:

- current status
- blocker
- next action
- risk
- proof gap

Permission mode: suggest-only or draft-for-approval.

### Decision Coach

Trigger: open decision or vague plan.

Output:

- options
- tradeoffs
- recommendation
- deadline

Permission mode: suggest-only.

### Contradiction Audit

Trigger: scheduled lint or source conflict.

Output:

- conflicting claims
- sources
- recommendation
- review item

Permission mode: suggest-only.

### Trip Planner

Trigger: trip or travel workflow.

Output:

- itinerary
- packing/logistics
- calendar reminders
- approval drafts

Permission mode: draft-for-approval.

## Skill Template

Each skill should define:

- name
- trigger
- allowed inputs
- source trust assumptions
- steps
- output files
- permission mode
- failure update rule
- review requirements

## Codex Thread Rules

- One coherent task per thread.
- Use separate threads for independent research or implementation lanes.
- Use plans for multi-step work.
- Use review gates before broad edits.
- Keep `AGENTS.md` short; put detailed procedures into skills.

## Risks

- Overloading `AGENTS.md`.
- Skills too broad to trigger reliably.
- Too many agents/threads without a clear owner.
- Letting chat history become the only memory.
- Running automation before manual workflow is stable.

## Sources

- [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
- [Codex skills](https://developers.openai.com/codex/skills)
- [Codex best practices](https://developers.openai.com/codex/learn/best-practices)
- [Codex app features](https://developers.openai.com/codex/app/features)

## Open Questions

- Which 3 skills should be built first?
- Should memory writes be a separate approval skill?
- Should the browser app expose skill runs directly?
