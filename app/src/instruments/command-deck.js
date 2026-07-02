import { firstBlockingReview, renderApprovalQueueRail, renderReviewDraftPreview } from "./approvals.js";
import { renderAssistantBrief, renderBrainAssistantBehavior } from "./assistant-panels.js";
import { renderEvidenceTrail } from "./evidence.js";
import { renderDistrictFocusSummary } from "./focus-summary.js";
import { asArray, drawerCountLabel, escapeHtml, field, publicCountLabel, publicScopeLabel, publicSubtitle, publicText, publicTitle, statusDot, truncateText } from "./helpers.js";
import { renderProjectWorkspacePanel } from "./project-panels.js";
import { renderProofPackagePanel } from "./proof.js";
import { regionTitle, relationshipPathTitle, renderRelationshipList, renderSelectedRelationship } from "./relationships.js";
import { renderSafeActions } from "./safe-actions.js";

function drawerLabel(kind, title) {
  const labels = {
    proof: "Proof",
    relationship: "Connection",
    relationships: "Connections",
    sources: "Evidence",
    actions: "Next steps",
    approvals: "Reviews",
    system: "System",
    more: "Details",
  };
  return labels[kind] || title || "Detail";
}

function drawer(kind, title, meta, body, open = false) {
  const state = open ? "open" : "closed";
  const drawerMeta = publicText(meta || "Open");
  const visibleTitle = drawerLabel(kind, title);
  const summaryLabel = `${visibleTitle}: ${drawerMeta}`;
  return `
    <details class="command-deck-drawer" data-drawer-kind="${escapeHtml(kind)}" data-drawer-state="${escapeHtml(
      state,
    )}" ${open ? "open" : ""}>
      <summary data-drawer-state="${escapeHtml(state)}" title="${escapeHtml(drawerMeta)}" aria-label="${escapeHtml(summaryLabel)}">
        <span class="drawer-copy">
          <strong title="${escapeHtml(visibleTitle)}">${escapeHtml(truncateText(visibleTitle, 18))}</strong>
          <small class="drawer-meta" aria-hidden="true">${escapeHtml(truncateText(drawerMeta, 18))}</small>
        </span>
        <span class="drawer-state" aria-hidden="true">${open ? "-" : "+"}</span>
      </summary>
      <div class="command-deck-drawer-body">
        ${body}
      </div>
    </details>
  `;
}

function secondaryCommandPanel(kind, title, meta, body) {
  const panelMeta = meta || "Open";
  return `
    <details class="secondary-command-detail" data-secondary-kind="${escapeHtml(kind)}">
      <summary title="${escapeHtml(panelMeta)}" aria-label="${escapeHtml(`${title}: ${panelMeta}`)}">
        <span>${escapeHtml(drawerLabel(kind, title))}</span>
        <small>${escapeHtml(truncateText(panelMeta, 22))}</small>
      </summary>
      <div class="secondary-command-body">
        ${body}
      </div>
    </details>
  `;
}

function cockpitScope(model, selectedRelationship) {
  if (selectedRelationship) return "relationship";
  if (model?.activeDistrictId) return "district";
  return "region";
}

function plainDecisionTitle(review = {}) {
  const summary = String(review.summary || review.id || "Review pending packet");
  const normalized = summary.toLowerCase();
  if (normalized.includes("personal assistant cockpit")) return "Review cockpit feel";
  if (normalized.includes("proof artifact")) return "Review proof artifact";
  if (normalized.includes("proof-project")) return "Review proof workflow";
  if (normalized.includes("manual review handoff")) return "Review handoff writer";
  return truncateText(summary, 52);
}

function decisionSourceText(sourceIds) {
  const count = asArray(sourceIds).length;
  if (count === 0) return "none";
  return `${count} source${count === 1 ? "" : "s"}`;
}

