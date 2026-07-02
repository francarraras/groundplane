import { loadProductState } from "./state.js";
import { buildDistrictWorldModel, buildFocusContext, buildSurfaceModel } from "./viewModel.js";
import { buildWorldNodes, createWorldScene } from "./world.js";
import { createCommandPalette } from "./commands.js";
import { buildReviewDraftPreview } from "./reviewDraft.js";
import { renderDistrictBreadcrumb, renderInstruments, renderInspector, renderWorldLabels } from "./instruments.js";
import { buildContextBundle, serializeContextBundle } from "./contextBundle.js";

const elements = {
  app: document.querySelector("#product-app"),
  regionList: document.querySelector("#region-list"),
  worldRoot: document.querySelector("#world-root"),
  worldLabels: document.querySelector("#world-labels"),
  districtBreadcrumb: document.querySelector("#district-breadcrumb"),
  worldOrientation: document.querySelector("#world-orientation"),
  focusCard: document.querySelector("#focus-card"),
  spatialCommandOverlay: document.querySelector("#spatial-command-overlay"),
  systemPulse: document.querySelector("#system-pulse"),
  runCurrentBlock: document.querySelector("#run-current-block"),
  currentBlock: document.querySelector("#current-block"),
  modeStrip: document.querySelector("#mode-strip"),
  inspector: document.querySelector("#inspector"),
  commandBar: document.querySelector("#command-bar"),
  commandInput: document.querySelector("#command-input"),
  commandShell: document.querySelector("#command-palette"),
  paletteInput: document.querySelector("#palette-input"),
  paletteResults: document.querySelector("#palette-results"),
  atlasHome: document.querySelector("#atlas-home"),
  inspectorToggle: document.querySelector("#toggle-inspector"),
  exportContext: document.querySelector("#export-context"),
  home: document.querySelector("#home-world"),
  zoomIn: document.querySelector("#zoom-in-world"),
  zoomOut: document.querySelector("#zoom-out-world"),
  orbitLeft: document.querySelector("#orbit-left-world"),
  orbitRight: document.querySelector("#orbit-right-world"),
  relationPrev: document.querySelector("#relation-prev-world"),
  relationNext: document.querySelector("#relation-next-world"),
};

let baseModel = null;
let model = null;
let activeDistrictId = null;
let selectedId = null;
let selectedRelationshipId = null;
let hoveredId = null;
let world = null;
let latestWorldLabels = [];
let activeReviewDraftPreview = null;
let activeProofLauncherId = null;
let inspectorCollapsed = true;
let sourceCatalog = [];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function publicUiText(value = "") {
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

function publicUiTitle(value, fallback = "Current focus") {
  const text = String(value || fallback)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  const isSlugLike = /^[a-z0-9\s]+$/.test(text) && text === text.toLowerCase();
  if (!isSlugLike) return publicUiText(text);
  return publicUiText(text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()));
}

function findRegion(regionId) {
  return asArray(model?.regions).find((region) => region.id === regionId) || null;
}

function findDistrict(districtId) {
  return asArray(baseModel?.districts).find((district) => district.id === districtId) || null;
}

function findRelationship(relationshipId) {
  return asArray(model?.relationships).find((relationship) => relationship.id === relationshipId) || null;
}

function findProjectWorkspace(routeId) {
  return (
    asArray(baseModel?.projectWorkspaces).find((workspace) => workspace.id === routeId || workspace.graphId === routeId) ||
    asArray(model?.projectWorkspaces).find((workspace) => workspace.id === routeId || workspace.graphId === routeId) ||
    null
  );
}

function districtForRegion(regionId) {
  return asArray(baseModel?.districts).find((district) => asArray(district.nodeIds).includes(regionId)) || null;
}

function relationNavigationTargets() {
  if (!model || !selectedId) return [];
  const relationships = asArray(model.relationships);
  return relationships.filter((relationship) => relationship?.from === selectedId || relationship?.to === selectedId);
}

