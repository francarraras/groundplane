import { publicText } from "../publicText.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusTone(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-") || "unknown";
}

export function pill(value) {
  const label = value || "unknown";
  const tone = statusTone(label);
  return `<span class="status-pill status-pill-${escapeHtml(tone)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(
    label,
  )}">${escapeHtml(label)}</span>`;
}

export function statusDot(value) {
  const label = value || "unknown";
  const tone = statusTone(label);
  return `<span class="status-pill status-pill-${escapeHtml(tone)} command-status-dot" title="${escapeHtml(
    label,
  )}" aria-label="${escapeHtml(label)}"></span>`;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Re-exported from the shared public-wording layer (#33) so the many
// instruments modules that import it from here keep working unchanged.
export { publicText };

export function publicTitle(value, fallback = "Untitled area") {
  const text = String(value || fallback)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  const isSlugLike = /^[a-z0-9\s]+$/.test(text) && text === text.toLowerCase();
  if (!isSlugLike) return publicText(text);
  return publicText(text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()));
}

export function publicTypeLabel(value = "area") {
  const type = String(value || "area")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const labels = {
    district: "Area",
    region: "Area",
    proof: "Proof",
    "proof artifact": "Proof",
    proof_artifact: "Proof",
    relationship: "Connection",
    source: "Evidence",
    review: "Review",
    task: "Task",
    project: "Project",
  };
  return labels[type] || publicText(type || "area");
}

export function publicSubtitle(region) {
  if (!region) return "Area";
  const subtitle = region.subtitle || region.type || "Area";
  return publicText(subtitle);
}

export function publicScopeLabel(scope, model = {}) {
  if (scope === "relationship") return "Connection";
  if (scope === "district" || model?.activeDistrictId) return "Area view";
  return "Home";
}

export function publicCountLabel(count, singular, plural = `${singular}s`) {
  const value = Number.isFinite(count) ? count : 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

export function selectedRegion(model, selectedId) {
  const regions = asArray(model?.regions);
  return regions.find((region) => region.id === selectedId) || model?.currentFocus || regions[0] || null;
}

export function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#39d9c2";
}

export function finitePosition(value) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function clamp(value, min, max) {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

export function finiteMetric(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function field(label, value) {
  const displayValue = value === undefined || value === null || value === "" ? "none" : value;
  return `
    <div class="readout-field">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(displayValue)}</dd>
    </div>
  `;
}

export function truncateText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function drawerCountLabel(count, singular, plural = `${singular}s`) {
  const value = Number.isFinite(count) ? count : 0;
  return `${value} ${value === 1 ? singular : plural}`;
}

export function browserWriteLabel(value) {
  return value === true ? "On" : "Off";
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function pulseLabel(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
