import { asArray, clamp, escapeHtml, finiteMetric, finitePosition, positiveFinite, publicTitle, publicTypeLabel, safeColor, truncateText } from "./helpers.js";

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
