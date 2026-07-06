// UI Utility Functions
function outputLog(message) {
  console.log(message);
  const logOutputElement = document.getElementById("log-output");
  if (logOutputElement && logOutputElement.style.display !== "none") {
    logOutputElement.innerHTML += message + "<br>";
  }
}

function throttle(func, delay) {
  let timeoutId,
    lastExecTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastExecTime >= delay) {
      func.apply(this, args);
      lastExecTime = now;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func.apply(this, args);
          lastExecTime = Date.now();
        },
        delay - (now - lastExecTime),
      );
    }
  };
}

function getTranslateXValue(element) {
  const style = window.getComputedStyle(element);
  const matrix = new DOMMatrix(style.transform);
  return matrix.m41;
}

function getTranslateYValue(element) {
  const style = window.getComputedStyle(element);
  const matrix = new DOMMatrix(style.transform);
  return matrix.m42;
}

function updateThemeToggleText(theme) {
  const themeToggle = document.getElementById("theme-toggle");
  const moreThemeButton = document.getElementById("more-theme-button");
  themeToggle.textContent = theme === "system" ? "sys" : theme.toLowerCase();
  if (moreThemeButton) {
    moreThemeButton.textContent = theme === "system" ? "sys" : theme.toLowerCase();
  }
}

// --- Detail panel stack -----------------------------------------------------
// Opening a channel from a connections list spawns a NEW panel element on
// top of the current one. The covered panel stays fully rendered (no content
// shift), frozen behind a click-catcher; clicking it pops back to it. Only
// the top panel owns the detail-view-* ids, so all id-based rendering code
// keeps working untouched.

const DETAIL_PANEL_IDS = [
  "detail-view",
  "detail-view-header",
  "detail-view-title",
  "detail-view-arena-link",
  "detail-view-close-wrapper",
  "detail-view-close",
  "detail-view-content-wrapper",
  "detail-view-content",
  "detail-view-link",
  "detail-view-info",
  "detail-view-meta",
];

const ARENA_GLYPH_PATH =
  "M12.8745 5.60598L11.0723 4.13301C10.962 4.04311 10.962 3.89549 11.0723 3.80532L12.8745 2.33271C12.9852 2.24262 13.0314 2.09042 12.9774 1.99467C12.9233 1.8992 12.7722 1.86521 12.642 1.91915L10.499 2.80685C10.3687 2.86134 10.246 2.78708 10.2265 2.64233L9.90419 0.263056C9.88431 0.118402 9.77971 0 9.67139 0C9.56359 0 9.45908 0.118402 9.43972 0.262966L9.11728 2.64242C9.09757 2.78717 8.97499 2.86125 8.84454 2.80694L6.737 1.93399C6.6063 1.87987 6.39338 1.87987 6.26302 1.93399L4.15514 2.80694C4.02478 2.86125 3.90203 2.78717 3.88249 2.64242L3.56048 0.262966C3.5406 0.118402 3.43617 0 3.32829 0C3.22006 0 3.11538 0.118402 3.09593 0.262966L2.77348 2.64242C2.75395 2.78717 2.63128 2.86125 2.50092 2.80694L0.358028 1.91942C0.227755 1.86521 0.076908 1.89938 0.0227932 1.99476C-0.0312351 2.0906 0.0148402 2.24289 0.125145 2.3328L1.92753 3.80541C2.03792 3.89558 2.03792 4.0432 1.92753 4.13319L0.125145 5.60598C0.0144945 5.69606 -0.0313216 5.85735 0.0226203 5.96415C0.0768216 6.07114 0.227669 6.11411 0.357769 6.05981L2.48147 5.17283C2.612 5.11862 2.73337 5.19243 2.75161 5.33717L3.05798 7.73721C3.07648 7.88169 3.19784 8 3.32769 8C3.45735 8 3.57881 7.88178 3.5974 7.73721L3.90428 5.33717C3.92243 5.19243 4.04432 5.1187 4.17416 5.17283L6.26302 6.0447C6.39321 6.09918 6.60621 6.09918 6.73649 6.0447L8.82501 5.17283C8.95502 5.11862 9.07656 5.19243 9.09515 5.33717L9.40203 7.73721C9.42035 7.88169 9.54181 8 9.67131 8C9.80115 8 9.9226 7.88178 9.94102 7.73721L10.2479 5.33717C10.2666 5.19243 10.3879 5.1187 10.518 5.17283L12.6419 6.05981C12.7716 6.11411 12.9229 6.07105 12.977 5.96424C13.0312 5.85762 12.9851 5.69633 12.8745 5.60625L12.8745 5.60598ZM8.28939 4.15171L6.70225 5.42249C6.59117 5.51149 6.40894 5.51149 6.29821 5.42249L4.71055 4.15171C4.59956 4.06271 4.59869 3.91617 4.70882 3.82581L6.29942 2.52285C6.40955 2.4325 6.59013 2.4325 6.70035 2.52285L8.29095 3.82581C8.40134 3.91608 8.40047 4.06262 8.28922 4.1518L8.28939 4.15171Z";

// Fresh detail panel with the standard structure, ids, and close/arena
// listeners. Caller must have stripped the ids off the previous panel first.
function createDetailPanelElement() {
  const panel = document.createElement("div");
  panel.id = "detail-view";
  panel.className = "detail-view";
  panel.innerHTML = `
    <div id="detail-view-header" class="detail-view-header">
      <h2 id="detail-view-title" class="detail-view-title"></h2>
      <div>
        <a id="detail-view-arena-link" class="detail-view-arena-link" href="#" target="_blank">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 8" fill="none"><path d="${ARENA_GLYPH_PATH}"/></svg>
        </a>
        <div id="detail-view-close-wrapper" class="detail-view-close-wrapper">
          <div id="detail-view-close" class="detail-view-close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path d="M7 7L23 23M23 7L7 23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
        </div>
      </div>
    </div>
    <div id="detail-view-content-wrapper" class="detail-view-content-wrapper">
      <div id="detail-view-content" class="detail-view-content"></div>
    </div>
    <div id="detail-view-link" class="detail-view-link"></div>
    <div id="detail-view-info" class="detail-view-info"></div>
    <div id="detail-view-meta" class="detail-view-meta"></div>
  `;

  const closeWrapper = panel.querySelector(".detail-view-close-wrapper");
  closeWrapper.addEventListener("click", closeDetailView);
  closeWrapper.addEventListener("touchend", closeDetailView);
  const arenaLink = panel.querySelector(".detail-view-arena-link");
  arenaLink.addEventListener("touchend", function () {
    window.open(this.href, "_blank");
  });

  document.body.appendChild(panel);
  return panel;
}

function pushDetailView() {
  const current = document.getElementById("detail-view");
  if (!current) {
    return;
  }

  // Demote the current panel: park its ids in data attributes so the fresh
  // panel can own them, but leave its DOM and listeners completely alone.
  DETAIL_PANEL_IDS.forEach((id) => {
    const element = id === "detail-view" ? current : current.querySelector(`#${id}`);
    if (element) {
      element.dataset.detailId = id;
      element.removeAttribute("id");
    }
  });
  current.classList.add("detail-stacked");

  // Click-catcher: freezes the covered panel and pops back to it on click.
  const overlay = document.createElement("div");
  overlay.className = "detail-stacked-overlay";
  overlay.addEventListener("click", () => popToDetailPanel(current));
  current.appendChild(overlay);

  STATE.detailStack.push({
    element: current,
    overlay,
    token: STATE.activeDetailToken,
  });

  const fresh = createDetailPanelElement();
  fresh.style.display = "flex";
  updateDetailStackOffsets();
}

function popDetailView() {
  const entry = STATE.detailStack.pop();
  if (!entry) {
    return;
  }

  const top = document.getElementById("detail-view");
  if (top && top !== entry.element) {
    top.remove();
  }

  entry.overlay.remove();
  entry.element.classList.remove("detail-stacked");
  if (entry.element.dataset.detailId) {
    entry.element.id = entry.element.dataset.detailId;
    delete entry.element.dataset.detailId;
  }
  entry.element.querySelectorAll("[data-detail-id]").forEach((element) => {
    element.id = element.dataset.detailId;
    delete element.dataset.detailId;
  });

  STATE.activeDetailToken = entry.token;
  updateDetailStackOffsets();
}

// Pop everything above (and including the panels covering) the given panel.
function popToDetailPanel(element) {
  while (STATE.detailStack.some((entry) => entry.element === element)) {
    popDetailView();
  }
}

// Cascade: the bottom panel stays centered, each layer above shifts
// down-right so the whole stack stays readable.
function updateDetailStackOffsets() {
  const step = 16;
  STATE.detailStack.forEach((entry, index) => {
    const offset = Math.min(index, 4) * step;
    entry.element.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
  });

  const top = document.getElementById("detail-view");
  if (top) {
    if (STATE.detailStack.length > 0) {
      const offset = Math.min(STATE.detailStack.length, 4) * step;
      top.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
    } else {
      top.style.transform = "";
    }
  }
}

function closeDetailView() {
  if (STATE.detailStack.length > 0) {
    popDetailView();
    return;
  }

  STATE.activeDetailToken = null;
  document.getElementById("detail-view").style.display = "none";
  updateDetailStackOffsets();

  // Show the previously hidden block
  if (STATE.lastViewedBlockElement) {
    STATE.lastViewedBlockElement.style.display = "";
    STATE.lastViewedBlockElement = null;
  }
}

// Discard the whole stack (channel switch, opening a fresh detail, etc.)
function closeAllDetailViews() {
  while (STATE.detailStack.length > 0) {
    popDetailView();
  }
  closeDetailView();
}

function formatRelativeTime(timestamp) {
  const time = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (!Number.isFinite(time)) {
    return "";
  }

  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 30 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(time).toLocaleDateString();
}

function addMetaItem(label, value, linkHref, isHTML = false, valueClassName = "", options = {}) {
  const metaContainer = document.getElementById("detail-view-meta");
  if (!value) return null;
  let item = document.createElement("div");
  item.className = "meta-item";
  if (isHTML) {
    item.classList.add("meta-wide");
  }
  item.innerHTML = `<strong>${label}:</strong> `;
  if (isHTML) {
    let contentDiv = document.createElement("div");
    contentDiv.innerHTML = value;
    item.appendChild(contentDiv);
  } else {
    if (linkHref) {
      let a = document.createElement("a");
      a.href = linkHref;
      if (options.internal) {
        // In-app hash link (e.g. #@user); let the router take it from here.
        a.addEventListener("click", () => closeAllDetailViews());
      } else {
        a.target = "_blank";
      }
      a.textContent = value;
      if (valueClassName) {
        a.classList.add(valueClassName);
      }
      item.appendChild(a);
    } else if (valueClassName) {
      const span = document.createElement("span");
      span.className = valueClassName;
      span.textContent = value;
      item.appendChild(span);
    } else {
      item.appendChild(document.createTextNode(value));
    }
  }
  metaContainer.appendChild(item);
  return item;
}

