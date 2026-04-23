(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  async function init() {
    let authSession = null;

    if (app.ui && typeof app.ui.syncBootLoadingFromStorage === "function") {
      app.ui.syncBootLoadingFromStorage();
      app.ui.updateBootLoading(20, "Verifica accessi e profilo clinica...");
    }

    if (app.auth && typeof app.auth.prepareAppAccess === "function") {
      authSession = await app.auth.prepareAppAccess({
        redirectOnFailure: true,
      });

      if (app.auth.isEnabled && app.auth.isEnabled() && !authSession) {
        return;
      }
    }

    if (app.ui && typeof app.ui.updateBootLoading === "function") {
      app.ui.updateBootLoading(38, "Inizializzazione repository dati...");
    }

    app.repositories.bootstrap.init();

    if (app.ui && typeof app.ui.updateBootLoading === "function") {
      app.ui.updateBootLoading(48, "Preparazione interfaccia...");
    }

    app.dom.init();
    app.theme.init();
    app.ui.init();

    if (app.ui && typeof app.ui.updateBootLoading === "function") {
      app.ui.updateBootLoading(58, "Avvio moduli operativi...");
    }

    app.canvas.init();
    app.voice.init();
    app.exporter.init();
    app.backup.init();
    app.navigation.init();
    app.attachmentViewer.init();
    app.visitEditor.init();

    if (app.ui && typeof app.ui.updateBootLoading === "function") {
      app.ui.updateBootLoading(68, "Caricamento dati clinica...");
    }

    await app.workspace.init();

    if (app.ui && typeof app.ui.updateBootLoading === "function") {
      app.ui.updateBootLoading(94, "Finalizzazione workspace...");
    }

    app.managementView.init();
    app.analyticsView.init();

    if (app.ui && typeof app.ui.completeBootLoading === "function") {
      app.ui.completeBootLoading("Clinica caricata");
    }
  }

  function start() {
    init().catch((error) => {
      console.error(error);

      if (app.ui && typeof app.ui.failBootLoading === "function") {
        app.ui.failBootLoading();
      }

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
