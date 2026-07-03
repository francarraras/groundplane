// Validates every state fixture against its JSON Schema (#21), and proves a
// deliberately broken fixture is rejected with a pointed message.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_MAPPINGS,
  validateWorkspaceSchemas,
  validateDataAgainstSchema,
  formatErrors,
} from "./lib/validate-state.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1) Every committed fixture validates.
const { ok, results } = validateWorkspaceSchemas(REPO_ROOT);
if (!ok) {
  for (const result of results.filter((r) => !r.ok)) {
    console.error(`FAIL ${result.file} (schemas/${result.schema}):\n${formatErrors(result.errors)}`);
  }
  process.exit(1);
}

// 2) A deliberately broken fixture fails with a pointed, path-anchored message.
const projects = JSON.parse(readFileSync(path.join(REPO_ROOT, "state/projects.json"), "utf8"));
const broken = {
  ...projects,
  projects: projects.projects.map((project, index) =>
    index === 0 ? { ...project, id: "NOT-A-PROJECT-ID", source_ids: ["oops-not-a-source"] } : project,
  ),
};
const brokenResult = validateDataAgainstSchema(REPO_ROOT, "projects.schema.json", broken);
assert.equal(brokenResult.ok, false, "a broken fixture must fail validation");
const message = formatErrors(brokenResult.errors);
assert.match(message, /\/projects\/0\/id/, "error points at the offending id path");
assert.match(message, /\/projects\/0\/source_ids\/0/, "error points at the offending source id path");
assert.match(message, /pattern/, "error explains the pattern violation");

console.log(
  `schemas ok: ${SCHEMA_MAPPINGS.length} state files validate; broken fixtures are rejected with pointed messages`,
);
