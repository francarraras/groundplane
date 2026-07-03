// Graph compiler determinism, enforced not asserted (#23).
//
// Determinism is a headline claim of the compiler. This locks it down two ways:
//   1. Compiling the demo fixtures twice yields byte-identical output.
//   2. That output matches the committed golden index (indexes/relationship-
//      graph.json). Any nondeterminism — or unreviewed graph drift — fails CI.
//
// To regenerate the golden after an intentional change: `npm run graph:build`.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGraphInputs, buildRelationshipGraph } from "./lib/relationship-graph.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serialize = (graph) => `${JSON.stringify(graph, null, 2)}\n`;

// Fresh inputs each build so a build can never leak state into the next.
const first = serialize(buildRelationshipGraph(await loadGraphInputs(REPO_ROOT)));
const second = serialize(buildRelationshipGraph(await loadGraphInputs(REPO_ROOT)));
assert.equal(first, second, "two builds from identical inputs must be byte-identical");

const golden = readFileSync(path.join(REPO_ROOT, "indexes/relationship-graph.json"), "utf8");
assert.equal(
  first,
  golden,
  "the committed graph index (golden) does not match a fresh build — run `npm run graph:build` to regenerate after intentional changes",
);

console.log("graph determinism ok: double-build byte-identical and matches the committed golden index");