function resetDetailPanels() {
  document.getElementById("detail-view-content").innerHTML = "";
  document.getElementById("detail-view-link").innerHTML = "";
  document.getElementById("detail-view-info").innerHTML = "";
  document.getElementById("detail-view-meta").innerHTML = "";
}

function getChannelVisibilityLabel(visibility) {
  return (
    {
      public: "Public",
      closed: "Closed",
      private: "Private",
    }[visibility] || "Unknown"
  );
}

function getVisibilityClass(visibility) {
  return (
    {
      public: "vis-public",
      private: "vis-private",
      closed: "vis-closed",
    }[visibility] || ""
  );
}

// Each detail render gets a unique token object; async fetches bail out when
// the active token no longer matches, so a stale response can never write
// into a newer view. Panel-stack restores reinstate the saved token, which
// keeps interactive continuations (load more, lazy comments) working.
function beginDetailRequest() {
  const token = {};
  STATE.activeDetailToken = token;
  return token;
}

function isDetailTokenActive(token) {
  return STATE.activeDetailToken === token;
}

// "Connections" meta section: how many channels an item appears in, with an
// expandable, paginated list. Counts require a request, so the slot is
// created empty (hidden) and filled asynchronously; items with zero
// connections show nothing at all.
function setupConnectionsSection(item, requestToken) {
  const metaContainer = document.getElementById("detail-view-meta");
  const slot = document.createElement("div");
  slot.className = "meta-item meta-wide connections-slot";
  // Render the row immediately alongside the other meta items (no layout
  // shift once the count arrives); the value starts as a loading state.
  const strong = document.createElement("strong");
  strong.textContent = "Connections: ";
  const status = document.createElement("span");
  status.className = "connections-status";
  status.textContent = "loading...";
  slot.appendChild(strong);
  slot.appendChild(status);
  metaContainer.appendChild(slot);
  populateConnectionsSection(slot, status, item, requestToken);
}

async function populateConnectionsSection(slot, status, item, requestToken) {
  const per = CONFIG.connectionsPerPage;
  const isChannel = item.kind === "channel";
  const fetchPage = (page) => (isChannel ? arenaAPI.getChannelConnectionsPage(item.slug || item.id, page, per) : arenaAPI.getBlockConnectionsPage(item.id, page, per));

  let firstPage;
  try {
    firstPage = await fetchPage(1);
  } catch (error) {
    console.error("Error fetching connections:", error);
    if (isDetailTokenActive(requestToken) && slot.isConnected) {
      status.textContent = "failed to load";
    }
    return;
  }

  if (!isDetailTokenActive(requestToken) || !slot.isConnected) {
    return;
  }

  const total = firstPage.meta?.total_count ?? firstPage.data.length;
  if (!total) {
    status.textContent = "none";
    return;
  }

  const channelWord = total === 1 ? "channel" : "channels";
  const toggle = document.createElement("a");
  toggle.href = "#";
  toggle.className = "connections-toggle";
  toggle.textContent = `${total} ${channelWord} ▸`;

  const list = document.createElement("div");
  list.className = "connections-list";

  const pager = { page: 1, meta: firstPage.meta, loading: false };
  let loadMoreButton = null;

  function appendChannels(channels) {
    channels.forEach((channel) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "connection-item";
      row.dataset.slug = channel.slug || String(channel.id);

      const title = document.createElement("span");
      title.className = "connection-title";
      const visibilityClass = getVisibilityClass(channel.visibility);
      if (visibilityClass) {
        title.classList.add(visibilityClass);
      }
      title.textContent = channel.title || "Untitled Channel";

      const info = document.createElement("span");
      info.className = "connection-info";
      const parts = [];
      if (channel.owner?.name) {
        parts.push(channel.owner.name);
      }
      if (channel.counts?.contents != null) {
        parts.push(`${channel.counts.contents} blocks`);
      }
      info.textContent = parts.join(" · ");

      row.appendChild(title);
      row.appendChild(info);
      row.addEventListener("click", () => {
        // Stack the new channel panel on top of the current detail instead
        // of replacing it, closing it comes right back here.
        pushDetailView();
        showChannelDetailBySlug(channel.slug || channel.id, {
          title: channel.title || "Channel",
          contextItem: channel,
          primaryActionLabel: "Go to Channel",
          primaryAction: () => {
            closeAllDetailViews();
            router.navigate(channel.slug || String(channel.id));
          },
          arenaUrl: channel.arenaUrl,
        });
      });

      if (loadMoreButton && loadMoreButton.parentElement === list) {
        list.insertBefore(row, loadMoreButton);
      } else {
        list.appendChild(row);
      }
    });
  }

  if (firstPage.meta?.has_more_pages) {
    loadMoreButton = document.createElement("button");
    loadMoreButton.type = "button";
    loadMoreButton.className = "connections-load-more";
    loadMoreButton.textContent = `Load more (${firstPage.data.length}/${total})`;
    loadMoreButton.addEventListener("click", async () => {
      if (pager.loading) {
        return;
      }
      pager.loading = true;
      loadMoreButton.textContent = "Loading...";
      try {
        const nextPage = await fetchPage(pager.page + 1);
        if (!isDetailTokenActive(requestToken) || !slot.isConnected) {
          return;
        }
        pager.page += 1;
        pager.meta = nextPage.meta;
        appendChannels(nextPage.data);
        if (nextPage.meta?.has_more_pages) {
          const shown = list.querySelectorAll(".connection-item").length;
          loadMoreButton.textContent = `Load more (${shown}/${total})`;
        } else {
          loadMoreButton.remove();
        }
      } catch (error) {
        console.error("Error fetching more connections:", error);
        loadMoreButton.textContent = "Load more (failed, click to retry)";
      } finally {
        pager.loading = false;
      }
    });
  }

  appendChannels(firstPage.data);
  if (loadMoreButton) {
    list.appendChild(loadMoreButton);
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const open = list.classList.toggle("show");
    toggle.textContent = `${total} ${channelWord} ${open ? "▾" : "▸"}`;
  });

  status.replaceWith(toggle);
  slot.appendChild(list);
}

// "Comments" meta section. The count comes free with the block data, so the
// row renders instantly and the list is only fetched on first expand.
function setupCommentsSection(block, requestToken) {
  const total = block.commentCount;
  if (!total || total < 1) {
    return;
  }

  const metaContainer = document.getElementById("detail-view-meta");
  const slot = document.createElement("div");
  slot.className = "meta-item meta-wide comments-slot";

  const strong = document.createElement("strong");
  strong.textContent = "Comments: ";

  const commentWord = total === 1 ? "comment" : "comments";
  const toggle = document.createElement("a");
  toggle.href = "#";
  toggle.className = "connections-toggle";
  toggle.textContent = `${total} ${commentWord} ▸`;

  const list = document.createElement("div");
  list.className = "connections-list comments-list";

  const pager = { page: 0, meta: null, loading: false };
  let loadMoreButton = null;

  function appendComments(comments) {
    comments.forEach((comment) => {
      const row = document.createElement("div");
      row.className = "comment-item";

      const header = document.createElement("div");
      header.className = "comment-header";

      const author = document.createElement("a");
      author.className = "comment-author";
      if (comment.user?.slug) {
        author.href = `#@${comment.user.slug}`;
        author.addEventListener("click", () => closeAllDetailViews());
      } else {
        author.href = "#";
      }
      author.textContent = comment.user?.name || "Unknown";

      const time = document.createElement("span");
      time.className = "comment-time";
      time.textContent = comment.createdAt ? formatRelativeTime(comment.createdAt) : "";

      header.appendChild(author);
      header.appendChild(time);
      row.appendChild(header);

      const body = document.createElement("div");
      body.className = "comment-body";
      if (comment.bodyHtml) {
        body.innerHTML = comment.bodyHtml;
      } else {
        body.textContent = comment.bodyPlain;
      }
      row.appendChild(body);

      if (loadMoreButton && loadMoreButton.parentElement === list) {
        list.insertBefore(row, loadMoreButton);
      } else {
        list.appendChild(row);
      }
    });
  }

  async function loadPage(page) {
    pager.loading = true;
    try {
      const result = await arenaAPI.getBlockCommentsPage(block.id, page, CONFIG.commentsPerPage);
      if (!isDetailTokenActive(requestToken) || !slot.isConnected) {
        return;
      }
      pager.page = page;
      pager.meta = result.meta;
      appendComments(result.data);

      if (result.meta?.has_more_pages) {
        if (!loadMoreButton) {
          loadMoreButton = document.createElement("button");
          loadMoreButton.type = "button";
          loadMoreButton.className = "connections-load-more";
          loadMoreButton.addEventListener("click", () => {
            if (!pager.loading) {
              loadMoreButton.textContent = "Loading...";
              loadPage(pager.page + 1);
            }
          });
          list.appendChild(loadMoreButton);
        }
        loadMoreButton.textContent = `Load more (${list.querySelectorAll(".comment-item").length}/${total})`;
      } else if (loadMoreButton) {
        loadMoreButton.remove();
        loadMoreButton = null;
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      pager.loading = false;
    }
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const open = list.classList.toggle("show");
    toggle.textContent = `${total} ${commentWord} ${open ? "▾" : "▸"}`;
    if (open && pager.page === 0 && !pager.loading) {
      loadPage(1);
    }
  });

  slot.appendChild(strong);
  slot.appendChild(toggle);
  slot.appendChild(list);
  metaContainer.appendChild(slot);
}

// "Connect" meta section: add this block to one of your channels.
// Requires login with a write-scope token; read-only tokens get a
// clear explanation instead of a raw 403.
// "Connect" action: a button in the block or channel detail that opens a
// searchable picker of your channels as a stacked panel. Requires login
// with a write-scope token; read-only tokens get a clear explanation.
function setupConnectSection(item, requestToken) {
  if (typeof isLoggedIn !== "function" || !isLoggedIn()) {
    return;
  }

  const metaContainer = document.getElementById("detail-view-meta");
  const slot = document.createElement("div");
  slot.className = "meta-item meta-wide connect-slot";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "detail-action-button";
  button.textContent = "+ Connect to Channel";
  button.addEventListener("click", () => {
    showConnectPickerPanel(item);
  });

  slot.appendChild(button);
  metaContainer.appendChild(slot);
}

