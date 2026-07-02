// `atlas approve <review-id>` (#19): resolve a pending review packet through the
// same validator (applyReviewResolution), write reviews/queue.json, and — on
// approval — trigger a graph rebuild so the decision is reflected in the map.
//
// Fail-closed: the resolution is validated BEFORE the queue is written. A
// malformed resolution (unknown id, non-pending item, mismatched fields) throws
// a clear error and touches nothing.
import path from "node:path";
import { spawn } from "node:child_process";
import { applyReviewResolution } from "../../scripts/lib/review-packet.mjs";
import { isoDate, isoStamp, readJson, writeJsonAtomic, appendOperationLog } from "./io.js";

const REVIEW_QUEUE_RELATIVE = "reviews/queue.json";

const RESULT_BY_DECISION = {
  approve: "approved",
  reject: "rejected",
  revise: "revision-requested",
};

function defaultRebuild({ repoRoot }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build-relationship-graph.mjs"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`graph:build exited with code ${code}`))));
  });
}

export async function runResolve(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const now = options.now ? new Date(options.now) : new Date();
  const reviewId = String(options.reviewId || "").trim();
  if (!reviewId) throw new Error("approve requires a review id");
  const decision = String(options.decision || "approve");
  const queuePath = options.queuePath || path.join(repoRoot, REVIEW_QUEUE_RELATIVE);
  const logPath = options.logPath || path.join(repoRoot, "logs", "operations.jsonl");
  const rebuild = options.rebuild || defaultRebuild;
  const shouldRebuild = options.rebuildOnApprove !== false && decision === "approve";

  const queue = readJson(queuePath);
  const item = queue.reviews.find((review) => review?.id === reviewId);
  if (!item) throw new Error(`Unknown review_id: ${reviewId}`);

  const resolution = {
    review_id: reviewId,
    decision,
    target_file: REVIEW_QUEUE_RELATIVE,
    risk: item.risk,
    source_ids: item.source_ids,
    actor: options.actor || "operator",
    reason: options.reason || `${decision} via operator approve`,
    undo_path: item.undo_path || options.undoPath || "Revert reviews/queue.json.",
  };

  // Validates (throws on malformed) and returns the next queue — computed
  // before any write.
  const nextQueue = applyReviewResolution(queue, resolution, { resolvedAt: isoDate(now) });
  writeJsonAtomic(queuePath, nextQueue);

  let rebuilt = false;
  let rebuildError = null;
  if (shouldRebuild) {
    try {
      await rebuild({ repoRoot });
      rebuilt = true;
    } catch (error) {
      rebuildError = error.message;
    }
  }

  appendOperationLog(logPath, {
    ts: isoStamp(now),
    run_id: `RUN-${isoDate(now)}-RESOLVE-001`,
    workflow: "review-queue",
    operation: "resolve_review",
    actor: resolution.actor,
    permission_mode: "draft-for-approval",
    review_id: reviewId,
    decision,
    targets: [REVIEW_QUEUE_RELATIVE],
    rebuilt,
    result: RESULT_BY_DECISION[decision] || decision,
  });

  const resolvedItem = nextQueue.reviews.find((review) => review?.id === reviewId);
  return { reviewId, decision, queuePath, rebuilt, rebuildError, item: resolvedItem };
}
