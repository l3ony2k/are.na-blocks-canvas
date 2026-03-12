function ensureBlockLayout(blocks) {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  const blockDimensions = {
    width: 200,
    height: 300
  };

  const bounds = {
    minX: 0,
    minY: 0,
    maxX: viewport.width - blockDimensions.width,
    maxY: viewport.height - blockDimensions.height
  };

  blocks.forEach(block => {
    if (!STATE.cachedBlockPositions[block.id]) {
      STATE.cachedBlockPositions[block.id] = {
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        rotation: Math.random() * 20 - 10
      };
    }

    if (!STATE.cachedBlockOrder.includes(String(block.id)) && !STATE.cachedBlockOrder.includes(block.id)) {
      STATE.cachedBlockOrder.push(String(block.id));
    }
  });

  if (STATE.cachedBlockOrder.length === 0) {
    STATE.cachedBlockOrder = blocks.map(block => String(block.id));
  } else {
    STATE.cachedBlockOrder = STATE.cachedBlockOrder.map(id => String(id));
  }
}

function clearRenderedBlocks() {
  document.querySelectorAll('.block').forEach(block => {
    if (block._imageObserver) {
      block._imageObserver.disconnect();
    }
    block.remove();
  });
}

function renderBlockBatch(blockIds) {
  blockIds.forEach(blockId => {
    try {
      const block = STATE.allFetchedBlocks.find(item => String(item.id) === String(blockId));
      if (!block) {
        return;
      }

      const blockElement = renderBlock(block);
      const position = STATE.cachedBlockPositions[block.id];

      if (position) {
        blockElement.style.transform = `translate(${position.x}px, ${position.y}px) rotate(${position.rotation}deg)`;
      }

      STATE.visibleBlockIds.add(String(block.id));
    } catch (error) {
      console.error('Error rendering block:', error);
    }
  });
}

async function fetchChannelBlocks(slug) {
  outputLog(`[fetchChannelBlocks] Start fetching blocks for channel "${slug}"...`);

  const loadingContainer = document.getElementById('loading-container');
  const logOutput = document.getElementById('log-output');
  const loadingBar = document.getElementById('loading-bar');

  loadingContainer.style.display = 'block';
  logOutput.style.display = 'block';
  logOutput.innerHTML = '';
  loadingBar.style.width = '0%';

  try {
    const channelInfo = await fetchChannelInfo(slug);
    if (!channelInfo) {
      throw new Error(`Could not fetch channel info for "${slug}"`);
    }

    STATE.currentChannelInfo = channelInfo;

    const totalBlocks = channelInfo.counts?.contents || 0;
    outputLog(`[fetchChannelBlocks] Channel "${slug}" has ${totalBlocks} blocks in total.`);

    const result = await arenaAPI.getAllChannelContents(slug, {
      per: 100,
      sort: 'position_desc',
      onPageLoaded: info => {
        outputLog(`[fetchChannelBlocks] Page ${info.page} data received, ${info.pageCount} blocks.`);
        if (info.total > 0) {
          loadingBar.style.width = `${(info.loaded / info.total) * 100}%`;
        }
      }
    });

    result.pageErrors.forEach((error, index) => {
      outputLog(`[fetchChannelBlocks] Error fetching page ${index + 2}: ${error.message}`);
    });

    STATE.cachedBlockPositions = {};
    STATE.cachedBlockOrder = [];
    ensureBlockLayout(result.data);

    outputLog(`[fetchChannelBlocks] Blocks for channel "${slug}" fetched, ${result.data.length} blocks in total.`);
    return result.data;
  } finally {
    loadingContainer.style.display = 'none';
    logOutput.style.display = 'none';
  }
}