// --- Searchable list --------------------------------------------------------
// Reusable list-with-search component (connect picker, full history view).
// Table-styled: flush rows, hairline separators, sticky search on top.
// Items: { label, labelClassName?, info?, keywords?, onSelect(row) }.

function createSearchableList(options = {}) {
  const element = document.createElement("div");
  element.className = "searchable-list";

  const search = document.createElement("input");
  search.type = "text";
  search.className = "searchable-list-input";
  search.placeholder = options.placeholder || "search...";
  search.autocomplete = "off";
  search.spellcheck = false;

  const rowsContainer = document.createElement("div");
  rowsContainer.className = "searchable-list-rows";

  element.appendChild(search);
  element.appendChild(rowsContainer);

  let items = [];

  function showHint(text) {
    rowsContainer.replaceChildren();
    const hint = document.createElement("div");
    hint.className = "searchable-list-hint";
    hint.textContent = text;
    rowsContainer.appendChild(hint);
  }

  function render() {
    const filter = search.value.trim().toLowerCase();
    const filtered = filter ? items.filter((item) => (item.keywords || item.label || "").toLowerCase().includes(filter)) : items;

    rowsContainer.replaceChildren();

    if (filtered.length === 0) {
      showHint(filter ? "no matches" : options.emptyText || "nothing here yet");
      return;
    }

    filtered.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "list-row";

      const label = document.createElement("span");
      label.className = "list-row-label";
      if (item.labelClassName) {
        label.classList.add(item.labelClassName);
      }
      label.textContent = item.label;

      const info = document.createElement("span");
      info.className = "list-row-info";
      info.textContent = item.info || "";

      row.appendChild(label);
      row.appendChild(info);
      row.addEventListener("click", () => item.onSelect(row));
      rowsContainer.appendChild(row);
    });
  }

  search.addEventListener("input", render);

  return {
    element,
    focus: () => search.focus(),
    setHint: showHint,
    setItems(next) {
      items = next;
      render();
    },
  };
}

// Stacked panel listing your channels; selecting one connects the block.
function showConnectPickerPanel(item) {
  const isChannel = item.kind === "channel";
  const connectableType = isChannel ? "Channel" : "Block";
  pushDetailView();
  const requestToken = beginDetailRequest();
  resetDetailPanels();

  const titleElement = document.getElementById("detail-view-title");
  titleElement.textContent = "Connect to Channel";
  titleElement.title = "Connect to Channel";
  document.getElementById("detail-view-arena-link").href = item.arenaUrl || (isChannel ? `https://www.are.na/channel/${item.slug}` : `https://www.are.na/block/${item.id}`);

  const list = createSearchableList({
    placeholder: "search your channels...",
    emptyText: "no channels yet, create one on are.na first",
  });
  document.getElementById("detail-view-content").appendChild(list.element);
  list.setHint("loading your channels...");
  list.focus();

  loadMyChannels()
    .then((cache) => {
      if (!isDetailTokenActive(requestToken)) {
        return;
      }
      const channels = (cache?.items || []).filter((ch) => !(isChannel && (ch.slug === item.slug || ch.id === item.id)));
      if (channels.length === 0) {
        list.setHint("no channels available");
        return;
      }
      list.setItems(
        channels.map((channel) => ({
          label: channel.title || "Untitled Channel",
          labelClassName: getVisibilityClass(channel.visibility),
          info: channel.counts?.contents != null ? `${channel.counts.contents} blocks` : "",
          keywords: `${channel.title || ""} ${channel.slug || ""}`,
          onSelect: (row) => connectItemToChannel(item, connectableType, channel, row),
        })),
      );
    })
    .catch((error) => {
      if (isDetailTokenActive(requestToken)) {
        list.setHint(`failed to load channels: ${error.message}`);
      }
    });
}

async function connectItemToChannel(item, connectableType, channel, row) {
  if (row.disabled) {
    return;
  }
  row.disabled = true;
  const info = row.querySelector(".list-row-info");
  const originalInfo = info.textContent;
  info.textContent = "connecting...";

  try {
    const connection = await arenaAPI.createConnection(item.id, channel.id, connectableType);
    closeDetailView();
    showToast({
      message: `Connected to "${channel.title || "channel"}"`,
      actionLabel: "undo",
      seconds: 3,
      onAction: async () => {
        try {
          if (connection.id != null) {
            await arenaAPI.deleteConnection(connection.id);
            showToast({ message: "Connection removed", seconds: 2 });
          }
        } catch (error) {
          showToast({ message: `Undo failed: ${error.message}`, seconds: 5 });
        }
      },
    });
  } catch (error) {
    row.disabled = false;
    info.textContent = originalInfo;
    if (String(error.message).includes("403")) {
      showToast({
        message: "Your token is read-only, create one with write scope to connect",
        seconds: 6,
      });
    } else {
      showToast({ message: `Connect failed: ${error.message}`, seconds: 5 });
    }
  }
}

// --- Toast ------------------------------------------------------------------
// Small self-dismissing notice with a countdown and an optional action
// (e.g. "Connected to X, [undo]  dismiss (3)").

function showToast(options = {}) {
  const existing = document.getElementById("app-toast");
  if (existing) {
    clearInterval(existing._countdownId);
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = "app-toast";

  const message = document.createElement("span");
  message.className = "toast-message";
  message.textContent = options.message || "";
  toast.appendChild(message);

  if (options.actionLabel && typeof options.onAction === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast-action";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      clearInterval(toast._countdownId);
      toast.remove();
      options.onAction();
    });
    toast.appendChild(action);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "toast-dismiss";
  let remaining = Math.max(1, Math.round(options.seconds || 3));
  dismiss.textContent = `dismiss (${remaining})`;
  dismiss.addEventListener("click", () => {
    clearInterval(toast._countdownId);
    toast.remove();
  });
  toast.appendChild(dismiss);

  toast._countdownId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(toast._countdownId);
      toast.remove();
    } else {
      dismiss.textContent = `dismiss (${remaining})`;
    }
  }, 1000);

  document.body.appendChild(toast);
  return toast;
}

function renderChannelDetailContent(channelData, followerCount, options = {}) {
  const detailContent = document.getElementById("detail-view-content");
  const detailTitle = document.getElementById("detail-view-title");
  const arenaLink = document.getElementById("detail-view-arena-link");

  resetDetailPanels();
  detailTitle.textContent = options.title || channelData.title || "Channel";
  arenaLink.href = options.arenaUrl || channelData.arenaUrl || `https://www.are.na/channel/${channelData.slug}`;

  const contentWrapper = document.createElement("div");
  contentWrapper.id = "channel-detail-container";

  const basicInfo = document.createElement("div");
  basicInfo.id = "channel-basic-info";

  const textInfo = document.createElement("div");
  textInfo.id = "channel-text-info";

  if (channelData.descriptionHtml) {
    const description = document.createElement("div");
    description.id = "channel-description";
    description.innerHTML = channelData.descriptionHtml;
    textInfo.appendChild(description);
  }

  if (options.primaryActionLabel && typeof options.primaryAction === "function") {
    const actionButton = document.createElement("button");
    actionButton.id = "channel-goto-button";
    actionButton.className = "detail-action-button";
    actionButton.textContent = options.primaryActionLabel;
    actionButton.addEventListener("click", options.primaryAction);
    textInfo.appendChild(actionButton);
  }

  const coverVersion = channelData.coverImageVersions?.display || channelData.coverImageVersions?.large;
  if (coverVersion?.url) {
    const coverWrapper = document.createElement("div");
    coverWrapper.id = "channel-cover-wrapper";

    const cover = document.createElement("img");
    cover.id = "channel-cover-image";
    cover.src = coverVersion.url;
    cover.alt = `${channelData.title} channel cover`;

    coverWrapper.appendChild(cover);
    basicInfo.appendChild(coverWrapper);
  }

  basicInfo.insertBefore(textInfo, basicInfo.firstChild);
  contentWrapper.appendChild(basicInfo);
  detailContent.appendChild(contentWrapper);

  // Channel facts live in the meta strip at the bottom, consistent with
  // block detail views. The author link browses that user inside the app.
  if (channelData.owner?.name) {
    if (channelData.owner.type === "User" && channelData.owner.slug) {
      addMetaItem("Author", channelData.owner.name, `#@${channelData.owner.slug}`, false, "", { internal: true });
    } else {
      const ownerUrl = channelData.owner.slug ? `https://www.are.na/${channelData.owner.slug}` : null;
      addMetaItem("Author", channelData.owner.name, ownerUrl);
    }
  }
  addMetaItem("Blocks", String(channelData.counts?.contents ?? 0));
  addMetaItem("Followers", String(followerCount ?? 0));
  if (channelData.createdAt) {
    addMetaItem("Created", new Date(channelData.createdAt).toLocaleDateString());
  }
  if (channelData.updatedAt) {
    addMetaItem("Updated", new Date(channelData.updatedAt).toLocaleDateString());
  }
  addMetaItem("Visibility", getChannelVisibilityLabel(channelData.visibility), null, false, getVisibilityClass(channelData.visibility));
  if (channelData.state) {
    addMetaItem("State", channelData.state);
  }

  if (options.contextItem?.connection?.connectedAt) {
    addMetaItem("Connected At", new Date(options.contextItem.connection.connectedAt).toLocaleString(), null);
  }

  if (options.contextItem?.connection?.connectedBy?.name) {
    const connectedByUrl = options.contextItem.connection.connectedBy.slug ? `https://www.are.na/${options.contextItem.connection.connectedBy.slug}` : null;
    addMetaItem("Connected By", options.contextItem.connection.connectedBy.name, connectedByUrl, false);
  }
}

async function showChannelDetailBySlug(slug, options = {}) {
  if (!slug) {
    return;
  }

  const requestToken = beginDetailRequest();
  const detailContent = document.getElementById("detail-view-content");
  resetDetailPanels();
  detailContent.innerHTML = '<div style="padding: 20px;">Loading channel details...</div>';
  document.getElementById("detail-view").style.display = "flex";

  try {
    const [channelResult, followerResult] = await Promise.allSettled([arenaAPI.getChannel(slug), arenaAPI.getChannelFollowerCount(slug)]);

    if (!isDetailTokenActive(requestToken)) {
      return;
    }

    if (channelResult.status !== "fulfilled") {
      throw channelResult.reason;
    }

    const followerCount = followerResult.status === "fulfilled" ? followerResult.value : 0;
    renderChannelDetailContent(channelResult.value, followerCount, options);
    setupConnectionsSection(channelResult.value, requestToken);
    setupConnectSection(channelResult.value, requestToken);
  } catch (error) {
    console.error("Error fetching channel details:", error);
    if (isDetailTokenActive(requestToken)) {
      detailContent.innerHTML = '<div style="padding: 20px;">Failed to load channel details</div>';
    }
  }
}

