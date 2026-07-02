function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusTone(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-") || "unknown";
}

function pill(value) {
  const label = value || "unknown";
  const tone = statusTone(label);
  return `<span class="status-pill status-pill-${escapeHtml(tone)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(
    label,
  )}">${escapeHtml(label)}</span>`;
}

function statusDot(value) {
  const label = value || "unknown";
  const tone = statusTone(label);
  return `<span class="status-pill status-pill-${escapeHtml(tone)} command-status-dot" title="${escapeHtml(
    label,
  )}" aria-label="${escapeHtml(label)}"></span>`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function publicText(value = "") {
  return String(value ?? "")
    .replace(/\bDistricts\b/g, "Areas")
    .replace(/\bdistricts\b/g, "areas")
    .replace(/\bDistrict\b/g, "Area")
    .replace(/\bdistrict\b/g, "area")
    .replace(/\bRegions\b/g, "Areas")
    .replace(/\bregions\b/g, "areas")
    .replace(/\bRegion\b/g, "Area")
    .replace(/\bregion\b/g, "area")
    .replace(/\bNodes\b/g, "Items")
    .replace(/\bnodes\b/g, "items")
    .replace(/\bNode\b/g, "Item")
    .replace(/\bnode\b/g, "item")
    .replace(/\bRelationships\b/g, "Connections")
    .replace(/\brelationships\b/g, "connections")
    .replace(/\bRelationship\b/g, "Connection")
    .replace(/\brelationship\b/g, "connection")
    .replace(/\bRelations\b/g, "Connections")
    .replace(/\brelations\b/g, "connections")
    .replace(/\bRelation\b/g, "Connection")
    .replace(/\brelation\b/g, "connection");
}

function publicTitle(value, fallback = "Untitled area") {
  const text = String(value || fallback)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  const isSlugLike = /^[a-z0-9\s]+$/.test(text) && text === text.toLowerCase();
  if (!isSlugLike) return publicText(text);
  return publicText(text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()));
}

function publicTypeLabel(value = "area") {
  const type = String(value || "area")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const labels = {
    district: "Area",
    region: "Area",
    proof: "Proof",
    "proof artifact": "Proof",
    proof_artifact: "Proof",
    relationship: "Connection",
    source: "Evidence",
    review: "Review",
    task: "Task",
    project: "Project",
  };
  return labels[type] || publicText(type || "area");
}

function publicSubtitle(region) {
  if (!region) return "Area";
  const subtitle = region.subtitle || region.type || "Area";
  return publicText(subtitle);
}

function publicScopeLabel(scope, model = {}) {
  if (scope === "relationship") return "Connection";
  if (scope === "district" || model?.activeDistrictId) return "Area view";
  return "Home";
}

function publicCountLabel(count, singular, plural = `${singular}s`) {
  const value = Number.isFinite(count) ? count : 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

function selectedRegion(model, selectedId) {
  const regions = asArray(model?.regions);
  return regions.find((region) => region.id === selectedId) || model?.currentFocus || regions[0] || null;
}

function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#39d9c2";
}

function finitePosition(value) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

const FALLBACK_LABEL_POSITIONS = [
  { x: 50, y: 44 },
  { x: 22, y: 24 },
  { x: 76, y: 27 },
  { x: 26, y: 72 },
  { x: 74, y: 72 },
  { x: 50, y: 16 },
  { x: 50, y: 82 },
];

const DEFAULT_LABEL_STAGE = { width: 500, height: 500 };
const NARROW_LABEL_STAGE_WIDTH = 520;
const LABEL_EDGE_X = 76;
const LABEL_EDGE_Y = 42;
const LABEL_GAP = 8;
const LABEL_MIN_WIDTH = 112;
const LABEL_COMPACT_WIDTH = 148;
const LABEL_RELATED_WIDTH = 164;
const LABEL_SELECTED_WIDTH = 204;
const LABEL_MOBILE_MAX_WIDTH = 142;
const LABEL_HEIGHT = 62;
const LABEL_COMPACT_HEIGHT = 48;
const LABEL_OFFSET_RINGS = [0, 42, 74, 108, 146, 190];
const ATLAS_RAIL_REST_LIMIT = 7;

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function measuredStage(root) {
  const rect = root?.getBoundingClientRect?.();
  const width = positiveFinite(rect?.width) || positiveFinite(root?.clientWidth) || DEFAULT_LABEL_STAGE.width;
  const height = positiveFinite(rect?.height) || positiveFinite(root?.clientHeight) || DEFAULT_LABEL_STAGE.height;
  const exclusions = measureLabelExclusions(root, rect, width, height);

  return { width, height, exclusions };
}

function measureLabelExclusions(root, rootRect, stageWidth, stageHeight) {
  const doc = root?.ownerDocument;
  if (!doc?.querySelectorAll || !rootRect) return [];

  const selectors = [
    ".top-command",
    ".left-nav",
    ".inspector",
    ".bottom-instruments",
    ".world-navigation",
    ".world-orientation",
    ".focus-card.is-visible",
    ".district-breadcrumb:not(:empty)",
  ];

  return selectors
    .flatMap((selector) => Array.from(doc.querySelectorAll(selector)))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: clamp(rect.left - rootRect.left, 0, stageWidth),
        top: clamp(rect.top - rootRect.top, 0, stageHeight),
        right: clamp(rect.right - rootRect.left, 0, stageWidth),
        bottom: clamp(rect.bottom - rootRect.top, 0, stageHeight),
      };
    })
    .filter((box) => box.right > box.left && box.bottom > box.top);
}

