// UI Utility Functions
function outputLog(message) {
  console.log(message);
  const logOutputElement = document.getElementById('log-output');
  if (logOutputElement && logOutputElement.style.display !== 'none') {
    logOutputElement.innerHTML += message + '<br>';
  }
}

function throttle(func, delay) {
  let timeoutId, lastExecTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastExecTime >= delay) {
      func.apply(this, args);
      lastExecTime = now;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (now - lastExecTime));
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
  const themeToggle = document.getElementById('theme-toggle');
  const moreThemeButton = document.getElementById('more-theme-button');
  themeToggle.textContent = theme === 'system' ? 'sys' : theme.toLowerCase();
  if (moreThemeButton) {
    moreThemeButton.textContent = theme === 'system' ? 'sys' : theme.toLowerCase();
  }
}

function closeDetailView() {
  document.getElementById('detail-view').style.display = 'none';
  
  // Show the previously hidden block
  if (STATE.lastViewedBlockElement) {
    STATE.lastViewedBlockElement.style.display = '';
    STATE.lastViewedBlockElement = null;
  }
}

function addMetaItem(label, value, linkHref, isHTML=false) {
  const metaContainer = document.getElementById('detail-view-meta');
  if (!value) return;
  let item = document.createElement('div');
  item.className = 'meta-item';
  item.innerHTML = `<strong>${label}:</strong> `;
  if (isHTML) {
    let contentDiv = document.createElement('div');
    contentDiv.innerHTML = value;
    item.appendChild(contentDiv);
  } else {
    if (linkHref) {
      let a = document.createElement('a');
      a.href = linkHref;
      a.target = '_blank';
      a.textContent = value;
      item.appendChild(a);
    } else {
      item.appendChild(document.createTextNode(value));
    }
  }
  metaContainer.appendChild(item);
}

function resetDetailPanels() {
  document.getElementById('detail-view-content').innerHTML = '';
  document.getElementById('detail-view-link').innerHTML = '';
  document.getElementById('detail-view-info').innerHTML = '';
  document.getElementById('detail-view-meta').innerHTML = '';
}

function getChannelVisibilityLabel(visibility) {
  return {
    public: 'Public',
    closed: 'Closed',
    private: 'Private'
  }[visibility] || 'Unknown';
}