function showAboutView() {
  closeAllDetailViews();

  const detailView = document.getElementById("detail-view");
  const detailTitle = document.getElementById("detail-view-title");
  const detailContent = document.getElementById("detail-view-content");
  const detailMeta = document.getElementById("detail-view-meta");
  const arenaLink = document.getElementById("detail-view-arena-link");

  resetDetailPanels();
  beginDetailRequest();
  detailTitle.textContent = "About Are.na Blocks Canvas";

  detailContent.innerHTML = `
    <div style="line-height: 1.6;">
      <p><i>Are.na Blocks Canvas</i> is a tool for visually browsing Are.na content. It provides a unique, interactive interface to explore, wander, and surf between channels.</p>
      <h2>What is Are.na?</h2>
      <p>Are.na is an interest-based social network where users can create and join various channels to share and discover content.</p>
      <p>Visit <a href="https://are.na" target="_blank">are.na</a> to create an account.</p>
      <h2>Philosophy</h2>
      <p>Built with 0 productivity in mind: Are.na feels like a park to me, where you can wander around without much purpose but discover interesting content. Therefore, this project is also meant for casual exploration.</p>
      <p>Looking for instructions? Open <i>help</i> from the ✶✶ menu.</p>
      <p>This project is <a href="https://github.com/l3ony2k/are.na-blocks-canvas" target="_blank">open source</a>. Contributions and feedback are welcome.</p>
    </div>
  `;

  detailMeta.innerHTML = `
    <div class="meta-item">
      <strong>Version:</strong> ${CONFIG.version}
    </div>
    <div class="meta-item">
      <strong>Created by</strong> <a href="https://www.are.na/lok" target="_blank">lok ✶</a> with love
    </div>
  `;

  arenaLink.href = "https://www.are.na/lok";
  detailView.style.display = "flex";
}

function showHelpView() {
  closeAllDetailViews();

  const detailView = document.getElementById("detail-view");
  const detailTitle = document.getElementById("detail-view-title");
  const detailContent = document.getElementById("detail-view-content");
  const detailMeta = document.getElementById("detail-view-meta");
  const arenaLink = document.getElementById("detail-view-arena-link");

  resetDetailPanels();
  beginDetailRequest();
  detailTitle.textContent = "Help";

  detailContent.innerHTML = `
    <div style="line-height: 1.6;">
      <h2>Getting around</h2>
      <ul>
        <li>Enter a channel slug and hit GO to load a channel</li>
        <li>Enter <b>@username</b> to browse someone's channels as blocks</li>
        <li>The ✶✶ menu (top left) holds channel info, your history, login and more</li>
      </ul>
      <h2>Blocks</h2>
      <ul>
        <li>Drag blocks to move them, scroll on a block to rotate it</li>
        <li>Double click a block to open its details</li>
        <li>Click a channel block to jump into that channel</li>
      </ul>
      <h2>Layout modes</h2>
      <ul>
        <li><b>mix</b> scatters blocks, <b>tile</b> arranges them in a grid</li>
        <li><b>flow</b> is an endless canvas: drag or scroll to pan, pinch or ctrl/cmd + scroll to zoom</li>
      </ul>
      <h2>Surfing</h2>
      <ul>
        <li>In block details, <b>Connections</b> lists every channel the block lives in, open one to peek at it</li>
        <li>The ✶✶ logo in any detail panel links to that content on are.na</li>
        <li><b>random surf</b> in the ✶✶ menu picks a random block and follows a random connection</li>
        <li><b>recently surfed</b> in the ✶✶ menu takes you back to where you have been</li>
      </ul>
      <h2>Logging in</h2>
      <ul>
        <li>Log in with an Are.na personal access token to see your own channels when you click the search box</li>
        <li>Choose <b>write</b> scope when creating the token to connect blocks to your channels right from their details</li>
      </ul>
    </div>
  `;

  detailMeta.innerHTML = `
    <div class="meta-item">
      <strong>Tip:</strong> just wander freely and have fun.
    </div>
  `;

  arenaLink.href = "https://www.are.na/developers";
  detailView.style.display = "flex";
}

// Detail panel for a user (used as "channel info" of a @user view).
async function showUserDetail(userSlug) {
  closeAllDetailViews();

  const requestToken = beginDetailRequest();
  const detailView = document.getElementById("detail-view");
  const detailTitle = document.getElementById("detail-view-title");
  const detailContent = document.getElementById("detail-view-content");
  const arenaLink = document.getElementById("detail-view-arena-link");

  resetDetailPanels();
  detailTitle.textContent = `@${userSlug}`;
  detailContent.innerHTML = '<div style="padding: 20px;">Loading user...</div>';
  arenaLink.href = `https://www.are.na/${userSlug}`;
  detailView.style.display = "flex";

  try {
    const profile = await arenaAPI.getUserProfile(userSlug);
    if (!isDetailTokenActive(requestToken)) {
      return;
    }

    resetDetailPanels();
    detailTitle.textContent = profile.name || `@${userSlug}`;

    const wrapper = document.createElement("div");
    wrapper.id = "user-detail-container";

    if (profile.avatar) {
      const avatar = document.createElement("img");
      avatar.id = "user-detail-avatar";
      avatar.src = profile.avatar;
      avatar.alt = profile.name || userSlug;
      wrapper.appendChild(avatar);
    }

    const info = document.createElement("div");
    info.id = "user-detail-info";
    if (profile.bioHtml) {
      const bio = document.createElement("div");
      bio.innerHTML = profile.bioHtml;
      info.appendChild(bio);
    }
    wrapper.appendChild(info);
    detailContent.appendChild(wrapper);

    if (profile.counts.channels != null) {
      addMetaItem("Channels", String(profile.counts.channels));
    }
    if (profile.counts.followers != null) {
      addMetaItem("Followers", String(profile.counts.followers));
    }
    if (profile.counts.following != null) {
      addMetaItem("Following", String(profile.counts.following));
    }
    if (profile.createdAt) {
      addMetaItem("Joined", new Date(profile.createdAt).toLocaleDateString());
    }
    addMetaItem("Profile", `are.na/${profile.slug || userSlug}`, `https://www.are.na/${profile.slug || userSlug}`);
  } catch (error) {
    console.error("Error fetching user details:", error);
    if (isDetailTokenActive(requestToken)) {
      detailContent.innerHTML = '<div style="padding: 20px;">Failed to load user details</div>';
    }
  }
}

// Full surf history as a detail panel (the menu shows only the tail).
async function showHistoryView() {
  closeAllDetailViews();

  beginDetailRequest();
  const detailView = document.getElementById("detail-view");
  const detailTitle = document.getElementById("detail-view-title");
  const detailContent = document.getElementById("detail-view-content");
  const arenaLink = document.getElementById("detail-view-arena-link");

  resetDetailPanels();
  detailTitle.textContent = "Recently Surfed";
  arenaLink.href = "https://www.are.na";
  detailView.style.display = "flex";

  const list = createSearchableList({
    placeholder: "search history...",
    emptyText: "no history yet, go surf something",
  });
  detailContent.appendChild(list.element);
  list.setHint("loading...");

  let entries = [];
  try {
    entries = await arenaDB.getHistory(200);
  } catch (error) {
    console.error("Failed to load history:", error);
  }

  list.setItems(
    entries.map((entry) => ({
      label: entry.title || entry.slug,
      info: formatRelativeTime(entry.timestamp),
      keywords: `${entry.title || ""} ${entry.slug}`,
      onSelect: () => {
        closeAllDetailViews();
        router.navigate(entry.slug);
      },
    })),
  );
}

function initHeaderBar() {
  const slugInput = document.getElementById("channel-slug-input");
  slugInput.value = STATE.channelSlugs[0];
  document.getElementById("goto-button").addEventListener("click", handleGoButtonClick);
  slugInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      // An arrow-key-highlighted dropdown row wins over the typed text.
      const activeChannel = typeof getActiveDropdownChannel === "function" ? getActiveDropdownChannel() : null;
      if (activeChannel) {
        hideChannelDropdown();
        slugInput.blur();
        router.navigate(activeChannel, true, false);
        return;
      }
      handleGoButtonClick();
    }
  });

  // Initialize layout mode button (label always shows the CURRENT mode)
  const tileButton = document.getElementById("tile-button");
  setLayoutButtonText(getSavedLayoutMode());
  tileButton.addEventListener("click", () => {
    cycleLayoutMode();
  });

  const themeToggle = document.getElementById("theme-toggle");
  const root = document.documentElement;

  const savedTheme = localStorage.getItem("theme") || "system";
  root.setAttribute("data-theme", savedTheme);
  updateThemeToggleText(savedTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = root.getAttribute("data-theme");
    let newTheme;

    switch (currentTheme) {
      case "system":
        newTheme = "light";
        break;
      case "light":
        newTheme = "dark";
        break;
      default:
        newTheme = "system";
    }

    root.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeToggleText(newTheme);
    updatePWAThemeColors(newTheme);

    if (STATE.layoutMode === "flow") {
      requestFlowRender();
    }
  });
}

function handleGoButtonClick() {
  const newSlug = document.getElementById("channel-slug-input").value.trim();
  if (newSlug) {
    router.navigate(newSlug, true, true);
  }
}

function setLayoutButtonText(text) {
  const tileButton = document.getElementById("tile-button");
  const moreTileButton = document.getElementById("more-tile-button");

  if (tileButton) {
    tileButton.textContent = text;
  }
  if (moreTileButton) {
    moreTileButton.textContent = text;
  }
}

const LAYOUT_MODES = ["mix", "tile", "flow"];

function getSavedLayoutMode() {
  const saved = localStorage.getItem("layoutMode");
  return LAYOUT_MODES.includes(saved) ? saved : "mix";
}

function cycleLayoutMode() {
  const nextIndex = (LAYOUT_MODES.indexOf(STATE.layoutMode) + 1) % LAYOUT_MODES.length;
  setLayoutMode(LAYOUT_MODES[nextIndex]);
}

function setLayoutMode(mode, options = {}) {
  const settings = { persist: true, ...options };

  if (!LAYOUT_MODES.includes(mode) || mode === STATE.layoutMode) {
    return;
  }

  if (settings.persist) {
    localStorage.setItem("layoutMode", mode);
  }

  if (STATE.layoutMode === "flow") {
    exitFlowMode();
  }

  STATE.layoutMode = mode;
  setLayoutButtonText(mode);

  if (mode === "tile") {
    tileBlocks();
  } else if (mode === "flow") {
    enterFlowMode();
  } else {
    shuffleBlocks();
  }
}

