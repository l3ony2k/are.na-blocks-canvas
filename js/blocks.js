// Prioritized image loader for DOM layout modes (mix/tile). Instead of firing
// hundreds of requests at once, loads run through a small concurrent queue
// ordered by distance from the viewport center, so what the user is looking
// at fills in first. High-res upgrades are deprioritized behind thumbnails.
const IMAGE_LOAD_QUEUE = {
  pending: [],
  active: 0,
  maxConcurrent: 10,
  dirty: false,
  scheduled: false
};

function queueImageLoad(entry) {
  IMAGE_LOAD_QUEUE.pending.push(entry);
  IMAGE_LOAD_QUEUE.dirty = true;
  scheduleImageQueuePump();
}

// Call when block positions change (tile/shuffle) so pending loads re-sort.
function reprioritizeImageQueue() {
  if (IMAGE_LOAD_QUEUE.pending.length === 0) {
    return;
  }
  IMAGE_LOAD_QUEUE.dirty = true;
  scheduleImageQueuePump();
}

function scheduleImageQueuePump() {
  if (IMAGE_LOAD_QUEUE.scheduled) {
    return;
  }
  IMAGE_LOAD_QUEUE.scheduled = true;
  requestAnimationFrame(() => {
    IMAGE_LOAD_QUEUE.scheduled = false;
    pumpImageQueue();
  });
}

function imageLoadPriority(entry) {
  const rect = entry.element.getBoundingClientRect();
  const dx = rect.left + rect.width / 2 - window.innerWidth / 2;
  const dy = rect.top + rect.height / 2 - window.innerHeight / 2;
  const offscreen = rect.bottom < 0 || rect.right < 0 ||
    rect.top > window.innerHeight || rect.left > window.innerWidth;
  return Math.hypot(dx, dy) + (entry.upgrade ? 500000 : 0) + (offscreen ? 1000000 : 0);
}

function pumpImageQueue() {
  const queue = IMAGE_LOAD_QUEUE;
  if (queue.active >= queue.maxConcurrent || queue.pending.length === 0) {
    return;
  }

  if (queue.dirty) {
    queue.pending = queue.pending.filter(entry => entry.element.isConnected && entry.img.isConnected);
    queue.pending.forEach(entry => {
      entry.priority = imageLoadPriority(entry);
    });
    // Sorted descending so pop() takes the closest-to-center entry.
    queue.pending.sort((a, b) => b.priority - a.priority);
    queue.dirty = false;
  }

  while (queue.active < queue.maxConcurrent && queue.pending.length > 0) {
    const entry = queue.pending.pop();
    if (!entry.element.isConnected || !entry.img.isConnected) {
      continue;
    }

    queue.active += 1;
    const finish = () => {
      queue.active -= 1;
      pumpImageQueue();
    };

    if (entry.upgrade) {
      const loader = new Image();
      loader.onload = () => {
        if (entry.img.isConnected && (!entry.validate || entry.validate())) {
          entry.img.src = loader.src;
        }
        finish();
      };
      loader.onerror = () => {
        console.warn(`Failed to load image: ${entry.url}`);
        finish();
      };
      loader.src = entry.url;
    } else {
      entry.img.addEventListener('load', finish, { once: true });
      entry.img.addEventListener('error', finish, { once: true });
      entry.img.src = entry.url;
    }
  }
}

function temporaryRaiseBlock(element) {
  if (!element._tempRaised) {
    element.style.zIndex = '2';
    element._tempRaised = true;
    element._raiseTimer = setTimeout(() => {
      commitRaiseBlock(element);
    }, CONFIG.doubleClickDelay);
  }
}

