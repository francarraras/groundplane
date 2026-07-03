import path from "node:path";

const REQUIRED_APPROVAL_FIELDS = ["preview_id", "target_file", "risk", "source_ids", "undo_path", "reason"];
const REQUIRED_RESOLUTION_FIELDS = ["review_id", "decision", "target_file", "risk", "source_ids", "actor", "reason", "undo_path"];
const VALID_RISKS = new Set(["low", "medium", "high"]);
const VALID_REVIEW_DECISIONS = new Set(["approve", "revise", "reject"]);
const REVIEW_QUEUE_PATH = "reviews/queue.json";
const FORBIDDEN_RESOLUTION_SIDE_EFFECT_FIELDS = [
  "browser_writes",
  "contacts_actions",
  "external_actions",
  "finance_actions",
  "memory_writes",
  "promoted_files",
  "raw_source_rewrites",
  "source_writes",
  "state_writes",
  "wiki_writes",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueInOrder(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSafeRepoRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) return false;
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return false;

  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (normalized === "." || normalized === "..") return false;
  return !normalized.split("/").includes("..");
}

function assertReviewQueueTarget(targetFile, fieldName) {
  if (targetFile !== REVIEW_QUEUE_PATH || !isSafeRepoRelativePath(targetFile)) {
    fail(`${fieldName} must be ${REVIEW_QUEUE_PATH}`);
  }
}

function sourceCatalogIds(sourceCatalog = {}) {
  return new Set(asArray(sourceCatalog.sources).map((source) => source?.id).filter(Boolean));
}

function normalizedSourceIds(value, fieldName) {
  if (!Array.isArray(value)) fail(`${fieldName} must be a non-empty array`);
  const unique = uniqueInOrder(value);
  if (unique.length === 0) fail(`${fieldName} must include at least one source id`);
  if (unique.length !== value.length) fail(`${fieldName} must contain unique string source ids`);
  return unique;
}

function assertSourceIdsKnown(sourceIds, sourceCatalog) {
  const catalogIds = sourceCatalogIds(sourceCatalog);
  for (const sourceId of sourceIds) {
    if (!catalogIds.has(sourceId)) fail(`Unknown source_id: ${sourceId}`);
  }
}

function sameSourceSet(first, second) {
  if (first.length !== second.length) return false;
  const secondSet = new Set(second);
  return first.every((sourceId) => secondSet.has(sourceId));
}

function slugToken(value) {
  return (
    String(value || "review")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "REVIEW"
  );
}

export function validateReviewPacketPreview(preview, sourceCatalog = {}) {
  if (!isPlainObject(preview)) fail("preview must be one review_packet_preview object");
  if (preview.type !== "review_packet_preview") fail('preview.type must be "review_packet_preview"');
  if (preview.status !== "draft-preview") fail('preview.status must be "draft-preview"');
  if (preview.action_type !== "draft_review_item") fail('preview.action_type must be "draft_review_item"');
  if (preview.approval_mode !== "draft-for-approval") fail('preview.approval_mode must be "draft-for-approval"');
  if (preview.browser_writes !== false) fail("preview.browser_writes must be false");
  if (preview.requires_explicit_approval !== true) fail("preview.requires_explicit_approval must be true");
  if (!VALID_RISKS.has(preview.risk)) fail("preview.risk must be low, medium, or high");
  assertReviewQueueTarget(preview.target_file, "preview.target_file");

  const sourceIds = normalizedSourceIds(preview.source_ids, "preview.source_ids");
  assertSourceIdsKnown(sourceIds, sourceCatalog);
  return { ...preview, source_ids: sourceIds };
}

export function validateHandoffApproval(approval, preview) {
  if (!isPlainObject(approval)) fail("approval must be one object");
  for (const field of REQUIRED_APPROVAL_FIELDS) {
    if (approval[field] === undefined || approval[field] === null || approval[field] === "") {
      fail(`approval.${field} is required`);
    }
  }

  assertReviewQueueTarget(approval.target_file, "approval.target_file");
  if (approval.preview_id !== preview.id) fail("approval.preview_id must match preview.id");
  if (approval.target_file !== preview.target_file) fail("approval.target_file must match preview.target_file");
  if (approval.risk !== preview.risk) fail("approval.risk must match preview.risk");
  const approvalSourceIds = normalizedSourceIds(approval.source_ids, "approval.source_ids");
  if (!sameSourceSet(approvalSourceIds, preview.source_ids)) {
    fail("approval.source_ids must match preview.source_ids");
  }
  if (preview.undo_path && approval.undo_path !== preview.undo_path) {
    fail("approval.undo_path must match preview.undo_path");
  }
  return { ...approval, source_ids: approvalSourceIds };
}