// Re-apply the persisted layout mode after a channel's blocks have been
// loaded and rendered (default rendering is always mix-style DOM blocks).
function applySavedLayoutMode() {
  const mode = getSavedLayoutMode();
  setLayoutButtonText(mode);

  if (mode === STATE.layoutMode) {
    return;
  }

  if (mode === "flow") {
    STATE.layoutMode = "flow";
    enterFlowMode();
  } else if (mode === "tile") {
    STATE.layoutMode = "tile";
    tileBlocks();
  } else {
    STATE.layoutMode = "mix";
  }
}

// Debounced write-through of STATE.cachedBlockPositions / block order to IndexedDB.
function schedulePositionCacheSave(delay = 800) {
  clearTimeout(STATE._positionSaveTimeout);
  STATE._positionSaveTimeout = setTimeout(() => {
    STATE._positionSaveTimeout = null;
    const slug = STATE.channelSlugs[0];
    arenaDB
      .getChannel(slug)
      .then((cachedData) => {
        if (cachedData) {
          return arenaDB.saveChannel(slug, cachedData.data);
        }
      })
      .catch((error) => {
        console.error("Error updating block positions in cache:", error);
      });
  }, delay);
}

// Initialize UI event listeners
document.addEventListener("DOMContentLoaded", () => {
  const headerBar = document.getElementById("header-bar");

  headerBar.addEventListener(
    "touchstart",
    (e) => {
      // Allow button clicks
    },
    { passive: true },
  );

  headerBar.addEventListener(
    "touchmove",
    (e) => {
      if (!e.target.matches("button, input")) {
        e.preventDefault();
      }
    },
    { passive: false },
  );

  const closeWrapper = document.getElementById("detail-view-close-wrapper");
  closeWrapper.addEventListener("click", closeDetailView);
  closeWrapper.addEventListener("touchend", closeDetailView);

  const arenaLink = document.getElementById("detail-view-arena-link");
  arenaLink.addEventListener("touchend", function (e) {
    window.open(this.href, "_blank");
  });
});

// Add new functions for tile and shuffle
function tileBlocks() {
  if (STATE.layoutMode === "flow") {
    return;
  }

  const blocks = Array.from(document.querySelectorAll(".block"));
  const blockWidth = 200;
  const blockHeight = 300;
  const headerHeight = 0; // used to be 30, seems like not necessary

  // 计算可用空间
  const availableWidth = window.innerWidth - blockWidth;
  const availableHeight = window.innerHeight - blockHeight - headerHeight;

  // 根据 blocks 数量动态计算布局
  const totalBlocks = blocks.length;
  const aspectRatio = availableWidth / availableHeight;

  // 计算理想的行列数，考虑屏幕比例
  let columnsCount = Math.ceil(Math.sqrt(totalBlocks * aspectRatio));
  let rowsCount = Math.ceil(totalBlocks / columnsCount);

  // 计算每个 block 之间的间距（允许重叠）
  const xSpacing = availableWidth / (columnsCount - 1 || 1);
  const ySpacing = availableHeight / (rowsCount - 1 || 1);

  blocks.forEach((block, index) => {
    const row = Math.floor(index / columnsCount);
    const col = index % columnsCount;

    // 计算基础位置
    let x = col * xSpacing;
    let y = headerHeight + row * ySpacing;

    // 添加一点随机偏移，但保持在边界内
    const maxOffset = Math.min(xSpacing, ySpacing) * 0.2;
    const randomOffsetX = (Math.random() - 0.5) * maxOffset;
    const randomOffsetY = (Math.random() - 0.5) * maxOffset;

    // 确保不会超出边界
    x = Math.max(0, Math.min(availableWidth, x + randomOffsetX));
    y = Math.max(headerHeight, Math.min(window.innerHeight - blockHeight, y + randomOffsetY));

    block.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;

    // Update cached position
    const blockId = block.dataset.blockId;
    if (blockId) {
      STATE.cachedBlockPositions[blockId] = {
        x: x,
        y: y,
        rotation: 0,
      };
    }
  });

  schedulePositionCacheSave();
  reprioritizeImageQueue();
}

function shuffleBlocks() {
  if (STATE.layoutMode === "flow") {
    return;
  }

  const blocks = Array.from(document.querySelectorAll(".block"));
  const blockWidth = 200;
  const blockHeight = 300;
  const headerHeight = 0; // used to be 30, seems like not necessary

  const minX = 0;
  const minY = 0;
  const maxX = window.innerWidth - blockWidth;
  const maxY = window.innerHeight - blockHeight - headerHeight;

  blocks.forEach((block) => {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const rotation = Math.random() * 20 - 10;

    block.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;

    // Update cached position
    const blockId = block.dataset.blockId;
    if (blockId) {
      STATE.cachedBlockPositions[blockId] = {
        x: x,
        y: y,
        rotation: rotation,
      };
    }
  });

  schedulePositionCacheSave();
  reprioritizeImageQueue();
}

function getFlowGapPixels() {
  const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  return CONFIG.flowGapRem * rootFontSize;
}

function getOrderedFlowBlocks() {
  const blockMap = new Map(STATE.allFetchedBlocks.map((block) => [String(block.id), block]));
  const orderedBlocks = STATE.cachedBlockOrder.map((id) => blockMap.get(String(id))).filter(Boolean);

  if (orderedBlocks.length > 0) {
    return orderedBlocks;
  }

  return STATE.allFetchedBlocks.slice();
}

function estimateFlowBlockHeight(block) {
  const maxHeight = CONFIG.flowBlockMaxHeight;
  const width = CONFIG.flowBlockWidth;
  const padding = CONFIG.flowBlockPadding;
  const borderWidth = CONFIG.flowBorderWidth;
  const contentWidth = width - padding * 2 - borderWidth * 2;

  // Channel blocks always render as centered text, even when the channel
  // has a cover image, so give them a fixed card height.
  if (block.kind === "channel") {
    return 150;
  }

  const versions = block.imageVersions;
  const measured = STATE.flowImageMeasurements[String(block.id)];
  const imageVersion = versions?.original || versions?.large || versions?.display || versions?.preview || versions?.thumb;
  const sourceWidth = measured?.width || versions?.width || imageVersion?.width;
  const sourceHeight = measured?.height || versions?.height || imageVersion?.height;

  if (sourceWidth && sourceHeight) {
    return Math.min(maxHeight, Math.max(80, (sourceHeight / sourceWidth) * contentWidth + padding * 2 + borderWidth * 2));
  }

  if (versions) {
    return Math.min(maxHeight, Math.max(120, contentWidth * 0.75 + padding * 2 + borderWidth * 2));
  }

  const text = block.textPlain || block.title || block.descriptionPlain || "";
  if (block.kind === "text" || text) {
    // ~19 monospace chars fit per 186px content line; CJK-heavy text gets
    // fewer, but overly tall blocks just show more before the ellipsis.
    const approxLines = Math.ceil(String(text).replace(/<[^>]+>/g, "").length / 19);
    return Math.min(maxHeight, Math.max(90, approxLines * CONFIG.flowTextLineHeight + padding * 2 + borderWidth * 2));
  }

  return 180;
}

function updateFlowImageMeasurement(blockId, width, height) {
  const id = String(blockId);
  const previous = STATE.flowImageMeasurements[id];

  if (previous?.width === width && previous?.height === height) {
    return;
  }

  STATE.flowImageMeasurements[id] = { width, height };

  if (STATE.layoutMode !== "flow" || !STATE.flow) {
    return;
  }

  if (STATE.flow.measurementFrame) {
    cancelAnimationFrame(STATE.flow.measurementFrame);
  }

  STATE.flow.measurementFrame = requestAnimationFrame(() => {
    if (!STATE.flow || STATE.layoutMode !== "flow") {
      return;
    }

    STATE.flow.measurementFrame = null;
    STATE.flow.pattern = buildFlowPattern();
    renderFlowViewport();
  });
}

function buildFlowPattern() {
  const blocks = getOrderedFlowBlocks();
  const gap = getFlowGapPixels();
  const blockWidth = CONFIG.flowBlockWidth;
  const columnPitch = blockWidth + gap;
  const viewportColumns = Math.ceil((window.innerWidth + gap) / columnPitch);
  const columnCount = Math.max(2, viewportColumns + 2);
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    x: index * columnPitch,
    height: 0,
    items: [],
  }));

  blocks.forEach((block, index) => {
    let column = 0;
    for (let current = 1; current < columns.length; current += 1) {
      if (columns[current].height < columns[column].height) {
        column = current;
      }
    }

    const height = estimateFlowBlockHeight(block);
    const y = columns[column].height;

    columns[column].items.push({
      block,
      blockIndex: index,
      y,
      width: blockWidth,
      height,
    });

    columns[column].height += height + gap;
  });

  // Each item already contributes a trailing gap above (height + gap), so the
  // last item's trailing gap is exactly the seam between one vertical cycle and
  // the next. Adding another gap here would double the gap at that seam.

  return {
    gap,
    blockWidth,
    columnPitch,
    columns,
    width: columnCount * columnPitch,
    hasItems: columns.some((column) => column.items.length > 0),
  };
}

function createFlowSurface() {
  let surface = document.getElementById("flow-surface");
  if (surface) {
    return surface;
  }

  surface = document.createElement("div");
  surface.id = "flow-surface";
  document.body.appendChild(surface);
  return surface;
}

function clearFlowInstances() {
  if (!STATE.flow) {
    return;
  }

  const elements = [...Array.from(STATE.flow.visible?.values() || []), ...(STATE.flow.pool || [])];

  elements.forEach((element) => {
    if (element._imageObserver) {
      element._imageObserver.disconnect();
    }
    element.remove();
  });
  STATE.flow.visible.clear();
  STATE.flow.pool = [];
}

function removeFlowSurface() {
  const surface = document.getElementById("flow-surface");
  if (surface) {
    surface.remove();
  }
}

function createFlowCanvas() {
  let canvas = document.getElementById("flow-canvas");
  if (canvas) {
    return canvas;
  }

  canvas = document.createElement("canvas");
  canvas.id = "flow-canvas";
  document.body.appendChild(canvas);
  return canvas;
}

function removeFlowCanvas() {
  const canvas = document.getElementById("flow-canvas");
  if (canvas) {
    canvas.remove();
  }
}

const FLOW_FONT_STACK = 'ui-monospace, Menlo, Monaco, "Cascadia Mono", monospace';

// Sample theme colors once per render pass instead of per block per frame.
function getFlowCanvasTheme() {
  const rootStyle = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => (rootStyle.getPropertyValue(name) || "").trim() || fallback;

  return {
    blockBg: pick("--block-bg", "#fff"),
    blockBorder: pick("--block-border", "#000"),
    channelBorder: pick("--channel-block-border", "#17ac10"),
    channelText: pick("--channel-block-text", "#17ac10"),
    textColor: pick("--text-color", "#111"),
    visPublic: pick("--vis-public-color", "#17ac10"),
    visPrivate: pick("--vis-private-color", "#c32222"),
  };
}

