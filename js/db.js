class ArenaDB {
  constructor() {
    this.dbName = CONFIG.dbName;
    this.dbVersion = CONFIG.dbVersion;
    this.db = null;
    this.ready = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;
        
        if (!db.objectStoreNames.contains('channels')) {
          const channelStore = db.createObjectStore('channels', { keyPath: 'slug' });
          channelStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          historyStore.createIndex('slug', 'slug', { unique: false });
        }

        if (event.oldVersion < 2) {
          this.clearOldCache();
        }

        if (event.oldVersion < 3 && tx && db.objectStoreNames.contains('channels')) {
          tx.objectStore('channels').clear();
        }
      };
    });
  }

  async saveChannel(slug, data) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('channels', 'readwrite');
      const store = tx.objectStore('channels');
      
      // DOM order captures the current stacking order, but is empty or
      // partial in flow mode / during progressive loads. Fall back to the
      // in-memory order for any blocks not currently rendered so the saved
      // order never loses entries.
      const domOrder = Array.from(document.querySelectorAll('.block:not([data-flow-instance])')).map(el => el.dataset.blockId);
      const seen = new Set(domOrder.map(String));
      const rest = (STATE.cachedBlockOrder || [])
        .map(String)
        .filter(id => !seen.has(id));
      const order = [...domOrder, ...rest];
  
      const state = {
        slug,
        data,
        cacheVersion: CONFIG.cacheSchemaVersion,
        positions: STATE.cachedBlockPositions,
        order: order,
        timestamp: Date.now()
      };
  
      const request = store.put(state);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChannel(slug) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('channels', 'readonly');
      const store = tx.objectStore('channels');
      const request = store.get(slug);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.cacheVersion !== CONFIG.cacheSchemaVersion) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addToHistory(slug, title) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      const request = store.add({
        slug,
        title,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getHistory(limit = 50) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      const history = [];
      const seenSlugs = new Set();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && history.length < limit) {
          if (!seenSlugs.has(cursor.value.slug)) {
            seenSlugs.add(cursor.value.slug);
            history.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(history);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearChannels() {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('channels', 'readwrite');
      const request = tx.objectStore('channels').clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldCache(maxAge = CONFIG.cacheMaxAge) {
    await this.ready;
    const tx = this.db.transaction(['channels', 'history'], 'readwrite');
    const channelStore = tx.objectStore('channels');
    const historyStore = tx.objectStore('history');
    const now = Date.now();
    // Surf history powers "recently surfed", so it outlives block caches.
    const historyMaxAge = CONFIG.historyMaxAge || maxAge;

    return new Promise((resolve, reject) => {
      const request = channelStore.index('timestamp').openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (now - cursor.value.timestamp > maxAge) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      const historyRequest = historyStore.index('timestamp').openCursor();

      historyRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (now - cursor.value.timestamp > historyMaxAge) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      tx.onerror = () => reject(tx.error);
    });
  }
}

// Global database instance
const arenaDB = new ArenaDB(); 