function decisionCardModel(reviewQueue, graphWarnings) {
  const pendingReview = firstBlockingReview(reviewQueue);
  if (pendingReview) {
    const sourceIds = asArray(pendingReview.source_ids || pendingReview.sourceIds);
    return {
      state: "Decision needed",
      title: plainDecisionTitle(pendingReview),
      action: "Approve / revise / reject.",
      detail: pendingReview.diff_summary || "A draft-for-approval packet is waiting in the review queue.",
      tone: "approval",
      meta: [
        ["ID", pendingReview.id || "review"],
        ["Risk", pendingReview.risk || "unknown"],
        ["Target", pendingReview.target_file || pendingReview.targetFile || "none"],
        ["Sources", decisionSourceText(sourceIds)],
      ],
    };
  }

  if (asArray(graphWarnings).length > 0) {
    return {
      state: "Graph review",
      title: `${graphWarnings.length} graph warning${graphWarnings.length === 1 ? "" : "s"}`,
      action: "Inspect graph warnings before promoting this focus.",
      detail: "Relationship graph verification found warning-level issues.",
      tone: "warning",
      meta: [
        ["Warnings", graphWarnings.length],
        ["Target", "indexes/relationship-graph.json"],
        ["Mode", "automatic-low-risk"],
      ],
    };
  }

  return {
    state: "Clear",
    title: "No blocking approval visible",
    action: "Inspect current focus.",
    detail: "This focus has no pending review packet or graph warning in the current local state.",
    tone: "clear",
    meta: [
      ["Risk", "low"],
      ["Target", "none"],
      ["Mode", "suggest-only"],
    ],
  };
}

function recommendedActionLabel(actions = []) {
  const candidates = asArray(actions);
  const candidate = candidates.find((action) => action?.allowed === true || !action?.requiresExplicitApproval) || candidates[0];
  return candidate?.label || candidate?.actionType || "";
}

function conciseNextAction(action, region, hasBlockingDecision, actions = []) {
  if (hasBlockingDecision) return action || "Decision required";

  const recommendedAction = recommendedActionLabel(actions);
  if (recommendedAction) return recommendedAction;

  const nodeCount = Number.isFinite(region?.nodeCount) ? region.nodeCount : null;
  const relationshipCount = Number.isFinite(region?.relationshipCount) ? region.relationshipCount : null;
  const actionCounts = String(action || "").match(/contains\s+(\d+)\s+nodes?(?:\s+and\s+(\d+)\s+local\s+relationships?)?/i);
  if (actionCounts) {
    const parsedNodeCount = Number(actionCounts[1]);
    const parsedRelationshipCount = actionCounts[2]
      ? Number(actionCounts[2])
      : actionCounts[0].toLowerCase().includes("no source-backed")
        ? 0
        : null;

    if (Number.isFinite(parsedNodeCount) && Number.isFinite(parsedRelationshipCount)) {
      return `${publicCountLabel(parsedNodeCount, "item")} / ${publicCountLabel(parsedRelationshipCount, "connection")}`;
    }

    if (Number.isFinite(parsedNodeCount)) return publicCountLabel(parsedNodeCount, "item");
  }

  if (nodeCount !== null && relationshipCount !== null) {
    return `${publicCountLabel(nodeCount, "item")} / ${publicCountLabel(relationshipCount, "connection")}`;
  }

  if (nodeCount !== null) return publicCountLabel(nodeCount, "item");
  return truncateText(publicText(action || "Inspect focus."), 34);
}

function entityIdSuffix(entity) {
  return String(entity?.id || "")
    .split(":")
    .filter(Boolean)
    .pop()
    ?.replace(/[_-]+/g, " ")
    .trim();
}

function isSentenceLikeText(value) {
  const text = String(value || "").trim();
  return text.length > 42 && /[.!?]$|\s(as|that|with|from|into|because|while)\s/i.test(text);
}

function compactEntityTitle(entity, fallback = "Focus") {
  const title = String(entity?.title || entity?.label || entity?.id || fallback)
    .replace(/\s+/g, " ")
    .trim();
  if (!isSentenceLikeText(title)) return title || fallback;

  const type = String(entity?.type || "item")
    .replace(/[_-]+/g, " ")
    .trim();
  const suffix = entityIdSuffix(entity) || "item";
  return `${type} ${suffix}`.trim();
}

