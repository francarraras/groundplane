import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputArgIndex = process.argv.indexOf("--input");
const inputPath = inputArgIndex >= 0 ? process.argv[inputArgIndex + 1] : "inbox/intake.md";
const scopeArgIndex = process.argv.indexOf("--scope");
const scope = scopeArgIndex >= 0 ? process.argv[scopeArgIndex + 1] : "active-projects";

const SCOPE_CONFIG = {
  "active-projects": {
    type: "project-intake",
    action_type: "project_state_update",
    target_file: "state/projects.json",
    risk: "medium",
    summary_prefix: "Draft active project/context proposal from intake",
    diff_prefix: "Review and convert this rough intake bullet into structured project/task state",
  },
  "daily-routine": {
    type: "routine-intake",
    action_type: "project_state_update",
    target_file: "state/routines.json",
    risk: "medium",
    summary_prefix: "Draft routine/context proposal from intake",
    diff_prefix: "Review and convert this rough intake bullet into structured routine state",
  },
  "life-areas": {
    type: "life-area-intake",
    action_type: "memory_write",
    target_file: "wiki/memory-claims.json",
    risk: "high",
    summary_prefix: "Draft life-area memory proposal from intake",
    diff_prefix: "Review and convert this rough intake bullet into approved memory claims",
  },
};

if (!inputPath) {
  throw new Error("Missing value for --input");
}

if (!scope || !SCOPE_CONFIG[scope]) {
  throw new Error(`Unsupported --scope. Expected one of: ${Object.keys(SCOPE_CONFIG).join(", ")}`);
}

const absoluteInputPath = path.isAbsolute(inputPath)
  ? inputPath
  : path.join(root, inputPath);

const content = await readFile(absoluteInputPath, "utf8");
const userContext = extractUserContext(content);
const bullets = extractBullets(userContext);
const inputFile = path.relative(root, absoluteInputPath);
const sourceId = `INTAKE-${slugify(inputFile)}`;
const runId = `INTAKE-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;

const packet = {
  run_id: runId,
  workflow: "operating-context-intake",
  trigger: "manual",
  actor: "Command Center",
  scope,
  permission_mode: "draft-for-approval",
  status: bullets.length > 0 ? "proposal-only" : "needs-input",
  input_files: [inputFile],
  source_ids: [sourceId],
  findings: bullets.length > 0
    ? [`Found ${bullets.length} rough intake item${bullets.length === 1 ? "" : "s"}.`]
    : ["No user context found between intake markers."],
  proposed_state_changes: [],
  review_items: bullets.map((raw, index) => toReviewItem(raw, index, {
    config: SCOPE_CONFIG[scope],
    inputFile,
    runId,
    scope,
    sourceId,
  })),
  log_entries: [
    {
      target: "logs/operations.jsonl",
      operation: "prepare_intake_review",
      result: bullets.length > 0 ? "proposal_only" : "needs_input",
    },
  ],
  blocked_by: bullets.length > 0 ? [] : ["no user context between BEGIN USER CONTEXT and END USER CONTEXT"],
};

process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);

function extractUserContext(markdown) {
  const match = markdown.match(/## BEGIN USER CONTEXT([\s\S]*?)## END USER CONTEXT/);
  return match ? match[1] : "";
}

function extractBullets(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("* "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && !line.startsWith("<!--"));
}

function toReviewItem(raw, index, context) {
  const { config, inputFile, runId, scope, sourceId } = context;
  const title = raw.split(" - ")[0].trim() || `Intake item ${index + 1}`;
  const itemIndex = index + 1;
  return {
    id: `${runId}-REV-${String(itemIndex).padStart(3, "0")}`,
    type: config.type,
    status: "pending",
    scope,
    risk: config.risk,
    proposed_by: "Command Center",
    action_type: config.action_type,
    target_file: config.target_file,
    summary: `${config.summary_prefix}: ${title}`,
    source_ids: [sourceId],
    source_refs: [
      {
        source_id: sourceId,
        path: inputFile,
        marker_range: "BEGIN USER CONTEXT..END USER CONTEXT",
        item_index: itemIndex,
      },
    ],
    source_trust: "user-provided",
    sensitivity: "personal",
    requires_explicit_approval: true,
    diff_summary: `${config.diff_prefix}: ${raw}`,
    approval_mode: "draft-for-approval",
    created_at: new Date().toISOString().slice(0, 10),
    raw_text_is_untrusted: true,
    instruction_boundary: "data-not-command",
    raw_intake: raw,
  };
}

function slugify(value) {
  return value
    .replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toUpperCase() || "UNKNOWN";
}
