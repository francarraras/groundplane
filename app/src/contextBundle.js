// Context bundle serializer (issue #16).
//
// Turns the current map selection — a drilled-in district (cluster), a single
// selected node plus its one-hop neighbours, or the atlas overview — into a
// bounded, self-describing JSON bundle: nodes + edges + the registered sources
// they cite. The bundle is meant to be downloaded and pasted into any LLM, and
// is the read-side bridge to the Phase-4 operator CLI `ask`.
//
// Invariants:
//   - Pure. No DOM, no storage, no network. The browser never writes.
//   - Cites ONLY sources registered in sources/catalog.json. Unregistered ids
//     are dropped and recorded under `warnings`.
//   - Serialized output is valid JSON and stays under a byte cap (default
//     100 KB); oversized bundles are deterministically trimmed, never corrupted.

export const CONTEXT_BUNDLE_SCHEMA_VERSION = "context-bundle.v1";
export const DEFAULT_BUNDLE_MAX_BYTES = 100000; // <100 KB default cap (#16)

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function buildSourceIndex(sources) {
  const index = new Map();
  for (const source of asArray(sources)) {
    if (source && source.id != null) index.set(source.id, source);
  }
  return index;
}

// Cited source ids from a node/edge: explicit sourceIds plus any resolved
// evidence-trail records the surface model attached.
function citedSourceIds(item) {
  const ids = new Set(asArray(item?.sourceIds));
  asArray(item?.evidenceTrail?.records).forEach((record) => {
    if (record?.sourceId != null) ids.add(record.sourceId);
  });
  return ids;
}

function nodeEntry(region) {
  return {
    id: region?.id ?? null,
    type: region?.type ?? null,
    title: region?.title ?? null,
    subtitle: region?.subtitle ?? null,
    status: region?.status ?? null,
    health: region?.health ?? null,
    weight: finiteOrNull(region?.weight),
    permissionMode: region?.permissionMode ?? null,
    approvalStatus: region?.approvalStatus ?? null,
    summary: region?.nextAction ?? region?.evidenceTrail?.summary ?? null,
    sourceIds: [...citedSourceIds(region)].sort(),
  };
}

function edgeEntry(relationship) {
  return {
    id: relationship?.id ?? null,
    type: relationship?.type ?? null,
    from: relationship?.from ?? null,
    to: relationship?.to ?? null,
    title: relationship?.title ?? null,
    evidence: relationship?.evidence ?? null,
    permissionMode: relationship?.permissionMode ?? null,
    approvalStatus: relationship?.approvalStatus ?? null,
    strength: finiteOrNull(relationship?.strength),
    sourceIds: [...citedSourceIds(relationship)].sort(),
  };
}

// Resolve the export scope from the current selection against the base model.
function resolveScope({ baseModel, model, selectedId = null, activeDistrictId = null } = {}) {
  const districts = asArray(baseModel?.districts);
  const allRegions = asArray(baseModel?.allRegions);
  const allRelationships = asArray(baseModel?.allRelationships);

  const districtId =
    activeDistrictId || (selectedId && districts.some((district) => district.id === selectedId) ? selectedId : null);

  if (districtId) {
    const district = districts.find((candidate) => candidate.id === districtId);
    if (district) {
      const nodeIdSet = new Set(asArray(district.nodeIds));
      const edgeIdSet = new Set(asArray(district.edgeIds));
      const edges = allRelationships.filter((relationship) => edgeIdSet.has(relationship.id));
      // Include boundary neighbours: nodes an in-cluster edge reaches out to,
      // so every edge stays self-contained within the bundle.
      edges.forEach((edge) => {
        if (edge.from) nodeIdSet.add(edge.from);
        if (edge.to) nodeIdSet.add(edge.to);
      });
      return {
        kind: "district",
        id: district.id,
        title: district.title || district.id,
        nodes: allRegions.filter((region) => nodeIdSet.has(region.id)),
        edges,
      };
    }
  }

  if (selectedId) {
    const node = allRegions.find((region) => region.id === selectedId);
    if (node) {
      const edges = allRelationships.filter(
        (relationship) => relationship.from === selectedId || relationship.to === selectedId,
      );
      const neighbourIds = new Set([selectedId]);
      edges.forEach((edge) => {
        if (edge.from) neighbourIds.add(edge.from);
        if (edge.to) neighbourIds.add(edge.to);
      });
      return {
        kind: "node",
        id: node.id,
        title: node.title || node.id,
        nodes: allRegions.filter((region) => neighbourIds.has(region.id)),
        edges,
      };
    }
  }

  // Atlas overview: whatever the current render model is showing.
  return {
    kind: "atlas",
    id: null,
    title: baseModel?.appName || "Atlas",
    nodes: asArray(model?.regions),
    edges: asArray(model?.relationships),
  };
}

