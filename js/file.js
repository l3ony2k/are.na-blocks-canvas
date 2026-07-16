const FILE_BLOCK_TYPES = ["image", "text", "link", "attachment", "embed", "channel"];
const FILE_SORTS = ["default", "title", "type", "added", "updated"];
const FILE_SIZES = ["small", "medium", "large"];

function migrateFileSettings() {
  const migrations = {
    fileView: "ogView",
    fileSort: "ogSort",
    fileSortDirection: "ogSortDirection",
  };
  Object.entries(migrations).forEach(([fileKey, ogKey]) => {
    if (localStorage.getItem(fileKey) === null && localStorage.getItem(ogKey) !== null) {
      localStorage.setItem(fileKey, localStorage.getItem(ogKey));
    }
  });

  const sharedSize = localStorage.getItem("fileSize") || localStorage.getItem("ogGridSize");
  if (sharedSize && FILE_SIZES.includes(sharedSize)) {
    if (localStorage.getItem("fileGridSize") === null) localStorage.setItem("fileGridSize", sharedSize);
    if (localStorage.getItem("fileListSize") === null) localStorage.setItem("fileListSize", sharedSize);
  }
}

function getSavedFileSettings() {
  migrateFileSettings();
  const view = localStorage.getItem("fileView");
  const sort = localStorage.getItem("fileSort");
  const direction = localStorage.getItem("fileSortDirection");
  const gridSize = localStorage.getItem("fileGridSize");
  const listSize = localStorage.getItem("fileListSize");
  const query = localStorage.getItem("fileQuery") || "";
  let types = [];
  try {
    const storedTypes = JSON.parse(localStorage.getItem("fileTypes") || "[]");
    if (Array.isArray(storedTypes)) {
      types = storedTypes.filter((type) => FILE_BLOCK_TYPES.includes(type));
    }
  } catch (error) {
    console.warn("Failed to restore file filters:", error);
  }
  return {
    view: view === "list" ? "list" : "grid",
    sort: FILE_SORTS.includes(sort) ? sort : "default",
    direction: direction === "desc" ? "desc" : "asc",
    gridSize: FILE_SIZES.includes(gridSize) ? gridSize : "medium",
    listSize: FILE_SIZES.includes(listSize) ? listSize : "medium",
    query,
    types: new Set(types),
  };
}

function saveFileSetting(key, value) {
  localStorage.setItem(key, value);
}

function saveFileTypes() {
  saveFileSetting("fileTypes", JSON.stringify(Array.from(STATE.file.types)));
}

function getFileTitle(block) {
  return block.title || block.textPlain?.trim() || block.source?.title || `Untitled ${block.kind || "block"}`;
}

function getFileListTitle(block) {
  const title = getFileTitle(block).replace(/\s+/g, " ").trim();
  return title.length > 180 ? `${title.slice(0, 179)}…` : title;
}

function getActiveFileSize() {
  return STATE.file.view === "grid" ? STATE.file.gridSize : STATE.file.listSize;
}

function getFileAuthor(block) {
  return block.connection?.connectedBy?.name || block.owner?.name || "—";
}

function getFileAddedDate(block) {
  return block.connection?.connectedAt || block.createdAt || null;
}

