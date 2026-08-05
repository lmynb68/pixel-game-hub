const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function parseArgs(argv) {
  const args = { root, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || "");
      index += 1;
    } else if (!args.source) {
      args.source = path.resolve(arg);
    } else {
      throw new Error(`无法识别的参数：${arg}`);
    }
  }
  if (!args.source) throw new Error("请提供作品文件夹，例如：npm run game:import -- ./incoming/my-demo");
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function copyRecursive(source, target, ignoredNames = new Set()) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (ignoredNames.has(entry.name)) continue;
      copyRecursive(path.join(source, entry.name), path.join(target, entry.name), ignoredNames);
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function findFirstImage(sourceDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && imageExts.has(path.extname(entry.name).toLowerCase())) {
      return entry.name;
    }
  }
  return "";
}

function resolveLocal(sourceDir, relativePath) {
  const target = path.resolve(sourceDir, relativePath);
  if (!target.startsWith(`${sourceDir}${path.sep}`) && target !== sourceDir) {
    throw new Error(`路径不能跳出作品文件夹：${relativePath}`);
  }
  return target;
}

function normalizeColors(colors) {
  if (!colors) return undefined;
  if (!Array.isArray(colors) || colors.length < 4) throw new Error("colors 至少需要 4 个颜色值");
  const safe = colors.slice(0, 4).map((color) => String(color).trim());
  if (!safe.every((color) => /^#[0-9a-f]{3,8}$/i.test(color))) throw new Error("colors 只能使用 HEX 颜色，例如 #70d6ff");
  return safe;
}

function buildRecord(manifest, sourceDir, projectRoot, options = {}) {
  const id = slugify(manifest.id || manifest.title);
  if (!id) throw new Error("game.json 需要 title，或提供可用的 id");
  if (!manifest.title) throw new Error("game.json 缺少 title");
  if (!manifest.description) throw new Error("game.json 缺少 description");

  const entry = manifest.entry || "index.html";
  const cover = manifest.coverImage || manifest.cover || findFirstImage(sourceDir);
  let url = manifest.url || "";
  let coverImage = isRemoteUrl(cover) ? cover : "";

  if (!url && entry) {
    const entryPath = resolveLocal(sourceDir, entry);
    if (fs.existsSync(entryPath)) {
      const targetDir = path.join(projectRoot, "games", id);
      const relativeEntry = toPosix(path.relative(sourceDir, entryPath));
      url = `./games/${id}/${relativeEntry}`;
      if (!options.dryRun) copyRecursive(sourceDir, targetDir, new Set(["game.json"]));
    }
  }

  if (cover && !coverImage) {
    const coverPath = resolveLocal(sourceDir, cover);
    if (fs.existsSync(coverPath) && fs.statSync(coverPath).isFile()) {
      const ext = path.extname(coverPath).toLowerCase() || ".png";
      const targetName = `${id}-cover${ext}`;
      const targetPath = path.join(projectRoot, "images", targetName);
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(coverPath, targetPath);
      }
      coverImage = `./images/${targetName}`;
    }
  }

  return {
    override: {
      title: manifest.title,
      coverImage,
      description: manifest.description
    },
    game: {
      id,
      category: manifest.category || "原型 DEMO",
      releaseDate: manifest.releaseDate || new Date().toISOString().slice(0, 10),
      status: url ? "已上线" : "待接入",
      pinned: Boolean(manifest.pinned),
      tags: Array.isArray(manifest.tags) ? manifest.tags.filter(Boolean) : [],
      clicks: 0,
      lastPlayed: "",
      video: Boolean(manifest.videoUrl),
      ...(url ? { url } : {}),
      ...(manifest.videoUrl ? { videoUrl: manifest.videoUrl } : {}),
      ...(normalizeColors(manifest.colors) ? { colors: normalizeColors(manifest.colors) } : {})
    }
  };
}

function upsertGame(data, record) {
  data.customOverrides = data.customOverrides || {};
  data.games = Array.isArray(data.games) ? data.games : [];
  data.customOverrides[record.game.id] = record.override;

  const index = data.games.findIndex((game) => game.id === record.game.id);
  if (index >= 0) {
    data.games[index] = { ...data.games[index], ...record.game };
  } else {
    data.games.push(record.game);
  }
}

function importGame(options) {
  const projectRoot = path.resolve(options.root || root);
  const sourceDir = path.resolve(options.source);
  const manifestPath = path.join(sourceDir, "game.json");
  const gamesPath = path.join(projectRoot, "games.json");

  if (!fs.existsSync(manifestPath)) throw new Error("作品文件夹里需要 game.json");
  if (!fs.existsSync(gamesPath)) throw new Error("项目根目录缺少 games.json");

  const manifest = readJson(manifestPath);
  const data = readJson(gamesPath);
  const record = buildRecord(manifest, sourceDir, projectRoot, { dryRun: options.dryRun });
  upsertGame(data, record);

  if (!options.dryRun) writeJson(gamesPath, data);
  return record;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const record = importGame(options);
    const mode = options.dryRun ? "预览" : "已导入";
    console.log(`${mode}：${record.override.title}`);
    console.log(`id：${record.game.id}`);
    console.log(`入口：${record.game.url || "待接入"}`);
    console.log(`封面：${record.override.coverImage || "默认封面"}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  buildRecord,
  importGame,
  parseArgs,
  slugify
};

