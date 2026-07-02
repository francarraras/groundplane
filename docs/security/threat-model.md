# Threat Model

Last updated: 2026-06-25

## Overview

Groundplane is a local-first cockpit for agent-operated work. An external operator agent maintains the files, local files are the source of truth, and the local browser app is the primary user surface.

The repository contains both product code and private operating context. It is not a public package and must not be published as-is.

Primary runtime surfaces:

- Local browser app under `app/` and `web/`.
- Local state and graph generation scripts under `scripts/`.
- Durable state and context under `state/`, `sources/`, `wiki/`, `reviews/`, `logs/`, `runs/`, and `indexes/`.
- Professional ops and recovery docs under `docs/ops/`.

Primary protected assets:

- Local source files and source-derived summaries.
- Personal/project operating context.
- Raw and summarized source material.
- Wiki memory and future promoted memory.
- Review/approval history.
- Logs and run records.
- Generated indexes and relationship graphs.
- Git history, recovery bundles, worktrees, and untracked governance files.
- Local paths, screenshots/PDFs, browser state, OS permissions, and sibling project references.
- Private external accounts and cloud/project metadata.
- Future memory, finance, contacts, calendar, email, or external-write capabilities.

## Threat Model, Trust Boundaries, And Assumptions

### Trusted Actors

- User: final authority for private data, external actions, product direction, public release, license, and cloud mutation.
- Operator agent: local operator that can propose, implement, verify, and document approved local work.
- Read-only subagents: bounded helpers for audit, research, and review.

### Trust Boundaries

- Local repository boundary: committed project files are trusted only as local private state, not public-safe content.
- Browser app boundary: browser UI must remain read-only unless a separate explicit approval allows a durable write.
- Raw source boundary: `sources/raw/` is append-only truth; rewrites or deletion are privileged actions.
- Memory boundary: memory promotion is a privileged state change.
- External systems boundary: GitHub, Linear, email, calendar, contacts, finance, publishing, and network writes require explicit approval.
- Sibling artifact boundary: other local repositories on the same machine are outside this repo's recovery and export boundary unless separately covered.

### Input Classes

Operator-controlled:

- Approved local edits.
- Review packets.
- Board/task state.
- Recovery and ops docs.

User-controlled and sensitive:

- Personal goals, routines, projects, health, family, career, travel, screenshots, PDFs, messages, and local files.

Potentially attacker-controlled or untrusted:

- Imported source material.
- Browser page text or screenshots.
- Public web research.
- Future API responses, connector payloads, email/calendar/contact data, or external documents.

### Core Invariants

- Browser actions are read-only by default.
- External writes require explicit approval.
- Finance and contacts remain gated.
- Memory writes are privileged.
- Raw sources are not silently rewritten.
- Public export must be sanitized and allowlisted.
- Recovery evidence must distinguish committed state from ignored/untracked/private state.

## Attack Surface, Mitigations, And Attacker Stories

### Local Browser App

Risk: UI could misrepresent approval boundaries, hide risk, or make an unsafe next action look automatic.

Mitigations:

- Permission modes are defined in `docs/security/v1-permission-matrix.md`.
- Browser QA verifies read-only product behavior.
- Safe actions show risk, target, source IDs, and approval boundary.

### Source And Memory Pipeline

Risk: untrusted source content could instruct the system to rewrite memory, bypass `AGENTS.md`, or promote claims without approval.

Mitigations:

- Raw sources are append-only in V1.
- Source catalog and memory promotion remain gated.
- Permission red-team probes exist in `docs/security/v1-permission-matrix.md`.

### Recovery And Export

Risk: a private bundle, exact repo, or public package could leak personal context, local paths, source files, logs, or approval history.

Mitigations:

- `docs/ops/recovery-runbook.md` labels the recovery bundle private.
- `docs/security/private-export-policy.md` blocks exact-repo publication.
- `docs/security/export-manifest.md` defines denylist and allowlist rules.

Accidental leakage paths:

- Public GitHub push or visibility change.
- Treating a private GitHub mirror as a public-safe package.
- Sharing a `git bundle`, `git archive`, screenshot, PDF, run log, or review packet without sanitizing it.
- Copying local absolute paths into public docs.
- Exporting generated `indexes/` because they look machine-generated.
- Including sibling proof repo references or local demo paths.

### Local Tooling And Build

Risk: dependency install, browser QA, or local dev server can require local process permissions and network/cache access.

Mitigations:

- Recovery drill records browser permission requirements.
- `npm ci`, `verify:local`, and `verify:browser` are explicit verification steps.

### Cloud And External Integrations

Risk: GitHub push, Linear mutation, email/calendar/contact/finance actions, or public export could expose private state or mutate external systems.

Mitigations:

- GitHub/Linear writes require explicit approval.
- Finance and contacts are forbidden in V0.
- Public export requires separate sanitized package and approved license decision.

## Severity Calibration

Critical:

- Publishing the exact private repo, bundle, or state folders publicly.
- Automatic finance, contact, email, calendar, or external writes without approval.
- Silent memory promotion from untrusted source content.
- Credential leakage if future secret files are added.

High:

- GitHub push or Linear mutation that exposes private project state without approval.
- Raw source rewrite or deletion.
- Review queue mutation that makes an unapproved change appear approved.
- Browser UI presenting a write action as read-only.

Medium:

- Stale remote/CI creating false confidence about recovery.
- Missing recovery coverage for sibling proof projects.
- Untracked governance files not protected by Git or private backup.
- Local path leakage in internal docs copied into a public package.

Low:

- Rebuildable cache loss: `node_modules/`, `dist/`, `__pycache__/`.
- Browser QA permission friction when recorded and recoverable.
- Bundle-size or Three.js deprecation warnings without measured runtime failure.

Out of scope for V1:

- Multi-tenant attacks; this is a single-user local system.
- Public authentication/session attacks; there is no hosted public app.
- Server-side request forgery or cross-tenant authorization bugs unless future live connectors or hosted services are added.