function commitRaiseBlock(element) {
  if (STATE.layoutMode === 'flow' || element.dataset.flowInstance) {
    if (element._raiseTimer) {
      clearTimeout(element._raiseTimer);
      element._raiseTimer = null;
    }
    element.style.zIndex = '';
    element._tempRaised = false;
    return;
  }

  if (element._raiseTimer) {
    clearTimeout(element._raiseTimer);
    element._raiseTimer = null;
  }

  element.parentElement.appendChild(element);
  element.style.zIndex = '';
  element._tempRaised = false;

  const newOrder = Array.from(document.querySelectorAll('.block:not([data-flow-instance])')).map(el => el.dataset.blockId);
  STATE.cachedBlockOrder = newOrder;
  schedulePositionCacheSave();
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
  if (STATE.layoutMode === 'flow') {
    return;
  }

  const block = event.currentTarget;
  let currentRotation = 0;
  const transform = block.style.transform;
  const match = transform.match(/rotate\(([^)]+)\)/);

  if (match) {
    currentRotation = parseFloat(match[1]);
  }

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
  if (element.dataset.flowInstance) {
    return;
  }

  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let lastMoveTime = 0;
  const throttleInterval = 25;
  const dragThreshold = 5;

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

      schedulePositionCacheSave();
    }

    isDragging = false;
    startX = 0;
    startY = 0;
    element.classList.remove('dragging');
  }

  function handleMove(pageX, pageY) {
    if (startX === 0 && startY === 0) {
      return;
    }

    const dx = pageX - startX;
    const dy = pageY - startY;

    if (!isDragging && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
      isDragging = true;
      element.classList.add('dragging');
      commitRaiseBlock(element);
    }

    if (!isDragging) {
      return;
    }

    const now = Date.now();
    if (now - lastMoveTime < throttleInterval) {
      return;
    }
    lastMoveTime = now;

    let x = pageX - offsetX;
    let y = pageY - offsetY;
    const blockWidth = element.offsetWidth;
    const blockHeight = element.offsetHeight;
    const minX = -blockWidth / 2;
    const minY = -blockHeight / 2;
    const maxX = window.innerWidth - blockWidth / 2;
    const maxY = window.innerHeight - blockHeight / 2 - 30;

    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);

    const rotationMatch = element.style.transform.match(/rotate\(([^)]+)\)/);
    const currentRotation = rotationMatch ? `rotate(${rotationMatch[1]})` : '';
    element.style.transform = `translate(${x}px, ${y}px) ${currentRotation}`;
  }

  element.addEventListener('mousedown', event => {
    startX = event.pageX;
    startY = event.pageY;
    offsetX = event.pageX - getTranslateXValue(element);
    offsetY = event.pageY - getTranslateYValue(element);
    temporaryRaiseBlock(element);
  });

  document.addEventListener('mousemove', event => {
    handleMove(event.pageX, event.pageY);
  });

  document.addEventListener('mouseup', saveBlockPosition);

  element.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    startX = touch.pageX;
    startY = touch.pageY;
    offsetX = touch.pageX - getTranslateXValue(element);
    offsetY = touch.pageY - getTranslateYValue(element);
    temporaryRaiseBlock(element);
  });

  element.addEventListener('touchmove', event => {
    const touch = event.touches[0];
    handleMove(touch.pageX, touch.pageY);
    event.preventDefault();
  });

  element.addEventListener('touchend', event => {
    saveBlockPosition();
    if (event.cancelable) {
      event.preventDefault();
    }
  });
}

function renderBlock(block) {
  return createBlockElement(block, {
    appendToDocument: true,
    draggable: true,
    wheelRotation: true
  });
}

function createBlockElement(block, options = {}) {
  const settings = {
    appendToDocument: true,
    draggable: true,
    wheelRotation: true,
    flowInstance: false,
    instanceKey: '',
    ...options
  };

  const blockElement = document.createElement('div');
  blockElement.classList.add('block');
  if (settings.flowInstance) {
    blockElement.dataset.flowInstance = settings.instanceKey || String(block.id);
    blockElement.classList.add('flow-block');
  }

  if (!('ontouchstart' in window)) {
    blockElement.addEventListener('click', event => temporaryRaiseBlock(event.currentTarget));
    blockElement.addEventListener('dblclick', event => {
      commitRaiseBlock(event.currentTarget);
      showDetailView(event);
    });
  } else {
    blockElement.addEventListener('touchend', handleTouchEnd);
  }

  if (settings.wheelRotation) {
    blockElement.addEventListener('wheel', handleWheelRotation);
  }

  bindBlockElement(blockElement, block);

  if (settings.appendToDocument) {
    document.body.appendChild(blockElement);
  }
  if (settings.draggable) {
    makeDraggable(blockElement);
  }

  return blockElement;
}

