// Small filesystem helpers shared by the operator CLI. All writes are atomic
// (stage a temp file, then rename) so a crash mid-write never leaves a partial
// artifact.
import { mkdirSync, writeFileSync, renameSync, appendFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

export function isoDate(now) {
  return (now || new Date()).toISOString().slice(0, 10);
}

export function isoStamp(now) {
  return (now || new Date()).toISOString();
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJsonAtomic(targetPath, value) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      rmSync(tempPath, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

export function appendOperationLog(logPath, entry) {
  mkdirSync(path.dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
}
