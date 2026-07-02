const SENSITIVE_MARKERS = [
  "high",
  "personal",
  "mixed-high",
  "family",
  "relationship",
  "health",
  "travel",
  "home",
  "email",
  "calendar",
  "message",
  "private",
  "screenshot",
  "pdf",
  "identity",
  "finance",
  "contact",
  "credential",
  "token",
];
const DEFAULT_PERMISSION_MODES = ["suggest-only", "draft-for-approval", "automatic-low-risk", "forbidden-in-V0"];
const DEFAULT_RISK_LEVELS = ["low", "medium", "high"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueInOrder(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function camelOrSnake(subject, camelKey, snakeKey) {
  return subject?.[camelKey] ?? subject?.[snakeKey] ?? null;
}

function normalizeCatalogSources(sourceCatalog = {}) {
  if (Array.isArray(sourceCatalog)) return sourceCatalog;
  return asArray(sourceCatalog.sources);
}

export function buildSourceIndex(sourceCatalog = {}) {
  return new Map(normalizeCatalogSources(sourceCatalog).filter((source) => source?.id).map((source) => [source.id, source]));
}

function sourceIdsFromSubject(subject = {}) {
  return uniqueInOrder([
    ...asArray(subject.sourceIds),
    ...asArray(subject.source_ids),
    ...asArray(subject.source_ref?.source_ids),
    ...asArray(subject.source_ref?.sourceIds),
    ...asArray(subject.sourceRef?.sourceIds),
    ...asArray(subject.sourceRef?.source_ids),
  ]);
}

function permissionModeFor(subject = {}) {
  return camelOrSnake(subject, "permissionMode", "permission_mode") || "suggest-only";
}

function approvalStatusFor(subject = {}) {
  return camelOrSnake(subject, "approvalStatus", "approval_status") || (subject.inferred ? "needs-review" : "approved");
}

function isSensitiveValue(value) {
  const normalized = String(value || "").toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => normalized.includes(marker));
}

function sourceRecord(sourceId, sourceIndex) {
  const source = sourceIndex.get(sourceId);
  if (!source) {
    return {
      sourceId,
      title: "Missing source",
      path: null,
      trustLevel: "unknown",
      sensitivity: "unknown",
      status: "missing",
      summary: "",
      resolved: false,
    };
  }

  return {
    sourceId: source.id,
    title: source.title || source.id,
    path: source.path || null,
    trustLevel: source.trust_level || source.trustLevel || "unknown",
    sensitivity: source.sensitivity || "unknown",
    status: source.status || "unknown",
    summary: source.summary || "",
    resolved: true,
  };
}

function evidenceSummary(subject = {}) {
  return subject.evidence || subject.summary || subject.description || subject.detail || "No evidence text available.";
}

function sourceHealth(subject, records) {
  const approvalStatus = approvalStatusFor(subject);
  if (subject?.visualOnly) return "visual-only";
  if (records.some((record) => !record.resolved)) return "missing";
  if (isSensitiveValue(subject?.sensitivity)) return "sensitive";
  if (records.some((record) => record.resolved && isSensitiveValue(record.sensitivity))) return "sensitive";
  if (subject?.inferred || approvalStatus !== "approved") return "inferred";
  if (records.length === 0) return "gated";
  return "resolved";
}

export function resolveEvidenceTrail(subject = {}, sourceCatalog = {}) {
  const sourceIndex = buildSourceIndex(sourceCatalog);
  const sourceIds = sourceIdsFromSubject(subject);
  const records = sourceIds.map((sourceId) => sourceRecord(sourceId, sourceIndex));
  const sourceRef = subject.sourceRef || subject.source_ref || {};
  const warnings = records
    .filter((record) => !record.resolved)
    .map((record) => `Referenced source ${record.sourceId} is missing from sources/catalog.json.`);

  return {
    subjectId: subject.id || "unknown",
    subjectType: subject.type || "subject",
    permissionMode: permissionModeFor(subject),
    approvalStatus: approvalStatusFor(subject),
    sourceIds,
    sourceRef: {
      file: sourceRef.file || null,
      recordId: sourceRef.recordId || sourceRef.record_id || null,
    },
    health: sourceHealth(subject, records),
    summary: evidenceSummary(subject),
    records,
    warnings,
    inferred: Boolean(subject.inferred),
    visualOnly: Boolean(subject.visualOnly),
  };
}

function permissionRulesByAction(permissions = {}) {
  return new Map(asArray(permissions.actions).map((rule) => [rule.action_type || rule.actionType, rule]));
}

function permissionModeSet(permissions = {}) {
  const hasSnakeCatalog = Object.prototype.hasOwnProperty.call(permissions, "permission_modes");
  const hasCamelCatalog = Object.prototype.hasOwnProperty.call(permissions, "permissionModes");
  if (!hasSnakeCatalog && !hasCamelCatalog) return new Set(DEFAULT_PERMISSION_MODES);

  return new Set(
    asArray(permissions.permission_modes || permissions.permissionModes)
      .map((entry) => (typeof entry === "string" ? entry : entry?.mode))
      .filter((mode) => DEFAULT_PERMISSION_MODES.includes(mode))
      .filter(Boolean),
  );
}

function isValidRisk(value) {
  return DEFAULT_RISK_LEVELS.includes(value);
}

function actionFromRule(id, label, actionType, defaultRule, trail, permissions, extra = {}) {
  const rules = permissionRulesByAction(permissions);
  const validModes = permissionModeSet(permissions);
  const permissionKnown = rules.has(actionType);
  const rule = rules.get(actionType) || {};
  const candidateMode = extra.mode || rule.mode || defaultRule.mode;
  const candidateRisk = extra.risk || rule.risk || defaultRule.risk;
  const permissionValid = permissionKnown && validModes.has(candidateMode) && isValidRisk(candidateRisk);
  const mode = permissionValid ? candidateMode : "forbidden-in-V0";
  const risk = permissionValid ? candidateRisk : "high";
  const requiresExplicitApproval =
    permissionValid
      ? extra.requiresExplicitApproval ?? rule.requires_explicit_approval ?? rule.requiresExplicitApproval ?? mode === "draft-for-approval"
      : true;
  const lockedReason = !permissionKnown
    ? `Action type ${actionType} is not present in state/permissions.json.`
    : !permissionValid
      ? `Action type ${actionType} has a malformed permission matrix entry.`
      : extra.lockedReason || rule.rule || "Forbidden in V0.";
  const routeSummary = permissionValid
    ? extra.routeSummary || rule.rule || label
    : "Action route is not in the permission matrix. This route cannot execute.";

  return {
    id: `action:${trail.subjectId}:${id}`,
    label,
    actionType,
    mode,
    risk,
    requiresExplicitApproval: Boolean(requiresExplicitApproval || mode === "forbidden-in-V0"),
    targetFile: extra.targetFile || null,
    sourceIds: trail.sourceIds,
    allowed: permissionValid && mode !== "forbidden-in-V0",
    lockedReason: mode === "forbidden-in-V0" ? lockedReason : null,
    routeSummary,
    browserWrites: false,
    permissionKnown,
    permissionValid,
  };
}

function normalizeSafeActionArgs(subject, trailOrOptions, permissionsArg) {
  if (trailOrOptions?.trail || trailOrOptions?.permissions || trailOrOptions?.state) {
    const state = trailOrOptions.state || {};
    return {
      trail: trailOrOptions.trail || resolveEvidenceTrail(subject, state.sources),
      permissions: trailOrOptions.permissions || state.permissions || {},
    };
  }

  return {
    trail: trailOrOptions?.subjectId ? trailOrOptions : resolveEvidenceTrail(subject),
    permissions: permissionsArg || {},
  };
}

export function buildSafeActions(subject = {}, trailOrOptions = resolveEvidenceTrail(subject), permissionsArg = {}) {
  const { trail, permissions } = normalizeSafeActionArgs(subject, trailOrOptions, permissionsArg);

  return [
    actionFromRule(
      "source-inspect",
      "Inspect evidence sources",
      "source_inspect",
      { mode: "automatic-low-risk", risk: "low" },
      trail,
      permissions,
      {
        routeSummary: "Inspect source metadata already loaded by the app. No durable write.",
      },
    ),
    actionFromRule(
      "explain-relationship",
      "Explain relationship",
      "explain_relationship",
      { mode: "suggest-only", risk: "low" },
      trail,
      permissions,
      {
        routeSummary: "Explain why this subject matters using visible evidence only.",
      },
    ),
    actionFromRule(
      "draft-review",
      "Draft review item",
      "draft_review_item",
      { mode: "draft-for-approval", risk: "medium" },
      trail,
      permissions,
      {
        mode: "draft-for-approval",
        risk: "medium",
        requiresExplicitApproval: true,
        targetFile: "reviews/queue.json",
        routeSummary: "Prepare a review packet. Do not write memory or state directly.",
      },
    ),
    actionFromRule(
      "raw-source-rewrite",
      "Raw source rewrite",
      "raw_source_rewrite",
      { mode: "forbidden-in-V0", risk: "high" },
      trail,
      permissions,
      {
        mode: "forbidden-in-V0",
        targetFile: trail.sourceRef.file,
        lockedReason: "Raw source rewrites are forbidden in V0.",
        routeSummary: "Raw sources remain append-only truth. This route cannot execute from the browser.",
      },
    ),
  ];
}

export function buildEvidenceModel(subject = {}, state = {}) {
  const trail = resolveEvidenceTrail(subject, state.sources);
  return {
    trail,
    actions: buildSafeActions(subject, trail, state.permissions),
  };
}