function renderChannelDetailContent(channelData, followerCount, options = {}) {
  const detailContent = document.getElementById('detail-view-content');
  const detailTitle = document.getElementById('detail-view-title');
  const arenaLink = document.getElementById('detail-view-arena-link');

  resetDetailPanels();
  detailContent.innerHTML = '';
  detailTitle.textContent = options.title || channelData.title || 'Channel';
  arenaLink.href = options.arenaUrl || channelData.arenaUrl || `https://www.are.na/channel/${channelData.slug}`;

  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'channel-detail-container';

  const basicInfo = document.createElement('div');
  basicInfo.id = 'channel-basic-info';

  const textInfo = document.createElement('div');
  textInfo.id = 'channel-text-info';

  if (channelData.descriptionHtml) {
    const description = document.createElement('div');
    description.id = 'channel-description';
    description.innerHTML = channelData.descriptionHtml;
    textInfo.appendChild(description);
  }

  if (channelData.owner) {
    const authorInfo = document.createElement('div');
    authorInfo.textContent = 'Channel Author: ';
    const authorName = document.createElement('a');
    authorName.href = channelData.owner.slug ? `https://are.na/${channelData.owner.slug}` : '#';
    authorName.target = '_blank';
    authorName.textContent = channelData.owner.name || 'Unknown';
    authorInfo.appendChild(authorName);
    textInfo.appendChild(authorInfo);
  }

  const stats = document.createElement('div');
  stats.id = 'channel-stats';
  stats.innerHTML = `
    <div>Blocks: ${channelData.counts?.contents || 0}</div>
    <div>Followers: ${followerCount || 0}</div>
  `;
  textInfo.appendChild(stats);

  if (channelData.createdAt) {
    const dates = document.createElement('div');
    dates.id = 'channel-dates';
    const created = new Date(channelData.createdAt).toLocaleDateString();
    const updated = channelData.updatedAt ? new Date(channelData.updatedAt).toLocaleDateString() : created;
    dates.innerHTML = `
      <div>Created: ${created}</div>
      <div>Updated: ${updated}</div>
    `;
    textInfo.appendChild(dates);
  }

  const status = document.createElement('div');
  status.id = 'channel-status';
  status.innerHTML = `
    <div>Visibility: ${getChannelVisibilityLabel(channelData.visibility)}</div>
    <div>State: ${channelData.state || 'unknown'}</div>
  `;
  textInfo.appendChild(status);

  if (options.primaryActionLabel && typeof options.primaryAction === 'function') {
    const actionButton = document.createElement('button');
    actionButton.id = 'channel-goto-button';
    actionButton.textContent = options.primaryActionLabel;
    actionButton.addEventListener('click', options.primaryAction);
    textInfo.appendChild(actionButton);
  }

  const coverVersion = channelData.coverImageVersions?.display || channelData.coverImageVersions?.large;
  if (coverVersion?.url) {
    const coverWrapper = document.createElement('div');
    coverWrapper.id = 'channel-cover-wrapper';

    const cover = document.createElement('img');
    cover.id = 'channel-cover-image';
    cover.src = coverVersion.url;
    cover.alt = `${channelData.title} channel cover`;

    coverWrapper.appendChild(cover);
    basicInfo.appendChild(coverWrapper);
  }

  basicInfo.insertBefore(textInfo, basicInfo.firstChild);
  contentWrapper.appendChild(basicInfo);
  detailContent.appendChild(contentWrapper);

  if (options.contextItem?.descriptionHtml) {
    addMetaItem('Description', options.contextItem.descriptionHtml, null, true);
  }

  if (options.contextItem?.connection?.connectedAt) {
    addMetaItem('Connected At', new Date(options.contextItem.connection.connectedAt).toLocaleString(), null);
  }

  if (options.contextItem?.connection?.connectedBy?.name) {
    const connectedByUrl = options.contextItem.connection.connectedBy.slug
      ? `https://www.are.na/${options.contextItem.connection.connectedBy.slug}`
      : null;
    addMetaItem('Connected By', options.contextItem.connection.connectedBy.name, connectedByUrl, false);
  }
}

async function showChannelDetailBySlug(slug, options = {}) {
  if (!slug) {
    return;
  }

  const detailContent = document.getElementById('detail-view-content');
  resetDetailPanels();
  detailContent.innerHTML = '<div style="padding: 20px;">Loading channel details...</div>';
  document.getElementById('detail-view').style.display = 'flex';

  try {
    const [channelResult, followerResult] = await Promise.allSettled([
      arenaAPI.getChannel(slug),
      arenaAPI.getChannelFollowerCount(slug)
    ]);

    if (channelResult.status !== 'fulfilled') {
      throw channelResult.reason;
    }

    const followerCount = followerResult.status === 'fulfilled' ? followerResult.value : 0;
    renderChannelDetailContent(channelResult.value, followerCount, options);
  } catch (error) {
    console.error('Error fetching channel details:', error);
    detailContent.innerHTML = '<div style="padding: 20px;">Failed to load channel details</div>';
  }
}