function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function finiteMetric(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function labelPriority(node, index, focusContext) {
  const explicitPriority = focusContext.labelPriorityById?.[node?.id];
  if (Number.isFinite(explicitPriority)) return explicitPriority - index * 0.01;
  if (node?.selected) return 1000 - index * 0.01;

  const role = labelRole(node, focusContext);
  const roleScore = role === "hovered" ? 900 : role === "related" ? 620 : 0;
  const weight = finiteMetric(node?.weight, 0.35);
  const focus = finiteMetric(node?.focus, 6);
  const distance = finiteMetric(node?.distance, 18);
  const focusScore = Math.max(0, 6 - focus) * 16;
  const distanceScore = Math.max(0, 22 - distance) * 0.8;
  return roleScore + focusScore + weight * 18 + distanceScore - index * 0.01;
}

function labelSize(node, stage, role = "ambient") {
  const isPrimary = role === "selected" || role === "hovered";
  const desktopWidth = isPrimary ? LABEL_SELECTED_WIDTH : role === "related" ? LABEL_RELATED_WIDTH : LABEL_COMPACT_WIDTH;
  const maxWidth = stage.width < NARROW_LABEL_STAGE_WIDTH ? LABEL_MOBILE_MAX_WIDTH : desktopWidth;
  const width = Math.max(LABEL_MIN_WIDTH, maxWidth);
  const height = isPrimary ? LABEL_HEIGHT : LABEL_COMPACT_HEIGHT;
  return { width, height };
}

function shouldUseProjectedLabel(node, stage) {
  const x = node?.screen?.x;
  const y = node?.screen?.y;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (stage.width > 0 && stage.width < NARROW_LABEL_STAGE_WIDTH) return false;
  if (stage.width === 0 || stage.height === 0) return false;

  const minX = LABEL_EDGE_X;
  const maxX = stage.width - LABEL_EDGE_X;
  const minY = LABEL_EDGE_Y;
  const maxY = stage.height - LABEL_EDGE_Y;

  if (maxX <= minX || maxY <= minY) return false;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function fallbackAnchor(index, stage) {
  const position = FALLBACK_LABEL_POSITIONS[index % FALLBACK_LABEL_POSITIONS.length];
  return {
    x: (position.x / 100) * stage.width,
    y: (position.y / 100) * stage.height,
  };
}

function labelAnchor(node, index, stage) {
  if (shouldUseProjectedLabel(node, stage)) {
    return { x: node.screen.x, y: node.screen.y };
  }

  return fallbackAnchor(index, stage);
}

function candidateAnchors(anchor) {
  const candidates = [{ x: anchor.x, y: anchor.y }];

  LABEL_OFFSET_RINGS.slice(1).forEach((radius) => {
    candidates.push(
      { x: anchor.x, y: anchor.y - radius },
      { x: anchor.x + radius, y: anchor.y },
      { x: anchor.x - radius, y: anchor.y },
      { x: anchor.x, y: anchor.y + radius },
      { x: anchor.x + radius * 0.74, y: anchor.y - radius * 0.74 },
      { x: anchor.x - radius * 0.74, y: anchor.y - radius * 0.74 },
      { x: anchor.x + radius * 0.74, y: anchor.y + radius * 0.74 },
      { x: anchor.x - radius * 0.74, y: anchor.y + radius * 0.74 },
    );
  });

  return candidates;
}

function boxFromAnchor(anchor, size, stage) {
  const centerX = clamp(anchor.x, LABEL_EDGE_X + size.width / 2, stage.width - LABEL_EDGE_X - size.width / 2);
  const centerY = clamp(anchor.y, LABEL_EDGE_Y + size.height / 2, stage.height - LABEL_EDGE_Y - size.height / 2);
  const left = centerX - size.width / 2;
  const top = centerY - size.height / 2;

  return {
    x: centerX,
    y: centerY,
    left,
    top,
    right: left + size.width,
    bottom: top + size.height,
    width: size.width,
    height: size.height,
  };
}

function boxesOverlap(first, second, gap = LABEL_GAP) {
  return !(
    first.right + gap <= second.left ||
    second.right + gap <= first.left ||
    first.bottom + gap <= second.top ||
    second.bottom + gap <= first.top
  );
}

function overlapArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function collisionScore(box, placedBoxes, blockedBoxes) {
  return [...placedBoxes, ...blockedBoxes].reduce((score, other) => score + overlapArea(box, other), 0);
}

function chooseLabelBox(anchor, size, stage, placedBoxes, blockedBoxes) {
  let fallback = null;

  for (const candidate of candidateAnchors(anchor)) {
    const box = boxFromAnchor(candidate, size, stage);
    if (!fallback || collisionScore(box, placedBoxes, blockedBoxes) < fallback.score) {
      fallback = { box, score: collisionScore(box, placedBoxes, blockedBoxes) };
    }

    const collides = [...placedBoxes, ...blockedBoxes].some((placed) => boxesOverlap(box, placed));
    if (!collides) return { box, collided: false };
  }

  return { box: fallback?.box || boxFromAnchor(anchor, size, stage), collided: true };
}

function normalizeStage(stage = {}) {
  return {
    width: positiveFinite(stage.width) || DEFAULT_LABEL_STAGE.width,
    height: positiveFinite(stage.height) || DEFAULT_LABEL_STAGE.height,
    exclusions: Array.isArray(stage.exclusions) ? stage.exclusions : [],
  };
}

function normalizeFocusContext(input = {}) {
  if (typeof input === "string") return { selectedId: input, relatedNodeIds: [], labelPriorityById: {} };
  return {
    selectedId: input?.selectedId || null,
    hoveredId: input?.hoveredId || null,
    activeId: input?.activeId || input?.hoveredId || input?.selectedId || null,
    relatedNodeIds: asArray(input?.relatedNodeIds),
    labelPriorityById: input?.labelPriorityById || {},
  };
}

function labelRole(node, focusContext) {
  if (node?.id === focusContext.selectedId) return "selected";
  if (node?.id === focusContext.hoveredId) return "hovered";
  if (focusContext.relatedNodeIds.includes(node?.id)) return "related";
  return "ambient";
}

function visibleLabelBudget(stage) {
  if (stage.width < 460) return 3;
  if (stage.width < 720) return 4;
  return 5;
}

export function layoutWorldLabels(nodes, stageInput = {}, focusInput = {}) {
  const stage = normalizeStage(stageInput);
  const focusContext = normalizeFocusContext(focusInput);
  const labelBudget = visibleLabelBudget(stage);
  const items = asArray(nodes).map((node, index) => {
    const role = labelRole(node, focusContext);
    const selected = role === "selected" || node?.selected;
    const hovered = role === "hovered";
    const related = role === "related";
    const size = labelSize(node, stage, role);
    return {
      ...node,
      index,
      id: node?.id || `label-${index}`,
      selected,
      hovered,
      related,
      role,
      color: safeColor(node?.color),
      size,
      priority: labelPriority({ ...node, selected }, index, focusContext),
      anchor: labelAnchor(node, index, stage),
    };
  });

  const placedBoxes = [];
  const placedByIndex = new Map();
  const blockedBoxes = stage.exclusions;
  let visibleCount = 0;

  items
    .filter((item) => item.selected || item.hovered || item.related || item?.screen?.visible !== false)
    .sort((first, second) => second.priority - first.priority)
    .forEach((item) => {
      const placement = chooseLabelBox(item.anchor, item.size, stage, placedBoxes, blockedBoxes);
      const mustShow = item.selected || item.hovered || (item.related && visibleCount < labelBudget);

      if ((placement.collided || visibleCount >= labelBudget) && !mustShow) {
        placedByIndex.set(item.index, {
          ...item,
          visible: false,
          box: placement.box,
          x: placement.box.x,
          y: placement.box.y,
        });
        return;
      }

      placedBoxes.push(placement.box);
      visibleCount += 1;
      placedByIndex.set(item.index, {
        ...item,
        visible: true,
        box: placement.box,
        x: placement.box.x,
        y: placement.box.y,
      });
    });

  return items.map((item) => {
    return (
      placedByIndex.get(item.index) || {
        ...item,
        visible: false,
        box: boxFromAnchor(item.anchor, item.size, stage),
        x: item.anchor.x,
        y: item.anchor.y,
      }
    );
  });
}

function labelStyle(label) {
  return `--label-color: ${escapeHtml(safeColor(label.color))}; --label-x: ${finitePosition(label.x)}px; --label-y: ${finitePosition(
    label.y,
  )}px;`;
}

function labelName(label) {
  return publicTitle(label?.label || label?.title || label?.id || "Area", "Area");
}

function labelType(label) {
  return publicTypeLabel(label?.type || "area")
    .replace(/\s+/g, " ")
    .trim();
}

function labelIdSuffix(label) {
  return String(label?.id || "")
    .split(":")
    .filter(Boolean)
    .pop()
    ?.replace(/[_-]+/g, " ")
    .trim();
}

function isSentenceLikeLabel(name) {
  const text = String(name || "").trim();
  return text.length > 42 && /[.!?]$|\s(as|that|with|from|into|because|while)\s/i.test(text);
}

function labelDisplayName(label) {
  const name = labelName(label);
  if (!isSentenceLikeLabel(name)) return name;

  const type = labelType(label);
  const suffix = labelIdSuffix(label) || "item";
  return `${type} ${suffix}`.trim();
}

function labelDisplayText(label) {
  return truncateText(labelDisplayName(label), label.role === "selected" ? 42 : 34);
}

function labelAccessibleText(label) {
  const name = labelName(label);
  const type = labelType(label);
  const role = String(label?.role || "ambient").replace(/\s+/g, " ").trim();
  return `${name}: ${type} ${role}`;
}

function createLabelElement(root, label) {
  const element = root.ownerDocument.createElement("div");
  element.className = "world-label";
  element.dataset.regionId = label.id;

  const title = root.ownerDocument.createElement("strong");
  const type = root.ownerDocument.createElement("span");
  element.append(title, type);
  root.append(element);
  return element;
}

function syncLabelElement(element, label) {
  element.dataset.regionId = label.id;
  element.dataset.labelState = label.visible ? "visible" : "hidden";
  element.dataset.labelRole = label.role || "ambient";
  element.dataset.labelType = label.type || "region";
  element.style.cssText = labelStyle(label);
  element.title = labelAccessibleText(label);
  element.setAttribute("aria-label", labelAccessibleText(label));

  const title = element.querySelector("strong");
  const type = element.querySelector("span");
  if (title) title.textContent = labelDisplayText(label);
  if (type) type.textContent = label.role === "selected" ? labelType(label) : "";
}

function renderWorldLabelsDom(root, labels) {
  const existing = new Map(Array.from(root.querySelectorAll(".world-label")).map((element) => [element.dataset.regionId, element]));
  const active = new Set();

  labels
    .filter((label) => label.visible)
    .forEach((label) => {
      const key = String(label.id);
      const element = existing.get(key) || createLabelElement(root, label);
      syncLabelElement(element, label);
      active.add(key);
    });

  existing.forEach((element, key) => {
    if (!active.has(key)) element.remove();
  });
}

function renderWorldLabelsString(root, labels) {
  root.innerHTML = labels
    .filter((label) => label.visible)
    .map((label) => {
      return `
        <div
          class="world-label"
          data-region-id="${escapeHtml(label.id)}"
          data-label-state="visible"
          data-label-role="${escapeHtml(label.role || "ambient")}"
          data-label-type="${escapeHtml(label.type || "region")}"
          title="${escapeHtml(labelAccessibleText(label))}"
          aria-label="${escapeHtml(labelAccessibleText(label))}"
          style="${labelStyle(label)}"
        >
          <strong>${escapeHtml(labelDisplayText(label))}</strong>
          <span>${label.role === "selected" ? escapeHtml(labelType(label)) : ""}</span>
        </div>
      `;
    })
    .join("");
}

function field(label, value) {
  const displayValue = value === undefined || value === null || value === "" ? "none" : value;
  return `
    <div class="readout-field">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(displayValue)}</dd>
    </div>
  `;
}

function renderRelatedDecisions(related) {
  const decisions = asArray(related);
  if (decisions.length === 0) {
    return '<p class="empty-note">No locked decisions attached.</p>';
  }

  return `
    <ul class="decision-list">
      ${decisions
        .map(
          (decision) => `
            <li>
              <span>${escapeHtml(decision.id || "decision")}</span>
              <strong>${escapeHtml(decision.title || "Untitled decision")}</strong>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderRelationshipList(related, selectedRelationshipId = null) {
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

function relationshipsForRegion(model, region, selectedId) {
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

function relationshipById(model, relationshipId) {
  return asArray(model?.relationships).find((relationship) => relationship?.id === relationshipId) || null;
}

function regionTitle(model, regionId) {
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

function relationshipPathTitle(fromTitle, toTitle) {
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

function renderSelectedRelationship(model, relationship) {
  if (!relationship) return "";

  const fromTitle = relationship.fromTitle || regionTitle(model, relationship.from);
  const toTitle = relationship.toTitle || regionTitle(model, relationship.to);
  const pathTitle = relationshipPathTitle(fromTitle, toTitle);
  const lens = renderConnectionLens(model, relationship);
  if (!lens) return "";
  return `
    ${lens}
  `;
}

function truncateText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function drawerLabel(kind, title) {
  const labels = {
    proof: "Proof",
    relationship: "Connection",
    relationships: "Connections",
    sources: "Evidence",
    actions: "Next steps",
    approvals: "Reviews",
    system: "System",
    more: "Details",
  };
  return labels[kind] || title || "Detail";
}

function drawer(kind, title, meta, body, open = false) {
  const state = open ? "open" : "closed";
  const drawerMeta = publicText(meta || "Open");
  const visibleTitle = drawerLabel(kind, title);
  const summaryLabel = `${visibleTitle}: ${drawerMeta}`;
  return `
    <details class="command-deck-drawer" data-drawer-kind="${escapeHtml(kind)}" data-drawer-state="${escapeHtml(
      state,
    )}" ${open ? "open" : ""}>
      <summary data-drawer-state="${escapeHtml(state)}" title="${escapeHtml(drawerMeta)}" aria-label="${escapeHtml(summaryLabel)}">
        <span class="drawer-copy">
          <strong title="${escapeHtml(visibleTitle)}">${escapeHtml(truncateText(visibleTitle, 18))}</strong>
          <small class="drawer-meta" aria-hidden="true">${escapeHtml(truncateText(drawerMeta, 18))}</small>
        </span>
        <span class="drawer-state" aria-hidden="true">${open ? "-" : "+"}</span>
      </summary>
      <div class="command-deck-drawer-body">
        ${body}
      </div>
    </details>
  `;
}

function secondaryCommandPanel(kind, title, meta, body) {
  const panelMeta = meta || "Open";
  return `
    <details class="secondary-command-detail" data-secondary-kind="${escapeHtml(kind)}">
      <summary title="${escapeHtml(panelMeta)}" aria-label="${escapeHtml(`${title}: ${panelMeta}`)}">
        <span>${escapeHtml(drawerLabel(kind, title))}</span>
        <small>${escapeHtml(truncateText(panelMeta, 22))}</small>
      </summary>
      <div class="secondary-command-body">
        ${body}
      </div>
    </details>
  `;
}

function reviewRisk(review = {}) {
  return String(review.risk || review.risk_level || "unknown").toLowerCase();
}

function isBlockingReview(review = {}) {
  return !["low", "none", "info", "informational"].includes(reviewRisk(review));
}

function firstBlockingReview(reviewQueue) {
  const { pending } = normalizeReviewQueue(reviewQueue);
  return pending.find(isBlockingReview) || null;
}

function cockpitScope(model, selectedRelationship) {
  if (selectedRelationship) return "relationship";
  if (model?.activeDistrictId) return "district";
  return "region";
}

function plainDecisionTitle(review = {}) {
  const summary = String(review.summary || review.id || "Review pending packet");
  const normalized = summary.toLowerCase();
  if (normalized.includes("personal assistant cockpit")) return "Review cockpit feel";
  if (normalized.includes("proof artifact")) return "Review proof artifact";
  if (normalized.includes("proof-project")) return "Review proof workflow";
  if (normalized.includes("manual review handoff")) return "Review handoff writer";
  return truncateText(summary, 52);
}

function decisionSourceText(sourceIds) {
  const count = asArray(sourceIds).length;
  if (count === 0) return "none";
  return `${count} source${count === 1 ? "" : "s"}`;
}

function decisionCardModel(reviewQueue, graphWarnings) {
  const pendingReview = firstBlockingReview(reviewQueue);
  if (pendingReview) {
    const sourceIds = asArray(pendingReview.source_ids || pendingReview.sourceIds);
    return {
      state: "Decision needed",
      title: plainDecisionTitle(pendingReview),
      action: "Approve / revise / reject.",
      detail: pendingReview.diff_summary || "A draft-for-approval packet is waiting in the review queue.",
      tone: "approval",
      meta: [
        ["ID", pendingReview.id || "review"],
        ["Risk", pendingReview.risk || "unknown"],
        ["Target", pendingReview.target_file || pendingReview.targetFile || "none"],
        ["Sources", decisionSourceText(sourceIds)],
      ],
    };
  }

  if (asArray(graphWarnings).length > 0) {
    return {
      state: "Graph review",
      title: `${graphWarnings.length} graph warning${graphWarnings.length === 1 ? "" : "s"}`,
      action: "Inspect graph warnings before promoting this focus.",
      detail: "Relationship graph verification found warning-level issues.",
      tone: "warning",
      meta: [
        ["Warnings", graphWarnings.length],
        ["Target", "indexes/relationship-graph.json"],
        ["Mode", "automatic-low-risk"],
      ],
    };
  }

  return {
    state: "Clear",
    title: "No blocking approval visible",
    action: "Inspect current focus.",
    detail: "This focus has no pending review packet or graph warning in the current local state.",
    tone: "clear",
    meta: [
      ["Risk", "low"],
      ["Target", "none"],
      ["Mode", "suggest-only"],
    ],
  };
}

function recommendedActionLabel(actions = []) {
  const candidates = asArray(actions);
  const candidate = candidates.find((action) => action?.allowed === true || !action?.requiresExplicitApproval) || candidates[0];
  return candidate?.label || candidate?.actionType || "";
}

function conciseNextAction(action, region, hasBlockingDecision, actions = []) {
  if (hasBlockingDecision) return action || "Decision required";

  const recommendedAction = recommendedActionLabel(actions);
  if (recommendedAction) return recommendedAction;

  const nodeCount = Number.isFinite(region?.nodeCount) ? region.nodeCount : null;
  const relationshipCount = Number.isFinite(region?.relationshipCount) ? region.relationshipCount : null;
  const actionCounts = String(action || "").match(/contains\s+(\d+)\s+nodes?(?:\s+and\s+(\d+)\s+local\s+relationships?)?/i);
  if (actionCounts) {
    const parsedNodeCount = Number(actionCounts[1]);
    const parsedRelationshipCount = actionCounts[2]
      ? Number(actionCounts[2])
      : actionCounts[0].toLowerCase().includes("no source-backed")
        ? 0
        : null;

    if (Number.isFinite(parsedNodeCount) && Number.isFinite(parsedRelationshipCount)) {
      return `${publicCountLabel(parsedNodeCount, "item")} / ${publicCountLabel(parsedRelationshipCount, "connection")}`;
    }

    if (Number.isFinite(parsedNodeCount)) return publicCountLabel(parsedNodeCount, "item");
  }

  if (nodeCount !== null && relationshipCount !== null) {
    return `${publicCountLabel(nodeCount, "item")} / ${publicCountLabel(relationshipCount, "connection")}`;
  }

  if (nodeCount !== null) return publicCountLabel(nodeCount, "item");
  return truncateText(publicText(action || "Inspect focus."), 34);
}

function entityIdSuffix(entity) {
  return String(entity?.id || "")
    .split(":")
    .filter(Boolean)
    .pop()
    ?.replace(/[_-]+/g, " ")
    .trim();
}

function isSentenceLikeText(value) {
  const text = String(value || "").trim();
  return text.length > 42 && /[.!?]$|\s(as|that|with|from|into|because|while)\s/i.test(text);
}

function compactEntityTitle(entity, fallback = "Focus") {
  const title = String(entity?.title || entity?.label || entity?.id || fallback)
    .replace(/\s+/g, " ")
    .trim();
  if (!isSentenceLikeText(title)) return title || fallback;

  const type = String(entity?.type || "item")
    .replace(/[_-]+/g, " ")
    .trim();
  const suffix = entityIdSuffix(entity) || "item";
  return `${type} ${suffix}`.trim();
}

function compactEvidenceSignal(trail = {}, records = []) {
  const health = trail.health || "unknown";
  const firstSourceId = records.find((record) => record?.sourceId)?.sourceId || "";
  const sourceSignal = firstSourceId ? ` / ${firstSourceId}` : "";
  return `${health} / ${drawerCountLabel(records.length, "source")}${sourceSignal}`;
}

function drawerCountLabel(count, singular, plural = `${singular}s`) {
  const value = Number.isFinite(count) ? count : 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

function approvalDrawerMeta(pendingCount, resolvedCount) {
  if (pendingCount > 0) return drawerCountLabel(pendingCount, "pending");
  if (resolvedCount > 0) return drawerCountLabel(resolvedCount, "done", "done");
  return "clear";
}

function commandPriorityMetric({ activeTaskCount = 0, pendingReviewCount = 0, relationshipCount = 0, sourceCount = 0 } = {}) {
  if (pendingReviewCount > 0) return drawerCountLabel(pendingReviewCount, "approval");
  if (activeTaskCount > 0) return drawerCountLabel(activeTaskCount, "task");
  if (relationshipCount > 0) return drawerCountLabel(relationshipCount, "connection");
  if (sourceCount > 0) return drawerCountLabel(sourceCount, "evidence item");
  return "clear";
}

function compactActionGate(action = {}) {
  if (action.requiresExplicitApproval) return "Needs approval";
  if (action.allowed === false) return "Locked";
  return "Ready";
}

function compactActionMode(action = {}) {
  const normalizedMode = String(action.mode || "suggest-only").toLowerCase();
  const modeLabels = {
    "automatic-low-risk": "Automatic",
    "draft-for-approval": "Draft for review",
    "suggest-only": "Suggestion",
    "forbidden-in-v0": "Not available",
  };
  const riskLabels = {
    "low": "Low risk",
    "medium": "Medium risk",
    "high": "High risk",
  };
  const mode = modeLabels[normalizedMode] || normalizedMode.replace(/-/g, " ");
  const risk = riskLabels[String(action.risk || "low").toLowerCase()] || String(action.risk || "low").toLowerCase();
  return `${mode} · ${risk}`;
}

function actionDetailMeta(action = {}) {
  const details = [];
  if (action.targetFile) details.push(`Target: ${action.targetFile}`);
  if (asArray(action.sourceIds).length > 0) details.push(`Evidence: ${asArray(action.sourceIds).join(", ")}`);
  return details.length > 0 ? details.join(" / ") : "No file write";
}

function actionTargetText(action = {}) {
  return action.targetFile || "No file write";
}

function actionSourceText(action = {}) {
  const sourceIds = asArray(action.sourceIds);
  return sourceIds.length > 0 ? sourceIds.join(", ") : "No evidence ids";
}

function actionUndoText(action = {}) {
  if (action.undoPath || action.undo_path) return action.undoPath || action.undo_path;
  if (action.targetFile) return "Review the packet before any file write.";
  return "Nothing to undo; this action does not write files.";
}

function browserWriteLabel(value) {
  return value === true ? "On" : "Off";
}

function actionFlowModel(actions = []) {
  const items = asArray(actions);
  const readyActions = items.filter((action) => action?.allowed === true && !action?.requiresExplicitApproval);
  const approvalActions = items.filter((action) => action?.allowed === true && action?.requiresExplicitApproval);
  const lockedActions = items.filter((action) => action?.allowed === false);
  const recommended = readyActions[0] || approvalActions[0] || lockedActions[0] || null;

  return {
    recommended,
    readyCount: readyActions.length,
    approvalCount: approvalActions.length,
    lockedCount: lockedActions.length,
    browserWrites: items.some((action) => action?.browserWrites === true),
  };
}

function actionFlowTitle(action = {}) {
  return publicText(action.label || action.actionType || "No recommended step")
    .replace(/\bevidence sources\b/i, "sources")
    .replace(/\brelationship\b/i, "connection");
}

function renderActionFlowPanel(flow = {}) {
  const action = flow.recommended || {};
  const recommendedLabel = actionFlowTitle(action);
  const riskLabel = (compactActionMode(action).split(" · ").at(-1) || "Low risk").replace(/\srisk$/i, "");
  const canAct = Number.isFinite(flow.readyCount) ? flow.readyCount : 0;
  const needsApproval = Number.isFinite(flow.approvalCount) ? flow.approvalCount : 0;

  return `
    <div class="action-flow-panel" aria-label="${escapeHtml(
      `Action flow. Recommended: ${recommendedLabel}. ${canAct} can do now. ${needsApproval} need approval.`,
    )}">
      <div class="action-flow-head">
        <p class="section-kicker">Action flow</p>
        <strong>${escapeHtml(truncateText(recommendedLabel, 34))}</strong>
        <span>${escapeHtml(compactActionGate(action))}</span>
      </div>
      <div class="action-flow-grid">
        <span><b>Can do now</b><em>${escapeHtml(canAct)}</em></span>
        <span><b>Needs approval</b><em>${escapeHtml(needsApproval)}</em></span>
        <span><b>Risk</b><em>${escapeHtml(riskLabel)}</em></span>
        <span><b>Browser writes</b><em>${escapeHtml(browserWriteLabel(flow.browserWrites))}</em></span>
      </div>
      <details class="action-flow-detail">
        <summary>
          <span>Undo path</span>
          <small>Open</small>
        </summary>
        <dl class="action-flow-meta">
          ${field("Target", actionTargetText(action))}
          ${field("Sources", actionSourceText(action))}
          ${field("Undo path", actionUndoText(action))}
        </dl>
      </details>
      <p class="action-flow-boundary">Read-only.</p>
    </div>
  `;
}

function renderActionRoute(action = {}) {
  const isAllowed = action.allowed === true;
  const approvalText = action.requiresExplicitApproval ? "Approval required" : "No approval required";
  const detailMeta = actionDetailMeta(action);
  const routeLabel = publicText(action.label || action.actionType || "Action");
  const routeSummary = publicText(action.routeSummary || "No route summary available.");
  const routeMeta = compactActionMode(action);
  return `
    <li>
      <details class="action-route-card${isAllowed ? "" : " is-locked"}">
        <summary class="action-route-summary" title="${escapeHtml(`${routeLabel}: ${routeMeta}. ${approvalText}`)}">
          <span>
            <strong>${escapeHtml(truncateText(routeLabel, 24))}</strong>
            <small>${escapeHtml(routeMeta)}</small>
          </span>
          <em title="${escapeHtml(approvalText)}">${escapeHtml(compactActionGate(action))}</em>
        </summary>
        <div class="action-route-detail">
          <p>${escapeHtml(routeSummary)}</p>
          <button
            class="action-route-button${isAllowed ? "" : " is-locked"}"
            type="button"
            data-action-route-id="${escapeHtml(action.id)}"
            data-action-type="${escapeHtml(action.actionType || "")}"
            ${isAllowed ? "" : "disabled"}
          >
            <strong>Open step details</strong>
            <small>${escapeHtml(detailMeta)}</small>
          </button>
        </div>
      </details>
    </li>
  `;
}

function renderDecisionCard(card, options = {}) {
  const metaRows = asArray(card?.meta);
  const detailText = card?.detail || "No decision context recorded.";
  const hideTitle = Boolean(options.hideTitle);
  const showLedeState = !hideTitle;
  const contextSummary = metaRows
    .filter(([label]) => ["Risk", "Sources", "Warnings"].includes(label))
    .map(([, value]) => value)
    .join(" / ");
  return `
    <section class="decision-card" data-decision-tone="${escapeHtml(card?.tone || "clear")}">
      <div class="decision-card-lede">
        ${showLedeState ? `<p class="section-kicker">${escapeHtml(card?.state || "Decision")}</p>` : ""}
        ${hideTitle ? "" : `<strong>${escapeHtml(truncateText(card?.title || "No decision title", 82))}</strong>`}
        <span class="decision-card-action">${escapeHtml(truncateText(card?.action || "No action recorded.", 36))}</span>
      </div>
      <details class="decision-card-detail">
        <summary>
          <span>Decision context</span>
          <small>${escapeHtml(contextSummary || "open")}</small>
        </summary>
        <div class="decision-card-context">
          <p>${escapeHtml(truncateText(detailText, 140))}</p>
          <div class="decision-card-meta">
            ${metaRows
              .map(
                ([label, value]) => `
                  <span class="decision-meta-field">
                    <b>${escapeHtml(label)}</b>
                    <em>${escapeHtml(value === undefined || value === null || value === "" ? "none" : value)}</em>
                  </span>
                `,
              )
              .join("")}
          </div>
        </div>
      </details>
    </section>
  `;
}

function areaBriefText(value, fallback = "No summary recorded.") {
  return publicText(value || fallback)
    .replace(/\bsource-backed\b/gi, "sourced")
    .replace(/\bvisual gravity\b/gi, "map weight")
    .replace(/\bcurrent anchor\b/gi, "current focus")
    .replace(/\bgraph\b/gi, "map")
    .replace(/\s+/g, " ")
    .trim();
}

function areaSignalText({ activeTaskCount = 0, pendingReviewCount = 0, status, health } = {}) {
  if (pendingReviewCount > 0) return drawerCountLabel(pendingReviewCount, "approval");
  if (activeTaskCount > 0) return drawerCountLabel(activeTaskCount, "signal");
  return [status, health].filter(Boolean).map(publicText).slice(0, 2).join(" / ") || "clear";
}

function areaPurposeLine(region) {
  const countText = publicText(region?.subtitle || "");
  const stateText = publicText(region?.status || "");
  if (countText && stateText) return `${countText} / ${stateText}`;
  if (countText) return countText;

  const nodeCount = asArray(region?.district?.nodeIds).length;
  if (nodeCount > 0) return publicCountLabel(nodeCount, "item");
  return areaBriefText(region?.summary || region?.nextAction || region?.subtitle, "No summary recorded.");
}

function compactBriefNext(value) {
  return areaBriefText(value || "Inspect this area", "Inspect this area")
    .replace(/\bInspect evidence sources\b/i, "Inspect sources")
    .replace(/\bDraft review item\b/i, "Draft review")
    .replace(/\bExplain relationship\b/i, "Explain connection")
    .replace(/\bApprove \/ revise \/ reject\.\b/i, "Resolve review");
}

function areaBriefLinkTitle(model, relationship = {}, fallbackRegion) {
  if (!relationship) return "";
  if (relationship.fromTitle && relationship.toTitle) {
    return relationshipPathTitle(publicTitle(relationship.fromTitle), publicTitle(relationship.toTitle));
  }

  const fallbackTitle = publicTitle(fallbackRegion?.title || fallbackRegion?.id || "Current area", "Current area");
  const otherId = relationship.to === fallbackRegion?.id ? relationship.from : relationship.to;
  const otherTitle = regionTitle(model, otherId || relationship.to || relationship.from);
  return relationshipPathTitle(fallbackTitle, otherTitle);
}

function areaBriefModel({
  model,
  region,
  selectedRelationship = null,
  related = [],
  sourceCount = 0,
  relationshipCount = 0,
  activeTaskCount = 0,
  pendingReviewCount = 0,
  hasBlockingDecision = false,
  decisionCard = {},
  nextActionDisplay = "",
  nextActionText = "",
  scopeLabel = "Home",
} = {}) {
  const title = selectedRelationship
    ? areaBriefLinkTitle(model, selectedRelationship, region)
    : publicTitle(region?.title || region?.id || "Selected area", "Selected area");
  const purpose = selectedRelationship
    ? areaBriefText(selectedRelationship.evidence, "This connection explains why these two areas should be considered together.")
    : areaPurposeLine(region);
  const next = hasBlockingDecision ? decisionCard?.action || "Review pending" : nextActionDisplay || nextActionText || "Inspect this area";
  const linkCount = asArray(related).length;

  return {
    title,
    scope: publicText(scopeLabel),
    purpose,
    next: compactBriefNext(next),
    signals: areaSignalText({
      activeTaskCount,
      pendingReviewCount,
      status: region?.status,
      health: region?.health,
    }),
    evidence: `${sourceCount}`,
    connections: `${relationshipCount}`,
    links: linkCount > 0 ? drawerCountLabel(linkCount, "link") : "no links",
  };
}

function renderAreaBrief(brief = {}) {
  const title = publicTitle(brief.title || "Selected area", "Selected area");
  const purpose = areaBriefText(brief.purpose, "No summary recorded for this area yet.");
  const next = areaBriefText(brief.next, "Inspect this area");
  const signals = publicText(brief.signals || "clear");
  const evidence = publicText(brief.evidence || "0 sources");
  const connections = publicText(brief.connections || "0 connections");
  const links = areaBriefText(brief.links, "No visible links yet");
  const aria = `${title}. What this is: ${purpose}. Next: ${next}. Signals: ${signals}. Connections: ${connections}.`;
  const compact = brief.compact === true;

  if (compact) {
    return `
      <details class="area-brief" data-area-brief-mode="compact" aria-label="${escapeHtml(aria)}">
        <summary class="area-brief-purpose">
          <b>Area</b>
          <span title="${escapeHtml(purpose)}">${escapeHtml(truncateText(title, 34))}</span>
        </summary>
        <div class="area-brief-grid">
          <span class="area-brief-next">
            <b>Next</b>
            <em title="${escapeHtml(next)}">${escapeHtml(truncateText(next, 28))}</em>
          </span>
          <span>
            <b>Signals</b>
            <em>${escapeHtml(truncateText(signals, 24))}</em>
          </span>
        </div>
        <p class="area-brief-links" title="${escapeHtml(links)}">
          <span>${escapeHtml(`${connections} / ${evidence}`)}</span>
        </p>
      </details>
    `;
  }

  return `
    <section class="area-brief" aria-label="${escapeHtml(aria)}">
      <p class="area-brief-purpose">
        <b>What this is</b>
        <span>${escapeHtml(truncateText(purpose, 150))}</span>
      </p>
      <div class="area-brief-grid">
        <span class="area-brief-next">
          <b>Next</b>
          <em title="${escapeHtml(next)}">${escapeHtml(truncateText(next, 38))}</em>
        </span>
        <span>
          <b>Signals</b>
          <em>${escapeHtml(truncateText(signals, 28))}</em>
        </span>
        <span>
          <b>Evidence</b>
          <em>${escapeHtml(evidence)}</em>
        </span>
        <span>
          <b>Connections</b>
          <em>${escapeHtml(connections)}</em>
        </span>
      </div>
      <p class="area-brief-links" title="${escapeHtml(links)}">
        <span>${escapeHtml(truncateText(links, 54))}</span>
      </p>
    </section>
  `;
}

function renderProjectWorkspaceList(title, items = []) {
  const rows = asArray(items).slice(0, 4);
  if (rows.length === 0) return "";

  return `
    <div class="project-workspace-list">
      <b>${escapeHtml(title)}</b>
      <ul>
        ${rows.map((item) => `<li title="${escapeHtml(publicText(item))}"><span>${escapeHtml(truncateText(publicText(item), 88))}</span></li>`).join("")}
      </ul>
    </div>
  `;
}

function renderProjectContextUsageLoop(loop = null) {
  if (!loop) return "";

  const nextSafeAction = publicText(loop.nextSafeAction || "Use the existing context before choosing another source.");
  const boundary = publicText(loop.approvalBoundary || "Read-only app context until separately approved.");

  return `
    <section
      class="project-context-usage-loop"
      data-context-usage-id="${escapeHtml(loop.id || "context-usage")}"
      data-browser-writes="${loop.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Context usage loop. Next safe action: ${nextSafeAction}`)}"
    >
      <div class="project-context-usage-head">
        <div>
          <p class="section-kicker">Context usage loop</p>
          <h3 title="${escapeHtml(publicText(loop.title || "Flagship Project context usage loop"))}">${escapeHtml(
            truncateText(publicText(loop.title || "Flagship Project context usage loop"), 48),
          )}</h3>
        </div>
        ${pill(loop.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <p class="project-context-next" title="${escapeHtml(nextSafeAction)}">
        <b>Next safe action</b>
        <span>${escapeHtml(nextSafeAction)}</span>
      </p>
      <div class="project-context-usage-grid">
        ${renderProjectWorkspaceList("Daily loop", loop.dailyLoop)}
        ${renderProjectWorkspaceList("Proof rules", loop.proofRules)}
        ${renderProjectWorkspaceList("Project review prompts", loop.projectReviewPrompts)}
        ${renderProjectWorkspaceList("Limits", loop.limitations)}
      </div>
      <p class="project-command-room-boundary" title="${escapeHtml(boundary)}">
        <b>Approval boundary</b>
        <span>${escapeHtml(truncateText(boundary, 150))}</span>
      </p>
    </section>
  `;
}

function renderProjectCommandRoom(room = null) {
  if (!room) return "";

  const nextActions = asArray(room.nextActions);
  const blockers = asArray(room.blockers);
  const boundary = publicText(room.approvalBoundary || "Read-only until separately approved.");

  return `
    <section
      class="project-command-room"
      data-command-room-id="${escapeHtml(room.id || "command-room")}"
      data-browser-writes="${room.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Project command room. Current milestone: ${publicText(room.currentMilestone)}`)}"
    >
      <div class="project-command-room-head">
        <div>
          <p class="section-kicker">Project command room</p>
          <h3 title="${escapeHtml(publicText(room.currentMilestone))}">${escapeHtml(
            truncateText(publicText(room.currentMilestone || "Current milestone"), 54),
          )}</h3>
        </div>
        ${pill(room.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="project-command-room-grid">
        <p class="project-command-room-strip is-primary">
          <b>Recommended move</b>
          <span title="${escapeHtml(publicText(room.recommendedMove))}">${escapeHtml(
            truncateText(publicText(room.recommendedMove || "Review the next move."), 142),
          )}</span>
        </p>
        <p class="project-command-room-strip">
          <b>Proof status</b>
          <span title="${escapeHtml(publicText(room.proofStatus))}">${escapeHtml(
            truncateText(publicText(room.proofStatus || "No proof status recorded."), 96),
          )}</span>
        </p>
      </div>
      <div class="project-command-room-grid">
        ${renderProjectWorkspaceList("Next actions", nextActions)}
        ${renderProjectWorkspaceList("Blockers", blockers)}
      </div>
      <p class="project-command-room-boundary" title="${escapeHtml(boundary)}">
        <b>Approval boundary</b>
        <span>${escapeHtml(truncateText(boundary, 150))}</span>
      </p>
    </section>
  `;
}

function renderProjectNextStepApproval(approval = null) {
  if (!approval) return "";

  const sourceText = asArray(approval.sourceIds).join(", ") || "none";
  const boundary = publicText(approval.approvalBoundary || "Preview only until separately approved.");
  const undoPath = publicText(approval.undoPath || "Revert this preview before promotion.");
  const notApproved = asArray(approval.notApproved);

  return `
    <section
      class="project-next-step-approval"
      data-next-step-approval-id="${escapeHtml(approval.id || "approval-preview")}"
      data-browser-writes="${approval.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Approval preview. Target: ${approval.target}. Risk: ${approval.risk}. ${boundary}`)}"
    >
      <div class="project-next-step-head">
        <div>
          <p class="section-kicker">Approval preview</p>
          <h3 title="${escapeHtml(approval.title || "Next-step approval")}">${escapeHtml(
            truncateText(approval.title || "Next-step approval", 46),
          )}</h3>
        </div>
        <div class="project-next-step-pills">
          ${pill(publicTitle(approval.mode || "draft-for-approval", "Draft-for-approval"))}
          ${pill(publicTitle(approval.risk || "medium", "Medium"))}
        </div>
      </div>
      <p class="project-next-step-purpose" title="${escapeHtml(publicText(approval.packetPurpose))}">
        <b>Packet purpose</b>
        <span>${escapeHtml(truncateText(publicText(approval.packetPurpose || "Preview the next approval packet."), 140))}</span>
      </p>
      <dl class="project-next-step-grid">
        ${field("Risk", publicTitle(approval.risk || "medium", "Medium"))}
        ${field("Target", approval.target || "none")}
        ${field("Source IDs", sourceText)}
        ${field("Browser", approval.browserWrites === true ? "writes" : "read-only")}
      </dl>
      <details class="project-next-step-detail">
        <summary>
          <span>Decision details</span>
          <small>Risk, undo, limits</small>
        </summary>
        <div class="project-next-step-detail-body">
          <p><b>Recommended move</b><span>${escapeHtml(publicText(approval.recommendedMove || "Review the next move."))}</span></p>
          <p><b>Approval boundary</b><span>${escapeHtml(boundary)}</span></p>
          <p><b>Undo path</b><span>${escapeHtml(undoPath)}</span></p>
          <div class="project-next-step-not-approved">
            <b>Not approved</b>
            <ul>
              ${notApproved.map((item) => `<li>${escapeHtml(publicText(item))}</li>`).join("")}
            </ul>
          </div>
        </div>
      </details>
    </section>
  `;
}

function renderProjectWorkspacePanel(workspace = null) {
  if (!workspace) return "";

  const proof = workspace.linkedProofArtifact || null;
  const objective = publicText(workspace.objective || "No objective recorded.");
  const sourceText = asArray(workspace.sourceIds).join(", ") || "none";

  return `
    <section
      class="project-workspace-panel"
      data-project-workspace-id="${escapeHtml(workspace.id)}"
      data-browser-writes="${workspace.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Project workspace. ${workspace.title}. Objective: ${objective}`)}"
    >
      <div class="project-workspace-head">
        <div>
          <p class="section-kicker">Project workspace</p>
          <h3 title="${escapeHtml(workspace.title)}">${escapeHtml(truncateText(workspace.title, 44))}</h3>
        </div>
        <div class="project-workspace-pills">
          ${pill(workspace.status || "unknown")}
          ${pill(workspace.health || "unknown")}
          ${pill(workspace.browserWrites === true ? "browser writes" : "read-only")}
        </div>
      </div>
      ${renderProjectCommandRoom(workspace.commandRoom)}
      ${renderProjectContextUsageLoop(workspace.contextUsageLoop)}
      ${renderProjectNextStepApproval(workspace.nextStepApproval)}
      <p class="project-workspace-objective">
        <b>Objective</b>
        <span title="${escapeHtml(objective)}">${escapeHtml(truncateText(objective, 150))}</span>
      </p>
      <div class="project-workspace-grid">
        ${renderProjectWorkspaceList("Next actions", workspace.nextActions)}
        ${renderProjectWorkspaceList("Risks", workspace.risks)}
        ${renderProjectWorkspaceList("Approvals", workspace.approvals)}
        ${renderProjectWorkspaceList("Related context", workspace.relatedContext)}
      </div>
      ${
        proof
          ? `<div class="project-workspace-proof">
              <div>
                <b>Linked proof</b>
                <strong title="${escapeHtml(proof.title)}">${escapeHtml(truncateText(proof.title, 42))}</strong>
              </div>
              <span>${escapeHtml(proof.status || "unknown")}</span>
              <span title="${escapeHtml(proof.verification || "verification unknown")}">${escapeHtml(
                truncateText(proof.verification || "verification unknown", 34),
              )}</span>
              <small title="${escapeHtml(proof.boundary || "No boundary recorded.")}">${escapeHtml(
                truncateText(proof.boundary || "No boundary recorded.", 86),
              )}</small>
            </div>`
          : ""
      }
      <p class="project-workspace-sources" title="${escapeHtml(sourceText)}">
        <b>Sources</b>
        <span>${escapeHtml(truncateText(sourceText, 74))}</span>
      </p>
    </section>
  `;
}

function assistantBriefText(value, fallback = "Not recorded.") {
  return publicText(value || fallback)
    .replace(/\bsource-backed\b/gi, "sourced")
    .replace(/\bvisual gravity\b/gi, "map weight")
    .replace(/\bdistricts?\b/gi, "areas")
    .replace(/\bnodes?\b/gi, "items")
    .replace(/\s+/g, " ")
    .trim();
}

function assistantMiniLabel(brief = {}) {
  const move = assistantBriefText(brief.shortRecommendation || brief.recommendation || "Review next move", "Review next move");
  return `Your move / ${truncateText(move, 42)}`;
}

function assistantTaskToken(...values) {
  return values.map((value) => assistantBriefText(value)).join(" ").match(/\bTASK-\d{3}\b/)?.[0] || "";
}

function assistantBriefAria(brief = {}) {
  const nextSlice = brief.nextSlice ? `${brief.nextSlice.id} ${brief.nextSlice.title}` : "No next slice recorded";
  return [
    "Your move.",
    `Situation: ${assistantBriefText(brief.situation)}`,
    `Recommended move: ${assistantBriefText(brief.recommendation)}`,
    `Next slice: ${assistantBriefText(nextSlice)}`,
    `Why it matters: ${assistantBriefText(brief.reason)}`,
    `Approval boundary: ${assistantBriefText(brief.boundary)}`,
  ].join(" ");
}

function roadmapCandidateStatus(candidate = {}) {
  if (candidate.recommended) return "Recommended";
  if (candidate.requiresUserInput) return "Needs decision";
  return publicTitle(candidate.status || "Candidate", "Candidate");
}

function renderRoadmapCandidates(candidates = []) {
  const items = asArray(candidates);
  if (items.length === 0) return "";

  return `
    <section class="assistant-roadmap" aria-label="Next slices">
      <div class="assistant-roadmap-head">
        <p class="section-kicker">Next slices</p>
        <strong>${escapeHtml(publicCountLabel(items.length, "choice"))}</strong>
      </div>
      <div class="assistant-roadmap-list">
        ${items
          .slice(0, 5)
          .map((candidate) => {
            const status = roadmapCandidateStatus(candidate);
            const sourceText = asArray(candidate.sourceIds).join(", ") || "none";
            return `
              <article class="assistant-roadmap-card" data-roadmap-id="${escapeHtml(candidate.id)}">
                <div>
                  <b>${escapeHtml(candidate.id)}</b>
                  <strong title="${escapeHtml(candidate.title)}">${escapeHtml(truncateText(candidate.title, 42))}</strong>
                </div>
                ${pill(status)}
                <p>${escapeHtml(truncateText(candidate.reason || candidate.nextAction, 110))}</p>
                <dl class="assistant-roadmap-meta">
                  ${field("Risk", publicTitle(candidate.risk || "medium", "medium"))}
                  ${field("Decision", candidate.requiresUserInput ? "Needs decision" : "Local")}
                  ${field("Sources", sourceText)}
                </dl>
                <div class="assistant-roadmap-detail">
                  <b>Boundary</b>
                  <span>${escapeHtml(candidate.requiresUserInput ? "approval needed" : "local review")}</span>
                  <p>${escapeHtml(truncateText(candidate.boundary || "No boundary recorded.", 130))}</p>
                  <p>${escapeHtml(truncateText(candidate.nextAction || "Review this candidate before implementation.", 130))}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderAssistantBrief(brief = {}) {
  if (!brief) return "";

  const primaryDrawer = brief.primaryDrawer || "actions";
  const secondaryDrawer = brief.secondaryDrawer || "approvals";
  const nextSlice = brief.nextSlice || null;
  const situation = assistantBriefText(brief.situation, "Local state is loaded.");
  const recommendation = assistantBriefText(brief.recommendation, "Review the next move.");
  const reason = assistantBriefText(brief.reason, "The assistant keeps the next move explicit.");
  const route = assistantBriefText(brief.route, "Open Details and use Next steps.");
  const boundary = assistantBriefText(brief.boundary, "No browser writes or external actions.");
  const shortMove = assistantBriefText(brief.shortRecommendation || recommendation, "Review next move");
  const task = assistantTaskToken(recommendation, situation);
  const nextSliceLabel = nextSlice ? `${nextSlice.id} ${nextSlice.title}` : "No next slice recorded";
  const visibleSituation = task ? `${task} ready` : truncateText(situation, 30);
  const visibleRecommendation = task ? `Review ${task}` : truncateText(shortMove, 32);
  const visibleNextSlice = nextSlice ? nextSlice.id : "No choice";

  return `
    <section
      class="assistant-brief"
      data-assistant-brief-id="${escapeHtml(brief.id || "assistant:brief")}"
      data-browser-writes="${brief.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(assistantBriefAria(brief))}"
    >
      <div class="assistant-brief-head">
        <div>
          <p class="section-kicker">Your move</p>
          <h3 title="${escapeHtml(recommendation)}">${escapeHtml(truncateText(shortMove, 44))}</h3>
        </div>
        ${pill(brief.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="assistant-brief-grid">
        <span>
          <b>Situation</b>
          <em title="${escapeHtml(situation)}">${escapeHtml(visibleSituation)}</em>
        </span>
        <span>
          <b>Recommended move</b>
          <em title="${escapeHtml(recommendation)}">${escapeHtml(visibleRecommendation)}</em>
        </span>
        <span>
          <b>Next slice</b>
          <em title="${escapeHtml(nextSliceLabel)}">${escapeHtml(truncateText(visibleNextSlice, 34))}</em>
        </span>
        <span>
          <b>Choices</b>
          <em>${escapeHtml(publicCountLabel(asArray(brief.roadmapCandidates).length, "option"))}</em>
        </span>
      </div>
      <p class="assistant-boundary" title="${escapeHtml(boundary)}">
        <b>Boundary</b>
        <span>Local only</span>
      </p>
      <details class="assistant-route-detail">
        <summary>
          <span>Why</span>
          <small>More</small>
        </summary>
        <div class="assistant-route-body">
          <p><b>Why it matters</b><span>${escapeHtml(reason)}</span></p>
          <p><b>What opens next</b><span>${escapeHtml(route)}</span></p>
          <p><b>Approval boundary</b><span>${escapeHtml(boundary)}</span></p>
          ${renderRoadmapCandidates(brief.roadmapCandidates)}
          <div class="assistant-brief-route">
            <button class="assistant-route-button" type="button" data-assistant-route="${escapeHtml(primaryDrawer)}">
              Open Next steps
            </button>
            <button class="assistant-route-button is-secondary" type="button" data-assistant-route="${escapeHtml(secondaryDrawer)}">
              Open Reviews
            </button>
          </div>
        </div>
      </details>
    </section>
  `;
}

function brainAssistantItems(items = []) {
  const rows = asArray(items).slice(0, 4);
  if (rows.length === 0) return '<li class="empty-note">No local behavior context available.</li>';

  return rows.map((item) => `<li title="${escapeHtml(publicText(item))}">${escapeHtml(truncateText(publicText(item), 118))}</li>`).join("");
}

function renderBrainAssistantBehavior(panel = null) {
  if (!panel) return "";

  const sourceText = asArray(panel.sourceIds).join(", ") || "local state";
  const recommendedMove = publicText(panel.recommendedMove || "Review the next behavior slice.");
  const permissionBoundary = publicText(panel.permissionBoundary || "Read-only. No browser writes.");

  return `
    <section
      class="brain-assistant-panel"
      data-brain-assistant-id="${escapeHtml(panel.id || "brain-assistant-behavior")}"
      data-browser-writes="${panel.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${panel.title || "Brain Assistant Behavior"}. Recommended move: ${recommendedMove}`)}"
    >
      <div class="brain-assistant-head">
        <div>
          <p class="section-kicker">Brain / Assistant</p>
          <h3 title="${escapeHtml(panel.title || "Brain / Assistant Behavior")}">${escapeHtml(
            truncateText(publicText(panel.title || "Brain / Assistant Behavior"), 42),
          )}</h3>
        </div>
        ${pill(panel.mode || "read-only")}
      </div>
      <p class="brain-assistant-move" title="${escapeHtml(recommendedMove)}">
        <b>Recommended move</b>
        <span>${escapeHtml(truncateText(recommendedMove, 126))}</span>
      </p>
      <div class="brain-assistant-grid">
        <section class="brain-assistant-section">
          <b>What I know</b>
          <ul>${brainAssistantItems(panel.whatIKnow)}</ul>
        </section>
        <section class="brain-assistant-section">
          <b>Evidence</b>
          <ul>${brainAssistantItems(panel.evidence)}</ul>
        </section>
        <section class="brain-assistant-section">
          <b>Permission boundary</b>
          <p title="${escapeHtml(permissionBoundary)}">${escapeHtml(truncateText(permissionBoundary, 150))}</p>
        </section>
        <section class="brain-assistant-section">
          <b>Limits</b>
          <ul>${brainAssistantItems(panel.limits)}</ul>
        </section>
      </div>
      <p class="brain-assistant-sources" title="${escapeHtml(sourceText)}">
        <b>Sources</b>
        <span>${escapeHtml(truncateText(sourceText, 92))}</span>
      </p>
    </section>
  `;
}

function renderSystemHomeCockpit(cockpit = null) {
  if (!cockpit) return "";

  const sections = asArray(cockpit.sections);
  const sourceText = asArray(cockpit.sourceIds).join(", ") || "local state";

  return `
    <details
      class="system-home-cockpit"
      data-system-home-id="${escapeHtml(cockpit.id || "system-home-cockpit")}"
      data-browser-writes="${cockpit.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${cockpit.title || "System Home"}: ${cockpit.nextSafeAction || "Review Home."}`)}"
    >
      <summary class="system-home-summary">
        <b>System Home</b>
        <span>Today</span>
        <span>Projects</span>
        <span>Approvals</span>
        <span>Brain</span>
        <span>Routines</span>
        <span>Assistant</span>
        <em>Next safe action</em>
      </summary>
      <div class="system-home-body">
      <div class="system-home-head">
        <div>
          <p class="section-kicker">System Home</p>
          <h3>${escapeHtml(publicTitle(cockpit.title || "System Home Cockpit", "System Home Cockpit"))}</h3>
          <small title="${escapeHtml(cockpit.subtitle || "Read-only operating front door")}">${escapeHtml(
            truncateText(cockpit.subtitle || "Read-only operating front door", 54),
          )}</small>
        </div>
        ${pill(cockpit.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="system-home-detail">
        <div class="system-home-detail-summary">
          <span>Today</span>
          <span>Projects</span>
          <span>Approvals</span>
          <span>Brain</span>
          <span>Routines</span>
          <span>Assistant</span>
        </div>
        <div class="system-home-grid">
          ${sections
            .slice(0, 6)
            .map(
              (section) => `
                <article class="system-home-tile" data-home-section="${escapeHtml(section.id || section.title || "section")}">
                  <div class="system-home-tile-head">
                    <b>${escapeHtml(publicTitle(section.title || "Section", "Section"))}</b>
                    ${pill(section.status || "ready")}
                  </div>
                  <strong title="${escapeHtml(section.signal || "No signal recorded.")}">${escapeHtml(
                    truncateText(section.signal || "No signal recorded.", 42),
                  )}</strong>
                  <p title="${escapeHtml(section.detail || "No detail recorded.")}">${escapeHtml(
                    truncateText(section.detail || "No detail recorded.", 96),
                  )}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="system-home-next">
        <p>
          <b>Next safe action</b>
          <span title="${escapeHtml(cockpit.nextSafeAction || "Review Home.")}">${escapeHtml(
            truncateText(cockpit.nextSafeAction || "Review Home.", 44),
          )}</span>
        </p>
        <div class="system-home-boundary">
          <div>
            <span>Boundary</span>
            <small title="${escapeHtml(sourceText)}">sources listed</small>
          </div>
          <p>${escapeHtml(cockpit.approvalBoundary || "Read-only. No browser writes.")}</p>
        </div>
      </div>
      </div>
    </details>
  `;
}

function renderTodayCommandSurface(surface = null) {
  if (!surface) return "";

  const sections = asArray(surface.sections);
  const currentGate = surface.currentGate || "No gate recorded";
  const currentGateToken = currentGate.match(/\bTASK-\d{3}\b/)?.[0] || truncateText(currentGate, 20);
  const sourceText = asArray(surface.sourceIds).join(", ") || "local state";

  return `
    <details
      class="today-command-surface"
      data-today-command-id="${escapeHtml(surface.id || "today-command-surface")}"
      data-browser-writes="${surface.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`${surface.title || "Today Command"}: ${surface.safeNextMove || "Review Today."}`)}"
    >
      <summary class="today-command-summary">
        <b>Today</b>
        <span title="${escapeHtml(currentGate)}">${escapeHtml(currentGateToken)}</span>
        <em>Next</em>
      </summary>
      <div class="today-command-body">
        <div class="today-command-grid">
          ${sections
            .slice(0, 4)
            .map(
              (section) => `
                <article class="today-command-card" data-today-section="${escapeHtml(section.id || section.title || "section")}">
                  <div class="today-command-card-head">
                    <b>${escapeHtml(publicTitle(section.title || "Section", "Section"))}</b>
                    ${pill(section.status || "ready")}
                  </div>
                  <strong title="${escapeHtml(section.signal || "No signal recorded.")}">${escapeHtml(
                    truncateText(section.signal || "No signal recorded.", 42),
                  )}</strong>
                  <p title="${escapeHtml(section.detail || "No detail recorded.")}">${escapeHtml(
                    truncateText(section.detail || "No detail recorded.", 88),
                  )}</p>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="today-command-next">
          <p>
            <b>Safe next move</b>
            <span title="${escapeHtml(surface.safeNextMove || "Review Today.")}">${escapeHtml(
              truncateText(surface.safeNextMove || "Review Today.", 72),
            )}</span>
          </p>
          <details class="today-command-boundary">
            <summary>
              <span>Boundary</span>
              <small title="${escapeHtml(sourceText)}">sources listed</small>
            </summary>
            <p>${escapeHtml(surface.approvalBoundary || "Read-only. No browser writes.")}</p>
          </details>
        </div>
      </div>
    </details>
  `;
}

function renderSpatialCommandOverlay(root, overlay = null) {
  if (!root) return;
  if (!overlay) {
    root.innerHTML = "";
    return;
  }

  const cards = asArray(overlay.cards)
    .slice(0, 3)
    .map(
      (card) => `
        <article class="spatial-command-point">
          <span>${escapeHtml(card.label || "Signal")}</span>
          <b title="${escapeHtml(card.detail || card.value || "")}">${escapeHtml(truncateText(card.value || "Ready", 18))}</b>
          <small title="${escapeHtml(card.detail || "")}">${escapeHtml(truncateText(card.detail || "", 34))}</small>
        </article>
      `,
    )
    .join("");

  root.innerHTML = `
    <section
      class="spatial-command-card"
      data-spatial-command-id="${escapeHtml(overlay.id || "spatial-command-overlay")}"
      data-browser-writes="${overlay.browserWrites ? "true" : "false"}"
      tabindex="0"
      aria-label="${escapeHtml(`${overlay.title || "Today"}: ${overlay.currentGate || "No current gate"}`)}"
    >
      <div class="spatial-command-head">
        <span>${escapeHtml(overlay.title || "Today")}</span>
        <strong title="${escapeHtml(overlay.currentGate || "")}">${escapeHtml(
          truncateText(overlay.currentGate || "No gate recorded", 34),
        )}</strong>
        <em>Map command</em>
      </div>
      <div class="spatial-command-grid">
        ${cards}
      </div>
      <p class="spatial-command-route">${escapeHtml(overlay.route || "Open Details for evidence and actions.")}</p>
    </section>
  `;
}

export function renderCommandDeck({
  model,
  region,
  selectedRelationship = null,
  related = [],
  reviewDraftPreview = null,
  focus = {},
}) {
  const activeTasks = asArray(model?.activeTasks);
  const pendingReviews = asArray(model?.pendingReviews);
  const resolvedReviews = asArray(model?.resolvedReviews);
  const reviewQueue = model?.reviewQueue || { pending: pendingReviews, resolved: resolvedReviews };
  const regions = asArray(model?.regions);
  const graphWarnings = asArray(model?.graph?.warnings);
  const evidenceSubject = selectedRelationship || region;
  const scope = cockpitScope(model, selectedRelationship);
  const safeActions = asArray(evidenceSubject?.safeActions);
  const actionCount = safeActions.length;
  const relationshipCount = asArray(related).length;
  const proofPackage = model?.proofPackage;
  const sourceCount = asArray(evidenceSubject?.evidenceTrail?.records).length;
  const scopeLabel = publicScopeLabel(scope, model);
  const decisionCard = decisionCardModel(reviewQueue, graphWarnings);
  const hasBlockingDecision = decisionCard.tone !== "clear";
  const nextActionText = hasBlockingDecision
    ? decisionCard.action || focus.nextAction || region.nextAction || "No next action available"
    : focus.nextAction || region.nextAction || decisionCard.action || "No next action available";
  const nextActionDisplay = conciseNextAction(nextActionText, region, hasBlockingDecision, safeActions);
  const shouldShowDecisionCard = hasBlockingDecision;
  const nowText = publicSubtitle(region);
  const briefLabel = `Viewing: ${nowText}. Next: ${nextActionDisplay}. Context: ${publicText(nextActionText)}`;
  const priorityMetric = commandPriorityMetric({
    activeTaskCount: activeTasks.length,
    pendingReviewCount: pendingReviews.length,
    relationshipCount,
    sourceCount,
  });
  const fullRegionTitle = publicTitle(region.title || region.id || "Untitled focus", "Untitled focus");
  const compactRegionTitle = compactEntityTitle({ ...region, title: fullRegionTitle }, "Untitled focus");
  const deckTitle = hasBlockingDecision ? decisionCard.title || compactRegionTitle : compactRegionTitle;
  const fullDeckTitle = hasBlockingDecision ? decisionCard.title || fullRegionTitle : fullRegionTitle;
  const deckKicker = hasBlockingDecision ? "Review needed" : scopeLabel;
  const deckContext = model?.assistantBrief ? "Map" : model?.activeDistrictId ? "Inside area" : "Map overview";
  const areaBrief = areaBriefModel({
    model,
    region,
    selectedRelationship,
    related,
    sourceCount,
    relationshipCount,
    activeTaskCount: activeTasks.length,
    pendingReviewCount: pendingReviews.length,
    hasBlockingDecision,
    decisionCard,
    nextActionDisplay,
    nextActionText,
    scopeLabel,
  });
  if (model?.assistantBrief) areaBrief.compact = true;
  const shouldShowSystemHome = Boolean(model?.systemHomeCockpit && !model?.activeDistrictId && !selectedRelationship);
  const secondaryPanels = [
    model?.brainAssistantBehavior
      ? secondaryCommandPanel(
          "assistant-behavior",
          "Assistant behavior",
          model.brainAssistantBehavior.mode || "read-only",
          renderBrainAssistantBehavior(model.brainAssistantBehavior),
        )
      : "",
    proofPackage
      ? secondaryCommandPanel("proof", "Proof artifact", proofPackage.status || "local", renderProofPackagePanel(proofPackage))
      : "",
    secondaryCommandPanel(
      "relationships",
      "Connections",
      `${relationshipCount} visible`,
      `<section class="inspector-section"><p class="section-kicker">Connections</p>${renderRelationshipList(
        related,
        selectedRelationship?.id,
      )}</section>`,
    ),
    secondaryCommandPanel(
      "system",
      "System status",
      model?.phase || "unknown",
      `<section class="inspector-section">
        <p class="section-kicker">Status</p>
        <dl class="system-readout system-readout-grid">
          ${field("Active tasks", activeTasks.length)}
          ${field("Pending reviews", pendingReviews.length)}
          ${field("Resolved reviews", resolvedReviews.length)}
            ${field("Areas", regions.length)}
        </dl>
        <details class="system-integrity-detail">
          <summary>
            <span>Health check</span>
            <small>${escapeHtml(`${graphWarnings.length} map warning${graphWarnings.length === 1 ? "" : "s"}`)}</small>
          </summary>
          <dl class="system-integrity-grid">
          ${field("Phase", model?.phase || "unknown")}
          ${field("Updated", model?.updatedAt || "unknown")}
            ${field("Health warnings", graphWarnings.length)}
          </dl>
        </details>
      </section>`,
    ),
  ].filter(Boolean);

  return `
    <section class="command-deck" data-cockpit-scope="${escapeHtml(scope)}">
      ${renderDistrictFocusSummary(model)}

      <section class="inspector-section inspector-lede command-deck-primary mission-control-panel" data-command-priority="primary">
        <div class="command-deck-header">
          <div>
            <p class="section-kicker">${escapeHtml(deckKicker)}</p>
            <h2 title="${escapeHtml(fullDeckTitle)}" aria-label="${escapeHtml(fullDeckTitle)}">${escapeHtml(
              truncateText(deckTitle, 42),
            )}</h2>
            <small class="command-deck-context" title="${escapeHtml(deckContext)}">${escapeHtml(truncateText(deckContext, 40))}</small>
          </div>
          <div class="command-deck-status">
            ${statusDot(region.status)}
            ${statusDot(region.health)}
            ${statusDot(scopeLabel)}
          </div>
        </div>

        ${shouldShowDecisionCard ? renderDecisionCard(decisionCard, { hideTitle: true }) : ""}

        ${renderAssistantBrief(model?.assistantBrief)}

        ${shouldShowSystemHome ? "" : renderAreaBrief(areaBrief)}

        ${renderProjectWorkspacePanel(region.projectWorkspace)}

        ${
          model?.assistantBrief
            ? ""
            : `<div class="cockpit-brief command-line-brief" title="${escapeHtml(briefLabel)}" aria-label="${escapeHtml(briefLabel)}">
                <span>Viewing</span>
                <strong>${escapeHtml(truncateText(nowText, 24))}</strong>
                <span>Next</span>
                <strong>${escapeHtml(truncateText(nextActionDisplay, 34))}</strong>
              </div>`
        }

        <details class="command-metrics-detail">
          <summary>
            <span>Status</span>
            <small>${escapeHtml(priorityMetric)}</small>
          </summary>
          <dl class="cockpit-metrics">
            ${field("Signals", activeTasks.length)}
            ${field("Approvals", pendingReviews.length)}
            ${field("Connections", relationshipCount)}
            ${field("Evidence", sourceCount)}
          </dl>
        </details>
      </section>

      <div class="command-deck-drawers" aria-label="Detail drawers">
        ${
          selectedRelationship
            ? drawer("relationship", "Connection", "Focused path", renderSelectedRelationship(model, selectedRelationship), true)
            : ""
        }
        ${drawer("sources", "Evidence", drawerCountLabel(sourceCount, "source"), renderEvidenceTrail(evidenceSubject))}
        ${drawer(
          "actions",
          "Next steps",
          `${actionCount} routes`,
          `${renderSafeActions(evidenceSubject)}${renderReviewDraftPreview(reviewDraftPreview)}`,
        )}
        ${drawer(
          "approvals",
          "Reviews",
          approvalDrawerMeta(pendingReviews.length, resolvedReviews.length),
          renderApprovalQueueRail(reviewQueue),
        )}
        ${drawer(
          "more",
          "Details",
          `${secondaryPanels.length} more`,
          `<div class="secondary-command-stack">${secondaryPanels.join("")}</div>`,
        )}
      </div>
    </section>
  `;
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

export function renderSafeActions(subject) {
  const actions = asArray(subject?.safeActions);
  if (actions.length === 0) {
    return `
      <section class="inspector-section safe-actions">
        <p class="section-kicker">Next steps</p>
        <p class="empty-note">No next steps available for this focus.</p>
      </section>
    `;
  }
  const actionFlow = actionFlowModel(actions);
  const visibleActions = actions.slice(0, 2);
  const overflowActions = actions.slice(2);

  return `
    <section class="inspector-section safe-actions">
      <p class="section-kicker">Next steps</p>
      ${renderActionFlowPanel(actionFlow)}
      <details class="action-routes-detail">
        <summary>
          <span>Steps</span>
          <small>${escapeHtml(actions.length)}</small>
        </summary>
        <ul class="action-route-list">
          ${visibleActions.map(renderActionRoute).join("")}
        </ul>
        ${
          overflowActions.length === 0
            ? ""
            : `
              <details class="action-overflow-detail">
                <summary>
                  <span>More steps</span>
                  <small>${overflowActions.length}</small>
                </summary>
                <ul class="action-route-list action-route-overflow-list">
                  ${overflowActions.map(renderActionRoute).join("")}
                </ul>
              </details>
            `
        }
      </details>
    </section>
  `;
}

export function renderReviewDraftPreview(preview) {
  if (!preview) return "";

  const sourceIds = asArray(preview.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";

  return `
    <section class="inspector-section review-draft-preview" data-review-preview-status="${escapeHtml(
      preview.status || "draft-preview",
    )}">
      <p class="section-kicker">Review packet preview</p>
      <h3>${escapeHtml(preview.summary || "Draft review packet")}</h3>
      <p class="review-preview-notice">
        <strong>Preview only.</strong>
        ${escapeHtml(preview.preview_notice || "The browser did not write reviews/queue.json.")}
      </p>
      <dl class="review-packet-grid">
        ${field("ID", preview.id || "preview")}
        ${field("Status", preview.status || "draft-preview")}
        ${field("Action", preview.action_type || "draft_review_item")}
        ${field("Target", preview.target_file || "reviews/queue.json")}
        ${field("Approval", preview.approval_mode || "draft-for-approval")}
        ${field("Risk", preview.risk || "medium")}
        ${field("Requires approval", preview.requires_explicit_approval === false ? "no" : "yes")}
        ${field("Browser writes", preview.browser_writes === true ? "yes" : "no")}
        ${field("Sources", sourceText)}
        ${field("Source trust", preview.source_trust || "unknown")}
        ${field("Sensitivity", preview.sensitivity || "unknown")}
        ${field("Created", preview.created_at || "preview-only")}
      </dl>
      <p>${escapeHtml(preview.diff_summary || "No diff summary available.")}</p>
      ${renderResolutionGuide(preview)}
    </section>
  `;
}

function renderResolutionGuide(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const decisionCopy =
    review.revision_reason ||
    review.resolution_reason ||
    review.approval_text ||
    review.approval_reason ||
    review.reason ||
    "Choose approve, revise, or reject with an explicit review id, target, risk, source ids, and undo path.";
  const undoPath = review.undo_path || "State the undo path before any approval is accepted.";

  return `
    <div class="review-resolution-guide">
      <p class="resolution-title">Resolution guide</p>
      <div class="resolution-options" aria-label="Review resolution choices">
        <span><strong>Approve</strong> when target, risk, sources, and undo path are correct.</span>
        <span><strong>Revise</strong> when wording, evidence, or approval copy needs tightening.</span>
        <span><strong>Reject</strong> when the packet is off-scope or would mutate beyond the queue.</span>
      </div>
      <dl class="resolution-detail-grid">
        ${field("Decision copy", decisionCopy)}
        ${field("Source trust", review.source_trust || review.sourceTrust || "unknown")}
        ${field("Browser preview", review.browser_preview_id || review.browserPreviewId || review.id || "none")}
        ${field("Undo path", undoPath)}
        ${field("Sources", sourceText)}
      </dl>
      <p class="resolution-boundary">
        Queue-only decision. No state, wiki, memory, source, browser, finance, contacts, raw-source, or external mutation is included.
      </p>
    </div>
  `;
}

function normalizeReviewQueue(reviews) {
  if (reviews && typeof reviews === "object" && !Array.isArray(reviews)) {
    return {
      pending: asArray(reviews.pending),
      resolved: asArray(reviews.resolved),
    };
  }

  const allReviews = asArray(reviews);
  return {
    pending: allReviews.filter((review) => review?.status === "pending"),
    resolved: allReviews.filter(
      (review) =>
        review?.status !== "pending" &&
        (review?.resolution_status || review?.resolution_decision || review?.resolved_at),
    ),
  };
}

function reviewTargetText(review = {}) {
  const packet = review || {};
  return packet.target_file || packet.targetFile || "No write target";
}

function reviewSourceText(review = {}) {
  const packet = review || {};
  const sourceIds = asArray(packet.source_ids || packet.sourceIds || packet.resolution_source_ids);
  return sourceIds.length > 0 ? sourceIds.join(", ") : "No evidence ids";
}

function reviewUndoText(review = {}) {
  const packet = review || {};
  return packet.undo_path || packet.undoPath || "Undo path must be stated before approval.";
}

function approvalFlowModel(reviews) {
  const { pending: pendingReviews, resolved: resolvedReviews } = normalizeReviewQueue(reviews);
  const review = pendingReviews[0] || null;
  const sourceCount = asArray(review?.source_ids || review?.sourceIds).length;

  return {
    review,
    pendingCount: pendingReviews.length,
    resolvedCount: resolvedReviews.length,
    risk: review?.risk || "clear",
    target: reviewTargetText(review),
    sourceCount,
    browserWrites: review?.browser_writes === true || review?.browserWrites === true,
  };
}

function renderApprovalFlowPanel(flow = {}) {
  const review = flow.review || {};
  const title = review.summary || review.id || "No pending review";
  const sourceLabel = `${flow.sourceCount || 0}`;

  return `
    <div class="approval-flow-panel" aria-label="${escapeHtml(
      `Review decision. ${flow.pendingCount || 0} pending. ${title}.`,
    )}">
      <div class="approval-flow-head">
        <p class="section-kicker">Review decision</p>
        <strong>Approve / Revise / Reject</strong>
        <span>${escapeHtml(`${flow.pendingCount || 0} pending`)}</span>
      </div>
      <div class="approval-flow-grid">
        <span><b>Risk</b><em>${escapeHtml(flow.risk || "clear")}</em></span>
        <span><b>Target</b><em>${escapeHtml(truncateText(flow.target || "No write target", 20))}</em></span>
        <span><b>Sources</b><em>${escapeHtml(sourceLabel)}</em></span>
        <span><b>Browser writes</b><em>${escapeHtml(browserWriteLabel(flow.browserWrites))}</em></span>
      </div>
      <details class="approval-flow-detail">
        <summary>
          <span>Undo path</span>
          <small>Open</small>
        </summary>
        <dl class="approval-flow-meta">
          ${field("Target", reviewTargetText(review))}
          ${field("Sources", reviewSourceText(review))}
          ${field("Undo path", reviewUndoText(review))}
        </dl>
      </details>
      <p class="approval-flow-boundary">Queue only.</p>
    </div>
  `;
}

function renderApprovalCard(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const sourceSignal = `${sourceIds.length} src`;
  const targetSignal = review.target_file || review.targetFile || "no target";
  const decisionCopy =
    review.decision_copy ||
    review.resolution_prompt ||
    "Choose approve, revise, or reject with explicit review id, target, risk, source ids, and undo path.";
  const diffSummary = review.diff_summary || review.diffSummary || "No diff summary available.";
  const reviewTitle = review.summary || review.id || "Pending review";

  return `
    <article class="approval-queue-card is-pending" data-review-id="${escapeHtml(
      review.id || "review",
    )}" title="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}" aria-label="${escapeHtml(`${reviewTitle}. ${diffSummary}`)}">
      <div class="approval-card-summary">
        <div class="approval-card-head">
          <strong>${escapeHtml(truncateText(reviewTitle, 34))}</strong>
          ${pill(review.risk || "unknown")}
        </div>
        <p class="approval-card-signal">${escapeHtml(`${targetSignal} / ${sourceSignal}`)}</p>
      </div>
      <details class="approval-metadata-detail">
        <summary>
          <span>Review metadata</span>
          <small>${escapeHtml(truncateText(targetSignal, 26))}</small>
        </summary>
        <dl class="approval-card-grid approval-metadata-grid">
          ${field("ID", review.id || "review")}
          ${field("Target", review.target_file || review.targetFile || "none")}
          ${field("Review mode", review.approval_mode || review.approvalMode || "unknown")}
          ${field("Sources", sourceText)}
        </dl>
      </details>
      <details class="approval-card-detail">
        <summary>
          <span>Decision copy</span>
          <small title="${escapeHtml(decisionCopy)}">Open</small>
        </summary>
        ${renderResolutionGuide(review)}
      </details>
    </article>
  `;
}

function renderResolutionOutcome(review = {}) {
  const sourceIds = asArray(review.source_ids || review.sourceIds || review.resolution_source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const decision = review.resolution_decision || review.status || "resolved";
  const reason =
    review.resolution_reason ||
    review.rejection_reason ||
    review.approval_reason ||
    "No resolution reason recorded.";

  return `
    <article class="approval-queue-card is-resolved" data-review-id="${escapeHtml(
      review.id || "review",
    )}" data-resolution-status="${escapeHtml(review.resolution_status || review.status || "resolved")}">
      <div class="approval-card-head">
        <strong>${escapeHtml(review.summary || review.id || "Resolved review")}</strong>
        ${pill(review.resolution_status || review.status || "resolved")}
      </div>
      <dl class="approval-card-grid">
        ${field("ID", review.id || "review")}
        ${field("Status", review.status || "resolved")}
        ${field("Decision", decision)}
        ${field("Resolved", review.resolved_at || "unknown")}
        ${field("By", review.resolved_by || "unknown")}
        ${field("Target", review.target_file || review.targetFile || "none")}
        ${field("Browser preview", review.browser_preview_id || review.browserPreviewId || "none")}
        ${field("Source trust", review.source_trust || review.sourceTrust || "unknown")}
        ${field("Sources", sourceText)}
        ${field("Revision", review.revision_reason || "none")}
        ${field("Undo path", review.undo_path || "No undo path recorded.")}
      </dl>
      <div class="review-resolution-outcome">
        <p class="resolution-title">Resolution outcome</p>
        <p>${escapeHtml(reason)}</p>
        <p class="resolution-boundary">
          Queue-level outcome only. Downstream state, wiki, memory, source, browser, finance, contacts, raw-source, and external actions still require a separate approval.
        </p>
      </div>
    </article>
  `;
}

export function renderApprovalQueueRail(reviews) {
  const { pending: pendingReviews, resolved: resolvedReviews } = normalizeReviewQueue(reviews);
  const approvalFlow = approvalFlowModel({ pending: pendingReviews, resolved: resolvedReviews });

  if (pendingReviews.length === 0 && resolvedReviews.length === 0) {
    return `
      <section class="inspector-section approval-queue-rail" data-approval-count="0" data-resolution-count="0">
        <p class="section-kicker">Review queue</p>
        ${renderApprovalFlowPanel(approvalFlow)}
        <p class="empty-note">No pending reviews or resolved review outcomes visible.</p>
      </section>
    `;
  }

  return `
    <section class="inspector-section approval-queue-rail" data-approval-count="${escapeHtml(
      pendingReviews.length,
    )}" data-resolution-count="${escapeHtml(resolvedReviews.length)}">
      <p class="section-kicker">Review queue</p>
      ${renderApprovalFlowPanel(approvalFlow)}
      <details class="approval-packets-detail">
        <summary>
          <span>Packets</span>
          <small>${escapeHtml(pendingReviews.length + resolvedReviews.length)}</small>
        </summary>
        ${
          pendingReviews.length === 0
            ? '<p class="empty-note">No pending reviews visible.</p>'
            : `<div class="approval-queue-list">${pendingReviews.map(renderApprovalCard).join("")}</div>`
        }
        ${
          resolvedReviews.length === 0
            ? ""
            : `
              <details class="approval-history-drawer">
                <summary>
                  <span class="approval-outcome-title">Resolved outcomes</span>
                  <small>${resolvedReviews.length} archived decision${resolvedReviews.length === 1 ? "" : "s"}</small>
                </summary>
                <div class="approval-history-list approval-queue-list">${resolvedReviews.map(renderResolutionOutcome).join("")}</div>
              </details>
            `
        }
      </details>
    </section>
  `;
}

export function renderProofPackagePanel(proofPackage) {
  if (!proofPackage) return "";

  const sourceIds = asArray(proofPackage.sourceIds || proofPackage.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const capabilities = asArray(proofPackage.capabilities).slice(0, 5);
  const limitations = asArray(proofPackage.limitations).slice(0, 4);
  const boundary = proofPackage.boundary || "No proof-package boundary recorded.";

  return `
    <section class="inspector-section proof-package-panel proof-artifact-dossier" data-proof-package-status="${escapeHtml(
      proofPackage.status || "unknown",
    )}">
      <p class="section-kicker">Evidence package</p>
      <div class="proof-package-head">
        <h3>${escapeHtml(proofPackage.title || "Private proof package")}</h3>
        ${pill(proofPackage.status || "unknown")}
      </div>

      <div class="proof-summary-strip">
        <dl class="artifact-stat-strip">
          ${field("Status", proofPackage.status || "unknown")}
        ${field("Verification", proofPackage.verification || "unknown")}
        ${field("Gate", proofPackage.currentGate || "unknown")}
      </dl>
      </div>

      ${renderProofLauncherPanel(proofPackage)}

      <details class="proof-detail-drawer proof-dossier-detail">
        <summary>
          <span>What is included</span>
          <small>${escapeHtml(proofPackage.privacy || "private local package")}</small>
        </summary>
        <div class="proof-detail-body proof-dossier-body">
          ${
            capabilities.length === 0
              ? ""
              : `
                <details class="proof-detail-drawer proof-capabilities-detail">
                  <summary>
                    <span>What it proves</span>
                    <small>${capabilities.length} proven result${capabilities.length === 1 ? "" : "s"}</small>
                  </summary>
                  <div class="proof-detail-body">
                    <div class="proof-capability-rail">
                      ${capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}
                    </div>
                  </div>
                </details>
              `
          }
          <details class="proof-detail-drawer">
            <summary>
              <span>Local files</span>
              <small>${escapeHtml(proofPackage.privacy || "private local package")}</small>
            </summary>
            <div class="proof-detail-body">
              <dl class="proof-package-grid proof-path-grid">
                ${field("ID", proofPackage.id || "unknown")}
                ${field("Privacy", proofPackage.privacy || "private-local")}
                ${field("Package", proofPackage.artifactPath || "none")}
                ${field("Review doc", proofPackage.reviewDoc || "none")}
                ${field("Smoke", proofPackage.smokeScript || "none")}
                ${field("Demo", proofPackage.browserDemo || "none")}
                ${field("Sources", sourceText)}
              </dl>
            </div>
          </details>
          ${
            limitations.length === 0
              ? ""
              : `
                <details class="proof-detail-drawer">
                  <summary>
                    <span>Limitations</span>
                    <small>${limitations.length} recorded constraint${limitations.length === 1 ? "" : "s"}</small>
                  </summary>
                  <div class="proof-detail-body">
                    <ul class="proof-limitations">${limitations
                      .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
                      .join("")}</ul>
                  </div>
                </details>
              `
          }
          <details class="proof-detail-drawer">
            <summary>
              <span>Approval limit</span>
              <small>${escapeHtml(proofPackage.privacy || "private local only")}</small>
            </summary>
            <div class="proof-detail-body">
              <div class="proof-boundary-strip">
                <strong>Approval limit</strong>
                <span>${escapeHtml(boundary)}</span>
              </div>
            </div>
          </details>
        </div>
      </details>
      <p class="proof-next-action proof-next-action-compact">
        <strong>Open when needed</strong>
        <span>Open details only when needed.</span>
      </p>
    </section>
  `;
}

function renderProofLauncherPanel(proofPackage) {
  const launcher = proofPackage.launcher || proofPackage;
  const sourceIds = asArray(launcher.sourceIds || proofPackage.sourceIds || proofPackage.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const reviewCommand = launcher.reviewCommand || proofPackage.reviewCommand || "No review command available";
  const demoCommand = launcher.demoCommand || proofPackage.demoCommand || "No demo command available";
  const smokeCommand = launcher.smokeCommand || proofPackage.smokeCommand || "No smoke command available";
  const boundary = launcher.launcherBoundary || proofPackage.launcherBoundary || "Read-only launcher. No writes from browser.";
  const safePath = launcher.safeLaunchPath || proofPackage.safeLaunchPath || "Review package before running any local demo.";

  const launcherAction = (title, detail, commandText) => `
    <article class="proof-launcher-action">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(detail)}</strong>
      <code>${escapeHtml(commandText)}</code>
    </article>
  `;

  return `
    <section class="proof-launcher-panel" data-proof-launcher-id="${escapeHtml(
      launcher.id || proofPackage.id || "proof",
    )}" aria-label="${escapeHtml(`Read-only launcher for ${proofPackage.title || "proof artifact"}`)}">
      <div class="proof-launcher-head">
        <div>
          <p class="section-kicker">Read-only launcher</p>
          <h4>${escapeHtml(proofPackage.title || "Private proof package")}</h4>
        </div>
        ${pill(proofPackage.privacy || "private-local")}
      </div>
      <p class="proof-launcher-boundary">${escapeHtml(boundary)}</p>
      <div class="proof-launcher-actions" aria-label="Local proof launcher actions">
        ${launcherAction("Review package", proofPackage.reviewDoc || "Review doc", reviewCommand)}
        ${launcherAction("Local demo", proofPackage.browserDemo || "Browser demo", demoCommand)}
        ${launcherAction("Copy command", "Smoke check", smokeCommand)}
      </div>
      <details class="proof-detail-drawer proof-launcher-detail" data-proof-launcher-detail>
        <summary>
          <span>Usage path</span>
          <small>No writes from browser</small>
        </summary>
        <div class="proof-detail-body">
          <dl class="proof-package-grid proof-path-grid">
            ${field("Safe path", safePath)}
            ${field("Sources", sourceText)}
            ${field("Package", proofPackage.artifactPath || "none")}
            ${field("Approval limit", proofPackage.boundary || "Private local only")}
          </dl>
        </div>
      </details>
    </section>
  `;
}

function districtSummaryBrief(summary = {}) {
  const nodeCount = Number.isFinite(summary.nodeCount) ? summary.nodeCount : 0;
  const relationshipCount = Number.isFinite(summary.relationshipCount) ? summary.relationshipCount : 0;
  const sourceBacked = Number.isFinite(summary.sourceBackedRelationshipCount) ? summary.sourceBackedRelationshipCount : 0;
  const anchor = summary.anchorTitle || "No active anchor";
  return `${publicCountLabel(nodeCount, "item")} / ${publicCountLabel(
    relationshipCount,
    "connection",
  )} / ${sourceBacked} sourced / ${anchor}`;
}

function districtSummaryLabel(summary = {}, fullSummary = "") {
  const title = publicTitle(summary.title || "Area", "Area");
  const scope = publicText(summary.scope || "area");
  return `${title}: ${scope}. ${districtSummaryBrief(summary)}. ${fullSummary}`;
}

export function renderDistrictFocusSummary(model) {
  const summary = model?.activeDistrictSummary;
  if (!summary) return "";

  const dominantTypes = asArray(summary.dominantTypes);
  const typeText = dominantTypes.length > 0 ? dominantTypes.map(publicTypeLabel).join(" / ") : "mixed";
  const fullSummary = publicText(summary.summary || "No area summary available.");
  const briefText = districtSummaryBrief(summary);
  const summaryTitle = publicTitle(summary.title || "Area", "Area");

  return `
    <section class="inspector-section district-focus-summary" data-inspector-scope="${escapeHtml(
      summary.scope || "district",
    )}" title="${escapeHtml(fullSummary)}" aria-label="${escapeHtml(districtSummaryLabel(summary, fullSummary))}">
      <div class="district-focus-head">
        <div>
          <p class="section-kicker">Area focus</p>
          <h2>${escapeHtml(summaryTitle)}</h2>
        </div>
        <div class="district-focus-status">
          ${statusDot(summary.permissionMode || "suggest-only")}
          ${statusDot(summary.approvalStatus || "approved")}
        </div>
      </div>
      <p class="district-focus-brief" title="${escapeHtml(fullSummary)}">${escapeHtml(truncateText(briefText, 54))}</p>
      <details class="district-summary-detail">
        <summary>
          <span>Area details</span>
          <small>${escapeHtml(truncateText(summary.anchorTitle || "No active anchor", 28))}</small>
        </summary>
        <div class="district-summary-detail-body">
          <p>${escapeHtml(fullSummary)}</p>
          <dl class="district-summary-grid">
            ${field("Items", summary.nodeCount ?? 0)}
            ${field("Connections", summary.relationshipCount ?? 0)}
            ${field("Sourced links", summary.sourceBackedRelationshipCount ?? 0)}
            ${field("Visible links", summary.visualRelationshipCount ?? 0)}
            ${field("Primary anchor", summary.anchorTitle || "No active anchor")}
          </dl>
          <p class="district-type-row">${escapeHtml(typeText)}</p>
        </div>
      </details>
    </section>
  `;
}

function instrumentSignalForRegion(region, fallback = "No current block available") {
  if (!region) return fallback;

  if (region.type === "district") {
    return `${publicTitle(region.title || "Home", "Home")} / ${publicSubtitle(region)}`;
  }

  return publicText(region.nextAction || publicSubtitle(region) || region.title || fallback);
}

function currentBlockText(model, selectedId) {
  const selectedRegion = asArray(model?.regions).find((region) => region.id === selectedId);
  const isAtlasOverview = !model?.activeDistrictId && selectedRegion?.type === "district";

  if (isAtlasOverview) {
    const districtCount = asArray(model?.regions).filter((region) => region.type === "district").length;
    return `Home / ${publicCountLabel(districtCount, "area")}`;
  }

  return instrumentSignalForRegion(
    selectedRegion || model?.currentFocus,
    model?.instruments?.currentBlock || "No current block available",
  );
}

function currentBlockAccessibleText(model, selectedId) {
  if (model?.assistantBrief) {
    return assistantBriefAria(model.assistantBrief);
  }

  const selectedRegion = asArray(model?.regions).find((region) => region.id === selectedId);
  const visibleText = currentBlockText(model, selectedId);
  const fullContext =
    selectedRegion?.nextAction ||
    selectedRegion?.summary ||
    selectedRegion?.subtitle ||
    model?.instruments?.currentBlock ||
    visibleText;

  const translatedContext = publicText(fullContext);
  if (!translatedContext || translatedContext === visibleText) return visibleText;
  return `${visibleText}: ${translatedContext}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function pulseLabel(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function titleTokens(value) {
  return String(value || "").match(/[a-z0-9]+/gi) || [];
}

function railGlyphCandidate(regionTitle) {
  const tokens = titleTokens(regionTitle);
  if (tokens.length === 0) return "??";

  const digitToken = tokens.find((token) => /\d/.test(token));
  if (tokens.length > 1 && digitToken) {
    const digits = digitToken.replace(/\D/g, "");
    return `${tokens[0].slice(0, 1)}${digits || digitToken.slice(0, 1)}`.toUpperCase().slice(0, 3);
  }

  if (tokens.length > 1) {
    return tokens.map((token) => token.slice(0, 1)).join("").toUpperCase().slice(0, 3);
  }

  return tokens[0].slice(0, 2).toUpperCase();
}

function railGlyph(regionTitle, usedGlyphs) {
  const tokens = titleTokens(regionTitle);
  const base = railGlyphCandidate(regionTitle);
  const word = tokens[0] || base;
  const candidates = [
    base,
    `${word.slice(0, 1)}${word.slice(-1)}`.toUpperCase(),
    word.slice(0, 3).toUpperCase(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!usedGlyphs.has(candidate)) {
      usedGlyphs.add(candidate);
      return candidate;
    }
  }

  let suffix = 2;
  while (usedGlyphs.has(`${base.slice(0, 1)}${suffix}`)) {
    suffix += 1;
  }
  const fallback = `${base.slice(0, 1)}${suffix}`;
  usedGlyphs.add(fallback);
  return fallback;
}

function systemPulseItems(model) {
  const signalCount = asArray(model?.activeTasks).length;
  const approvalCount = asArray(model?.pendingReviews).length;
  const outcomeCount = asArray(model?.resolvedReviews).length;
  const regionCount = asArray(model?.regions).length;

  return [
    ["signals", pulseLabel(signalCount, "Task"), signalCount],
    ["approvals", pulseLabel(approvalCount, "Approval"), approvalCount],
    ["outcomes", pulseLabel(outcomeCount, "Outcome"), outcomeCount],
    ["areas", pulseLabel(regionCount, "Area"), regionCount],
  ];
}

function decisionPulseItems(items) {
  const approvals = items.find(([kind]) => kind === "approvals");
  const signals = items.find(([kind]) => kind === "signals");

  if (approvals?.[2] > 0) {
    return [approvals, signals].filter((item) => item && item[2] > 0).slice(0, 2);
  }

  if (signals?.[2] > 0) return [signals];

  return [["clear", "Clear", 0]];
}

function pulseDisplayLabel(label, value) {
  return value > 0 ? `${value} ${label.toLowerCase()}` : label;
}

function renderSystemPulse(root, model) {
  if (!root) return;

  if (!model) {
    root.innerHTML = '<span class="system-pulse-chip" data-pulse-kind="loading"><b>--</b><em>State</em></span>';
    if (typeof root.setAttribute === "function") root.setAttribute("aria-label", "State unavailable");
    if (typeof root.querySelectorAll !== "function" && "textContent" in root) root.textContent = "-- State";
    return;
  }

  const items = systemPulseItems(model);
  const visibleItems = decisionPulseItems(items);
  const diagnosticLabel = items.map(([, label, value]) => `${value} ${label.toLowerCase()}`).join(", ");
  if (typeof root.setAttribute === "function") {
    root.setAttribute("aria-label", diagnosticLabel);
    root.setAttribute("title", diagnosticLabel);
  }
  root.innerHTML = visibleItems
    .map(([kind, label, value]) => {
      const fullLabel = pulseDisplayLabel(label, value);
      return `
        <span
          class="system-pulse-chip"
          data-pulse-kind="${escapeHtml(kind)}"
          title="${escapeHtml(fullLabel)}"
          aria-label="${escapeHtml(fullLabel)}"
        >
          ${value > 0 ? `<b>${escapeHtml(value)}</b>` : ""}
          <em>${escapeHtml(value > 0 ? label.toLowerCase() : label)}</em>
        </span>
      `;
    })
    .join("");
  if (typeof root.querySelectorAll !== "function" && "textContent" in root) {
    root.textContent = visibleItems.map(([, label, value]) => pulseDisplayLabel(label, value)).join(" ");
  }
}

export function renderWorldOrientation(root, model, selectedId) {
  if (!root) return;

  const regions = asArray(model?.regions);
  const relationships = asArray(model?.relationships);
  const activeDistrict = model?.activeDistrict || null;
  const selected = selectedRegion(model, selectedId);
  const isDistrict = Boolean(model?.activeDistrictId && activeDistrict);
  const districtCount = isDistrict ? 0 : regions.filter((region) => region.type === "district").length;
  const title = isDistrict ? publicTitle(activeDistrict.title || activeDistrict.id || "Area", "Area") : "Home";
  const kicker = isDistrict ? "Area" : "Home";
  const meta = isDistrict
    ? `${pluralize(regions.length, "item")} / ${pluralize(relationships.length, "connection")}`
    : `${pluralize(districtCount, "area")} / ${pluralize(relationships.length, "connection")}`;
  const compactMeta = meta;
  const focus = isDistrict
    ? publicTitle(selected?.title || activeDistrict.title, title)
    : publicTitle(selected?.title || model?.currentFocus?.title || "Home", "Home");
  const orientationLabel = `${kicker}: ${title}. ${meta}. Focus: ${focus}`;

  root.innerHTML = `
    <section class="orientation-chip" data-world-scope="${escapeHtml(
      isDistrict ? "district" : "atlas",
    )}" title="${escapeHtml(orientationLabel)}" aria-label="${escapeHtml(orientationLabel)}">
      <span>${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(compactMeta)}</small>
    </section>
  `;
}

export function renderRegionList(root, model, selectedId) {
  if (!root) return;

  const regions = asArray(model?.regions);
  if (regions.length === 0) {
    root.innerHTML = '<p class="empty-note">No areas available.</p>';
    return;
  }

  const usedGlyphs = new Set();
  const primaryRegions = regions.slice(0, ATLAS_RAIL_REST_LIMIT);
  const selectedRegionItem = regions.find((region) => region.id === selectedId);
  if (selectedRegionItem && !primaryRegions.some((region) => region.id === selectedRegionItem.id)) {
    primaryRegions.push(selectedRegionItem);
  }
  const primaryIds = new Set(primaryRegions.map((region) => region.id));
  const overflowRegions = regions.filter((region) => !primaryIds.has(region.id));
  const railOverflowCount = overflowRegions.length;

  const renderRailButton = (region, isOverflow = false) => {
    const activeClass = region.id === selectedId ? " is-active" : "";
    const color = safeColor(region.color);
    const regionTitle = publicTitle(region.title || region.id || "Untitled area", "Untitled area");
    const regionSubtitle = publicSubtitle(region);
    return `
      <button
        class="region-button${activeClass}"
        type="button"
        data-region-id="${escapeHtml(region.id)}"
        data-region-type="${escapeHtml(region.type || "region")}"
        data-rail-overflow="${isOverflow ? "true" : "false"}"
        title="${escapeHtml(regionTitle)}"
        aria-label="${escapeHtml(`Open ${regionTitle}. ${regionSubtitle}`)}"
        style="--region-color: ${escapeHtml(color)}"
      >
        <span class="region-dot"></span>
        <span class="region-glyph" aria-hidden="true">${escapeHtml(railGlyph(regionTitle, usedGlyphs))}</span>
        <span class="region-copy">
          <strong>${escapeHtml(truncateText(regionTitle, 28))}</strong>
          <small>${escapeHtml(truncateText(regionSubtitle, 26))}</small>
        </span>
      </button>
    `;
  };

  const primaryButtons = primaryRegions.map((region) => renderRailButton(region)).join("");
  const overflowDetail =
    railOverflowCount > 0
      ? `
        <details class="rail-more-detail">
          <summary>
            <span>More areas</span>
            <small>${escapeHtml(railOverflowCount)}</small>
          </summary>
          <div class="rail-more-list">
            ${overflowRegions.map((region) => renderRailButton(region, true)).join("")}
          </div>
        </details>
      `
      : "";

  root.innerHTML = `
    <section class="rail-section" aria-label="Start here">
      <div class="rail-section-label">Start here</div>
      ${primaryButtons}
    </section>
    ${overflowDetail}
  `;
}

export function renderWorldLabels(root, nodes, focusInput = {}) {
  if (!root) return;

  const stage = measuredStage(root);
  const focusContext = normalizeFocusContext(focusInput);
  const labels = layoutWorldLabels(asArray(nodes), stage, focusContext);

  if (root.querySelectorAll && root.ownerDocument?.createElement) {
    renderWorldLabelsDom(root, labels);
    return;
  }

  renderWorldLabelsString(root, labels);
}

export function renderDistrictBreadcrumb(root, model) {
  if (!root) return;

  const activeDistrict = model?.activeDistrict;
  if (!activeDistrict) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <button class="breadcrumb-chip" type="button" data-district-exit="true">Home</button>
    <span aria-hidden="true">/</span>
    <button class="breadcrumb-chip is-active" type="button" data-district-id="${escapeHtml(activeDistrict.id)}">
      ${escapeHtml(publicTitle(activeDistrict.title || activeDistrict.id || "Area", "Area"))}
    </button>
  `;
}

export function renderInspector(root, model, selectedId, selectedRelationshipId = null, reviewDraftPreview = null) {
  if (!root) return;

  const region = selectedRegion(model, selectedId);
  const selectedRelationship = relationshipById(model, selectedRelationshipId);
  const focus = model?.activeDistrict
    ? { title: "Area view", nextAction: model.activeDistrict.summary }
    : model?.currentFocus || region || {};
  const related = selectedRelationship
    ? [selectedRelationship, ...relationshipsForRegion(model, region, selectedId).filter((item) => item.id !== selectedRelationship.id)]
    : relationshipsForRegion(model, region, selectedId);
  const instruments = model?.instruments || {};
  const activeTasks = asArray(model?.activeTasks);
  const pendingReviews = asArray(model?.pendingReviews);
  const resolvedReviews = asArray(model?.resolvedReviews);
  const reviewQueue = model?.reviewQueue || { pending: pendingReviews, resolved: resolvedReviews };
  const regions = asArray(model?.regions);
  const graphWarnings = asArray(model?.graph?.warnings);
  const evidenceSubject = selectedRelationship || region;

  if (!region) {
    root.innerHTML = `
      <section class="inspector-section">
        <p class="section-kicker">Details</p>
        <h2>No area selected</h2>
        <p class="empty-note">Load state to inspect focus, constraints, and system status.</p>
      </section>
    `;
    return;
  }

  root.innerHTML = renderCommandDeck({
    model,
    region,
    selectedRelationship,
    related,
    reviewDraftPreview,
    focus: {
      ...focus,
      nextAction: focus.nextAction || region.nextAction || instruments.currentBlock || "No current step available",
    },
  });
}

export function renderInstruments(elements, model, selectedId, selectedRelationshipId = null, reviewDraftPreview = null) {
  if (elements?.systemPulse) {
    renderSystemPulse(elements.systemPulse, model);
  }

  if (elements?.currentBlock) {
    const canRenderAssistantMini =
      model?.assistantBrief &&
      typeof elements.currentBlock.querySelectorAll === "function" &&
      typeof elements.currentBlock.setAttribute === "function";
    if (canRenderAssistantMini) {
      const miniLabel = assistantMiniLabel(model.assistantBrief);
      elements.currentBlock.innerHTML = `
        <span class="assistant-spine-mini" title="${escapeHtml(assistantBriefAria(model.assistantBrief))}" aria-label="${escapeHtml(
          assistantBriefAria(model.assistantBrief),
        )}">
          <b>Your move</b>
          <span>${escapeHtml(truncateText(miniLabel.replace(/^Your move\s*\/\s*/i, ""), 58))}</span>
        </span>
      `;
    } else {
      elements.currentBlock.textContent = currentBlockText(model, selectedId);
    }
    elements.currentBlock.title = currentBlockAccessibleText(model, selectedId);
    elements.currentBlock.setAttribute?.("aria-label", currentBlockAccessibleText(model, selectedId));
  }

  if (elements?.modeStrip) {
    const modes = asArray(model?.instruments?.modes);
    const visibleModes = modes.slice(0, 3);
    const overflowCount = Math.max(0, modes.length - visibleModes.length);
    elements.modeStrip.innerHTML = visibleModes
      .map((mode, index) => {
        const activeClass = index === 0 ? " is-active" : "";
        const modeLabel = String(mode || "Mode");
        return `<button class="mode-button${activeClass}" type="button" title="${escapeHtml(modeLabel)}" aria-label="${escapeHtml(modeLabel)}">${escapeHtml(truncateText(modeLabel, 9))}</button>`;
      })
      .join("");
    if (overflowCount > 0) {
      elements.modeStrip.innerHTML += `<span class="mode-overflow-chip" aria-label="${escapeHtml(
        `${overflowCount} more modes`,
      )}">+${escapeHtml(overflowCount)}</span>`;
    }
  }

  renderSpatialCommandOverlay(elements?.spatialCommandOverlay, model?.spatialCommandOverlay);
  renderWorldOrientation(elements?.worldOrientation, model, selectedId);
  renderRegionList(elements?.regionList, model, selectedId);
  renderInspector(elements?.inspector, model, selectedId, selectedRelationshipId, reviewDraftPreview);
}
