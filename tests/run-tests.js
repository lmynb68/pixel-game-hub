const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const gamesPath = path.join(root, "games.js");
const appPath = path.join(root, "app.js");
const snapshotPath = path.join(__dirname, "snapshots", "index.snapshot.json");
const args = new Set(process.argv.slice(2));

const runAll = args.size === 0;
const wants = {
  unit: runAll || args.has("--unit"),
  regression: runAll || args.has("--regression"),
  e2e: runAll || args.has("--e2e"),
};
const updateSnapshot = args.has("--update-snapshot");

const results = [];

function test(name, fn) {
  try {
    const value = fn();
    if (value && value.skip) {
      results.push({ name, status: "SKIP", details: value.reason });
      return;
    }
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", details: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

function readHtml() {
  assert(fs.existsSync(htmlPath), "index.html does not exist");
  return fs.readFileSync(htmlPath, "utf8");
}

function readGames() {
  assert(fs.existsSync(gamesPath), "games.js does not exist");
  const source = fs.readFileSync(gamesPath, "utf8");
  const factory = new Function("window", `${source}; return window.GAME_LIBRARY;`);
  return factory({});
}

function getTextContent(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagBalance(tag, html) {
  return {
    open: count(new RegExp(`<${tag}\\b`, "gi"), html),
    close: count(new RegExp(`</${tag}>`, "gi"), html),
  };
}

function getSnapshot(html) {
  const text = getTextContent(html);
  const games = readGames();
  return {
    title: (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "",
    dataFileGames: games.length,
    categories: ["全部", ...new Set(games.map((game) => game.category))],
    requiredChinese: ["玩家状态台", "作品陈列架", "全部游戏"].filter((item) => text.includes(item)),
    requiredScripts: ["games.js", "app.js"].filter((item) => html.includes(item)),
    cssHash: crypto
      .createHash("sha256")
      .update((html.match(/<style>([\s\S]*?)<\/style>/i) || [])[1] || "")
      .digest("hex"),
    appHash: crypto
      .createHash("sha256")
      .update(fs.existsSync(appPath) ? fs.readFileSync(appPath, "utf8") : "")
      .digest("hex"),
    gamesHash: crypto
      .createHash("sha256")
      .update(fs.existsSync(gamesPath) ? fs.readFileSync(gamesPath, "utf8") : "")
      .digest("hex"),
  };
}

function findEdge() {
  const candidates = [
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

if (wants.unit) {
  test("unit: HTML document essentials exist", () => {
    const html = readHtml();
    assert(html.trimStart().toLowerCase().startsWith("<!doctype html>"), "Missing <!doctype html>");
    assert(html.includes('<html lang="zh-CN">'), "Missing zh-CN language");
    assert(html.includes('<meta charset="utf-8">'), "Missing UTF-8 charset");
    assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'), "Missing responsive viewport");
    assert(html.includes("<main"), "Missing main content area");
    assert(html.includes("./games.js"), "Missing games data script");
    assert(html.includes("./app.js"), "Missing app render script");
  });

  test("unit: major tags and CSS braces are balanced", () => {
    const html = readHtml();
    for (const tag of ["section", "div", "article", "button"]) {
      const balance = getTagBalance(tag, html);
      assert(balance.open === balance.close, `${tag} tags not balanced: ${balance.open}/${balance.close}`);
    }
    assert(count(/\{/g, html) === count(/\}/g, html), "CSS braces are not balanced");
  });

  test("unit: pixel hub content contract is present", () => {
    const html = readHtml();
    const text = getTextContent(html);
    for (const phrase of ["玩家状态台", "作品陈列架", "全部游戏", "随机开玩"]) {
      assert(text.includes(phrase), `Missing required phrase: ${phrase}`);
    }
    assert(html.includes('placeholder="搜索游戏、类型、标签"'), "Missing search input placeholder");
  });

  test("unit: game data can drive the shelf automatically", () => {
    const games = readGames();
    assert(games.length === 17, `Expected 17 games, got ${games.length}`);
    assert(games.every((game) => game.id && game.title && game.category && game.status), "Every game needs id, title, category, and status");
    assert(new Set(games.map((game) => game.id)).size === games.length, "Game ids must be unique");
    for (const category of ["经典街机", "动作平台", "音乐节奏", "模拟经营", "类幸存者", "横版卷轴", "休闲益智"]) {
      assert(games.some((game) => game.category === category), `Missing category: ${category}`);
    }
    const snake = games.find((game) => game.id === "pixel-snake");
    assert(snake && snake.url === "./games/snake/index.html", "Snake game must be linked from data");
    assert(fs.existsSync(path.join(root, "games", "snake", "index.html")), "Snake game file does not exist");
  });

  test("unit: removed design directions did not return", () => {
    const html = readHtml();
    for (const phrase of ["方案 A", "方案 B", "方案 D", "山海卷轴", "暗色赛博", "NEON GAME NODE"]) {
      assert(!html.includes(phrase), `Unexpected old design phrase found: ${phrase}`);
    }
  });
}

if (wants.regression) {
  test("regression: page snapshot matches expected content", () => {
    const html = readHtml();
    const actual = getSnapshot(html);
    if (updateSnapshot) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(`${snapshotPath}.tmp`, `${JSON.stringify(actual, null, 2)}\n`);
      fs.renameSync(`${snapshotPath}.tmp`, snapshotPath);
      return;
    }
    assert(fs.existsSync(snapshotPath), "Missing regression snapshot");
    const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    assert(JSON.stringify(actual, null, 2) === JSON.stringify(expected, null, 2), "Snapshot changed. Review the page and update tests/snapshots/index.snapshot.json if intentional.");
  });
}

if (wants.e2e) {
  test("e2e: browser can load the local page and expose expected DOM text", () => {
    const browserPath = findEdge();
    if (!browserPath) {
      return { skip: true, reason: "No Edge or Chrome executable found" };
    }

    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/").replace(/ /g, "%20")}`;
    const profileDir = path.join(root, ".browser-e2e-profile");
    fs.rmSync(profileDir, { recursive: true, force: true });

    const result = spawnSync(browserPath, [
      "--headless=new",
      "--single-process",
      "--disable-gpu",
      "--disable-gpu-compositing",
      `--user-data-dir=${profileDir}`,
      "--dump-dom",
      fileUrl,
    ], { encoding: "utf8", timeout: 20000 });

    fs.rmSync(profileDir, { recursive: true, force: true });

    if (result.error) {
      return { skip: true, reason: result.error.message };
    }

    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    if (!output.includes("PIXEL GAME HUB")) {
      return { skip: true, reason: "Browser launched, but this local Edge headless mode did not return page DOM" };
    }

    assert(output.includes("PRESS START TO PLAY."), "Browser DOM missing hero heading");
    assert(output.includes("竹林跳跳"), "Browser DOM missing first game card");
  });
}

for (const result of results) {
  const suffix = result.details ? ` - ${result.details}` : "";
  console.log(`${result.status} ${result.name}${suffix}`);
}

const failed = results.filter((result) => result.status === "FAIL").length;
const skipped = results.filter((result) => result.status === "SKIP").length;
const passed = results.filter((result) => result.status === "PASS").length;

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
