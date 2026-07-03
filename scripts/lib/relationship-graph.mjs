// @ts-check
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GRAPH_SCHEMA_VERSION = "relationship-graph.v1";

const GRAPH_SOURCE_FILES = [
  "sources/catalog.json",
  "state/projects.json",
  "state/tasks.json",
  "state/proof-artifacts.json",
  "state/routines.json",
  "state/decisions.json",
  "reviews/queue.json",
  "wiki/memory-claims.json",
  "state/permissions.json",
  "runs/current-daily-command-review.json",
  "runs/current-daily-execution.json",
];

const OPTIONAL_SOURCE_FILES = new Set([
  "runs/current-daily-command-review.json",
  "runs/current-daily-execution.json",
]);

const TYPE_COLORS = {
  blocker: "#ff6b6b",
  decision: "#a77dff",
  file: "#b7c0c7",
  memory_claim: "#ff7ea8",
  permission: "#b7c0c7",
  proof_artifact: "#39d9c2",
  project: "#39d9c2",
  review: "#ff9a4a",
  routine: "#d4a45f",
  run: "#c9a7ff",
  source: "#8be28b",
  task: "#68a8ff",
};

const TYPE_ORDER = [
  "source",
  "project",
  "task",
  "proof_artifact",
  "routine",
  "decision",
  "memory_claim",
  "review",
  "permission",
  "run",
  "blocker",
  "file",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberBetween(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function slug(value, fallback = "system") {
  return safeText(value, fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function nodeId(type, id) {
  return `${type}:${id}`;
}

function edgeId(from, type, to) {
  return `edge:${from}:${type}:${to}`;
}

function clusterId(domainOrType) {
  return `cluster:${slug(domainOrType)}`;
}

function typeRank(type) {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
}

function compareById(a, b) {
  const typeDiff = typeRank(a.type) - typeRank(b.type);
  if (typeDiff !== 0) return typeDiff;
  return a.id.localeCompare(b.id);
}

function compareEdge(a, b) {
  return a.id.localeCompare(b.id);
}

function uniqueStrings(values) {
  return Array.from(new Set(asArray(values).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())));
}

function sourceIdsFor(record, sourceIdSet, fallbackIds = []) {
  return uniqueStrings([...asArray(record?.source_ids), ...fallbackIds]).filter((sourceId) => sourceIdSet.has(sourceId));
}

function invalidRecordSourceIds(record, sourceIdSet) {
  return uniqueStrings(record?.source_ids).filter((sourceId) => !sourceIdSet.has(sourceId));
}

function permissionForRecord(record, fallback = "suggest-only") {
  return safeText(record?.approval_mode || record?.permission_mode || record?.mode, fallback);
}

function confidenceNumber(confidence) {
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.62;
  if (confidence === "low") return 0.34;
  return 0.58;
}

function isProtectedSensitivity(sensitivity) {
  const normalized = safeText(sensitivity, "normal").toLowerCase();
  return normalized === "sensitive" || normalized === "high" || normalized === "private" || normalized.includes("high");
}

function sensitivityNumber(sensitivity) {
  if (isProtectedSensitivity(sensitivity)) return 0.9;
  if (["normal", "internal", "low"].includes(safeText(sensitivity, "normal").toLowerCase())) return 0.35;
  return 0.45;
}

function statusImportance(status, priority, health) {
  if (priority === "high") return 0.92;
  if (status === "active" && health !== "green") return 0.88;
  if (status === "active") return 0.78;
  if (status === "planned") return 0.55;
  if (status === "parked") return 0.42;
  if (status === "done" || status === "locked") return 0.34;
  return 0.48;
}

function edgePermission({ inferred, sensitivity, permissionMode }) {
  if (inferred || isProtectedSensitivity(sensitivity)) return "draft-for-approval";
  return safeText(permissionMode, "automatic-low-risk");
}

/**
 * Build a normalized graph node from a source record.
 * @param {{
 *   type: string,
 *   id: string,
 *   record?: any,
 *   file: string,
 *   recordId?: string,
 *   sourceIds?: string[],
 *   title?: string,
 *   summary?: string,
 *   domain?: string,
 *   status?: string,
 *   confidence?: string,
 *   sensitivity?: string,
 *   permissionMode?: string,
 * }} descriptor
 */
function makeNode({
  type,
  id,
  record,
  file,
  recordId,
  sourceIds,
  title,
  summary,
  domain,
  status,
  confidence = "high",
  sensitivity = "normal",
  permissionMode,
}) {
  const resolvedDomain = safeText(domain || record?.domain || type, type);
  const resolvedStatus = safeText(status || record?.status, "unknown");
  const resolvedRecordId = safeText(recordId, id);
  const importance = statusImportance(resolvedStatus, record?.priority, record?.health);
  const confidenceWeight = confidenceNumber(confidence);
  const sensitivityWeight = sensitivityNumber(sensitivity);

  return {
    id: nodeId(type, id),
    type,
    source_ref: {
      file,
      record_id: resolvedRecordId,
      source_ids: sourceIds,
    },
    provenance: {
      generator: "relationship-graph",
      generated_from: "local-files",
      file,
      record_id: resolvedRecordId,
      source_ids: sourceIds,
    },
    title: safeText(title, id),
    summary: safeText(summary || record?.outcome || record?.next_action || record?.reason || record?.claim || record?.rule, ""),
    status: resolvedStatus,
    domain: resolvedDomain,
    confidence,
    sensitivity,
    permission_mode: safeText(permissionMode, "suggest-only"),
    timestamps: {
      created_at: record?.created_at || record?.decided_at || record?.started_at || null,
      updated_at: record?.updated_at || record?.last_reviewed || null,
      last_verified_at: record?.last_verified_at || null,
    },
    weights: {
      importance,
      recency: record?.last_reviewed || record?.last_verified_at || record?.created_at || record?.started_at ? 0.72 : 0.42,
      activity: resolvedStatus === "active" || resolvedStatus === "ready" || resolvedStatus === "current" ? 0.82 : 0.38,
      friction: record?.health === "yellow" || asArray(record?.blocked_by).length > 0 ? 0.74 : 0.22,
      confidence: confidenceWeight,
      sensitivity: sensitivityWeight,
    },
    visual: {
      cluster_id: clusterId(resolvedDomain),
      label_priority: numberBetween(importance * 0.8 + confidenceWeight * 0.2, 0.5),
      radius: numberBetween(0.4 + importance * 0.7, 0.7),
      color: TYPE_COLORS[type] || "#b7c0c7",
    },
  };
}

function makeEdge({
  from,
  type,
  to,
  sourceIds,
  evidence,
  inferred = false,
  permissionMode = "automatic-low-risk",
  strength = 0.72,
  confidence = "high",
  approvalStatus = "approved",
  sensitivity = "normal",
}) {
  const resolvedEvidence = safeText(evidence, `${from} ${type} ${to}.`);
  return {
    id: edgeId(from, type, to),
    type,
    from,
    to,
    direction: "directed",
    strength: numberBetween(strength, 0.72),
    confidence,
    source_ids: sourceIds,
    evidence: resolvedEvidence,
    inferred,
    approval_status: safeText(approvalStatus, "approved"),
    permission_mode: edgePermission({ inferred, sensitivity, permissionMode }),
    sensitivity,
    provenance: {
      generator: "relationship-graph",
      generated_from: "local-files",
      source_ids: sourceIds,
      inferred,
      evidence: resolvedEvidence,
    },
    visual: {
      path_type: inferred ? "dashed" : "solid",
      label: type.replaceAll("_", " "),
      visibility: "focus-or-nearby",
    },
  };
}

function addUnique(map, item) {
  if (!map.has(item.id)) map.set(item.id, item);
}

function addCitationEdges(edgeMap, from, sourceIds, evidencePrefix, permissionMode = "automatic-low-risk") {
  for (const sourceId of sourceIds) {
    const to = nodeId("source", sourceId);
    addUnique(edgeMap, makeEdge({
      from,
      type: "cites",
      to,
      sourceIds: [sourceId],
      evidence: `${evidencePrefix} source_ids includes ${sourceId}.`,
      permissionMode,
      strength: 0.58,
    }));
  }
}

function isSafeRepoRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) return false;
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return false;

  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (normalized === "." || normalized === "..") return false;
  return !normalized.split("/").includes("..");
}

function maxTimestamp(inputs) {
  const timestamps = [];

  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && /(^|_)(at|date|reviewed|run)$/.test(key)) {
        const millis = Date.parse(child);
        if (Number.isFinite(millis)) timestamps.push(millis);
      } else {
        visit(child);
      }
    }
  };

  visit(inputs);
  if (timestamps.length === 0) return "1970-01-01T00:00:00.000Z";
  return new Date(Math.max(...timestamps)).toISOString();
}

