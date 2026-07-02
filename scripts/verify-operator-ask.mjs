// Verifies the operator `ask` path (#18) deterministically and offline.
//
// Acceptance: works without a hosted model (mock/offline), answers cite fixture
// sources, and failed calls produce no partial writes.
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runAsk } from "../packages/operator/ask.js";
import { buildAskContext } from "../packages/operator/context.js";
import { loadWorkspaceState } from "../packages/operator/state.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogIds = new Set(loadWorkspaceState(REPO_ROOT).sources.sources.map((source) => source.id));
const NOW = "2026-07-02T00:00:00.000Z";

function tempWorkspace() {
  const dir = mkdtempSync(path.join(tmpdir(), "operator-ask-"));
  return { runsDir: path.join(dir, "runs"), logPath: path.join(dir, "logs", "operations.jsonl"), dir };
}

// Pick a real district id from the demo fixtures to scope the ask.
const baseContext = buildAskContext({ state: loadWorkspaceState(REPO_ROOT), region: null, now: NOW });
const districtId = baseContext.baseModel.districts[0].id;

// 1) Success path (mock provider, offline).
{
  const ws = tempWorkspace();
  const result = await runAsk({
    repoRoot: REPO_ROOT,
    question: "What is the current focus and what evidence backs it?",
    region: districtId,
    provider: "mock",
    now: NOW,
    runsDir: ws.runsDir,
    logPath: ws.logPath,
  });

  assert.ok(existsSync(result.runPath), "run packet file is written");
  const packet = JSON.parse(readFileSync(result.runPath, "utf8"));
  assert.equal(packet.workflow, "operator-ask", "run packet workflow");
  assert.equal(packet.permission_mode, "suggest-only", "ask is read-only / suggest-only");
  assert.equal(packet.browser_writes, false, "no browser writes");
  assert.equal(packet.status, "answered", "run packet status");
  assert.ok(packet.source_ids.length > 0, "answer is grounded in at least one source");
  for (const id of packet.source_ids) {
    assert.ok(catalogIds.has(id), `cited source ${id} is registered in the catalog`);
  }
  // The (mock) answer cites fixture source ids.
  const cited = packet.answer.match(/SRC-[0-9A-Za-z-]+/g) || [];
  assert.ok(cited.length > 0, "answer text cites fixture sources");
  for (const id of cited) assert.ok(catalogIds.has(id), `answer cites registered source ${id}`);

  // Operations log has exactly one ok line.
  const log = readFileSync(ws.logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(log.length, 1, "one operations log line");
  assert.equal(log[0].result, "ok", "log records success");
  assert.equal(log[0].workflow, "operator-ask", "log workflow");

  rmSync(ws.dir, { recursive: true, force: true });
}

// 2) Fail-closed: a failing provider writes NO run packet, only a failed log.
{
  const ws = tempWorkspace();
  await assert.rejects(
    runAsk({
      repoRoot: REPO_ROOT,
      question: "This should fail closed.",
      region: districtId,
      provider: "ollama",
      host: "http://127.0.0.1:9", // unreachable → connection refused, offline
      timeoutMs: 500,
      retries: 0,
      now: NOW,
      runsDir: ws.runsDir,
      logPath: ws.logPath,
    }),
    "failed provider call rejects",
  );

  // No run packet written.
  const runFiles = existsSync(ws.runsDir) ? readdirSync(ws.runsDir) : [];
  assert.equal(runFiles.length, 0, "no partial run packet on failure");

  // A failed line was logged (observability), and it is a complete JSON line.
  const log = readFileSync(ws.logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(log.length, 1, "one failed log line");
  assert.equal(log[0].result, "failed", "log records failure");
  assert.ok(log[0].error, "failure reason recorded");

  rmSync(ws.dir, { recursive: true, force: true });
}

// 3) Determinism: identical inputs (mock, fixed clock) → identical answer + citations.
{
  const wsA = tempWorkspace();
  const wsB = tempWorkspace();
  const a = await runAsk({ repoRoot: REPO_ROOT, question: "Same question.", region: districtId, provider: "mock", now: NOW, runsDir: wsA.runsDir, logPath: wsA.logPath });
  const b = await runAsk({ repoRoot: REPO_ROOT, question: "Same question.", region: districtId, provider: "mock", now: NOW, runsDir: wsB.runsDir, logPath: wsB.logPath });
  assert.equal(a.answer, b.answer, "mock answer is deterministic");
  assert.deepEqual(a.runPacket.source_ids, b.runPacket.source_ids, "cited sources are deterministic");
  rmSync(wsA.dir, { recursive: true, force: true });
  rmSync(wsB.dir, { recursive: true, force: true });
}

console.log("operator ask ok: mock offline answer grounded in registered sources; failures write no run packet");
