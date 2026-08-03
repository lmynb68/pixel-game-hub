const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mode = process.argv.includes("--write") ? "write" : "check";
const ignoredDirs = new Set([".git", "node_modules", "test-results", "playwright-report", ".browser-e2e-profile"]);
const extensions = new Set([".html", ".js", ".json", ".md", ".yml", ".yaml"]);
const changed = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name) || entry.name.startsWith(".edge-check-")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) checkFile(fullPath);
  }
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n*$/g, "\n");
}

function checkFile(file) {
  const original = fs.readFileSync(file, "utf8");
  const formatted = normalize(original);
  if (original === formatted) return;

  changed.push(relative(file));
  if (mode === "write") fs.writeFileSync(file, formatted);
}

walk(root);

if (changed.length && mode === "check") {
  console.error("Format check failed:");
  for (const file of changed) console.error(`- ${file}`);
  console.error("Run npm run format to fix these files.");
  process.exit(1);
}

if (mode === "write") {
  console.log(changed.length ? `Formatted ${changed.length} files` : "All files already formatted");
} else {
  console.log("Format check passed");
}

