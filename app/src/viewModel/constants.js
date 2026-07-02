export const REGION_PALETTE = [
  { color: "#39d9c2", orbit: 0.8 },
  { color: "#68a8ff", orbit: 1.05 },
  { color: "#d4a45f", orbit: 1.18 },
  { color: "#a77dff", orbit: 1.32 },
  { color: "#ff7ea8", orbit: 1.42 },
  { color: "#ff9a4a", orbit: 1.52 },
  { color: "#8be28b", orbit: 1.62 },
];

export const DISTRICT_PALETTE = ["#39d9c2", "#68a8ff", "#d4a45f", "#a77dff", "#ff7ea8", "#ff9a4a", "#8be28b"];

export const FIRST_PROJECT_WORKSPACE_ID = "workspace:PROJ-001";

export const PERMISSION_PRECEDENCE = ["forbidden-in-V0", "draft-for-approval", "suggest-only", "automatic-low-risk"];

export const PERMISSION_RANK = new Map(PERMISSION_PRECEDENCE.map((mode, index) => [mode, index]));

export const APPROVAL_PRECEDENCE = ["rejected", "blocked", "pending", "needs-review", "proposed", "approved"];

export const APPROVAL_RANK = new Map(APPROVAL_PRECEDENCE.map((status, index) => [status, index]));
