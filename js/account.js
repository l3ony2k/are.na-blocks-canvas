// Account, app menu, my-channels dropdown, and random surf.
//
// Login uses an Are.na personal access token (the API also supports OAuth2
// PKCE, but that requires a registered client; both end up as the same
// Bearer header, so OAuth can be added later without touching callers).

const AUTH_TOKEN_KEY = "arenaAccessToken";
const AUTH_USER_KEY = "arenaUser";
const RANDOM_SURF_INTRO_KEY = "randomSurfIntroSeen";

function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.id ? parsed : null;
  } catch (error) {
    return null;
  }
}

function isLoggedIn() {
  return Boolean(CONFIG.accessToken && STATE.currentUser);
}

function saveAuth(token, user) {
  CONFIG.accessToken = token;
  STATE.currentUser = user;
  STATE.myChannels = null;
  STATE.followingChannels = null;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to persist login:", error);
  }
}

function clearAuth() {
  CONFIG.accessToken = "";
  STATE.currentUser = null;
  STATE.myChannels = null;
  STATE.followingChannels = null;
  STATE.flowImageMeasurements = {};
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (error) {
    // Storage unavailable; in-memory state is cleared regardless
  }
  hideChannelDropdown();
  // Cached channel contents may include private data fetched with the
  // token, so drop them on logout.
  arenaDB.clearChannels().catch((error) => {
    console.error("Failed to clear channel cache on logout:", error);
  });
}

// ---------------------------------------------------------------------------
// App menu (top-left logo)
// ---------------------------------------------------------------------------

function initAccount() {
  STATE.currentUser = getStoredUser();

  const menuButton = document.getElementById("app-menu-button");
  const menu = document.getElementById("app-menu");

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willShow = !menu.classList.contains("show");
    if (willShow) {
      rebuildAppMenu();
    }
    menu.classList.toggle("show", willShow);
    menuButton.setAttribute("aria-expanded", String(willShow));
  });

  document.addEventListener("click", (event) => {
    if (
      menu.classList.contains("show") &&
      !event.target.closest("#header-bar-logo")
    ) {
      closeAppMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    closeAppMenu();
    hideChannelDropdown();

    // No modal open? Escape also pops the top detail panel.
    const modalOpen = Array.from(
      document.querySelectorAll(".modal-dialog"),
    ).some((modal) => modal.style.display === "flex");
    if (
      !modalOpen &&
      document.getElementById("detail-view").style.display === "flex"
    ) {
      closeDetailView();
    }
  });

  initChannelDropdown();

  // A stored token without a profile (or a stale profile) gets refreshed in
  // the background; a revoked token logs the session out.
  if (CONFIG.accessToken) {
    arenaAPI
      .getMe()
      .then((user) => {
        saveAuth(CONFIG.accessToken, user);
      })
      .catch((error) => {
        if (String(error.message).includes("401")) {
          outputLog("[Account] Stored token no longer valid, logging out");
          clearAuth();
        }
      });
  }
}

function closeAppMenu() {
  const menu = document.getElementById("app-menu");
  menu.classList.remove("show");
  document
    .getElementById("app-menu-button")
    .setAttribute("aria-expanded", "false");
}

function makeMenuItem(label, onClick) {
  const item = document.createElement("div");
  item.className = "app-menu-item";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    closeAppMenu();
    onClick();
  });
  item.appendChild(button);
  return item;
}

