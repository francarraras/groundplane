// Map legend / node-type key (#13). A small, always-available overlay that
// spells out the map's visual language so strangers don't have to infer it.
//
// Data-driven from a single node-type registry and filtered to the types
// actually present in the loaded graph, so the legend can never drift from what
// the map shows.
import { asArray, escapeHtml } from "./instruments/helpers.js";

export const NODE_TYPE_REGISTRY = [
  { type: "district", label: "Area", note: "A cluster of related items" },
  { type: "project", label: "Project", note: "A tracked initiative" },
  { type: "routine", label: "Routine", note: "A recurring cadence" },
  { type: "task", label: "Task", note: "A unit of work" },
  { type: "decision", label: "Decision", note: "A locked choice" },
  { type: "memory_claim", label: "Memory claim", note: "A verified insight" },
  { type: "review", label: "Review", note: "A packet in the approval queue" },
  { type: "proof_artifact", label: "Proof", note: "A verifiable deliverable" },
];

function presentTypes(model) {
  const present = new Set();
  for (const region of asArray(model?.regions)) present.add(region?.type);
  for (const node of asArray(model?.graph?.nodes)) present.add(node?.type);
  return present;
}

export function renderMapLegend(root, model) {
  if (!root) return;

  const present = presentTypes(model);
  const typeRows = NODE_TYPE_REGISTRY.filter((entry) => present.has(entry.type));
  if (typeRows.length === 0) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <section class="map-legend-panel" aria-label="Map legend">
      <p class="map-legend-title">Legend</p>
      <ul class="map-legend-types">
        ${typeRows
          .map(
            (entry) => `
              <li data-legend-type="${escapeHtml(entry.type)}">
                <b>${escapeHtml(entry.label)}</b>
                <span>${escapeHtml(entry.note)}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
      <ul class="map-legend-cues">
        <li>
          <span class="legend-swatch legend-edge" aria-hidden="true"></span>
          <span>Connection — a source-backed link between items</span>
        </li>
        <li>
          <span class="legend-swatch legend-halo" aria-hidden="true"></span>
          <span>Gold ring — an area holding a pending approval</span>
        </li>
      </ul>
    </section>
  `;
}