function showAboutView() {
  // 先关闭当前的 detailview
  if (document.getElementById('detail-view').style.display === 'flex') {
    closeDetailView();
  }

  const detailView = document.getElementById('detail-view');
  const detailTitle = document.getElementById('detail-view-title');
  const detailContent = document.getElementById('detail-view-content');
  const detailMeta = document.getElementById('detail-view-meta');
  const arenaLink = document.getElementById('detail-view-arena-link');

  detailTitle.textContent = 'About Are.na Blocks Canvas';
  
  detailContent.innerHTML = `
    <div style="line-height: 1.6;">
      <p><i>Are.na Blocks Canvas</i> is a tool for visually browsing Are.na channel content. It provides a unique, interactive interface to explore Are.na content.</p>
      <h2>What is Are.na?</h3>
      <p>Are.na is an interest-based social network where users can create and join various channels to share and discover content.</p>
      <p>Visit <a href="https://are.na" target="_blank">are.na</a> to create an account.</p>
      <h2>Key Features</h3>
      <p>Built With 0 productivity in mind: Are.na feels like a park to me, where you can wander around without much purpose but discover interesting content. Therefore, this project is also meant for casual exploration, with no productivity pressure.</p>
      <h2>How to</h3>
      <ul>
        <li>Enter a channel slug and click Go to start browsing</li>
        <li>Drag content blocks to adjust their position</li>
        <li>Use the scroll wheel to rotate content blocks</li>
        <li>Double click to view content details</li>
        <li>Click channel blocks to jump directly to the corresponding channel</li>
        <li>Feel the need to actually connect something? Click the Are.na logo anywhere to view on are.na</li>
      </ul>
      <hr>
      <p>This project is <a href="https://github.com/l3ony2k/are.na-blocks-canvas" target="_blank">open source</a>. Contributions and feedback are welcome.</p>
    </div>
  `;

  detailMeta.innerHTML = `
    <div class="meta-item">
      <strong>Version:</strong> ${CONFIG.version}
    </div>
    <div class="meta-item">
      <strong>Created by</strong> <a href="https://www.are.na/lok" target="_blank">Lok ✶✶</a> with love
    </div>
  `;

  arenaLink.href = 'https://www.are.na/lok';
  detailView.style.display = 'flex';
}

function initHeaderBar() {
  const slugInput = document.getElementById('channel-slug-input');
  slugInput.value = STATE.channelSlugs[0];
  document.getElementById('goto-button').addEventListener('click', handleGoButtonClick);
  slugInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleGoButtonClick();
    }
  });
  const logoLink = document.getElementById('header-bar-logo-link');
  logoLink.href = '#';  // 移除直接跳转
  logoLink.addEventListener('click', async (e) => {
    e.preventDefault();
    showCurrentChannelDetail();
  });

  // Initialize layout mode button
  const tileButton = document.getElementById('tile-button');
  tileButton.addEventListener('click', () => {
    cycleLayoutMode();
  });

  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  const savedTheme = localStorage.getItem('theme') || 'system';
  root.setAttribute('data-theme', savedTheme);
  updateThemeToggleText(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = root.getAttribute('data-theme');
    let newTheme;
    
    switch(currentTheme) {
      case 'system':
        newTheme = 'light';
        break;
      case 'light':
        newTheme = 'dark';
        break;
      default:
        newTheme = 'system';
    }
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggleText(newTheme);
    updatePWAThemeColors(newTheme);
  });

  document.getElementById('about-button').addEventListener('click', showAboutView);
}

function handleGoButtonClick() {
  const newSlug = document.getElementById('channel-slug-input').value.trim();
  if (newSlug) {
    router.navigate(newSlug, true, true);
  }
}

function setLayoutButtonText(text) {
  const tileButton = document.getElementById('tile-button');
  const moreTileButton = document.getElementById('more-tile-button');

  if (tileButton) {
    tileButton.textContent = text;
  }
  if (moreTileButton) {
    moreTileButton.textContent = text;
  }
}

function cycleLayoutMode() {
  if (STATE.layoutMode === 'mix') {
    setLayoutMode('tile');
  } else if (STATE.layoutMode === 'tile') {
    setLayoutMode('flow');
  } else {
    setLayoutMode('mix');
  }
}

function setLayoutMode(mode) {
  if (mode === STATE.layoutMode) {
    return;
  }

  if (STATE.layoutMode === 'flow') {
    exitFlowMode();
  }

  if (mode === 'tile') {
    STATE.layoutMode = 'tile';
    tileBlocks();
    setLayoutButtonText('flow');
    return;
  }

  if (mode === 'flow') {
    STATE.layoutMode = 'flow';
    enterFlowMode();
    setLayoutButtonText('mix');
    return;
  }

  STATE.layoutMode = 'mix';
  shuffleBlocks();
  setLayoutButtonText('tile');
}

