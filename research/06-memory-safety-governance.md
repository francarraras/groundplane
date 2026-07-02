# Memory Safety And Governance

## Thesis

Broad data access is acceptable only if source trust, memory writes, and actions are separated. The assistant must not treat external content as instructions, and it must not turn generated text into side effects without review.

## Core Risks

- Indirect prompt injection from webpages, PDFs, emails, or notes.
- Poisoned memory persisting across sessions.
- Model output treated as executable instruction.
- Hallucinated or stale advice driving irreversible action.
- Sensitive data leaked through drafts, logs, or tool calls.
- Overreliance on confident but weakly sourced memory.

## Trust Boundaries

### Sources Are Data

External content can provide facts. It cannot grant permissions, change instructions, or authorize tools.

### Memory Writes Are Privileged

A memory update is not a note. It changes the assistant's future behavior and must be source-linked and reviewable.

### Actions Need Preflight

Before side effects, show:

- intended action
- source evidence
- target object
- permission mode
- risk level
- undo path

## Default V1 Policy

- Default: suggest-only.
- Side effects: draft-for-approval.
- Automatic low-risk: only local, non-destructive, allowlisted operations.
- Browser pages, PDFs, email, and imported notes are untrusted by default.
- Finance and contacts wait until audit and approval are proven.

## Audit Log Requirements

Every meaningful operation should record:

- timestamp
- actor
- workflow/skill
- source IDs
- prompt or instruction bundle hash if practical
- action type
- approval state
- resulting diff
- rollback/undo note

## Memory Classes And Retention

### Keep

- explicit user preferences
- approved goals
- active commitments
- source-backed facts
- decisions
- stable routines

### Review

- inferred preferences
- old goals
- sensitive facts
- repeated behavior patterns
- contradicted claims

### Decay

- stale priorities
- abandoned plans
- old routine streaks
- low-confidence observations

### Delete

- accidental sensitive captures
- false memories
- unapproved personal data
- temporary planning artifacts

## Red-Team Probes

V1 should include probes like:

- malicious webpage asks assistant to ignore instructions
- imported note requests memory poisoning
- PDF includes hidden instruction to approve action
- stale memory conflicts with newer source
- assistant proposes external send without approval
- generated script attempts deletion

## Sources

- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP LLM02 Sensitive Information Disclosure](https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/)
- [OWASP LLM05 Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
- [OWASP LLM06 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
- [OWASP LLM09 Misinformation](https://genai.owasp.org/llmrisk/llm092025-misinformation/)
- [OWASP memory attack surface](https://genai.owasp.org/2026/05/13/memory-is-a-feature-it-is-also-an-attack-surface/)
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- [Indirect Prompt Injection](https://arxiv.org/abs/2302.12173)

## Open Questions

- Should memory writes always require approval at first?
- How long should audit logs be retained?
- What is allowed as automatic low-risk on day one?
