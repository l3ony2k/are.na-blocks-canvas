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

        if (!db.objectStoreNames.contains('flowMeasurements')) {
          const measurementStore = db.createObjectStore('flowMeasurements', { keyPath: 'blockId' });
          measurementStore.createIndex('timestamp', 'timestamp', { unique: false });
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

  async saveFlowImageMeasurement(blockId, sourceUrl, width, height) {
    if (!sourceUrl || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('flowMeasurements', 'readwrite');
      tx.objectStore('flowMeasurements').put({
        blockId: String(blockId),
        sourceUrl,
        width,
        height,
        timestamp: Date.now()
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async getFlowImageMeasurements(blockIds, maxAge = CONFIG.flowMeasurementMaxAge) {
    const ids = [...new Set((blockIds || []).map((id) => String(id)))];
    if (ids.length === 0) {
      return {};
    }

    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('flowMeasurements', 'readonly');
      const store = tx.objectStore('flowMeasurements');
      const measurements = {};
      const cutoff = Date.now() - maxAge;

      ids.forEach((id) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const value = request.result;
          if (value && value.timestamp >= cutoff) {
            measurements[id] = value;
          }
        };
      });

      tx.oncomplete = () => resolve(measurements);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
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
      const stores = ['channels'];
      if (this.db.objectStoreNames.contains('flowMeasurements')) {
        stores.push('flowMeasurements');
      }
      const tx = this.db.transaction(stores, 'readwrite');
      stores.forEach((name) => tx.objectStore(name).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async clearOldCache(maxAge = CONFIG.cacheMaxAge) {
    await this.ready;
    const stores = ['channels', 'history'];
    if (this.db.objectStoreNames.contains('flowMeasurements')) {
      stores.push('flowMeasurements');
    }
    const tx = this.db.transaction(stores, 'readwrite');
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
        }
      };

      if (stores.includes('flowMeasurements')) {
        const measurementMaxAge = CONFIG.flowMeasurementMaxAge || maxAge;
        const measurementRequest = tx.objectStore('flowMeasurements').index('timestamp').openCursor();
        measurementRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (now - cursor.value.timestamp > measurementMaxAge) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

// Global database instance
const arenaDB = new ArenaDB(); 
