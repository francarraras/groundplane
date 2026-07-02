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

function slugToken(value) {
  return (
    String(value || "subject")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "subject"
  );
}

function fieldSet(records, fieldName, fallback = "unknown") {
  const values = uniqueInOrder(asArray(records).map((record) => record?.[fieldName] || fallback));
  return values.length > 0 ? values.join(", ") : fallback;
}

function sourceIdsFor(subject = {}, action = {}) {
  return uniqueInOrder([
    ...asArray(action.sourceIds),
    ...asArray(action.source_ids),
    ...asArray(subject.evidenceTrail?.sourceIds),
    ...asArray(subject.sourceIds),
    ...asArray(subject.source_ids),
    ...asArray(subject.source_ref?.source_ids),
    ...asArray(subject.source_ref?.sourceIds),
    ...asArray(subject.sourceRef?.sourceIds),
    ...asArray(subject.sourceRef?.source_ids),
  ]);
}

function sourceRefsFor(records = []) {
  return asArray(records)
    .filter((record) => record?.sourceId)
    .map((record) => ({
      source_id: record.sourceId,
      path: record.path || null,
      title: record.title || record.sourceId,
      trust_level: record.trustLevel || "unknown",
      sensitivity: record.sensitivity || "unknown",
      status: record.status || "unknown",
    }));
}

function subjectTitle(subject = {}) {
  if (subject.fromTitle || subject.toTitle) {
    return `${subject.fromTitle || subject.from || "Unknown"} -> ${subject.toTitle || subject.to || "Unknown"}`;
  }

  return subject.title || subject.label || subject.id || "Selected focus";
}

function subjectSummary(subject = {}) {
  return (
    subject.evidenceTrail?.summary ||
    subject.evidence ||
    subject.nextAction ||
    subject.summary ||
    subject.subtitle ||
    "No source-backed summary available."
  );
}

export function buildReviewDraftPreview(subject = {}, action = {}) {
  if (!subject || action?.actionType !== "draft_review_item") return null;
  if (action.allowed !== true || action.browserWrites !== false) return null;

  const sourceIds = sourceIdsFor(subject, action);
  const records = asArray(subject.evidenceTrail?.records);
  const targetFile = action.targetFile || "reviews/queue.json";
  const approvalMode = action.mode || "draft-for-approval";
  const title = subjectTitle(subject);

  return {
    id: `PREVIEW-${slugToken(subject.id)}-${slugToken(action.actionType)}`,
    type: "review_packet_preview",
    status: "draft-preview",
    risk: action.risk || "medium",
    proposed_by: "Product App Preview",
    action_type: action.actionType,
    target_file: targetFile,
    summary: `Preview review packet for ${title}`,
    source_ids: sourceIds,
    source_refs: sourceRefsFor(records),
    source_trust: fieldSet(records, "trustLevel"),
    sensitivity: subject.evidenceTrail?.health === "sensitive" ? "sensitive" : fieldSet(records, "sensitivity", "normal"),
    requires_explicit_approval: action.requiresExplicitApproval !== false,
    diff_summary: action.routeSummary || subjectSummary(subject),
    approval_mode: approvalMode,
    created_at: "preview-only",
    browser_writes: false,
    preview_notice: `The browser did not write ${targetFile}. The operator agent must create the queued review after approval.`,
  };
}