function approvalDrawerMeta(pendingCount, resolvedCount) {
  if (pendingCount > 0) return drawerCountLabel(pendingCount, "pending");
  if (resolvedCount > 0) return drawerCountLabel(resolvedCount, "done", "done");
  return "clear";
}

function commandPriorityMetric({ activeTaskCount = 0, pendingReviewCount = 0, relationshipCount = 0, sourceCount = 0 } = {}) {
  if (pendingReviewCount > 0) return drawerCountLabel(pendingReviewCount, "approval");
  if (activeTaskCount > 0) return drawerCountLabel(activeTaskCount, "task");
  if (relationshipCount > 0) return drawerCountLabel(relationshipCount, "connection");
  if (sourceCount > 0) return drawerCountLabel(sourceCount, "evidence item");
  return "clear";
}

function renderDecisionCard(card, options = {}) {
  const metaRows = asArray(card?.meta);
  const detailText = card?.detail || "No decision context recorded.";
  const hideTitle = Boolean(options.hideTitle);
  const showLedeState = !hideTitle;
  const contextSummary = metaRows
    .filter(([label]) => ["Risk", "Sources", "Warnings"].includes(label))
    .map(([, value]) => value)
    .join(" / ");
  return `
    <section class="decision-card" data-decision-tone="${escapeHtml(card?.tone || "clear")}">
      <div class="decision-card-lede">
        ${showLedeState ? `<p class="section-kicker">${escapeHtml(card?.state || "Decision")}</p>` : ""}
        ${hideTitle ? "" : `<strong>${escapeHtml(truncateText(card?.title || "No decision title", 82))}</strong>`}
        <span class="decision-card-action">${escapeHtml(truncateText(card?.action || "No action recorded.", 36))}</span>
      </div>
      <details class="decision-card-detail">
        <summary>
          <span>Decision context</span>
          <small>${escapeHtml(contextSummary || "open")}</small>
        </summary>
        <div class="decision-card-context">
          <p>${escapeHtml(truncateText(detailText, 140))}</p>
          <div class="decision-card-meta">
            ${metaRows
              .map(
                ([label, value]) => `
                  <span class="decision-meta-field">
                    <b>${escapeHtml(label)}</b>
                    <em>${escapeHtml(value === undefined || value === null || value === "" ? "none" : value)}</em>
                  </span>
                `,
              )
              .join("")}
          </div>
        </div>
      </details>
    </section>
  `;
}

function areaBriefText(value, fallback = "No summary recorded.") {
  return publicText(value || fallback)
    .replace(/\bsource-backed\b/gi, "sourced")
    .replace(/\bvisual gravity\b/gi, "map weight")
    .replace(/\bcurrent anchor\b/gi, "current focus")
    .replace(/\bgraph\b/gi, "map")
    .replace(/\s+/g, " ")
    .trim();
}

function areaSignalText({ activeTaskCount = 0, pendingReviewCount = 0, status, health } = {}) {
  if (pendingReviewCount > 0) return drawerCountLabel(pendingReviewCount, "approval");
  if (activeTaskCount > 0) return drawerCountLabel(activeTaskCount, "signal");
  return [status, health].filter(Boolean).map(publicText).slice(0, 2).join(" / ") || "clear";
}

function areaPurposeLine(region) {
  const countText = publicText(region?.subtitle || "");
  const stateText = publicText(region?.status || "");
  if (countText && stateText) return `${countText} / ${stateText}`;
  if (countText) return countText;

  const nodeCount = asArray(region?.district?.nodeIds).length;
  if (nodeCount > 0) return publicCountLabel(nodeCount, "item");
  return areaBriefText(region?.summary || region?.nextAction || region?.subtitle, "No summary recorded.");
}

function compactBriefNext(value) {
  return areaBriefText(value || "Inspect this area", "Inspect this area")
    .replace(/\bInspect evidence sources\b/i, "Inspect sources")
    .replace(/\bDraft review item\b/i, "Draft review")
    .replace(/\bExplain relationship\b/i, "Explain connection")
    .replace(/\bApprove \/ revise \/ reject\.\b/i, "Resolve review");
}

