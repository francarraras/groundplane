import { assistantBriefAria, assistantMiniLabel, renderSpatialCommandOverlay } from "./assistant-panels.js";
import { renderCommandDeck } from "./command-deck.js";
import { asArray, escapeHtml, pluralize, publicCountLabel, publicSubtitle, publicText, publicTitle, pulseLabel, safeColor, selectedRegion, truncateText } from "./helpers.js";
import { relationshipById, relationshipsForRegion } from "./relationships.js";
import { renderMapLegend } from "../mapLegend.js";

const ATLAS_RAIL_REST_LIMIT = 7;

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
  renderMapLegend(elements?.mapLegend, model);
  renderRegionList(elements?.regionList, model, selectedId);
  renderInspector(elements?.inspector, model, selectedId, selectedRelationshipId, reviewDraftPreview);
}