function adjacentRelationship(direction) {
  const relationships = relationNavigationTargets();
  if (relationships.length === 0) return null;

  const currentIndex = selectedRelationshipId ? relationships.findIndex((relationship) => relationship.id === selectedRelationshipId) : -1;
  const baseIndex = currentIndex >= 0 ? currentIndex : direction < 0 ? 0 : -1;
  const nextIndex = (baseIndex + direction + relationships.length) % relationships.length;
  return relationships[nextIndex] || null;
}

function syncRelationNavigation() {
  const updateButton = (button, direction, fallbackLabel) => {
    if (!button) return;

    const relationship = adjacentRelationship(direction);
    const title = relationship
      ? `${fallbackLabel}: ${publicUiText(relationship.title || relationship.id || "connection")}`
      : `No ${fallbackLabel.toLowerCase()} path`;
    button.disabled = !relationship;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.dataset.navState = relationship ? "available" : "disabled";
  };

  updateButton(elements.relationPrev, -1, "Previous connection");
  updateButton(elements.relationNext, 1, "Next connection");
}

function syncInspectorVisibility() {
  const state = inspectorCollapsed ? "collapsed" : "expanded";
  const label = inspectorCollapsed ? "Show Details" : "Hide Details";
  elements.app?.setAttribute("data-inspector-state", state);

  if (!elements.inspectorToggle) return;
  elements.inspectorToggle.setAttribute("aria-label", label);
  elements.inspectorToggle.setAttribute("title", label);
  elements.inspectorToggle.setAttribute("aria-pressed", inspectorCollapsed ? "false" : "true");
  elements.inspectorToggle.dataset.toggleState = inspectorCollapsed ? "idle" : "pressed";
}

function openCommandDrawer(kind) {
  const actionsDrawer = elements.inspector?.querySelector("[data-drawer-kind=\"actions\"]");
  const drawer = kind === "actions" ? actionsDrawer : elements.inspector?.querySelector(`[data-drawer-kind="${kind}"]`);
  if (!drawer) return null;

  if (kind === "actions") actionsDrawer?.setAttribute("open", "");
  else drawer.setAttribute("open", "");
  drawer.dataset.drawerState = "open";

  const summary = drawer.querySelector("summary");
  summary?.setAttribute("data-drawer-state", "open");

  const state = drawer.querySelector(".drawer-state");
  if (state) state.textContent = "-";

  return drawer;
}

function startCurrentStep() {
  if (!model) return;

  inspectorCollapsed = false;
  syncInspectorVisibility();
  renderInstruments(elements, model, selectedId, selectedRelationshipId, activeReviewDraftPreview);

  const drawer = openCommandDrawer("actions");
  const focusNextStep = () => {
    const focusTarget = drawer?.querySelector("summary");
    focusTarget?.focus?.({ preventScroll: true });
  };

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focusNextStep);
  else focusNextStep();

  const region = findRegion(selectedId) || model.currentFocus || null;
  setFocusCard(region, "Next steps are open in Details.");

  if (elements.systemPulse) {
    elements.systemPulse.textContent = "Next steps open";
  }
}

function currentActionSubject() {
  return findRelationship(selectedRelationshipId) || findRegion(selectedId) || model?.currentFocus || null;
}

function findActionRoute(actionRouteId) {
  const subject = currentActionSubject();
  return asArray(subject?.safeActions).find((action) => action.id === actionRouteId) || null;
}

