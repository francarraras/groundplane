import { asArray, escapeHtml, pill, publicText, publicTitle, truncateText } from "./helpers.js";

export function renderRelationshipList(related, selectedRelationshipId = null) {
  const items = asArray(related);
  if (items.length === 0) {
    return '<p class="empty-note">No connections visible for this focus.</p>';
  }

  return `
    <ul class="relationship-list">
      ${items
        .map(
          (item) => `
            <li>
              <button
                class="relationship-button${item.id === selectedRelationshipId ? " is-active" : ""}"
                type="button"
                data-relationship-id="${escapeHtml(encodeURIComponent(item.id || ""))}"
              >
                <strong>${escapeHtml(publicText(item.title || relationshipTitle(item) || "Connection"))}</strong>
                <span>${escapeHtml(publicText(item.evidence || "No evidence text available"))}</span>
                <small>${escapeHtml(item.visualOnly ? "Map-only cue" : readablePermissionMode(item.permissionMode || "suggest-only"))}</small>
              </button>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function relationshipTitle(relationship) {
  if (relationship?.title) return publicText(relationship.title);

  const type = String(relationship?.type || "relationship").replaceAll("_", " ");
  const from = publicTitle(relationship?.fromTitle || relationship?.from || "unknown", "Unknown");
  const to = publicTitle(relationship?.toTitle || relationship?.to || "unknown", "Unknown");
  return `${publicText(type)}: ${from} to ${to}`;
}

export function relationshipsForRegion(model, region, selectedId) {
  const canDeriveSelectedRelationships = Boolean(selectedId && region?.id === selectedId && Array.isArray(model?.relationships));
  if (!canDeriveSelectedRelationships) {
    return asArray(model?.inspector?.related);
  }

  return model.relationships
    .filter((relationship) => relationship?.from === region.id || relationship?.to === region.id)
    .map((relationship) => ({
      ...relationship,
      id: relationship.id,
      title: relationshipTitle(relationship),
      evidence: relationship.evidence,
      permissionMode: relationship.permissionMode,
      visualOnly: Boolean(relationship.visualOnly),
      fromTitle: relationship.fromTitle || regionTitle(model, relationship.from),
      toTitle: relationship.toTitle || regionTitle(model, relationship.to),
      sourceIds: asArray(relationship.sourceIds || relationship.source_ids),
      safeActions: asArray(relationship.safeActions),
    }));
}

export function relationshipById(model, relationshipId) {
  return asArray(model?.relationships).find((relationship) => relationship?.id === relationshipId) || null;
}

export function regionTitle(model, regionId) {
  const region = asArray(model?.regions).find((candidate) => candidate.id === regionId);
  return publicTitle(region?.title || regionId || "unknown", "Unknown");
}

function readablePermissionMode(value = "suggest-only") {
  const normalized = String(value || "suggest-only").toLowerCase();
  const labels = {
    "automatic-low-risk": "Automatic low risk",
    "draft-for-approval": "Draft for review",
    "suggest-only": "Suggestion only",
    "forbidden-in-v0": "Not available yet",
    "forbidden-in-V0": "Not available yet",
  };
  return labels[normalized] || publicTitle(normalized, "Suggestion only");
}

export function relationshipPathTitle(fromTitle, toTitle) {
  return `${fromTitle} to ${toTitle}`;
}

function relationshipKindLabel(relationship = {}) {
  if (relationship.visualOnly) return "Map-only cue";
  return publicText(String(relationship.type || "connection").replaceAll("_", " "));
}

function relationshipStrengthLabel(relationship = {}) {
  if (!Number.isFinite(relationship.strength)) return "Strength not scored";
  return `${Math.round(relationship.strength * 100)}% strength`;
}

function relationshipSourceIds(relationship = {}) {
  return asArray(relationship.sourceIds || relationship.source_ids);
}

function relationshipSourceCount(relationship = {}) {
  const sourceIdCount = relationshipSourceIds(relationship).length;
  if (sourceIdCount > 0) return sourceIdCount;
  return asArray(relationship.evidenceTrail?.records).length;
}

function relationshipSourceCountLabel(relationship = {}) {
  const count = relationshipSourceCount(relationship);
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

function connectionSafeStepLabel(relationship = {}) {
  const actions = asArray(relationship.safeActions);
  const readyAction =
    actions.find((action) => action?.allowed === true && action?.browserWrites === false && !action?.requiresExplicitApproval) ||
    actions.find((action) => action?.allowed === true && action?.browserWrites === false) ||
    actions[0];
  return publicText(readyAction?.label || readyAction?.title || "Explain connection");
}

function connectionApprovalLabel(relationship = {}) {
  const approval = publicTitle(relationship.approvalStatus || relationship.approval_status || "approved", "Approved");
  const permission = relationship.visualOnly ? "Map-only cue" : readablePermissionMode(relationship.permissionMode);
  return `${permission} / ${approval}`;
}

function relatedConnectionPaths(model, relationship = {}) {
  const relationships = asArray(model?.relationships);
  const endpoints = [relationship.from, relationship.to].filter(Boolean);
  if (endpoints.length === 0) return [];

  return relationships
    .filter((candidate) => candidate?.id !== relationship.id)
    .filter((candidate) => endpoints.includes(candidate?.from) || endpoints.includes(candidate?.to))
    .slice(0, 4)
    .map((candidate) => {
      const fromTitle = candidate.fromTitle || regionTitle(model, candidate.from);
      const toTitle = candidate.toTitle || regionTitle(model, candidate.to);
      return {
        id: candidate.id,
        title: relationshipPathTitle(fromTitle, toTitle),
        evidence: publicText(candidate.evidence || "No evidence text available"),
        sourceCount: relationshipSourceCount(candidate),
        permission: candidate.visualOnly ? "Map-only cue" : readablePermissionMode(candidate.permissionMode),
      };
    });
}

function connectionLensModel(model, relationship) {
  if (!relationship) return "";

  const fromTitle = relationship.fromTitle || regionTitle(model, relationship.from);
  const toTitle = relationship.toTitle || regionTitle(model, relationship.to);
  const strength = relationshipStrengthLabel(relationship);
  const permission = relationship.visualOnly ? "Map-only cue" : readablePermissionMode(relationship.permissionMode);
  const pathTitle = relationshipPathTitle(fromTitle, toTitle);
  const sourceCount = relationshipSourceCount(relationship);
  const safeStep = connectionSafeStepLabel(relationship);
  const why = publicText(relationship.evidence || "No evidence text available");

  return {
    pathTitle,
    why,
    sourceCount,
    sourceCountLabel: relationshipSourceCountLabel(relationship),
    safeStep,
    permission,
    approval: connectionApprovalLabel(relationship),
    strength,
    kind: relationshipKindLabel(relationship),
    relatedPaths: relatedConnectionPaths(model, relationship),
  };
}

function renderConnectionLens(model, relationship) {
  const lens = connectionLensModel(model, relationship);
  if (!lens) return "";
  const pathTitle = lens.pathTitle;

  const relatedPathRows =
    lens.relatedPaths.length === 0
      ? '<p class="empty-note">No nearby paths visible for this connection.</p>'
      : `
        <ul class="connection-path-list">
          ${lens.relatedPaths
            .map(
              (path) => `
                <li>
                  <strong>${escapeHtml(publicText(path.title))}</strong>
                  <span>${escapeHtml(truncateText(path.evidence, 96))}</span>
                  <small>${escapeHtml(`${path.sourceCount} ${path.sourceCount === 1 ? "source" : "sources"} / ${path.permission}`)}</small>
                </li>
              `,
            )
            .join("")}
        </ul>
      `;

  return `
    <section class="inspector-section relationship-detail connection-lens-panel" aria-label="${escapeHtml(
      `Connection: ${lens.pathTitle}. ${lens.why}`,
    )}">
      <p class="section-kicker">Connection</p>
      <h3>${escapeHtml(pathTitle)}</h3>
      <div class="relationship-meta">
        ${pill(lens.kind)}
        ${pill(lens.permission)}
        ${pill(lens.strength)}
      </div>
      <div class="connection-lens-grid">
        <span class="connection-lens-why">
          <b>Why it matters</b>
          <em>${escapeHtml(lens.why)}</em>
        </span>
        <span>
          <b>Source count</b>
          <em>${escapeHtml(lens.sourceCountLabel)}</em>
        </span>
        <span>
          <b>Approval state</b>
          <em>${escapeHtml(lens.approval)}</em>
        </span>
        <span>
          <b>Safe next step</b>
          <em>${escapeHtml(lens.safeStep)}</em>
        </span>
      </div>
      <details class="connection-path-preview">
        <summary>
          <span>Related paths</span>
          <small>${escapeHtml(lens.relatedPaths.length)}</small>
        </summary>
        ${relatedPathRows}
      </details>
    </section>
  `;
}

export function renderSelectedRelationship(model, relationship) {
  if (!relationship) return "";

  const lens = renderConnectionLens(model, relationship);
  if (!lens) return "";
  return `
    ${lens}
  `;
}
