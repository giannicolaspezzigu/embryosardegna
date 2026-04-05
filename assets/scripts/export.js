(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  app.exporter = {
    init() {
      app.dom.refs.exportBtn.addEventListener("click", () => this.exportCsv());
    },

    exportCsv() {
      const sheepId = app.dom.refs.sheepId.value || "N/A";
      const annotation = app.dom.refs.annotationField.value;
      const sessionDate = app.state.sessionStartedAt.toLocaleDateString("it-IT");
      const sessionTime = app.state.sessionStartedAt.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const uterus = app.state.uterus;
      let csv =
        "Data,Ora,Animale,Ovaio,Tipo,Dimensione_mm,CL_Superficie_mm2,Utero_T,Utero_V,Utero_L,Annotazione\n";

      ["L", "R"].forEach((side) => {
        app.state.structs[side].forEach((structure) => {
          const row = [
            sessionDate,
            sessionTime,
            sheepId,
            app.utils.sideLabel(side),
            structure.type === "fol" ? "Follicolo" : structure.type === "ov" ? "Ovulazione" : "CorpoLuteo",
            structure.type === "fol" ? structure.size : "",
            structure.type === "cl" ? structure.clSurf || "" : "",
            uterus.T || "-",
            uterus.V || "-",
            uterus.L || "-",
            annotation,
          ];

          csv += `${row.map((value) => app.utils.escapeCsv(value)).join(",")}\n`;
        });
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `embryosardegna_${sheepId}_${sessionDate.replace(/\//g, "-")}.csv`;
      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);

      app.ui.toast("CSV esportato");
    },
  };
})();
