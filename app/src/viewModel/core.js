import { buildAssistantBrief, buildBrainAssistantBehavior, buildSpatialCommandOverlay, buildSystemHomeCockpit, buildTodayCommandSurface } from "./assistant-surfaces.js";
import { buildProofArtifacts, deriveDistricts, districtAnchorRegion, districtGravityRelationships, districtRegion, districtRelationships, districtShellSummary, graphEdges, graphNodes, graphRegion, graphRelationships, instrumentSignal } from "./districts.js";
import { asArray, command, evidenceContext, projectRegion, relationshipTouches, routineRegion, sortedUnique } from "./helpers.js";
import { attachProjectWorkspace, buildProjectWorkspaces } from "./project-workspaces.js";

function regionIds(model) {
  return new Set(asArray(model?.regions).map((region) => region.id).filter(Boolean));
}

function resolveRegionId(model, requestedId) {
  const ids = regionIds(model);
  if (requestedId && ids.has(requestedId)) return requestedId;
  if (model?.currentFocus?.id && ids.has(model.currentFocus.id)) return model.currentFocus.id;
  return asArray(model?.regions)[0]?.id || null;
}

function otherEndpoint(relationship, id) {
  if (relationship?.from === id) return relationship.to;
  if (relationship?.to === id) return relationship.from;
  return null;
}

function relationshipIdsFor(relationships, id) {
  return relationships.filter((relationship) => relationshipTouches(relationship, id)).map((relationship) => relationship.id);
}

function relatedIdsFor(relationships, id) {
  return relationships.map((relationship) => otherEndpoint(relationship, id)).filter(Boolean);
}

function relationshipById(relationships, relationshipId) {
  return asArray(relationships).find((relationship) => relationship?.id === relationshipId) || null;
}

function relationshipEndpointIds(relationship) {
  return sortedUnique([relationship?.from, relationship?.to]);
}

function districtHasRenderableNode(district, renderableNodeIds) {
  return asArray(district?.nodeIds).some((nodeId) => renderableNodeIds.has(nodeId));
}

function baseLabelPriority(region) {
  const statusBoost = region?.status === "active" ? 40 : region?.status === "planned" ? 28 : 12;
  const healthBoost = region?.health === "yellow" ? 8 : 0;
  const weightBoost = Math.round((Number.isFinite(region?.weight) ? region.weight : 0.35) * 30);
  return statusBoost + healthBoost + weightBoost;
}

export function buildFocusContext(model, selectedId = null, hoveredId = null, selectedRelationshipId = null) {
  const relationships = asArray(model?.relationships);
  const ids = regionIds(model);
  const selectedRelationship =
    relationshipById(relationships, selectedRelationshipId) || relationshipById(relationships, selectedId);
  const selectedEndpointId =
    selectedRelationship && ids.has(selectedRelationship.from)
      ? selectedRelationship.from
      : selectedRelationship && ids.has(selectedRelationship.to)
        ? selectedRelationship.to
        : selectedId;
  const selected = resolveRegionId(model, selectedEndpointId);
  const hovered = hoveredId && ids.has(hoveredId) ? hoveredId : null;
  const active = hovered || selected;
  const selectedRelationshipEndpointIds = relationshipEndpointIds(selectedRelationship);
  const selectedRelationshipIds = selectedRelationship
    ? [selectedRelationship.id]
    : relationshipIdsFor(relationships, selected);
  const hoverRelationshipIds = hovered ? relationshipIdsFor(relationships, hovered) : [];
  const keepSelectedEndpointVisible = Boolean(selectedRelationship);
  const selectedRelatedNodeIds = selectedRelationship
    ? selectedRelationshipEndpointIds
    : relatedIdsFor(relationships, selected);
  const relatedNodeIds = sortedUnique([
    ...selectedRelatedNodeIds,
    ...relatedIdsFor(relationships, hovered),
    ...selectedRelationshipEndpointIds,
    selected,
    hovered,
  ].filter((id) => id && (keepSelectedEndpointVisible || hovered || id !== active)));
  const relationshipIds = sortedUnique([...selectedRelationshipIds, ...hoverRelationshipIds, selectedRelationship?.id]);
  const labelPriorityById = Object.fromEntries(
    asArray(model?.regions).map((region) => {
      let priority = baseLabelPriority(region);
      if (region.id === selected) priority += 1000;
      if (region.id === hovered) priority += 850;
      if (relatedNodeIds.includes(region.id)) priority += 420;
      return [region.id, priority];
    }),
  );

  return {
    selectedId: selected,
    hoveredId: hovered,
    activeId: active,
    selectedRelationshipId: selectedRelationship?.id || null,
    selectedRelationshipIds: sortedUnique(selectedRelationshipIds),
    hoverRelationshipIds: sortedUnique(hoverRelationshipIds),
    relationshipIds,
    relatedNodeIds,
    labelPriorityById,
  };
}

