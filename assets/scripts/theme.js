(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const STORAGE_KEY = "embryosardegna-theme";
  const THEMES = new Set(["dark", "light"]);

  function getStoredTheme() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.has(stored) ? stored : "dark";
    } catch (error) {
      return "dark";
    }
  }

  function persistTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // No-op: theme persistence is optional.
    }
  }

  function updateToggleButtons(theme) {
    const refs = app.dom && app.dom.refs ? app.dom.refs : null;

    if (!refs) {
      return;
    }

    if (refs.themeDarkBtn) {
      refs.themeDarkBtn.classList.toggle("active", theme === "dark");
    }

    if (refs.themeLightBtn) {
      refs.themeLightBtn.classList.toggle("active", theme === "light");
    }
  }

  function applyTheme(theme) {
    const safeTheme = THEMES.has(theme) ? theme : "dark";
    document.body.setAttribute("data-theme", safeTheme);
    updateToggleButtons(safeTheme);
    persistTheme(safeTheme);
  }

  app.theme = {
    init() {
      const refs = app.dom.refs;
      const storedTheme = getStoredTheme();

      applyTheme(storedTheme);

      [refs.themeDarkBtn, refs.themeLightBtn].forEach((button) => {
        if (!button) {
          return;
        }

        button.addEventListener("click", () => {
          applyTheme(button.dataset.themeChoice);
        });
      });
    },
    applyTheme,
  };
})();