function areaBriefLinkTitle(model, relationship = {}, fallbackRegion) {
  if (!relationship) return "";
  if (relationship.fromTitle && relationship.toTitle) {
    return relationshipPathTitle(publicTitle(relationship.fromTitle), publicTitle(relationship.toTitle));
  }

  const fallbackTitle = publicTitle(fallbackRegion?.title || fallbackRegion?.id || "Current area", "Current area");
  const otherId = relationship.to === fallbackRegion?.id ? relationship.from : relationship.to;
  const otherTitle = regionTitle(model, otherId || relationship.to || relationship.from);
  return relationshipPathTitle(fallbackTitle, otherTitle);
}

function areaBriefModel({
  model,
  region,
  selectedRelationship = null,
  related = [],
  sourceCount = 0,
  relationshipCount = 0,
  activeTaskCount = 0,
  pendingReviewCount = 0,
  hasBlockingDecision = false,
  decisionCard = {},
  nextActionDisplay = "",
  nextActionText = "",
  scopeLabel = "Home",
} = {}) {
  const title = selectedRelationship
    ? areaBriefLinkTitle(model, selectedRelationship, region)
    : publicTitle(region?.title || region?.id || "Selected area", "Selected area");
  const purpose = selectedRelationship
    ? areaBriefText(selectedRelationship.evidence, "This connection explains why these two areas should be considered together.")
    : areaPurposeLine(region);
  const next = hasBlockingDecision ? decisionCard?.action || "Review pending" : nextActionDisplay || nextActionText || "Inspect this area";
  const linkCount = asArray(related).length;

  return {
    title,
    scope: publicText(scopeLabel),
    purpose,
    next: compactBriefNext(next),
    signals: areaSignalText({
      activeTaskCount,
      pendingReviewCount,
      status: region?.status,
      health: region?.health,
    }),
    evidence: `${sourceCount}`,
    connections: `${relationshipCount}`,
    links: linkCount > 0 ? drawerCountLabel(linkCount, "link") : "no links",
  };
}

function renderAreaBrief(brief = {}) {
  const title = publicTitle(brief.title || "Selected area", "Selected area");
  const purpose = areaBriefText(brief.purpose, "No summary recorded for this area yet.");
  const next = areaBriefText(brief.next, "Inspect this area");
  const signals = publicText(brief.signals || "clear");
  const evidence = publicText(brief.evidence || "0 sources");
  const connections = publicText(brief.connections || "0 connections");
  const links = areaBriefText(brief.links, "No visible links yet");
  const aria = `${title}. What this is: ${purpose}. Next: ${next}. Signals: ${signals}. Connections: ${connections}.`;
  const compact = brief.compact === true;

  if (compact) {
    return `
      <details class="area-brief" data-area-brief-mode="compact" aria-label="${escapeHtml(aria)}">
        <summary class="area-brief-purpose">
          <b>Area</b>
          <span title="${escapeHtml(purpose)}">${escapeHtml(truncateText(title, 34))}</span>
        </summary>
        <div class="area-brief-grid">
          <span class="area-brief-next">
            <b>Next</b>
            <em title="${escapeHtml(next)}">${escapeHtml(truncateText(next, 28))}</em>
          </span>
          <span>
            <b>Signals</b>
            <em>${escapeHtml(truncateText(signals, 24))}</em>
          </span>
        </div>
        <p class="area-brief-links" title="${escapeHtml(links)}">
          <span>${escapeHtml(`${connections} / ${evidence}`)}</span>
        </p>
      </details>
    `;
  }

  return `
    <section class="area-brief" aria-label="${escapeHtml(aria)}">
      <p class="area-brief-purpose">
        <b>What this is</b>
        <span>${escapeHtml(truncateText(purpose, 150))}</span>
      </p>
      <div class="area-brief-grid">
        <span class="area-brief-next">
          <b>Next</b>
          <em title="${escapeHtml(next)}">${escapeHtml(truncateText(next, 38))}</em>
        </span>
        <span>
          <b>Signals</b>
          <em>${escapeHtml(truncateText(signals, 28))}</em>
        </span>
        <span>
          <b>Evidence</b>
          <em>${escapeHtml(evidence)}</em>
        </span>
        <span>
          <b>Connections</b>
          <em>${escapeHtml(connections)}</em>
        </span>
      </div>
      <p class="area-brief-links" title="${escapeHtml(links)}">
        <span>${escapeHtml(truncateText(links, 54))}</span>
      </p>
    </section>
  `;
}

