const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const target = path.normalize(path.join(root, pathname === "/" ? "index.html" : pathname));
  if (!target.startsWith(root)) return null;
  return target;
}

http.createServer((request, response) => {
  const target = resolveRequest(request.url);
  if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const ext = path.extname(target).toLowerCase();
  response.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Pixel Game Hub server running at http://127.0.0.1:${port}`);
});

