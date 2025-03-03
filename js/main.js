// API Functions
async function fetchChannelInfo(slug) {
  outputLog(`[fetchChannelInfo] Fetching channel "${slug}" info...`);
  const apiUrl = `https://api.are.na/v2/channels/${slug}`;
  try {
    const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${CONFIG.accessToken}` } });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    outputLog(`[fetchChannelInfo] Channel "${slug}" info: ${data.title}`);
    return data;
  } catch (error) {
    outputLog(`[fetchChannelInfo] Error fetching channel info: ${error}`);
    return null;
  }
}

async function fetchChannelBlocks(slug) {
  outputLog(`[fetchChannelBlocks] Start fetching blocks for channel "${slug}"...`);
  let allBlocks = [];
  
  // 获取频道信息
  const channelInfo = await fetchChannelInfo(slug);
  if (!channelInfo) {
    outputLog("[fetchChannelBlocks] Could not get channel info, aborting block fetching.");
    return [];
  }
  
  const totalBlocks = channelInfo.length;
  outputLog(`[fetchChannelBlocks] Channel "${slug}" has ${totalBlocks} blocks in total.`);
  
  // 显示加载UI
  const loadingContainer = document.getElementById('loading-container');
  const logOutput = document.getElementById('log-output');
  const loadingBar = document.getElementById('loading-bar');
  
  loadingContainer.style.display = 'block';
  logOutput.style.display = 'block';
  logOutput.innerHTML = '';
  loadingBar.style.width = '0%';

  try {
    // 计算需要的页数
    const perPage = 100;
    const totalPages = Math.ceil(totalBlocks / perPage);
    let loadedBlocks = 0;
    
    // 创建一批Promise请求
    const pagePromises = [];
    for (let page = 1; page <= totalPages; page++) {
      const apiUrl = `https://api.are.na/v2/channels/${slug}/contents?per=${perPage}&page=${page}`;
      outputLog(`[fetchChannelBlocks] Requesting page ${page}, URL: ${apiUrl}`);
      
      const pagePromise = fetch(apiUrl, { 
        headers: { 'Authorization': `Bearer ${CONFIG.accessToken}` } 
      })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        outputLog(`[fetchChannelBlocks] Page ${page} data received, ${data.contents.length} blocks.`);
        loadedBlocks += data.contents.length;
        loadingBar.style.width = `${(loadedBlocks/totalBlocks)*100}%`;
        return data.contents;
      });
      
      pagePromises.push(pagePromise);
    }
    
    // 使用Promise.allSettled确保即使某些请求失败，我们也能获取尽可能多的数据
    const results = await Promise.allSettled(pagePromises);
    
    // 处理结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allBlocks = allBlocks.concat(result.value);
      } else {
        outputLog(`[fetchChannelBlocks] Error fetching page ${index + 1}: ${result.reason}`);
      }
    });
  } catch (error) {
    outputLog(`[fetchChannelBlocks] Error fetching channel blocks: ${error}`);
  } finally {
    // 清理UI
    loadingContainer.style.display = 'none';
    logOutput.style.display = 'none';
  }
  
  outputLog(`[fetchChannelBlocks] Blocks for channel "${slug}" fetched, ${allBlocks.length} blocks in total.`);

  // 初始化区块位置
  STATE.cachedBlockPositions = {};
  STATE.cachedBlockOrder = [];
  
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
  
  // 为所有区块分配随机位置
  allBlocks.forEach(block => {
    const position = {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
      rotation: Math.random() * 20 - 10  // -10 到 +10 度之间的随机旋转
    };
    
    STATE.cachedBlockPositions[block.id] = position;
    STATE.cachedBlockOrder.push(block.id);
  });

  return allBlocks;
}

