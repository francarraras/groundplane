// The public-wording layer (#33): the single place the internal vocabulary is
// rewritten to user-facing copy (district → area, node → item, relationship →
// connection). Previously copy-pasted into main.js and the instruments helpers;
// both now import this one mapping table so the wording can never drift — and
// so the naming pass (#12) has exactly one file to edit.

const PUBLIC_WORD_MAP = [
  [/\bDistricts\b/g, "Areas"],
  [/\bdistricts\b/g, "areas"],
  [/\bDistrict\b/g, "Area"],
  [/\bdistrict\b/g, "area"],
  [/\bRegions\b/g, "Areas"],
  [/\bregions\b/g, "areas"],
  [/\bRegion\b/g, "Area"],
  [/\bregion\b/g, "area"],
  [/\bNodes\b/g, "Items"],
  [/\bnodes\b/g, "items"],
  [/\bNode\b/g, "Item"],
  [/\bnode\b/g, "item"],
  [/\bRelationships\b/g, "Connections"],
  [/\brelationships\b/g, "connections"],
  [/\bRelationship\b/g, "Connection"],
  [/\brelationship\b/g, "connection"],
  [/\bRelations\b/g, "Connections"],
  [/\brelations\b/g, "connections"],
  [/\bRelation\b/g, "Connection"],
  [/\brelation\b/g, "connection"],
];

export function publicText(value = "") {
  let text = String(value ?? "");
  for (const [pattern, replacement] of PUBLIC_WORD_MAP) {
    text = text.replace(pattern, replacement);
  }
  return text;
}
