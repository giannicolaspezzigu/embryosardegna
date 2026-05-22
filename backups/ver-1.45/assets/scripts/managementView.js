(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  let pendingSessionDeletion = null;

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

  function getSessions() {
    return app.state.workspace.sessions || [];
  }

  function getSessionById(sessionId) {
    return (
      getSessions().find((session) => session.id === sessionId) ||
      getSessions().find((session) => session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) ||
      null
    );
  }

  function formatSessionOption(session) {
    return `${session.name}${session.code ? ` | ${session.code}` : ""}`;
  }

  function getRecordSessionId(record) {
    return (record && record.sessionId) || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
  }

  function buildSessionOptions(selectedSessionId) {
    return getSessions()
      .map((session) => {
        const selected = session.id === selectedSessionId ? " selected" : "";
        return `<option value="${escapeHtml(session.id)}"${selected}>${escapeHtml(formatSessionOption(session))}</option>`;
      })
      .join("");
  }

  function isoToDateInputValue(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateInputValueToIso(value) {
    if (!value) {
      return null;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
  }

  function populateSessionForm(session) {
    const refs = app.dom.refs;
    const selectedSession = session || app.state.workspace.activeSession || getSessionById(app.domain.modelUtils.UNASSIGNED_SESSION_ID);
    const isUnassigned = selectedSession && selectedSession.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    refs.managementActiveSessionSelect.innerHTML = buildSessionOptions(selectedSession ? selectedSession.id : "");
    refs.managementSessionHeading.textContent = selectedSession
      ? `Sessione selezionata: ${selectedSession.name}`
      : "Carica, crea o modifica una sessione di studio";
    refs.managementSessionNameInput.value = selectedSession ? selectedSession.name || "" : "";
    refs.managementSessionCodeInput.value = selectedSession ? selectedSession.code || "" : "";
    refs.managementSessionStatusInput.value = selectedSession ? selectedSession.status || "active" : "active";
    refs.managementSessionStartDateInput.value = selectedSession ? isoToDateInputValue(selectedSession.startDate) : "";
    refs.managementSessionEndDateInput.value = selectedSession ? isoToDateInputValue(selectedSession.endDate) : "";
    refs.managementSessionStartDateInput.disabled = true;
    refs.managementSessionEndDateInput.disabled = true;
    refs.managementSessionNotesInput.value = selectedSession ? selectedSession.notes || "" : "";
    refs.saveManagementSessionBtn.disabled = !selectedSession || isUnassigned;
    refs.deleteManagementSessionBtn.disabled = !selectedSession || isUnassigned;
  }

  function populateAnimalForm(animal) {
    const refs = app.dom.refs;
    const animalSessionId = animal ? animal.sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID : app.state.context.activeSessionId;

    refs.managementAnimalHeading.textContent = animal
      ? `${animal.displayName || animal.animalCode} | Gestione anagrafica`
      : "Seleziona un animale";
    refs.managementAnimalCodeInput.value = animal ? animal.animalCode || "" : "";
    refs.managementAnimalSpeciesInput.value = animal ? animal.species || "ovine" : "ovine";
    refs.managementAnimalBreedInput.value = animal ? animal.breed || "" : "";
    refs.managementAnimalFarmInput.value = animal ? animal.farmName || "" : "";
    refs.managementAnimalSessionInput.innerHTML = buildSessionOptions(animalSessionId);
    refs.managementAnimalSessionInput.value = animalSessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
    refs.managementAnimalSessionInput.disabled = !animal;
    refs.managementAnimalRoleInput.value = animal ? animal.reproductiveRole || "recipient" : "recipient";
    refs.managementAnimalParityInput.value = animal && animal.parity !== null && animal.parity !== undefined ? animal.parity : "";
    refs.managementAnimalBirthDateInput.value = animal ? isoToDateInputValue(animal.birthDate) : "";
    refs.managementAnimalLastParturitionDateInput.value = animal ? isoToDateInputValue(animal.lastParturitionDate) : "";
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

  function readSessionPayloadFromForm() {
    const refs = app.dom.refs;

    return {
      name: refs.managementSessionNameInput.value.trim(),
      code: refs.managementSessionCodeInput.value.trim(),
      status: refs.managementSessionStatusInput.value,
      notes: refs.managementSessionNotesInput.value.trim(),
      updatedBy: "demo_user",
    };
  }

  function normalizeSessionDeleteChoice(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();

    if (normalizedValue === "visits" || normalizedValue === "visite" || normalizedValue === "visita" || normalizedValue === "v") {
      return { deleteAnimals: false };
    }

    if (normalizedValue === "all" || normalizedValue === "tutto" || normalizedValue === "animali" || normalizedValue === "a") {
      return { deleteAnimals: true };
    }

    return null;
  }

  async function collectSessionDeletionStats(sessionId) {
    const animals = await app.data.repository.listAnimals(app.data.activeClinicId);
    const stats = {
      animals: 0,
      visits: 0,
    };

    for (let index = 0; index < animals.length; index += 1) {
      const animal = animals[index];
      const animalBelongsToSession = getRecordSessionId(animal) === sessionId;
      const visits = await app.data.repository.listAnimalVisits(app.data.activeClinicId, animal.id);

      if (animalBelongsToSession) {
        stats.animals += 1;
      }

      stats.visits += visits.filter((visit) => animalBelongsToSession || getRecordSessionId(visit) === sessionId).length;
    }

    return stats;
  }

  function buildSessionDeleteMessage(session, stats, deleteMode) {
    if (deleteMode.deleteAnimals) {
      return `Se confermi, verra eliminata la sessione "${session.name}" con ${stats.animals} animali e ${stats.visits} visite. L'operazione non e annullabile.`;
    }

    return `Se confermi, verra eliminata la sessione "${session.name}" con ${stats.visits} visite. Gli animali (${stats.animals}) resteranno nel database e saranno spostati in "Da assegnare". L'operazione non e annullabile.`;
  }

  app.managementView = {
    init() {
      this.bindEvents();
      this.refresh();
    },

    bindEvents() {
      const refs = app.dom.refs;

      refs.managementActiveSessionSelect.addEventListener("change", () => {
        populateSessionForm(getSessionById(refs.managementActiveSessionSelect.value));
      });

      refs.loadManagementSessionBtn.addEventListener("click", () => {
        this.loadSelectedSession();
      });

      refs.createManagementSessionBtn.addEventListener("click", () => {
        this.createSessionFromForm();
      });

      refs.saveManagementSessionBtn.addEventListener("click", () => {
        this.saveSessionChanges();
      });

      refs.deleteManagementSessionBtn.addEventListener("click", () => {
        this.deleteSelectedSession();
      });

      refs.sessionDeleteModeInput.addEventListener("change", () => {
        this.renderSessionDeleteWarning();
      });

      refs.cancelSessionDeleteBtn.addEventListener("click", () => {
        this.closeSessionDeleteModal();
      });

      refs.confirmSessionDeleteBtn.addEventListener("click", () => {
        this.confirmSessionDeletion();
      });

      refs.sessionDeleteModal.addEventListener("click", (event) => {
        if (event.target === refs.sessionDeleteModal) {
          this.closeSessionDeleteModal();
        }
      });

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

      if (app.workspace && typeof app.workspace.renderSessionControls === "function") {
        app.workspace.renderSessionControls();
      }

      populateSessionForm(app.state.workspace.activeSession);
      populateAnimalForm(animal);
      renderVisitList(visits);

      if (app.exporter && typeof app.exporter.refreshFilters === "function") {
        app.exporter.refreshFilters();
      }

      if (app.backup && typeof app.backup.refreshSummary === "function") {
        app.backup.refreshSummary();
      }
    },

    async loadSelectedSession() {
      const sessionId = app.dom.refs.managementActiveSessionSelect.value || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

      try {
        await app.workspace.activateSession(sessionId);
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante il caricamento della sessione", "warn");
      }
    },

    async createSessionFromForm() {
      const payload = readSessionPayloadFromForm();
      const selectedSession = getSessionById(app.dom.refs.managementActiveSessionSelect.value);

      if (!payload.name) {
        app.ui.toast("Inserisci un nome sessione", "warn");
        app.dom.refs.managementSessionNameInput.focus();
        return;
      }

      if (selectedSession && payload.name === selectedSession.name) {
        app.ui.toast("Inserisci un nome diverso per la nuova sessione", "warn");
        app.dom.refs.managementSessionNameInput.focus();
        return;
      }

      app.dom.refs.createManagementSessionBtn.disabled = true;

      try {
        const session = await app.workspace.createSession(payload);
        await app.workspace.activateSession(session.id, { silent: true });
        populateSessionForm(session);
        app.ui.toast("Sessione creata");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante la creazione della sessione", "warn");
      } finally {
        app.dom.refs.createManagementSessionBtn.disabled = false;
      }
    },

    async saveSessionChanges() {
      const sessionId = app.dom.refs.managementActiveSessionSelect.value;

      if (!sessionId || sessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
        app.ui.toast("La sessione Da assegnare non va modificata", "warn");
        return;
      }

      const payload = readSessionPayloadFromForm();

      if (!payload.name) {
        app.ui.toast("Inserisci un nome sessione", "warn");
        return;
      }

      app.dom.refs.saveManagementSessionBtn.disabled = true;

      try {
        const session = await app.data.repository.updateSession(sessionId, payload, { clinicId: app.data.activeClinicId });
        await app.workspace.loadSessions();
        await app.workspace.activateSession(session.id, { silent: true });
        populateSessionForm(session);
        app.ui.toast("Sessione aggiornata");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'aggiornamento della sessione", "warn");
      } finally {
        app.dom.refs.saveManagementSessionBtn.disabled = false;
      }
    },

    async deleteSelectedSession() {
      const refs = app.dom.refs;
      const session = getSessionById(refs.managementActiveSessionSelect.value);

      if (!session) {
        app.ui.toast("Seleziona prima una sessione", "warn");
        return;
      }

      if (session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
        app.ui.toast("La sessione Da assegnare non puo essere eliminata", "warn");
        return;
      }

      refs.deleteManagementSessionBtn.disabled = true;

      try {
        const stats = await collectSessionDeletionStats(session.id);
        pendingSessionDeletion = { session, stats };
        refs.sessionDeleteModalIntro.textContent = `Sessione selezionata: ${session.name}`;
        refs.sessionDeleteModeInput.value = "visits";
        this.renderSessionDeleteWarning();
        refs.sessionDeleteModal.classList.add("open");
        refs.sessionDeleteModeInput.focus();
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante la preparazione dell'eliminazione", "warn");
      } finally {
        const selectedSession = getSessionById(refs.managementActiveSessionSelect.value);
        const isUnassigned = selectedSession && selectedSession.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID;
        refs.deleteManagementSessionBtn.disabled = !selectedSession || isUnassigned;
      }
    },

    renderSessionDeleteWarning() {
      const refs = app.dom.refs;

      if (!pendingSessionDeletion) {
        refs.sessionDeleteWarningText.textContent = "";
        return;
      }

      const deleteMode = normalizeSessionDeleteChoice(refs.sessionDeleteModeInput.value);

      if (!deleteMode) {
        refs.sessionDeleteWarningText.textContent = "Seleziona cosa eliminare.";
        return;
      }

      refs.sessionDeleteWarningText.textContent = buildSessionDeleteMessage(
        pendingSessionDeletion.session,
        pendingSessionDeletion.stats,
        deleteMode
      );
    },

    closeSessionDeleteModal() {
      pendingSessionDeletion = null;
      app.dom.refs.sessionDeleteModal.classList.remove("open");
    },

    async confirmSessionDeletion() {
      const refs = app.dom.refs;

      if (!pendingSessionDeletion) {
        app.ui.toast("Nessuna sessione selezionata per l'eliminazione", "warn");
        this.closeSessionDeleteModal();
        return;
      }

      const deleteMode = normalizeSessionDeleteChoice(refs.sessionDeleteModeInput.value);

      if (!deleteMode) {
        app.ui.toast("Seleziona cosa eliminare", "warn");
        return;
      }

      const { session } = pendingSessionDeletion;
      const wasActiveSession = app.state.context.activeSessionId === session.id;

      refs.confirmSessionDeleteBtn.disabled = true;
      refs.cancelSessionDeleteBtn.disabled = true;
      refs.confirmSessionDeleteBtn.textContent = "Eliminazione...";

      try {
        const result = await app.data.repository.deleteSession(app.data.activeClinicId, session.id, {
          deleteAnimals: deleteMode.deleteAnimals,
        });

        await app.workspace.loadSessions();

        if (wasActiveSession) {
          await app.workspace.activateSession(app.domain.modelUtils.UNASSIGNED_SESSION_ID, { silent: true });
        } else {
          app.workspace.renderSessionControls();
          app.workspace.renderCurrentSession();
          await app.workspace.refreshAnimals(app.state.context.activeAnimalId);
        }

        const detail = deleteMode.deleteAnimals
          ? `${result.deletedAnimals} animali e ${result.deletedVisits} visite eliminati`
          : `${result.deletedVisits} visite eliminate, ${result.reassignedAnimals} animali spostati`;

        this.closeSessionDeleteModal();
        populateSessionForm(app.state.workspace.activeSession);
        app.ui.toast(`Sessione eliminata: ${detail}`);
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'eliminazione della sessione", "warn");
      } finally {
        refs.confirmSessionDeleteBtn.disabled = false;
        refs.cancelSessionDeleteBtn.disabled = false;
        refs.confirmSessionDeleteBtn.textContent = "Conferma eliminazione";

        const selectedSession = getSessionById(refs.managementActiveSessionSelect.value);
        const isUnassigned = selectedSession && selectedSession.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID;
        refs.deleteManagementSessionBtn.disabled = !selectedSession || isUnassigned;
      }
    },

    async saveAnimalChanges() {
      const animal = app.state.workspace.selectedAnimal;

      if (!animal) {
        app.ui.toast("Seleziona prima un animale", "warn");
        return;
      }

      const selectedSession = getSessionById(app.dom.refs.managementAnimalSessionInput.value);
      const patch = {
        animalCode: app.dom.refs.managementAnimalCodeInput.value.trim() || animal.animalCode,
        displayName: app.dom.refs.managementAnimalCodeInput.value.trim() || animal.displayName || animal.animalCode,
        species: app.dom.refs.managementAnimalSpeciesInput.value,
        breed: app.dom.refs.managementAnimalBreedInput.value.trim(),
        farmName: app.dom.refs.managementAnimalFarmInput.value.trim(),
        sessionId: selectedSession ? selectedSession.id : app.domain.modelUtils.UNASSIGNED_SESSION_ID,
        sessionName: selectedSession ? selectedSession.name : app.domain.modelUtils.UNASSIGNED_SESSION_NAME,
        reproductiveRole: app.dom.refs.managementAnimalRoleInput.value,
        parity: app.dom.refs.managementAnimalParityInput.value ? Number(app.dom.refs.managementAnimalParityInput.value) : null,
        birthDate: dateInputValueToIso(app.dom.refs.managementAnimalBirthDateInput.value),
        lastParturitionDate: dateInputValueToIso(app.dom.refs.managementAnimalLastParturitionDateInput.value),
        notes: app.dom.refs.managementAnimalNotesInput.value.trim(),
        updatedBy: "demo_user",
      };

      app.dom.refs.saveAnimalChangesBtn.disabled = true;

      try {
        await app.data.repository.updateAnimal(animal.id, patch, { clinicId: app.data.activeClinicId });
        await app.workspace.loadSessions();
        app.workspace.renderSessionControls();
        app.workspace.renderCurrentSession();
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

      const visitCount = app.workspace.getSelectedAnimalVisits().length;

      if (!window.confirm(`Stai per eliminare l'animale ${animal.animalCode} e ${visitCount} visite collegate. Continuare?`)) {
        return;
      }

      if (!window.confirm(`Conferma definitiva: ${animal.animalCode}, tutte le visite e gli allegati collegati verranno eliminati. Operazione non annullabile.`)) {
        return;
      }

      app.dom.refs.deleteAnimalBtn.disabled = true;

      try {
        await app.data.repository.deleteAnimal(app.data.activeClinicId, animal.id);
        app.state.context.activeAnimalId = null;
        app.state.context.activeVisitId = null;
        app.visitEditor.resetEditor();
        await app.workspace.loadSessions();
        app.workspace.renderSessionControls();
        app.workspace.renderCurrentSession();
        await app.workspace.refreshAnimals();
        app.ui.toast("Animale eliminato");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'eliminazione animale", "warn");
      } finally {
        app.dom.refs.deleteAnimalBtn.disabled = !app.state.workspace.selectedAnimal;
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

      const visit = app.workspace.getSelectedAnimalVisits().find((candidate) => candidate.id === visitId);
      const visitLabel = visit ? app.utils.formatShortDateTime(visit.visitAt) : "selezionata";

      if (!window.confirm(`Stai per eliminare la visita ${visitLabel} dell'animale ${animal.animalCode}. Continuare?`)) {
        return;
      }

      if (!window.confirm("Conferma definitiva: la visita, gli allegati e gli eventi collegati verranno eliminati. Operazione non annullabile.")) {
        return;
      }

      try {
        await app.data.repository.deleteVisit(app.data.activeClinicId, animal.id, visitId);
        if (app.state.workspace.selectedVisit && app.state.workspace.selectedVisit.id === visitId) {
          app.visitEditor.resetEditor({ preserveContext: true });
        }
        await app.workspace.loadSessions();
        app.workspace.renderSessionControls();
        app.workspace.renderCurrentSession();
        await app.workspace.refreshAnimals(animal.id);
        app.ui.toast("Visita eliminata");
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante l'eliminazione visita", "warn");
      }
    },
  };
})();
