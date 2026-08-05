(async function () {
  let games = [];
  const storageKey = "pixel-game-hub-state";
  const defaultColors = ["#70d6ff", "#ffe16a", "#202033", "#79d67a"];
  const defaultCategory = "未分类";
  const onlineStatus = "已上线";
  const playableStatus = "可开玩";
  const pendingStatus = "即将开放";
  const state = {
    filter: "全部",
    query: "",
    activity: loadActivity()
  };

  const els = {
    total: document.querySelector("#total-count"),
    playable: document.querySelector("#playable-count"),
    building: document.querySelector("#building-count"),
    recentCount: document.querySelector("#recent-count"),
    recentList: document.querySelector("#recent-list"),
    topClickLabel: document.querySelector("#top-click-label"),
    preferenceHint: document.querySelector("#preference-hint"),
    filters: document.querySelector("#filters"),
    grid: document.querySelector("#game-grid"),
    title: document.querySelector("#list-title"),
    folderCount: document.querySelector("#folder-count"),
    searchForm: document.querySelector("#search-form"),
    search: document.querySelector("#search-input"),
    random: document.querySelector("#random-button")
  };

  async function loadGames() {
    const response = await fetch("./games.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`games.json 加载失败：${response.status}`);
    }
    const data = await response.json();
    const overrides = data.customOverrides || {};
    const rawGames = Array.isArray(data.games) ? data.games : [];
    return rawGames.map((game, index) => normalizeGame({
      ...game,
      ...(overrides[game.id] || {})
    }, index));
  }

  function loadActivity() {
    try {
      return normalizeActivity(JSON.parse(localStorage.getItem(storageKey)));
    } catch {
      return { clicks: {}, recent: [] };
    }
  }

  function normalizeActivity(activity) {
    return {
      clicks: activity && typeof activity.clicks === "object" && !Array.isArray(activity.clicks)
        ? activity.clicks
        : {},
      recent: activity && Array.isArray(activity.recent)
        ? activity.recent.filter((item) => item && item.id && item.title && item.timeLabel)
        : []
    };
  }

  function normalizeGame(game, index) {
    const id = game.id || `game-${index + 1}`;
    const tags = Array.isArray(game.tags) ? game.tags.filter(Boolean) : [];
    const colors = normalizeColors(game.colors);
    const title = game.title || `未命名游戏 ${index + 1}`;
    const url = normalizeUrl(game.url);
    const videoUrl = normalizeUrl(game.videoUrl);
    return {
      ...game,
      id,
      title,
      category: game.category || defaultCategory,
      releaseDate: game.releaseDate || "待定",
      status: game.status || onlineStatus,
      description: game.description || "这个游戏还没有填写简介，可以在 games.json 里自定义。",
      tags,
      colors,
      clicks: Number.isFinite(Number(game.clicks)) ? Number(game.clicks) : 0,
      coverImage: normalizeUrl(game.coverImage),
      url,
      videoUrl,
      playable: Boolean(url),
      video: Boolean(videoUrl)
    };
  }

  function normalizeColors(colors) {
    if (!Array.isArray(colors) || colors.length < 4) return defaultColors;
    const safeColors = colors.slice(0, 4).map((color) => String(color).trim());
    return safeColors.every((color) => /^#[0-9a-f]{3,8}$/i.test(color))
      ? safeColors
      : defaultColors;
  }

  function normalizeUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    try {
      const resolved = new URL(url, window.location.href);
      return ["http:", "https:"].includes(resolved.protocol) ? url : "";
    } catch {
      return "";
    }
  }

  function saveActivity() {
    localStorage.setItem(storageKey, JSON.stringify(state.activity));
  }

  function categories() {
    return ["全部", ...new Set(games.map((game) => game.category))];
  }

  function playableGames() {
    return games.filter((game) => game.playable);
  }

  function filteredGames() {
    const query = state.query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesFilter = state.filter === "全部" || game.category === state.filter;
      const haystack = [game.title, game.category, game.description, ...game.tags].join(" ").toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });
  }

  function clickCount(game) {
    return state.activity.clicks[game.id] || game.clicks || 0;
  }

  function lastPlayed(game) {
    const recent = state.activity.recent.find((item) => item.id === game.id);
    return recent ? recent.timeLabel : "尚未游玩";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderStats() {
    els.total.textContent = games.length;
    els.playable.textContent = playableGames().length;
    els.building.textContent = games.filter((game) => game.status !== onlineStatus && !game.playable).length;

    const recent = state.activity.recent.slice(0, 4);
    els.recentCount.textContent = `${recent.length} 次`;
    els.recentList.innerHTML = recent.length
      ? recent.map((item) => `<li>${escapeHtml(item.title)} · ${escapeHtml(item.timeLabel)}</li>`).join("")
      : "<li>还没有开局记录，先挑一款试试。</li>";

    const top = games
      .map((game) => ({ game, clicks: clickCount(game) }))
      .sort((a, b) => b.clicks - a.clicks)[0];

    if (top && top.clicks > 0) {
      els.topClickLabel.textContent = `${top.clicks} 次`;
      els.preferenceHint.textContent = `常玩榜首：「${top.game.title}」。准备好就再来一局。`;
    } else {
      els.topClickLabel.textContent = "暂无记录";
      els.preferenceHint.textContent = "还没有常玩游戏，先挑一款开局。";
    }
  }

  function renderFilters() {
    els.filters.innerHTML = categories()
      .map((category) => {
        const active = category === state.filter ? " active" : "";
        const count = category === "全部" ? games.length : games.filter((game) => game.category === category).length;
        return `<button class="filter${active}" type="button" data-filter="${escapeHtml(category)}">${escapeHtml(category)} <span>${count}</span></button>`;
      })
      .join("");
  }

  function renderCards() {
    const visibleGames = filteredGames();
    els.title.textContent = state.filter === "全部" ? "全部作品" : state.filter;
    if (els.folderCount) {
      els.folderCount.textContent = `${visibleGames.length} 款`;
    }

    if (!visibleGames.length) {
      els.grid.innerHTML = `<div class="empty">暂时没找到这类游戏，换个关键词或玩法试试。</div>`;
      return;
    }

    els.grid.innerHTML = visibleGames.map((game) => {
      const [c1, c2, c3, sprite] = game.colors;
      const tagHtml = game.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
      const coverClass = game.coverImage ? "cover has-image" : "cover";
      return `
        <article class="game-card" style="--c1:${c1};--c2:${c2};--c3:${c3};--sprite:${sprite}" data-game-id="${escapeHtml(game.id)}">
          <div class="${coverClass}" data-cover-image="${escapeHtml(game.coverImage)}"><div class="sprite"></div></div>
          <div class="card-body">
            <div class="card-head">
              <h3>${escapeHtml(game.title)}</h3>
              <span class="status">${escapeHtml(game.playable ? playableStatus : unavailableStatus(game))}</span>
            </div>
            <div class="meta-row">
              ${game.pinned ? '<span class="pill pin">置顶</span>' : ""}
              <span class="pill">${escapeHtml(game.category)}</span>
              <span class="pill">入库 ${escapeHtml(game.releaseDate)}</span>
            </div>
            <p class="desc">${escapeHtml(game.description)}</p>
            <div class="card-spacer"></div>
            <div class="tag-row">${tagHtml}</div>
            <div class="activity">
              <span>玩过 ${clickCount(game)} 次</span>
              <span>最近开局 ${escapeHtml(lastPlayed(game))}</span>
            </div>
            <div class="card-actions">
              <button class="play" type="button" data-action="play" data-game-id="${escapeHtml(game.id)}" ${game.playable ? "" : "disabled"}>${game.playable ? "开始游戏" : "即将开放"}</button>
              <button class="video" type="button" data-action="video" data-game-id="${escapeHtml(game.id)}" ${game.videoUrl ? "" : "disabled"}>${game.videoUrl ? "查看视频" : "暂无视频"}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
    applyCoverImages();
  }

  function applyCoverImages() {
    els.grid.querySelectorAll("[data-cover-image]").forEach((cover) => {
      const image = cover.dataset.coverImage;
      if (image) cover.style.backgroundImage = `url("${image.replace(/["\\]/g, "\\$&")}")`;
    });
  }

  function unavailableStatus(game) {
    return game.playable ? playableStatus : pendingStatus;
  }

  function render() {
    renderStats();
    renderFilters();
    renderCards();
  }

  function markPlayed(gameId) {
    const game = games.find((item) => item.id === gameId);
    if (!game) return;

    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    state.activity.clicks[game.id] = clickCount(game) + 1;
    state.activity.recent = [
      { id: game.id, title: game.title, timeLabel },
      ...state.activity.recent.filter((item) => item.id !== game.id)
    ].slice(0, 8);
    saveActivity();
    render();
    return game;
  }

  els.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    render();
  });

  els.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const game = games.find((item) => item.id === button.dataset.gameId);
    if (!game) return;
    if (button.dataset.action === "play") {
      if (!game.playable) return;
      markPlayed(game.id);
      if (game.url) window.location.href = game.url;
    }
    if (button.dataset.action === "video" && game.videoUrl) {
      window.location.href = game.videoUrl;
    }
  });

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    renderCards();
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = els.search.value;
    renderCards();
  });

  els.random.addEventListener("click", () => {
    const pool = playableGames();
    const game = pool[Math.floor(Math.random() * pool.length)];
    if (game) {
      markPlayed(game.id);
      window.location.href = game.url;
    }
  });

  try {
    games = await loadGames();
    syncActivityWithGames();
    render();
  } catch (error) {
    els.grid.innerHTML = `<div class="empty">${escapeHtml(error.message)}。如果你是双击打开 HTML，请改用本地服务器打开页面。</div>`;
  }

  function syncActivityWithGames() {
    const gameIds = new Set(games.map((game) => game.id));
    const clicks = {};
    for (const [id, value] of Object.entries(state.activity.clicks)) {
      if (gameIds.has(id)) clicks[id] = value;
    }
    state.activity.clicks = clicks;
    state.activity.recent = state.activity.recent.filter((item) => gameIds.has(item.id));
    saveActivity();
  }
})();

