const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(__dirname, "static-server.js");
const playwrightCli = path.join(root, "node_modules", "playwright", "cli.js");
const port = Number(process.env.PORT || 4173);
const url = `http://127.0.0.1:${port}`;
const args = ["test", ...process.argv.slice(2)];

function waitForServer(deadlineMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function probe() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Local test server did not start at ${url}`));
          return;
        }
        setTimeout(probe, 150);
      });
      request.setTimeout(1000, () => {
        request.destroy();
      });
    }
    probe();
  });
}

async function main() {
  const server = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });

  let exitCode = 1;
  try {
    await waitForServer();
    exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [playwrightCli, ...args], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
      });
      child.on("exit", (code) => resolve(code || 0));
    });
  } finally {
    if (!server.killed) server.kill();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

