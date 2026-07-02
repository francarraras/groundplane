import { buildEvidenceModel } from "../evidence.js";
import { REGION_PALETTE } from "./constants.js";

function statusWeight(status, health) {
  if (status === "active" && health !== "green") return 1;
  if (status === "active") return 0.82;
  if (status === "planned") return 0.56;
  if (status === "done") return 0.38;
  return 0.48;
}

export function command(id, label, kind, detail) {
  return { id, label, kind, detail };
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function attachEvidence(subject, state = {}) {
  const evidenceModel = buildEvidenceModel(subject, state);
  return {
    evidenceTrail: evidenceModel.trail,
    safeActions: evidenceModel.actions,
  };
}

export function evidenceContext(state = {}) {
  return {
    sources: state.sources || {},
    permissions: state.permissions || {},
  };
}

export function projectRegion(project, index) {
  const palette = REGION_PALETTE[index % REGION_PALETTE.length];
  return {
    id: project.id,
    type: "project",
    title: project.title,
    subtitle: project.domain,
    status: project.status,
    health: project.health,
    weight: statusWeight(project.status, project.health),
    color: palette.color,
    orbit: palette.orbit,
    nextAction: project.next_action,
    sourceIds: project.source_ids,
  };
}

export function routineRegion(routine, index) {
  const palette = REGION_PALETTE[(index + 3) % REGION_PALETTE.length];
  const steps = asArray(routine.steps);
  return {
    id: routine.id,
    type: "routine",
    title: routine.name,
    subtitle: routine.cadence,
    status: routine.status,
    health: routine.status === "active" ? "green" : "yellow",
    weight: routine.status === "active" ? 0.64 : 0.42,
    color: palette.color,
    orbit: palette.orbit + 0.18,
    nextAction: steps.join(" / ") || "No routine steps available",
    sourceIds: [],
  };
}

export function taskById(tasks, taskId) {
  return asArray(tasks).find((task) => task.id === taskId) || null;
}

export function verificationText(verification = {}) {
  const tests = verification.test_count ? `${verification.test_count} tests ${verification.test_status || "unknown"}` : "tests unknown";
  const smoke = verification.smoke_status ? `private smoke ${verification.smoke_status}` : "private smoke unknown";
  return `${tests} / ${smoke}`;
}

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function localCommand(root, commandText, fallback = "No local command available") {
  if (!root || !commandText) return fallback;
  return `cd ${shellQuote(root)} && ${commandText}`;
}

export function relationshipTouches(relationship, id) {
  return Boolean(id && (relationship?.from === id || relationship?.to === id));
}

export function sortedUnique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) => first.localeCompare(second));
}
