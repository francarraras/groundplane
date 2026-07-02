// `atlas propose` (#19): an agent-drafted change is emitted as a review packet
// through the SAME validator the browser preview uses
// (scripts/lib/review-packet.mjs) and appended to reviews/queue.json as a
// pending item — so it shows up in-app with the pending-approval halo (#15) and
// must clear the same gate as everyone else.
//
// Fail-closed: the packet is fully validated BEFORE any file is written. A
// malformed packet throws a clear error and touches nothing.
import path from "node:path";
import {
  validateReviewPacketPreview,
  validateHandoffApproval,
  appendReviewItemForPreview,
  reviewIdForPreview,
} from "../../scripts/lib/review-packet.mjs";
import { loadWorkspaceState } from "./state.js";
import { isoDate, isoStamp, readJson, writeJsonAtomic, appendOperationLog } from "./io.js";

const REVIEW_QUEUE_RELATIVE = "reviews/queue.json";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value) {
  return String(value || "change")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "change";
}

export function runPropose(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const now = options.now ? new Date(options.now) : new Date();
  const summary = String(options.summary || "").trim();
  if (!summary) throw new Error("propose requires a --summary describing the change");

  const risk = String(options.risk || "medium");
  const sourceIds = asArray(options.sourceIds);
  const queuePath = options.queuePath || path.join(repoRoot, REVIEW_QUEUE_RELATIVE);
  const logPath = options.logPath || path.join(repoRoot, "logs", "operations.jsonl");
  const catalog = options.catalog || loadWorkspaceState(repoRoot).sources;
  const previewId = options.previewId || `preview:propose:${isoDate(now)}:${slug(summary)}:${Date.now().toString(36)}`;

  // 1) Draft the review-packet preview and validate it (throws if malformed).
  const preview = {
    type: "review_packet_preview",
    id: previewId,
    status: "draft-preview",
    action_type: "draft_review_item",
    approval_mode: "draft-for-approval",
    browser_writes: false,
    requires_explicit_approval: true,
    risk,
    target_file: REVIEW_QUEUE_RELATIVE,
    source_ids: sourceIds,
    summary,
    diff_summary: options.diffSummary || "Operator-proposed change; review before applying.",
    source_trust: options.sourceTrust || "operator-verified",
    sensitivity: options.sensitivity || "normal",
  };
  const validatedPreview = validateReviewPacketPreview(preview, catalog);

  // 2) Draft the handoff approval and validate it against the preview.
  const approval = {
    preview_id: validatedPreview.id,
    target_file: REVIEW_QUEUE_RELATIVE,
    risk,
    source_ids: sourceIds,
    undo_path: options.undoPath || "Revert the reviews/queue.json append (git checkout reviews/queue.json).",
    reason: options.reason || "Operator-proposed draft; pending human approval.",
  };
  validateHandoffApproval(approval, validatedPreview);

  // 3) Append the pending item to the queue (throws if already queued). All
  //    validation is done above, so the first write happens only on success.
  const queue = readJson(queuePath);
  const nextQueue = appendReviewItemForPreview(queue, validatedPreview, approval, { createdAt: isoDate(now) });
  writeJsonAtomic(queuePath, nextQueue);

  const reviewId = reviewIdForPreview(validatedPreview);
  const item = nextQueue.reviews.find((review) => review.id === reviewId);

  appendOperationLog(logPath, {
    ts: isoStamp(now),
    run_id: `RUN-${isoDate(now)}-PROPOSE-001`,
    workflow: "operator-propose",
    operation: "prepare_review",
    actor: options.actor || "operator",
    permission_mode: "draft-for-approval",
    review_items: [reviewId],
    targets: [REVIEW_QUEUE_RELATIVE],
    source_ids: sourceIds,
    result: "proposal_only",
  });

  return { reviewId, queuePath, item, preview: validatedPreview };
}
