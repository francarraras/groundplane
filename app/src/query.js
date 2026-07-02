function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, " ")
    .trim();
}

function queryText(parts) {
  return parts
    .map((part) => String(part || ""))
    .join(" ")
    .toLowerCase();
}

const relationshipIntentTerms = new Set([
  "relationship",
  "relationships",
  "relation",
  "relations",
  "related",
  "relates",
  "connection",
  "connections",
  "link",
  "links",
  "path",
  "paths",
  "edge",
  "edges",
]);

function regionRecord(region) {
  return {
    id: region.id,
    kind: "region",
    label: region.title || region.id,
    detail: region.nextAction || region.subtitle || region.type || "Open region",
    routeId: region.id,
    weight: region.status === "active" ? 20 : 8,
    text: queryText([region.id, region.title, region.subtitle, region.type, region.status, region.nextAction]),
  };
}

function relationshipRecord(relationship) {
  return {
    id: relationship.id,
    kind: "relationship",
    label: relationship.title || relationship.id,
    detail: relationship.evidence || relationship.permissionMode || "Inspect relationship",
    routeId: relationship.id,
    weight: relationship.visualOnly ? 4 : 12,
    text: queryText([
      relationship.id,
      relationship.type,
      relationship.title,
      relationship.evidence,
      relationship.permissionMode,
      relationship.fromTitle,
      relationship.toTitle,
      "relationship relation related connection link path edge map-only sourced",
    ]),
  };
}

function commandRecord(command) {
  return {
    id: command.id,
    kind: command.kind || "command",
    label: command.label || command.id,
    detail: command.detail || "Run command",
    routeId: command.id,
    weight: command.kind === "district" ? 10 : 6,
    text: queryText([command.id, command.kind, command.label, command.detail]),
  };
}

export function buildQueryRecords(model) {
  const records = [
    ...asArray(model?.regions).map(regionRecord),
    ...asArray(model?.relationships).map(relationshipRecord),
    ...asArray(model?.commands).map(commandRecord),
  ];
  const byKey = new Map();

  records.forEach((record) => {
    const key = `${record.kind}:${record.id}`;
    if (!byKey.has(key)) byKey.set(key, record);
  });

  return Array.from(byKey.values());
}

function scoreRecord(record, terms) {
  if (terms.length === 0) return record.weight;
  let score = record.weight;

  for (const term of terms) {
    if (!record.text.includes(term)) return 0;
    score += record.label.toLowerCase().includes(term) ? 18 : 5;
    score += String(record.id).toLowerCase().includes(term) ? 6 : 0;
  }

  if (record.kind === "relationship" && terms.some((term) => relationshipIntentTerms.has(term))) {
    score += 24;
  }

  return score;
}

export function searchQueryRecords(records, query, limit = 8) {
  const normalized = normalizeQuery(query);
  const terms = normalized ? normalized.split(/\s+/).filter(Boolean) : [];

  return asArray(records)
    .map((record) => ({ ...record, score: scoreRecord(record, terms) }))
    .filter((record) => record.score > 0)
    .sort((first, second) => second.score - first.score || first.label.localeCompare(second.label))
    .slice(0, limit);
}
