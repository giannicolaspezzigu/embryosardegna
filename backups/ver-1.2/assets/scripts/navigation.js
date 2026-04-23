(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function getViewDefinitions() {
    const refs = app.dom.refs;

    return {
      operational: {
        button: refs.showOperationalViewBtn,
        panel: refs.operationalView,
      },
      management: {
        button: refs.showManagementViewBtn,
        panel: refs.managementView,
      },
      analytics: {
        button: refs.showAnalyticsViewBtn,
        panel: refs.analyticsView,
      },
    };
  }

  function initHeaderScrollBehavior() {
    const header = document.querySelector("header");

    if (!header) {
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateHeaderVisibility() {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY;

      document.body.classList.toggle("header-hidden", scrollingDown && currentScrollY > 12);

      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateHeaderVisibility);
          ticking = true;
        }
      },
      { passive: true },
    );
  }

  app.navigation = {
    init() {
      const refs = app.dom.refs;

      refs.showOperationalViewBtn.addEventListener("click", () => {
        this.show("operational");
      });

      refs.showManagementViewBtn.addEventListener("click", () => {
        this.show("management");
      });

      refs.showAnalyticsViewBtn.addEventListener("click", () => {
        this.show("analytics");
      });

      this.show("operational");
      initHeaderScrollBehavior();
    },

    show(viewName) {
      const definitions = getViewDefinitions();
      const nextView = definitions[viewName] ? viewName : "operational";

      Object.keys(definitions).forEach((key) => {
        const definition = definitions[key];
        const isActive = key === nextView;

        definition.button.classList.toggle("active", isActive);
        definition.panel.classList.toggle("active", isActive);
      });

      app.state.workspace.activeView = nextView;

      if (nextView === "management" && app.managementView && typeof app.managementView.refresh === "function") {
        app.managementView.refresh();
      }

      if (nextView === "analytics" && app.analyticsView && typeof app.analyticsView.refresh === "function") {
        app.analyticsView.refresh();
      }
    },
  };
})();