// Color + header label for a channel block drawn on the flow canvas.
// All channel blocks are colored by visibility, matching the DOM variant:
// green open / red private / plain closed. Only the header label differs
// between in-channel ("Connected Channel") and user-view blocks.
function getChannelBlockCanvasStyle(block, theme) {
  const label =
    block.displayVariant === "user-channel"
      ? {
          public: "Open Channel",
          private: "Private Channel",
          closed: "Closed Channel",
        }[block.visibility] || "Channel"
      : "Connected Channel";

  switch (block.visibility) {
    case "public":
      return { text: theme.visPublic, border: theme.visPublic, label };
    case "private":
      return { text: theme.visPrivate, border: theme.visPrivate, label };
    default:
      return { text: theme.textColor, border: theme.blockBorder, label };
  }
}

// Cached Path2D of the are.na glyph (13x8 viewBox) for canvas headers.
let arenaGlyphPath2D = null;

function getArenaGlyphPath2D() {
  if (!arenaGlyphPath2D && typeof Path2D !== "undefined") {
    arenaGlyphPath2D = new Path2D(ARENA_GLYPH_PATH);
  }
  return arenaGlyphPath2D;
}

function resizeFlowCanvas() {
  if (!STATE.flow?.canvas) {
    return;
  }

  const canvas = STATE.flow.canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = Math.max(1, window.innerHeight - 35);
  const deviceWidth = Math.floor(width * dpr);
  const deviceHeight = Math.floor(height * dpr);

  // Reallocating the backing store clears the canvas and is expensive,
  // so only do it when the size actually changed.
  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  STATE.flow.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCanvasText(block) {
  const cache = STATE.flow?.textCache;
  const key = String(block.id);
  if (cache?.has(key)) {
    return cache.get(key);
  }

  let text = (block.textPlain || block.descriptionPlain || "").trim();
  if (!text) {
    const html = block.textHtml || block.descriptionHtml || "";
    if (html) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      text = temp.textContent.trim();
    } else {
      text = block.title || block.source?.title || block.attachment?.filename || block.embed?.title || block.rawType || "Block";
    }
  }

  cache?.set(key, text);
  return text;
}

function getFlowImage(block) {
  if (!block.imageVersions) {
    return null;
  }

  const versions = block.imageVersions;
  // Flow blocks render at ~200 CSS px wide; a small/medium version covers
  // the whole 0.5-2x zoom range. Swapping to sharper versions mid-zoom
  // caused visible reload jank, so we deliberately don't.
  const version = versions.preview || versions.thumb || versions.display || versions.large || versions.original;
  if (!version?.url) {
    return null;
  }

  let entry = STATE.flow.imageCache.get(version.url);
  if (entry) {
    return entry;
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    entry.loaded = true;
    if (image.naturalWidth && image.naturalHeight) {
      updateFlowImageMeasurement(block.id, image.naturalWidth, image.naturalHeight);
    }
    requestFlowRender();
  };
  image.onerror = () => {
    entry.failed = true;
    requestFlowRender();
  };

  entry = {
    image,
    loaded: false,
    failed: false,
  };
  STATE.flow.imageCache.set(version.url, entry);
  image.src = version.url;
  return entry;
}

// Wrap text into at most maxLines lines fitting maxWidth with the current
// ctx.font. CJK characters break per glyph; overlong tokens are hard-broken.
// The last line gets an ellipsis when the text is truncated.
function wrapCanvasText(ctx, text, maxWidth, maxLines) {
  const source = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!source || maxLines < 1 || maxWidth <= 0) {
    return [];
  }

  const tokens = source.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]|[^\s\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+|\s/g) || [];
  const lines = [];
  let line = "";
  let truncated = false;

  function breakLongToken(token) {
    let rest = token;
    while (rest && ctx.measureText(rest).width > maxWidth) {
      if (lines.length >= maxLines) {
        truncated = true;
        return "";
      }
      let chunk = "";
      for (const char of rest) {
        if (chunk && ctx.measureText(chunk + char).width > maxWidth) {
          break;
        }
        chunk += char;
      }
      lines.push(chunk);
      rest = rest.slice(chunk.length);
    }
    return rest;
  }

  for (const token of tokens) {
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }

    const candidate = line + token;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line.trim()) {
      lines.push(line.trimEnd());
    }
    line = breakLongToken(token.trimStart());
  }

  if (line.trim()) {
    if (lines.length < maxLines && !truncated) {
      lines.push(line.trimEnd());
    } else {
      truncated = true;
    }
  }

  if (truncated && lines.length > 0) {
    lines.length = Math.min(lines.length, maxLines);
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}\u2026`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}\u2026`;
  }

  return lines;
}

// Mirrors the DOM channel-block style: small header label with a large,
// centered, wrapped title below it.
function drawFlowChannelBlock(ctx, block, theme, contentX, contentY, contentWidth, contentHeight) {
  const headerFontSize = 12;
  const headerLineHeight = headerFontSize + 4;
  const titleFontSize = CONFIG.flowChannelFontSize;
  const titleLineHeight = CONFIG.flowChannelLineHeight;
  const groupGap = 5;
  const centerX = contentX + contentWidth / 2;
  const style = getChannelBlockCanvasStyle(block, theme);

  ctx.fillStyle = style.text;
  ctx.textAlign = "center";

  ctx.font = `${titleFontSize}px ${FLOW_FONT_STACK}`;
  const maxTitleLines = Math.max(1, Math.floor((contentHeight - headerLineHeight - groupGap) / titleLineHeight));
  const titleLines = wrapCanvasText(ctx, block.title || "Untitled Channel", contentWidth, maxTitleLines);

  const groupHeight = headerLineHeight + groupGap + titleLines.length * titleLineHeight;
  let cursorY = contentY + Math.max(0, (contentHeight - groupHeight) / 2);

  // Header: are.na glyph (13x8 like the DOM variant) + label, centered as
  // a group.
  ctx.font = `${headerFontSize}px ${FLOW_FONT_STACK}`;
  const glyph = getArenaGlyphPath2D();
  const glyphWidth = 13;
  const glyphHeight = 8;
  const glyphGap = 5;
  const labelWidth = ctx.measureText(style.label).width;

  if (glyph) {
    const groupStartX = centerX - (glyphWidth + glyphGap + labelWidth) / 2;
    ctx.save();
    ctx.translate(groupStartX, cursorY + (headerFontSize - glyphHeight) / 2);
    ctx.fill(glyph);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillText(style.label, groupStartX + glyphWidth + glyphGap, cursorY);
    ctx.textAlign = "center";
  } else {
    ctx.fillText(style.label, centerX, cursorY);
  }
  cursorY += headerLineHeight + groupGap;

  ctx.font = `${titleFontSize}px ${FLOW_FONT_STACK}`;
  const titleOffset = (titleLineHeight - titleFontSize) / 2;
  titleLines.forEach((titleLine, index) => {
    ctx.fillText(titleLine, centerX, cursorY + index * titleLineHeight + titleOffset);
  });
}

