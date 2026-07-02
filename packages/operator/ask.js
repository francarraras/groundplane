// `atlas ask` (#18): build a bounded context bundle from a graph slice, call one
// provider through the complete() adapter, and write the answer as a run packet
// under runs/ — rendered read-only in-app. Fail-closed: a failed or malformed
// provider call writes NO run packet (only a "failed" line in the operations
// log). The browser is never touched.
import { mkdirSync, writeFileSync, renameSync, appendFileSync, rmSync } from "node:fs";
import path from "node:path";
import { loadWorkspaceState } from "./state.js";
import { buildAskContext, buildMessages } from "./context.js";
import { complete, providerName } from "./provider.js";

function isoDate(now) {
  return (now || new Date()).toISOString().slice(0, 10);
}

function isoStamp(now) {
  return (now || new Date()).toISOString();
}

function runIdFor(now, seq = "001") {
  return `RUN-${isoDate(now)}-ASK-${seq}`;
}

function appendOperationLog(logPath, entry) {
  mkdirSync(path.dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
}

// Atomic write: stage a temp file then rename, so a crash mid-write never
// leaves a partial run packet.
function writeJsonAtomic(targetPath, value) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      rmSync(tempPath, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

export async function runAsk(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const question = String(options.question || "").trim();
  if (!question) throw new Error("ask requires a non-empty question");

  const now = options.now ? new Date(options.now) : new Date();
  const runsDir = options.runsDir || path.join(repoRoot, "runs");
  const logPath = options.logPath || path.join(repoRoot, "logs", "operations.jsonl");
  const provider = providerName(options.provider);
  const runId = options.runId || runIdFor(now, options.seq);

  const state = loadWorkspaceState(repoRoot);
  const context = buildAskContext({ state, region: options.region, now: isoStamp(now) });
  const messages = buildMessages(question, context.serialized.json);
  const sourceIds = context.bundle.sources.map((source) => source.id);

  let completion;
  try {
    completion = await complete(messages, {
      provider,
      model: options.model,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      host: options.host,
      apiKey: options.apiKey,
    });
  } catch (error) {
    // Fail closed: no run packet is written. Record the failed attempt only.
    appendOperationLog(logPath, {
      ts: isoStamp(now),
      run_id: runId,
      workflow: "operator-ask",
      operation: "operator_ask",
      actor: "operator",
      permission_mode: "suggest-only",
      provider,
      region: context.selection.matched || context.selection.unmatched || null,
      source_ids: sourceIds,
      result: "failed",
      error: error.message,
    });
    throw error;
  }

  const runPacket = {
    run_id: runId,
    workflow: "operator-ask",
    status: "answered",
    permission_mode: "suggest-only",
    created_at: isoDate(now),
    generated_at: isoStamp(now),
    question,
    region: context.selection.matched || null,
    scope: context.bundle.scope,
    provider: completion.provider,
    model: completion.model,
    source_ids: sourceIds,
    answer: completion.text,
    context_bundle: {
      schema_version: context.bundle.schema_version,
      node_count: context.bundle.stats.node_count,
      edge_count: context.bundle.stats.edge_count,
      source_count: context.bundle.stats.source_count,
      truncated: context.serialized.truncated,
      warnings: context.bundle.warnings,
    },
    browser_writes: false,
    undo_path: null,
  };

  const runPath = path.join(runsDir, `${runId}.json`);
  writeJsonAtomic(runPath, runPacket);

  appendOperationLog(logPath, {
    ts: isoStamp(now),
    run_id: runId,
    workflow: "operator-ask",
    operation: "operator_ask",
    actor: "operator",
    permission_mode: "suggest-only",
    provider: completion.provider,
    model: completion.model,
    targets: [path.relative(repoRoot, runPath)],
    region: context.selection.matched || null,
    source_ids: sourceIds,
    result: "ok",
  });

  return { runId, runPath, runPacket, answer: completion.text, bundle: context.bundle, selection: context.selection };
}
