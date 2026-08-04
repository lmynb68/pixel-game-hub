const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const ignoredDirs = new Set([".git", "node_modules", "test-results", "playwright-report", ".browser-e2e-profile"]);
const jsFiles = [];
const jsonFiles = [];
const htmlFiles = [];
const workflowFiles = [];
const tomlFiles = [];
const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name) || entry.name.startsWith(".edge-check-")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.name.endsWith(".js")) jsFiles.push(fullPath);
    if (entry.name.endsWith(".json")) jsonFiles.push(fullPath);
    if (entry.name.endsWith(".html")) htmlFiles.push(fullPath);
    if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) workflowFiles.push(fullPath);
    if (entry.name.endsWith(".toml")) tomlFiles.push(fullPath);
  }
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function fail(file, message) {
  failures.push(`${relative(file)} - ${message}`);
}

function lintJavaScript(file) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(file, (result.stderr || result.stdout).trim());
  }
}

function lintJson(file) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, error.message);
  }
}

function lintHtml(file) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.trimStart().toLowerCase().startsWith("<!doctype html>")) fail(file, "missing <!doctype html>");
  if (!html.includes('<meta charset="utf-8">')) fail(file, "missing UTF-8 charset");
  if (/<script[^>]+src=["']\.\/games\.js["']/i.test(html)) fail(file, "must not load removed games.js");

  const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  for (const [index, match] of scriptBlocks.entries()) {
    try {
      new Function(match[1]);
    } catch (error) {
      fail(file, `inline script ${index + 1} is invalid: ${error.message}`);
    }
  }
}

function lintWorkflow(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const required of ["npm ci", "npm run lint", "npm run format:check", "npm test"]) {
    if (!text.includes(required)) fail(file, `missing CI step: ${required}`);
  }
  if (relative(file) === ".github/workflows/ci.yml") {
    for (const required of ["gitleaks/gitleaks-action@v2", "fetch-depth: 0", "GITLEAKS_CONFIG: .gitleaks.toml"]) {
      if (!text.includes(required)) fail(file, `missing Gitleaks CI setting: ${required}`);
    }
  }
}

function lintToml(file) {
  const text = fs.readFileSync(file, "utf8");
  if (relative(file) === ".gitleaks.toml") {
    for (const required of ["[extend]", "useDefault = true", "[[allowlists]]"]) {
      if (!text.includes(required)) fail(file, `missing Gitleaks config setting: ${required}`);
    }
  }
}

walk(root);
jsFiles.forEach(lintJavaScript);
jsonFiles.forEach(lintJson);
htmlFiles.forEach(lintHtml);
workflowFiles.forEach(lintWorkflow);
tomlFiles.forEach(lintToml);

if (failures.length) {
  console.error("Lint failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lint passed: ${jsFiles.length} JS, ${jsonFiles.length} JSON, ${htmlFiles.length} HTML, ${workflowFiles.length} workflow files, ${tomlFiles.length} TOML files`);

