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
    await expect(page.locator("#playable-count")).toHaveText("1");
    await expect(page.locator("#building-count")).toHaveText("0");
    await expect(page.locator("#folder-count")).toHaveText("17 ITEMS");
    await expect(page.locator(".game-card")).toHaveCount(17);
    await expect(page.locator(".play")).toHaveCount(17);
    await expect(page.locator(".play:not(:disabled)")).toHaveCount(1);
  });

  test("shows each card's status, description, tags, and activity", async ({ page }) => {
    const firstCard = page.locator(".game-card", { hasText: "像素贪吃蛇" });
    await expect(firstCard.locator(".status")).toBeVisible();
    await expect(firstCard.locator(".status")).toHaveText("可试玩");
    await expect(firstCard.locator(".desc")).toBeVisible();
    await expect(firstCard.locator(".desc")).toContainText("经典贪吃蛇");
    await expect(firstCard.locator(".tag-row .pill").first()).toBeVisible();
    await expect(firstCard.locator(".activity")).toBeVisible();
    await expect(firstCard.locator(".meta-row")).toContainText("经典街机");
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
    await expect(page.locator(".game-card", { hasText: "飞起来文字版" }).getByRole("button", { name: "待接入" })).toBeDisabled();
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
    await page.locator(".game-card", { hasText: "像素贪吃蛇" }).getByRole("button", { name: "开始游戏" }).click();
    await page.goto(pageUrl);
    await expect(page.locator("#recent-count")).toHaveText("1 条记录");
    await expect(page.locator("#recent-list")).toContainText("像素贪吃蛇");
    await expect(page.locator("#top-click-label")).toHaveText("1 次");
    await expect(page.locator("#preference-hint")).toContainText("像素贪吃蛇");
  });

  test("random launch records a playable game without breaking the shelf", async ({ page }) => {
    await page.getByRole("button", { name: "随机开玩" }).click();
    await expect(page).toHaveURL(/games\/snake\/index\.html$/);
    await page.goto(pageUrl);
    await expect(page.locator("#recent-list")).toContainText("像素贪吃蛇");
  });

  test("video controls are explicit when no video URL is configured", async ({ page }) => {
    await expect(page.locator(".video")).toHaveCount(17);
    await expect(page.locator(".video").first()).toBeDisabled();
    await expect(page.locator(".video").first()).toHaveText("暂无视频");
  });

  test("exposes basic accessible structure and named controls", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('[aria-label="玩家状态"]')).toBeVisible();
    await expect(page.locator('[aria-label="游戏类型筛选"]')).toBeVisible();
    await expect(page.getByPlaceholder("搜索游戏、类型、标签")).toBeVisible();
    await expect(page.getByRole("button", { name: "随机开玩" })).toBeVisible();
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

test.describe("Pixel Game Hub resilience", () => {
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

    await expect(page.locator(".game-card")).toHaveCount(17);
    await expect(page.locator("#recent-count")).toHaveText("0 条记录");
    expect(browserErrors).toEqual([]);
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