function formatFileDate(value, dateOnly = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (number) => String(number).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return dateOnly ? day : `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getFileThumbnailVersion(block) {
  const versions = block.coverImageVersions || block.imageVersions;
  return versions?.square || versions?.thumb || versions?.preview || versions?.display || versions?.large || versions?.original || null;
}

function createFileListThumbnail(block) {
  const thumbnail = document.createElement("div");
  thumbnail.className = "file-list-thumbnail";
  const version = getFileThumbnailVersion(block);
  if (version?.url) {
    const image = document.createElement("img");
    image.src = version.url;
    image.alt = block.imageVersions?.altText || getFileTitle(block);
    image.loading = "lazy";
    image.decoding = "async";
    thumbnail.appendChild(image);
  } else {
    const label = document.createElement("span");
    label.textContent = { text: "TXT", link: "URL", attachment: "FILE", embed: "EMB", channel: "CH" }[block.kind] || "—";
    if (block.kind === "channel") {
      const visibilityClass = getVisibilityClass(block.visibility);
      if (visibilityClass) label.classList.add(visibilityClass);
    }
    thumbnail.appendChild(label);
  }
  return thumbnail;
}

function createFileGridPreview(block) {
  const preview = document.createElement("div");
  bindBlockElement(preview, block);
  preview.classList.add("file-grid-preview");
  preview.removeAttribute("tabindex");
  return preview;
}

function bindFileItem(element, block) {
  element.dataset.blockId = block.id;
  element.dataset.blockKind = block.kind;
  element.tabIndex = 0;
  element.addEventListener("click", () => {
    document.querySelectorAll("#file-browser .selected").forEach((item) => item.classList.remove("selected"));
    element.classList.add("selected");
  });
  element.addEventListener("dblclick", (event) => {
    event.preventDefault();
    showDetailView({ currentTarget: element });
  });
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      showDetailView({ currentTarget: element });
    }
  });
  element.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - (element._fileLastTouchEnd || 0) < CONFIG.doubleClickDelay) {
      event.preventDefault();
      element._fileLastTouchEnd = 0;
      showDetailView({ currentTarget: element });
    } else {
      element._fileLastTouchEnd = now;
    }
  });
}

function closeFileFilterMenu() {
  const menu = document.querySelector("#file-browser .file-filter-menu");
  const button = document.querySelector("#file-browser .file-filter-button");
  menu?.classList.remove("show");
  button?.setAttribute("aria-expanded", "false");
}

function getFilteredSortedFileBlocks() {
  const state = STATE.file;
  const query = state.query.trim().toLowerCase();
  const apiOrder = new Map(STATE.allFetchedBlocks.map((block, index) => [String(block.id), index]));
  const blocks = STATE.allFetchedBlocks.filter((block) => {
    if (state.types.size > 0 && !state.types.has(block.kind)) return false;
    if (!query) return true;
    return [getFileTitle(block), block.textPlain, block.descriptionPlain, block.source?.provider, block.owner?.name, getFileAuthor(block)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  if (state.sort === "default") {
    return blocks.sort((left, right) => apiOrder.get(String(right.id)) - apiOrder.get(String(left.id)));
  }

  const direction = state.direction === "desc" ? -1 : 1;
  const valueFor = (block) => {
    if (state.sort === "title") return getFileTitle(block).toLowerCase();
    if (state.sort === "type") return block.kind || "";
    if (state.sort === "added") return getFileAddedDate(block) || "";
    return block.updatedAt || "";
  };
  return blocks.sort((left, right) => {
    const result = String(valueFor(left)).localeCompare(String(valueFor(right)), undefined, { numeric: true, sensitivity: "base" });
    return result === 0
      ? apiOrder.get(String(right.id)) - apiOrder.get(String(left.id))
      : result * direction;
  });
}

function createFileButton(label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function createFileButtonGroup(className) {
  const group = document.createElement("div");
  group.className = `file-button-group ${className}`;
  return group;
}

function buildFileToolbar() {
  const toolbar = document.createElement("div");
  toolbar.className = "file-toolbar";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "file-search";
  search.placeholder = "filter blocks";
  search.setAttribute("aria-label", "Filter blocks by text");
  search.value = STATE.file.query;
  search.addEventListener("input", () => {
    STATE.file.query = search.value;
    saveFileSetting("fileQuery", STATE.file.query);
    renderFileContents();
  });
  toolbar.appendChild(search);

  const filterWrap = document.createElement("div");
  filterWrap.className = "file-filter-wrap";
  const filterLabel = () => STATE.file.types.size ? `${STATE.file.types.size} types` : "all";
  const filterButton = createFileButton(filterLabel(), "Filter by block type", () => {
    const open = !filterMenu.classList.contains("show");
    if (open) {
      const rect = filterButton.getBoundingClientRect();
      filterMenu.style.top = `${rect.bottom + 4}px`;
      filterMenu.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
    }
    filterMenu.classList.toggle("show", open);
    filterButton.setAttribute("aria-expanded", String(open));
  });
  filterButton.className = "file-filter-button";
  filterButton.setAttribute("aria-haspopup", "true");
  filterButton.setAttribute("aria-expanded", "false");
  const filterMenu = document.createElement("div");
  filterMenu.className = "file-filter-menu";
  FILE_BLOCK_TYPES.forEach((type) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = type;
    checkbox.checked = STATE.file.types.has(type);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) STATE.file.types.add(type);
      else STATE.file.types.delete(type);
      filterButton.textContent = filterLabel();
      saveFileTypes();
      renderFileContents();
    });
    label.append(checkbox, document.createTextNode(type));
    filterMenu.appendChild(label);
  });
  filterWrap.appendChild(filterButton);
  toolbar.appendChild(filterWrap);
  STATE.file.filterMenu = filterMenu;

  const sortGroup = createFileButtonGroup("file-sort-group");
  const sortSelect = document.createElement("select");
  sortSelect.className = "file-sort-select";
  sortSelect.setAttribute("aria-label", "Sort blocks");
  FILE_SORTS.forEach((sort) => {
    const option = document.createElement("option");
    option.value = sort;
    option.textContent = sort;
    sortSelect.appendChild(option);
  });
  sortSelect.value = STATE.file.sort;
  sortSelect.addEventListener("change", () => setFileSort(sortSelect.value));
  const directionButton = createFileButton(STATE.file.direction === "asc" ? "↑" : "↓", "Reverse sort direction", () => {
    STATE.file.direction = STATE.file.direction === "asc" ? "desc" : "asc";
    saveFileSetting("fileSortDirection", STATE.file.direction);
    rebuildFileBrowser();
  });
  directionButton.className = "file-direction-button";
  directionButton.disabled = STATE.file.sort === "default";
  sortGroup.append(sortSelect, directionButton);
  toolbar.appendChild(sortGroup);

  const spacer = document.createElement("div");
  spacer.className = "file-toolbar-spacer";
  toolbar.appendChild(spacer);

  const sizeGroup = createFileButtonGroup("file-size-group");
  FILE_SIZES.forEach((size, index) => {
    const button = createFileButton(["S", "M", "L"][index], `${size} previews`, () => setFileSize(size));
    button.classList.toggle("active", getActiveFileSize() === size);
    sizeGroup.appendChild(button);
  });
  toolbar.appendChild(sizeGroup);

  const viewGroup = createFileButtonGroup("file-view-group");
  ["grid", "list"].forEach((view) => {
    const button = createFileButton(view, `${view} view`, () => setFileView(view));
    button.classList.toggle("active", STATE.file.view === view);
    viewGroup.appendChild(button);
  });
  toolbar.appendChild(viewGroup);
  return toolbar;
}

function setFileView(view) {
  if (!STATE.file || !["grid", "list"].includes(view) || STATE.file.view === view) return;
  STATE.file.view = view;
  saveFileSetting("fileView", view);
  rebuildFileBrowser();
}

function setFileSize(size) {
  if (!STATE.file || !FILE_SIZES.includes(size) || getActiveFileSize() === size) return;
  const setting = STATE.file.view === "grid" ? "gridSize" : "listSize";
  const storageKey = STATE.file.view === "grid" ? "fileGridSize" : "fileListSize";
  STATE.file[setting] = size;
  saveFileSetting(storageKey, size);
  rebuildFileBrowser();
}

function setFileSort(sort) {
  if (!STATE.file || !FILE_SORTS.includes(sort)) return;
  if (STATE.file.sort === sort && sort !== "default") {
    STATE.file.direction = STATE.file.direction === "asc" ? "desc" : "asc";
  } else {
    STATE.file.sort = sort;
  }
  saveFileSetting("fileSort", STATE.file.sort);
  saveFileSetting("fileSortDirection", STATE.file.direction);
  rebuildFileBrowser();
}

function createFileGridCard(block) {
  const card = document.createElement("article");
  card.className = `file-card file-card-${STATE.file.gridSize}`;
  if (block.kind === "channel") {
    card.classList.add("file-channel-card", `channel-vis-${block.visibility || "closed"}`);
  }
  bindFileItem(card, block);
  const previewWrap = document.createElement("div");
  previewWrap.className = "file-grid-preview-wrap";
  previewWrap.appendChild(createFileGridPreview(block));
  card.appendChild(previewWrap);

  const text = document.createElement("div");
  text.className = "file-card-text";
  const title = document.createElement("div");
  title.className = "file-item-title";
  title.textContent = getFileTitle(block);
  title.title = getFileTitle(block);
  const basicMeta = document.createElement("div");
  basicMeta.className = "file-item-meta file-basic-meta";
  basicMeta.textContent = `${block.kind || "unknown"} · ${getFileAuthor(block)}`;

  const details = [];
  if (Number.isFinite(block.counts?.channels)) details.push(`${block.counts.channels} channels`);
  const comments = block.commentCount ?? block.counts?.comments;
  if (Number.isFinite(comments)) details.push(`${comments} comments`);
  if (details.length) {
    const stats = document.createElement("span");
    stats.className = "file-grid-stats";
    stats.textContent = ` · ${details.join(" · ")}`;
    basicMeta.appendChild(stats);
  }
  text.append(title, basicMeta);
  const dates = document.createElement("div");
  dates.className = "file-item-meta file-grid-details";
  dates.textContent = `A ${formatFileDate(getFileAddedDate(block), true)} · U ${formatFileDate(block.updatedAt, true)}`;
  text.appendChild(dates);
  card.appendChild(text);
  return card;
}

function createFileListCell(text, className = "", title = text) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  cell.title = title;
  return cell;
}

function createFileListRow(block) {
  const row = document.createElement("tr");
  row.className = "file-row";
  bindFileItem(row, block);
  const thumbnailCell = document.createElement("td");
  thumbnailCell.className = "file-thumbnail-cell";
  thumbnailCell.appendChild(createFileListThumbnail(block));
  const titleCell = createFileListCell(getFileListTitle(block), "file-list-title", getFileTitle(block));
  if (block.kind === "channel") {
    const visibilityClass = getVisibilityClass(block.visibility);
    if (visibilityClass) titleCell.classList.add(visibilityClass);
  }
  row.append(
    thumbnailCell,
    titleCell,
    createFileListCell(block.kind || "unknown"),
    createFileListCell(formatFileDate(getFileAddedDate(block))),
    createFileListCell(formatFileDate(block.updatedAt)),
    createFileListCell(getFileAuthor(block)),
    createFileListCell(String(block.commentCount ?? block.counts?.comments ?? "—")),
  );
  return row;
}

function createFileTableHeader() {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  const columns = [
    ["", null, "file-thumbnail-cell"],
    ["title", "title", "file-title-header"],
    ["type", "type", ""],
    ["added", "added", ""],
    ["updated", "updated", ""],
    ["added by", null, ""],
    ["comments", null, ""],
  ];
  columns.forEach(([label, sort, className]) => {
    const cell = document.createElement("th");
    cell.className = className;
    if (sort) {
      const button = createFileButton(label, `Sort by ${label}`, () => setFileSort(sort));
      if (STATE.file.sort === sort) {
        button.classList.add("active");
        button.textContent = `${label} ${STATE.file.direction === "asc" ? "↑" : "↓"}`;
      }
      cell.appendChild(button);
    } else {
      cell.textContent = label;
      if (label) cell.classList.add("file-static-header");
    }
    row.appendChild(cell);
  });
  head.appendChild(row);
  return head;
}

function clearFileContents(contents) {
  contents?.querySelectorAll(".file-grid-preview").forEach((preview) => {
    preview._imageObserver?.disconnect();
  });
  contents?.replaceChildren();
}

function renderFileContents() {
  if (!STATE.file) return;
  const contents = document.querySelector("#file-browser .file-contents");
  if (!contents) return;
  const blocks = getFilteredSortedFileBlocks();
  clearFileContents(contents);

  if (blocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "file-empty";
    empty.textContent = "no matching blocks";
    contents.appendChild(empty);
    return;
  }

  if (STATE.file.view === "grid") {
    const grid = document.createElement("div");
    grid.className = `file-grid file-grid-${STATE.file.gridSize}`;
    blocks.forEach((block) => grid.appendChild(createFileGridCard(block)));
    contents.appendChild(grid);
  } else {
    const frame = document.createElement("div");
    frame.className = "file-list-frame";
    const scroller = document.createElement("div");
    scroller.className = "file-list-scroller";
    const table = document.createElement("table");
    table.className = `file-table file-table-${STATE.file.listSize}`;
    const columns = document.createElement("colgroup");
    ["thumbnail", "title", "type", "added", "updated", "author", "comments"].forEach((name) => {
      const column = document.createElement("col");
      column.className = `file-column-${name}`;
      columns.appendChild(column);
    });
    table.appendChild(columns);
    table.appendChild(createFileTableHeader());
    const body = document.createElement("tbody");
    blocks.forEach((block) => body.appendChild(createFileListRow(block)));
    table.appendChild(body);
    scroller.appendChild(table);
    frame.appendChild(scroller);
    contents.appendChild(frame);
  }
}

function updateFileTop() {
  const browser = document.getElementById("file-browser");
  const header = document.getElementById("header-bar");
  if (browser && header) browser.style.top = `${header.getBoundingClientRect().bottom}px`;
}

function rebuildFileBrowser() {
  const browser = document.getElementById("file-browser");
  if (!browser || !STATE.file) return;
  clearFileContents(browser.querySelector(".file-contents"));
  browser.replaceChildren(buildFileToolbar());
  if (STATE.file.filterMenu) {
    browser.appendChild(STATE.file.filterMenu);
  }
  const contents = document.createElement("div");
  contents.className = "file-contents";
  browser.appendChild(contents);
  browser.onclick = (event) => {
    if (!event.target.closest(".file-filter-wrap, .file-filter-menu")) closeFileFilterMenu();
  };
  renderFileContents();
}

function enterFileMode() {
  if (!STATE.allFetchedBlocks.length) return;
  clearInterval(STATE.loadIntervalId);
  STATE.loadIntervalId = null;
  clearRenderedBlocks();
  STATE.file = getSavedFileSettings();
  document.body.classList.add("file-mode");
  const browser = document.createElement("main");
  browser.id = "file-browser";
  document.body.appendChild(browser);
  STATE._fileResizeHandler = updateFileTop;
  window.addEventListener("resize", STATE._fileResizeHandler);
  updateFileTop();
  rebuildFileBrowser();
}

function exitFileMode(renderBlocksAfter = true) {
  const browser = document.getElementById("file-browser");
  clearFileContents(browser?.querySelector(".file-contents"));
  browser?.remove();
  if (STATE._fileResizeHandler) {
    window.removeEventListener("resize", STATE._fileResizeHandler);
    STATE._fileResizeHandler = null;
  }
  STATE.file = null;
  document.body.classList.remove("file-mode");
  if (renderBlocksAfter) renderInitialBlocksForCurrentChannel();
}