function drawFlowCanvasBlock(ctx, placement, theme, shadow) {
  const { item, x, y } = placement;
  const block = item.block;
  const width = item.width;
  const height = item.height;
  const padding = CONFIG.flowBlockPadding;
  const borderWidth = CONFIG.flowBorderWidth;
  const contentX = padding + borderWidth;
  const contentY = padding + borderWidth;
  const contentWidth = width - (padding + borderWidth) * 2;
  const contentHeight = height - (padding + borderWidth) * 2;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = theme.blockBg;
  if (block.kind === "channel") {
    ctx.strokeStyle = getChannelBlockCanvasStyle(block, theme).border;
  } else {
    ctx.strokeStyle = theme.blockBorder;
  }
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.rect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
  // Same drop shadow as DOM blocks (3px 3px 5px rgba(0,0,0,0.3)); shadow
  // params are device-space, so they arrive pre-scaled per render pass.
  // Only the card fill casts it, contents draw shadow-free.
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowOffsetX = shadow.offset;
  ctx.shadowOffsetY = shadow.offset;
  ctx.shadowBlur = shadow.blur;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // Everything inside the border is clipped so content can never bleed out.
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentWidth, contentHeight);
  ctx.clip();
  ctx.textBaseline = "top";

  if (block.kind === "channel") {
    drawFlowChannelBlock(ctx, block, theme, contentX, contentY, contentWidth, contentHeight);
    ctx.restore();
    return;
  }

  const imageEntry = getFlowImage(block);
  if (imageEntry && !imageEntry.failed) {
    if (imageEntry.loaded) {
      const image = imageEntry.image;
      const scale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(image, contentX + (contentWidth - drawWidth) / 2, contentY + (contentHeight - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = theme.textColor;
      ctx.globalAlpha = 0.7;
      ctx.font = `${CONFIG.flowTextFontSize}px ${FLOW_FONT_STACK}`;
      ctx.textAlign = "center";
      ctx.fillText("Loading image...", contentX + contentWidth / 2, contentY + Math.max(0, contentHeight / 2 - CONFIG.flowTextFontSize / 2));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = theme.textColor;
  ctx.font = `${CONFIG.flowTextFontSize}px ${FLOW_FONT_STACK}`;
  ctx.textAlign = "left";
  const lineHeight = CONFIG.flowTextLineHeight;
  const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
  const lines = wrapCanvasText(ctx, getCanvasText(block), contentWidth, maxLines);
  const lineOffset = (lineHeight - CONFIG.flowTextFontSize) / 2;
  lines.forEach((textLine, index) => {
    ctx.fillText(textLine, contentX, contentY + index * lineHeight + lineOffset);
  });

  ctx.restore();
}

function findFirstVisibleFlowItem(items, localTop) {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (items[mid].y + items[mid].height < localTop) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findPastVisibleFlowItem(items, localBottom) {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (items[mid].y <= localBottom) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function getVisibleFlowPlacements() {
  if (STATE.layoutMode !== "flow" || !STATE.flow) {
    return { visibleKeys: new Set(), placements: [] };
  }

  const flow = STATE.flow;
  const { pattern } = flow;
  if (!pattern.hasItems) {
    return { visibleKeys: new Set(), placements: [] };
  }

  // Placements are computed in world units; the canvas render pass scales
  // them by the zoom factor, so the visible world region grows as the
  // user zooms out.
  const zoom = flow.zoom || 1;
  const worldWidth = window.innerWidth / zoom;
  const worldHeight = window.innerHeight / zoom;
  const buffer = CONFIG.flowRenderBuffer;
  const viewport = {
    left: -buffer,
    top: -buffer,
    right: worldWidth + buffer,
    bottom: worldHeight + buffer,
  };

  const minTileX = Math.floor((-flow.offsetX - buffer) / pattern.width) - 1;
  const maxTileX = Math.ceil((-flow.offsetX + worldWidth + buffer) / pattern.width) + 1;
  const visibleKeys = new Set();
  const placements = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    pattern.columns.forEach((column) => {
      if (!column.items.length) {
        return;
      }

      const screenX = column.x + tileX * pattern.width + flow.offsetX;
      if (screenX + pattern.blockWidth < viewport.left || screenX > viewport.right) {
        return;
      }

      const minCycleY = Math.floor((-flow.offsetY - buffer) / column.height) - 1;
      const maxCycleY = Math.ceil((-flow.offsetY + worldHeight + buffer) / column.height) + 1;

      for (let cycleY = minCycleY; cycleY <= maxCycleY; cycleY += 1) {
        const localTop = viewport.top - flow.offsetY - cycleY * column.height;
        const localBottom = viewport.bottom - flow.offsetY - cycleY * column.height;
        const startIndex = findFirstVisibleFlowItem(column.items, localTop);
        const endIndex = findPastVisibleFlowItem(column.items, localBottom);

        for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex += 1) {
          const item = column.items[itemIndex];
          const screenY = item.y + cycleY * column.height + flow.offsetY;

          if (screenY + item.height < viewport.top || screenY > viewport.bottom) {
            continue;
          }

          const key = `${tileX}:${column.index}:${cycleY}:${item.blockIndex}`;
          visibleKeys.add(key);
          placements.push({ key, item, x: screenX, y: screenY });
        }
      }
    });
  }

  return { visibleKeys, placements };
}

function renderFlowViewport() {
  if (STATE.layoutMode !== "flow" || !STATE.flow) {
    return;
  }

  if (STATE.flow.renderer === "canvas") {
    renderFlowCanvasViewport();
    return;
  }

  const { visibleKeys, placements } = getVisibleFlowPlacements();
  const flow = STATE.flow;

  flow.visible.forEach((element, key) => {
    if (!visibleKeys.has(key)) {
      releaseFlowBlockElement(key, element);
    }
  });

  placements.forEach((placement) => {
    let element = flow.visible.get(placement.key);
    if (!element) {
      element = acquireFlowBlockElement(placement.item.block, placement.key);
      flow.surface.appendChild(element);
      flow.visible.set(placement.key, element);
    } else if (element._flowBlockId !== String(placement.item.block.id)) {
      bindFlowBlockElement(element, placement.item.block, placement.key);
    }

    positionFlowBlockElement(element, placement.item, placement.x, placement.y);
  });
}

function renderFlowCanvasViewport() {
  const flow = STATE.flow;
  if (!flow?.ctx) {
    return;
  }

  resizeFlowCanvas();
  const { placements } = getVisibleFlowPlacements();
  const ctx = flow.ctx;
  const width = window.innerWidth;
  const height = Math.max(1, window.innerHeight - 35);
  const theme = getFlowCanvasTheme();
  const zoom = flow.zoom || 1;
  const dpr = window.devicePixelRatio || 1;
  // Canvas shadow params live in device space (unaffected by the transform),
  // so scale them once per pass to match the CSS 3px/5px block shadow.
  const shadow = { offset: 3 * dpr * zoom, blur: 5 * dpr * zoom };

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(zoom, zoom);
  flow.hitRegions = [];

  placements.forEach((placement) => {
    drawFlowCanvasBlock(ctx, placement, theme, shadow);
    flow.hitRegions.push({
      x: placement.x,
      y: placement.y,
      width: placement.item.width,
      height: placement.item.height,
      block: placement.item.block,
    });
  });

  ctx.restore();
}

function acquireFlowBlockElement(block, key) {
  const element =
    STATE.flow.pool.pop() ||
    createBlockElement(block, {
      appendToDocument: false,
      draggable: false,
      wheelRotation: false,
      flowInstance: true,
      instanceKey: key,
    });

  bindFlowBlockElement(element, block, key);
  element.style.display = "";
  return element;
}

function bindFlowBlockElement(element, block, key) {
  element.dataset.flowInstance = key;
  element._flowBlockId = String(block.id);
  bindBlockElement(element, block);
}

function positionFlowBlockElement(element, item, x, y) {
  element.style.width = `${item.width}px`;
  element.style.maxWidth = `${item.width}px`;
  element.style.height = `${item.height}px`;
  element.style.maxHeight = `${item.height}px`;
  element.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;
}

function releaseFlowBlockElement(key, element) {
  STATE.flow.visible.delete(key);
  element.style.display = "none";
  element.style.transform = "translate(-10000px, -10000px) rotate(0deg)";
  STATE.flow.pool.push(element);
}

function requestFlowRender() {
  if (!STATE.flow || STATE.flow.renderFrame) {
    return;
  }

  STATE.flow.renderFrame = requestAnimationFrame(() => {
    if (!STATE.flow) {
      return;
    }
    STATE.flow.renderFrame = null;
    renderFlowViewport();
  });
}

function flowOffsetStorageKey() {
  return `flowOffset:${STATE.channelSlugs[0]}`;
}

// Returns null when nothing was saved so callers can pick a smarter default.
function loadSavedFlowOffset() {
  try {
    const raw = localStorage.getItem(flowOffsetStorageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      const zoom = Number.isFinite(parsed.zoom) ? Math.min(CONFIG.flowZoomMax, Math.max(CONFIG.flowZoomMin, parsed.zoom)) : 1;
      return { x: parsed.x, y: parsed.y, zoom };
    }
  } catch (error) {
    // Ignore malformed storage entries
  }
  return null;
}

function scheduleFlowOffsetSave() {
  clearTimeout(STATE._flowOffsetSaveTimeout);
  STATE._flowOffsetSaveTimeout = setTimeout(() => {
    if (!STATE.flow) {
      return;
    }
    try {
      localStorage.setItem(
        flowOffsetStorageKey(),
        JSON.stringify({
          x: STATE.flow.offsetX,
          y: STATE.flow.offsetY,
          zoom: STATE.flow.zoom,
        }),
      );
    } catch (error) {
      // Storage may be full or unavailable; scroll position is non-critical
    }
  }, 300);
}

function moveFlowViewport(deltaX, deltaY) {
  if (!STATE.flow) {
    return;
  }

  // Pointer deltas are screen pixels; offsets live in world units.
  const zoom = STATE.flow.zoom || 1;
  STATE.flow.offsetX -= deltaX / zoom;
  STATE.flow.offsetY -= deltaY / zoom;
  scheduleFlowOffsetSave();
  requestFlowRender();
}

// Zoom around a screen point, keeping the world point under it fixed.
function setFlowZoom(newZoom, clientX, clientY) {
  const flow = STATE.flow;
  if (!flow) {
    return;
  }

  const zoom = Math.min(CONFIG.flowZoomMax, Math.max(CONFIG.flowZoomMin, newZoom));
  if (zoom === flow.zoom) {
    return;
  }

  const screenX = clientX;
  const screenY = clientY - 35;
  flow.offsetX += screenX / zoom - screenX / flow.zoom;
  flow.offsetY += screenY / zoom - screenY / flow.zoom;
  flow.zoom = zoom;
  scheduleFlowOffsetSave();
  requestFlowRender();
}

function handleFlowWheel(event) {
  if (STATE.layoutMode !== "flow") {
    return;
  }

  event.preventDefault();

  // Trackpad pinches arrive as ctrl+wheel; cmd/ctrl+scroll zooms too.
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(-event.deltaY * 0.002);
    setFlowZoom((STATE.flow?.zoom || 1) * factor, event.clientX, event.clientY);
    return;
  }

  moveFlowViewport(event.deltaX, event.deltaY);
}

function handleFlowPointerDown(event) {
  if (STATE.layoutMode !== "flow") {
    return;
  }

  const ignoredSelectors = "#header-bar, .detail-view, .modal-dialog, #app-toast";
  if (event.target.closest(ignoredSelectors)) {
    return;
  }

  const flow = STATE.flow;

  // Track touch pointers for two-finger pinch zoom.
  if (event.pointerType === "touch") {
    flow.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (flow.activePointers.size === 2) {
      const points = Array.from(flow.activePointers.values());
      flow.pinch = {
        startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        startZoom: flow.zoom,
        lastMidX: (points[0].x + points[1].x) / 2,
        lastMidY: (points[0].y + points[1].y) / 2,
      };
      flow.isDragging = false;
      flow.dragPointerId = null;
      document.body.classList.remove("flow-dragging");
      return;
    }
  }

  if (event.pointerType !== "touch" && event.button !== 0) {
    return;
  }

  flow.isDragging = true;
  flow.dragPointerId = event.pointerId;
  flow.dragMoved = 0;
  flow.lastPointerX = event.clientX;
  flow.lastPointerY = event.clientY;
  document.body.classList.add("flow-dragging");

  if (event.target.setPointerCapture) {
    event.target.setPointerCapture(event.pointerId);
  }
}

function handleFlowPointerMove(event) {
  const flow = STATE.flow;
  if (!flow) {
    return;
  }

  // Two-finger pinch: zoom around the midpoint and pan with it.
  if (flow.pinch && flow.activePointers.has(event.pointerId)) {
    flow.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (flow.activePointers.size >= 2) {
      const points = Array.from(flow.activePointers.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const midX = (points[0].x + points[1].x) / 2;
      const midY = (points[0].y + points[1].y) / 2;

      if (flow.pinch.startDistance > 0) {
        setFlowZoom(flow.pinch.startZoom * (distance / flow.pinch.startDistance), midX, midY);
      }
      moveFlowViewport(flow.pinch.lastMidX - midX, flow.pinch.lastMidY - midY);
      flow.pinch.lastMidX = midX;
      flow.pinch.lastMidY = midY;
      return;
    }
  }

  if (!flow.isDragging || flow.dragPointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - flow.lastPointerX;
  const deltaY = event.clientY - flow.lastPointerY;
  flow.lastPointerX = event.clientX;
  flow.lastPointerY = event.clientY;
  flow.dragMoved += Math.abs(deltaX) + Math.abs(deltaY);
  moveFlowViewport(-deltaX, -deltaY);
}

function endFlowPointerDrag(event) {
  const flow = STATE.flow;
  if (!flow) {
    return;
  }

  if (flow.activePointers.has(event.pointerId)) {
    flow.activePointers.delete(event.pointerId);
    if (flow.activePointers.size < 2 && flow.pinch) {
      flow.pinch = null;
      flow.lastTapTime = 0; // a pinch is never a tap
    }
  }

  if (!flow.isDragging || flow.dragPointerId !== event.pointerId) {
    return;
  }

  flow.isDragging = false;
  flow.dragPointerId = null;
  document.body.classList.remove("flow-dragging");
}

function getFlowCanvasBlockAt(clientX, clientY) {
  if (!STATE.flow?.hitRegions) {
    return null;
  }

  // Hit regions live in world units; convert the screen point.
  const zoom = STATE.flow.zoom || 1;
  const x = clientX / zoom;
  const y = (clientY - 35) / zoom;
  for (let index = STATE.flow.hitRegions.length - 1; index >= 0; index -= 1) {
    const region = STATE.flow.hitRegions[index];
    if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
      return region.block;
    }
  }

  return null;
}

function handleFlowCanvasDoubleClick(event) {
  const block = getFlowCanvasBlockAt(event.clientX, event.clientY);
  if (!block) {
    return;
  }

  const target = {
    dataset: {
      blockId: String(block.id),
    },
    style: {
      display: "",
    },
  };

  showDetailView({
    currentTarget: target,
  });
}

// Browsers don't reliably synthesize dblclick on a touch-action:none canvas,
// so detect double-taps manually for touch pointers.
function handleFlowCanvasPointerUp(event) {
  if (event.pointerType !== "touch" || !STATE.flow) {
    return;
  }

  const flow = STATE.flow;
  if (flow.dragMoved > 10) {
    flow.lastTapTime = 0;
    return;
  }

  const now = Date.now();
  const isDoubleTap = now - (flow.lastTapTime || 0) < CONFIG.doubleClickDelay && Math.hypot(event.clientX - flow.lastTapX, event.clientY - flow.lastTapY) < 30;

  if (isDoubleTap) {
    flow.lastTapTime = 0;
    handleFlowCanvasDoubleClick(event);
  } else {
    flow.lastTapTime = now;
    flow.lastTapX = event.clientX;
    flow.lastTapY = event.clientY;
  }
}

// With no saved viewport, start centered on the newest block (the last one
// in position order), consistent with mix/tile where the newest block sits
// on top of the pile.
function centerFlowOnNewestBlock(flow) {
  let newest = null;
  let newestColumn = null;

  flow.pattern.columns.forEach((column) => {
    column.items.forEach((item) => {
      if (!newest || item.blockIndex > newest.blockIndex) {
        newest = item;
        newestColumn = column;
      }
    });
  });

  if (!newest) {
    return;
  }

  const zoom = flow.zoom || 1;
  const worldWidth = window.innerWidth / zoom;
  const worldHeight = Math.max(1, window.innerHeight - 35) / zoom;
  flow.offsetX = worldWidth / 2 - (newestColumn.x + newest.width / 2);
  flow.offsetY = worldHeight / 2 - (newest.y + newest.height / 2);
}

function enterFlowMode() {
  if (!STATE.allFetchedBlocks.length) {
    return;
  }

  clearInterval(STATE.loadIntervalId);
  STATE.loadIntervalId = null;
  clearRenderedBlocks();

  document.body.classList.add("flow-mode");

  const canvas = createFlowCanvas();
  const savedOffset = loadSavedFlowOffset();

  STATE.flow = {
    renderer: "canvas",
    offsetX: savedOffset?.x ?? 0,
    offsetY: savedOffset?.y ?? 0,
    zoom: savedOffset?.zoom ?? 1,
    pattern: buildFlowPattern(),
    surface: null,
    canvas,
    ctx: canvas.getContext("2d", { alpha: true }),
    visible: new Map(),
    pool: [],
    imageCache: new Map(),
    textCache: new Map(),
    hitRegions: [],
    isDragging: false,
    dragPointerId: null,
    dragMoved: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    activePointers: new Map(),
    pinch: null,
    measurementFrame: null,
    renderFrame: null,
  };

  if (!savedOffset) {
    centerFlowOnNewestBlock(STATE.flow);
  }

  resizeFlowCanvas();
  canvas.addEventListener("wheel", handleFlowWheel, { passive: false });
  canvas.addEventListener("dblclick", handleFlowCanvasDoubleClick);
  canvas.addEventListener("pointerup", handleFlowCanvasPointerUp);
  document.addEventListener("pointerdown", handleFlowPointerDown);
  document.addEventListener("pointermove", handleFlowPointerMove);
  document.addEventListener("pointerup", endFlowPointerDrag);
  document.addEventListener("pointercancel", endFlowPointerDrag);

  renderFlowViewport();
}

function exitFlowMode(renderBlocksAfter = true) {
  if (!STATE.flow) {
    document.body.classList.remove("flow-mode", "flow-dragging");
    removeFlowSurface();
    return;
  }

  if (STATE.flow.renderFrame) {
    cancelAnimationFrame(STATE.flow.renderFrame);
  }
  if (STATE.flow.measurementFrame) {
    cancelAnimationFrame(STATE.flow.measurementFrame);
  }

  if (STATE.flow.surface) {
    STATE.flow.surface.removeEventListener("wheel", handleFlowWheel);
  }
  if (STATE.flow.canvas) {
    STATE.flow.canvas.removeEventListener("wheel", handleFlowWheel);
    STATE.flow.canvas.removeEventListener("dblclick", handleFlowCanvasDoubleClick);
    STATE.flow.canvas.removeEventListener("pointerup", handleFlowCanvasPointerUp);
  }
  document.removeEventListener("pointerdown", handleFlowPointerDown);
  document.removeEventListener("pointermove", handleFlowPointerMove);
  document.removeEventListener("pointerup", endFlowPointerDrag);
  document.removeEventListener("pointercancel", endFlowPointerDrag);
  clearFlowInstances();
  removeFlowSurface();
  removeFlowCanvas();
  STATE.flow = null;
  document.body.classList.remove("flow-mode", "flow-dragging");

  if (renderBlocksAfter) {
    renderInitialBlocksForCurrentChannel();
  }
}

function renderInitialBlocksForCurrentChannel() {
  clearRenderedBlocks();
  STATE.visibleBlockIds = new Set();

  const maxBlocks = isMobileDevice()
    ? Math.min(CONFIG.blocksPerLoad, STATE.cachedBlockOrder.length || STATE.allFetchedBlocks.length)
    : Math.min(CONFIG.maxBlocks || STATE.allFetchedBlocks.length, STATE.cachedBlockOrder.length || STATE.allFetchedBlocks.length);

  const orderedIds = STATE.cachedBlockOrder.length > 0 ? STATE.cachedBlockOrder : STATE.allFetchedBlocks.map((block) => String(block.id));

  const blocksToRender = orderedIds.slice(0, maxBlocks);
  renderBlockBatch(blocksToRender);
  STATE.currentlyDisplayedBlocks = blocksToRender.length;

  if (isMobileDevice() && STATE.currentlyDisplayedBlocks < STATE.allFetchedBlocks.length) {
    STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
  }
}

// Reset the transient layout state when switching channels. The persisted
// mode is re-applied by applySavedLayoutMode() once the new channel renders,
// so skip re-rendering the old channel's blocks here.
function resetTileButton() {
  if (STATE.layoutMode === "flow") {
    exitFlowMode(false);
  }
  STATE.layoutMode = "mix";
  setLayoutButtonText(getSavedLayoutMode());
}

// Add new function to show current channel detail
async function showCurrentChannelDetail() {
  const slug = STATE.channelSlugs[0];
  if (!slug) return;

  if (slug.startsWith("@")) {
    await showUserDetail(slug.slice(1));
    return;
  }

  if (slug.startsWith("!")) {
    // Special views (feed) have no channel behind them.
    showToast({
      message: "This is your feed, no channel info here",
      seconds: 3,
    });
    return;
  }

  closeAllDetailViews();

  await showChannelDetailBySlug(slug, {
    primaryActionLabel: "View Channel on Are.na",
    primaryAction: () => {
      window.open(`https://www.are.na/channel/${slug}`, "_blank");
    },
    arenaUrl: `https://www.are.na/channel/${slug}`,
  });
}

// More button functionality
const moreButton = document.getElementById("more-button");
const moreMenu = document.getElementById("more-menu");
const moreTileButton = document.getElementById("more-tile-button");
const moreThemeButton = document.getElementById("more-theme-button");

// Toggle more menu only when clicking the more button
moreButton.addEventListener("click", (e) => {
  e.stopPropagation();
  moreMenu.classList.toggle("show");
});

// Link more menu buttons to original buttons' functionality
moreTileButton.addEventListener("click", () => {
  document.getElementById("tile-button").click();
  moreTileButton.textContent = document.getElementById("tile-button").textContent;
});

moreThemeButton.addEventListener("click", () => {
  document.getElementById("theme-toggle").click();
  moreThemeButton.textContent = document.getElementById("theme-toggle").textContent;
});

const savedTheme = localStorage.getItem("theme") || "system";
moreThemeButton.textContent = savedTheme;

// Function to update theme colors for browsers and PWAs status bars and title bars
function updatePWAThemeColors(theme) {
  const root = document.documentElement;
  let themeColorValue;

  // Get the current effective theme
  if (theme === "system") {
    // Check if system is in dark mode
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    themeColorValue = isDarkMode ? "#1A1A1A" : "#f0f0f0";
  } else if (theme === "dark") {
    themeColorValue = "#1A1A1A"; // Dark theme header color
  } else {
    themeColorValue = "#f0f0f0"; // Light theme header color
  }

  // Update the theme-color meta tag (works for Chrome, Firefox, and other browsers)
  const themeColorMeta = document.getElementById("theme-color-meta");
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColorValue);
  }

  // Update the iOS status bar style (for both Safari mobile browser and PWA mode)
  const iosStatusBarMeta = document.getElementById("ios-status-bar-meta");
  if (iosStatusBarMeta) {
    // For dark theme use black-translucent, for light use default
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      iosStatusBarMeta.setAttribute("content", "black-translucent");
    } else {
      iosStatusBarMeta.setAttribute("content", "default");
    }
  }

  // Force a refresh for Safari on iOS in some cases
  // This helps ensure the color changes apply immediately in regular browser mode
  if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
    // Create a small style update to force a repaint
    const dummyStyle = document.createElement("style");
    dummyStyle.textContent = "/* */";
    document.head.appendChild(dummyStyle);
    setTimeout(() => {
      document.head.removeChild(dummyStyle);
    }, 10);
  }
}

// Initialize theme colors when page loads
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "system";
  updatePWAThemeColors(savedTheme);

  // Also listen for system color scheme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme === "system") {
      updatePWAThemeColors("system");
      if (STATE.layoutMode === "flow") {
        requestFlowRender();
      }
    }
  });
});
