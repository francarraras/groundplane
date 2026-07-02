import { asArray, browserWriteLabel, escapeHtml, field, publicText, truncateText } from "./helpers.js";

function compactActionGate(action = {}) {
  if (action.requiresExplicitApproval) return "Needs approval";
  if (action.allowed === false) return "Locked";
  return "Ready";
}

function compactActionMode(action = {}) {
  const normalizedMode = String(action.mode || "suggest-only").toLowerCase();
  const modeLabels = {
    "automatic-low-risk": "Automatic",
    "draft-for-approval": "Draft for review",
    "suggest-only": "Suggestion",
    "forbidden-in-v0": "Not available",
  };
  const riskLabels = {
    "low": "Low risk",
    "medium": "Medium risk",
    "high": "High risk",
  };
  const mode = modeLabels[normalizedMode] || normalizedMode.replace(/-/g, " ");
  const risk = riskLabels[String(action.risk || "low").toLowerCase()] || String(action.risk || "low").toLowerCase();
  return `${mode} · ${risk}`;
}

function actionDetailMeta(action = {}) {
  const details = [];
  if (action.targetFile) details.push(`Target: ${action.targetFile}`);
  if (asArray(action.sourceIds).length > 0) details.push(`Evidence: ${asArray(action.sourceIds).join(", ")}`);
  return details.length > 0 ? details.join(" / ") : "No file write";
}

function actionTargetText(action = {}) {
  return action.targetFile || "No file write";
}

function actionSourceText(action = {}) {
  const sourceIds = asArray(action.sourceIds);
  return sourceIds.length > 0 ? sourceIds.join(", ") : "No evidence ids";
}

function actionUndoText(action = {}) {
  if (action.undoPath || action.undo_path) return action.undoPath || action.undo_path;
  if (action.targetFile) return "Review the packet before any file write.";
  return "Nothing to undo; this action does not write files.";
}

function actionFlowModel(actions = []) {
  const items = asArray(actions);
  const readyActions = items.filter((action) => action?.allowed === true && !action?.requiresExplicitApproval);
  const approvalActions = items.filter((action) => action?.allowed === true && action?.requiresExplicitApproval);
  const lockedActions = items.filter((action) => action?.allowed === false);
  const recommended = readyActions[0] || approvalActions[0] || lockedActions[0] || null;

  return {
    recommended,
    readyCount: readyActions.length,
    approvalCount: approvalActions.length,
    lockedCount: lockedActions.length,
    browserWrites: items.some((action) => action?.browserWrites === true),
  };
}

function actionFlowTitle(action = {}) {
  return publicText(action.label || action.actionType || "No recommended step")
    .replace(/\bevidence sources\b/i, "sources")
    .replace(/\brelationship\b/i, "connection");
}

function renderActionFlowPanel(flow = {}) {
  const action = flow.recommended || {};
  const recommendedLabel = actionFlowTitle(action);
  const riskLabel = (compactActionMode(action).split(" · ").at(-1) || "Low risk").replace(/\srisk$/i, "");
  const canAct = Number.isFinite(flow.readyCount) ? flow.readyCount : 0;
  const needsApproval = Number.isFinite(flow.approvalCount) ? flow.approvalCount : 0;

  return `
    <div class="action-flow-panel" aria-label="${escapeHtml(
      `Action flow. Recommended: ${recommendedLabel}. ${canAct} can do now. ${needsApproval} need approval.`,
    )}">
      <div class="action-flow-head">
        <p class="section-kicker">Action flow</p>
        <strong>${escapeHtml(truncateText(recommendedLabel, 34))}</strong>
        <span>${escapeHtml(compactActionGate(action))}</span>
      </div>
      <div class="action-flow-grid">
        <span><b>Can do now</b><em>${escapeHtml(canAct)}</em></span>
        <span><b>Needs approval</b><em>${escapeHtml(needsApproval)}</em></span>
        <span><b>Risk</b><em>${escapeHtml(riskLabel)}</em></span>
        <span><b>Browser writes</b><em>${escapeHtml(browserWriteLabel(flow.browserWrites))}</em></span>
      </div>
      <details class="action-flow-detail">
        <summary>
          <span>Undo path</span>
          <small>Open</small>
        </summary>
        <dl class="action-flow-meta">
          ${field("Target", actionTargetText(action))}
          ${field("Sources", actionSourceText(action))}
          ${field("Undo path", actionUndoText(action))}
        </dl>
      </details>
      <p class="action-flow-boundary">Read-only.</p>
    </div>
  `;
}

function renderActionRoute(action = {}) {
  const isAllowed = action.allowed === true;
  const approvalText = action.requiresExplicitApproval ? "Approval required" : "No approval required";
  const detailMeta = actionDetailMeta(action);
  const routeLabel = publicText(action.label || action.actionType || "Action");
  const routeSummary = publicText(action.routeSummary || "No route summary available.");
  const routeMeta = compactActionMode(action);
  return `
    <li>
      <details class="action-route-card${isAllowed ? "" : " is-locked"}">
        <summary class="action-route-summary" title="${escapeHtml(`${routeLabel}: ${routeMeta}. ${approvalText}`)}">
          <span>
            <strong>${escapeHtml(truncateText(routeLabel, 24))}</strong>
            <small>${escapeHtml(routeMeta)}</small>
          </span>
          <em title="${escapeHtml(approvalText)}">${escapeHtml(compactActionGate(action))}</em>
        </summary>
        <div class="action-route-detail">
          <p>${escapeHtml(routeSummary)}</p>
          <button
            class="action-route-button${isAllowed ? "" : " is-locked"}"
            type="button"
            data-action-route-id="${escapeHtml(action.id)}"
            data-action-type="${escapeHtml(action.actionType || "")}"
            ${isAllowed ? "" : "disabled"}
          >
            <strong>Open step details</strong>
            <small>${escapeHtml(detailMeta)}</small>
          </button>
        </div>
      </details>
    </li>
  `;
}

export function renderSafeActions(subject) {
  const actions = asArray(subject?.safeActions);
  if (actions.length === 0) {
    return `
      <section class="inspector-section safe-actions">
        <p class="section-kicker">Next steps</p>
        <p class="empty-note">No next steps available for this focus.</p>
      </section>
    `;
  }
  const actionFlow = actionFlowModel(actions);
  const visibleActions = actions.slice(0, 2);
  const overflowActions = actions.slice(2);

  return `
    <section class="inspector-section safe-actions">
      <p class="section-kicker">Next steps</p>
      ${renderActionFlowPanel(actionFlow)}
      <details class="action-routes-detail">
        <summary>
          <span>Steps</span>
          <small>${escapeHtml(actions.length)}</small>
        </summary>
        <ul class="action-route-list">
          ${visibleActions.map(renderActionRoute).join("")}
        </ul>
        ${
          overflowActions.length === 0
            ? ""
            : `
              <details class="action-overflow-detail">
                <summary>
                  <span>More steps</span>
                  <small>${overflowActions.length}</small>
                </summary>
                <ul class="action-route-list action-route-overflow-list">
                  ${overflowActions.map(renderActionRoute).join("")}
                </ul>
              </details>
            `
        }
      </details>
    </section>
  `;
}