// Initialize UI event listeners
document.addEventListener('DOMContentLoaded', () => {
  const headerBar = document.getElementById('header-bar');
  
  headerBar.addEventListener('touchstart', (e) => {
    // Allow button clicks
  }, { passive: true });
  
  headerBar.addEventListener('touchmove', (e) => {
    if (!e.target.matches('button, input')) {
      e.preventDefault();
    }
  }, { passive: false });

  const closeWrapper = document.getElementById('detail-view-close-wrapper');
  closeWrapper.addEventListener('click', closeDetailView);
  closeWrapper.addEventListener('touchend', closeDetailView);

  const arenaLink = document.getElementById('detail-view-arena-link');
  arenaLink.addEventListener('touchend', function(e) {
    window.open(this.href, '_blank');
  });
});

// Add new functions for tile and shuffle
function tileBlocks() {
  if (STATE.layoutMode === 'flow') {
    return;
  }

  const blocks = Array.from(document.querySelectorAll('.block'));
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
  const xSpacing = (availableWidth) / (columnsCount - 1 || 1);
  const ySpacing = (availableHeight) / (rowsCount - 1 || 1);
  
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
        rotation: 0 
      };
    }
  });
  
  // Save to cache
  const slug = STATE.channelSlugs[0];
  arenaDB.getChannel(slug).then(cachedData => {
    if (cachedData) {
      return arenaDB.saveChannel(slug, cachedData.data);
    }
  }).catch(error => {
    console.error('Error updating block positions in cache:', error);
  });
}

function shuffleBlocks() {
  if (STATE.layoutMode === 'flow') {
    return;
  }

  const blocks = Array.from(document.querySelectorAll('.block'));
  const blockWidth = 200;
  const blockHeight = 300;
  const headerHeight = 0; // used to be 30, seems like not necessary
  
  const minX = 0;
  const minY = 0;
  const maxX = window.innerWidth - blockWidth;
  const maxY = window.innerHeight - blockHeight - headerHeight;
  
  blocks.forEach(block => {
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
        rotation: rotation 
      };
    }
  });
  
  // Save to cache
  const slug = STATE.channelSlugs[0];
  arenaDB.getChannel(slug).then(cachedData => {
    if (cachedData) {
      return arenaDB.saveChannel(slug, cachedData.data);
    }
  }).catch(error => {
    console.error('Error updating block positions in cache:', error);
  });
}

function getFlowGapPixels() {
  const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  return CONFIG.flowGapRem * rootFontSize;
}

function getOrderedFlowBlocks() {
  const blockMap = new Map(STATE.allFetchedBlocks.map(block => [String(block.id), block]));
  const orderedBlocks = STATE.cachedBlockOrder
    .map(id => blockMap.get(String(id)))
    .filter(Boolean);

  if (orderedBlocks.length > 0) {
    return orderedBlocks;
  }

  return STATE.allFetchedBlocks.slice();
}