export async function readJsonFile(root, relativePath, { required = true } = {}) {
  const rootPath = path.resolve(root);
  const filePath = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to read outside repo root: ${relativePath}`);
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (!required && error.code === "ENOENT") return null;
    throw new Error(`Failed to read ${relativePath}: ${error.message}`);
  }
}

/**
 * @param {string} root repository root
 * @returns {Promise<Record<string, any>>}
 */
export async function loadGraphInputs(root) {
  const entries = await Promise.all(
    GRAPH_SOURCE_FILES.map(async (relativePath) => [
      relativePath,
      await readJsonFile(root, relativePath, { required: !OPTIONAL_SOURCE_FILES.has(relativePath) }),
    ]),
  );
  return Object.fromEntries(entries);
}

/**
 * Compile the deterministic relationship graph from workspace state inputs.
 * @param {Record<string, any>} inputs
 * @param {{ now?: string, fallbackSourceIds?: { routine?: string, system?: string } }} [options]
 * @returns {{ schema_version: string, generated_at: string|null, source_files: string[], stats: any, nodes: any[], edges: any[], clusters: any[], layout: any, warnings: any[] }}
 */
export function buildRelationshipGraph(inputs, { now, fallbackSourceIds = {} } = {}) {
  const routineFallbackIds = fallbackSourceIds.routine ? [fallbackSourceIds.routine] : [];
  const systemFallbackIds = fallbackSourceIds.system ? [fallbackSourceIds.system] : [];
  const nodeMap = new Map();
  const edgeMap = new Map();
  const warnings = [];
  const catalog = inputs["sources/catalog.json"] || {};
  const sourceRecords = asArray(catalog.sources);
  const sourceIdSet = new Set(sourceRecords.map((source) => source.id));

  const sourceIds = (record, fallbackIds = [], nodeIdValue = null) => {
    const ids = sourceIdsFor(record, sourceIdSet, fallbackIds);
    for (const sourceId of invalidRecordSourceIds(record, sourceIdSet)) {
      warnings.push({
        type: "missing-source",
        severity: "warning",
        node_id: nodeIdValue || (record?.id ? String(record.id) : "unknown"),
        record_id: record?.id || null,
        source_id: sourceId,
        message: `${nodeIdValue || record?.id || "Record"} references missing source ${sourceId}.`,
      });
    }
    return ids;
  };
  const addNode = (node) => addUnique(nodeMap, node);
  const addEdge = (edge) => {
    if (edge.source_ids.length > 0 && edge.evidence) addUnique(edgeMap, edge);
  };

  for (const source of sourceRecords) {
    const ids = sourceIds({ source_ids: [source.id] }, [], nodeId("source", source.id));
    if (ids.length === 0) continue;
    addNode(makeNode({
      type: "source",
      id: source.id,
      record: { ...source, status: source.status || "active" },
      file: "sources/catalog.json",
      sourceIds: ids,
      title: source.title,
      summary: source.summary,
      domain: source.type,
      sensitivity: source.sensitivity || "normal",
      permissionMode: "suggest-only",
    }));
  }

  for (const project of asArray(inputs["state/projects.json"]?.projects)) {
    const projectNodeId = nodeId("project", project.id);
    const ids = sourceIds(project, [], projectNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: projectNodeId, message: `${project.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "project",
      id: project.id,
      record: project,
      file: "state/projects.json",
      sourceIds: ids,
      title: project.title,
      summary: project.outcome,
      domain: project.domain,
      permissionMode: permissionForRecord(project, "draft-for-approval"),
    }));
    addCitationEdges(edgeMap, projectNodeId, ids, project.id);
  }

  for (const task of asArray(inputs["state/tasks.json"]?.tasks)) {
    const taskNodeId = nodeId("task", task.id);
    const ids = sourceIds(task, [], taskNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: taskNodeId, message: `${task.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "task",
      id: task.id,
      record: task,
      file: "state/tasks.json",
      sourceIds: ids,
      title: task.title,
      summary: task.next_action,
      domain: task.workstream,
      permissionMode: "draft-for-approval",
    }));
    addCitationEdges(edgeMap, taskNodeId, ids, task.id);

    if (task.project_id) {
      addEdge(makeEdge({
        from: taskNodeId,
        type: "belongs_to",
        to: nodeId("project", task.project_id),
        sourceIds: ids,
        evidence: `${task.id}.project_id references ${task.project_id}.`,
      }));
    }

    for (const blocker of asArray(task.blocked_by)) {
      const blockerId = nodeId("blocker", blocker);
      addNode(makeNode({
        type: "blocker",
        id: blocker,
        record: { id: blocker, status: "active", priority: task.priority },
        file: "state/tasks.json",
        recordId: `${task.id}.blocked_by:${blocker}`,
        sourceIds: ids,
        title: blocker,
        summary: `${task.id} is blocked by ${blocker}.`,
        domain: task.workstream || "blocker",
        sensitivity: "normal",
        permissionMode: "draft-for-approval",
      }));
      addEdge(makeEdge({
        from: blockerId,
        type: "blocks",
        to: taskNodeId,
        sourceIds: ids,
        evidence: `${task.id}.blocked_by includes ${blocker}.`,
        inferred: true,
        approvalStatus: "pending",
        permissionMode: "draft-for-approval",
        strength: 0.84,
      }));
    }
  }

  for (const artifact of asArray(inputs["state/proof-artifacts.json"]?.proof_artifacts)) {
    const proofNodeId = nodeId("proof_artifact", artifact.id);
    const ids = sourceIds(artifact, [], proofNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: proofNodeId, message: `${artifact.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "proof_artifact",
      id: artifact.id,
      record: artifact,
      file: "state/proof-artifacts.json",
      sourceIds: ids,
      title: artifact.title,
      summary: artifact.summary || artifact.next_action,
      domain: artifact.artifact_type || "proof artifact",
      status: artifact.status,
      sensitivity: artifact.sensitivity || "private",
      permissionMode: artifact.approval_mode || "draft-for-approval",
    }));
    addCitationEdges(edgeMap, proofNodeId, ids, artifact.id, artifact.approval_mode || "draft-for-approval");

    if (artifact.project_id) {
      addEdge(makeEdge({
        from: proofNodeId,
        type: "belongs_to",
        to: nodeId("project", artifact.project_id),
        sourceIds: ids,
        evidence: `${artifact.id}.project_id references ${artifact.project_id}.`,
        sensitivity: artifact.sensitivity || "private",
        permissionMode: artifact.approval_mode || "draft-for-approval",
      }));
    }

    if (artifact.linked_review_id) {
      addEdge(makeEdge({
        from: proofNodeId,
        type: "approved_by",
        to: nodeId("review", artifact.linked_review_id),
        sourceIds: ids,
        evidence: `${artifact.id}.linked_review_id references ${artifact.linked_review_id}.`,
        sensitivity: artifact.sensitivity || "private",
        permissionMode: artifact.approval_mode || "draft-for-approval",
      }));
    }

    for (const taskId of asArray(artifact.linked_task_ids)) {
      addEdge(makeEdge({
        from: proofNodeId,
        type: "evidenced_by",
        to: nodeId("task", taskId),
        sourceIds: ids,
        evidence: `${artifact.id}.linked_task_ids includes ${taskId}.`,
        sensitivity: artifact.sensitivity || "private",
        permissionMode: artifact.approval_mode || "draft-for-approval",
        strength: 0.66,
      }));
    }
  }

  for (const routine of asArray(inputs["state/routines.json"]?.routines)) {
    const routineNodeId = nodeId("routine", routine.id);
    const ids = sourceIds(routine, routineFallbackIds, routineNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: routineNodeId, message: `${routine.id} has no valid routine fallback source.` });
      continue;
    }
    addNode(makeNode({
      type: "routine",
      id: routine.id,
      record: routine,
      file: "state/routines.json",
      sourceIds: ids,
      title: routine.name,
      summary: asArray(routine.steps).join(" / "),
      domain: routine.cadence,
      permissionMode: permissionForRecord(routine, "suggest-only"),
    }));
    addCitationEdges(edgeMap, routineNodeId, ids, routine.id);
  }

  for (const decision of asArray(inputs["state/decisions.json"]?.decisions)) {
    const decisionNodeId = nodeId("decision", decision.id);
    const ids = sourceIds(decision, [], decisionNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: decisionNodeId, message: `${decision.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "decision",
      id: decision.id,
      record: decision,
      file: "state/decisions.json",
      sourceIds: ids,
      title: decision.recommendation || decision.decision,
      summary: decision.reason,
      domain: "decision",
      status: decision.status,
      permissionMode: "suggest-only",
    }));
    addCitationEdges(edgeMap, decisionNodeId, ids, decision.id);
  }

  for (const claim of asArray(inputs["wiki/memory-claims.json"]?.memory_claims)) {
    const claimNodeId = nodeId("memory_claim", claim.id);
    const ids = sourceIds(claim, [], claimNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: claimNodeId, message: `${claim.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "memory_claim",
      id: claim.id,
      record: claim,
      file: "wiki/memory-claims.json",
      sourceIds: ids,
      title: claim.claim,
      summary: claim.claim,
      domain: claim.domain,
      confidence: claim.confidence || "medium",
      sensitivity: claim.sensitivity || "normal",
      permissionMode: claim.approval_status === "approved" ? "suggest-only" : "draft-for-approval",
    }));
    addCitationEdges(edgeMap, claimNodeId, ids, claim.id);

    for (const superseded of asArray(claim.supersedes)) {
      addEdge(makeEdge({
        from: claimNodeId,
        type: "supersedes",
        to: nodeId("memory_claim", superseded),
        sourceIds: ids,
        evidence: `${claim.id}.supersedes includes ${superseded}.`,
        permissionMode: "draft-for-approval",
        strength: 0.8,
      }));
    }

    for (const contradiction of asArray(claim.contradicts)) {
      addEdge(makeEdge({
        from: claimNodeId,
        type: "contradicts",
        to: nodeId("memory_claim", contradiction),
        sourceIds: ids,
        evidence: `${claim.id}.contradicts includes ${contradiction}.`,
        permissionMode: "draft-for-approval",
        strength: 0.92,
      }));
    }
  }

  for (const review of asArray(inputs["reviews/queue.json"]?.reviews)) {
    const reviewNodeId = nodeId("review", review.id);
    const ids = sourceIds(review, [], reviewNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: reviewNodeId, message: `${review.id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "review",
      id: review.id,
      record: review,
      file: "reviews/queue.json",
      sourceIds: ids,
      title: review.summary,
      summary: review.diff_summary,
      domain: review.type,
      sensitivity: review.sensitivity || "normal",
      permissionMode: review.approval_mode || "draft-for-approval",
    }));
    addCitationEdges(edgeMap, reviewNodeId, ids, review.id, "draft-for-approval");

    if (review.target_file && isSafeRepoRelativePath(review.target_file)) {
      const fileNodeId = nodeId("file", review.target_file);
      addNode(makeNode({
        type: "file",
        id: review.target_file,
        record: { id: review.target_file, status: "active" },
        file: "reviews/queue.json",
        recordId: `${review.id}.target_file`,
        sourceIds: ids,
        title: review.target_file,
        summary: `${review.id} targets ${review.target_file}.`,
        domain: "review-target",
        sensitivity: review.sensitivity || "normal",
        permissionMode: "draft-for-approval",
      }));
      addEdge(makeEdge({
        from: reviewNodeId,
        type: "proposes_change_to",
        to: fileNodeId,
        sourceIds: ids,
        evidence: `${review.id}.target_file is ${review.target_file}.`,
        approvalStatus: review.status || "pending",
        permissionMode: "draft-for-approval",
        strength: 0.68,
      }));
    } else if (review.target_file) {
      warnings.push({
        type: "unsafe-target-file",
        severity: "warning",
        node_id: reviewNodeId,
        record_id: review.id,
        target_file: review.target_file,
        message: `${review.id}.target_file is not a safe repo-relative path.`,
      });
    }
  }

  for (const permission of asArray(inputs["state/permissions.json"]?.permission_modes)) {
    const permissionNodeId = nodeId("permission", `mode:${permission.mode}`);
    const ids = sourceIds(permission, systemFallbackIds, permissionNodeId);
    if (ids.length === 0) continue;
    addNode(makeNode({
      type: "permission",
      id: `mode:${permission.mode}`,
      record: { ...permission, id: `mode:${permission.mode}`, status: "active" },
      file: "state/permissions.json",
      recordId: `permission_modes:${permission.mode}`,
      sourceIds: ids,
      title: permission.mode,
      summary: permission.meaning,
      domain: "permission",
      sensitivity: "normal",
      permissionMode: "suggest-only",
    }));
  }

  for (const action of asArray(inputs["state/permissions.json"]?.actions)) {
    const actionNodeId = nodeId("permission", `action:${action.action_type}`);
    const ids = sourceIds(action, systemFallbackIds, actionNodeId);
    if (ids.length === 0) continue;
    addNode(makeNode({
      type: "permission",
      id: `action:${action.action_type}`,
      record: { ...action, id: `action:${action.action_type}`, status: "active" },
      file: "state/permissions.json",
      recordId: `actions:${action.action_type}`,
      sourceIds: ids,
      title: action.action_type,
      summary: action.rule,
      domain: "permission",
      sensitivity: action.risk === "high" ? "high" : "normal",
      permissionMode: action.mode === "automatic-low-risk" ? "suggest-only" : action.mode,
    }));
    addEdge(makeEdge({
      from: actionNodeId,
      type: "uses_permission_mode",
      to: nodeId("permission", `mode:${action.mode}`),
      sourceIds: ids,
      evidence: `${action.action_type}.mode is ${action.mode}.`,
      permissionMode: action.mode === "automatic-low-risk" ? "automatic-low-risk" : "draft-for-approval",
      sensitivity: action.risk === "high" ? "high" : "normal",
      strength: 0.66,
    }));
  }

  for (const [relativePath, runType] of [
    ["runs/current-daily-command-review.json", "daily-command-review"],
    ["runs/current-daily-execution.json", "daily-execution-runner"],
  ]) {
    const run = inputs[relativePath];
    if (!run) continue;
    const runNodeId = nodeId("run", run.run_id);
    const ids = sourceIds(run, [], runNodeId);
    if (ids.length === 0) {
      warnings.push({ type: "missing-source", severity: "warning", node_id: runNodeId, message: `${run.run_id} has no valid source_ids.` });
      continue;
    }
    addNode(makeNode({
      type: "run",
      id: run.run_id,
      record: { ...run, status: run.status || "active" },
      file: relativePath,
      sourceIds: ids,
      title: run.workflow || runType,
      summary: run.hard_recommendation || run.current_block?.action || run.status,
      domain: run.workflow || runType,
      sensitivity: "normal",
      permissionMode: permissionForRecord(run, "suggest-only"),
    }));
    addCitationEdges(edgeMap, runNodeId, ids, run.run_id);

    if (run.linked_plan_run_id) {
      addEdge(makeEdge({
        from: runNodeId,
        type: "linked_to",
        to: nodeId("run", run.linked_plan_run_id),
        sourceIds: ids,
        evidence: `${run.run_id}.linked_plan_run_id references ${run.linked_plan_run_id}.`,
        permissionMode: permissionForRecord(run, "suggest-only"),
        strength: 0.74,
      }));
    }
  }

  const nodeIds = new Set(nodeMap.keys());
  const resolvedEdges = [];
  for (const edge of Array.from(edgeMap.values()).sort(compareEdge)) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      warnings.push({
        type: "broken-edge",
        severity: "warning",
        edge_id: edge.id,
        message: `Edge ${edge.id} references a missing node.`,
      });
      continue;
    }
    resolvedEdges.push(edge);
  }

  const nodes = Array.from(nodeMap.values()).sort(compareById);
  const clusters = Array.from(
    nodes.reduce((clusterMap, node) => {
      if (!clusterMap.has(node.visual.cluster_id)) {
        clusterMap.set(node.visual.cluster_id, {
          id: node.visual.cluster_id,
          title: node.domain,
          node_count: 0,
        });
      }
      clusterMap.get(node.visual.cluster_id).node_count += 1;
      return clusterMap;
    }, new Map()).values(),
  ).sort((a, b) => a.id.localeCompare(b.id));

  return {
    schema_version: GRAPH_SCHEMA_VERSION,
    generated_at: safeText(now, maxTimestamp(inputs)),
    source_files: GRAPH_SOURCE_FILES.filter((relativePath) => inputs[relativePath] !== null && inputs[relativePath] !== undefined),
    stats: {
      node_count: nodes.length,
      edge_count: resolvedEdges.length,
      cluster_count: clusters.length,
      warning_count: warnings.length,
    },
    nodes,
    edges: resolvedEdges,
    clusters,
    layout: {
      strategy: "cluster-first-deterministic",
      version: 1,
    },
    warnings,
  };
}

/**
 * @param {string} root repository root
 * @param {any} graph the compiled relationship graph
 * @returns {Promise<void>}
 */
export async function writeRelationshipGraph(root, graph) {
  const indexesDir = path.resolve(root, "indexes");
  await mkdir(indexesDir, { recursive: true });
  await writeFile(
    path.join(indexesDir, "relationship-graph.json"),
    `${JSON.stringify(graph, null, 2)}\n`,
    "utf8",
  );
}
