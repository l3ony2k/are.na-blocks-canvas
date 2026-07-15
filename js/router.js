class Router {
  constructor() {
    this.currentSlug = null;
    this.isNavigating = false;
    
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.slug) {
        this.navigate(event.state.slug, false);
      }
    });

    window.addEventListener('hashchange', () => {
      const slug = this.getSlugFromHash();
      if (slug && slug !== this.currentSlug) {
        this.navigate(slug, false);
      }
    });
  }

  getSlugFromHash() {
    return window.location.hash.slice(1) || null;
  }

  async navigate(slug, addToHistory = true, forceRefresh = false) {
    if (this.isNavigating) return;
    if (slug === this.currentSlug && !forceRefresh) return;
    
    this.isNavigating = true;
    this.currentSlug = slug;

    document.getElementById('loading-container').style.display = 'block';
    document.getElementById('loading-bar').style.width = '0%';
    document.getElementById('log-output').style.display = 'block';
    document.getElementById('log-output').innerHTML = '';

    document.title = `${slug} | are.na blocks canvas`;

    if (addToHistory) {
      history.pushState({ slug }, '', `#${slug}`);
    }

    try {
      document.getElementById('channel-slug-input').value = slug;

      await updateChannel(slug, forceRefresh);

      if (typeof updateChannelInputDisplay === 'function') {
        updateChannelInputDisplay();
      }

      // Special views (@user, !feed) have no channel behind them; the view
      // loader fills STATE.currentChannelInfo itself.
      if (slug.startsWith('@') || slug.startsWith('!')) {
        if (slug.startsWith('@') && STATE.currentChannelInfo) {
          await arenaDB.addToHistory(slug, STATE.currentChannelInfo.title);
        }
        setTimeout(() => {
          document.getElementById('loading-container').style.display = 'none';
          document.getElementById('log-output').style.display = 'none';
        }, 500);
      } else {
        const channelInfo = await fetchChannelInfo(slug);
        if (channelInfo) {
          STATE.currentChannelInfo = channelInfo;
          document.title = `${channelInfo.title || slug} | are.na blocks canvas`;
          if (typeof updateChannelInputDisplay === 'function') {
            updateChannelInputDisplay();
          }
          await arenaDB.addToHistory(slug, channelInfo.title, channelInfo);
          STATE.recentChannels = null;
          if (typeof loadRecentChannels === 'function') {
            loadRecentChannels(true).catch(() => {});
          }
          setTimeout(() => {
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('log-output').style.display = 'none';
          }, 500);
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
      outputLog(`[Error] Failed to load channel: ${error.message}`);
      document.getElementById('loading-container').style.display = 'none';
      document.getElementById('log-output').style.display = 'block';
    } finally {
      this.isNavigating = false;
    }
  }

  init() {
    const initialSlug = this.getSlugFromHash() || STATE.channelSlugs[0];
    history.replaceState({ slug: initialSlug }, '', `#${initialSlug}`);
    this.navigate(initialSlug, false);
  }
}

// Global routing instance
const router = new Router();