async function updateChannel(newSlug, forceRefresh = false) {
  closeDetailView();
  resetTileButton();
  outputLog(`[Channel] Switching to: ${newSlug}`);

  // Clean up any existing memory monitoring
  if (STATE.memoryMonitorId) {
    clearInterval(STATE.memoryMonitorId);
    STATE.memoryMonitorId = null;
  }

  document.querySelectorAll('.block').forEach(block => {
    // Clean up any observers before removing elements
    if (block._imageObserver) {
      block._imageObserver.disconnect();
    }
    block.remove();
  });

  clearInterval(STATE.loadIntervalId);
  
  STATE.channelSlugs = [newSlug];
  STATE.allFetchedBlocks = [];
  STATE.currentlyDisplayedBlocks = 0;
  STATE.cachedBlockPositions = {};
  STATE.cachedBlockOrder = [];
  STATE.visibleBlockIds = new Set(); // Track which blocks are currently visible

  if (!forceRefresh) {
    try {
      const cachedData = await arenaDB.getChannel(newSlug);
      if (cachedData &&
          cachedData.data &&
          cachedData.positions &&
          cachedData.timestamp &&
          Date.now() - cachedData.timestamp < CONFIG.cacheMaxAge) {
        
        outputLog(`[Cache] Loading data for ${newSlug}`);
        STATE.allFetchedBlocks = cachedData.data;
        STATE.cachedBlockPositions = cachedData.positions || {};
        
        STATE.cachedBlockOrder = (cachedData.order && cachedData.order.length > 0)
          ? cachedData.order
          : STATE.allFetchedBlocks.map(b => b.id);
          
        if (!Array.isArray(STATE.allFetchedBlocks) || STATE.allFetchedBlocks.length === 0) {
          throw new Error('Invalid cache data structure');
        }
        
        // On mobile, we'll load blocks progressively
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          // Start the memory monitor for mobile devices
          startMemoryMonitoring();
          
          // Load only a portion of blocks initially
          const initialBlocks = Math.min(CONFIG.blocksPerLoad, STATE.cachedBlockOrder.length);
          STATE.cachedBlockOrder.slice(0, initialBlocks).forEach(blockId => {
            try {
              const block = STATE.allFetchedBlocks.find(b => b.id === blockId);
              if (block) {
                const blockElement = renderBlock(block);
                if (STATE.cachedBlockPositions[block.id]) {
                  const pos = STATE.cachedBlockPositions[block.id];
                  blockElement.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg)`;
                }
                STATE.visibleBlockIds.add(blockId);
              }
            } catch (error) {
              console.error('Error rendering cached block:', error);
            }
          });
          
          STATE.currentlyDisplayedBlocks = initialBlocks;
          
          // Set up interval to load more blocks
          STATE.loadIntervalId = setInterval(loadMoreBlocks, CONFIG.loadInterval);
        } else {
          // On desktop, load all blocks at once (with a maximum limit if specified)
          let renderSuccess = true;
          const maxBlocks = CONFIG.maxBlocks || STATE.cachedBlockOrder.length;
          const blocksToRender = STATE.cachedBlockOrder.slice(0, maxBlocks);
          
          blocksToRender.forEach(blockId => {
            try {
              const block = STATE.allFetchedBlocks.find(b => b.id === blockId);
              if (block) {
                const blockElement = renderBlock(block);
                if (STATE.cachedBlockPositions[block.id]) {
                  const pos = STATE.cachedBlockPositions[block.id];
                  blockElement.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg)`;
                }
                STATE.visibleBlockIds.add(blockId);
              }
            } catch (error) {
              renderSuccess = false;
              console.error('Error rendering cached block:', error);
            }
          });
          
          if (document.querySelectorAll('.block').length === 0) {
            throw new Error('No blocks rendered from cache');
          }

          if (!renderSuccess) {
            throw new Error('Failed to render some cached blocks');
          }
          
          STATE.currentlyDisplayedBlocks = blocksToRender.length;
        }
        
        outputLog(`[Cache] Successfully loaded ${STATE.currentlyDisplayedBlocks} blocks`);
        return;
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
      outputLog(`[Cache] Load failed: ${error.message}, falling back to API`);
      try {
        await arenaDB.saveChannel(newSlug, null);
      } catch (e) {
        console.error('Failed to clear corrupted cache:', e);
      }
    }
  }

  try {
    const blocks = await fetchChannelBlocks(newSlug);
    if (!blocks || blocks.length === 0) {
      throw new Error(`No blocks found in channel: ${newSlug}`);
    }
    STATE.allFetchedBlocks.push(...blocks);
    
    try {
      await arenaDB.saveChannel(newSlug, blocks);
    } catch (error) {
      console.error('Failed to save to cache:', error);
      outputLog('[Warning] Failed to save to cache, but blocks loaded successfully');
    }
    
    // On mobile devices, start memory monitoring
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

// New function to handle memory monitoring on mobile devices
function startMemoryMonitoring() {
  // Only for mobile devices and if supported
  if (!isMobileDevice() || !window.performance || !window.performance.memory) return;
  
  STATE.memoryMonitorId = setInterval(() => {
    try {
      // Check for high memory usage and remove elements if needed
      if (window.performance.memory && window.performance.memory.usedJSHeapSize > 
          window.performance.memory.jsHeapSizeLimit * 0.8) {
        outputLog('[Memory Warning] High memory usage detected, cleaning up offscreen blocks');
        cleanupOffscreenBlocks();
      }
    } catch (e) {
      console.error('Error monitoring memory:', e);
    }
  }, CONFIG.memoryCheckInterval);
}

// Helper function to clean up blocks that are completely off screen
function cleanupOffscreenBlocks() {
  if (!isMobileDevice()) return;
  
  const viewport = {
    left: window.scrollX,
    top: window.scrollY,
    right: window.scrollX + window.innerWidth,
    bottom: window.scrollY + window.innerHeight
  };
  
  const margin = 200; // Extra margin around viewport to prevent too aggressive cleanup
  const extendedViewport = {
    left: viewport.left - margin,
    top: viewport.top - margin, 
    right: viewport.right + margin,
    bottom: viewport.bottom + margin
  };
  
  // Get all blocks and check if they're in the viewport
  const blocks = document.querySelectorAll('.block');
  const blocksToRemove = [];
  
  blocks.forEach(block => {
    const rect = block.getBoundingClientRect();
    const blockCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    // If block is completely outside the extended viewport, mark for removal
    if (blockCenter.x < extendedViewport.left || 
        blockCenter.x > extendedViewport.right ||
        blockCenter.y < extendedViewport.top || 
        blockCenter.y > extendedViewport.bottom) {
      
      const blockId = block.dataset.blockId;
      blocksToRemove.push({ element: block, id: blockId });
    }
  });
  
  // Limit how many blocks we remove at once to avoid visual issues
  const maxToRemove = Math.min(blocksToRemove.length, 10);
  if (maxToRemove > 0) {
    outputLog(`[Memory Cleanup] Removing ${maxToRemove} offscreen blocks`);
    
    for (let i = 0; i < maxToRemove; i++) {
      const { element, id } = blocksToRemove[i];
      
      // Cleanup observers
      if (element._imageObserver) {
        element._imageObserver.disconnect();
      }
      
      // Remove element from DOM
      element.remove();
      
      // Update tracking
      if (id) {
        STATE.visibleBlockIds.delete(id);
      }
    }
  }
}

function loadMoreBlocks() {
  if (STATE.isLoading) return;
  STATE.isLoading = true;
  
  const isMobile = isMobileDevice();
  
  // On mobile, check if we've reached the maximum number of blocks to display
  if (isMobile && document.querySelectorAll('.block').length >= CONFIG.maxBlocks) {
    outputLog(`[loadMoreBlocks] Mobile block limit reached (${CONFIG.maxBlocks}), stopping auto-load`);
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
    STATE.isLoading = false;
    return;
  }
  
  const nextBatch = STATE.allFetchedBlocks.slice(STATE.currentlyDisplayedBlocks, STATE.currentlyDisplayedBlocks + CONFIG.blocksPerLoad);
  if (nextBatch.length === 0) {
    outputLog("[loadMoreBlocks] No more blocks to load.");
    STATE.isLoading = false;
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
    return;
  }
  
  let blocksToRender = nextBatch;
  if (STATE.cachedBlockOrder.length > 0) {
    // Only render blocks that aren't already visible
    const startIdx = STATE.currentlyDisplayedBlocks;
    const endIdx = STATE.currentlyDisplayedBlocks + CONFIG.blocksPerLoad;
    
    blocksToRender = STATE.cachedBlockOrder.slice(startIdx, endIdx)
      .filter(blockId => !STATE.visibleBlockIds.has(blockId))
      .map(blockId => STATE.allFetchedBlocks.find(block => block.id === blockId))
      .filter(block => block);
  }
  
  // Render blocks
  blocksToRender.forEach(block => {
    const blockElement = renderBlock(block);
    if (STATE.cachedBlockPositions[block.id]) {
      const pos = STATE.cachedBlockPositions[block.id];
      blockElement.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg)`;
    }
    STATE.visibleBlockIds.add(block.id);
  });
  
  STATE.currentlyDisplayedBlocks += blocksToRender.length;
  
  // On mobile, do memory cleanup after adding new blocks
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

async function showDetailView(event) {
  // Close current detail view if open
  if (document.getElementById('detail-view').style.display === 'flex') {
    closeDetailView();
  }

  const blockElement = event.currentTarget;
  const blockId = blockElement.dataset.blockId;
  
  // Hide the current block
  STATE.lastViewedBlockElement = blockElement;
  blockElement.style.display = 'none';
  
  document.querySelectorAll('#detail-view-content img').forEach(img => {
    if (img.observer) img.observer.disconnect();
  });
  const block = STATE.allFetchedBlocks.find(b => b.id.toString() === blockId);
  if (!block) {
    console.error("找不到对应的 block 数据:", blockId);
    return;
  }
  const detailContent = document.getElementById('detail-view-content');
  detailContent.innerHTML = '';
  document.getElementById('detail-view-link').innerHTML = '';
  document.getElementById('detail-view-info').innerHTML = '';
  document.getElementById('detail-view-meta').innerHTML = '';
  const titleElement = document.getElementById('detail-view-title');
  titleElement.textContent = block.title || (block.class === 'Link' ? 'Link' : 'Block Details');
  titleElement.title = block.title || (block.class === 'Link' ? 'Link' : 'Block Details');
  const arenaLinkElement = document.getElementById('detail-view-arena-link');

  if (block.class === 'Channel') {
    detailContent.innerHTML = '<div style="padding: 20px;">Loading channel details...</div>';
    document.getElementById('detail-view').style.display = 'flex';

    try {
      const response = await fetch(`https://api.are.na/v2/channels/${block.slug}`);
      if (!response.ok) throw new Error('Failed to fetch channel details');
      const channelData = await response.json();
      
      detailContent.innerHTML = '';

      const contentWrapper = document.createElement('div');
      contentWrapper.id = 'channel-detail-container';

      const basicInfo = document.createElement('div');
      basicInfo.id = 'channel-basic-info';

      const textInfo = document.createElement('div');
      textInfo.id = 'channel-text-info';

      if (channelData.metadata && channelData.metadata.description) {
        const description = document.createElement('div');
        description.id = 'channel-description';
        description.innerHTML = channelData.metadata.description;
        textInfo.appendChild(description);
      }

      if (channelData.user) {
        const authorInfo = document.createElement('div');
        authorInfo.textContent = 'Channel Author: ';
        const authorName = document.createElement('a');
        authorName.href = `https://are.na/${channelData.user.slug}`;
        authorName.target = '_blank';
        authorName.textContent = channelData.user.full_name;
        authorInfo.appendChild(authorName);
        textInfo.appendChild(authorInfo);
      }

      const stats = document.createElement('div');
      stats.id = 'channel-stats';
      stats.innerHTML = `
        <div>Blocks: ${channelData.length || 0}</div>
        <div>Followers: ${channelData.follower_count || 0}</div>
      `;
      textInfo.appendChild(stats);

      if (channelData.created_at) {
        const dates = document.createElement('div');
        dates.id = 'channel-dates';
        const created = new Date(channelData.created_at).toLocaleDateString();
        const updated = channelData.updated_at ? new Date(channelData.updated_at).toLocaleDateString() : created;
        dates.innerHTML = `
          <div>Created: ${created}</div>
          <div>Updated: ${updated}</div>
        `;
        textInfo.appendChild(dates);
      }

      const status = document.createElement('div');
      status.id = 'channel-status';
      const statusText = {
        'public': 'Public',
        'closed': 'Closed',
        'private': 'Private'
      }[channelData.status] || 'Public';
      status.innerHTML = `
        <div>Status: ${statusText}</div>
        <div>${channelData.open ? 'Open' : 'Closed'} Collaboration</div>
      `;
      textInfo.appendChild(status);

      const goToChannelButton = document.createElement('button');
      goToChannelButton.id = 'channel-goto-button';
      goToChannelButton.textContent = 'Go to Channel';
      goToChannelButton.addEventListener('click', function() {
        closeDetailView();
        router.navigate(channelData.slug);
      });
      textInfo.appendChild(goToChannelButton);

      if (channelData.image) {
        const coverWrapper = document.createElement('div');
        coverWrapper.id = 'channel-cover-wrapper';
        
        const cover = document.createElement('img');
        cover.id = 'channel-cover-image';
        cover.src = channelData.image.display.url;
        cover.alt = `${channelData.title} channel cover`;
        
        // Only load high-res cover on desktop
        if (!isMobileDevice() && channelData.image.original) {
          const originalImg = new Image();
          originalImg.onload = () => {
            if (cover.isConnected) {
              cover.src = originalImg.src;
            }
          };
          originalImg.onerror = () => {
            console.warn('Failed to load original channel cover image');
          };
          originalImg.src = channelData.image.original.url;
        }
        
        coverWrapper.appendChild(cover);
        basicInfo.appendChild(coverWrapper);
      }

      basicInfo.insertBefore(textInfo, basicInfo.firstChild);
      contentWrapper.appendChild(basicInfo);
      detailContent.appendChild(contentWrapper);

      const blockPageUrl = `https://www.are.na/block/${block.id}`;
      if (block.description_html) {
        addMetaItem('Description', block.description_html, null, true);
      }
      if (block.connected_at) {
        addMetaItem('Connected At', new Date(block.connected_at).toLocaleString(), null);
      }
      if (block.connected_by_username) {
        const userPageUrl = `https://www.are.na/${block.connected_by_user_slug}`;
        addMetaItem('Connected By', block.connected_by_username, userPageUrl, false);
      }

      arenaLinkElement.href = blockPageUrl;

    } catch (error) {
      console.error('Error fetching channel details:', error);
      detailContent.innerHTML = '<div style="padding: 20px;">Failed to load channel details</div>';
    }
  } else {
    arenaLinkElement.href = `https://www.are.na/block/${block.id}`;
    if (block.image) {
      const isMobile = isMobileDevice();
      const img = document.createElement('img');
      
      // Start with display version for faster initial load
      img.src = block.image.display.url;
      
      // Set reasonable size constraints for mobile
      if (isMobile) {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      } else {
        const originalWidth = block.image.original.width || block.image.display.width * 5;
        const originalHeight = block.image.original.height || block.image.display.height * 5;
        img.style.width = `${originalWidth}px`;
        img.style.height = `${originalHeight}px`;
      }
      
      img.alt = block.title || 'Image';
      detailContent.appendChild(img);
      
      // For mobile, we may want to stick with the display version to save memory
      // For desktop, load the original high-quality version
      if (!isMobile && block.image.original && block.image.original.url) {
        const originalImg = new Image();
        originalImg.onload = () => {
          if (img.isConnected) { // Check if the image is still in the DOM
            img.src = originalImg.src;
            if (!isMobile) {
              img.style.width = '';
              img.style.height = '';
            }
          }
        };
        originalImg.onerror = () => {
          console.warn('Failed to load original image, keeping display version');
        };
        originalImg.src = block.image.original.url;
      }
    }
    if (block.class && block.class.toLowerCase() === 'text') {
      if (block.content_html) {
        const text = document.createElement('div');
        text.innerHTML = block.content_html;
        detailContent.appendChild(text);
      } else if (block.title) {
        const title = document.createElement('div');
        title.innerHTML = block.title;
        detailContent.appendChild(title);
      }
    }
    const blockPageUrl = `https://www.are.na/block/${block.id}`;
    if (block.description_html) addMetaItem('Description', block.description_html, null, true);
    if (block.id) addMetaItem('Block ID', block.id, blockPageUrl);
    if (block.connected_at) addMetaItem('Connected At', new Date(block.connected_at).toLocaleString(), null);
    if (block.connected_by_username) {
      const userPageUrl = `https://www.are.na/${block.connected_by_user_slug}`;
      addMetaItem('Connected By', block.connected_by_username, userPageUrl, false);
    }
    if (block.source && block.source.url) {
      addMetaItem('Source', block.source.title, block.source.url, false);
    }
  }

  document.getElementById('detail-view').style.display = 'flex';
}

// Initialize application
async function main() {
  initHeaderBar();
  router.init();
  
  try {
    await arenaDB.clearOldCache();
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }
  
  // Add unload event handler to clean up resources
  window.addEventListener('beforeunload', () => {
    if (STATE.memoryMonitorId) {
      clearInterval(STATE.memoryMonitorId);
    }
    if (STATE.loadIntervalId) {
      clearInterval(STATE.loadIntervalId);
    }
    
    // Clean up any active observers
    document.querySelectorAll('.block').forEach(block => {
      if (block._imageObserver) {
        block._imageObserver.disconnect();
      }
    });
  });
}

main();
