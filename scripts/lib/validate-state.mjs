// @ts-check
// JSON Schema validation for the public state files (#21).
//
// The state files are the project's public API. These schemas (schemas/*.json)
// replace the prose-only spec and are enforced by ajv in CI and by the graph
// compiler, so fixtures stay valid and future migrations have a contract.
import Ajv from "ajv";
import { readFileSync } from "node:fs";
import path from "node:path";

// schema file  ->  the state file it governs.
export const SCHEMA_MAPPINGS = [
  { schema: "projects.schema.json", file: "state/projects.json" },
  { schema: "tasks.schema.json", file: "state/tasks.json" },
  { schema: "sources.schema.json", file: "sources/catalog.json" },
  { schema: "decisions.schema.json", file: "state/decisions.json" },
  { schema: "review-queue.schema.json", file: "reviews/queue.json" },
  { schema: "memory-claims.schema.json", file: "wiki/memory-claims.json" },
];

function ajv() {
  const AjvCtor = /** @type {any} */ (Ajv);
  return new AjvCtor({ allErrors: true, strict: false });
}

/**
 * @param {string} repoRoot
 * @param {string} schemaName
 * @returns {any}
 */
function loadSchema(repoRoot, schemaName) {
  return JSON.parse(readFileSync(path.join(repoRoot, "schemas", schemaName), "utf8"));
}

/**
 * Pointed, human-readable error lines (path + what's wrong).
 * @param {any[]} [errors]
 * @returns {string}
 */
export function formatErrors(errors) {
  return (errors || [])
    .map((error) => {
      const where = error.instancePath || "(root)";
      const extra = error.params && Object.keys(error.params).length ? ` — ${JSON.stringify(error.params)}` : "";
      return `    ${where} ${error.message}${extra}`;
    })
    .join("\n");
}

/**
 * @param {string} repoRoot
 * @param {string} schemaName
 * @param {any} data
 * @returns {{ ok: boolean, errors: any[] }}
 */
export function validateDataAgainstSchema(repoRoot, schemaName, data) {
  const validate = ajv().compile(loadSchema(repoRoot, schemaName));
  const ok = validate(data);
  return { ok, errors: ok ? [] : validate.errors };
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, results: Array<{ schema: string, file: string, ok: boolean, errors: any[] }> }}
 */
export function validateWorkspaceSchemas(repoRoot) {
  const results = SCHEMA_MAPPINGS.map(({ schema, file }) => {
    const data = JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));
    const { ok, errors } = validateDataAgainstSchema(repoRoot, schema, data);
    return { schema, file, ok, errors };
  });
  return { ok: results.every((result) => result.ok), results };
}

/**
 * Throwing variant for callers (e.g. the graph compiler) that must fail fast.
 * @param {string} repoRoot
 * @returns {void}
 */
export function assertWorkspaceSchemas(repoRoot) {
  const { ok, results } = validateWorkspaceSchemas(repoRoot);
  if (ok) return;
  const report = results
    .filter((result) => !result.ok)
    .map((result) => `  ${result.file} (schemas/${result.schema}):\n${formatErrors(result.errors)}`)
    .join("\n");
  throw new Error(`State files failed JSON Schema validation:\n${report}`);
}