function makeSubmenuItem(label, options = {}) {
  const item = document.createElement("div");
  item.className = "app-menu-item has-submenu";

  const button = document.createElement("button");
  button.type = "button";

  const text = document.createElement("span");
  text.className = "app-menu-label";

  if (options.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.className = "app-menu-avatar";
    avatar.src = options.avatarUrl;
    avatar.alt = "";
    text.appendChild(avatar);
  }
  text.appendChild(document.createTextNode(label));

  const arrow = document.createElement("span");
  arrow.className = "submenu-arrow";
  arrow.textContent = "▸";

  button.appendChild(text);
  button.appendChild(arrow);

  const submenu = document.createElement("div");
  submenu.className = "app-submenu";

  // Click toggles (touch); desktop also opens on hover via CSS.
  button.addEventListener("click", () => {
    const isOpen = item.classList.contains("open");
    item.parentElement
      .querySelectorAll(".app-menu-item.open")
      .forEach((other) => {
        other.classList.remove("open");
        const otherArrow = other.querySelector(".submenu-arrow");
        if (otherArrow) {
          otherArrow.textContent = "▸";
        }
      });
    item.classList.toggle("open", !isOpen);
    arrow.textContent = isOpen ? "▸" : "▾";
  });

  item.appendChild(button);
  item.appendChild(submenu);
  return { item, submenu };
}

function makeSeparator() {
  const separator = document.createElement("div");
  separator.className = "app-menu-separator";
  return separator;
}

function makeMenuHint(text) {
  const hint = document.createElement("div");
  hint.className = "app-menu-hint";
  hint.textContent = text;
  return hint;
}

