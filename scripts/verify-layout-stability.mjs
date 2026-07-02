// Verifies insertion-stable layout (#17).
//
// Acceptance: adding one node moves no existing node, and two identical builds
// render identical positions. Positions and palette slots derive from a node's
// id (stableKey), never its array index.
import assert from "node:assert/strict";
import { buildWorldNodes } from "../app/src/world.js";
import { graphRegion, districtRegion } from "../app/src/viewModel/districts.js";
import { hash32, unitFraction, paletteIndex } from "../app/src/stableKey.js";

// --- stableKey primitives are deterministic and in range --------------------
assert.equal(hash32("task:TASK-001"), hash32("task:TASK-001"), "hash is deterministic");
assert.notEqual(hash32("a"), hash32("b"), "distinct ids hash differently");
for (const id of ["x", "district:launch-ops", "project:PROJ-001"]) {
  const fraction = unitFraction(id);
  assert.ok(fraction >= 0 && fraction < 1, `unitFraction(${id}) in [0,1)`);
  const slot = paletteIndex(id, 7);
  assert.ok(Number.isInteger(slot) && slot >= 0 && slot < 7, `paletteIndex(${id}) in range`);
}

// --- world positions: identical builds are byte-identical --------------------
const regions = [
  { id: "task:TASK-002", orbit: 0.8, weight: 0.5 },
  { id: "task:TASK-050", orbit: 1.1, weight: 0.6 },
  { id: "review:REV-1", orbit: 1.3, weight: 0.4 },
  { id: "project:PROJ-001", orbit: 1.5, weight: 0.9 },
];
const buildA = buildWorldNodes({ regions });
const buildB = buildWorldNodes({ regions });
for (const node of buildA) {
  const twin = buildB.find((candidate) => candidate.id === node.id);
  assert.equal(twin.position.x, node.position.x, `${node.id} x is deterministic`);
  assert.equal(twin.position.z, node.position.z, `${node.id} z is deterministic`);
}

// --- world positions: array order does not matter ---------------------------
const reversed = buildWorldNodes({ regions: [...regions].reverse() });
for (const node of buildA) {
  const twin = reversed.find((candidate) => candidate.id === node.id);
  assert.equal(twin.position.x, node.position.x, `${node.id} x is order-independent`);
  assert.equal(twin.position.z, node.position.z, `${node.id} z is order-independent`);
}

// --- world positions: inserting a node moves NO existing node ----------------
const withInsertion = buildWorldNodes({
  regions: [{ id: "task:TASK-999-new", orbit: 1.0, weight: 0.5 }, ...regions], // insert at the front
});
for (const node of buildA) {
  const twin = withInsertion.find((candidate) => candidate.id === node.id);
  assert.ok(twin, `${node.id} still present after insertion`);
  assert.equal(twin.position.x, node.position.x, `${node.id} x unchanged after insertion`);
  assert.equal(twin.position.z, node.position.z, `${node.id} z unchanged after insertion`);
}
assert.ok(withInsertion.some((node) => node.id === "task:TASK-999-new"), "the new node was placed");

// --- palette (color + orbit) is index-independent ---------------------------
const node = { id: "task:TASK-777", type: "task", title: "Test", weights: { importance: 0.5, friction: 0.2 }, visual: {} };
assert.equal(graphRegion(node, 0).color, graphRegion(node, 99).color, "graph color independent of index");
assert.equal(graphRegion(node, 0).orbit, graphRegion(node, 99).orbit, "graph orbit independent of index");

const district = {
  id: "district:test",
  title: "Test district",
  nodeIds: ["task:TASK-777"],
  weights: { importance: 0.5, activity: 0.7, friction: 0.2 },
  visual: { color: "#123456" },
  summary: "A test district.",
  permissionModes: [],
  approvalStatus: "approved",
  sourceIds: [],
};
assert.equal(districtRegion(district, 0).orbit, districtRegion(district, 99).orbit, "district orbit independent of index");

console.log("layout stability ok: insertion moves no node; positions + palette are id-stable and deterministic");