function setActionRouteStatus(action) {
  if (!action) return;

  const subject = currentActionSubject();
  const region = findRegion(selectedId) || model?.currentFocus || null;
  const isAllowed = action.allowed === true;
  if (!isAllowed || action.browserWrites !== false) return;

  activeReviewDraftPreview =
    action.actionType === "draft_review_item" ? buildReviewDraftPreview(subject, action) : null;

  const routeKind = action.mode === "draft-for-approval" ? "Draft route" : isAllowed ? "Safe route" : "Locked route";
  const detail = action.browserWrites
    ? "Blocked: browser writes are not allowed in this phase."
    : action.routeSummary || action.label || "No route summary available.";

  renderInstruments(elements, model, selectedId, selectedRelationshipId, activeReviewDraftPreview);

  if (elements.systemPulse) {
    elements.systemPulse.textContent = `${routeKind}: ${action.label || action.actionType}`;
  }

  setFocusCard(region, detail, subject?.from ? subject : null);
}

function syncProofLauncherState() {
  if (!elements.app) return;
  if (activeProofLauncherId) {
    elements.app.setAttribute("data-proof-launcher-id", activeProofLauncherId);
    return;
  }
  elements.app.removeAttribute("data-proof-launcher-id");
}

function findProofArtifact(routeId) {
  const normalizedRoute = String(routeId || "");
  const artifactId = normalizedRoute.startsWith("proof-launcher:")
    ? normalizedRoute.replace(/^proof-launcher:/, "")
    : normalizedRoute;
  return asArray(model?.proofArtifacts).find(
    (artifact) => artifact.id === artifactId || artifact.launcherRouteId === normalizedRoute,
  );
}

function proofRegionFor(artifact) {
  return findRegion(`proof_artifact:${artifact?.id}`) || findRegion(artifact?.id) || model?.currentFocus || asArray(model?.regions)[0] || null;
}

function openProofLauncherDrawers() {
  const moreDrawer = openCommandDrawer("more");
  const proofDetail = moreDrawer?.querySelector('[data-secondary-kind="proof"]');
  proofDetail?.setAttribute("open", "");
  proofDetail?.querySelector("[data-proof-launcher-detail]")?.setAttribute("open", "");
}

function openAssistantRoute(drawerKind = "actions", options = {}) {
  const normalizedKind = drawerKind === "approvals" || drawerKind === "more" || drawerKind === "sources" ? drawerKind : "actions";
  const drawer = openCommandDrawer(normalizedKind);
  const focusRoute = () => {
    const target = drawer?.querySelector("summary");
    target?.focus?.({ preventScroll: true });
  };

  if (options.focus !== false) {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focusRoute);
    else focusRoute();
  }

  return drawer;
}

function openAssistantBrief(options = {}) {
  if (!model?.assistantBrief) return false;

  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();
  inspectorCollapsed = false;
  syncInspectorVisibility();
  renderInstruments(elements, model, selectedId, selectedRelationshipId, activeReviewDraftPreview);
  openAssistantRoute(model.assistantBrief.primaryDrawer, options);
  setFocusCard(findRegion(selectedId) || model.currentFocus || null, model.assistantBrief.recommendation || "Assistant Brief is open.");
  if (elements.systemPulse) elements.systemPulse.textContent = "Assistant Brief open";
  return true;
}

function launchProofArtifact(routeId) {
  routeId = String(routeId || "");
  if (!routeId.startsWith("proof-launcher:")) return false;

  const artifact = findProofArtifact(routeId);
  if (!artifact) return false;

  activeProofLauncherId = artifact.id;
  syncProofLauncherState();
  activeReviewDraftPreview = null;
  inspectorCollapsed = false;
  syncInspectorVisibility();

  const region = proofRegionFor(artifact);
  selectedId = region?.id || selectedId;
  selectedRelationshipId = null;
  hoveredId = null;
  const focusContext = applyFocusState();
  openProofLauncherDrawers();
  setFocusCard(region, artifact.safeLaunchPath || "Read-only proof launcher is open.");
  if (elements.systemPulse) elements.systemPulse.textContent = "Proof launcher open";
  if (focusContext.selectedId) world?.focus(focusContext.selectedId);
  return true;
}

