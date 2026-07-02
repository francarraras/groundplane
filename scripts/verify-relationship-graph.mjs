import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRelationshipGraph,
  loadGraphInputs,
} from "./lib/relationship-graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootWithSep = `${root}${path.sep}`;
const inputs = await loadGraphInputs(root);
const graph = buildRelationshipGraph(inputs, { now: "2026-06-14T00:00:00.000Z" });
const sourceIds = new Set((inputs["sources/catalog.json"]?.sources || []).map((source) => source.id));

function cloneInputsWith(patch) {
  return {
    ...structuredClone(inputs),
    ...patch,
  };
}

async function assertSafeExistingRelativePath(relativePath) {
  assert.equal(typeof relativePath, "string");
  assert.ok(relativePath.length > 0);
  assert.equal(path.isAbsolute(relativePath), false, `${relativePath} must be relative`);
  assert.ok(!path.normalize(relativePath).split(path.sep).includes(".."), `${relativePath} must not traverse upward`);

  const resolvedPath = path.resolve(root, relativePath);
  assert.ok(resolvedPath === root || resolvedPath.startsWith(rootWithSep), `${relativePath} must resolve inside repo root`);
  await access(resolvedPath);
}

function isProtectedSensitivity(sensitivity) {
  const normalized = String(sensitivity || "normal").toLowerCase();
  return normalized === "sensitive" || normalized === "high" || normalized === "private" || normalized.includes("high");
}

assert.equal(graph.schema_version, "relationship-graph.v1");
assert.equal(graph.layout.strategy, "cluster-first-deterministic");
assert.equal(graph.layout.version, 1);
assert.ok(graph.nodes.some((node) => node.id === "project:PROJ-001"));
assert.ok(graph.nodes.some((node) => node.id === "task:TASK-018"));
assert.ok(graph.nodes.some((node) => (
  node.id === "proof_artifact:PROOF-FLAGSHIP-001"
  && node.type === "proof_artifact"
  && node.source_ref.file === "state/proof-artifacts.json"
)));
assert.ok(graph.nodes.some((node) => node.type === "memory_claim"));
assert.ok(graph.edges.some((edge) => edge.from === "task:TASK-018" && edge.type === "belongs_to" && edge.to === "project:PROJ-001"));
assert.ok(graph.edges.some((edge) => (
  edge.from === "proof_artifact:PROOF-FLAGSHIP-001"
  && edge.type === "belongs_to"
  && edge.to === "project:PROJ-001"
)));

for (const sourceFile of graph.source_files) {
  await assertSafeExistingRelativePath(sourceFile);
}

const nodeIds = new Set(graph.nodes.map((node) => node.id));
for (const node of graph.nodes) {
  assert.equal(typeof node.id, "string");
  assert.equal(typeof node.type, "string");
  assert.ok(node.source_ref);
  await assertSafeExistingRelativePath(node.source_ref.file);
  assert.equal(typeof node.source_ref.record_id, "string");
  assert.ok(Array.isArray(node.source_ref.source_ids));
  assert.ok(node.source_ref.source_ids.length > 0, `${node.id} must have source IDs`);
  assert.ok(node.provenance, `${node.id} must have provenance`);
  assert.equal(node.provenance.generator, "relationship-graph");
  assert.equal(node.provenance.generated_from, "local-files");
  assert.equal(node.provenance.file, node.source_ref.file);
  assert.equal(node.provenance.record_id, node.source_ref.record_id);
  assert.deepEqual(node.provenance.source_ids, node.source_ref.source_ids);
  for (const sourceId of node.source_ref.source_ids) {
    assert.ok(sourceIds.has(sourceId), `${node.id} uses unknown source ${sourceId}`);
  }
  if (isProtectedSensitivity(node.sensitivity)) {
    assert.notEqual(node.permission_mode, "automatic-low-risk", `${node.id} is protected and must not be automatic`);
  }
}

