// Verifies the operator `propose` → `approve` path (#19).
//
// Acceptance: propose emits a pending review packet through the existing
// validator; approve applies it (files change + log appends) and triggers a
// graph rebuild; a malformed packet is rejected with a clear error and writes
// nothing.
import { mkdtempSync, copyFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runPropose } from "../packages/operator/propose.js";
import { runResolve } from "../packages/operator/approve.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(REPO_ROOT, "sources/catalog.json"), "utf8"));
const sourceIds = catalog.sources.slice(0, 2).map((source) => source.id);
const NOW = "2026-07-02T00:00:00.000Z";

function workspace() {
  const dir = mkdtempSync(path.join(tmpdir(), "operator-propose-"));
  const queuePath = path.join(dir, "reviews", "queue.json");
  mkdirSync(path.dirname(queuePath), { recursive: true });
  copyFileSync(path.join(REPO_ROOT, "reviews/queue.json"), queuePath);
  return { dir, queuePath, logPath: path.join(dir, "logs", "operations.jsonl") };
}
const readQueue = (queuePath) => JSON.parse(readFileSync(queuePath, "utf8"));

// 1) propose → a pending review item that clears the validator.
{
  const ws = workspace();
  const result = runPropose({
    repoRoot: REPO_ROOT,
    summary: "Tighten the launch checklist wording",
    risk: "medium",
    sourceIds,
    catalog,
    now: NOW,
    queuePath: ws.queuePath,
    logPath: ws.logPath,
    previewId: "preview:propose:test:launch-checklist",
  });

  const queue = readQueue(ws.queuePath);
  const item = queue.reviews.find((review) => review.id === result.reviewId);
  assert.ok(item, "pending review item is appended");
  assert.equal(item.status, "pending", "item is pending (halo-visible in-app)");
  assert.equal(item.target_file, "reviews/queue.json", "target is the review queue");
  assert.equal(item.proposed_by, "operator", "proposed_by operator");
  assert.equal(item.risk, "medium", "risk preserved");
  assert.deepEqual(item.source_ids, sourceIds, "source ids preserved");
  assert.equal(item.requires_explicit_approval, true, "requires explicit approval");

  const log = readFileSync(ws.logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(log[0].result, "proposal_only", "propose logs proposal_only");
  assert.deepEqual(log[0].review_items, [result.reviewId], "log references the review id");

  // 2) approve → item flips to approved, rebuild hook fires, log appends.
  let rebuildCalls = 0;
  const resolved = await runResolve({
    repoRoot: REPO_ROOT,
    reviewId: result.reviewId,
    decision: "approve",
    actor: "Fran",
    reason: "Wording is correct and sources check out.",
    now: NOW,
    queuePath: ws.queuePath,
    logPath: ws.logPath,
    rebuild: async () => {
      rebuildCalls += 1;
    },
  });
  assert.equal(rebuildCalls, 1, "approve triggers a graph rebuild");
  assert.equal(resolved.rebuilt, true, "rebuild reported");

  const afterQueue = readQueue(ws.queuePath);
  const afterItem = afterQueue.reviews.find((review) => review.id === result.reviewId);
  assert.equal(afterItem.status, "approved", "item is approved (file changed)");
  assert.equal(afterItem.resolution_decision, "approve", "resolution recorded");
  assert.equal(afterItem.resolved_by, "Fran", "actor recorded");

  const log2 = readFileSync(ws.logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(log2.length, 2, "approve appends a log line");
  assert.equal(log2[1].operation, "resolve_review", "resolve logged");
  assert.equal(log2[1].result, "approved", "approved result logged");
  assert.equal(log2[1].rebuilt, true, "rebuild recorded in log");

  rmSync(ws.dir, { recursive: true, force: true });
}

// 3) Malformed packets are rejected with a clear error and write nothing.
function assertNoWrite(label, before, ws) {
  const after = readFileSync(ws.queuePath, "utf8");
  assert.equal(after, before, `${label}: queue file is unchanged`);
  assert.ok(!existsSync(ws.logPath), `${label}: no log written`);
}

{
  // (a) unknown source id
  const ws = workspace();
  const before = readFileSync(ws.queuePath, "utf8");
  assert.throws(
    () =>
      runPropose({
        repoRoot: REPO_ROOT,
        summary: "Bad packet, unknown source",
        risk: "low",
        sourceIds: ["SRC-DOES-NOT-EXIST"],
        catalog,
        now: NOW,
        queuePath: ws.queuePath,
        logPath: ws.logPath,
      }),
    /Unknown source_id/,
    "unknown source is rejected with a clear error",
  );
  assertNoWrite("unknown-source", before, ws);
  rmSync(ws.dir, { recursive: true, force: true });
}

{
  // (b) invalid risk
  const ws = workspace();
  const before = readFileSync(ws.queuePath, "utf8");
  assert.throws(
    () =>
      runPropose({
        repoRoot: REPO_ROOT,
        summary: "Bad packet, bad risk",
        risk: "catastrophic",
        sourceIds,
        catalog,
        now: NOW,
        queuePath: ws.queuePath,
        logPath: ws.logPath,
      }),
    /risk must be low, medium, or high/,
    "invalid risk is rejected",
  );
  assertNoWrite("bad-risk", before, ws);
  rmSync(ws.dir, { recursive: true, force: true });
}

{
  // (c) approve an unknown review id
  const ws = workspace();
  const before = readFileSync(ws.queuePath, "utf8");
  await assert.rejects(
    runResolve({
      repoRoot: REPO_ROOT,
      reviewId: "REV-NOPE",
      decision: "approve",
      actor: "Fran",
      now: NOW,
      queuePath: ws.queuePath,
      logPath: ws.logPath,
      rebuild: async () => {},
    }),
    /Unknown review_id/,
    "approving an unknown review id is rejected",
  );
  assertNoWrite("unknown-review", before, ws);
  rmSync(ws.dir, { recursive: true, force: true });
}

{
  // (d) proposing the same preview twice is rejected (no double-queue)
  const ws = workspace();
  runPropose({
    repoRoot: REPO_ROOT,
    summary: "Duplicate guard",
    risk: "low",
    sourceIds,
    catalog,
    now: NOW,
    queuePath: ws.queuePath,
    logPath: ws.logPath,
    previewId: "preview:propose:test:dupe",
  });
  assert.throws(
    () =>
      runPropose({
        repoRoot: REPO_ROOT,
        summary: "Duplicate guard",
        risk: "low",
        sourceIds,
        catalog,
        now: NOW,
        queuePath: ws.queuePath,
        logPath: ws.logPath,
        previewId: "preview:propose:test:dupe",
      }),
    /already queued/,
    "duplicate preview is rejected",
  );
  rmSync(ws.dir, { recursive: true, force: true });
}

console.log("operator propose ok: propose→pending→approve applies + rebuilds; malformed packets rejected with no write");
