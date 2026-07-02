import { asArray, browserWriteLabel, escapeHtml, field, pill, truncateText } from "./helpers.js";

function reviewRisk(review = {}) {
  return String(review.risk || review.risk_level || "unknown").toLowerCase();
}

function isBlockingReview(review = {}) {
  return !["low", "none", "info", "informational"].includes(reviewRisk(review));
}

export function firstBlockingReview(reviewQueue) {
  const { pending } = normalizeReviewQueue(reviewQueue);
  return pending.find(isBlockingReview) || null;
}

export function renderReviewDraftPreview(preview) {
  if (!preview) return "";

  const sourceIds = asArray(preview.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";

  return `
    <section class="inspector-section review-draft-preview" data-review-preview-status="${escapeHtml(
      preview.status || "draft-preview",
    )}">
      <p class="section-kicker">Review packet preview</p>
      <h3>${escapeHtml(preview.summary || "Draft review packet")}</h3>
      <p class="review-preview-notice">
        <strong>Preview only.</strong>
        ${escapeHtml(preview.preview_notice || "The browser did not write reviews/queue.json.")}
      </p>
      <dl class="review-packet-grid">
        ${field("ID", preview.id || "preview")}
        ${field("Status", preview.status || "draft-preview")}
        ${field("Action", preview.action_type || "draft_review_item")}
        ${field("Target", preview.target_file || "reviews/queue.json")}
        ${field("Approval", preview.approval_mode || "draft-for-approval")}
        ${field("Risk", preview.risk || "medium")}
        ${field("Requires approval", preview.requires_explicit_approval === false ? "no" : "yes")}
        ${field("Browser writes", preview.browser_writes === true ? "yes" : "no")}
        ${field("Sources", sourceText)}
        ${field("Source trust", preview.source_trust || "unknown")}
        ${field("Sensitivity", preview.sensitivity || "unknown")}
        ${field("Created", preview.created_at || "preview-only")}
      </dl>
      <p>${escapeHtml(preview.diff_summary || "No diff summary available.")}</p>
      ${renderResolutionGuide(preview)}
    </section>
  `;
}

function renderResolutionGuide(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const decisionCopy =
    review.revision_reason ||
    review.resolution_reason ||
    review.approval_text ||
    review.approval_reason ||
    review.reason ||
    "Choose approve, revise, or reject with an explicit review id, target, risk, source ids, and undo path.";
  const undoPath = review.undo_path || "State the undo path before any approval is accepted.";

  return `
    <div class="review-resolution-guide">
      <p class="resolution-title">Resolution guide</p>
      <div class="resolution-options" aria-label="Review resolution choices">
        <span><strong>Approve</strong> when target, risk, sources, and undo path are correct.</span>
        <span><strong>Revise</strong> when wording, evidence, or approval copy needs tightening.</span>
        <span><strong>Reject</strong> when the packet is off-scope or would mutate beyond the queue.</span>
      </div>
      <dl class="resolution-detail-grid">
        ${field("Decision copy", decisionCopy)}
        ${field("Source trust", review.source_trust || review.sourceTrust || "unknown")}
        ${field("Browser preview", review.browser_preview_id || review.browserPreviewId || review.id || "none")}
        ${field("Undo path", undoPath)}
        ${field("Sources", sourceText)}
      </dl>
      <p class="resolution-boundary">
        Queue-only decision. No state, wiki, memory, source, browser, finance, contacts, raw-source, or external mutation is included.
      </p>
    </div>
  `;
}

function normalizeReviewQueue(reviews) {
  if (reviews && typeof reviews === "object" && !Array.isArray(reviews)) {
    return {
      pending: asArray(reviews.pending),
      resolved: asArray(reviews.resolved),
    };
  }

  const allReviews = asArray(reviews);
  return {
    pending: allReviews.filter((review) => review?.status === "pending"),
    resolved: allReviews.filter(
      (review) =>
        review?.status !== "pending" &&
        (review?.resolution_status || review?.resolution_decision || review?.resolved_at),
    ),
  };
}

function reviewTargetText(review = {}) {
  const packet = review || {};
  return packet.target_file || packet.targetFile || "No write target";
}

function reviewSourceText(review = {}) {
  const packet = review || {};
  const sourceIds = asArray(packet.source_ids || packet.sourceIds || packet.resolution_source_ids);
  return sourceIds.length > 0 ? sourceIds.join(", ") : "No evidence ids";
}

function reviewUndoText(review = {}) {
  const packet = review || {};
  return packet.undo_path || packet.undoPath || "Undo path must be stated before approval.";
}

function approvalFlowModel(reviews) {
  const { pending: pendingReviews, resolved: resolvedReviews } = normalizeReviewQueue(reviews);
  const review = pendingReviews[0] || null;
  const sourceCount = asArray(review?.source_ids || review?.sourceIds).length;

  return {
    review,
    pendingCount: pendingReviews.length,
    resolvedCount: resolvedReviews.length,
    risk: review?.risk || "clear",
    target: reviewTargetText(review),
    sourceCount,
    browserWrites: review?.browser_writes === true || review?.browserWrites === true,
  };
}

function renderApprovalFlowPanel(flow = {}) {
  const review = flow.review || {};
  const title = review.summary || review.id || "No pending review";
  const sourceLabel = `${flow.sourceCount || 0}`;

  return `
    <div class="approval-flow-panel" aria-label="${escapeHtml(
      `Review decision. ${flow.pendingCount || 0} pending. ${title}.`,
    )}">
      <div class="approval-flow-head">
        <p class="section-kicker">Review decision</p>
        <strong>Approve / Revise / Reject</strong>
        <span>${escapeHtml(`${flow.pendingCount || 0} pending`)}</span>
      </div>
      <div class="approval-flow-grid">
        <span><b>Risk</b><em>${escapeHtml(flow.risk || "clear")}</em></span>
        <span><b>Target</b><em>${escapeHtml(truncateText(flow.target || "No write target", 20))}</em></span>
        <span><b>Sources</b><em>${escapeHtml(sourceLabel)}</em></span>
        <span><b>Browser writes</b><em>${escapeHtml(browserWriteLabel(flow.browserWrites))}</em></span>
      </div>
      <details class="approval-flow-detail">
        <summary>
          <span>Undo path</span>
          <small>Open</small>
        </summary>
        <dl class="approval-flow-meta">
          ${field("Target", reviewTargetText(review))}
          ${field("Sources", reviewSourceText(review))}
          ${field("Undo path", reviewUndoText(review))}
        </dl>
      </details>
      <p class="approval-flow-boundary">Queue only.</p>
    </div>
  `;
}

function renderApprovalCard(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const sourceSignal = `${sourceIds.length} src`;
  const targetSignal = review.target_file || review.targetFile || "no target";
  const decisionCopy =
    review.decision_copy ||
    review.resolution_prompt ||
    "Choose approve, revise, or reject with explicit review id, target, risk, source ids, and undo path.";
  const diffSummary = review.diff_summary || review.diffSummary || "No diff summary available.";
  const reviewTitle = review.summary || review.id || "Pending review";

  return `
    <article class="approval-queue-card is-pending" data-review-id="${escapeHtml(
      review.id || "review",
    )}" title="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}" aria-label="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}">
      <div class="approval-card-summary">
        <div class="approval-card-head">
          <strong>${escapeHtml(truncateText(reviewTitle, 34))}</strong>
          ${pill(review.risk || "unknown")}
        </div>
        <p class="approval-card-signal">${escapeHtml(`${targetSignal} / ${sourceSignal}`)}</p>
      </div>
      <details class="approval-metadata-detail">
        <summary>
          <span>Review metadata</span>
          <small>${escapeHtml(truncateText(targetSignal, 26))}</small>
        </summary>
        <dl class="approval-card-grid approval-metadata-grid">
          ${field("ID", review.id || "review")}
          ${field("Target", review.target_file || review.targetFile || "none")}
          ${field("Review mode", review.approval_mode || review.approvalMode || "unknown")}
          ${field("Sources", sourceText)}
        </dl>
      </details>
      <details class="approval-card-detail">
        <summary>
          <span>Decision copy</span>
          <small title="${escapeHtml(decisionCopy)}">Open</small>
        </summary>
        ${renderResolutionGuide(review)}
      </details>
    </article>
  `;
}

function renderResolutionOutcome(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds || review.resolution_source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const decision = review.resolution_decision || review.status || "resolved";
  const reason =
    review.resolution_reason ||
    review.rejection_reason ||
    review.approval_reason ||
    "No resolution reason recorded.";

  return `
    <article class="approval-queue-card is-resolved" data-review-id="${escapeHtml(
      review.id || "review",
    )}" data-resolution-status="${escapeHtml(review.resolution_status || review.status || "resolved")}">
      <div class="approval-card-head">
        <strong>${escapeHtml(review.summary || review.id || "Resolved review")}</strong>
        ${pill(review.resolution_status || review.status || "resolved")}
      </div>
      <dl class="approval-card-grid">
        ${field("ID", review.id || "review")}
        ${field("Status", review.status || "resolved")}
        ${field("Decision", decision)}
        ${field("Resolved", review.resolved_at || "unknown")}
        ${field("By", review.resolved_by || "unknown")}
        ${field("Target", review.target_file || review.targetFile || "none")}
        ${field("Browser preview", review.browser_preview_id || review.browserPreviewId || "none")}
        ${field("Source trust", review.source_trust || review.sourceTrust || "unknown")}
        ${field("Sources", sourceText)}
        ${field("Revision", review.revision_reason || "none")}
        ${field("Undo path", review.undo_path || "No undo path recorded.")}
      </dl>
      <div class="review-resolution-outcome">
        <p class="resolution-title">Resolution outcome</p>
        <p>${escapeHtml(reason)}</p>
        <p class="resolution-boundary">
          Queue-level outcome only. Downstream state, wiki, memory, source, browser, finance, contacts, raw-source, and external actions still require a separate approval.
        </p>
      </div>
    </article>
  `;
}

export function renderApprovalQueueRail(reviews) {
  const { pending: pendingReviews, resolved: resolvedReviews } = normalizeReviewQueue(reviews);
  const approvalFlow = approvalFlowModel({ pending: pendingReviews, resolved: resolvedReviews });

  if (pendingReviews.length === 0 && resolvedReviews.length === 0) {
    return `
      <section class="inspector-section approval-queue-rail" data-approval-count="0" data-resolution-count="0">
        <p class="section-kicker">Review queue</p>
        ${renderApprovalFlowPanel(approvalFlow)}
        <p class="empty-note">No pending reviews or resolved review outcomes visible.</p>
      </section>
    `;
  }

  return `
    <section class="inspector-section approval-queue-rail" data-approval-count="${escapeHtml(
      pendingReviews.length,
    )}" data-resolution-count="${escapeHtml(resolvedReviews.length)}">
      <p class="section-kicker">Review queue</p>
      ${renderApprovalFlowPanel(approvalFlow)}
      <details class="approval-packets-detail">
        <summary>
          <span>Packets</span>
          <small>${escapeHtml(pendingReviews.length + resolvedReviews.length)}</small>
        </summary>
        ${
          pendingReviews.length === 0
            ? '<p class="empty-note">No pending reviews visible.</p>'
            : `<div class="approval-queue-list">${pendingReviews.map(renderApprovalCard).join("")}</div>`
        }
        ${
          resolvedReviews.length === 0
            ? ""
            : `
              <details class="approval-history-drawer">
                <summary>
                  <span class="approval-outcome-title">Resolved outcomes</span>
                  <small>${resolvedReviews.length} archived decision${resolvedReviews.length === 1 ? "" : "s"}</small>
                </summary>
                <div class="approval-history-list approval-queue-list">${resolvedReviews.map(renderResolutionOutcome).join("")}</div>
              </details>
            `
        }
      </details>
    </section>
  `;
}