function makeSubmenuAction(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

// Submenu row with a right-aligned dim annotation (e.g. relative time).
function makeSubmenuRow(label, annotation, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "submenu-row";

  const text = document.createElement("span");
  text.className = "submenu-row-label";
  text.textContent = label;

  const note = document.createElement("span");
  note.className = "submenu-row-note";
  note.textContent = annotation || "";

  button.appendChild(text);
  button.appendChild(note);
  button.addEventListener("click", onClick);
  return button;
}

function rebuildAppMenu() {
  const menu = document.getElementById("app-menu");
  menu.replaceChildren();

  menu.appendChild(
    makeMenuItem("channel info", () => {
      showCurrentChannelDetail();
    }),
  );

  const history = makeSubmenuItem("recently surfed");
  history.submenu.appendChild(makeMenuHint("loading..."));
  populateHistorySubmenu(history.submenu);
  menu.appendChild(history.item);

  menu.appendChild(
    makeMenuItem("random surf", () => {
      startRandomSurf();
    }),
  );

  menu.appendChild(makeSeparator());

  if (isLoggedIn()) {
    menu.appendChild(
      makeMenuItem("feed", () => {
        router.navigate("!feed");
      }),
    );

    const account = makeSubmenuItem(
      STATE.currentUser.name || STATE.currentUser.slug || "account",
      { avatarUrl: STATE.currentUser.avatar },
    );
    account.submenu.appendChild(
      makeSubmenuAction("my channels", () => {
        closeAppMenu();
        openMyChannelsDropdown();
      }),
    );
    if (STATE.currentUser.slug) {
      account.submenu.appendChild(
        makeSubmenuAction("browse my profile", () => {
          closeAppMenu();
          router.navigate(`@${STATE.currentUser.slug}`);
        }),
      );
      account.submenu.appendChild(
        makeSubmenuAction("profile on are.na", () => {
          closeAppMenu();
          window.open(`https://www.are.na/${STATE.currentUser.slug}`, "_blank");
        }),
      );
    }
    account.submenu.appendChild(
      makeSubmenuAction("log out", () => {
        closeAppMenu();
        clearAuth();
      }),
    );
    menu.appendChild(account.item);
  } else {
    menu.appendChild(
      makeMenuItem("log in", () => {
        openLoginDialog();
      }),
    );
  }

  menu.appendChild(makeSeparator());

  menu.appendChild(
    makeMenuItem("help", () => {
      showHelpView();
    }),
  );
  menu.appendChild(
    makeMenuItem("about", () => {
      showAboutView();
    }),
  );
}

async function populateHistorySubmenu(submenu) {
  let entries = [];
  try {
    entries = await arenaDB.getHistory(15);
  } catch (error) {
    console.error("Failed to load surf history:", error);
  }

  submenu.replaceChildren();

  const currentSlug = STATE.channelSlugs[0];
  const items = entries.filter(
    (entry) => entry.slug && entry.slug !== currentSlug,
  );

  if (items.length === 0) {
    submenu.appendChild(makeMenuHint("no history yet"));
    return;
  }

  items.forEach((entry) => {
    const button = makeSubmenuRow(
      entry.title || entry.slug,
      formatRelativeTime(entry.timestamp),
      () => {
        closeAppMenu();
        router.navigate(entry.slug);
      },
    );
    button.title = entry.slug;
    submenu.appendChild(button);
  });

  const viewAll = makeSubmenuAction("view all ▸", () => {
    closeAppMenu();
    showHistoryView();
  });
  viewAll.className = "submenu-view-all";
  submenu.appendChild(viewAll);
}

// ---------------------------------------------------------------------------
// Login dialog
// ---------------------------------------------------------------------------

function ensureLoginDialog() {
  let dialog = document.getElementById("login-dialog");
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("div");
  dialog.id = "login-dialog";
  dialog.className = "modal-dialog";

  const content = document.createElement("div");
  content.className = "modal-content";

  const title = document.createElement("h3");
  title.textContent = "Log in to Are.na";

  const note = document.createElement("p");
  note.className = "modal-note";
  note.innerHTML =
    "Paste a <strong>personal access token</strong>. Create one at " +
    '<a href="https://www.are.na/settings/personal-access-tokens" target="_blank">are.na/settings/personal-access-tokens</a>. ' +
    "Choose <strong>write</strong> scope if you want to connect blocks to your channels from here. " +
    "The token is stored only in this browser and sent only to api.are.na.";

  const input = document.createElement("input");
  input.type = "password";
  input.id = "login-token-input";
  input.placeholder = "Personal Access Token";
  input.autocomplete = "off";
  input.spellcheck = false;

  const errorLine = document.createElement("div");
  errorLine.id = "login-error";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "button-group";

  const connectButton = document.createElement("button");
  connectButton.id = "login-connect-btn";
  connectButton.textContent = "Connect";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";

  buttonGroup.appendChild(connectButton);
  buttonGroup.appendChild(cancelButton);
  content.appendChild(title);
  content.appendChild(note);
  content.appendChild(input);
  content.appendChild(errorLine);
  content.appendChild(buttonGroup);
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  function close() {
    dialog.style.display = "none";
    input.value = "";
    errorLine.textContent = "";
  }

  async function submit() {
    const token = input.value.trim();
    if (!token) {
      errorLine.textContent = "Please paste a token first.";
      return;
    }

    connectButton.disabled = true;
    connectButton.textContent = "Connecting...";
    errorLine.textContent = "";

    const previousToken = CONFIG.accessToken;
    CONFIG.accessToken = token;

    try {
      const user = await arenaAPI.getMe();
      saveAuth(token, user);
      close();
      outputLog(`[Account] Logged in as ${user.name || user.slug}`);
      loadMyChannels().catch(() => {});
      loadFollowingChannels().catch(() => {});
    } catch (error) {
      CONFIG.accessToken = previousToken;
      errorLine.textContent = `Login failed: ${error.message}`;
    } finally {
      connectButton.disabled = false;
      connectButton.textContent = "Connect";
    }
  }

  connectButton.addEventListener("click", submit);
  cancelButton.addEventListener("click", close);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
  dialog.addEventListener("mousedown", (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  return dialog;
}

function openLoginDialog() {
  const dialog = ensureLoginDialog();
  dialog.style.display = "flex";
  const input = document.getElementById("login-token-input");
  input.value = "";
  document.getElementById("login-error").textContent = "";
  input.focus();
}

// ---------------------------------------------------------------------------
// My channels + following dropdown (search box)
// ---------------------------------------------------------------------------

function sortChannelsByUpdated(items) {
  items.sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
  );
  return items;
}

function makeChannelCache() {
  return {
    items: [],
    meta: null,
    page: 0,
    fetchedAt: 0,
    loading: false,
    promise: null,
  };
}

async function loadChannelGroup(stateKey, fetchPage, force = false) {
  if (!isLoggedIn()) {
    return null;
  }

  const cache = STATE[stateKey];
  if (
    !force &&
    cache &&
    !cache.loading &&
    Date.now() - cache.fetchedAt < CONFIG.myChannelsCacheAge
  ) {
    return cache;
  }
  if (cache?.loading) {
    return cache.promise;
  }

  const promise = fetchPage(1)
    .then((result) => {
      STATE[stateKey] = {
        items: sortChannelsByUpdated(
          result.data.filter((item) => item.kind === "channel"),
        ),
        meta: result.meta,
        page: 1,
        fetchedAt: Date.now(),
        loading: false,
        promise: null,
      };
      renderChannelDropdown();
      return STATE[stateKey];
    })
    .catch((error) => {
      STATE[stateKey] = null;
      console.error(`Failed to load ${stateKey}:`, error);
      renderChannelDropdown();
      throw error;
    });

  STATE[stateKey] = { ...makeChannelCache(), loading: true, promise };
  renderChannelDropdown();
  return promise;
}

function loadMyChannels(force = false) {
  const userRef = STATE.currentUser?.slug || STATE.currentUser?.id;
  return loadChannelGroup(
    "myChannels",
    (page) =>
      arenaAPI.getUserChannelsPage(userRef, page, CONFIG.myChannelsPerPage),
    force,
  );
}

function loadFollowingChannels(force = false) {
  const userRef = STATE.currentUser?.slug || STATE.currentUser?.id;
  return loadChannelGroup(
    "followingChannels",
    (page) =>
      arenaAPI.getUserFollowingChannelsPage(
        userRef,
        page,
        CONFIG.myChannelsPerPage,
      ),
    force,
  );
}

async function loadMoreChannelGroup(stateKey, fetchPage) {
  const cache = STATE[stateKey];
  if (!cache || cache.loading || !cache.meta?.has_more_pages) {
    return;
  }

  cache.loading = true;
  renderChannelDropdown();
  try {
    const result = await fetchPage(cache.page + 1);
    cache.items = sortChannelsByUpdated(
      cache.items.concat(result.data.filter((item) => item.kind === "channel")),
    );
    cache.meta = result.meta;
    cache.page += 1;
  } catch (error) {
    console.error(`Failed to load more ${stateKey}:`, error);
  } finally {
    cache.loading = false;
    renderChannelDropdown();
  }
}

function initChannelDropdown() {
  const input = document.getElementById("channel-slug-input");
  const dropdown = document.getElementById("channel-dropdown");

  // Keep focus on the input when interacting with the dropdown (rows and
  // scrollbar alike), so blur-to-hide doesn't race the click.
  dropdown.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  input.addEventListener("focus", () => {
    if (!isLoggedIn()) {
      return;
    }
    // The input still holds the current channel's slug; don't let it filter
    // the list until the user actually types. Select it so typing replaces.
    STATE._dropdownFilterActive = false;
    input.select();
    loadMyChannels().catch(() => {});
    loadFollowingChannels().catch(() => {});
    renderChannelDropdown();
    showChannelDropdown();
  });

  input.addEventListener("input", () => {
    if (isLoggedIn() && isChannelDropdownVisible()) {
      STATE._dropdownFilterActive = true;
      renderChannelDropdown();
    }
  });

  input.addEventListener("blur", hideChannelDropdown);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (isChannelDropdownVisible()) {
        event.preventDefault();
        moveDropdownSelection(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Enter" || event.key === "Escape") {
      hideChannelDropdown();
    }
  });
}

function isChannelDropdownVisible() {
  return document.getElementById("channel-dropdown").classList.contains("show");
}

function showChannelDropdown() {
  document.getElementById("channel-dropdown").classList.add("show");
}

function hideChannelDropdown() {
  const dropdown = document.getElementById("channel-dropdown");
  if (dropdown) {
    dropdown.classList.remove("show");
  }
  STATE._dropdownActiveIndex = -1;
}

function openMyChannelsDropdown() {
  const input = document.getElementById("channel-slug-input");
  input.focus();
  input.select();
}

function moveDropdownSelection(delta) {
  const rows = Array.from(
    document.querySelectorAll("#channel-dropdown .channel-dropdown-item"),
  );
  if (rows.length === 0) {
    return;
  }

  let index = (STATE._dropdownActiveIndex ?? -1) + delta;
  index = Math.max(0, Math.min(rows.length - 1, index));
  rows.forEach((row) => row.classList.remove("active"));
  rows[index].classList.add("active");
  rows[index].scrollIntoView({ block: "nearest" });
  STATE._dropdownActiveIndex = index;
}

// Slug of the arrow-key-highlighted dropdown row, if any (used by the
// search input's Enter handler).
function getActiveDropdownChannel() {
  if (!isChannelDropdownVisible()) {
    return null;
  }
  const rows = document.querySelectorAll(
    "#channel-dropdown .channel-dropdown-item",
  );
  const index = STATE._dropdownActiveIndex;
  if (index == null || index < 0 || index >= rows.length) {
    return null;
  }
  return rows[index].dataset.slug || null;
}

function filterChannels(items, filter) {
  if (!filter) {
    return items;
  }
  return items.filter(
    (channel) =>
      (channel.title || "").toLowerCase().includes(filter) ||
      (channel.slug || "").toLowerCase().includes(filter),
  );
}

function renderDropdownGroup(dropdown, label, cache, filter, loadMore) {
  const header = document.createElement("div");
  header.className = "channel-dropdown-header";
  header.textContent = label;
  dropdown.appendChild(header);

  if (!cache || (cache.loading && cache.items.length === 0)) {
    dropdown.appendChild(makeDropdownHint("loading..."));
    return;
  }

  const filtered = filterChannels(cache.items, filter);
  if (filtered.length === 0) {
    dropdown.appendChild(
      makeDropdownHint(filter ? "no matches" : "nothing here yet"),
    );
  }

  filtered.forEach((channel) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "channel-dropdown-item";
    row.dataset.slug = channel.slug || String(channel.id);

    const title = document.createElement("span");
    title.className = "channel-dropdown-title";
    const visibilityClass = getVisibilityClass(channel.visibility);
    if (visibilityClass) {
      title.classList.add(visibilityClass);
    }
    title.textContent = channel.title || channel.slug || "Untitled Channel";

    const count = document.createElement("span");
    count.className = "channel-dropdown-count";
    count.textContent =
      channel.counts?.contents != null ? String(channel.counts.contents) : "";

    row.appendChild(title);
    row.appendChild(count);
    row.addEventListener("click", () => {
      hideChannelDropdown();
      document.getElementById("channel-slug-input").blur();
      router.navigate(row.dataset.slug, true, false);
    });
    dropdown.appendChild(row);
  });

  if (cache.meta?.has_more_pages) {
    const loadMoreButton = document.createElement("button");
    loadMoreButton.type = "button";
    loadMoreButton.className = "channel-dropdown-load-more";
    loadMoreButton.textContent = cache.loading
      ? "loading..."
      : `load more (${cache.items.length}/${cache.meta.total_count})`;
    loadMoreButton.disabled = Boolean(cache.loading);
    loadMoreButton.addEventListener("click", loadMore);
    dropdown.appendChild(loadMoreButton);
  }
}

