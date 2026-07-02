# Data Classification

Last updated: 2026-06-25

## Purpose

Classify project data so recovery, export, and automation decisions do not accidentally treat private operating context as public product code.

## Classes

### Public-Safe

Definition: Can be shared publicly after review because it contains no personal context, local paths, secrets, private sources, or project-specific approval history.

Examples:

- Generic architecture principles rewritten without local paths.
- Sanitized screenshots or mock data.
- Public-safe README excerpts prepared for a separate export package.

Default action: allowed only through an approved sanitized export path.

### Internal Project

Definition: Safe for this private repo but not for public release as-is.

Examples:

- `AGENTS.md`
- `README.md`
- `docs/`
- `research/`
- `scripts/`
- `tests/`
- `app/`
- `web/`

Default action: private repo only. Review before export.

### Private Operating State

Definition: Local source-of-truth state, project context, compiled memory, review records, logs, and run history.

Examples:

- `state/`
- `sources/`
- `wiki/`
- `reviews/`
- `logs/`
- `runs/`
- `indexes/`

Default action: private only. Excluded from public export by default.

### Sensitive Personal Context

Definition: Personal identity, health, family, relationships, finance, contacts, messages, career specifics, routines, travel, screenshots, PDFs, or inferred personal patterns.

Examples:

- Personal sources in `sources/raw/`.
- Private project summaries.
- Health/routine context.
- Career Growth Max context.
- Any future finance/contact data.

Default action: gated. No public export. No memory promotion without explicit approval.

### Secret Or Credential

Definition: Tokens, passwords, API keys, `.env` values, private keys, cookies, session data, or credentials.

Examples:

- `.env`
- `.env.*`
- `*.secret`
- `secrets/`
- `private/`
- Browser session state.

Default action: never commit, never export, never quote, never include in recovery bundle intentionally. Store only in an approved secret manager or encrypted private backup.

### Rebuildable Local Artifact

Definition: Local generated or dependency output that can be recreated.

Examples:

- `node_modules/`
- `dist/`
- `tests/__pycache__/`
- `.DS_Store`

Default action: ignored by Git, not backed up unless a specific debugging need exists.

## Folder Defaults

| Path | Default Class | Export Status |
| --- | --- | --- |
| `AGENTS.md`, `README.md` | Internal Project | Review and sanitize |
| `package.json`, `package-lock.json` | Internal Project | Review and sanitize |
| `app/`, `web/` | Internal Project | Review and sanitize |
| `scripts/`, `tests/` | Internal Project | Review and sanitize |
| `docs/` | Internal Project | Review and sanitize |
| `docs/security/` | Internal Project | Review and sanitize |
| `docs/ops/` | Internal Project with local recovery details | Review and sanitize |
| `research/` | Internal Project / Private Context | Review and sanitize |
| `state/` | Private Operating State | Block |
| `sources/` | Private Operating State | Block |
| `wiki/` | Private Operating State | Block |
| `reviews/` | Private Operating State | Block |
| `logs/` | Private Operating State | Block |
| `runs/` | Private Operating State | Block |
| `indexes/` | Private Operating State | Block unless regenerated from public-safe state |
| `.git/` | Private Repo History | Block |
| `.worktrees/` | Local Runtime / Private | Block |
| `.superpowers/` | Local Runtime / Private | Block |
| `node_modules/`, `dist/`, `__pycache__/`, `.DS_Store` | Rebuildable Local Artifact | Block |
| `.env*`, `secrets/`, `private/`, `*.secret`, `*.local` | Secret Or Credential | Never export |
| Local recovery bundles | Private Backup | Block |
| Screenshots/PDFs/videos | Sensitive Personal Context unless proven sanitized | Block by default |
| sibling local repositories | Sibling Private Artifact | Separate policy required |

## Export Eligibility Summary

| Category | Meaning | Public Export Default |
| --- | --- | --- |
| Export-eligible after review | Code/docs that can become public-safe only after human review and sanitization | Possible |
| Private-tracked | Committed private source-of-truth context | Block |
| Private-untracked | Local governance, drafts, worktrees, or private backups outside tracked Git | Block |
| Ignored/rebuildable | Dependency/build/cache output | Block |
| Never-export | Secrets, credentials, browser state, private external-account data | Never |

## Handling Rules

- If classification is unclear, treat the data as Private Operating State.
- If a file contains local absolute paths, treat it as private unless sanitized.
- If a file contains personal project context, treat it as private even if it is technically code or markdown.
- If a public export is approved later, use an allowlist and review every included file.
- Do not use denylist-only export for this repo.
- Machine-generated files are not automatically safe. `indexes/`, `runs/`, and `logs/` can summarize private context.
- Sensitive areas named in `docs/security/v1-permission-matrix.md` remain gated even when represented in project code or test fixtures.
