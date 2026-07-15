// Global configuration
const CONFIG = {
  defaultChannel: 'ephemeral-visions',
  accessToken: localStorage.getItem('arenaAccessToken') || '',
  blocksPerLoad: isMobileDevice() ? 10 : 20,     // Reduce batch size on mobile
  loadInterval: isMobileDevice() ? 300 : 100,    // More time between batches on mobile
  doubleClickDelay: 300,
  dbName: 'ArenaBlocksDB',
  dbVersion: 4,
  cacheSchemaVersion: 'arena-v4-comments',
  cacheMaxAge: 24 * 60 * 60 * 1000, // 1 day
  historyMaxAge: 30 * 24 * 60 * 60 * 1000, // Keep surf history around for a month
  flowMeasurementMaxAge: 30 * 24 * 60 * 60 * 1000, // Natural image dimensions are stable; prune after a month
  memoryCheckInterval: 5000,         // Check memory usage every 5 seconds on mobile
  maxBlocks: isMobileDevice() ? 150 : 1000, // Maximum blocks to render at once on mobile
  userOverrideBlockLimit: false,     // Whether the user has chosen to override the block limit
  additionalLoadStep: 50,            // Number of additional blocks to load when the user overrides the limit
  maxBlocksAfterOverride: isMobileDevice() ? 1000 : 5000, // Maximum blocks after user override
  flowGapRem: 1,
  flowBlockWidth: 200,
  flowBlockMaxHeight: 300,
  flowRenderBuffer: isMobileDevice() ? 500 : 800,
  flowCanvasRenderBuffer: 64,
  flowMediaPreloadBuffer: isMobileDevice() ? 240 : 480,
  flowImagePreloadMax: isMobileDevice() ? 72 : 144,
  flowGifPreloadMax: isMobileDevice() ? 8 : 16,
  flowImageCacheMax: isMobileDevice() ? 160 : 320,
  flowBlockPadding: 5,
  flowBorderWidth: 2,
  flowTextFontSize: 16,
  flowTextLineHeight: 20,
  flowChannelFontSize: 24,
  flowChannelLineHeight: 29,
  flowZoomMin: 0.5,
  flowZoomMax: 2,
  connectionsPerPage: 24,
  commentsPerPage: 24,
  myChannelsPerPage: 100,
  myChannelsCacheAge: 5 * 60 * 1000,
  userViewMaxPages: 10,
  version: '4.3.0' // Stacked user previews and unified channel detail actions
};

// Helper function to detect mobile devices
function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Global state
const STATE = {
  channelSlugs: [CONFIG.defaultChannel],
  allFetchedBlocks: [],
  blockById: new Map(),
  currentChannelInfo: null,
  currentlyDisplayedBlocks: 0,
  isLoading: false,
  loadIntervalId: null,
  cachedBlockPositions: {},
  cachedBlockOrder: [],
  visibleBlockIds: new Set(),
  lastTouchEnd: 0,
  layoutMode: 'mix',
  flow: null,
  flowImageMeasurements: {},
  currentUser: null,
  myChannels: null,
  followingChannels: null,
  activeDetailToken: null,
  detailStack: []
};
