import { asArray, escapeHtml, field, pill, publicCountLabel, publicText, publicTitle, truncateText } from "./helpers.js";

function assistantBriefText(value, fallback = "Not recorded.") {
  return publicText(value || fallback)
    .replace(/\bsource-backed\b/gi, "sourced")
    .replace(/\bvisual gravity\b/gi, "map weight")
    .replace(/\bdistricts?\b/gi, "areas")
    .replace(/\bnodes?\b/gi, "items")
    .replace(/\s+/g, " ")
    .trim();
}

export function assistantMiniLabel(brief = {}) {
  const move = assistantBriefText(brief.shortRecommendation || brief.recommendation || "Review next move", "Review next move");
  return `Your move / ${truncateText(move, 42)}`;
}

function assistantTaskToken(...values) {
  return values.map((value) => assistantBriefText(value)).join(" ").match(/\bTASK-\d{3}\b/)?.[0] || "";
}

export function assistantBriefAria(brief = {}) {
  const nextSlice = brief.nextSlice ? `${brief.nextSlice.id} ${brief.nextSlice.title}` : "No next slice recorded";
  return [
    "Your move.",
    `Situation: ${assistantBriefText(brief.situation)}`,
    `Recommended move: ${assistantBriefText(brief.recommendation)}`,
    `Next slice: ${assistantBriefText(nextSlice)}`,
    `Why it matters: ${assistantBriefText(brief.reason)}`,
    `Approval boundary: ${assistantBriefText(brief.boundary)}`,
  ].join(" ");
}

function roadmapCandidateStatus(candidate = {}) {
  if (candidate.recommended) return "Recommended";
  if (candidate.requiresUserInput) return "Needs decision";
  return publicTitle(candidate.status || "Candidate", "Candidate");
}

