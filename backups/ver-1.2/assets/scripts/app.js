(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  async function init() {
    app.repositories.bootstrap.init();
    app.dom.init();
    app.theme.init();
    app.ui.init();
    app.canvas.init();
    app.voice.init();
    app.exporter.init();
    app.navigation.init();
    app.attachmentViewer.init();
    app.visitEditor.init();
    await app.workspace.init();
    app.managementView.init();
    app.analyticsView.init();
  }

  function start() {
    init().catch((error) => {
      console.error(error);

      if (app.ui && typeof app.ui.toast === "function") {
        app.ui.toast("Errore di bootstrap applicazione", "warn");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
