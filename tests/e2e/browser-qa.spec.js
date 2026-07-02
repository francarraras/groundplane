import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkspaceState } from "../../packages/operator/state.js";
import { buildSurfaceModel } from "../../app/src/viewModel.js";
import { ALLOWED_STORAGE_KEYS } from "./allowed-storage-keys.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = "/app/";

// Expected structural counts are DERIVED from the committed fixtures — the same
// files the app fetches — never hard-coded snapshots (#34).
const state = loadWorkspaceState(REPO_ROOT);
const model = buildSurfaceModel(state);
const expectedAreas = model.districts.length;
const expectedConnections = model.relationships.length;
const catalogIds = new Set(state.sources.sources.map((source) => source.id));

// Installed before any app code runs: records any durable write the browser
// attempts. The read-only invariant means this array must stay empty (#26).
const WRITE_SPY = (allowed) => {
  window.__writeViolations = [];
  const allowSet = new Set(allowed);
  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(key, value) {
    if (!allowSet.has(key)) window.__writeViolations.push({ api: "storage.setItem", key });
    return origSetItem.call(this, key, value);
  };
  if (window.indexedDB && window.indexedDB.open) {
    const origOpen = window.indexedDB.open.bind(window.indexedDB);
    window.indexedDB.open = (...args) => {
      window.__writeViolations.push({ api: "indexedDB.open" });
      return origOpen(...args);
    };
  }
  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => {
      window.__writeViolations.push({ api: "navigator.sendBeacon" });
      return origBeacon(...args);
    };
  }
  const origFetch = window.fetch;
  window.fetch = function fetchSpy(input, init) {
    const method = String((init && init.method) || (typeof input === "object" && input && input.method) || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") window.__writeViolations.push({ api: "fetch", method });
    return origFetch.apply(this, arguments);
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(WRITE_SPY, ALLOWED_STORAGE_KEYS);
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForSelector("#world-orientation .orientation-chip", { timeout: 15000 });
});

test("renders areas and connections derived from the fixtures", async ({ page }) => {
  expect(expectedAreas).toBeGreaterThan(0);
  const orientation = await page.locator("#world-orientation").innerText();
  expect(orientation).toContain(`${expectedAreas} areas`);
  expect(orientation).toContain(`${expectedConnections} connections`);

  // The left rail exposes area buttons (capped, with overflow), each a real id.
  const railButtons = page.locator("#region-list [data-region-id]");
  expect(await railButtons.count()).toBeGreaterThan(0);
});

test("core read-only chrome is present", async ({ page }) => {
  await expect(page.locator("#export-context")).toBeVisible();
  await expect(page.locator("#toggle-inspector")).toBeVisible();
  await expect(page.locator("#system-pulse")).toBeVisible();
  await expect(page.locator("#region-list [data-region-id]").first()).toBeVisible();
});

test("exporting the selection downloads a valid, source-cited bundle", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#export-context"),
  ]);
  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle.schema_version).toBe("context-bundle.v1");
  expect(bundle.stats.node_count).toBeGreaterThan(0);
  expect(bundle.browser_writes ?? false).toBeFalsy();
  for (const source of bundle.sources) {
    expect(catalogIds.has(source.id)).toBeTruthy();
  }
});

test("the browser persists nothing during a full interaction", async ({ page }) => {
  // Exercise the main surfaces so write attempts, if any, actually execute.
  await page.click("#toggle-inspector");
  const firstArea = page.locator("#region-list [data-region-id]").first();
  await firstArea.click();
  await page.waitForTimeout(200);
  await firstArea.click(); // drill into the area
  await page.waitForTimeout(200);
  await Promise.all([page.waitForEvent("download"), page.click("#export-context")]);

  const violations = await page.evaluate(() => window.__writeViolations);
  expect(violations, `unexpected browser writes: ${JSON.stringify(violations)}`).toEqual([]);
});
