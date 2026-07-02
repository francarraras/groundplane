import { asArray, escapeHtml, field, publicCountLabel, publicText, publicTitle, publicTypeLabel, statusDot, truncateText } from "./helpers.js";

function districtSummaryBrief(summary = {}) {
  const nodeCount = Number.isFinite(summary.nodeCount) ? summary.nodeCount : 0;
  const relationshipCount = Number.isFinite(summary.relationshipCount) ? summary.relationshipCount : 0;
  const sourceBacked = Number.isFinite(summary.sourceBackedRelationshipCount) ? summary.sourceBackedRelationshipCount : 0;
  const anchor = summary.anchorTitle || "No active anchor";
  return `${publicCountLabel(nodeCount, "item")} / ${publicCountLabel(
    relationshipCount,
    "connection",
  )} / ${sourceBacked} sourced / ${anchor}`;
}

function districtSummaryLabel(summary = {}, fullSummary = "") {
  const title = publicTitle(summary.title || "Area", "Area");
  const scope = publicText(summary.scope || "area");
  return `${title}: ${scope}. ${districtSummaryBrief(summary)}. ${fullSummary}`;
}

export function renderDistrictFocusSummary(model) {
  const summary = model?.activeDistrictSummary;
  if (!summary) return "";

  const dominantTypes = asArray(summary.dominantTypes);
  const typeText = dominantTypes.length > 0 ? dominantTypes.map(publicTypeLabel).join(" / ") : "mixed";
  const fullSummary = publicText(summary.summary || "No area summary available.");
  const briefText = districtSummaryBrief(summary);
  const summaryTitle = publicTitle(summary.title || "Area", "Area");

  return `
    <section class="inspector-section district-focus-summary" data-inspector-scope="${escapeHtml(
      summary.scope || "district",
    )}" title="${escapeHtml(fullSummary)}" aria-label="${escapeHtml(districtSummaryLabel(summary, fullSummary))}">
      <div class="district-focus-head">
        <div>
          <p class="section-kicker">Area focus</p>
          <h2>${escapeHtml(summaryTitle)}</h2>
        </div>
        <div class="district-focus-status">
          ${statusDot(summary.permissionMode || "suggest-only")}
          ${statusDot(summary.approvalStatus || "approved")}
        </div>
      </div>
      <p class="district-focus-brief" title="${escapeHtml(fullSummary)}">${escapeHtml(truncateText(briefText, 54))}</p>
      <details class="district-summary-detail">
        <summary>
          <span>Area details</span>
          <small>${escapeHtml(truncateText(summary.anchorTitle || "No active anchor", 28))}</small>
        </summary>
        <div class="district-summary-detail-body">
          <p>${escapeHtml(fullSummary)}</p>
          <dl class="district-summary-grid">
            ${field("Items", summary.nodeCount ?? 0)}
            ${field("Connections", summary.relationshipCount ?? 0)}
            ${field("Sourced links", summary.sourceBackedRelationshipCount ?? 0)}
            ${field("Visible links", summary.visualRelationshipCount ?? 0)}
            ${field("Primary anchor", summary.anchorTitle || "No active anchor")}
          </dl>
          <p class="district-type-row">${escapeHtml(typeText)}</p>
        </div>
      </details>
    </section>
  `;
}
