const { test, expect } = require("@playwright/test");

const pageUrl = "http://127.0.0.1:4173/index.html";
const snakeUrl = "http://127.0.0.1:4173/games/snake/index.html";

test.describe("Pixel Game Hub", () => {
  test.beforeEach(async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.goto(pageUrl);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".game-card")).toHaveCount(17);

    test.info().annotations.push({
      type: "browser-errors",
      description: browserErrors.join(" | ") || "none",
    });

    await expect.poll(() => browserErrors.length, {
      message: "No browser console or page errors should occur",
    }).toBe(0);
  });

  test("loads the data-driven game shelf", async ({ page }) => {
    await expect(page).toHaveTitle("Pixel Game Hub - 复古像素游戏厅");
    await expect(page.getByRole("heading", { name: "游戏启动器" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "全部游戏" })).toBeVisible();
    await expect(page.locator("#total-count")).toHaveText("17");
    await expect(page.locator("#playable-count")).toHaveText("17");
    await expect(page.locator("#building-count")).toHaveText("0");
    await expect(page.locator("#folder-count")).toHaveText("17 ITEMS");
    await expect(page.locator(".game-card")).toHaveCount(17);
    await expect(page.locator(".play")).toHaveCount(17);
  });

  test("automatically creates category filters from game data", async ({ page }) => {
    for (const category of ["全部", "经典街机", "动作平台", "音乐节奏", "模拟经营", "类幸存者", "横版卷轴", "休闲益智"]) {
      await expect(page.locator("#filters").getByRole("button", { name: new RegExp(category) })).toBeVisible();
    }

    await page.locator("#filters").getByRole("button", { name: /经典街机/ }).click();
    await expect(page.getByRole("heading", { name: "经典街机" })).toBeVisible();
    await expect(page.locator("#folder-count")).toHaveText("1 ITEMS");
    await expect(page.locator(".game-card")).toHaveCount(1);
    await expect(page.locator(".game-card")).toContainText("像素贪吃蛇");

    await page.locator("#filters").getByRole("button", { name: /动作平台/ }).click();
    await expect(page.getByRole("heading", { name: "动作平台" })).toBeVisible();
    await expect(page.locator(".game-card")).toHaveCount(3);
    await expect(page.locator(".game-card").first()).toContainText("动作平台");
  });

  test("search narrows the automatically rendered cards", async ({ page }) => {
    const search = page.getByPlaceholder("搜索游戏、类型、标签");
    await search.fill("史莱姆");
    await expect(page.locator(".game-card")).toHaveCount(1);
    await expect(page.locator(".game-card")).toContainText("跳跳史莱姆");

    await search.fill("不存在的游戏");
    await expect(page.locator(".empty")).toBeVisible();
  });

  test("opens the real snake game from the shelf", async ({ page }) => {
    await page.locator(".game-card", { hasText: "像素贪吃蛇" }).getByRole("button", { name: "开始游戏" }).click();
    await expect(page).toHaveURL(/games\/snake\/index\.html$/);
    await expect(page).toHaveTitle("像素贪吃蛇");
    await expect(page.getByText("功能清单")).toBeVisible();
    await expect(page.locator("#board")).toBeVisible();
  });

  test("clicking a game records player state", async ({ page }) => {
    await page.locator(".game-card", { hasText: "竹林跑者" }).getByRole("button", { name: "开始游戏" }).click();
    await expect(page.locator("#recent-count")).toHaveText("1 条记录");
    await expect(page.locator("#recent-list")).toContainText("竹林跑者");
    await expect(page.locator("#top-click-label")).toHaveText("1 次");
    await expect(page.locator("#preference-hint")).toContainText("竹林跑者");
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

test.describe("Snake game", () => {
  test("starts, pauses, restarts, and exposes core HUD", async ({ page }) => {
    await page.goto(snakeUrl);
    await expect(page).toHaveTitle("像素贪吃蛇");
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
