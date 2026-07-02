import { APPROVAL_PRECEDENCE, APPROVAL_RANK, DISTRICT_PALETTE, PERMISSION_PRECEDENCE, PERMISSION_RANK, REGION_PALETTE } from "./constants.js";
import { asArray, attachEvidence, sortedUnique } from "./helpers.js";
import { proofArtifactSummary } from "./project-workspaces.js";

export function buildProofArtifacts(state, tasks) {
  return asArray(state?.proofArtifacts?.proof_artifacts).map((artifact) => proofArtifactSummary(artifact, tasks));
}

export function graphNodes(state) {
  return asArray(state?.relationshipGraph?.nodes);
}

export function graphEdges(state) {
  return asArray(state?.relationshipGraph?.edges);
}

function sourceIdsFromGraphSubject(subject = {}) {
  return sortedUnique([
    ...asArray(subject.sourceIds),
    ...asArray(subject.source_ids),
    ...asArray(subject.source_ref?.source_ids),
    ...asArray(subject.source_ref?.sourceIds),
    ...asArray(subject.sourceRef?.sourceIds),
    ...asArray(subject.sourceRef?.source_ids),
  ]);
}

export function graphRegion(node, index, state = {}) {
  const palette = REGION_PALETTE[index % REGION_PALETTE.length];
  const visual = node.visual || {};
  const weights = node.weights || {};
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    subtitle: node.domain || node.type,
    status: node.status,
    health: node.weights?.friction > 0.6 ? "yellow" : "green",
    weight: Math.max(0.25, Math.min(1, weights.importance || 0.48)),
    color: visual.color || palette.color,
    orbit: palette.orbit,
    nextAction: node.summary,
    sourceRef: node.source_ref || {},
    sourceIds: sourceIdsFromGraphSubject(node),
    approvalStatus: node.approval_status || (node.inferred ? "needs-review" : "approved"),
    permissionMode: node.permission_mode,
    graphNode: node,
    ...attachEvidence(node, state),
  };
}

function endpointTitle(nodeTitles, id) {
  return nodeTitles.get(id) || id || "unknown";
}

export function graphRelationships(edges, selectedId = null, nodeTitles = new Map(), state = {}) {
  return edges
    .filter((edge) => selectedId === null || edge.from === selectedId || edge.to === selectedId)
    .map((edge) => {
      const relationshipType = String(edge.type || "relationship").replaceAll("_", " ");
      const fromTitle = endpointTitle(nodeTitles, edge.from);
      const toTitle = endpointTitle(nodeTitles, edge.to);

      return {
        id: edge.id,
        type: edge.type,
        from: edge.from,
        to: edge.to,
        fromTitle,
        toTitle,
        title: `${relationshipType}: ${fromTitle} -> ${toTitle}`,
        evidence: edge.evidence,
        sourceIds: asArray(edge.source_ids),
        approvalStatus: edge.approval_status || (edge.inferred ? "needs-review" : "approved"),
        sourceRef: edge.source_ref || {},
        permissionMode: edge.permission_mode,
        inferred: edge.inferred,
        strength: edge.strength,
        ...attachEvidence(edge, state),
      };
    });
}

function slug(value, fallback = "general") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/^[a-z]+:/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function namespacedSlug(value, fallback = "general") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function districtIdFromCluster(clusterId, fallback = "general", preserveNamespace = false) {
  return `district:${preserveNamespace ? namespacedSlug(clusterId, fallback) : slug(clusterId, fallback)}`;
}

function clusterNodeIds(cluster) {
  return asArray(cluster?.node_ids || cluster?.nodeIds)
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));
}

function clusterTitle(cluster, fallback) {
  return cluster?.title || cluster?.label || cluster?.name || fallback;
}

function nodeClusterId(node) {
  return node?.visual?.cluster_id || node?.visual?.clusterId || null;
}

function permissionModeRank(mode) {
  return PERMISSION_RANK.has(mode) ? PERMISSION_RANK.get(mode) : PERMISSION_PRECEDENCE.length;
}

function permissionModes(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(
    (first, second) => permissionModeRank(first) - permissionModeRank(second) || first.localeCompare(second),
  );
}

function mostRestrictivePermissionMode(values, fallback = "suggest-only") {
  return permissionModes(values)[0] || fallback;
}

function approvalStatusRank(status) {
  return APPROVAL_RANK.has(status) ? APPROVAL_RANK.get(status) : APPROVAL_PRECEDENCE.length;
}

