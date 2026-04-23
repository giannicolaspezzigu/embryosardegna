(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function createEmptyState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function createMetricCard(label, value, subtext) {
    return (
      '<div class="metric-card">' +
      `<div class="metric-label">${label}</div>` +
      `<div class="metric-value">${value}</div>` +
      `<div class="metric-sub">${subtext || "&nbsp;"}</div>` +
      "</div>"
    );
  }

  function buildBarRows(items) {
    const maxValue = items.reduce((currentMax, item) => Math.max(currentMax, item.value), 0) || 1;

    return items
      .map((item) => {
        const width = item.value > 0 ? Math.max(8, Math.round((item.value / maxValue) * 100)) : 0;

        return (
          '<div class="analytics-bar-row">' +
          `<div class="analytics-bar-label">${item.label}</div>` +
          '<div class="analytics-bar-track">' +
          `<div class="analytics-bar-fill" style="width:${width}%"></div>` +
          "</div>" +
          `<div class="analytics-bar-value">${item.value}</div>` +
          "</div>"
        );
      })
      .join("");
  }

  function renderSummaryMetrics(animals) {
    const totalAnimals = animals.length;
    const totalVisits = animals.reduce((sum, animal) => sum + (animal.visitCount || 0), 0);
    const latestFollicles = animals.reduce((sum, animal) => sum + ((animal.lastVisitSummary && animal.lastVisitSummary.totalFollicles) || 0), 0);
    const avgLatestFollicles = totalAnimals ? (latestFollicles / totalAnimals).toFixed(1) : "0.0";
    const positiveOrSuspected = animals.filter((animal) => {
      const status = animal.lastVisitSummary ? animal.lastVisitSummary.pregnancyStatus : "unknown";
      return status === "positive" || status === "suspected";
    }).length;

    app.dom.refs.analyticsSummaryMetrics.innerHTML =
      createMetricCard("Animali", totalAnimals, "Archivio corrente") +
      createMetricCard("Visite", totalVisits, "Storico totale") +
      createMetricCard("Follicoli medi", avgLatestFollicles, "Ultimo stato noto") +
      createMetricCard("Gravidanze pos/sosp", positiveOrSuspected, "Ultimo esame");
  }

  function renderAnimalTrend(animal, visits) {
    if (!animal) {
      app.dom.refs.analyticsAnimalHeading.textContent = "Andamento visite nel tempo";
      app.dom.refs.analyticsAnimalTrend.innerHTML = createEmptyState("Seleziona un animale per vedere il trend delle visite.");
      return;
    }

    if (!visits.length) {
      app.dom.refs.analyticsAnimalHeading.textContent = `${animal.displayName || animal.animalCode} | Nessun dato storico`;
      app.dom.refs.analyticsAnimalTrend.innerHTML = createEmptyState("Questo animale non ha ancora visite da analizzare.");
      return;
    }

    app.dom.refs.analyticsAnimalHeading.textContent = `${animal.displayName || animal.animalCode} | ${visits.length} visite`;

    const follicleRows = visits
      .slice()
      .reverse()
      .map((visit) => {
        return {
          label: app.utils.formatShortDateTime(visit.visitAt),
          value: visit.ovaries.total.totalFollicles || 0,
        };
      });

    const clRows = visits
      .slice()
      .reverse()
      .map((visit) => {
        return {
          label: app.utils.formatShortDateTime(visit.visitAt),
          value: visit.ovaries.total.corporaLutea || 0,
        };
      });

    app.dom.refs.analyticsAnimalTrend.innerHTML =
      '<div class="analytics-section">' +
      '<div class="analytics-section-title">Follicoli totali per visita</div>' +
      buildBarRows(follicleRows) +
      "</div>" +
      '<div class="analytics-section">' +
      '<div class="analytics-section-title">Corpi lutei per visita</div>' +
      buildBarRows(clRows) +
      "</div>";
  }

  function renderHerdBreakdown(animals) {
    if (!animals.length) {
      app.dom.refs.analyticsHerdBreakdown.innerHTML = createEmptyState("Nessun animale disponibile per l'analisi aggregata.");
      return;
    }

    const byFarm = {};
    const byStatus = {
      positive: 0,
      suspected: 0,
      negative: 0,
      unknown: 0,
    };

    animals.forEach((animal) => {
      const farmName = animal.farmName || "Senza allevamento";
      const status = animal.lastVisitSummary ? animal.lastVisitSummary.pregnancyStatus || "unknown" : "unknown";

      byFarm[farmName] = (byFarm[farmName] || 0) + 1;

      if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
        byStatus[status] += 1;
      } else {
        byStatus.unknown += 1;
      }
    });

    const farmRows = Object.keys(byFarm)
      .sort((left, right) => byFarm[right] - byFarm[left])
      .map((farmName) => {
        return {
          label: farmName,
          value: byFarm[farmName],
        };
      });

    const statusRows = [
      { label: "Positive", value: byStatus.positive },
      { label: "Sospette", value: byStatus.suspected },
      { label: "Negative", value: byStatus.negative },
      { label: "Non definite", value: byStatus.unknown },
    ];

    app.dom.refs.analyticsHerdBreakdown.innerHTML =
      '<div class="analytics-section">' +
      '<div class="analytics-section-title">Distribuzione per allevamento</div>' +
      buildBarRows(farmRows) +
      "</div>" +
      '<div class="analytics-section">' +
      '<div class="analytics-section-title">Ultimo stato gravidanza</div>' +
      buildBarRows(statusRows) +
      "</div>" +
      '<div class="analytics-note">Questa vista e una base demo: il layer dati e gia predisposto per statistiche piu ampie su animale, gruppo e allevamento.</div>';
  }

  app.analyticsView = {
    init() {
      this.refresh();
    },

    refresh() {
      const animals = app.state.workspace.animals || [];
      const selectedAnimal = app.state.workspace.selectedAnimal;
      const visits = selectedAnimal ? app.workspace.getSelectedAnimalVisits() : [];

      renderSummaryMetrics(animals);
      renderAnimalTrend(selectedAnimal, visits);
      renderHerdBreakdown(animals);
    },
  };
})();
