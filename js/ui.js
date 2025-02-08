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
  themeToggle.textContent = theme;
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

  // Initialize tile/shuffle button
  const tileButton = document.getElementById('tile-button');
  STATE.isTiled = false;  // 将状态移到全局
  tileButton.addEventListener('click', () => {
    if (STATE.isTiled) {
      shuffleBlocks();
      tileButton.textContent = 'Tile';
    } else {
      tileBlocks();
      tileButton.textContent = 'Shuffle';
    }
    STATE.isTiled = !STATE.isTiled;
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
  });

  document.getElementById('about-button').addEventListener('click', showAboutView);
}

function handleGoButtonClick() {
  const newSlug = document.getElementById('channel-slug-input').value.trim();
  if (newSlug) {
    router.navigate(newSlug, true, true);
  }
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
  const blocks = Array.from(document.querySelectorAll('.block'));
  const blockWidth = 200;
  const blockHeight = 300;
  const headerHeight = 30;
  
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
  const blocks = Array.from(document.querySelectorAll('.block'));
  const blockWidth = 200;
  const blockHeight = 300;
  const headerHeight = 30;
  
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

// Add new function to reset tile button
function resetTileButton() {
  const tileButton = document.getElementById('tile-button');
  tileButton.textContent = 'Tile';
  STATE.isTiled = false;
}

// Add new function to show current channel detail
async function showCurrentChannelDetail() {
  // 先关闭当前的 detailview
  if (document.getElementById('detail-view').style.display === 'flex') {
    closeDetailView();
  }

  const slug = STATE.channelSlugs[0];
  if (!slug) return;

  const detailContent = document.getElementById('detail-view-content');
  const detailTitle = document.getElementById('detail-view-title');
  const detailMeta = document.getElementById('detail-view-meta');
  const arenaLink = document.getElementById('detail-view-arena-link');

  detailContent.innerHTML = '<div style="padding: 20px;">Loading channel details...</div>';
  document.getElementById('detail-view').style.display = 'flex';

  try {
    const response = await fetch(`https://api.are.na/v2/channels/${slug}`);
    if (!response.ok) throw new Error('Failed to fetch channel details');
    const channelData = await response.json();
    
    detailContent.innerHTML = '';
    detailTitle.textContent = channelData.title;

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

    const viewOnArenaButton = document.createElement('button');
    viewOnArenaButton.id = 'channel-goto-button';
    viewOnArenaButton.textContent = 'View Channel on Are.na';
    viewOnArenaButton.addEventListener('click', function() {
      window.open(`https://www.are.na/channel/${slug}`, '_blank');
    });
    textInfo.appendChild(viewOnArenaButton);

    if (channelData.image) {
      const coverWrapper = document.createElement('div');
      coverWrapper.id = 'channel-cover-wrapper';
      
      const cover = document.createElement('img');
      cover.id = 'channel-cover-image';
      cover.src = channelData.image.display.url;
      cover.alt = `${channelData.title} channel cover`;
      
      if (channelData.image.original) {
        const originalImg = new Image();
        originalImg.src = channelData.image.original.url;
        originalImg.onload = () => {
          cover.src = originalImg.src;
        };
      }
      
      coverWrapper.appendChild(cover);
      basicInfo.appendChild(coverWrapper);
    }

    basicInfo.insertBefore(textInfo, basicInfo.firstChild);
    contentWrapper.appendChild(basicInfo);
    detailContent.appendChild(contentWrapper);

    arenaLink.href = `https://www.are.na/channel/${slug}`;

  } catch (error) {
    console.error('Error fetching channel details:', error);
    detailContent.innerHTML = '<div style="padding: 20px;">Failed to load channel details</div>';
  }
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
  // 同步更新按钮文字
  moreTileButton.textContent = document.getElementById('tile-button').textContent;
});

moreThemeButton.addEventListener('click', () => {
  document.getElementById('theme-toggle').click();
  // 同步更新按钮文字
  moreThemeButton.textContent = document.getElementById('theme-toggle').textContent;
});

moreAboutButton.addEventListener('click', () => {
  document.getElementById('about-button').click();
});

// 初始化时同步Theme按钮文字
const savedTheme = localStorage.getItem('theme') || 'system';
moreThemeButton.textContent = savedTheme; 