export function renderCommandDeck({
  model,
  region,
  selectedRelationship = null,
  related = [],
  reviewDraftPreview = null,
  focus = {},
}) {
  const activeTasks = asArray(model?.activeTasks);
  const pendingReviews = asArray(model?.pendingReviews);
  const resolvedReviews = asArray(model?.resolvedReviews);
  const reviewQueue = model?.reviewQueue || { pending: pendingReviews, resolved: resolvedReviews };
  const regions = asArray(model?.regions);
  const graphWarnings = asArray(model?.graph?.warnings);
  const evidenceSubject = selectedRelationship || region;
  const scope = cockpitScope(model, selectedRelationship);
  const safeActions = asArray(evidenceSubject?.safeActions);
  const actionCount = safeActions.length;
  const relationshipCount = asArray(related).length;
  const proofPackage = model?.proofPackage;
  const sourceCount = asArray(evidenceSubject?.evidenceTrail?.records).length;
  const scopeLabel = publicScopeLabel(scope, model);
  const decisionCard = decisionCardModel(reviewQueue, graphWarnings);
  const hasBlockingDecision = decisionCard.tone !== "clear";
  const nextActionText = hasBlockingDecision
    ? decisionCard.action || focus.nextAction || region.nextAction || "No next action available"
    : focus.nextAction || region.nextAction || decisionCard.action || "No next action available";
  const nextActionDisplay = conciseNextAction(nextActionText, region, hasBlockingDecision, safeActions);
  const shouldShowDecisionCard = hasBlockingDecision;
  const nowText = publicSubtitle(region);
  const briefLabel = `Viewing: ${nowText}. Next: ${nextActionDisplay}. Context: ${publicText(nextActionText)}`;
  const priorityMetric = commandPriorityMetric({
    activeTaskCount: activeTasks.length,
    pendingReviewCount: pendingReviews.length,
    relationshipCount,
    sourceCount,
  });
  const fullRegionTitle = publicTitle(region.title || region.id || "Untitled focus", "Untitled focus");
  const compactRegionTitle = compactEntityTitle({ ...region, title: fullRegionTitle }, "Untitled focus");
  const deckTitle = hasBlockingDecision ? decisionCard.title || compactRegionTitle : compactRegionTitle;
  const fullDeckTitle = hasBlockingDecision ? decisionCard.title || fullRegionTitle : fullRegionTitle;
  const deckKicker = hasBlockingDecision ? "Review needed" : scopeLabel;
  const deckContext = model?.assistantBrief ? "Map" : model?.activeDistrictId ? "Inside area" : "Map overview";
  const areaBrief = areaBriefModel({
    model,
    region,
    selectedRelationship,
    related,
    sourceCount,
    relationshipCount,
    activeTaskCount: activeTasks.length,
    pendingReviewCount: pendingReviews.length,
    hasBlockingDecision,
    decisionCard,
    nextActionDisplay,
    nextActionText,
    scopeLabel,
  });
  if (model?.assistantBrief) areaBrief.compact = true;
  const shouldShowSystemHome = Boolean(model?.systemHomeCockpit && !model?.activeDistrictId && !selectedRelationship);
  const secondaryPanels = [
    model?.brainAssistantBehavior
      ? secondaryCommandPanel(
          "assistant-behavior",
          "Assistant behavior",
          model.brainAssistantBehavior.mode || "read-only",
          renderBrainAssistantBehavior(model.brainAssistantBehavior),
        )
      : "",
    proofPackage
      ? secondaryCommandPanel("proof", "Proof artifact", proofPackage.status || "local", renderProofPackagePanel(proofPackage))
      : "",
    secondaryCommandPanel(
      "relationships",
      "Connections",
      `${relationshipCount} visible`,
      `<section class="inspector-section"><p class="section-kicker">Connections</p>${renderRelationshipList(
        related,
        selectedRelationship?.id,
      )}</section>`,
    ),
    secondaryCommandPanel(
      "system",
      "System status",
      model?.phase || "unknown",
      `<section class="inspector-section">
        <p class="section-kicker">Status</p>
        <dl class="system-readout system-readout-grid">
          ${field("Active tasks", activeTasks.length)}
          ${field("Pending reviews", pendingReviews.length)}
          ${field("Resolved reviews", resolvedReviews.length)}
            ${field("Areas", regions.length)}
        </dl>
        <details class="system-integrity-detail">
          <summary>
            <span>Health check</span>
            <small>${escapeHtml(`${graphWarnings.length} map warning${graphWarnings.length === 1 ? "" : "s"}`)}</small>
          </summary>
          <dl class="system-integrity-grid">
          ${field("Phase", model?.phase || "unknown")}
          ${field("Updated", model?.updatedAt || "unknown")}
            ${field("Health warnings", graphWarnings.length)}
          </dl>
        </details>
      </section>`,
    ),
  ].filter(Boolean);

  return `
    <section class="command-deck" data-cockpit-scope="${escapeHtml(scope)}">
      ${renderDistrictFocusSummary(model)}

      <section class="inspector-section inspector-lede command-deck-primary mission-control-panel" data-command-priority="primary">
        <div class="command-deck-header">
          <div>
            <p class="section-kicker">${escapeHtml(deckKicker)}</p>
            <h2 title="${escapeHtml(fullDeckTitle)}" aria-label="${escapeHtml(fullDeckTitle)}">${escapeHtml(
              truncateText(deckTitle, 42),
            )}</h2>
            <small class="command-deck-context" title="${escapeHtml(deckContext)}">${escapeHtml(truncateText(deckContext, 40))}</small>
          </div>
          <div class="command-deck-status">
            ${statusDot(region.status)}
            ${statusDot(region.health)}
            ${statusDot(scopeLabel)}
          </div>
        </div>

        ${shouldShowDecisionCard ? renderDecisionCard(decisionCard, { hideTitle: true }) : ""}

        ${renderAssistantBrief(model?.assistantBrief)}

        ${shouldShowSystemHome ? "" : renderAreaBrief(areaBrief)}

        ${renderProjectWorkspacePanel(region.projectWorkspace)}

        ${
          model?.assistantBrief
            ? ""
            : `<div class="cockpit-brief command-line-brief" title="${escapeHtml(briefLabel)}" aria-label="${escapeHtml(briefLabel)}">
                <span>Viewing</span>
                <strong>${escapeHtml(truncateText(nowText, 24))}</strong>
                <span>Next</span>
                <strong>${escapeHtml(truncateText(nextActionDisplay, 34))}</strong>
              </div>`
        }

        <details class="command-metrics-detail">
          <summary>
            <span>Status</span>
            <small>${escapeHtml(priorityMetric)}</small>
          </summary>
          <dl class="cockpit-metrics">
            ${field("Signals", activeTasks.length)}
            ${field("Approvals", pendingReviews.length)}
            ${field("Connections", relationshipCount)}
            ${field("Evidence", sourceCount)}
          </dl>
        </details>
      </section>

      <div class="command-deck-drawers" aria-label="Detail drawers">
        ${
          selectedRelationship
            ? drawer("relationship", "Connection", "Focused path", renderSelectedRelationship(model, selectedRelationship), true)
            : ""
        }
        ${drawer("sources", "Evidence", drawerCountLabel(sourceCount, "source"), renderEvidenceTrail(evidenceSubject))}
        ${drawer(
          "actions",
          "Next steps",
          `${actionCount} routes`,
          `${renderSafeActions(evidenceSubject)}${renderReviewDraftPreview(reviewDraftPreview)}`,
        )}
        ${drawer(
          "approvals",
          "Reviews",
          approvalDrawerMeta(pendingReviews.length, resolvedReviews.length),
          renderApprovalQueueRail(reviewQueue),
        )}
        ${drawer(
          "more",
          "Details",
          `${secondaryPanels.length} more`,
          `<div class="secondary-command-stack">${secondaryPanels.join("")}</div>`,
        )}
      </div>
    </section>
  `;
}