export function validateReviewQueue(queue) {
  if (!isPlainObject(queue)) fail("reviews/queue.json must contain an object");
  if (!Array.isArray(queue.reviews)) fail("reviews/queue.json must contain a reviews array");
  return queue;
}

export function reviewIdForPreview(preview) {
  return `REV-${slugToken(preview.id)}`;
}

export function previewAlreadyQueued(queue, preview) {
  const durableId = reviewIdForPreview(preview);
  return queue.reviews.some((item) =>
    item?.browser_preview_id === preview.id ||
    item?.id === durableId ||
    item?.id === preview.id
  );
}

export function reviewItemFromPreview(preview, approval, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString().slice(0, 10);
  return {
    id: reviewIdForPreview(preview),
    type: "review-packet",
    status: "pending",
    risk: preview.risk,
    proposed_by: "operator",
    action_type: preview.action_type,
    target_file: preview.target_file,
    summary: preview.summary || `Review packet for ${preview.id}`,
    source_ids: preview.source_ids,
    source_refs: asArray(preview.source_refs),
    source_trust: preview.source_trust || "unknown",
    sensitivity: preview.sensitivity || "normal",
    requires_explicit_approval: true,
    diff_summary: preview.diff_summary || "Review the approved browser preview.",
    approval_mode: "draft-for-approval",
    created_at: createdAt,
    browser_preview_id: preview.id,
    approval_reason: approval.reason,
    undo_path: approval.undo_path,
  };
}

export function appendReviewItemForPreview(queue, preview, approval, options = {}) {
  validateReviewQueue(queue);
  if (previewAlreadyQueued(queue, preview)) {
    fail(`Preview ${preview.id} is already queued`);
  }
  return {
    ...queue,
    reviews: [
      ...queue.reviews,
      reviewItemFromPreview(preview, approval, options),
    ],
  };
}

export function validateReviewResolution(resolution, queue) {
  if (!isPlainObject(resolution)) fail("resolution must be one object");
  validateReviewQueue(queue);

  for (const field of REQUIRED_RESOLUTION_FIELDS) {
    if (resolution[field] === undefined || resolution[field] === null || resolution[field] === "") {
      fail(`resolution.${field} is required`);
    }
  }

  for (const field of FORBIDDEN_RESOLUTION_SIDE_EFFECT_FIELDS) {
    if (resolution[field] !== undefined) {
      fail(`resolution.${field} is not allowed in review queue resolution packets`);
    }
  }

  if (!VALID_REVIEW_DECISIONS.has(resolution.decision)) {
    fail("resolution.decision must be approve, revise, or reject");
  }
  assertReviewQueueTarget(resolution.target_file, "resolution.target_file");

  const item = queue.reviews.find((review) => review?.id === resolution.review_id);
  if (!item) fail(`Unknown review_id: ${resolution.review_id}`);
  for (const field of FORBIDDEN_RESOLUTION_SIDE_EFFECT_FIELDS) {
    if (item[field] !== undefined) {
      fail(`review.${field} is not allowed in review queue resolution items`);
    }
  }
  if (item.status !== "pending") fail(`Review ${resolution.review_id} must be pending before resolution`);
  if (item.target_file !== resolution.target_file) fail("resolution.target_file must match review.target_file");
  if (item.risk !== resolution.risk) fail("resolution.risk must match review.risk");
  if (item.undo_path && resolution.undo_path !== item.undo_path) {
    fail("resolution.undo_path must match review.undo_path");
  }

  const resolutionSourceIds = normalizedSourceIds(resolution.source_ids, "resolution.source_ids");
  const reviewSourceIds = normalizedSourceIds(item.source_ids, "review.source_ids");
  if (!sameSourceSet(resolutionSourceIds, reviewSourceIds)) {
    fail("resolution.source_ids must match review.source_ids");
  }

  return {
    ...resolution,
    source_ids: resolutionSourceIds,
  };
}

export function applyReviewResolution(queue, resolution, options = {}) {
  const validated = validateReviewResolution(resolution, queue);
  const resolvedAt = options.resolvedAt || new Date().toISOString().slice(0, 10);
  const nextStatusByDecision = {
    approve: "approved",
    reject: "rejected",
    revise: "pending",
  };
  const resolutionStatusByDecision = {
    approve: "approved",
    reject: "rejected",
    revise: "revision-requested",
  };

  return {
    ...queue,
    reviews: queue.reviews.map((item) => {
      if (item?.id !== validated.review_id) return item;

      return {
        ...item,
        status: nextStatusByDecision[validated.decision],
        resolution_status: resolutionStatusByDecision[validated.decision],
        resolution_decision: validated.decision,
        resolution_reason: validated.reason,
        resolution_source_ids: validated.source_ids,
        resolved_by: validated.actor,
        resolved_at: resolvedAt,
      };
    }),
  };
}

export { REVIEW_QUEUE_PATH };