for (const edge of graph.edges) {
  assert.ok(nodeIds.has(edge.from), `${edge.id} from must resolve`);
  assert.ok(nodeIds.has(edge.to), `${edge.id} to must resolve`);
  assert.ok(Array.isArray(edge.source_ids));
  assert.ok(edge.source_ids.length > 0, `${edge.id} must have source IDs`);
  assert.equal(typeof edge.evidence, "string");
  assert.ok(edge.evidence.trim().length > 0, `${edge.id} must have evidence`);
  assert.ok(edge.provenance, `${edge.id} must have provenance`);
  assert.equal(edge.provenance.generator, "relationship-graph");
  assert.equal(edge.provenance.generated_from, "local-files");
  assert.deepEqual(edge.provenance.source_ids, edge.source_ids);
  assert.equal(edge.provenance.inferred, edge.inferred);
  for (const sourceId of edge.source_ids) {
    assert.ok(sourceIds.has(sourceId), `${edge.id} uses unknown source ${sourceId}`);
  }
  if (edge.inferred) {
    assert.notEqual(edge.permission_mode, "automatic-low-risk");
  }
  if (isProtectedSensitivity(edge.sensitivity)) {
    assert.notEqual(edge.permission_mode, "automatic-low-risk", `${edge.id} is protected and must not be automatic`);
  }
}

assert.equal(graph.stats.node_count, graph.nodes.length);
assert.equal(graph.stats.edge_count, graph.edges.length);
assert.equal(graph.stats.cluster_count, graph.clusters.length);
assert.equal(graph.stats.warning_count, graph.warnings.length);
assert.equal(graph.stats.warning_count, 0);

const invalidMixedSourceGraph = buildRelationshipGraph(cloneInputsWith({
  "state/tasks.json": {
    tasks: [
      {
        id: "TASK-BAD-SOURCE",
        project_id: "PROJ-001",
        title: "Bad mixed source fixture",
        status: "active",
        priority: "high",
        workstream: "Relationship Graph + Usage Pipeline",
        next_action: "Exercise invalid source warnings.",
        source_ids: ["SRC-2026-06-13-001", "SRC-DOES-NOT-EXIST"],
        blocked_by: [],
      },
    ],
  },
}), { now: "2026-06-14T00:00:00.000Z" });

assert.ok(
  invalidMixedSourceGraph.nodes.some((node) => node.id === "task:TASK-BAD-SOURCE" && node.source_ref.source_ids.includes("SRC-2026-06-13-001")),
);
assert.ok(
  invalidMixedSourceGraph.warnings.some((warning) => (
    warning.type === "missing-source"
    && warning.node_id === "task:TASK-BAD-SOURCE"
    && warning.source_id === "SRC-DOES-NOT-EXIST"
  )),
  "invalid mixed source IDs must produce a warning naming the node and missing source ID",
);

const unsafeTargetGraph = buildRelationshipGraph(cloneInputsWith({
  "reviews/queue.json": {
    reviews: [
      {
        id: "REV-UNSAFE-TARGET",
        type: "product-review",
        status: "pending",
        target_file: "../../outside.md",
        summary: "Unsafe target fixture",
        source_ids: ["SRC-2026-06-13-001"],
        sensitivity: "normal",
        diff_summary: "Exercise unsafe target warning.",
        approval_mode: "draft-for-approval",
        created_at: "2026-06-14",
      },
      {
        id: "REV-ABSOLUTE-TARGET",
        type: "product-review",
        status: "pending",
        target_file: "/tmp/outside.md",
        summary: "Absolute target fixture",
        source_ids: ["SRC-2026-06-13-001"],
        sensitivity: "normal",
        diff_summary: "Exercise absolute target warning.",
        approval_mode: "draft-for-approval",
        created_at: "2026-06-14",
      },
    ],
  },
}), { now: "2026-06-14T00:00:00.000Z" });

assert.ok(
  unsafeTargetGraph.warnings.some((warning) => (
    warning.type === "unsafe-target-file"
    && warning.node_id === "review:REV-UNSAFE-TARGET"
    && warning.target_file === "../../outside.md"
  )),
  "unsafe review target_file values must produce a warning",
);
assert.ok(!unsafeTargetGraph.nodes.some((node) => node.id === "file:../../outside.md"));
assert.ok(!unsafeTargetGraph.edges.some((edge) => edge.to === "file:../../outside.md"));
assert.ok(
  unsafeTargetGraph.warnings.some((warning) => (
    warning.type === "unsafe-target-file"
    && warning.node_id === "review:REV-ABSOLUTE-TARGET"
    && warning.target_file === "/tmp/outside.md"
  )),
  "absolute review target_file values must produce a warning",
);
assert.ok(!unsafeTargetGraph.nodes.some((node) => node.id === "file:/tmp/outside.md"));
assert.ok(!unsafeTargetGraph.edges.some((edge) => edge.to === "file:/tmp/outside.md"));

console.log("relationship graph model ok");
