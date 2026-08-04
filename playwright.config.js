const { defineConfig, devices } = require("@playwright/test");
const { serverUrl } = require("./tests/server-config");

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
    url: serverUrl,
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

