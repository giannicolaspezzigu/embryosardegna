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