function bindBlockElement(element, block) {
  if (element._imageObserver) {
    element._imageObserver.disconnect();
    element._imageObserver = null;
  }

  element.replaceChildren();
  element.className = element.dataset.flowInstance ? 'block flow-block' : 'block';
  element.dataset.blockId = block.id;
  element.dataset.blockKind = block.kind;

  switch (block.kind) {
    case 'channel':
      renderChannelBlock(element, block);
      break;
    case 'image':
      renderImageBlock(element, block);
      break;
    case 'text':
      renderTextBlock(element, block);
      break;
    case 'link':
      renderLinkBlock(element, block);
      break;
    case 'attachment':
      renderAttachmentBlock(element, block);
      break;
    case 'embed':
      renderEmbedBlock(element, block);
      break;
    default:
      renderFallbackBlock(element, block);
      break;
  }
}

function renderChannelBlock(element, block) {
  element.classList.add('channel-block');

  // All channel blocks are colored by visibility (green open / red private /
  // plain closed) — the layout itself already says "this is a channel".
  // User-view channels additionally spell the visibility out in the header.
  const visibilityClass = {
    public: 'channel-vis-public',
    private: 'channel-vis-private',
    closed: 'channel-vis-closed'
  }[block.visibility] || 'channel-vis-closed';
  element.classList.add(visibilityClass);

  let headerText = 'Connected Channel';
  if (block.displayVariant === 'user-channel') {
    headerText = {
      public: 'Open Channel',
      private: 'Private Channel',
      closed: 'Closed Channel'
    }[block.visibility] || 'Channel';
  }

  const header = document.createElement('div');
  header.className = 'channel-header';
  header.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 8" fill="none">
      <path d="M12.8745 5.60598L11.0723 4.13301C10.962 4.04311 10.962 3.89549 11.0723 3.80532L12.8745 2.33271C12.9852 2.24262 13.0314 2.09042 12.9774 1.99467C12.9233 1.8992 12.7722 1.86521 12.642 1.91915L10.499 2.80685C10.3687 2.86134 10.246 2.78708 10.2265 2.64233L9.90419 0.263056C9.88431 0.118402 9.77971 0 9.67139 0C9.56359 0 9.45908 0.118402 9.43972 0.262966L9.11728 2.64242C9.09757 2.78717 8.97499 2.86125 8.84454 2.80694L6.737 1.93399C6.6063 1.87987 6.39338 1.87987 6.26302 1.93399L4.15514 2.80694C4.02478 2.86125 3.90203 2.78717 3.88249 2.64242L3.56048 0.262966C3.5406 0.118402 3.43617 0 3.32829 0C3.22006 0 3.11538 0.118402 3.09593 0.262966L2.77348 2.64242C2.75395 2.78717 2.63128 2.86125 2.50092 2.80694L0.358028 1.91942C0.227755 1.86521 0.076908 1.89938 0.0227932 1.99476C-0.0312351 2.0906 0.0148402 2.24289 0.125145 2.3328L1.92753 3.80541C2.03792 3.89558 2.03792 4.0432 1.92753 4.13319L0.125145 5.60598C0.0144945 5.69606 -0.0313216 5.85735 0.0226203 5.96415C0.0768216 6.07114 0.227669 6.11411 0.357769 6.05981L2.48147 5.17283C2.612 5.11862 2.73337 5.19243 2.75161 5.33717L3.05798 7.73721C3.07648 7.88169 3.19784 8 3.32769 8C3.45735 8 3.57881 7.88178 3.5974 7.73721L3.90428 5.33717C3.92243 5.19243 4.04432 5.1187 4.17416 5.17283L6.26302 6.0447C6.39321 6.09918 6.60621 6.09918 6.73649 6.0447L8.82501 5.17283C8.95502 5.11862 9.07656 5.19243 9.09515 5.33717L9.40203 7.73721C9.42035 7.88169 9.54181 8 9.67131 8C9.80115 8 9.9226 7.88178 9.94102 7.73721L10.2479 5.33717C10.2666 5.19243 10.3879 5.1187 10.518 5.17283L12.6419 6.05981C12.7716 6.11411 12.9229 6.07105 12.977 5.96424C13.0312 5.85762 12.9851 5.69633 12.8745 5.60625L12.8745 5.60598ZM8.28939 4.15171L6.70225 5.42249C6.59117 5.51149 6.40894 5.51149 6.29821 5.42249L4.71055 4.15171C4.59956 4.06271 4.59869 3.91617 4.70882 3.82581L6.29942 2.52285C6.40955 2.4325 6.59013 2.4325 6.70035 2.52285L8.29095 3.82581C8.40134 3.91608 8.40047 4.06262 8.28922 4.1518L8.28939 4.15171Z"/>
    </svg>
    ${headerText}
  `;
  element.appendChild(header);

  const titleElement = document.createElement('h2');
  titleElement.textContent = block.title || 'Untitled Channel';
  element.appendChild(titleElement);
}

function appendPreviewImage(element, block, options = {}) {
  const versions = block.imageVersions;
  if (!versions) {
    return null;
  }

  element.classList.add('preview-image-block');
  const imageToken = `${block.id}:${Date.now()}:${Math.random()}`;
  element._imageToken = imageToken;

  const initialVersion = versions.thumb || versions.preview || versions.display || versions.large || versions.original;
  const ratioSource = versions.original || versions.large || versions.display || initialVersion;
  const ratioWidth = versions.width || ratioSource?.width || initialVersion?.width;
  const ratioHeight = versions.height || ratioSource?.height || initialVersion?.height;
  const shouldUseObserver = options.useObserver !== false;

  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  if (ratioWidth && ratioHeight) {
    placeholder.style.aspectRatio = `${ratioWidth} / ${ratioHeight}`;
    placeholder.style.height = 'auto';
  }
  element.appendChild(placeholder);

  const img = document.createElement('img');
  img.style.display = 'none';
  img.draggable = false;

  if (initialVersion?.url) {
    if (ratioWidth) {
      img.width = ratioWidth;
    }
    if (ratioHeight) {
      img.height = ratioHeight;
    }
    if (ratioWidth && ratioHeight) {
      img.style.aspectRatio = `${ratioWidth} / ${ratioHeight}`;
    }
  }

  img.onload = () => {
    if (element._imageToken !== imageToken) {
      return;
    }
    if (element.dataset.flowInstance && img.naturalWidth && img.naturalHeight) {
      updateFlowImageMeasurement(block, img.naturalWidth, img.naturalHeight);
    }
    img.style.display = 'block';
    placeholder.style.display = 'none';
  };

  element.appendChild(img);

  if (initialVersion?.url) {
    if (element.dataset.flowInstance) {
      // Flow DOM instances are pooled/recycled; load immediately.
      img.src = initialVersion.url;
    } else {
      queueImageLoad({ element, img, url: initialVersion.url, upgrade: false });
    }
  }

  function loadHigherQualityImage() {
    const isMobile = isMobileDevice();
    const targetVersion = options.flowPreview
      ? versions.display || versions.large || versions.preview || versions.original
      : (options.fullResolution
        ? versions.original || versions.large || versions.display
        : (isMobile ? versions.display || versions.large : versions.large || versions.original || versions.display));

    if (!targetVersion?.url || targetVersion.url === img.src) {
      return;
    }

    queueImageLoad({
      element,
      img,
      url: targetVersion.url,
      upgrade: true,
      validate: () => element._imageToken === imageToken
    });
  }

  if (shouldUseObserver && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadHigherQualityImage();
          currentObserver.disconnect();
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });

    observer.observe(element);
    element._imageObserver = observer;
  } else {
    loadHigherQualityImage();
  }

  return img;
}

function renderImageBlock(element, block) {
  element.classList.add('image-block');
  appendPreviewImage(element, block, {
    fullResolution: false,
    flowPreview: Boolean(element.dataset.flowInstance),
    useObserver: !element.dataset.flowInstance
  });
}

function renderLinkBlock(element, block) {
  const previewImage = appendPreviewImage(element, block, {
    fullResolution: false,
    flowPreview: Boolean(element.dataset.flowInstance),
    useObserver: !element.dataset.flowInstance
  });

  if (previewImage) {
    return;
  }

  const link = document.createElement('div');
  link.textContent = block.title || block.source?.title || 'Link';
  link.style.color = 'var(--link-color)';
  element.appendChild(link);
}

function renderAttachmentBlock(element, block) {
  const previewImage = appendPreviewImage(element, block, {
    fullResolution: false,
    flowPreview: Boolean(element.dataset.flowInstance),
    useObserver: !element.dataset.flowInstance
  });

  if (previewImage) {
    return;
  }

  const title = document.createElement('div');
  title.textContent = block.title || block.attachment?.filename || 'Attachment';
  element.appendChild(title);
}

function renderEmbedBlock(element, block) {
  const previewImage = appendPreviewImage(element, block, {
    fullResolution: false,
    flowPreview: Boolean(element.dataset.flowInstance),
    useObserver: !element.dataset.flowInstance
  });

  if (previewImage) {
    return;
  }

  const title = document.createElement('div');
  title.textContent = block.title || block.embed?.title || 'Embed';
  element.appendChild(title);
}

function renderFallbackBlock(element, block) {
  const title = document.createElement('div');
  title.textContent = block.title || block.rawType || 'Block';
  element.appendChild(title);
}

function renderTextBlock(element, block) {
  if (block.textHtml) {
    const text = document.createElement('div');
    text.innerHTML = block.textHtml;
    element.appendChild(text);
  } else if (block.title) {
    const title = document.createElement('div');
    title.innerHTML = block.title;
    element.appendChild(title);
  }
}

function updateBlockPosition(block, x, y, rotation) {
  const blockId = block.dataset.blockId;
  STATE.cachedBlockPositions[blockId] = { x, y, rotation };
  schedulePositionCacheSave(1000);
}

const handleResize = throttle(() => {
  if (STATE.layoutMode === 'flow') {
    if (STATE.flow) {
      // The Flow organism is content-sized and locked for this session.
      // Resizing only changes the canvas viewport, not block placement.
      renderFlowViewport();
    }
    return;
  }

  const viewport = {
    minX: 0,
    minY: 0,
    maxX: window.innerWidth,
    maxY: window.innerHeight - 30
  };

  const blocks = document.querySelectorAll('.block');

  blocks.forEach(block => {
    const blockWidth = block.offsetWidth;
    const blockHeight = block.offsetHeight;
    const bounds = {
      minX: -blockWidth / 2,
      minY: -blockHeight / 2,
      maxX: viewport.maxX - blockWidth / 2,
      maxY: viewport.maxY - blockHeight / 2
    };

    let x = getTranslateXValue(block);
    let y = getTranslateYValue(block);

    x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
    y = Math.min(Math.max(y, bounds.minY), bounds.maxY);

    const currentRotation = (block.style.transform.match(/rotate\(([^)]+)\)/) || ['', '0deg'])[1];
    block.style.transform = `translate(${x}px, ${y}px) rotate(${currentRotation})`;

    const blockId = block.dataset.blockId;
    if (blockId && STATE.cachedBlockPositions[blockId]) {
      STATE.cachedBlockPositions[blockId].x = x;
      STATE.cachedBlockPositions[blockId].y = y;
    }
  });

  reprioritizeImageQueue();
  schedulePositionCacheSave(1000);
}, 100);

window.addEventListener('resize', handleResize);
