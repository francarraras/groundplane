import { defineConfig } from "@playwright/test";

// Fixture-based browser QA (#34/#26). Boots the real app against the committed
// demo workspace and asserts structural invariants + the browser-write
// invariant at runtime.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    acceptDownloads: true,
    // SwiftShader lets headless Chromium render the Three.js scene without a GPU.
    launchOptions: { args: ["--enable-unsafe-swiftshader", "--no-sandbox"] },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: "npm run app:local",
    url: "http://127.0.0.1:5175/app/",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
