// Block Manipulation Functions
function temporaryRaiseBlock(element) {
  if (!element._tempRaised) {
    element.style.zIndex = "2";
    element._tempRaised = true;
    element._raiseTimer = setTimeout(() => {
      commitRaiseBlock(element);
    }, CONFIG.doubleClickDelay);
  }
}

function commitRaiseBlock(element) {
  if (element._raiseTimer) {
    clearTimeout(element._raiseTimer);
    element._raiseTimer = null;
  }
  element.parentElement.appendChild(element);
  element.style.zIndex = "";
  element._tempRaised = false;

  const slug = STATE.channelSlugs[0];
  const newOrder = Array.from(document.querySelectorAll('.block')).map(el => el.dataset.blockId);
  STATE.cachedBlockOrder = newOrder;
  
  arenaDB.getChannel(slug).then(cachedData => {
    if (cachedData) {
      cachedData.order = newOrder;
      return arenaDB.saveChannel(slug, cachedData.data);
    }
  }).catch(error => {
    console.error('Error updating block order in cache:', error);
  });
}

function handleTouchEnd(event) {
  const now = Date.now();
  if (now - STATE.lastTouchEnd < CONFIG.doubleClickDelay) {
    commitRaiseBlock(event.currentTarget);
    showDetailView(event);
  } else {
    temporaryRaiseBlock(event.currentTarget);
  }
  STATE.lastTouchEnd = now;
}

function handleWheelRotation(event) {
  const block = event.currentTarget;
  let currentRotation = 0;
  const transform = block.style.transform;
  const match = transform.match(/rotate\(([^)]+)\)/);
  if (match) currentRotation = parseFloat(match[1]);
  const delta = Math.sign(event.deltaY);
  const rotationStep = 5;
  const newRotation = currentRotation + delta * rotationStep;
  const x = getTranslateXValue(block);
  const y = getTranslateYValue(block);
  block.style.transform = `translate(${x}px, ${y}px) rotate(${newRotation}deg)`;
  
  updateBlockPosition(block, x, y, newRotation);
  
  event.preventDefault();
}

function makeDraggable(element) {
  let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
  let isDragging = false, lastMoveTime = 0;
  const throttleInterval = 25, dragThreshold = 5;

  // 共用的保存位置更新函数
  function saveBlockPosition() {
    if (isDragging) {
      const x = getTranslateXValue(element);
      const y = getTranslateYValue(element);
      const rotationMatch = element.style.transform.match(/rotate\(([^)]+)\)/);
      const rotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;

      STATE.cachedBlockPositions[element.dataset.blockId] = { x, y, rotation };
      
      const blockIdToMove = element.dataset.blockId;
      const index = STATE.cachedBlockOrder.indexOf(blockIdToMove);
      if (index > -1) {
        STATE.cachedBlockOrder.splice(index, 1);
        STATE.cachedBlockOrder.push(blockIdToMove);
      }
      
      // 批量存储以减少本地存储写入
      requestAnimationFrame(() => {
        arenaDB.getChannel(STATE.channelSlugs[0]).then(cachedData => {
          if (cachedData) {
            cachedData.positions = STATE.cachedBlockPositions;
            cachedData.order = STATE.cachedBlockOrder;
            return arenaDB.saveChannel(STATE.channelSlugs[0], cachedData.data);
          }
        }).catch(error => {
          console.error('Error updating block positions in cache:', error);
        });
      });
    }
    isDragging = false;
    startX = 0; startY = 0;
    element.classList.remove('dragging');
  }

  // 共用的处理移动函数
  function handleMove(pageX, pageY) {
    if (startX === 0 && startY === 0) return;
    const dx = pageX - startX, dy = pageY - startY;
    if (!isDragging && Math.sqrt(dx*dx + dy*dy) > dragThreshold) {
      isDragging = true;
      element.classList.add('dragging');
      commitRaiseBlock(element);
    }
    if (!isDragging) return;
    const now = Date.now();
    if (now - lastMoveTime < throttleInterval) return;
    lastMoveTime = now;
    let x = pageX - offsetX, y = pageY - offsetY;
    const blockWidth = element.offsetWidth, blockHeight = element.offsetHeight;
    const minX = -blockWidth/2, minY = -blockHeight/2;
    const maxX = window.innerWidth - blockWidth/2, maxY = window.innerHeight - blockHeight/2 - 30;
    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);
    const rotationMatch = element.style.transform.match(/rotate\(([^)]+)\)/);
    const currentRotation = rotationMatch ? `rotate(${rotationMatch[1]})` : '';
    element.style.transform = `translate(${x}px, ${y}px) ${currentRotation}`;
  }

  // 鼠标事件处理
  element.addEventListener('mousedown', (e) => {
    startX = e.pageX; startY = e.pageY;
    offsetX = e.pageX - getTranslateXValue(element);
    offsetY = e.pageY - getTranslateYValue(element);
    temporaryRaiseBlock(element);
  });

  document.addEventListener('mousemove', (e) => {
    handleMove(e.pageX, e.pageY);
  });

  document.addEventListener('mouseup', saveBlockPosition);

  // 触摸事件处理
  element.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.pageX; startY = touch.pageY;
    offsetX = touch.pageX - getTranslateXValue(element);
    offsetY = touch.pageY - getTranslateYValue(element);
    temporaryRaiseBlock(element);
  });

  element.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    handleMove(touch.pageX, touch.pageY);
    e.preventDefault();
  });

  element.addEventListener('touchend', (e) => {
    saveBlockPosition();
    if (e.cancelable) {
      e.preventDefault();
    }
  });
}