function renderRoadmapCandidates(candidates = []) {
  const items = asArray(candidates);
  if (items.length === 0) return "";

  return `
    <section class="assistant-roadmap" aria-label="Next slices">
      <div class="assistant-roadmap-head">
        <p class="section-kicker">Next slices</p>
        <strong>${escapeHtml(publicCountLabel(items.length, "choice"))}</strong>
      </div>
      <div class="assistant-roadmap-list">
        ${items
          .slice(0, 5)
          .map((candidate) => {
            const status = roadmapCandidateStatus(candidate);
            const sourceText = asArray(candidate.sourceIds).join(", ") || "none";
            return `
              <article class="assistant-roadmap-card" data-roadmap-id="${escapeHtml(candidate.id)}">
                <div>
                  <b>${escapeHtml(candidate.id)}</b>
                  <strong title="${escapeHtml(candidate.title)}">${escapeHtml(truncateText(candidate.title, 42))}</strong>
                </div>
                ${pill(status)}
                <p>${escapeHtml(truncateText(candidate.reason || candidate.nextAction, 110))}</p>
                <dl class="assistant-roadmap-meta">
                  ${field("Risk", publicTitle(candidate.risk || "medium", "medium"))}
                  ${field("Decision", candidate.requiresUserInput ? "Needs decision" : "Local")}
                  ${field("Sources", sourceText)}
                </dl>
                <div class="assistant-roadmap-detail">
                  <b>Boundary</b>
                  <span>${escapeHtml(candidate.requiresUserInput ? "approval needed" : "local review")}</span>
                  <p>${escapeHtml(truncateText(candidate.boundary || "No boundary recorded.", 130))}</p>
                  <p>${escapeHtml(truncateText(candidate.nextAction || "Review this candidate before implementation.", 130))}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderAssistantBrief(brief = {}) {
  if (!brief) return "";

  const primaryDrawer = brief.primaryDrawer || "actions";
  const secondaryDrawer = brief.secondaryDrawer || "approvals";
  const nextSlice = brief.nextSlice || null;
  const situation = assistantBriefText(brief.situation, "Local state is loaded.");
  const recommendation = assistantBriefText(brief.recommendation, "Review the next move.");
  const reason = assistantBriefText(brief.reason, "The assistant keeps the next move explicit.");
  const route = assistantBriefText(brief.route, "Open Details and use Next steps.");
  const boundary = assistantBriefText(brief.boundary, "No browser writes or external actions.");
  const shortMove = assistantBriefText(brief.shortRecommendation || recommendation, "Review next move");
  const task = assistantTaskToken(recommendation, situation);
  const nextSliceLabel = nextSlice ? `${nextSlice.id} ${nextSlice.title}` : "No next slice recorded";
  const visibleSituation = task ? `${task} ready` : truncateText(situation, 30);
  const visibleRecommendation = task ? `Review ${task}` : truncateText(shortMove, 32);
  const visibleNextSlice = nextSlice ? nextSlice.id : "No choice";

  return `
    <section
      class="assistant-brief"
      data-assistant-brief-id="${escapeHtml(brief.id || "assistant:brief")}"
      data-browser-writes="${brief.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(assistantBriefAria(brief))}"
    >
      <div class="assistant-brief-head">
        <div>
          <p class="section-kicker">Your move</p>
          <h3 title="${escapeHtml(recommendation)}">${escapeHtml(truncateText(shortMove, 44))}</h3>
        </div>
        ${pill(brief.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="assistant-brief-grid">
        <span>
          <b>Situation</b>
          <em title="${escapeHtml(situation)}">${escapeHtml(visibleSituation)}</em>
        </span>
        <span>
          <b>Recommended move</b>
          <em title="${escapeHtml(recommendation)}">${escapeHtml(visibleRecommendation)}</em>
        </span>
        <span>
          <b>Next slice</b>
          <em title="${escapeHtml(nextSliceLabel)}">${escapeHtml(truncateText(visibleNextSlice, 34))}</em>
        </span>
        <span>
          <b>Choices</b>
          <em>${escapeHtml(publicCountLabel(asArray(brief.roadmapCandidates).length, "option"))}</em>
        </span>
      </div>
      <p class="assistant-boundary" title="${escapeHtml(boundary)}">
        <b>Boundary</b>
        <span>Local only</span>
      </p>
      <details class="assistant-route-detail">
        <summary>
          <span>Why</span>
          <small>More</small>
        </summary>
        <div class="assistant-route-body">
          <p><b>Why it matters</b><span>${escapeHtml(reason)}</span></p>
          <p><b>What opens next</b><span>${escapeHtml(route)}</span></p>
          <p><b>Approval boundary</b><span>${escapeHtml(boundary)}</span></p>
          ${renderRoadmapCandidates(brief.roadmapCandidates)}
          <div class="assistant-brief-route">
            <button class="assistant-route-button" type="button" data-assistant-route="${escapeHtml(primaryDrawer)}">
              Open Next steps
            </button>
            <button class="assistant-route-button is-secondary" type="button" data-assistant-route="${escapeHtml(secondaryDrawer)}">
              Open Reviews
            </button>
          </div>
        </div>
      </details>
    </section>
  `;
}

function brainAssistantItems(items = []) {
  const rows = asArray(items).slice(0, 4);
  if (rows.length === 0) return '<li class="empty-note">No local behavior context available.</li>';

  return rows.map((item) => `<li title="${escapeHtml(publicText(item))}">${escapeHtml(truncateText(publicText(item), 118))}</li>`).join("");
}

export function renderBrainAssistantBehavior(panel = null) {
  if (!panel) return "";

  const sourceText = asArray(panel.sourceIds).join(", ") || "local state";
  const recommendedMove = publicText(panel.recommendedMove || "Review the next behavior slice.");
  const permissionBoundary = publicText(panel.permissionBoundary || "Read-only. No browser writes.");

  return `
    <section
      class="brain-assistant-panel"
      data-brain-assistant-id="${escapeHtml(panel.id || "brain-assistant-behavior")}"
      data-browser-writes="${panel.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${panel.title || "Operator"}. Recommended move: ${recommendedMove}`)}"
    >
      <div class="brain-assistant-head">
        <div>
          <p class="section-kicker">Operator</p>
          <h3 title="${escapeHtml(panel.title || "Operator")}">${escapeHtml(
            truncateText(publicText(panel.title || "Operator"), 42),
          )}</h3>
        </div>
        ${pill(panel.mode || "read-only")}
      </div>
      <p class="brain-assistant-move" title="${escapeHtml(recommendedMove)}">
        <b>Recommended move</b>
        <span>${escapeHtml(truncateText(recommendedMove, 126))}</span>
      </p>
      <div class="brain-assistant-grid">
        <section class="brain-assistant-section">
          <b>What I know</b>
          <ul>${brainAssistantItems(panel.whatIKnow)}</ul>
        </section>
        <section class="brain-assistant-section">
          <b>Evidence</b>
          <ul>${brainAssistantItems(panel.evidence)}</ul>
        </section>
        <section class="brain-assistant-section">
          <b>Permission boundary</b>
          <p title="${escapeHtml(permissionBoundary)}">${escapeHtml(truncateText(permissionBoundary, 150))}</p>
        </section>
        <section class="brain-assistant-section">
          <b>Limits</b>
          <ul>${brainAssistantItems(panel.limits)}</ul>
        </section>
      </div>
      <p class="brain-assistant-sources" title="${escapeHtml(sourceText)}">
        <b>Sources</b>
        <span>${escapeHtml(truncateText(sourceText, 92))}</span>
      </p>
    </section>
  `;
}

export function renderSystemHomeCockpit(cockpit = null) {
  if (!cockpit) return "";

  const sections = asArray(cockpit.sections);
  const sourceText = asArray(cockpit.sourceIds).join(", ") || "local state";

  return `
    <details
      class="system-home-cockpit"
      data-system-home-id="${escapeHtml(cockpit.id || "system-home-cockpit")}"
      data-browser-writes="${cockpit.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${cockpit.title || "System Home"}: ${cockpit.nextSafeAction || "Review Home."}`)}"
    >
      <summary class="system-home-summary">
        <b>System Home</b>
        <span>Today</span>
        <span>Projects</span>
        <span>Approvals</span>
        <span>Operator</span>
        <span>Routines</span>
        <span>Assistant</span>
        <em>Next safe action</em>
      </summary>
      <div class="system-home-body">
      <div class="system-home-head">
        <div>
          <p class="section-kicker">System Home</p>
          <h3>${escapeHtml(publicTitle(cockpit.title || "System Home Cockpit", "System Home Cockpit"))}</h3>
          <small title="${escapeHtml(cockpit.subtitle || "Read-only operating front door")}">${escapeHtml(
            truncateText(cockpit.subtitle || "Read-only operating front door", 54),
          )}</small>
        </div>
        ${pill(cockpit.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="system-home-detail">
        <div class="system-home-detail-summary">
          <span>Today</span>
          <span>Projects</span>
          <span>Approvals</span>
          <span>Operator</span>
          <span>Routines</span>
          <span>Assistant</span>
        </div>
        <div class="system-home-grid">
          ${sections
            .slice(0, 6)
            .map(
              (section) => `
                <article class="system-home-tile" data-home-section="${escapeHtml(section.id || section.title || "section")}">
                  <div class="system-home-tile-head">
                    <b>${escapeHtml(publicTitle(section.title || "Section", "Section"))}</b>
                    ${pill(section.status || "ready")}
                  </div>
                  <strong title="${escapeHtml(section.signal || "No signal recorded.")}">${escapeHtml(
                    truncateText(section.signal || "No signal recorded.", 42),
                  )}</strong>
                  <p title="${escapeHtml(section.detail || "No detail recorded.")}">${escapeHtml(
                    truncateText(section.detail || "No detail recorded.", 96),
                  )}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="system-home-next">
        <p>
          <b>Next safe action</b>
          <span title="${escapeHtml(cockpit.nextSafeAction || "Review Home.")}">${escapeHtml(
            truncateText(cockpit.nextSafeAction || "Review Home.", 44),
          )}</span>
        </p>
        <div class="system-home-boundary">
          <div>
            <span>Boundary</span>
            <small title="${escapeHtml(sourceText)}">sources listed</small>
          </div>
          <p>${escapeHtml(cockpit.approvalBoundary || "Read-only. No browser writes.")}</p>
        </div>
      </div>
      </div>
    </details>
  `;
}

export function renderTodayCommandSurface(surface = null) {
  if (!surface) return "";

  const sections = asArray(surface.sections);
  const currentGate = surface.currentGate || "No gate recorded";
  const currentGateToken = currentGate.match(/\bTASK-\d{3}\b/)?.[0] || truncateText(currentGate, 20);
  const sourceText = asArray(surface.sourceIds).join(", ") || "local state";

  return `
    <details
      class="today-command-surface"
      data-today-command-id="${escapeHtml(surface.id || "today-command-surface")}"
      data-browser-writes="${surface.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${surface.title || "Today Command"}: ${surface.safeNextMove || "Review Today."}`)}"
    >
      <summary class="today-command-summary">
        <b>Today</b>
        <span title="${escapeHtml(currentGate)}">${escapeHtml(currentGateToken)}</span>
        <em>Next</em>
      </summary>
      <div class="today-command-body">
        <div class="today-command-grid">
          ${sections
            .slice(0, 4)
            .map(
              (section) => `
                <article class="today-command-card" data-today-section="${escapeHtml(section.id || section.title || "section")}">
                  <div class="today-command-card-head">
                    <b>${escapeHtml(publicTitle(section.title || "Section", "Section"))}</b>
                    ${pill(section.status || "ready")}
                  </div>
                  <strong title="${escapeHtml(section.signal || "No signal recorded.")}">${escapeHtml(
                    truncateText(section.signal || "No signal recorded.", 42),
                  )}</strong>
                  <p title="${escapeHtml(section.detail || "No detail recorded.")}">${escapeHtml(
                    truncateText(section.detail || "No detail recorded.", 88),
                  )}</p>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="today-command-next">
          <p>
            <b>Safe next move</b>
            <span title="${escapeHtml(surface.safeNextMove || "Review Today.")}">${escapeHtml(
              truncateText(surface.safeNextMove || "Review Today.", 72),
            )}</span>
          </p>
          <details class="today-command-boundary">
            <summary>
              <span>Boundary</span>
              <small title="${escapeHtml(sourceText)}">sources listed</small>
            </summary>
            <p>${escapeHtml(surface.approvalBoundary || "Read-only. No browser writes.")}</p>
          </details>
        </div>
      </div>
    </details>
  `;
}

export function renderSpatialCommandOverlay(root, overlay = null) {
  if (!root) return;
  if (!overlay) {
    root.innerHTML = "";
    return;
  }

  const cards = asArray(overlay.cards)
    .slice(0, 3)
    .map(
      (card) => `
        <article class="spatial-command-point">
          <span>${escapeHtml(card.label || "Signal")}</span>
          <b title="${escapeHtml(card.detail || card.value || "")}">${escapeHtml(truncateText(card.value || "Ready", 18))}</b>
          <small title="${escapeHtml(card.detail || "")}">${escapeHtml(truncateText(card.detail || "", 34))}</small>
        </article>
      `,
    )
    .join("");

  root.innerHTML = `
    <section
      class="spatial-command-card"
      data-spatial-command-id="${escapeHtml(overlay.id || "spatial-command-overlay")}"
      data-browser-writes="${overlay.browserWrites ? "true" : "false"}"
      tabindex="0"
      aria-label="${escapeHtml(`${overlay.title || "Today"}: ${overlay.currentGate || "No current gate"}`)}"
    >
      <div class="spatial-command-head">
        <span>${escapeHtml(overlay.title || "Today")}</span>
        <strong title="${escapeHtml(overlay.currentGate || "")}">${escapeHtml(
          truncateText(overlay.currentGate || "No gate recorded", 34),
        )}</strong>
        <em>Map command</em>
      </div>
      <div class="spatial-command-grid">
        ${cards}
      </div>
      <p class="spatial-command-route">${escapeHtml(overlay.route || "Open Details for evidence and actions.")}</p>
    </section>
  `;
}
