(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const adapter = window.EmbryoPlatformAdapter || {};
  const memoryStore = {};

  function getLocalStorage() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function getStorageAdapter() {
    if (adapter.storage) {
      return adapter.storage;
    }

    const localStorage = getLocalStorage();

    if (localStorage) {
      return {
        getItem(key) {
          return localStorage.getItem(key);
        },
        setItem(key, value) {
          localStorage.setItem(key, value);
        },
        removeItem(key) {
          localStorage.removeItem(key);
        },
      };
    }

    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      },
      setItem(key, value) {
        memoryStore[key] = String(value);
      },
      removeItem(key) {
        delete memoryStore[key];
      },
    };
  }

  function getRuntimeConfig() {
    return adapter.runtimeConfig || window.EmbryoRuntimeConfig || {};
  }

  function setRuntimeConfig(config) {
    window.EmbryoRuntimeConfig = config || {};
  }

  function getFirebaseProvider() {
    if (adapter.providers && adapter.providers.firebase) {
      return adapter.providers.firebase;
    }

    return window.firebase || null;
  }

  function isOnline() {
    if (adapter.network && typeof adapter.network.isOnline === "function") {
      return Boolean(adapter.network.isOnline());
    }

    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }

    return true;
  }

  function onNetworkStatusChange(listener) {
    if (adapter.network && typeof adapter.network.onStatusChange === "function") {
      return adapter.network.onStatusChange(listener);
    }

    if (typeof window === "undefined" || typeof listener !== "function") {
      return function () {};
    }

    const handleOnline = function () {
      listener(true);
    };
    const handleOffline = function () {
      listener(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return function () {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  app.platform = {
    storage: getStorageAdapter(),
    getRuntimeConfig,
    setRuntimeConfig,
    providers: {
      getFirebase: getFirebaseProvider,
    },
    network: {
      isOnline,
      onStatusChange: onNetworkStatusChange,
    },
  };
})();
