const { test, expect } = require("@playwright/test");
const { serverUrl } = require("../server-config");
const gameData = require("../../games.json");

const games = gameData.games.map((game) => ({
  ...game,
  ...((gameData.customOverrides || {})[game.id] || {})
}));
const playableGames = games.filter((game) => game.url);
const pendingGames = games.filter((game) => !game.url);
const categories = ["全部", ...new Set(games.map((game) => game.category))];
const pageUrl = `${serverUrl}/index.html`;
const playableGame = playableGames[0];
const playableUrl = new URL(playableGame.url, pageUrl).href;
const playableUrlPattern = new RegExp(playableGames
  .map((game) => new URL(game.url, pageUrl).href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|"));

function categoryCount(category) {
  return category === "全部" ? games.length : games.filter((game) => game.category === category).length;
}

test.describe("街机收藏馆", () => {
  test.beforeEach(async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.goto(pageUrl);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".game-card")).toHaveCount(games.length);

    test.info().annotations.push({
      type: "browser-errors",
      description: browserErrors.join(" | ") || "none",
    });

    await expect.poll(() => browserErrors.length, {
      message: "No browser console or page errors should occur",
    }).toBe(0);
  });

  test("loads the data-driven game shelf", async ({ page }) => {
    await expect(page).toHaveTitle("街机收藏馆 - 街机小馆营业中");
    await expect(page.getByRole("heading", { name: "街机小馆营业中" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "全部游戏" })).toBeVisible();
    await expect(page.locator("#total-count")).toHaveText(String(games.length));
    await expect(page.locator("#playable-count")).toHaveText(String(playableGames.length));
    await expect(page.locator("#building-count")).toHaveText(String(pendingGames.length));
    await expect(page.locator("#folder-count")).toHaveText(`${games.length} 款`);
    await expect(page.locator(".game-card")).toHaveCount(games.length);
    await expect(page.locator(".play")).toHaveCount(games.length);
    await expect(page.locator(".play:not(:disabled)")).toHaveCount(playableGames.length);
  });

  test("shows each card's status, description, tags, and activity", async ({ page }) => {
    const firstCard = page.locator(".game-card", { hasText: playableGame.title });
    await expect(firstCard.locator(".status")).toBeVisible();
    await expect(firstCard.locator(".status")).toHaveText("可开玩");
    await expect(firstCard.locator(".desc")).toBeVisible();
    await expect(firstCard.locator(".desc")).toContainText(playableGame.description.slice(0, 6));
    await expect(firstCard.locator(".tag-row .pill").first()).toBeVisible();
    await expect(firstCard.locator(".activity")).toBeVisible();
    await expect(firstCard.locator(".meta-row")).toContainText(playableGame.category);
  });

  test("automatically creates category filters from game data", async ({ page }) => {
    for (const category of categories) {
      await expect(page.locator("#filters").getByRole("button", { name: new RegExp(category) })).toBeVisible();
    }

    await page.locator("#filters").getByRole("button", { name: new RegExp(playableGame.category) }).click();
    await expect(page.getByRole("heading", { name: playableGame.category })).toBeVisible();
    await expect(page.locator("#folder-count")).toHaveText(`${categoryCount(playableGame.category)} 款`);
    await expect(page.locator(".game-card")).toHaveCount(categoryCount(playableGame.category));
    await expect(page.locator(".game-card")).toContainText(playableGame.title);

    if (pendingGames.length) {
      const pendingGame = pendingGames[0];
      await page.locator("#filters").getByRole("button", { name: /全部/ }).click();
      await expect(page.locator(".game-card", { hasText: pendingGame.title }).getByRole("button", { name: "即将开放" })).toBeDisabled();
    }
  });

  test("search narrows the automatically rendered cards", async ({ page }) => {
    const searchGame = games.find((game) => game.id !== playableGame.id) || playableGame;
    const search = page.getByPlaceholder("搜索游戏、玩法、标签");
    const searchButton = page.getByRole("button", { name: "搜索" });
    await expect(searchButton).toBeVisible();
    await search.fill(searchGame.title);
    await searchButton.click();
    await expect(page.locator(".game-card")).toHaveCount(1);
    await expect(page.locator(".game-card")).toContainText(searchGame.title);

    await search.fill("不存在的游戏");
    await searchButton.click();
    await expect(page.locator(".empty")).toBeVisible();
  });

  test("opens the real playable game from the shelf", async ({ page }) => {
    await page.locator(".game-card", { hasText: playableGame.title }).getByRole("button", { name: "开始游戏" }).click();
    await expect(page).toHaveURL(playableUrl);
    await expect(page).toHaveTitle(playableGame.title);
    await expect(page.getByText("玩法提示")).toBeVisible();
    await expect(page.getByText("已实现")).toHaveCount(0);
    await expect(page.locator("#board")).toBeVisible();
  });

  test("clicking a game records player state", async ({ page }) => {
    await page.locator(".game-card", { hasText: playableGame.title }).getByRole("button", { name: "开始游戏" }).click();
    await page.goto(pageUrl);
    await expect(page.locator("#recent-count")).toHaveText("1 次");
    await expect(page.locator("#recent-list")).toContainText(playableGame.title);
    await expect(page.locator("#top-click-label")).toHaveText("1 次");
    await expect(page.locator("#preference-hint")).toContainText(playableGame.title);
    await expect(page.locator("#preference-hint")).toContainText("常玩榜首");
    await expect(page.locator("#preference-hint")).not.toContainText("记住");
    await expect(page.locator("#preference-hint")).not.toContainText("这里");
  });

  test("random launch records a playable game without breaking the shelf", async ({ page }) => {
    await page.getByRole("button", { name: "随机游戏" }).click();
    await expect(page).toHaveURL(playableUrlPattern);
    await page.goto(pageUrl);
    await expect(page.locator("#recent-count")).toHaveText("1 次");
  });

  test("video controls reflect configured video URLs", async ({ page }) => {
    const videoGames = games.filter((game) => game.videoUrl);
    await expect(page.locator(".video")).toHaveCount(games.length);
    await expect(page.locator(".video:not(:disabled)")).toHaveCount(videoGames.length);
    await expect(page.locator(".video:disabled")).toHaveCount(games.length - videoGames.length);
  });

  test("exposes basic accessible structure and named controls", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('[aria-label="玩家状态"]')).toBeVisible();
    await expect(page.locator('[aria-label="游戏类型筛选"]')).toBeVisible();
    await expect(page.getByPlaceholder("搜索游戏、玩法、标签")).toBeVisible();
    await expect(page.getByRole("button", { name: "搜索" })).toBeVisible();
    await expect(page.getByRole("button", { name: "随机游戏" })).toBeVisible();
  });

  test("has usable layout at the current viewport", async ({ page }, testInfo) => {
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyHeight: document.body.scrollHeight,
      cards: [...document.querySelectorAll(".game-card")].map((card) => {
        const rect = card.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.bodyHeight).toBeGreaterThan(650);
    for (const card of metrics.cards) {
      expect(card.width).toBeGreaterThan(90);
      expect(card.height).toBeGreaterThan(170);
    }

    await page.screenshot({
      path: testInfo.outputPath(`pixel-hub-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});

test.describe("街机收藏馆 resilience", () => {
  test("recovers when saved player state is corrupted", async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem("pixel-game-hub-state", "{bad json");
    });
    await page.goto(pageUrl);

    await expect(page.locator(".game-card")).toHaveCount(games.length);
    await expect(page.locator("#recent-count")).toHaveText("0 次");
    expect(browserErrors).toEqual([]);
  });

  test("drops stale saved player state for removed games", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pixel-game-hub-state", JSON.stringify({
        clicks: { "ghost-game": 9 },
        recent: [{ id: "ghost-game", title: "已经删除的游戏", timeLabel: "12:00" }]
      }));
    });
    await page.goto(pageUrl);

    await expect(page.locator("#recent-count")).toHaveText("0 次");
    await expect(page.locator("#recent-list")).not.toContainText("已经删除的游戏");
  });

  test("renders incomplete game data with safe defaults", async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.route("**/games.json", (route) => route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        customOverrides: {},
        games: [
          { id: "bare-game", title: "空字段测试", status: "已上线" },
          { category: "实验分类" }
        ]
      })
    }));
    await page.goto(pageUrl);

    await expect(page.locator(".game-card")).toHaveCount(2);
    await expect(page.locator(".game-card").first()).toContainText("空字段测试");
    await expect(page.locator(".game-card").nth(1)).toContainText("未命名游戏 2");
    await expect(page.locator("#filters").getByRole("button", { name: /未分类/ })).toBeVisible();
    await expect(page.locator("#filters").getByRole("button", { name: /实验分类/ })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test("opens configured video URLs and ignores unsafe cover or color data", async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.route("**/games.json", (route) => route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        customOverrides: {},
        games: [
          {
            id: "safe-video",
            title: "视频测试",
            category: "实验分类",
            status: "已上线",
            description: "用来检查视频跳转和封面安全处理。",
            tags: ["视频"],
            colors: ["red;position:fixed", "#fff", "#000", "#333"],
            coverImage: "javascript:alert(1)",
            videoUrl: "./games/snake/index.html"
          }
        ]
      })
    }));
    await page.goto(pageUrl);

    const card = page.locator(".game-card", { hasText: "视频测试" });
    await expect(card.locator(".video")).toBeEnabled();
    await expect(card.locator(".cover")).not.toHaveClass(/has-image/);
    const color = await card.evaluate((node) => getComputedStyle(node).getPropertyValue("--c1").trim());
    expect(color).toBe("#70d6ff");
    await card.getByRole("button", { name: "查看视频" }).click();
    await expect(page).toHaveURL(/games\/snake\/index\.html$/);
    expect(browserErrors).toEqual([]);
  });
});

test.describe("Snake game", () => {
  test("starts, pauses, restarts, and exposes core HUD", async ({ page }) => {
    await page.goto(playableUrl);
    await expect(page).toHaveTitle(playableGame.title);
    await expect(page.locator("#score")).toHaveText("0");
    await expect(page.locator("#best")).toBeVisible();
    await expect(page.locator("#speed")).toHaveText("1");
    await expect(page.locator("#overlay-title")).toHaveText("READY?");

    await page.getByRole("button", { name: "START / PAUSE" }).click();
    await expect(page.locator("#overlay")).toHaveClass(/hidden/);

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(180);
    await page.getByRole("button", { name: "START / PAUSE" }).click();
    await expect(page.locator("#overlay-title")).toHaveText("PAUSED");

    await page.getByRole("button", { name: "RESTART" }).click();
    await expect(page.locator("#overlay")).toHaveClass(/hidden/);
    await expect(page.locator("#score")).toHaveText("0");
  });
});