function estimateFlowBlockHeight(block) {
  const maxHeight = CONFIG.flowBlockMaxHeight;
  const width = CONFIG.flowBlockWidth;
  const paddingAndBorder = 14;

  const versions = block.imageVersions;
  const measured = STATE.flowImageMeasurements[String(block.id)];
  const imageVersion = versions?.original || versions?.large || versions?.display || versions?.preview || versions?.thumb;
  const sourceWidth = measured?.width || versions?.width || imageVersion?.width;
  const sourceHeight = measured?.height || versions?.height || imageVersion?.height;

  if (sourceWidth && sourceHeight) {
    return Math.min(maxHeight, Math.max(80, (sourceHeight / sourceWidth) * width + paddingAndBorder));
  }

  if (versions) {
    return Math.min(maxHeight, Math.max(120, width * 0.75 + paddingAndBorder));
  }

  if (block.kind === 'channel') {
    return 150;
  }

  const text = block.title || block.text || block.description || '';
  if (block.kind === 'text' || text) {
    const approxLines = Math.ceil(String(text).replace(/<[^>]+>/g, '').length / 24);
    return Math.min(maxHeight, Math.max(90, approxLines * 22 + paddingAndBorder));
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

  if (STATE.layoutMode !== 'flow' || !STATE.flow) {
    return;
  }

  if (STATE.flow.measurementFrame) {
    cancelAnimationFrame(STATE.flow.measurementFrame);
  }

  STATE.flow.measurementFrame = requestAnimationFrame(() => {
    if (!STATE.flow || STATE.layoutMode !== 'flow') {
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
    items: []
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
      height
    });

    columns[column].height += height + gap;
  });

  columns.forEach(column => {
    column.height = Math.max(column.height, window.innerHeight + gap);
  });

  return {
    gap,
    blockWidth,
    columnPitch,
    columns,
    width: columnCount * columnPitch,
    hasItems: columns.some(column => column.items.length > 0)
  };
}

function createFlowSurface() {
  let surface = document.getElementById('flow-surface');
  if (surface) {
    return surface;
  }

  surface = document.createElement('div');
  surface.id = 'flow-surface';
  document.body.appendChild(surface);
  return surface;
}

function clearFlowInstances() {
  if (!STATE.flow) {
    return;
  }

  const elements = [
    ...Array.from(STATE.flow.visible?.values() || []),
    ...(STATE.flow.pool || [])
  ];

  elements.forEach(element => {
    if (element._imageObserver) {
      element._imageObserver.disconnect();
    }
    element.remove();
  });
  STATE.flow.visible.clear();
  STATE.flow.pool = [];
}

