(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function createEmptyState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatVisitPurpose(value) {
    return app.utils.humanizeEnum(app.config.visitPurposeLabels, value, "Ecografia");
  }

  function populateAnimalForm(animal) {
    const refs = app.dom.refs;

    refs.managementAnimalHeading.textContent = animal
      ? `${animal.displayName || animal.animalCode} | Gestione anagrafica`
      : "Seleziona un animale";
    refs.managementAnimalCodeInput.value = animal ? animal.animalCode || "" : "";
    refs.managementAnimalSpeciesInput.value = animal ? animal.species || "ovine" : "ovine";
    refs.managementAnimalBreedInput.value = animal ? animal.breed || "" : "";
    refs.managementAnimalFarmInput.value = animal ? animal.farmName || "" : "";
    refs.managementAnimalRoleInput.value = animal ? animal.reproductiveRole || "recipient" : "recipient";
    refs.managementAnimalParityInput.value = animal && animal.parity !== null && animal.parity !== undefined ? animal.parity : "";
    refs.managementAnimalNotesInput.value = animal ? animal.notes || "" : "";
    refs.saveAnimalChangesBtn.disabled = !animal;
    refs.deleteAnimalBtn.disabled = !animal;
  }

  function renderVisitList(visits) {
    const refs = app.dom.refs;

    if (!visits.length) {
      refs.managementVisitList.innerHTML = createEmptyState("Nessuna visita salvata per questo animale.");
      refs.managementVisitHeading.textContent = "Modifica, elimina o apri nell'editor";
      return;
    }

    refs.managementVisitHeading.textContent = `${visits.length} visite disponibili`;
    refs.managementVisitList.innerHTML = visits
      .map((visit) => {
        return (
          '<div class="management-visit-item">' +
          '<div class="management-visit-head">' +
          `<div class="management-visit-title">${escapeHtml(app.utils.formatShortDateTime(visit.visitAt))}</div>` +
          `<span class="mini-badge">${escapeHtml(visit.summary.shortText || "N/D")}</span>` +
          "</div>" +
          `<div class="management-visit-meta">${escapeHtml(formatVisitPurpose(visit.visitPurpose))} | ${escapeHtml(visit.summary.headline || "Senza sintesi")}</div>` +
          `<div class="management-visit-meta">Follicoli ${escapeHtml(visit.ovaries.total.totalFollicles)} | Allegati ${escapeHtml((visit.attachments || []).length)} | Eventi ${escapeHtml((visit.events || []).length)}</div>` +
          '<div class="management-visit-actions">' +
          `<button class="secondary-btn" type="button" data-visit-action="open" data-visit-id="${escapeHtml(visit.id)}">Apri dettaglio</button>` +
          `<button class="secondary-btn" type="button" data-visit-action="edit" data-visit-id="${escapeHtml(visit.id)}">Modifica in editor</button>` +
          `<button class="clr-btn danger-btn" type="button" data-visit-action="delete" data-visit-id="${escapeHtml(visit.id)}">Elimina visita</button>` +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  app.managementView = {
    init() {
      this.bindEvents();
      this.refresh();
    },

    bindEvents() {
      const refs = app.dom.refs;

      refs.saveAnimalChangesBtn.addEventListener("click", () => {
        this.saveAnimalChanges();
      });

      refs.deleteAnimalBtn.addEventListener("click", () => {
        this.deleteSelectedAnimal();
      });

      refs.managementVisitList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-visit-action]");

        if (!button) {
          return;
        }

        const action = button.dataset.visitAction;
        const visitId = button.dataset.visitId;

        if (action === "open") {
          this.openVisit(visitId);
          return;
        }

        if (action === "edit") {
          this.editVisit(visitId);
          return;
        }

        if (action === "delete") {
          this.deleteVisit(visitId);
        }
      });
    },

    refresh() {
      const animal = app.state.workspace.selectedAnimal;
      const visits = animal ? app.workspace.getSelectedAnimalVisits() : [];

      populateAnimalForm(animal);
      renderVisitList(visits);
    },

    async saveAnimalChanges() {
      const animal = app.state.workspace.selectedAnimal;

      if (!animal) {
        app.ui.toast("Seleziona prima un animale", "warn");
        return;
      }

      const patch = {
        animalCode: app.dom.refs.managementAnimalCodeInput.value.trim() || animal.animalCode,
        displayName: app.dom.refs.managementAnimalCodeInput.value.trim() || animal.displayName || animal.animalCode,
        species: app.dom.refs.managementAnimalSpeciesInput.value,
        breed: app.dom.refs.managementAnimalBreedInput.value.trim(),
        farmName: app.dom.refs.managementAnimalFarmInput.value.trim(),
        reproductiveRole: app.dom.refs.managementAnimalRoleInput.value,
        parity: app.dom.refs.managementAnimalParityInput.value ? Number(app.dom.refs.managementAnimalParityInput.value) : null,
        notes: app.dom.refs.managementAnimalNotesInput.value.trim(),
        updatedBy: "demo_user",
      };

      app.dom.refs.saveAnimalChangesBtn.disabled = true;

      try {
        await app.data.repository.updateAnimal(animal.id, patch, { clinicId: app.data.activeClinicId });
        await app.workspace.refreshAnimals(animal.id);
        app.ui.toast("Animale aggiornato");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'aggiornamento animale", "warn");
      } finally {
        app.dom.refs.saveAnimalChangesBtn.disabled = false;
      }
    },

    async deleteSelectedAnimal() {
      const animal = app.state.workspace.selectedAnimal;

      if (!animal) {
        app.ui.toast("Seleziona prima un animale", "warn");
        return;
      }

      if (!window.confirm(`Eliminare l'animale ${animal.animalCode} e tutte le sue visite?`)) {
        return;
      }

      try {
        await app.data.repository.deleteAnimal(app.data.activeClinicId, animal.id);
        app.state.context.activeAnimalId = null;
        app.state.context.activeVisitId = null;
        app.visitEditor.resetEditor();
        await app.workspace.refreshAnimals();
        app.ui.toast("Animale eliminato");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'eliminazione animale", "warn");
      }
    },

    async openVisit(visitId) {
      await app.workspace.selectVisit(visitId);
      app.navigation.show("operational");
      app.ui.toast("Dettaglio visita aperto");
    },

    async editVisit(visitId) {
      try {
        await app.workspace.selectVisit(visitId);
        app.visitEditor.editSelectedVisit();
        app.navigation.show("operational");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'apertura della visita in modifica", "warn");
      }
    },

    async deleteVisit(visitId) {
      const animal = app.state.workspace.selectedAnimal;

      if (!animal) {
        app.ui.toast("Seleziona prima un animale", "warn");
        return;
      }

      if (!window.confirm("Eliminare definitivamente questa visita?")) {
        return;
      }

      try {
        await app.data.repository.deleteVisit(app.data.activeClinicId, animal.id, visitId);
        if (app.state.workspace.selectedVisit && app.state.workspace.selectedVisit.id === visitId) {
          app.visitEditor.resetEditor({ preserveContext: true });
        }
        await app.workspace.refreshAnimals(animal.id);
        app.ui.toast("Visita eliminata");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'eliminazione visita", "warn");
      }
    },
  };
})();
