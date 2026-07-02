export const DATA_URLS = {
  board: "/state/board.json",
  projects: "/state/projects.json",
  tasks: "/state/tasks.json",
  proofArtifacts: "/state/proof-artifacts.json",
  routines: "/state/routines.json",
  decisions: "/state/decisions.json",
  reviews: "/reviews/queue.json",
  memoryClaims: "/wiki/memory-claims.json",
  sources: "/sources/catalog.json",
  permissions: "/state/permissions.json",
  relationshipGraph: "/indexes/relationship-graph.json",
};

export async function fetchJson(fetchImpl, url, { cacheBust = true } = {}) {
  const requestUrl = cacheBust ? `${url}?t=${Date.now()}` : url;
  const response = await fetchImpl(requestUrl);
  if (!response.ok) {
    throw new Error(`State fetch failed for ${url}: ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`State JSON parse failed for ${url}: ${error.message}`);
  }
}

function unavailableRelationshipGraph(error) {
  return {
    schema_version: "relationship-graph.unavailable",
    generated_at: null,
    source_files: [],
    stats: {
      node_count: 0,
      edge_count: 0,
      cluster_count: 0,
      warning_count: 1,
    },
    nodes: [],
    edges: [],
    clusters: [],
    layout: {
      strategy: "unavailable",
      version: 1,
    },
    warnings: [
      {
        type: "graph-unavailable",
        severity: "warning",
        message: error instanceof Error ? error.message : "Relationship graph unavailable.",
      },
    ],
    unavailable: true,
  };
}

export async function loadProductState(fetchImpl = fetch, options = {}) {
  const requiredUrls = Object.entries(DATA_URLS).filter(([key]) => key !== "relationshipGraph");
  const entries = await Promise.all(
    requiredUrls.map(async ([key, url]) => [
      key,
      await fetchJson(fetchImpl, url, options),
    ]),
  );

  let relationshipGraph;
  try {
    relationshipGraph = await fetchJson(fetchImpl, DATA_URLS.relationshipGraph, options);
  } catch (error) {
    relationshipGraph = unavailableRelationshipGraph(error);
  }

  return {
    ...Object.fromEntries(entries),
    relationshipGraph,
  };
}
