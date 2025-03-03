// Global configuration
const CONFIG = {
  defaultChannel: 'ephemeral-visions',
  accessToken: '',
  blocksPerLoad: isMobileDevice() ? 10 : 20,     // Reduce batch size on mobile
  loadInterval: isMobileDevice() ? 300 : 100,    // More time between batches on mobile
  doubleClickDelay: 300,
  dbName: 'ArenaBlocksDB',
  dbVersion: 2,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 1 day
  memoryCheckInterval: 5000,         // Check memory usage every 5 seconds on mobile
  maxBlocks: isMobileDevice() ? 100 : 500, // Maximum blocks to render at once on mobile
  version: '3.4.13' // Version increment for the fix
};

// Helper function to detect mobile devices
function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Global state
const STATE = {
  channelSlugs: [CONFIG.defaultChannel],
  allFetchedBlocks: [],
  currentlyDisplayedBlocks: 0,
  isLoading: false,
  loadIntervalId: null,
  cachedBlockPositions: {},
  cachedBlockOrder: [],
  lastTouchEnd: 0
};