function renderBlock(block) {
  // 创建块元素
  const blockElement = document.createElement('div');
  blockElement.classList.add('block');
  blockElement.dataset.blockId = block.id;

  // 添加事件监听器
  if (!('ontouchstart' in window)) {
    // 桌面设备事件
    blockElement.addEventListener('click', (e) => temporaryRaiseBlock(e.currentTarget));
    blockElement.addEventListener('dblclick', (e) => {
      commitRaiseBlock(e.currentTarget);
      showDetailView(e);
    });
  } else {
    // 触摸设备事件
    blockElement.addEventListener('touchend', handleTouchEnd);
  }
  
  // 添加滚轮旋转事件
  blockElement.addEventListener('wheel', handleWheelRotation);
  
  // 根据块类型渲染不同内容
  if (block.class === 'Channel') {
    renderChannelBlock(blockElement, block);
  } else if (block.image) {
    renderImageBlock(blockElement, block);
  } else if (block.class === 'Link') {
    renderLinkBlock(blockElement, block);
  }
  
  // 处理文本内容
  if (block.class && block.class.toLowerCase() === 'text') {
    renderTextBlock(blockElement, block);
  }
  
  // 添加到DOM
  document.body.appendChild(blockElement);
  
  // 使块可拖动
  makeDraggable(blockElement);
  
  return blockElement;
}