function selectProjectWorkspace(routeId, options = {}) {
  const workspace = findProjectWorkspace(String(routeId || ""));
  if (!workspace?.graphId) return false;

  const district = districtForRegion(workspace.graphId);
  if (district && activeDistrictId !== district.id) {
    enterDistrict(district.id);
  }

  inspectorCollapsed = false;
  syncInspectorVisibility();
  selectRegion(workspace.graphId, { ...options, allowDistrictEnter: false });
  const region = findRegion(workspace.graphId);
  setFocusCard(region, workspace.nextActions?.[0] || "Project workspace open.");
  if (elements.systemPulse) elements.systemPulse.textContent = "Project workspace open";
  return true;
}

function currentFocusContext() {
  return buildFocusContext(model, selectedId, hoveredId, selectedRelationshipId);
}

function compactFocusText(value, maxLength = 52) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function focusBeaconDetailText(region, fallback = "", relationship = null) {
  if (relationship) {
    return `${relationship.fromTitle || relationship.from} -> ${relationship.toTitle || relationship.to}`;
  }

  if (region?.type === "district") {
    return [publicUiText(region.subtitle), region.status].filter(Boolean).join(" / ") || "Area";
  }

  return publicUiText(region?.subtitle || fallback || region?.nextAction || "No next action available");
}

function setFocusCard(region, fallback = "", relationship = null) {
  if (!elements.focusCard) return;

  if (!region) {
    elements.focusCard.classList.remove("is-visible");
    elements.focusCard.removeAttribute("title");
    elements.focusCard.removeAttribute("aria-label");
    elements.focusCard.replaceChildren();
    return;
  }

  const title = document.createElement("strong");
  title.textContent = relationship ? "Connection" : publicUiTitle(region.title || region.id || "Current focus");

  const detail = document.createElement("span");
  const fullDetailText = relationship
    ? `${relationship.fromTitle || relationship.from} -> ${relationship.toTitle || relationship.to}`
    : publicUiText(region.nextAction || region.subtitle || fallback || "No next action available");
  const detailText = focusBeaconDetailText(region, fallback, relationship);
  detail.textContent = compactFocusText(detailText, 34);

  const focusLabel = `${title.textContent}: ${fullDetailText}`;
  elements.focusCard.title = focusLabel;
  elements.focusCard.setAttribute("aria-label", focusLabel);

  elements.focusCard.replaceChildren(title, detail);
  elements.focusCard.classList.add("is-visible");
}

function applyFocusState() {
  const focusContext = currentFocusContext();
  renderInstruments(elements, model, focusContext.selectedId, focusContext.selectedRelationshipId, activeReviewDraftPreview);
  syncRelationNavigation();
  renderLabels(latestWorldLabels);
  world?.setFocusState(focusContext);
  return focusContext;
}

function selectRegion(regionId, options = {}) {
  if (!model) return;

  if (regionId === "district:exit") {
    exitDistrict();
    return;
  }

  if (findDistrict(regionId) && options.allowDistrictEnter !== false) {
    enterDistrict(regionId);
    return;
  }

  const region = findRegion(regionId) || model.currentFocus || asArray(model.regions)[0] || null;
  selectedId = region?.id || null;
  selectedRelationshipId = null;
  hoveredId = null;
  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();
  const focusContext = applyFocusState();
  setFocusCard(region);
  if (options.focus !== false && focusContext.selectedId) {
    world?.focus(focusContext.selectedId);
  }
}

function selectRelationship(relationshipId, options = {}) {
  if (!model) return false;

  const relationship = findRelationship(relationshipId);
  if (!relationship) return false;

  const endpointId = findRegion(relationship.from) ? relationship.from : relationship.to;
  const region = findRegion(endpointId) || model.currentFocus || asArray(model.regions)[0] || null;
  selectedId = region?.id || endpointId || null;
  selectedRelationshipId = relationship.id;
  hoveredId = null;
  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();
  const focusContext = applyFocusState();
  setFocusCard(region, relationship.evidence, relationship);
  if (options.focus !== false && focusContext.selectedId) {
    world?.focus(focusContext.selectedId);
  }
  return true;
}

