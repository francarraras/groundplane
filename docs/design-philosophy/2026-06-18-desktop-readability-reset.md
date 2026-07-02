# Desktop Readability Reset

Updated: 2026-06-18

## Decision

The Groundplane desktop app should keep the 3D Spatial Atlas as the main experience, but every command surface must answer three questions in the first glance:

- Where am I?
- What matters now?
- What is the next safe action?

Dense evidence, routing, approvals, proof details, and system diagnostics should stay available, but they must not be visible by default.

## Research Anchors

- NN/g progressive disclosure: show only the most important options first, and reveal specialized detail only when requested. This supports the Command Deck drawer model and the nested Evidence note, Records, More routes, Decision copy, and Resolved outcomes disclosures.
- NN/g AI UI paradigm: AI products should move beyond chat-only prose toward intent and outcome control, while still showing system status after each command. This supports the action-oriented `Next` slot and the compact pulse/status readouts.
- Portal UX Agent research: AI-driven UI systems are more trustworthy when flexible behavior is constrained by typed composition, vetted components, and deterministic rendering. This supports preserving local state contracts, review gates, and deterministic render tests instead of free-form UI generation.
- Human-AI Coordination Zones research (2026): agentic products should make the relationship between salience, user involvement, and AI activity explicit. This supports keeping the Command Deck as the coordination surface instead of letting the 3D world carry permissions and actions invisibly.
- Human oversight-by-design research (2026): high-consequence generated interfaces need explicit risk signaling, escalation controls, and traceable oversight. This supports the approval queue, safe-action modes, and visible permission boundaries.
- WAI-ARIA disclosure pattern: collapsible content needs clear controls and expanded/collapsed state. This supports the drawer model, but only when labels are readable and not cryptic sigils.
- 2026 AI-generated prototype research: generated interfaces can be usable but often visually conventional. This supports keeping the living Spatial Atlas and gravity/nuclei model instead of collapsing into a normal dashboard.
- 2026 privacy-in-UX research: privacy should be designed into the UI pattern layer. This supports visible approval boundaries, safe-action modes, and hiding high-risk mutation paths behind explicit review.

## Product Rules

- First glance is not a dashboard; it is orientation plus command.
- The visible `Next` label should prefer a real safe action over graph counts or long summaries.
- Drawer summaries should be compact signals, not sentences or letter-code legends.
- Status readouts should use readable decision-first phrases before abbreviations. Initial-letter status codes like `S/A/O/R` or metric bundles like `1S / 1A / 1R / 1Src` are acceptable only as hidden diagnostics, not as the default visible cockpit language.
- Drawer controls should not show standalone sigils such as `S`, `A`, `!`, or `...`; the visible label already carries the meaning.
- Fixed-format controls should use stable dimensions and shorter visible labels before they clip; full labels belong in title/ARIA when space is tight.
- Compact typography still needs enough line height; clipped headings or pulse numerals are readability bugs even when the text content is short.
- Evidence and approval detail must remain inspectable through nested disclosure, title text, and ARIA labels.
- The 3D map owns presence and navigation; DOM controls own decisions, permissions, and exact actions.
- Verification must include readable text budgets, not only rendering/build success.

## Current Implementation

- Top-level Command Deck drawers: Sources, Actions, Approvals, More.
- Secondary context inside More: Proof, Links, System.
- Sources first-open view: evidence health/source signal, Evidence note disclosure, Records disclosure.
- Actions first-open view: two compact route summaries, More routes overflow.
- Approvals first-open view: target/source signal, metadata disclosure, decision-copy disclosure, resolved history disclosure.
- Visible Next behavior: prefer an available safe action such as `Inspect evidence sources`; use counts only when there is no actionable route.
- Relationship navigation: previous/next path controls live in world navigation, cycle through source-backed relationships for the selected focus, disable when no path exists, and must never sit under the Command Deck hit area.
- Command Deck presence: hidden by default for desktop map-first exploration, with a top-command control that restores the deck on demand. The deck remains the decision/permission surface, but it must not dominate the first screen.
- Deck control: the restoration control should be readable without relying on hover-only tooltips; desktop uses an icon plus the short `Deck` label, while narrow widths may collapse back to the icon with title/ARIA preserved.
- Hidden-deck layout: when the Command Deck is collapsed, world navigation controls reclaim the right edge instead of reserving dead space for a hidden panel.
- Atlas rail glyphs: compact glyph mode must be semantic and collision-free; duplicate abbreviations are a readability bug, not acceptable compression.
- Focus beacon: visible map beacons should show location and compact metadata only. Long summaries belong in title/ARIA or the Command Deck.
- System pulse: the top command pulse should surface the most decision-relevant live state as readable chips, for example `1 approval 1 signal`, while retaining full counts in title/ARIA for inspection and assistive technology.
- Command Deck metrics: first-read summaries should use plain labels such as `Status 1 approval`, `Sources 1 source`, and `Approvals 1 pending`. Dense counts can remain in closed detail grids.
- Drawer controls: closed top-level drawers should read as plain controls such as `Sources +` and `Actions +`; the old standalone `S`, `A`, `!`, and `...` sigil column is removed.
- Bottom mode dock: visible mode labels are intentionally short enough to fit inside their capsules, with full labels preserved in title/ARIA.
- Bottom current-block cue: visible text should stay short in map-first mode, while full context is preserved in title/ARIA instead of expanding the bottom bar.
- Compact typography: Command Deck headings and top pulse numerals use unclipped line heights.
- Guardrail: `npm run test:product-readability` enforces closed-state and opened-drawer text budgets.

## Source URLs

- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.nngroup.com/articles/ai-paradigm/
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- https://arxiv.org/abs/2606.09848
- https://arxiv.org/abs/2602.13745
- https://arxiv.org/abs/2511.00843
- https://arxiv.org/abs/2605.15124
- https://arxiv.org/abs/2601.13342