// 渲染频道块
function renderChannelBlock(element, block) {
  element.classList.add('channel-block');
  
  // 创建头部
  const header = document.createElement('div');
  header.className = 'channel-header';
  header.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 8" fill="none">
      <path d="M12.8745 5.60598L11.0723 4.13301C10.962 4.04311 10.962 3.89549 11.0723 3.80532L12.8745 2.33271C12.9852 2.24262 13.0314 2.09042 12.9774 1.99467C12.9233 1.8992 12.7722 1.86521 12.642 1.91915L10.499 2.80685C10.3687 2.86134 10.246 2.78708 10.2265 2.64233L9.90419 0.263056C9.88431 0.118402 9.77971 0 9.67139 0C9.56359 0 9.45908 0.118402 9.43972 0.262966L9.11728 2.64242C9.09757 2.78717 8.97499 2.86125 8.84454 2.80694L6.737 1.93399C6.6063 1.87987 6.39338 1.87987 6.26302 1.93399L4.15514 2.80694C4.02478 2.86125 3.90203 2.78717 3.88249 2.64242L3.56048 0.262966C3.5406 0.118402 3.43617 0 3.32829 0C3.22006 0 3.11538 0.118402 3.09593 0.262966L2.77348 2.64242C2.75395 2.78717 2.63128 2.86125 2.50092 2.80694L0.358028 1.91942C0.227755 1.86521 0.076908 1.89938 0.0227932 1.99476C-0.0312351 2.0906 0.0148402 2.24289 0.125145 2.3328L1.92753 3.80541C2.03792 3.89558 2.03792 4.0432 1.92753 4.13319L0.125145 5.60598C0.0144945 5.69606 -0.0313216 5.85735 0.0226203 5.96415C0.0768216 6.07114 0.227669 6.11411 0.357769 6.05981L2.48147 5.17283C2.612 5.11862 2.73337 5.19243 2.75161 5.33717L3.05798 7.73721C3.07648 7.88169 3.19784 8 3.32769 8C3.45735 8 3.57881 7.88178 3.5974 7.73721L3.90428 5.33717C3.92243 5.19243 4.04432 5.1187 4.17416 5.17283L6.26302 6.0447C6.39321 6.09918 6.60621 6.09918 6.73649 6.0447L8.82501 5.17283C8.95502 5.11862 9.07656 5.19243 9.09515 5.33717L9.40203 7.73721C9.42035 7.88169 9.54181 8 9.67131 8C9.80115 8 9.9226 7.88178 9.94102 7.73721L10.2479 5.33717C10.2666 5.19243 10.3879 5.1187 10.518 5.17283L12.6419 6.05981C12.7716 6.11411 12.9229 6.07105 12.977 5.96424C13.0312 5.85762 12.9851 5.69633 12.8745 5.60625L12.8745 5.60598ZM8.28939 4.15171L6.70225 5.42249C6.59117 5.51149 6.40894 5.51149 6.29821 5.42249L4.71055 4.15171C4.59956 4.06271 4.59869 3.91617 4.70882 3.82581L6.29942 2.52285C6.40955 2.4325 6.59013 2.4325 6.70035 2.52285L8.29095 3.82581C8.40134 3.91608 8.40047 4.06262 8.28922 4.1518L8.28939 4.15171Z"/>
    </svg>
    Connected Channel
  `;
  element.appendChild(header);

  // 创建标题
  const titleElement = document.createElement('h2');
  titleElement.textContent = block.title;
  element.appendChild(titleElement);
}

// 渲染图片块
function renderImageBlock(element, block) {
  // Add image-block class to help with styling
  element.classList.add('image-block');
  
  // Create placeholder that will be shown until image loads
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  element.appendChild(placeholder);
  
  const img = document.createElement('img');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Hide image initially until it loads
  img.style.display = 'none';
  
  // 设置初始尺寸和缩略图
  if (block.image.thumb) {
    img.style.width = block.image.thumb.width + 'px';
    img.style.height = block.image.thumb.height + 'px';
    img.src = block.image.thumb.url;
  }
  
  img.draggable = false;
  element.appendChild(img);
  
  // When any version of the image loads, show it and hide placeholder
  img.onload = function() {
    img.style.display = 'block';
    placeholder.style.display = 'none';
  };
  
  // 使用 IntersectionObserver 进行懒加载
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // 只有当块可见时才加载高分辨率图片
          loadHigherQualityImage();
          observer.disconnect();
        }
      });
    }, {
      rootMargin: '100px', // 提前100px开始加载
      threshold: 0.1 // 当10%的元素可见时
    });
    
    observer.observe(element);
    element._imageObserver = observer; // 保存引用以便稍后清理
  } else {
    // 回退到直接加载（旧浏览器）
    loadHigherQualityImage();
  }
  
  function loadHigherQualityImage() {
    if (block.image.display && block.image.display.url) {
      // 针对移动设备选择合适的图像
      let targetSrc = block.image.display.url;
      
      // 如果是移动设备且存在缩略图，考虑使用中等大小的图像而非原图
      if (isMobile && block.image.large && block.image.large.url) {
        targetSrc = block.image.large.url;
      } else if (isMobile && !block.image.large && block.image.display) {
        // 如果没有large但有display，使用display
        targetSrc = block.image.display.url;
      }
      
      const displayImg = new Image();
      
      // 设置错误处理，确保加载失败时不会导致应用崩溃
      displayImg.onerror = () => {
        console.warn(`Failed to load image: ${targetSrc}, keeping thumbnail`);
        // 保持缩略图，确保不会尝试加载失败的图像
      };
      
      displayImg.onload = () => {
        // 检查元素是否仍在DOM中（可能已被删除）
        if (element.isConnected && img.isConnected) {
          img.src = displayImg.src;
          img.style.width = '';
          img.style.height = '';
        }
      };
      
      displayImg.src = targetSrc;
    }
  }
}

// 渲染链接块
function renderLinkBlock(element, block) {
  const link = document.createElement('div');
  link.textContent = block.title || 'Link';
  link.style.color = 'var(--link-color)';
  element.appendChild(link);
}

// 渲染文本块
function renderTextBlock(element, block) {
  if (block.content_html) {
    const text = document.createElement('div');
    text.innerHTML = block.content_html;
    element.appendChild(text);
  } else if (block.title) {
    const title = document.createElement('div');
    title.innerHTML = block.title;
    element.appendChild(title);
  }
}

// 添加更新块位置的共用函数
function updateBlockPosition(block, x, y, rotation) {
  const blockId = block.dataset.blockId;
  STATE.cachedBlockPositions[blockId] = { x, y, rotation };
  
  // 使用防抖或节流来减少存储操作
  if (STATE._savePositionTimeout) {
    clearTimeout(STATE._savePositionTimeout);
  }
  
  STATE._savePositionTimeout = setTimeout(() => {
    const slug = STATE.channelSlugs[0];
    arenaDB.getChannel(slug).then(cachedData => {
      if (cachedData) {
        cachedData.positions = STATE.cachedBlockPositions;
        return arenaDB.saveChannel(slug, cachedData.data);
      }
    }).catch(error => {
      console.error('Error updating block positions in cache:', error);
    });
  }, 1000); // 1秒延迟，避免频繁写入
}

function loadMoreBlocks() {
  if (STATE.isLoading) return;
  STATE.isLoading = true;
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
    blocksToRender = STATE.cachedBlockOrder.slice(STATE.currentlyDisplayedBlocks, STATE.currentlyDisplayedBlocks + CONFIG.blocksPerLoad)
      .map(blockId => STATE.allFetchedBlocks.find(block => block.id === blockId))
      .filter(block => block);
  }
  blocksToRender.forEach(block => {
    const blockElement = renderBlock(block);
    if (STATE.cachedBlockPositions[block.id]) {
      const pos = STATE.cachedBlockPositions[block.id];
      blockElement.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg)`;
    }
  });
  
  STATE.currentlyDisplayedBlocks += blocksToRender.length;
  
  if (STATE.currentlyDisplayedBlocks >= STATE.allFetchedBlocks.length) {
    outputLog(`[loadMoreBlocks] All blocks loaded: ${STATE.currentlyDisplayedBlocks}`);
    clearInterval(STATE.loadIntervalId);
    STATE.loadIntervalId = null;
  }
  
  STATE.isLoading = false;
}