function renderChannelDropdown() {
  const dropdown = document.getElementById("channel-dropdown");
  dropdown.replaceChildren();
  STATE._dropdownActiveIndex = -1;

  if (!isLoggedIn()) {
    return;
  }

  const input = document.getElementById("channel-slug-input");
  const filter = STATE._dropdownFilterActive
    ? input.value.trim().toLowerCase()
    : "";
  const userRef = STATE.currentUser?.slug || STATE.currentUser?.id;

  renderDropdownGroup(dropdown, "your channels", STATE.myChannels, filter, () =>
    loadMoreChannelGroup("myChannels", (page) =>
      arenaAPI.getUserChannelsPage(userRef, page, CONFIG.myChannelsPerPage),
    ),
  );

  renderDropdownGroup(
    dropdown,
    "following",
    STATE.followingChannels,
    filter,
    () =>
      loadMoreChannelGroup("followingChannels", (page) =>
        arenaAPI.getUserFollowingChannelsPage(
          userRef,
          page,
          CONFIG.myChannelsPerPage,
        ),
      ),
  );
}

function makeDropdownHint(text) {
  const hint = document.createElement("div");
  hint.className = "channel-dropdown-hint";
  hint.textContent = text;
  return hint;
}

// ---------------------------------------------------------------------------
// Random surf
// ---------------------------------------------------------------------------

function surfDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startedAt > timeout) {
        resolve(null);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function startRandomSurf() {
  if (!STATE.allFetchedBlocks.length) {
    showToast({ message: "Load a channel first", seconds: 3 });
    return;
  }

  if (!localStorage.getItem(RANDOM_SURF_INTRO_KEY)) {
    showRandomSurfIntro();
    return;
  }

  runRandomSurf();
}

function showRandomSurfIntro() {
  let dialog = document.getElementById("random-surf-intro");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "random-surf-intro";
    dialog.className = "modal-dialog";

    const content = document.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
      <h3>Random Surf</h3>
      <p class="modal-note">Picks a random block from the canvas, looks up every channel
      it lives in, and follows one at random. No destination, no plan,
      that's the point. You can always find your way back through
      <i>recently surfed</i>.</p>
    `;

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "button-group";

    const goButton = document.createElement("button");
    goButton.id = "random-surf-go-btn";
    goButton.textContent = "Let's surf";
    goButton.addEventListener("click", () => {
      localStorage.setItem(RANDOM_SURF_INTRO_KEY, "1");
      dialog.style.display = "none";
      runRandomSurf();
    });

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      dialog.style.display = "none";
    });

    buttonGroup.appendChild(goButton);
    buttonGroup.appendChild(cancelButton);
    content.appendChild(buttonGroup);
    dialog.appendChild(content);
    document.body.appendChild(dialog);
  }

  dialog.style.display = "flex";
}

async function runRandomSurf() {
  if (STATE._randomSurfRunning) {
    return;
  }
  STATE._randomSurfRunning = true;

  const logOutput = document.getElementById("log-output");
  logOutput.innerHTML = "";
  logOutput.style.display = "block";

  function giveUp(message) {
    outputLog(`[RandomSurf] ${message}`);
    showToast({ message: "Random surf found no way out of this channel", seconds: 4 });
    setTimeout(() => {
      logOutput.style.display = "none";
    }, 2500);
  }

  try {
    const currentSlug = STATE.channelSlugs[0];
    const blocks = STATE.allFetchedBlocks;
    outputLog(`[RandomSurf] rolling the dice among ${blocks.length} blocks...`);

    const channelBlocks = blocks.filter(
      (block) =>
        block.kind === "channel" && block.slug && block.slug !== currentSlug,
    );
    const per = CONFIG.connectionsPerPage;

    // Tier 1: random blocks, following a random connection that leads AWAY
    // from the current channel. Draw without replacement so dead-end blocks
    // are never retried.
    const pool = blocks.filter((block) => block.kind !== "channel");
    const maxAttempts = Math.min(6, pool.length);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const index = Math.floor(Math.random() * pool.length);
      const block = pool.splice(index, 1)[0];

      outputLog(
        `[RandomSurf] attempt ${attempt}: block ${block.id} (${block.kind})`,
      );

      let firstPage;
      try {
        firstPage = await arenaAPI.getBlockConnectionsPage(block.id, 1, per);
      } catch (error) {
        outputLog(`[RandomSurf] connections lookup failed: ${error.message}`);
        continue;
      }

      const total = firstPage.meta?.total_count ?? firstPage.data.length;
      const awayOf = (channels) =>
        channels.filter(
          (channel) => channel.slug && channel.slug !== currentSlug,
        );

      if (!total || (total === 1 && awayOf(firstPage.data).length === 0)) {
        outputLog("[RandomSurf] this block lives nowhere else, rerolling...");
        continue;
      }

      outputLog(
        `[RandomSurf] block appears in ${total} channel${total === 1 ? "" : "s"}`,
      );

      // Deep pools: jump to a random page so far channels get a chance too.
      let candidates = firstPage.data;
      const totalPages = firstPage.meta?.total_pages || 1;
      const randomPage = 1 + Math.floor(Math.random() * totalPages);
      if (randomPage > 1) {
        outputLog(`[RandomSurf] rolling page ${randomPage}/${totalPages}...`);
        try {
          const pageResult = await arenaAPI.getBlockConnectionsPage(
            block.id,
            randomPage,
            per,
          );
          if (pageResult.data.length > 0) {
            candidates = pageResult.data;
          }
        } catch (error) {
          // First page is a fine fallback
        }
      }

      // Never fall back to where we already are.
      let targets = awayOf(candidates);
      if (targets.length === 0) {
        targets = awayOf(firstPage.data);
      }
      if (targets.length === 0) {
        outputLog("[RandomSurf] every road leads back here, rerolling...");
        continue;
      }

      const target = targets[Math.floor(Math.random() * targets.length)];
      outputLog(
        `[RandomSurf] destination: "${target.title}"${target.owner?.name ? ` by ${target.owner.name}` : ""}`,
      );
      await choreographRandomSurf(block, target);
      return;
    }

    // Tier 2: connected channel blocks on the canvas are exits themselves.
    if (channelBlocks.length > 0) {
      const block =
        channelBlocks[Math.floor(Math.random() * channelBlocks.length)];
      outputLog(
        `[RandomSurf] no block routes, taking connected channel "${block.title}"`,
      );
      outputLog("[RandomSurf] surfing...");
      await surfDelay(900);
      router.navigate(block.slug);
      return;
    }

    // Tier 3: the channel itself may live inside other channels.
    if (!currentSlug.startsWith("@") && !currentSlug.startsWith("!")) {
      outputLog("[RandomSurf] checking where this channel itself lives...");
      try {
        const channelConnections = await arenaAPI.getChannelConnectionsPage(
          currentSlug,
          1,
          per,
        );
        const exits = channelConnections.data.filter(
          (channel) => channel.slug && channel.slug !== currentSlug,
        );
        if (exits.length > 0) {
          const target = exits[Math.floor(Math.random() * exits.length)];
          outputLog(
            `[RandomSurf] this channel is connected to "${target.title}"${target.owner?.name ? ` by ${target.owner.name}` : ""}`,
          );
          outputLog("[RandomSurf] surfing...");
          await surfDelay(900);
          router.navigate(target.slug);
          return;
        }
      } catch (error) {
        outputLog(`[RandomSurf] channel connections failed: ${error.message}`);
      }
    }

    giveUp("this channel is an island, no connections lead anywhere else");
  } finally {
    STATE._randomSurfRunning = false;
  }
}

// The show: center the chosen block, open its details, expand connections,
// highlight the destination, then go.
async function choreographRandomSurf(block, target) {
  const element = document.querySelector(
    `.block[data-block-id="${block.id}"]:not([data-flow-instance])`,
  );

  if (element && STATE.layoutMode !== "flow") {
    const x = Math.max(0, (window.innerWidth - element.offsetWidth) / 2);
    const y = Math.max(0, (window.innerHeight - element.offsetHeight) / 2);
    element.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;
    STATE.cachedBlockPositions[block.id] = { x, y, rotation: 0 };
    commitRaiseBlock(element);
    await surfDelay(500);
  }

  const targetShim =
    element && element.isConnected
      ? element
      : { dataset: { blockId: String(block.id) }, style: { display: "" } };
  showDetailView({ currentTarget: targetShim });

  const toggle = await waitForElement(
    ".connections-slot .connections-toggle",
    10000,
  );
  if (toggle) {
    toggle.click();
    await surfDelay(300);
    const slug =
      window.CSS && CSS.escape ? CSS.escape(target.slug) : target.slug;
    const row = document.querySelector(`.connection-item[data-slug="${slug}"]`);
    if (row) {
      row.classList.add("surf-target");
      row.scrollIntoView({ block: "nearest" });
    }
    await surfDelay(1400);
  } else {
    await surfDelay(500);
  }

  outputLog("[RandomSurf] surfing...");
  router.navigate(target.slug);
}