function selectTarget(targetId, options = {}) {
  if (targetId === "assistant:brief") {
    openAssistantBrief(options);
    return;
  }
  if (selectProjectWorkspace(targetId, options)) return;
  if (launchProofArtifact(targetId)) return;
  if (selectRelationship(targetId, options)) return;
  selectRegion(targetId, options);
}

function hoverRegion(regionId) {
  if (!model) return;

  hoveredId = findRegion(regionId) ? regionId : null;
  applyFocusState();

  const region = findRegion(hoveredId);
  if (region) {
    setFocusCard(region);
    return;
  }

  setFocusCard(findRegion(selectedId) || model.currentFocus || null);
}

const commandPalette = createCommandPalette({
  shell: elements.commandShell,
  input: elements.paletteInput,
  results: elements.paletteResults,
  trigger: elements.commandInput,
  background: elements.app,
  onChoose: selectTarget,
});

function rebuildRenderModel() {
  if (!baseModel) return;

  model = buildDistrictWorldModel(baseModel, activeDistrictId);
  selectedId = model.currentFocus?.id || model.regions?.[0]?.id || null;
  selectedRelationshipId = null;
  hoveredId = null;
  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();

  commandPalette.setCommands(model.commands);
  commandPalette.setModel(model);
  renderInstruments(elements, model, selectedId, selectedRelationshipId, activeReviewDraftPreview);
  syncRelationNavigation();
  renderDistrictBreadcrumb(elements.districtBreadcrumb, model);
  renderLabels(buildWorldNodes(model));
  setFocusCard(model.activeDistrict || model.currentFocus || findRegion(selectedId));
  world?.update(model);
  world?.setFocusState(currentFocusContext());
}

function enterDistrict(districtId) {
  const district = findDistrict(districtId);
  if (!district) return false;

  activeDistrictId = district.id;
  const previousDistrictId = district.id;
  rebuildRenderModel();
  world?.enterDistrict(previousDistrictId);
  return true;
}

function exitDistrict() {
  if (!activeDistrictId) return;

  activeDistrictId = null;
  rebuildRenderModel();
  world?.exitDistrict();
}

elements.commandInput?.addEventListener("focus", () => commandPalette.open());
elements.commandBar?.addEventListener("click", () => commandPalette.open());

elements.regionList?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-region-id]");
  if (button?.dataset?.regionId) {
    selectRegion(button.dataset.regionId);
  }
});

elements.inspector?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-relationship-id]");
  if (button?.dataset?.relationshipId) {
    selectRelationship(decodeURIComponent(button.dataset.relationshipId));
  }

  const actionButton = target?.closest("[data-action-route-id]");
  if (actionButton?.dataset?.actionRouteId) {
    const action = findActionRoute(actionButton.dataset.actionRouteId);
    if (!action || action.browserWrites !== false || action.allowed !== true) return;
    setActionRouteStatus(action);
  }

  const assistantRouteButton = target?.closest("[data-assistant-route]");
  if (assistantRouteButton?.dataset?.assistantRoute) {
    openAssistantRoute(assistantRouteButton.dataset.assistantRoute);
  }
});

elements.districtBreadcrumb?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const exitButton = target?.closest("[data-district-exit]");
  if (exitButton) {
    exitDistrict();
  }
});

function goAtlasHome() {
  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();

  if (activeDistrictId) {
    exitDistrict();
  }

  world?.recenter();
  selectRegion(model?.currentFocus?.id || selectedId, { focus: false, allowDistrictEnter: false });
}

