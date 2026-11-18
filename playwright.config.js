import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node tests/e2e/server.js",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
