import { asArray, drawerCountLabel, escapeHtml, publicText, truncateText } from "./helpers.js";

function compactEvidenceSignal(trail = {}, records = []) {
  const health = trail.health || "unknown";
  const firstSourceId = records.find((record) => record?.sourceId)?.sourceId || "";
  const sourceSignal = firstSourceId ? ` / ${firstSourceId}` : "";
  return `${health} / ${drawerCountLabel(records.length, "source")}${sourceSignal}`;
}

export function renderEvidenceTrail(subject) {
  const trail = subject?.evidenceTrail;
  if (!trail) {
    return `
      <section class="inspector-section evidence-trail">
        <p class="section-kicker">Evidence</p>
        <p class="empty-note">No evidence is available for this focus.</p>
      </section>
    `;
  }

  const records = asArray(trail.records);
  const sourceRows =
    records.length === 0
      ? '<p class="empty-note">No evidence IDs attached.</p>'
      : `<ul class="source-list">
          ${records
            .map(
              (record) => `
                <li data-source-resolved="${record.resolved ? "true" : "false"}">
                  <strong>${escapeHtml(record.title || record.sourceId)}</strong>
                  <span>${escapeHtml(record.sourceId || "unknown source")}</span>
                  <small>${escapeHtml(record.path || "missing path")}</small>
                  <em>${escapeHtml(record.sensitivity || "unknown")} / ${escapeHtml(record.trustLevel || "unknown")}</em>
                </li>
              `,
            )
            .join("")}
        </ul>`;
  const sourceRecordCount = `${records.length}`;
  const summaryText = publicText(trail.summary || "No evidence text available.");
  const evidenceSignal = compactEvidenceSignal(trail, records);
  const fullEvidenceSignal = `${trail.health || "unknown"} / ${records.length} source${records.length === 1 ? "" : "s"} / ${
    trail.permissionMode || "suggest-only"
  } / ${trail.approvalStatus || "unknown"}`;

  return `
    <section class="inspector-section evidence-trail">
      <div class="evidence-trail-head" title="${escapeHtml(summaryText)}" aria-label="${escapeHtml(`Evidence: ${fullEvidenceSignal}. ${summaryText}`)}">
        <p class="section-kicker">Evidence</p>
        <strong>${escapeHtml(truncateText(evidenceSignal, 44))}</strong>
      </div>
      <details class="evidence-note-detail">
        <summary>
          <span>Summary</span>
          <small title="${escapeHtml(summaryText)}">Open</small>
        </summary>
        <p>${escapeHtml(summaryText)}</p>
      </details>
      <details class="source-records-detail">
        <summary>
          <span>Source files</span>
          <small>${escapeHtml(sourceRecordCount)}</small>
        </summary>
        <div class="source-record-list">
          ${sourceRows}
        </div>
      </details>
      ${
        asArray(trail.warnings).length === 0
          ? ""
          : `<p class="source-warning">${escapeHtml(trail.warnings.join(" "))}</p>`
      }
    </section>
  `;
}