function approvalStatuses(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(
    (first, second) => approvalStatusRank(first) - approvalStatusRank(second) || first.localeCompare(second),
  );
}

function approvalStatusForRelationship(relationship) {
  return relationship?.approval_status || relationship?.approvalStatus || (relationship?.inferred ? "needs-review" : "approved");
}

function mostRestrictiveApprovalStatus(values, fallback = "approved") {
  return approvalStatuses(values)[0] || fallback;
}

function averageWeight(nodes, key, fallback = 0.4) {
  const values = nodes.map((node) => node?.weights?.[key]).filter((value) => Number.isFinite(value));
  if (values.length === 0) return fallback;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function dominantTypes(nodes) {
  const counts = new Map();
  nodes.forEach((node) => {
    const type = node.type || "unknown";
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([type]) => type);
}

function districtSummary(title, nodes, localEdges) {
  const activeProject = nodes.find((node) => node.type === "project" && node.status === "active");
  const activeTask = nodes.find((node) => node.type === "task" && node.status === "active");
  const activeNode = nodes.find((node) => node.status === "active");
  const anchor = activeProject || activeTask || activeNode || nodes[0];
  const relationshipCount = localEdges.length;
  const anchorTitle = anchor?.title || "the first item";

  if (relationshipCount === 0 && nodes.length > 1) {
    return `${title} has ${nodes.length} items. No sourced connections yet. ${anchorTitle} is the main item.`;
  }

  return `${title} has ${nodes.length} item${nodes.length === 1 ? "" : "s"} and ${relationshipCount} local connection${relationshipCount === 1 ? "" : "s"}. ${anchorTitle} is the main item.`;
}

export function districtAnchorRegion(localRegions) {
  return (
    localRegions.find((region) => region.type === "project" && region.status === "active") ||
    localRegions.find((region) => region.type === "task" && region.status === "active") ||
    localRegions.find((region) => region.status === "active") ||
    localRegions[0] ||
    null
  );
}

export function districtShellSummary(district, localRegions, relationships) {
  const anchor = districtAnchorRegion(localRegions);
  const visualRelationships = relationships.filter((relationship) => relationship?.visualOnly === true);
  const sourceBackedRelationships = relationships.filter((relationship) => relationship?.visualOnly !== true);
  const relationshipPermissionModes = relationships.map(
    (relationship) => relationship?.permissionMode || relationship?.permission_mode,
  );
  const relationshipApprovalStatuses = relationships.map(approvalStatusForRelationship);

  return {
    scope: "district",
    id: district.id,
    title: district.title,
    summary: district.summary,
    nodeCount: localRegions.length,
    relationshipCount: relationships.length,
    sourceBackedRelationshipCount: sourceBackedRelationships.length,
    visualRelationshipCount: visualRelationships.length,
    permissionMode: mostRestrictivePermissionMode([...asArray(district.permissionModes), ...relationshipPermissionModes]),
    approvalStatus: mostRestrictiveApprovalStatus([district.approvalStatus, ...relationshipApprovalStatuses]),
    anchorId: anchor?.id || null,
    anchorTitle: anchor?.title || anchor?.id || "No active anchor",
    anchorType: anchor?.type || "region",
    dominantTypes: asArray(district.dominantTypes).length > 0 ? district.dominantTypes : dominantTypes(localRegions),
    health: district.weights?.friction >= 0.55 ? "yellow" : "green",
  };
}

function relationshipConnects(relationship, firstId, secondId) {
  return (
    (relationship?.from === firstId && relationship?.to === secondId) ||
    (relationship?.from === secondId && relationship?.to === firstId)
  );
}

export function districtGravityRelationships(district, localRegions, localRelationships, state = {}) {
  if (!district || localRegions.length < 2) return [];

  const anchor = districtAnchorRegion(localRegions);
  if (!anchor) return [];

  return localRegions
    .filter((region) => region.id !== anchor.id)
    .filter((region) => !localRelationships.some((relationship) => relationshipConnects(relationship, anchor.id, region.id)))
    .map((region, index) => {
      const relationship = {
        id: `district-gravity:${district.id}:${anchor.id}:${region.id}`,
        type: "district_gravity",
        from: anchor.id,
        to: region.id,
        fromTitle: anchor.title || anchor.id,
        toTitle: region.title || region.id,
        title: `district gravity: ${anchor.title || anchor.id} -> ${region.title || region.id}`,
        evidence: `Shared ${district.title || district.id} area context. Map-only connection; not a sourced claim.`,
        permissionMode: mostRestrictivePermissionMode(district.permissionModes, "suggest-only"),
        inferred: true,
        visualOnly: true,
        strength: Math.max(0.28, Math.min(0.56, 0.32 + (district.weights?.activity || 0.4) * 0.18 - index * 0.02)),
      };
      return {
        ...relationship,
        ...attachEvidence(relationship, state),
      };
    });
}

function districtColor(nodes, index) {
  return nodes.find((node) => node?.visual?.color)?.visual.color || DISTRICT_PALETTE[index % DISTRICT_PALETTE.length];
}

export function districtRegion(district, index, state = {}) {
  const sourceIds = asArray(district.sourceIds);
  const permissionMode = mostRestrictivePermissionMode(district.permissionModes);
  const approvalStatus = district.approvalStatus || (district.inferred ? "needs-review" : "approved");
  const evidenceSubject = {
    id: district.id,
    type: "district",
    title: district.title,
    summary: district.summary,
    evidence: district.summary,
    permissionMode,
    approvalStatus,
    inferred: Boolean(district.inferred),
    visualOnly: sourceIds.length === 0,
    sourceIds,
    sourceRef: {
      file: "indexes/relationship-graph.json",
      recordId: district.id,
      sourceIds,
    },
  };

  return {
    id: district.id,
    type: "district",
    title: district.title,
    subtitle: `${district.nodeIds.length} ${district.nodeIds.length === 1 ? "item" : "items"}`,
    status: district.weights.activity >= 0.65 ? "active" : "planned",
    health: district.weights.friction >= 0.55 ? "yellow" : "green",
    weight: Math.max(0.32, Math.min(1, district.weights.importance || 0.45)),
    color: district.visual.color,
    orbit: REGION_PALETTE[index % REGION_PALETTE.length].orbit,
    nextAction: district.summary,
    permissionMode,
    approvalStatus,
    sourceIds,
    sourceRef: evidenceSubject.sourceRef,
    district,
    ...attachEvidence(evidenceSubject, state),
  };
}

export function instrumentSignal(region, fallback = "No current block available") {
  if (!region) return fallback;

  if (region.type === "district") {
    return `${region.title || "Atlas"} / ${region.subtitle || "district"}`;
  }

  return region.nextAction || region.subtitle || region.title || fallback;
}

export function deriveDistricts(nodes, edges, clusters) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const clusterById = new Map(asArray(clusters).map((cluster) => [cluster.id, cluster]));
  const grouped = new Map();
  const groupFor = (clusterId) => {
    if (!grouped.has(clusterId)) grouped.set(clusterId, new Set());
    return grouped.get(clusterId);
  };

  nodes.forEach((node) => {
    const clusterId = nodeClusterId(node);
    if (!clusterId) return;
    groupFor(clusterId).add(node.id);
  });

  asArray(clusters).forEach((cluster) => {
    const ids = clusterNodeIds(cluster);
    if (ids.length === 0) return;
    const group = groupFor(cluster.id);
    ids.forEach((id) => {
      if (nodeById.has(id)) group.add(id);
    });
  });

  const entries = Array.from(grouped.entries())
    .map(([clusterId, nodeIds]) => [
      clusterId,
      Array.from(nodeIds)
        .map((id) => nodeById.get(id))
        .filter(Boolean),
    ])
    .filter(([, districtNodes]) => districtNodes.length > 0)
    .sort(([firstId], [secondId]) => firstId.localeCompare(secondId));
  const baseIdCounts = new Map();
  entries.forEach(([clusterId]) => {
    const baseId = districtIdFromCluster(clusterId);
    baseIdCounts.set(baseId, (baseIdCounts.get(baseId) || 0) + 1);
  });
  const usedDistrictIds = new Set();

  return entries
    .map(([clusterId, districtNodes], index) => {
      const sortedNodes = [...districtNodes].sort((first, second) => first.id.localeCompare(second.id));
      const nodeIds = sortedNodes.map((node) => node.id);
      const nodeIdSet = new Set(nodeIds);
      const localEdges = edges
        .filter((edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to))
        .sort((first, second) => first.id.localeCompare(second.id));
      const sourceIds = sortedUnique(sortedNodes.flatMap(sourceIdsFromGraphSubject));
      const approvalStatus = mostRestrictiveApprovalStatus(sortedNodes.map(approvalStatusForRelationship));
      const cluster = clusterById.get(clusterId);
      const title = clusterTitle(cluster, sortedNodes[0]?.domain || sortedNodes[0]?.type || "General");
      const baseId = districtIdFromCluster(clusterId, title);
      const hasBaseIdCollision = (baseIdCounts.get(baseId) || 0) > 1;
      const uniqueIdBase = districtIdFromCluster(clusterId, title, hasBaseIdCollision);
      let id = uniqueIdBase;
      let suffix = 2;
      while (usedDistrictIds.has(id)) {
        id = `${uniqueIdBase}-${suffix}`;
        suffix += 1;
      }
      usedDistrictIds.add(id);

      return {
        id,
        title,
        sourceClusterIds: [clusterId],
        nodeIds,
        edgeIds: localEdges.map((edge) => edge.id),
        summary: districtSummary(title, sortedNodes, localEdges),
        dominantTypes: dominantTypes(sortedNodes),
        permissionModes: permissionModes(sortedNodes.map((node) => node.permission_mode || node.permissionMode)),
        approvalStatus,
        sourceIds,
        inferred: sortedNodes.some((node) => node.inferred) || approvalStatus !== "approved",
        weights: {
          importance: averageWeight(sortedNodes, "importance"),
          recency: averageWeight(sortedNodes, "recency"),
          activity: averageWeight(sortedNodes, "activity"),
          friction: averageWeight(sortedNodes, "friction", 0.1),
          confidence: averageWeight(sortedNodes, "confidence"),
          sensitivity: averageWeight(sortedNodes, "sensitivity", 0.2),
        },
        visual: {
          color: districtColor(sortedNodes, index),
          radius: 1.4 + Math.min(1.4, Math.max(0, sortedNodes.length - 1) * 0.22),
          labelPriority: 0.55 + Math.min(0.4, averageWeight(sortedNodes, "importance") * 0.4),
          position: null,
        },
      };
    });
}

export function districtRelationships(districts, edges, state = {}) {
  const districtByNodeId = new Map();
  const districtById = new Map();
  districts.forEach((district) => {
    districtById.set(district.id, district);
    district.nodeIds.forEach((nodeId) => districtByNodeId.set(nodeId, district));
  });

  const grouped = new Map();
  edges.forEach((edge) => {
    const fromDistrict = districtByNodeId.get(edge.from);
    const toDistrict = districtByNodeId.get(edge.to);
    if (!fromDistrict || !toDistrict || fromDistrict.id === toDistrict.id) return;
    const ordered = [fromDistrict.id, toDistrict.id].sort();
    const key = `${ordered[0]}:${ordered[1]}`;
    const existing = grouped.get(key) || {
      id: `district-edge:${ordered[0]}:${ordered[1]}`,
      type: "relates_to",
      from: ordered[0],
      to: ordered[1],
      fromTitle: districtById.get(ordered[0])?.title || ordered[0],
      toTitle: districtById.get(ordered[1])?.title || ordered[1],
      title: `relates to: ${districtById.get(ordered[0])?.title || ordered[0]} -> ${districtById.get(ordered[1])?.title || ordered[1]}`,
      evidence: "Cross-district relationship derived from local graph edges.",
      permissionMode: "suggest-only",
      permissionModes: [],
      approvalStatuses: [],
      inferred: false,
      strength: 0,
      edgeIds: [],
      sourceIds: [],
    };
    existing.edgeIds.push(edge.id);
    existing.sourceIds = sortedUnique([
      ...existing.sourceIds,
      ...asArray(edge.source_ids),
      ...asArray(edge.sourceIds),
    ]);
    existing.permissionModes = permissionModes([
      ...existing.permissionModes,
      edge.permission_mode || edge.permissionMode || "suggest-only",
    ]);
    existing.approvalStatuses = approvalStatuses([
      ...existing.approvalStatuses,
      approvalStatusForRelationship(edge),
    ]);
    existing.permissionMode = mostRestrictivePermissionMode(existing.permissionModes);
    existing.strength = Math.max(existing.strength, Number.isFinite(edge.strength) ? edge.strength : 0.42);
    existing.inferred = existing.inferred || Boolean(edge.inferred);
    existing.approvalStatus = mostRestrictiveApprovalStatus(existing.approvalStatuses);
    existing.sourceRef = {
      file: "indexes/relationship-graph.json",
      recordId: existing.id,
      sourceIds: existing.sourceIds,
    };
    grouped.set(key, existing);
  });

  return Array.from(grouped.values())
    .map((relationship) => ({
      ...relationship,
      ...attachEvidence(relationship, state),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));
}
