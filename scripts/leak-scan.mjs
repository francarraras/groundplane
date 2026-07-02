// Leak scan: fails CI if personal/secret-shaped strings appear in the repo.
// Generic patterns are built in; deployment-specific words come from the
// LEAK_SCAN_EXTRA env var (comma-separated literals, stored as a CI secret so
// the denylist itself never ships in the repo).
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = path.join("scripts", "leak-scan.mjs");

const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".worktrees"]);
const SKIP_FILES = new Set([SELF, "package-lock.json"]);
const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".json", ".jsonl", ".md", ".html", ".css",
  ".yml", ".yaml", ".py", ".txt", ".svg", ".sh", ".gitignore",
]);

// Built assembled so the scanner never matches its own source.
const HOME_PATH = new RegExp("/(?:U" + "sers|ho" + "me)/[A-Za-z0-9._-]+");
// Reserved fiction domains (RFC 2606/6761) are allowed in demo fixtures.
const EMAIL = /[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*(?:example|invalid|test|localhost)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const PATTERNS = [
  { name: "absolute-home-path", regex: HOME_PATH },
  { name: "email-address", regex: EMAIL },
  { name: "openai-style-key", regex: /\bsk-[A-Za-z0-9]{24,}\b/ },
  { name: "aws-access-key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "github-token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { name: "github-fine-grained-token", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "private-key-block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

const extra = (process.env.LEAK_SCAN_EXTRA || "")
  .split(",")
  .map((word) => word.trim())
  .filter((word) => word.length > 2);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(absolute);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(relative)) continue;
      const extension = path.extname(entry.name) || entry.name;
      if (!TEXT_EXTENSIONS.has(extension) && path.extname(entry.name) !== "") continue;
      const info = await stat(absolute);
      if (info.size > 5 * 1024 * 1024) continue;
      yield { absolute, relative };
    }
  }
}

const hits = [];
for await (const file of walk(root)) {
  const content = await readFile(file.absolute, "utf8").catch(() => null);
  if (content === null) continue;
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    for (const { name, regex } of PATTERNS) {
      if (regex.test(line)) hits.push({ file: file.relative, line: index + 1, rule: name });
    }
    for (const word of extra) {
      if (line.toLowerCase().includes(word.toLowerCase())) {
        hits.push({ file: file.relative, line: index + 1, rule: "denylist-word" });
      }
    }
  });
}

if (hits.length > 0) {
  console.error(`leak-scan: ${hits.length} hit(s)`);
  for (const hit of hits) console.error(`  ${hit.file}:${hit.line} [${hit.rule}]`);
  process.exit(1);
}
console.log("leak-scan ok: no personal or secret-shaped strings found");
