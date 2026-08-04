const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { host, defaultPort, getServerUrl } = require("./server-config");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(__dirname, "static-server.js");
const playwrightCli = path.join(root, "node_modules", "playwright", "cli.js");
const args = ["test", ...process.argv.slice(2)];
let port;
let serverUrl;

function findOpenPort(startPort = defaultPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        findOpenPort(startPort + 1).then(resolve, reject);
        return;
      }
      reject(error);
    });
    server.listen(startPort, host, () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForServer(deadlineMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function probe() {
      const request = http.get(serverUrl, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Local test server did not start at ${serverUrl}`));
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
  port = process.env.PORT ? Number(process.env.PORT) : await findOpenPort();
  serverUrl = getServerUrl(port);
  const childEnv = { ...process.env, PORT: String(port) };
  const server = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: childEnv,
    stdio: "ignore",
    windowsHide: true,
  });

  let exitCode = 1;
  try {
    await waitForServer();
    exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [playwrightCli, ...args], {
        cwd: root,
        env: childEnv,
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