const handleResize = throttle(() => {
  // 获取视口边界
  const viewport = {
    minX: 0,
    minY: 0,
    maxX: window.innerWidth,
    maxY: window.innerHeight - 30
  };
  
  // 使用DocumentFragment减少DOM重绘
  const blocks = document.querySelectorAll('.block');
  
  // 批量处理所有块的位置调整
  blocks.forEach(block => {
    const blockWidth = block.offsetWidth;
    const blockHeight = block.offsetHeight;
    
    // 计算边界
    const bounds = {
      minX: -blockWidth/2,
      minY: -blockHeight/2,
      maxX: viewport.maxX - blockWidth/2,
      maxY: viewport.maxY - blockHeight/2
    };
    
    // 获取当前位置
    let x = getTranslateXValue(block);
    let y = getTranslateYValue(block);
    
    // 确保在边界内
    x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
    y = Math.min(Math.max(y, bounds.minY), bounds.maxY);
    
    // 保持旋转角度不变
    const currentRotation = (block.style.transform.match(/rotate\(([^)]+)\)/) || ['','0deg'])[1];
    
    // 更新变换
    block.style.transform = `translate(${x}px, ${y}px) rotate(${currentRotation})`;
    
    // 更新缓存的位置
    const blockId = block.dataset.blockId;
    if (blockId && STATE.cachedBlockPositions[blockId]) {
      STATE.cachedBlockPositions[blockId].x = x;
      STATE.cachedBlockPositions[blockId].y = y;
    }
  });
  
  // 延迟保存位置到数据库
  if (STATE._resizePositionTimeout) {
    clearTimeout(STATE._resizePositionTimeout);
  }
  
  STATE._resizePositionTimeout = setTimeout(() => {
    const slug = STATE.channelSlugs[0];
    arenaDB.getChannel(slug).then(cachedData => {
      if (cachedData) {
        cachedData.positions = STATE.cachedBlockPositions;
        return arenaDB.saveChannel(slug, cachedData.data);
      }
    }).catch(error => {
      console.error('Error updating positions after resize:', error);
    });
  }, 1000);
}, 100);

window.addEventListener('resize', handleResize);
