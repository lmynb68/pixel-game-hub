const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: [["list"]],
  use: {
    channel: process.env.CI ? undefined : "msedge",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/static-server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 10000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 1200 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 1200 },
      },
    },
  ],
});

