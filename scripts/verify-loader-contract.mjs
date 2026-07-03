// Fixture-based loader contract verifier (#34).
//
// Exercises the app's own loader through its dependency-injection seam
// (loadProductState(fetchImpl)) against the demo fixtures — no personal data,
// no snapshot literals. Structural counts are DERIVED from the fixture files,
// so the suite runs green from a bare clone and stays honest as the demo grows.
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadProductState } from "../app/src/state.js";
import { buildSurfaceModel } from "../app/src/viewModel.js";
import { renderMapLegend, NODE_TYPE_REGISTRY } from "../app/src/mapLegend.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A fetch-like impl that serves repo files for the app's "../<dir>/<file>" URLs.
function fixtureFetch({ missing = new Set(), throwOn = new Set() } = {}) {
  return async (requestUrl) => {
    const clean = String(requestUrl)
      .split("?")[0]
      .replace(/^\.\.\//, "");
    if (throwOn.has(clean)) throw new Error(`network error for ${clean}`);
    if (missing.has(clean)) return { ok: false, status: 404, json: async () => ({}) };
    const absolute = path.join(REPO_ROOT, clean);
    const data = JSON.parse(readFileSync(absolute, "utf8"));
    return { ok: true, status: 200, json: async () => data };
  };
}

// 1) Happy path: every declared file loads into the expected shape.
const state = await loadProductState(fixtureFetch(), { cacheBust: false });
for (const key of [
  "board",
  "projects",
  "tasks",
  "proofArtifacts",
  "routines",
  "decisions",
  "reviews",
  "memoryClaims",
  "sources",
  "permissions",
  "relationshipGraph",
  "layout",
]) {
  assert.ok(state[key] !== undefined, `loaded state includes ${key}`);
}

// 2) The surface model's counts are derived from — and consistent with — the
//    fixture content (no magic-number snapshots).
const model = buildSurfaceModel(state);

const expectedActiveTasks = state.tasks.tasks.filter((task) => task.status === "active").length;
assert.equal(model.activeTasks.length, expectedActiveTasks, "active task count matches fixtures");

const expectedPending = state.reviews.reviews.filter((review) => review.status === "pending").length;
assert.equal(model.pendingReviews.length, expectedPending, "pending review count matches fixtures");

assert.ok(model.districts.length > 0, "fixtures derive at least one area/district");
assert.equal(model.regions.length, model.districts.length, "home regions are the derived districts");

// Every district references only nodes that exist in the relationship graph.
const graphNodeIds = new Set(state.relationshipGraph.nodes.map((node) => node.id));
for (const district of model.districts) {
  for (const nodeId of district.nodeIds) {
    assert.ok(graphNodeIds.has(nodeId), `district ${district.id} references a real graph node (${nodeId})`);
  }
}

// Every cited source id in the model resolves to the registered catalog.
const catalogIds = new Set(state.sources.sources.map((source) => source.id));
for (const region of model.allRegions) {
  for (const sourceId of region.sourceIds || []) {
    assert.ok(catalogIds.has(sourceId), `region ${region.id} cites a registered source (${sourceId})`);
  }
}

// 3) Graceful degradation (#11): a missing/corrupt required file never blanks
//    the app — it falls back to an empty default and records a specific warning,
//    and the model still builds.
assert.deepEqual(state.loaderWarnings, [], "a clean load has no loader warnings");

const degradedRequired = await loadProductState(fixtureFetch({ missing: new Set(["state/projects.json"]) }), {
  cacheBust: false,
});
assert.ok(
  degradedRequired.loaderWarnings.some((warning) => warning.key === "projects" && warning.file === "state/projects.json"),
  "a missing required file produces a specific, repo-relative loader warning",
);
assert.doesNotThrow(() => buildSurfaceModel(degradedRequired), "the model still builds when a required file is missing");

const degraded = await loadProductState(
  fixtureFetch({ throwOn: new Set(["indexes/relationship-graph.json", "state/layout.json"]) }),
  { cacheBust: false },
);
assert.equal(degraded.relationshipGraph.unavailable, true, "missing graph degrades to an unavailable stub");
assert.ok(degraded.relationshipGraph.warnings.length > 0, "degraded graph carries a warning");
assert.deepEqual(degraded.layout.pins, {}, "missing layout degrades to an empty pin overlay");

// The app still builds a model when the graph is unavailable (no crash).
assert.doesNotThrow(() => buildSurfaceModel(degraded), "model builds without a relationship graph");

// 4) No absolute filesystem path renders in demo mode (#35) — paths must be
//    repo-relative so screenshots and demos never leak machine/user layout.
const rendered = JSON.stringify(model);
assert.doesNotMatch(rendered, /\/Users\//, "no /Users/ path renders in the model");
assert.doesNotMatch(rendered, /\/home\/[^"/]+\//, "no /home/<user>/ path renders in the model");
assert.doesNotMatch(rendered, /[A-Za-z]:\\\\/, "no Windows absolute path renders in the model");

// 5) Map legend (#13) reflects exactly the node types present in the graph.
const legendRoot = { innerHTML: "" };
renderMapLegend(legendRoot, model);
const presentTypes = new Set([
  ...model.regions.map((region) => region.type),
  ...(model.graph?.nodes || []).map((node) => node.type),
]);
for (const entry of NODE_TYPE_REGISTRY) {
  const shown = legendRoot.innerHTML.includes(`data-legend-type="${entry.type}"`);
  assert.equal(shown, presentTypes.has(entry.type), `legend row for ${entry.type} is shown iff the type is present`);
}
assert.ok(legendRoot.innerHTML.includes("map-legend-panel"), "legend renders a panel when types are present");

console.log(
  `loader contract ok: ${model.districts.length} areas, ${expectedActiveTasks} active tasks, ${expectedPending} pending reviews — all derived from fixtures`,
);