export function buildDistrictWorldModel(model, activeDistrictId = null) {
  const districts = asArray(model?.districts);
  const requestedDistrict = districts.find((district) => district.id === activeDistrictId) || null;
  const evidenceState = model?.evidenceContext || {};

  if (!requestedDistrict) {
    return {
      ...model,
      activeDistrictId: null,
      activeDistrict: null,
      activeDistrictSummary: null,
      regions:
        districts.length > 0
          ? districts.map((district, index) => districtRegion(district, index, evidenceState))
          : asArray(model?.allRegions || model?.regions),
      relationships: districts.length > 0 ? asArray(model?.districtRelationships) : asArray(model?.allRelationships || model?.relationships),
      commands: asArray(model?.commands),
    };
  }

  const nodeIdSet = new Set(requestedDistrict.nodeIds);
  const edgeIdSet = new Set(requestedDistrict.edgeIds);
  const localRegions = asArray(model?.allRegions).filter((region) => nodeIdSet.has(region.id));
  const localRelationships = asArray(model?.allRelationships).filter((relationship) => edgeIdSet.has(relationship.id));
  const gravityRelationships = districtGravityRelationships(requestedDistrict, localRegions, localRelationships, evidenceState);
  const relationships = [...localRelationships, ...gravityRelationships];
  const localFocus = districtAnchorRegion(localRegions) || model?.currentFocus || null;
  const activeDistrictSummary = districtShellSummary(requestedDistrict, localRegions, relationships);

  return {
    ...model,
    activeDistrictId: requestedDistrict.id,
    activeDistrict: requestedDistrict,
    activeDistrictSummary,
    regions: localRegions,
    relationships,
    currentFocus: localFocus,
    inspector: {
      ...(model?.inspector || {}),
      title: requestedDistrict.title,
      subtitle: "District drilldown",
      status: localFocus?.status || "active",
      health: requestedDistrict.weights?.friction >= 0.55 ? "yellow" : "green",
      nextAction: requestedDistrict.summary,
      related: relationships.slice(0, 8),
    },
    commands: [
      { id: "district:exit", label: "Atlas", kind: "atlas", detail: "Return to the global atlas" },
      ...localRegions.map((region) => command(region.id, region.title, "graph-node", region.nextAction)),
      ...asArray(model?.commands).filter((item) => item.kind !== "graph-node" && item.kind !== "district"),
    ],
  };
}

