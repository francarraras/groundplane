// Load the workspace JSON state from disk into the shape buildSurfaceModel
// expects. Mirrors app/src/state.js DATA_URLS, but for the Node CLI. Optional
// files (relationshipGraph, layout) degrade gracefully.
import { readFileSync } from "node:fs";
import path from "node:path";

const FILES = {
  board: "state/board.json",
  projects: "state/projects.json",
  tasks: "state/tasks.json",
  proofArtifacts: "state/proof-artifacts.json",
  routines: "state/routines.json",
  decisions: "state/decisions.json",
  reviews: "reviews/queue.json",
  memoryClaims: "wiki/memory-claims.json",
  sources: "sources/catalog.json",
  permissions: "state/permissions.json",
  relationshipGraph: "indexes/relationship-graph.json",
  layout: "state/layout.json",
};

const OPTIONAL = new Set(["relationshipGraph", "layout"]);

function readJson(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

export function loadWorkspaceState(repoRoot) {
  const state = {};
  for (const [key, relative] of Object.entries(FILES)) {
    const absolute = path.join(repoRoot, relative);
    try {
      state[key] = readJson(absolute);
    } catch (error) {
      if (!OPTIONAL.has(key)) {
        throw new Error(`Failed to load ${relative}: ${error.message}`);
      }
      state[key] = null;
    }
  }
  return state;
}