// Read-only export (#16): serialize the current selection into a bounded JSON
// context bundle and hand it to the user as a download. No storage, no network,
// no durable write — the browser-writes-nothing invariant holds.
function exportContextBundle() {
  if (!baseModel) return false;

  const bundle = buildContextBundle({
    baseModel,
    model,
    selectedId,
    activeDistrictId,
    sources: sourceCatalog,
  });
  const { json } = serializeContextBundle(bundle);

  const scopeSlug = String(bundle.scope.id || bundle.scope.kind || "atlas")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `groundplane-context-${scopeSlug || "atlas"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return true;
}

elements.exportContext?.addEventListener("click", exportContextBundle);
elements.atlasHome?.addEventListener("click", goAtlasHome);
elements.home?.addEventListener("click", goAtlasHome);
elements.runCurrentBlock?.addEventListener("click", startCurrentStep);
elements.inspectorToggle?.addEventListener("click", () => {
  inspectorCollapsed = !inspectorCollapsed;
  syncInspectorVisibility();
});

elements.zoomIn?.addEventListener("click", () => {
  world?.zoomBy(-1.7);
});

elements.zoomOut?.addEventListener("click", () => {
  world?.zoomBy(1.7);
});

elements.orbitLeft?.addEventListener("click", () => {
  world?.orbitBy(-0.34);
});

elements.orbitRight?.addEventListener("click", () => {
  world?.orbitBy(0.34);
});

function selectAdjacentRelationship(direction) {
  const nextRelationship = adjacentRelationship(direction);
  if (!nextRelationship) return false;
  return selectRelationship(nextRelationship.id);
}

elements.relationPrev?.addEventListener("click", () => selectAdjacentRelationship(-1));
elements.relationNext?.addEventListener("click", () => selectAdjacentRelationship(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeDistrictId) {
    exitDistrict();
  }
});

function onSelect(regionId) {
  selectTarget(regionId);
}

function onHover(regionId) {
  hoverRegion(regionId);
}

function renderLabels(nodes = latestWorldLabels) {
  latestWorldLabels = asArray(nodes);
  renderWorldLabels(elements.worldLabels, latestWorldLabels, currentFocusContext());
}

function onLabels(nodes) {
  renderLabels(nodes);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown boot error");
}

async function boot() {
  if (!elements.worldRoot) {
    throw new Error("Product app is missing #world-root");
  }

  const state = await loadProductState();
  sourceCatalog = asArray(state?.sources?.sources);
  baseModel = buildSurfaceModel(state);
  activeDistrictId = null;
  model = buildDistrictWorldModel(baseModel, activeDistrictId);
  selectedId = model.currentFocus?.id || model.regions?.[0]?.id || null;
  selectedRelationshipId = null;
  hoveredId = null;
  activeReviewDraftPreview = null;
  activeProofLauncherId = null;
  syncProofLauncherState();

  commandPalette.setCommands(model.commands);
  commandPalette.setModel(model);
  renderInstruments(elements, model, selectedId, selectedRelationshipId, activeReviewDraftPreview);
  syncRelationNavigation();
  syncInspectorVisibility();
  renderDistrictBreadcrumb(elements.districtBreadcrumb, model);
  renderLabels(buildWorldNodes(model));
  setFocusCard(model.activeDistrict || model.currentFocus || findRegion(selectedId));

  world?.dispose();
  world = createWorldScene(elements.worldRoot, model, {
    onSelect,
    onHover,
    onLabels,
  });
  world.setFocusState(currentFocusContext());
}

boot().catch((error) => {
  const message = errorMessage(error);
  console.error(error);

  if (elements.systemPulse) {
    elements.systemPulse.textContent = `Boot failed: ${message}`;
  }

  renderInspector(
    elements.inspector,
    {
      phase: "boot failed",
      updatedAt: "unknown",
      activeTasks: [],
      pendingReviews: [],
      regions: [],
      instruments: {
        currentBlock: message,
      },
      currentFocus: {
        id: "boot-error",
        title: "State load failed",
        subtitle: "Local state could not be read",
        status: "error",
        health: "red",
        nextAction: message,
      },
      inspector: {
        related: [],
      },
    },
    "boot-error",
  );
});

window.addEventListener("beforeunload", () => {
  world?.dispose();
});