export function buildSurfaceModel(state) {
  const boardProject = state?.board?.project || {};
  const projects = asArray(state?.projects?.projects).map(projectRegion);
  const routines = asArray(state?.routines?.routines).map(routineRegion);
  const taskRecords = asArray(state?.tasks?.tasks);
  const proofArtifacts = buildProofArtifacts(state, taskRecords);
  const proofPackage = proofArtifacts[0] || null;
  const proofLauncher = proofPackage?.launcher || null;
  const nodes = graphNodes(state);
  const edges = graphEdges(state);
  const clusters = asArray(state?.relationshipGraph?.clusters);
  const nodeTitles = new Map(nodes.map((node) => [node.id, node.title || node.id]));
  const rawGraphRegions = nodes
    .filter((node) =>
      ["project", "routine", "task", "decision", "memory_claim", "review", "proof_artifact"].includes(node.type),
    )
    .map((node, index) => graphRegion(node, index, state));
  const graphRelationshipList = graphRelationships(edges, null, nodeTitles, state);
  const projectWorkspaces = buildProjectWorkspaces(state, proofArtifacts, graphRelationshipList);
  const projectWorkspaceByProjectId = new Map(projectWorkspaces.map((workspace) => [workspace.projectId, workspace]));
  const graphRegions = rawGraphRegions.map((region) => attachProjectWorkspace(region, projectWorkspaceByProjectId));
  const renderableNodeIds = new Set(graphRegions.map((region) => region.id));
  const districts = deriveDistricts(nodes, edges, clusters).filter((district) =>
    districtHasRenderableNode(district, renderableNodeIds),
  );
  const modelEvidenceContext = evidenceContext(state);
  const districtRegionList = districts.map((district, index) => districtRegion(district, index, modelEvidenceContext));
  const districtRelationshipList = districtRelationships(districts, edges, modelEvidenceContext);
  const fallbackRegions = [...projects.map((region) => attachProjectWorkspace(region, projectWorkspaceByProjectId)), ...routines];
  const allRegions = graphRegions.length > 0 ? graphRegions : fallbackRegions;
  const regions = districtRegionList.length > 0 ? districtRegionList : allRegions;
  const relationships = districts.length > 0 ? districtRelationshipList : graphRelationshipList;
  const activeProject =
    regions.find((region) => region.type === "project" && region.status === "active") ||
    regions.find((region) => region.type === "project") ||
    regions[0];
  const activeTasks = taskRecords.filter((task) => task.status === "active");
  const reviews = asArray(state?.reviews?.reviews);
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const resolvedReviews = reviews.filter(
    (review) =>
      review.status !== "pending" &&
      (review.resolution_status || review.resolution_decision || review.resolved_at),
  );
  const lockedDecisions = asArray(state?.decisions?.decisions).filter((decision) => decision.status === "locked");

  // User-owned layout overlay (state/layout.json): pinned node positions.
  const layoutPins =
    state?.layout && typeof state.layout === "object" && !Array.isArray(state.layout) && state.layout.pins
      ? { ...state.layout.pins }
      : {};

  // Nodes touched by pending review packets: the review node itself, every
  // node it shares an edge with, and any district containing one of those.
  const pendingReviewNodeIds = (() => {
    const affected = new Set();
    pendingReviews.forEach((review) => {
      const reviewNodeId = `review:${review.id}`;
      affected.add(reviewNodeId);
      graphRelationshipList.forEach((relationship) => {
        if (relationshipTouches(relationship, reviewNodeId)) {
          if (relationship.from) affected.add(relationship.from);
          if (relationship.to) affected.add(relationship.to);
        }
      });
    });
    districts.forEach((district) => {
      if (asArray(district.nodeIds).some((nodeId) => affected.has(nodeId))) {
        affected.add(district.id);
      }
    });
    return [...affected].sort();
  })();

  const currentFocus = activeProject || regions[0] || {
    id: "empty",
    title: "No active region",
    subtitle: "State is empty",
    nextAction: "Add project or routine state",
  };
  const hasGraphData = nodes.length > 0 || edges.length > 0;
  const graphWarnings = asArray(state?.relationshipGraph?.warnings);
  const assistantBrief = buildAssistantBrief({
    board: state?.board || {},
    pendingReviews,
    graphWarnings,
    currentFocus,
  });
  const systemHomeCockpit = buildSystemHomeCockpit({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    pendingReviews,
    resolvedReviews,
    districts,
    relationships,
    assistantBrief,
    graphWarnings,
  });
  const todayCommandSurface = buildTodayCommandSurface({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    assistantBrief,
    systemHomeCockpit,
  });
  const brainAssistantBehavior = buildBrainAssistantBehavior({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    districts,
    relationships,
    assistantBrief,
    graphWarnings,
  });
  const spatialCommandOverlay = buildSpatialCommandOverlay({
    assistantBrief,
    projects,
    routines,
  });
  const relatedRelationships = relationships
    .filter((relationship) => relationshipTouches(relationship, currentFocus.id))
    .slice(0, 8)
    .map((relationship) => ({
      id: relationship.id,
      title: relationship.title,
      evidence: relationship.evidence,
      permissionMode: relationship.permissionMode,
    }));

  const surfaceModel = {
    appName: boardProject.name || "Groundplane",
    phase: boardProject.current_phase || "unknown",
    northStar: boardProject.north_star || "",
    updatedAt: boardProject.updated_at || null,
    regions,
    allRegions,
    allRelationships: graphRelationshipList,
    districts,
    districtRelationships: districtRelationshipList,
    activeDistrictId: null,
    activeDistrict: null,
    evidenceContext: modelEvidenceContext,
    currentFocus,
    graph: {
      nodes,
      edges,
      clusters,
      warnings: graphWarnings,
    },
    relationships,
    activeTasks,
    proofArtifacts,
    proofPackage,
    proofLauncher,
    projectWorkspaces,
    pendingReviews,
    layoutPins,
    pendingReviewNodeIds,
    assistantBrief,
    systemHomeCockpit,
    todayCommandSurface,
    brainAssistantBehavior,
    spatialCommandOverlay,
    resolvedReviews,
    reviewQueue: {
      pending: pendingReviews,
      resolved: resolvedReviews,
    },
    lockedDecisions,
    inspector: {
      title: currentFocus.title,
      subtitle: currentFocus.subtitle,
      status: currentFocus.status || "unknown",
      health: currentFocus.health || "unknown",
      nextAction: currentFocus.nextAction || "No next action available",
      related:
        hasGraphData
          ? relatedRelationships
          : lockedDecisions.slice(0, 4).map((decision) => ({
              id: decision.id,
              title: decision.recommendation || decision.decision,
            })),
    },
    commands: [
      ...projects.map((region) => command(region.id, region.title, "project", region.nextAction)),
      ...routines.map((region) => command(region.id, region.title, "routine", region.nextAction)),
      ...districtRegionList.map((region) => command(region.id, region.title, "district", region.nextAction)),
      ...graphRegions.map((region) => command(region.id, region.title, "graph-node", region.nextAction)),
      ...proofArtifacts.map((artifact) => command(artifact.id, artifact.title, "proof-artifact", artifact.nextAction)),
      ...proofArtifacts.map((artifact) =>
        command(artifact.launcherRouteId, `Open ${artifact.title}`, "proof-launcher", artifact.safeLaunchPath),
      ),
      ...projectWorkspaces.map((workspace) =>
        command(workspace.id, `${workspace.title} Workspace`, "project-workspace", workspace.nextActions[0]),
      ),
      command(assistantBrief.id, assistantBrief.title, "assistant", assistantBrief.recommendation),
      command(systemHomeCockpit.id, systemHomeCockpit.title, "system-home", systemHomeCockpit.nextSafeAction),
      command(todayCommandSurface.id, todayCommandSurface.title, "today-command", todayCommandSurface.safeNextMove),
      command(
        brainAssistantBehavior.id,
        brainAssistantBehavior.title,
        "assistant-behavior",
        brainAssistantBehavior.recommendedMove,
      ),
      command(spatialCommandOverlay.id, spatialCommandOverlay.title, "spatial-command", spatialCommandOverlay.route),
      ...asArray(assistantBrief.roadmapCandidates).map((candidate) =>
        command(`roadmap:${candidate.id}`, `${candidate.id} ${candidate.title}`, "roadmap", candidate.nextAction),
      ),
      ...activeTasks.map((task) => command(task.id, task.title, "task", task.next_action)),
      ...pendingReviews.map((review) => command(review.id, review.summary, "approval", review.target_file)),
    ],
    instruments: {
      currentBlock: instrumentSignal(currentFocus),
      statusLine: `${activeTasks.length} active signals / ${pendingReviews.length} pending approvals / ${resolvedReviews.length} resolved outcomes / ${regions.length} regions`,
      modes: ["Conceptual Proximity", "Time", "Importance", "Unfinished", "People", "Projects", "Sources"],
    },
  };
  return surfaceModel;
}
