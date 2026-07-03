import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRelationshipGraph,
  loadGraphInputs,
  writeRelationshipGraph,
} from "./lib/relationship-graph.mjs";
import { assertWorkspaceSchemas } from "./lib/validate-state.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Fail fast on malformed state before compiling the graph (#21).
assertWorkspaceSchemas(root);
const inputs = await loadGraphInputs(root);
const graph = buildRelationshipGraph(inputs);

await writeRelationshipGraph(root, graph);

console.log(
  `relationship graph ok: ${graph.stats.node_count} nodes, ${graph.stats.edge_count} edges, ${graph.stats.warning_count} warnings`,
);