async function updateChannel(newSlug, forceRefresh = false) {
  closeDetailView();
  resetTileButton();
  outputLog(`[Channel] Switching to: ${newSlug}`);

  if (STATE.memoryMonitorId) {
    clearInterval(STATE.memoryMonitorId);
    STATE.memoryMonitorId = null;
  }

  clearRenderedBlocks();
  clearInterval(STATE.loadIntervalId);
  STATE.loadIntervalId = null;

  STATE.channelSlugs = [newSlug];
  STATE.currentChannelInfo = null;
  STATE.allFetchedBlocks = [];
  STATE.currentlyDisplayedBlocks = 0;
  STATE.cachedBlockPositions = {};
  STATE.cachedBlockOrder = [];
  STATE.visibleBlockIds = new Set();

  if (!forceRefresh) {
    try {
      const cachedData = await arenaDB.getChannel(newSlug);
      if (
        cachedData &&
        Array.isArray(cachedData.data) &&
        cachedData.timestamp &&
        Date.now() - cachedData.timestamp < CONFIG.cacheMaxAge
      ) {
        outputLog(`[Cache] Loading data for ${newSlug}`);

        STATE.allFetchedBlocks = cachedData.data;
        STATE.cachedBlockPositions = cachedData.positions || {};
        STATE.cachedBlockOrder = Array.isArray(cachedData.order) ? cachedData.order.map(id => String(id)) : [];
        ensureBlockLayout(STATE.allFetchedBlocks);

        const isMobile = isMobileDevice();
        if (isMobile) {
          startMemoryMonitoring();
          const initialBlocks = Math.min(CONFIG.blocksPerLoad, STATE.cachedBlockOrder.length);
          renderBlockBatch(STATE.cachedBlockOrder.slice(0, initialBlocks));
          STATE.currentlyDisplayedBlocks = initialBlocks;
          STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
        } else {
          const maxBlocks = CONFIG.maxBlocks || STATE.cachedBlockOrder.length;
          const blocksToRender = STATE.cachedBlockOrder.slice(0, maxBlocks);
          renderBlockBatch(blocksToRender);

          if (document.querySelectorAll('.block').length === 0) {
            throw new Error('No blocks rendered from cache');
          }

          STATE.currentlyDisplayedBlocks = blocksToRender.length;
        }

        outputLog(`[Cache] Successfully loaded ${STATE.currentlyDisplayedBlocks} blocks`);
        return;
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
      outputLog(`[Cache] Load failed: ${error.message}, falling back to API`);
    }
  }

  try {
    const blocks = await fetchChannelBlocks(newSlug);
    if (!blocks || blocks.length === 0) {
      throw new Error(`No blocks found in channel: ${newSlug}`);
    }

    STATE.allFetchedBlocks = blocks;
    ensureBlockLayout(blocks);

    try {
      await arenaDB.saveChannel(newSlug, blocks);
    } catch (error) {
      console.error('Failed to save to cache:', error);
      outputLog('[Warning] Failed to save to cache, but blocks loaded successfully');
    }

    if (isMobileDevice()) {
      startMemoryMonitoring();
    }

    loadMoreBlocks();
    STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
    outputLog(`[API] Successfully loaded ${blocks.length} blocks`);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    outputLog(`[Error] ${error.message}`);
  }
}

function startMemoryMonitoring() {
  if (!isMobileDevice() || !window.performance || !window.performance.memory) {
    return;
  }

  STATE.memoryMonitorId = setInterval(() => {
    try {
      if (
        window.performance.memory &&
        window.performance.memory.usedJSHeapSize > window.performance.memory.jsHeapSizeLimit * 0.8
      ) {
        outputLog('[Memory Warning] High memory usage detected, cleaning up offscreen blocks');
        cleanupOffscreenBlocks();
      }
    } catch (error) {
      console.error('Error monitoring memory:', error);
    }
  }, CONFIG.memoryCheckInterval);
}

function cleanupOffscreenBlocks() {
  if (!isMobileDevice()) {
    return;
  }

  const viewport = {
    left: window.scrollX,
    top: window.scrollY,
    right: window.scrollX + window.innerWidth,
    bottom: window.scrollY + window.innerHeight
  };

  const margin = 200;
  const extendedViewport = {
    left: viewport.left - margin,
    top: viewport.top - margin,
    right: viewport.right + margin,
    bottom: viewport.bottom + margin
  };

  const blocks = document.querySelectorAll('.block');
  const blocksToRemove = [];

  blocks.forEach(block => {
    const rect = block.getBoundingClientRect();
    const blockCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    if (
      blockCenter.x < extendedViewport.left ||
      blockCenter.x > extendedViewport.right ||
      blockCenter.y < extendedViewport.top ||
      blockCenter.y > extendedViewport.bottom
    ) {
      blocksToRemove.push({ element: block, id: block.dataset.blockId });
    }
  });

  const maxToRemove = Math.min(blocksToRemove.length, 10);
  if (maxToRemove > 0) {
    outputLog(`[Memory Cleanup] Removing ${maxToRemove} offscreen blocks`);

    for (let index = 0; index < maxToRemove; index += 1) {
      const { element, id } = blocksToRemove[index];

      if (element._imageObserver) {
        element._imageObserver.disconnect();
      }

      element.remove();
      if (id) {
        STATE.visibleBlockIds.delete(String(id));
      }
    }
  }
}

function createBlockLimitWarningDialog() {
  if (document.getElementById('block-limit-warning')) {
    return document.getElementById('block-limit-warning');
  }

  const dialog = document.createElement('div');
  dialog.id = 'block-limit-warning';
  dialog.className = 'modal-dialog';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const title = document.createElement('h3');
  title.textContent = 'Block Limit Reached';

  const description = document.createElement('p');
  description.innerHTML = 'This channel has more than <span id="block-limit-count"></span> blocks. Loading more may affect performance on your device.';

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  const loadMoreButton = document.createElement('button');
  loadMoreButton.id = 'load-more-blocks-btn';
  loadMoreButton.textContent = 'Load More';

  const cancelButton = document.createElement('button');
  cancelButton.id = 'cancel-load-more-btn';
  cancelButton.textContent = 'Cancel';

  buttonGroup.appendChild(loadMoreButton);
  buttonGroup.appendChild(cancelButton);
  content.appendChild(title);
  content.appendChild(description);
  content.appendChild(buttonGroup);
  dialog.appendChild(content);

  document.body.appendChild(dialog);
  initBlockLimitWarningListeners();

  return dialog;
}

function initBlockLimitWarningListeners() {
  const warningDialog = document.getElementById('block-limit-warning');
  const loadMoreButton = document.getElementById('load-more-blocks-btn');
  const cancelButton = document.getElementById('cancel-load-more-btn');

  if (!warningDialog || !loadMoreButton || !cancelButton) {
    return;
  }

  warningDialog.addEventListener('click', event => {
    event.stopPropagation();
  });

  const modalContent = warningDialog.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', event => {
      event.stopPropagation();
    });
  }

  warningDialog.addEventListener('mousedown', event => {
    if (event.target === warningDialog) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  loadMoreButton.onclick = () => {
    CONFIG.userOverrideBlockLimit = true;
    warningDialog.style.display = 'none';

    if (STATE.loadIntervalId === null) {
      STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
    }

    loadMoreBlocks();
  };

  cancelButton.onclick = () => {
    warningDialog.style.display = 'none';
    CONFIG.userOverrideBlockLimit = false;
  };
}

function showBlockLimitWarning() {
  let warningDialog = document.getElementById('block-limit-warning');

  if (!warningDialog) {
    warningDialog = createBlockLimitWarningDialog();
    if (!warningDialog) {
      return;
    }
  }

  const blockLimitCount = document.getElementById('block-limit-count');
  if (blockLimitCount) {
    blockLimitCount.textContent = CONFIG.maxBlocks;
  }

  warningDialog.classList.add('show');
  warningDialog.style.display = 'flex';
}

function loadMoreBlocks() {
  if (STATE.isLoading) {
    return;
  }
  STATE.isLoading = true;

  const isMobile = isMobileDevice();
  const currentBlockCount = document.querySelectorAll('.block').length;
  const maxAllowedBlocks = CONFIG.userOverrideBlockLimit ? CONFIG.maxBlocksAfterOverride : CONFIG.maxBlocks;

  if (!CONFIG.userOverrideBlockLimit && currentBlockCount >= CONFIG.maxBlocks) {
    outputLog(`[loadMoreBlocks] Initial block limit reached (${CONFIG.maxBlocks}), showing warning`);
    showBlockLimitWarning();
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
    STATE.isLoading = false;
    return;
  }

  if (currentBlockCount >= maxAllowedBlocks) {
    outputLog(`[loadMoreBlocks] Block limit reached (${maxAllowedBlocks}), stopping auto-load`);
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
    STATE.isLoading = false;
    return;
  }

  const nextBatch = STATE.allFetchedBlocks.slice(
    STATE.currentlyDisplayedBlocks,
    STATE.currentlyDisplayedBlocks + CONFIG.blocksPerLoad
  );

  if (nextBatch.length === 0) {
    outputLog('[loadMoreBlocks] No more blocks to load.');
    STATE.isLoading = false;
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
    return;
  }

  let blocksToRender = nextBatch;
  if (STATE.cachedBlockOrder.length > 0) {
    const startIndex = STATE.currentlyDisplayedBlocks;
    const endIndex = STATE.currentlyDisplayedBlocks + CONFIG.blocksPerLoad;

    blocksToRender = STATE.cachedBlockOrder
      .slice(startIndex, endIndex)
      .filter(blockId => !STATE.visibleBlockIds.has(String(blockId)))
      .map(blockId => STATE.allFetchedBlocks.find(block => String(block.id) === String(blockId)))
      .filter(Boolean);
  }

  blocksToRender.forEach(block => {
    const blockElement = renderBlock(block);
    const position = STATE.cachedBlockPositions[block.id];

    if (position) {
      blockElement.style.transform = `translate(${position.x}px, ${position.y}px) rotate(${position.rotation}deg)`;
    }

    STATE.visibleBlockIds.add(String(block.id));
  });

  STATE.currentlyDisplayedBlocks += blocksToRender.length;

  if (isMobile && STATE.currentlyDisplayedBlocks > CONFIG.maxBlocks / 2) {
    cleanupOffscreenBlocks();
  }

  if (STATE.currentlyDisplayedBlocks >= STATE.allFetchedBlocks.length) {
    outputLog(`[loadMoreBlocks] All blocks loaded: ${STATE.currentlyDisplayedBlocks}`);
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
  }

  STATE.isLoading = false;
}

function getBlockDisplayTitle(block) {
  if (block.title) {
    return block.title;
  }

  if (block.kind === 'link') {
    return 'Link';
  }

  if (block.kind === 'channel') {
    return 'Channel';
  }

  return 'Block Details';
}

function appendDetailImage(container, block) {
  if (!block.imageVersions) {
    return;
  }

  const isMobile = isMobileDevice();
  const img = document.createElement('img');
  const initialVersion = block.imageVersions.display || block.imageVersions.large || block.imageVersions.original;
  const intrinsicVersion = block.imageVersions.original || initialVersion;

  if (!initialVersion?.url) {
    return;
  }

  img.src = initialVersion.url;
  if (intrinsicVersion?.width) {
    img.width = intrinsicVersion.width;
  }
  if (intrinsicVersion?.height) {
    img.height = intrinsicVersion.height;
  }
  if (intrinsicVersion?.width && intrinsicVersion?.height) {
    img.style.aspectRatio = `${intrinsicVersion.width} / ${intrinsicVersion.height}`;
  }

  if (isMobile) {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  }

  img.alt = block.title || block.imageVersions.altText || 'Image';
  container.appendChild(img);

  if (!isMobile && block.imageVersions.original?.url && block.imageVersions.original.url !== img.src) {
    const originalImg = new Image();
    originalImg.onload = () => {
      if (img.isConnected) {
        img.src = originalImg.src;
      }
    };
    originalImg.onerror = () => {
      console.warn('Failed to load original image, keeping display version');
    };
    originalImg.src = block.imageVersions.original.url;
  }
}

function renderNonChannelDetail(block) {
  const detailContent = document.getElementById('detail-view-content');
  const arenaLinkElement = document.getElementById('detail-view-arena-link');

  resetDetailPanels();
  arenaLinkElement.href = block.arenaUrl || `https://www.are.na/block/${block.id}`;

  if (block.imageVersions) {
    appendDetailImage(detailContent, block);
  }

  if (block.kind === 'text' && block.textHtml) {
    const text = document.createElement('div');
    text.innerHTML = block.textHtml;
    detailContent.appendChild(text);
  } else if (!block.imageVersions && block.title) {
    const title = document.createElement('div');
    title.innerHTML = block.title;
    detailContent.appendChild(title);
  }

  if (block.descriptionHtml) {
    addMetaItem('Description', block.descriptionHtml, null, true);
  }

  addMetaItem('Block ID', String(block.id), block.arenaUrl || `https://www.are.na/block/${block.id}`);

  if (block.connection?.connectedAt) {
    addMetaItem('Connected At', new Date(block.connection.connectedAt).toLocaleString(), null);
  }

  if (block.connection?.connectedBy?.name) {
    const userPageUrl = block.connection.connectedBy.slug
      ? `https://www.are.na/${block.connection.connectedBy.slug}`
      : null;
    addMetaItem('Connected By', block.connection.connectedBy.name, userPageUrl, false);
  }

  if (block.source?.url) {
    addMetaItem('Source', block.source.title || block.source.url, block.source.url, false);
  }
}

async function showDetailView(event) {
  if (document.getElementById('detail-view').style.display === 'flex') {
    closeDetailView();
  }

  const blockElement = event.currentTarget;
  const blockId = blockElement.dataset.blockId;

  STATE.lastViewedBlockElement = blockElement;
  blockElement.style.display = 'none';

  document.querySelectorAll('#detail-view-content img').forEach(img => {
    if (img.observer) {
      img.observer.disconnect();
    }
  });

  const block = STATE.allFetchedBlocks.find(item => String(item.id) === String(blockId));
  if (!block) {
    console.error('Could not find block data:', blockId);
    return;
  }

  const titleElement = document.getElementById('detail-view-title');
  titleElement.textContent = getBlockDisplayTitle(block);
  titleElement.title = getBlockDisplayTitle(block);

  document.getElementById('detail-view').style.display = 'flex';

  if (block.kind === 'channel') {
    await showChannelDetailBySlug(block.slug, {
      title: getBlockDisplayTitle(block),
      contextItem: block,
      primaryActionLabel: 'Go to Channel',
      primaryAction: () => {
        closeDetailView();
        router.navigate(block.slug);
      },
      arenaUrl: block.arenaUrl
    });
    return;
  }

  renderNonChannelDetail(block);
}

function initBlockLimitWarning() {
  const warningDialog = document.getElementById('block-limit-warning');
  if (!warningDialog) {
    return;
  }

  initBlockLimitWarningListeners();
}

async function main() {
  initHeaderBar();
  router.init();
  initBlockLimitWarning();

  try {
    await arenaDB.clearOldCache();
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }

  window.addEventListener('beforeunload', () => {
    if (STATE.memoryMonitorId) {
      clearInterval(STATE.memoryMonitorId);
    }
    if (STATE.loadIntervalId) {
      clearInterval(STATE.loadIntervalId);
    }

    document.querySelectorAll('.block').forEach(block => {
      if (block._imageObserver) {
        block._imageObserver.disconnect();
      }
    });
  });
}

main();