function removeFlowSurface() {
  const surface = document.getElementById('flow-surface');
  if (surface) {
    surface.remove();
  }
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

function renderFlowViewport() {
  if (STATE.layoutMode !== 'flow' || !STATE.flow) {
    return;
  }

  const flow = STATE.flow;
  const { pattern } = flow;
  if (!pattern.hasItems) {
    return;
  }

  const buffer = CONFIG.flowRenderBuffer;
  const viewport = {
    left: -buffer,
    top: -buffer,
    right: window.innerWidth + buffer,
    bottom: window.innerHeight + buffer
  };

  const minTileX = Math.floor((-flow.offsetX - buffer) / pattern.width) - 1;
  const maxTileX = Math.ceil((-flow.offsetX + window.innerWidth + buffer) / pattern.width) + 1;
  const visibleKeys = new Set();
  const placements = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    pattern.columns.forEach(column => {
      if (!column.items.length) {
        return;
      }

      const screenX = column.x + tileX * pattern.width + flow.offsetX;
      if (screenX + pattern.blockWidth < viewport.left || screenX > viewport.right) {
        return;
      }

      const minCycleY = Math.floor((-flow.offsetY - buffer) / column.height) - 1;
      const maxCycleY = Math.ceil((-flow.offsetY + window.innerHeight + buffer) / column.height) + 1;

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

  flow.visible.forEach((element, key) => {
    if (!visibleKeys.has(key)) {
      releaseFlowBlockElement(key, element);
    }
  });

  placements.forEach(placement => {
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

function acquireFlowBlockElement(block, key) {
  const element = STATE.flow.pool.pop() || createBlockElement(block, {
    appendToDocument: false,
    draggable: false,
    wheelRotation: false,
    flowInstance: true,
    instanceKey: key
  });

  bindFlowBlockElement(element, block, key);
  element.style.display = '';
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
  element.style.display = 'none';
  element.style.transform = 'translate(-10000px, -10000px) rotate(0deg)';
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

function moveFlowViewport(deltaX, deltaY) {
  if (!STATE.flow) {
    return;
  }

  STATE.flow.offsetX -= deltaX;
  STATE.flow.offsetY -= deltaY;
  requestFlowRender();
}

function handleFlowWheel(event) {
  if (STATE.layoutMode !== 'flow') {
    return;
  }

  event.preventDefault();
  moveFlowViewport(event.deltaX, event.deltaY);
}

function handleFlowPointerDown(event) {
  if (STATE.layoutMode !== 'flow' || event.button !== 0) {
    return;
  }

  const ignoredSelectors = '#header-bar, #detail-view, .modal-dialog';
  if (event.target.closest(ignoredSelectors)) {
    return;
  }

  STATE.flow.isDragging = true;
  STATE.flow.dragPointerId = event.pointerId;
  STATE.flow.lastPointerX = event.clientX;
  STATE.flow.lastPointerY = event.clientY;
  document.body.classList.add('flow-dragging');

  if (event.target.setPointerCapture) {
    event.target.setPointerCapture(event.pointerId);
  }
}

function handleFlowPointerMove(event) {
  if (!STATE.flow?.isDragging || STATE.flow.dragPointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - STATE.flow.lastPointerX;
  const deltaY = event.clientY - STATE.flow.lastPointerY;
  STATE.flow.lastPointerX = event.clientX;
  STATE.flow.lastPointerY = event.clientY;
  moveFlowViewport(-deltaX, -deltaY);
}

function endFlowPointerDrag(event) {
  if (!STATE.flow?.isDragging || STATE.flow.dragPointerId !== event.pointerId) {
    return;
  }

  STATE.flow.isDragging = false;
  STATE.flow.dragPointerId = null;
  document.body.classList.remove('flow-dragging');
}

function enterFlowMode() {
  if (!STATE.allFetchedBlocks.length) {
    return;
  }

  clearInterval(STATE.loadIntervalId);
  STATE.loadIntervalId = null;
  clearRenderedBlocks();

  document.body.classList.add('flow-mode');

  STATE.flow = {
    offsetX: 0,
    offsetY: 0,
    pattern: buildFlowPattern(),
    surface: createFlowSurface(),
    visible: new Map(),
    pool: [],
    isDragging: false,
    dragPointerId: null,
    lastPointerX: 0,
    lastPointerY: 0,
    measurementFrame: null,
    renderFrame: null
  };

  STATE.flow.surface.addEventListener('wheel', handleFlowWheel, { passive: false });
  document.addEventListener('pointerdown', handleFlowPointerDown);
  document.addEventListener('pointermove', handleFlowPointerMove);
  document.addEventListener('pointerup', endFlowPointerDrag);
  document.addEventListener('pointercancel', endFlowPointerDrag);
  renderFlowViewport();
}

function exitFlowMode() {
  if (!STATE.flow) {
    document.body.classList.remove('flow-mode', 'flow-dragging');
    removeFlowSurface();
    return;
  }

  if (STATE.flow.renderFrame) {
    cancelAnimationFrame(STATE.flow.renderFrame);
  }
  if (STATE.flow.measurementFrame) {
    cancelAnimationFrame(STATE.flow.measurementFrame);
  }

  STATE.flow.surface.removeEventListener('wheel', handleFlowWheel);
  document.removeEventListener('pointerdown', handleFlowPointerDown);
  document.removeEventListener('pointermove', handleFlowPointerMove);
  document.removeEventListener('pointerup', endFlowPointerDrag);
  document.removeEventListener('pointercancel', endFlowPointerDrag);
  clearFlowInstances();
  removeFlowSurface();
  STATE.flow = null;
  document.body.classList.remove('flow-mode', 'flow-dragging');
  renderInitialBlocksForCurrentChannel();
}

function renderInitialBlocksForCurrentChannel() {
  clearRenderedBlocks();
  STATE.visibleBlockIds = new Set();

  const maxBlocks = isMobileDevice()
    ? Math.min(CONFIG.blocksPerLoad, STATE.cachedBlockOrder.length || STATE.allFetchedBlocks.length)
    : Math.min(CONFIG.maxBlocks || STATE.allFetchedBlocks.length, STATE.cachedBlockOrder.length || STATE.allFetchedBlocks.length);

  const orderedIds = STATE.cachedBlockOrder.length > 0
    ? STATE.cachedBlockOrder
    : STATE.allFetchedBlocks.map(block => String(block.id));

  const blocksToRender = orderedIds.slice(0, maxBlocks);
  renderBlockBatch(blocksToRender);
  STATE.currentlyDisplayedBlocks = blocksToRender.length;

  if (isMobileDevice() && STATE.currentlyDisplayedBlocks < STATE.allFetchedBlocks.length) {
    STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
  }
}

// Add new function to reset tile button
function resetTileButton() {
  if (STATE.layoutMode === 'flow') {
    exitFlowMode();
  }
  STATE.layoutMode = 'mix';
  setLayoutButtonText('tile');
}

// Add new function to show current channel detail
async function showCurrentChannelDetail() {
  if (document.getElementById('detail-view').style.display === 'flex') {
    closeDetailView();
  }

  const slug = STATE.channelSlugs[0];
  if (!slug) return;

  await showChannelDetailBySlug(slug, {
    primaryActionLabel: 'View Channel on Are.na',
    primaryAction: () => {
      window.open(`https://www.are.na/channel/${slug}`, '_blank');
    },
    arenaUrl: `https://www.are.na/channel/${slug}`
  });
}

// More button functionality
const moreButton = document.getElementById('more-button');
const moreMenu = document.getElementById('more-menu');
const moreTileButton = document.getElementById('more-tile-button');
const moreThemeButton = document.getElementById('more-theme-button');
const moreAboutButton = document.getElementById('more-about-button');

// Toggle more menu only when clicking the more button
moreButton.addEventListener('click', (e) => {
  e.stopPropagation();
  moreMenu.classList.toggle('show');
});

// Link more menu buttons to original buttons' functionality
moreTileButton.addEventListener('click', () => {
  document.getElementById('tile-button').click();
  moreTileButton.textContent = document.getElementById('tile-button').textContent;
});

moreThemeButton.addEventListener('click', () => {
  document.getElementById('theme-toggle').click();
  moreThemeButton.textContent = document.getElementById('theme-toggle').textContent;
});

moreAboutButton.addEventListener('click', () => {
  document.getElementById('about-button').click();
});

const savedTheme = localStorage.getItem('theme') || 'system';
moreThemeButton.textContent = savedTheme;

// Function to update theme colors for browsers and PWAs status bars and title bars
function updatePWAThemeColors(theme) {
  const root = document.documentElement;
  let themeColorValue;
  
  // Get the current effective theme
  if (theme === 'system') {
    // Check if system is in dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeColorValue = isDarkMode ? '#1A1A1A' : '#f0f0f0'; 
  } else if (theme === 'dark') {
    themeColorValue = '#1A1A1A'; // Dark theme header color
  } else {
    themeColorValue = '#f0f0f0'; // Light theme header color
  }
  
  // Update the theme-color meta tag (works for Chrome, Firefox, and other browsers)
  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', themeColorValue);
  }
  
  // Update the iOS status bar style (for both Safari mobile browser and PWA mode)
  const iosStatusBarMeta = document.getElementById('ios-status-bar-meta');
  if (iosStatusBarMeta) {
    // For dark theme use black-translucent, for light use default
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      iosStatusBarMeta.setAttribute('content', 'black-translucent');
    } else {
      iosStatusBarMeta.setAttribute('content', 'default');
    }
  }
  
  // Force a refresh for Safari on iOS in some cases
  // This helps ensure the color changes apply immediately in regular browser mode
  if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
    // Create a small style update to force a repaint
    const dummyStyle = document.createElement('style');
    dummyStyle.textContent = '/* */';
    document.head.appendChild(dummyStyle);
    setTimeout(() => {
      document.head.removeChild(dummyStyle);
    }, 10);
  }
}

// Initialize theme colors when page loads
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'system';
  updatePWAThemeColors(savedTheme);
  
  // Also listen for system color scheme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'system') {
      updatePWAThemeColors('system');
    }
  });
});