export function buildContextBundle(input = {}, options = {}) {
  const scope = resolveScope(input);
  const sourceIndex = buildSourceIndex(input.sources);

  // Deterministic ordering: highest signal first, then id — independent of
  // input array order (mirrors the repo's order-stability guarantee).
  const nodes = [...scope.nodes]
    .sort((a, b) => (b?.weight ?? 0) - (a?.weight ?? 0) || String(a?.id).localeCompare(String(b?.id)))
    .map(nodeEntry);
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  // Keep the bundle self-contained: drop any edge whose endpoints are not both
  // present as nodes (e.g. district-gravity edges to non-node ids).
  const edges = [...scope.edges]
    .filter((edge) => nodeIdSet.has(edge?.from) && nodeIdSet.has(edge?.to))
    .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0) || String(a?.id).localeCompare(String(b?.id)))
    .map(edgeEntry);

  const citedIds = new Set();
  nodes.forEach((node) => node.sourceIds.forEach((id) => citedIds.add(id)));
  edges.forEach((edge) => edge.sourceIds.forEach((id) => citedIds.add(id)));

  const sources = [];
  const warnings = [];
  [...citedIds].sort().forEach((id) => {
    const source = sourceIndex.get(id);
    if (!source) {
      warnings.push(`Cited source ${id} is not registered in sources/catalog.json and was omitted.`);
      return;
    }
    sources.push({
      id: source.id,
      type: source.type ?? null,
      title: source.title ?? null,
      path: source.path ?? null,
      trustLevel: source.trust_level ?? source.trustLevel ?? null,
      sensitivity: source.sensitivity ?? null,
      excerpt: source.summary ?? null,
    });
  });

  return {
    schema_version: CONTEXT_BUNDLE_SCHEMA_VERSION,
    generated_at: options.now || new Date().toISOString(),
    provenance: {
      app: "groundplane",
      export: "read-only context bundle",
      note: "Cites only sources registered in sources/catalog.json. The browser wrote nothing.",
    },
    scope: { kind: scope.kind, id: scope.id, title: scope.title },
    stats: {
      node_count: nodes.length,
      edge_count: edges.length,
      source_count: sources.length,
      truncated: false,
    },
    nodes,
    edges,
    sources,
    warnings,
  };
}

// Serialize with a hard byte cap. Trims deterministically (excerpts first, then
// lowest-signal nodes and their now-orphaned edges/sources) so the result is
// always valid JSON at or under the cap.
export function serializeContextBundle(bundle, options = {}) {
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : DEFAULT_BUNDLE_MAX_BYTES;
  const working = JSON.parse(JSON.stringify(bundle));
  const render = () => JSON.stringify(working, null, 2);

  let json = render();
  if (byteLength(json) <= maxBytes) {
    return { json, bytes: byteLength(json), truncated: false, bundle: working };
  }

  // 1) Drop source excerpts (the largest free-text payload).
  working.sources.forEach((source) => {
    source.excerpt = null;
  });
  working.stats.truncated = true;
  working.warnings.push("Source excerpts were omitted to fit the size cap.");
  json = render();

  // 2) Drop lowest-signal nodes (already sorted highest-first) and prune edges
  //    and sources that lose all support, until the bundle fits.
  let droppedNodes = 0;
  while (byteLength(json) > maxBytes && working.nodes.length > 1) {
    working.nodes.pop();
    droppedNodes += 1;
    const keptIds = new Set(working.nodes.map((node) => node.id));
    working.edges = working.edges.filter((edge) => keptIds.has(edge.from) && keptIds.has(edge.to));
    const stillCited = new Set();
    working.nodes.forEach((node) => asArray(node.sourceIds).forEach((id) => stillCited.add(id)));
    working.edges.forEach((edge) => asArray(edge.sourceIds).forEach((id) => stillCited.add(id)));
    working.sources = working.sources.filter((source) => stillCited.has(source.id));
    json = render();
  }

  working.stats.node_count = working.nodes.length;
  working.stats.edge_count = working.edges.length;
  working.stats.source_count = working.sources.length;
  if (droppedNodes > 0) {
    working.warnings.push(`Dropped ${droppedNodes} lower-signal node(s) to fit the ${maxBytes}-byte cap.`);
    json = render();
  }

  return { json, bytes: byteLength(json), truncated: true, bundle: working };
}
