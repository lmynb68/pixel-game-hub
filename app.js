(function () {
  const games = Array.isArray(window.GAME_LIBRARY) ? window.GAME_LIBRARY : [];
  const storageKey = "pixel-game-hub-state";
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
    search: document.querySelector("#search-input"),
    random: document.querySelector("#random-button")
  };

  function loadActivity() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || { clicks: {}, recent: [] };
    } catch {
      return { clicks: {}, recent: [] };
    }
  }

  function saveActivity() {
    localStorage.setItem(storageKey, JSON.stringify(state.activity));
  }

  function categories() {
    return ["全部", ...new Set(games.map((game) => game.category))];
  }

  function playableGames() {
    return games.filter((game) => game.status === "已上线");
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
    els.building.textContent = games.filter((game) => game.status !== "已上线").length;

    const recent = state.activity.recent.slice(0, 4);
    els.recentCount.textContent = `${recent.length} 条记录`;
    els.recentList.innerHTML = recent.length
      ? recent.map((item) => `<li>${escapeHtml(item.title)} · ${escapeHtml(item.timeLabel)}</li>`).join("")
      : "<li>还没有游玩记录，先点一款试试。</li>";

    const top = games
      .map((game) => ({ game, clicks: clickCount(game) }))
      .sort((a, b) => b.clicks - a.clicks)[0];

    if (top && top.clicks > 0) {
      els.topClickLabel.textContent = `${top.clicks} 次`;
      els.preferenceHint.textContent = `你最近最常点的是「${top.game.title}」，可以考虑把同类游戏放到首页更靠前的位置。`;
    } else {
      els.topClickLabel.textContent = "等待统计";
      els.preferenceHint.textContent = "点击任意卡片后，这里会记录你的偏好。";
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
    els.title.textContent = state.filter === "全部" ? "全部游戏" : state.filter;

    if (!visibleGames.length) {
      els.grid.innerHTML = `<div class="empty">没有找到匹配的游戏，换个关键词或分类试试。</div>`;
      return;
    }

    els.grid.innerHTML = visibleGames.map((game) => {
      const [c1, c2, c3, sprite] = game.colors;
      const tagHtml = game.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
      return `
        <article class="game-card" style="--c1:${c1};--c2:${c2};--c3:${c3};--sprite:${sprite}" data-game-id="${escapeHtml(game.id)}">
          <div class="cover"><div class="sprite"></div></div>
          <div class="card-body">
            <div class="card-head">
              <h3>${escapeHtml(game.title)}</h3>
              <span class="status">${escapeHtml(game.status)}</span>
            </div>
            <div class="meta-row">
              ${game.pinned ? '<span class="pill pin">置顶</span>' : ""}
              <span class="pill">${escapeHtml(game.category)}</span>
              <span class="pill">上线 ${escapeHtml(game.releaseDate)}</span>
            </div>
            <p class="desc">${escapeHtml(game.description)}</p>
            <div class="card-spacer"></div>
            <div class="tag-row">${tagHtml}</div>
            <div class="activity">
              <span>点击 ${clickCount(game)} 次</span>
              <span>最近游玩 ${escapeHtml(lastPlayed(game))}</span>
            </div>
            <div class="card-actions">
              <button class="play" type="button" data-action="play" data-game-id="${escapeHtml(game.id)}">开始游戏</button>
              <button class="video" type="button" data-action="video" data-game-id="${escapeHtml(game.id)}">${game.video ? "查看视频" : "暂无视频"}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
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
    if (button.dataset.action === "play") {
      const game = markPlayed(button.dataset.gameId);
      if (game && game.url) {
        window.location.href = game.url;
      }
    }
  });

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    renderCards();
  });

  els.random.addEventListener("click", () => {
    const pool = playableGames();
    const game = pool[Math.floor(Math.random() * pool.length)];
    if (game) markPlayed(game.id);
  });

  render();
})();
