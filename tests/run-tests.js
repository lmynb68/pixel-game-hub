const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const gamesPath = path.join(root, "games.json");
const scriptPath = path.join(root, "script.js");
const stylePath = path.join(root, "style.css");
const snapshotPath = path.join(__dirname, "snapshots", "index.snapshot.json");
const args = new Set(process.argv.slice(2));

const runAll = args.size === 0;
const wants = {
  unit: runAll || args.has("--unit"),
  sourceSnapshot: runAll || args.has("--source-snapshot") || args.has("--regression"),
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
  assert(fs.existsSync(gamesPath), "games.json does not exist");
  const data = JSON.parse(fs.readFileSync(gamesPath, "utf8"));
  const overrides = data.customOverrides || {};
  const rawGames = Array.isArray(data.games) ? data.games : [];
  const games = rawGames.map((game) => ({
    ...game,
    ...(overrides[game.id] || {})
  }));
  return { games, overrides };
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

function canResolveUrl(value) {
  try {
    const url = new URL(value, "http://example.test/");
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function getSnapshot(html) {
  const text = getTextContent(html);
  const { games } = readGames();
  return {
    title: (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "",
    dataFileGames: games.length,
    categories: ["全部", ...new Set(games.map((game) => game.category))],
    requiredChinese: ["复古街机游戏厅", "街机小馆营业中", "全部游戏"].filter((item) => text.includes(item)),
    requiredScripts: ["script.js"].filter((item) => html.includes(item)),
    requiredStyles: ["style.css"].filter((item) => html.includes(item)),
    usesJsonData: fs.existsSync(gamesPath),
    cssHash: crypto
      .createHash("sha256")
      .update(fs.existsSync(stylePath) ? fs.readFileSync(stylePath, "utf8") : "")
      .digest("hex"),
    scriptHash: crypto
      .createHash("sha256")
      .update(fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "")
      .digest("hex"),
    gamesHash: crypto
      .createHash("sha256")
      .update(fs.existsSync(gamesPath) ? fs.readFileSync(gamesPath, "utf8") : "")
      .digest("hex"),
  };
}

if (wants.unit) {
  test("unit: HTML document essentials exist", () => {
    const html = readHtml();
    assert(html.trimStart().toLowerCase().startsWith("<!doctype html>"), "Missing <!doctype html>");
    assert(html.includes('<html lang="zh-CN">'), "Missing zh-CN language");
    assert(html.includes('<meta charset="utf-8">'), "Missing UTF-8 charset");
    assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'), "Missing responsive viewport");
    assert(html.includes("<main"), "Missing main content area");
    assert(!html.includes("./games.js"), "index.html should no longer load games.js");
    assert(fs.existsSync(gamesPath), "Missing games.json data file");
    assert(fs.existsSync(stylePath), "Missing style.css stylesheet");
    assert(fs.existsSync(scriptPath), "Missing script.js render script");
    assert(html.includes("./style.css"), "Missing style.css link");
    assert(html.includes("./script.js"), "Missing script.js render script");
    assert(!html.includes("<style>"), "index.html should not keep the main stylesheet inline");
    assert(!html.includes("./app.js"), "index.html should no longer load app.js");
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
    for (const phrase of ["复古街机游戏厅", "街机小馆营业中", "本店游戏单", "全部游戏", "随机游戏"]) {
      assert(text.includes(phrase), `Missing required phrase: ${phrase}`);
    }
    assert(html.includes('placeholder="搜索游戏、玩法、标签"'), "Missing search input placeholder");
  });

  test("unit: game data can drive the shelf automatically", () => {
    const { games, overrides } = readGames();
    assert(games.length > 0, "Expected at least one game");
    assert(games.every((game) => game.id && game.title && game.category && game.status), "Every game needs id, title, category, and status");
    assert(new Set(games.map((game) => game.id)).size === games.length, "Game ids must be unique");
    assert(overrides && typeof overrides === "object", "GAME_CUSTOM_OVERRIDES must exist");
    const pendingGames = games.filter((game) => !game.url);
    const playableGames = games.filter((game) => game.url);
    assert(playableGames.length > 0, "At least one game should have a playable URL");
    assert(pendingGames.every((game) => game.status === "待接入"), "Games without a URL should be marked 待接入");
    assert(pendingGames.every((game) => overrides[game.id]), "Every pending game needs a customization entry");
    assert(pendingGames.every((game) => Object.hasOwn(overrides[game.id], "title")), "Every customization entry needs title");
    assert(pendingGames.every((game) => Object.hasOwn(overrides[game.id], "coverImage")), "Every customization entry needs coverImage");
    assert(pendingGames.every((game) => Object.hasOwn(overrides[game.id], "description")), "Every customization entry needs description");
    assert(new Set(games.map((game) => game.category)).size > 1, "Game data should expose more than one category");
    const snake = games.find((game) => game.id === "pixel-snake");
    assert(snake && snake.url === "./games/snake/index.html", "Snake game must be linked from data");
    assert(fs.existsSync(path.join(root, "games", "snake", "index.html")), "Snake game file does not exist");
  });

  test("unit: game data has a useful schema", () => {
    const { games } = readGames();
    for (const game of games) {
      assert(typeof game.id === "string" && game.id.trim(), "Every game needs a stable string id");
      assert(typeof game.title === "string" && game.title.trim(), `${game.id} needs a display title`);
      assert(typeof game.category === "string" && game.category.trim(), `${game.id} needs a category`);
      assert(!game.tags || Array.isArray(game.tags), `${game.id} tags must be an array when present`);
      assert(!game.colors || (Array.isArray(game.colors) && game.colors.length >= 4), `${game.id} colors must contain at least 4 colors when present`);
      for (const key of ["url", "coverImage", "videoUrl"]) {
        if (game[key]) assert(canResolveUrl(game[key]), `${game.id} has an invalid ${key}`);
      }
      if (game.url && game.url.startsWith("./games/")) {
        assert(fs.existsSync(path.join(root, game.url)), `${game.id} local url target does not exist`);
      }
      if (game.coverImage && game.coverImage.startsWith("./")) {
        assert(fs.existsSync(path.join(root, game.coverImage)), `${game.id} local coverImage target does not exist`);
      }
    }
  });

  test("unit: renderer contains fallback guards for optional data", () => {
    const script = fs.readFileSync(scriptPath, "utf8");
    assert(script.includes("function normalizeGame"), "Missing game normalization guard");
    assert(script.includes("defaultColors"), "Missing default colors for games without colors");
    assert(script.includes("normalizeActivity"), "Missing localStorage recovery guard");
    assert(script.includes("normalizeUrl"), "Missing URL sanitization guard");
    assert(script.includes("playable: Boolean(url)"), "Missing playable flag based on real launch URL");
    assert(script.includes("videoUrl"), "Missing configurable video URL support");
  });

  test("unit: official Toy upload structure exists", () => {
    const html = readHtml();
    assert(fs.existsSync(path.join(root, "images")), "Missing images resource directory");
    assert(html.includes('<link rel="stylesheet" href="./style.css">'), "index.html should link root style.css");
    assert(html.includes('<script src="./script.js"></script>'), "index.html should load root script.js");
    assert(!fs.existsSync(path.join(root, "app.js")), "Old app.js should be renamed to script.js");
  });

  test("unit: removed design directions did not return", () => {
    const html = readHtml();
    for (const phrase of ["方案 A", "方案 B", "方案 D", "山海卷轴", "暗色赛博", "NEON GAME NODE"]) {
      assert(!html.includes(phrase), `Unexpected old design phrase found: ${phrase}`);
    }
  });
}

if (wants.sourceSnapshot) {
  test("source snapshot: page source contract matches expected content", () => {
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
    assert(JSON.stringify(actual, null, 2) === JSON.stringify(expected, null, 2), "Source snapshot changed. Review the page and update tests/snapshots/index.snapshot.json if intentional.");
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

