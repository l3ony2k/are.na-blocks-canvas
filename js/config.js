// Global configuration
const CONFIG = {
  defaultChannel: 'ephemeral-visions',
  accessToken: '',
  blocksPerLoad: 20,
  loadInterval: 100,
  doubleClickDelay: 300,
  dbName: 'ArenaBlocksDB',
  dbVersion: 2,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 1 day
  version: '3.4.12'
};

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