// Verifies the context-bundle serializer (issue #16) against the demo fixtures.
//
// Acceptance: a bundle for a fixture cluster is valid JSON, cites only
// registered sources, and stays under the 100 KB default cap.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { buildSurfaceModel } from "../app/src/viewModel.js";
import { buildContextBundle, serializeContextBundle, DEFAULT_BUNDLE_MAX_BYTES } from "../app/src/contextBundle.js";

function readJson(relative) {
  return JSON.parse(readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"));
}

// Mirror app/src/state.js DATA_URLS against the on-disk demo workspace.
const state = {
  board: readJson("state/board.json"),
  projects: readJson("state/projects.json"),
  tasks: readJson("state/tasks.json"),
  proofArtifacts: readJson("state/proof-artifacts.json"),
  routines: readJson("state/routines.json"),
  decisions: readJson("state/decisions.json"),
  reviews: readJson("reviews/queue.json"),
  memoryClaims: readJson("wiki/memory-claims.json"),
  sources: readJson("sources/catalog.json"),
  permissions: readJson("state/permissions.json"),
  relationshipGraph: readJson("indexes/relationship-graph.json"),
  layout: readJson("state/layout.json"),
};

const baseModel = buildSurfaceModel(state);
const model = baseModel; // atlas render model (no district drilled)
const catalog = state.sources.sources;
const registeredIds = new Set(catalog.map((source) => source.id));
const byteLength = (text) => new TextEncoder().encode(text).length;

assert.ok(Array.isArray(baseModel.districts) && baseModel.districts.length > 0, "demo model must have districts");

const NOW = "2026-07-02T00:00:00.000Z";
let bundlesChecked = 0;

function assertValidBundle(label, bundle) {
  const { json, bytes, truncated } = serializeContextBundle(bundle);

  // valid JSON
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(json);
  }, `${label}: bundle must be valid JSON`);

  // schema + provenance present
  assert.equal(parsed.schema_version, "context-bundle.v1", `${label}: schema version`);
  assert.equal(parsed.provenance.app, "groundplane", `${label}: provenance app`);

  // under the default cap
  assert.ok(bytes <= DEFAULT_BUNDLE_MAX_BYTES, `${label}: ${bytes} bytes must be <= ${DEFAULT_BUNDLE_MAX_BYTES}`);
  assert.equal(truncated, false, `${label}: fixture bundle should not need truncation`);

  // cites only registered sources
  for (const source of parsed.sources) {
    assert.ok(registeredIds.has(source.id), `${label}: source ${source.id} must be registered in the catalog`);
  }

  // stats are consistent with payload
  assert.equal(parsed.stats.node_count, parsed.nodes.length, `${label}: node_count matches`);
  assert.equal(parsed.stats.edge_count, parsed.edges.length, `${label}: edge_count matches`);
  assert.equal(parsed.stats.source_count, parsed.sources.length, `${label}: source_count matches`);

  // every edge endpoint is a node in the bundle (bounded, self-contained)
  const nodeIds = new Set(parsed.nodes.map((node) => node.id));
  for (const edge of parsed.edges) {
    assert.ok(nodeIds.has(edge.from) && nodeIds.has(edge.to), `${label}: edge ${edge.id} endpoints are in-bundle`);
  }

  bundlesChecked += 1;
  return parsed;
}

// 1) Every district cluster.
for (const district of baseModel.districts) {
  const bundle = buildContextBundle(
    { baseModel, model, selectedId: district.id, activeDistrictId: district.id, sources: catalog },
    { now: NOW },
  );
  assert.equal(bundle.scope.kind, "district", `district ${district.id}: scope kind`);
  const parsed = assertValidBundle(`district ${district.id}`, bundle);
  assert.ok(parsed.nodes.length > 0, `district ${district.id}: cluster has nodes`);
}

// 2) A single-node scope (node + one-hop neighbours).
const someNodeId = baseModel.allRegions[0]?.id;
assert.ok(someNodeId, "demo model must expose graph nodes");
const nodeBundle = buildContextBundle(
  { baseModel, model, selectedId: someNodeId, activeDistrictId: null, sources: catalog },
  { now: NOW },
);
assert.equal(nodeBundle.scope.kind, "node", "node scope kind");
assertValidBundle(`node ${someNodeId}`, nodeBundle);

// 3) Atlas overview scope.
const atlasBundle = buildContextBundle({ baseModel, model, sources: catalog }, { now: NOW });
assert.equal(atlasBundle.scope.kind, "atlas", "atlas scope kind");
assertValidBundle("atlas", atlasBundle);

// 4) Registered-only enforcement: an unregistered citation is omitted + warned.
const pollutedBase = {
  ...baseModel,
  districts: [{ id: "district:test", title: "Test", nodeIds: ["n:test"], edgeIds: [] }],
  allRegions: [{ id: "n:test", type: "task", title: "Test node", weight: 0.5, sourceIds: ["SRC-UNREGISTERED-999"] }],
  allRelationships: [],
};
const pollutedBundle = buildContextBundle(
  { baseModel: pollutedBase, model, selectedId: "district:test", activeDistrictId: "district:test", sources: catalog },
  { now: NOW },
);
assert.equal(pollutedBundle.sources.length, 0, "unregistered source is not included");
assert.ok(
  pollutedBundle.warnings.some((warning) => warning.includes("SRC-UNREGISTERED-999")),
  "unregistered citation is recorded as a warning",
);

// 5) Cap enforcement: a tiny cap still yields valid JSON at or under the cap.
const largest = baseModel.districts
  .map((district) =>
    buildContextBundle({ baseModel, model, activeDistrictId: district.id, sources: catalog }, { now: NOW }),
  )
  .sort((a, b) => b.stats.node_count - a.stats.node_count)[0];
const capped = serializeContextBundle(largest, { maxBytes: 1500 });
assert.doesNotThrow(() => JSON.parse(capped.json), "capped bundle is still valid JSON");
assert.ok(byteLength(capped.json) <= 1500, `capped bundle ${byteLength(capped.json)} bytes must be <= 1500`);
assert.equal(capped.truncated, true, "capped bundle is flagged truncated");

// 6) Determinism: identical inputs produce identical output.
const a = buildContextBundle(
  { baseModel, model, activeDistrictId: baseModel.districts[0].id, sources: catalog },
  { now: NOW },
);
const b = buildContextBundle(
  { baseModel, model, activeDistrictId: baseModel.districts[0].id, sources: catalog },
  { now: NOW },
);
assert.equal(JSON.stringify(a), JSON.stringify(b), "bundle build is deterministic");

console.log(
  `context bundle ok: ${bundlesChecked} fixture bundles valid, registered-source-only, under ${DEFAULT_BUNDLE_MAX_BYTES} bytes`,
);
