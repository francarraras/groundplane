// Context assembly for the operator CLI (#18).
//
// The graph IS the index: given a region/cluster, reuse the same bounded
// context-bundle serializer the browser uses (app/src/contextBundle.js) to
// gather nodes + edges + cited source excerpts, then format it into provider
// messages. No vector DB, no retrieval service — one deterministic slice.
import { buildSurfaceModel } from "../../app/src/viewModel.js";
import { buildContextBundle, serializeContextBundle } from "../../app/src/contextBundle.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Resolve a --region argument to a selection the bundle understands.
// Accepts a district id/title (→ cluster) or a node id/title (→ node + 1-hop),
// otherwise falls back to the model's current focus, otherwise the atlas.
export function resolveRegionSelection(baseModel, region) {
  const districts = asArray(baseModel?.districts);
  const allRegions = asArray(baseModel?.allRegions);

  if (region) {
    const needle = String(region).trim().toLowerCase();
    // Match on full id, on title, or on the id's trailing segment so both
    // "district:launch-ops" and "launch-ops" resolve to the same cluster.
    const idMatches = (candidate) => {
      const id = String(candidate.id).toLowerCase();
      return id === needle || id.split(":").pop() === needle;
    };
    const titleMatches = (candidate) => String(candidate.title || "").toLowerCase() === needle;

    const district = districts.find(idMatches) || districts.find(titleMatches);
    if (district) return { activeDistrictId: district.id, selectedId: district.id, matched: district.id };

    const node = allRegions.find(idMatches) || allRegions.find(titleMatches);
    if (node) return { activeDistrictId: null, selectedId: node.id, matched: node.id };

    return { activeDistrictId: null, selectedId: null, matched: null, unmatched: region };
  }

  const focusId = baseModel?.currentFocus?.id || null;
  return { activeDistrictId: null, selectedId: focusId, matched: focusId };
}

export function buildAskContext({ state, region = null, now = undefined, maxBytes = undefined } = {}) {
  const baseModel = buildSurfaceModel(state);
  const selection = resolveRegionSelection(baseModel, region);
  const bundle = buildContextBundle(
    {
      baseModel,
      model: baseModel,
      selectedId: selection.selectedId,
      activeDistrictId: selection.activeDistrictId,
      sources: state?.sources?.sources,
    },
    { now },
  );
  const serialized = serializeContextBundle(bundle, maxBytes ? { maxBytes } : {});
  return { baseModel, selection, bundle, serialized };
}

const SYSTEM_PROMPT = [
  "You are the Groundplane operator assistant.",
  "Answer ONLY using the provided context bundle (nodes, edges, and cited source excerpts).",
  "Cite the source ids you rely on in square brackets, e.g. [SRC-2026-06-13-001].",
  "If the context does not contain the answer, say so plainly. Do not invent facts, files, or sources.",
].join(" ");

export function buildMessages(question, serializedJson) {
  const user = [
    `Question: ${question}`,
    "",
    "Context bundle (JSON):",
    serializedJson,
    "",
    "Answer the question using only this context and cite the source ids you used.",
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
