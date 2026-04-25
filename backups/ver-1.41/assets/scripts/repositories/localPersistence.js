(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  const DEFAULT_DB_NAME = "embryosardegna_local_state";
  const DEFAULT_STORE_NAME = "documents";
  const DEFAULT_STATE_KEY = "app_state";
  const FALLBACK_STORAGE_PREFIX = "embryosardegna.localPersistence.";

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function LocalStateStore(options) {
    const settings = options || {};

    this.dbName = settings.dbName || DEFAULT_DB_NAME;
    this.storeName = settings.storeName || DEFAULT_STORE_NAME;
    this.stateKey = settings.stateKey || DEFAULT_STATE_KEY;
    this.fallbackStorageKey = `${FALLBACK_STORAGE_PREFIX}${this.dbName}.${this.stateKey}`;
    this.openPromise = null;
  }

  LocalStateStore.prototype.hasIndexedDb = function () {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  };

  LocalStateStore.prototype.open = function () {
    const self = this;

    if (!self.hasIndexedDb()) {
      return Promise.resolve(null);
    }

    if (!self.openPromise) {
      self.openPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(self.dbName, 1);

        request.onupgradeneeded = function () {
          const db = request.result;

          if (!db.objectStoreNames.contains(self.storeName)) {
            db.createObjectStore(self.storeName);
          }
        };

        request.onsuccess = function () {
          resolve(request.result);
        };

        request.onerror = function () {
          reject(request.error || new Error("IndexedDB open failed"));
        };
      }).catch(() => null);
    }

    return self.openPromise;
  };

  LocalStateStore.prototype.load = async function () {
    const db = await this.open();

    if (!db) {
      return this.loadFromFallbackStorage();
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.stateKey);

      request.onsuccess = () => {
        resolve(request.result ? deepClone(request.result) : null);
      };

      request.onerror = () => {
        resolve(this.loadFromFallbackStorage());
      };
    });
  };

  LocalStateStore.prototype.save = async function (state) {
    const payload = deepClone(state);
    const db = await this.open();

    if (!db) {
      this.saveToFallbackStorage(payload);
      return payload;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(payload, this.stateKey);

      request.onsuccess = () => {
        this.saveToFallbackStorage(payload);
        resolve(payload);
      };

      request.onerror = () => {
        this.saveToFallbackStorage(payload);
        reject(request.error || new Error("IndexedDB save failed"));
      };
    });
  };

  LocalStateStore.prototype.loadFromFallbackStorage = function () {
    try {
      const raw = app.platform.storage.getItem(this.fallbackStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  LocalStateStore.prototype.saveToFallbackStorage = function (state) {
    try {
      app.platform.storage.setItem(this.fallbackStorageKey, JSON.stringify(state));
    } catch (error) {
      // Fallback persistence is best-effort only.
    }
  };

  repositories.LocalStateStore = LocalStateStore;
})();
