(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  const BACKUP_FORMAT = "embryosardegna-backup";
  const BACKUP_SCHEMA_VERSION = 1;

  function deepClone(value) {
    return app.domain.helpers.deepClone(value);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toArray(value) {
    return Array.isArray(value) ? value.map((item) => deepClone(item)) : [];
  }

  function normalizeTombstones(payload) {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => deepClone(item)).filter((item) => item && item.key);
    }

    return Object.keys(payload)
      .map((key) => deepClone(payload[key]))
      .filter((item) => item && item.key);
  }

  async function collectVisitsAndChecks(repository, clinicId, animals) {
    const visits = [];
    const pregnancyChecks = [];

    for (let index = 0; index < animals.length; index += 1) {
      const animal = animals[index];
      const animalVisits = await repository.listAnimalVisits(clinicId, animal.id);
      const animalChecks = await repository.listPregnancyChecks(clinicId, animal.id);

      visits.push(...animalVisits.map((visit) => deepClone(visit)));
      pregnancyChecks.push(...animalChecks.map((check) => deepClone(check)));
    }

    return {
      visits,
      pregnancyChecks,
    };
  }

  function buildSyncMetadata(repository, clinicId) {
    if (!repository) {
      return null;
    }

    const syncState = typeof repository.getSyncState === "function" ? repository.getSyncState() : null;
    const syncMeta = repository.syncMeta || null;

    if (!syncState && !syncMeta) {
      return null;
    }

    return {
      clinicId,
      state: syncState ? deepClone(syncState) : null,
      lastSyncAt: syncMeta ? syncMeta.lastSyncAt || null : null,
      deviceId: syncMeta ? syncMeta.deviceId || "" : "",
      tombstones: syncMeta ? normalizeTombstones(syncMeta.tombstones) : [],
    };
  }

  function buildBackupFileName(clinicId) {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `embryosardegna-backup-${clinicId}-${datePart}-${timePart}.json`;
  }

  function downloadText(text, fileName) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Impossibile leggere il file selezionato"));
      };

      reader.readAsText(file);
    });
  }

  function validateBackupPayload(payload) {
    if (!payload || payload.format !== BACKUP_FORMAT) {
      throw new Error("Il file selezionato non e un backup Embryo Sardegna valido");
    }

    if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error(`Versione backup non supportata: ${payload.schemaVersion}`);
    }

    if (!payload.clinic || !payload.clinic.id) {
      throw new Error("Backup privo di informazioni clinica");
    }

    return payload;
  }

  function summarizeBackupPayload(payload, destinationClinicId) {
    return {
      sourceClinicId: payload.clinic.id,
      destinationClinicId,
      sessions: toArray(payload.sessions).length,
      animals: toArray(payload.animals).length,
      visits: toArray(payload.visits).length,
      pregnancyChecks: toArray(payload.pregnancyChecks).length,
      tombstones: normalizeTombstones(payload.sync && payload.sync.tombstones).length,
    };
  }

  function remapSessionRecord(session, destinationClinicId) {
    const nextSession = deepClone(session);
    nextSession.clinicId = destinationClinicId;
    return nextSession;
  }

  function remapAnimalRecord(animal, destinationClinicId, availableSessionIds) {
    const nextAnimal = deepClone(animal);
    nextAnimal.clinicId = destinationClinicId;

    if (!availableSessionIds[nextAnimal.sessionId]) {
      nextAnimal.sessionId = app.domain.modelUtils.UNASSIGNED_SESSION_ID;
      nextAnimal.sessionName = app.domain.modelUtils.UNASSIGNED_SESSION_NAME;
    }

    return nextAnimal;
  }

  function remapVisitRecord(visit, destinationClinicId, destinationAnimal, availableSessionIds) {
    const nextVisit = deepClone(visit);
    nextVisit.clinicId = destinationClinicId;
    nextVisit.animalId = destinationAnimal.id;

    if (!availableSessionIds[nextVisit.sessionId]) {
      nextVisit.sessionId = destinationAnimal.sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
      nextVisit.sessionName = destinationAnimal.sessionName || app.domain.modelUtils.UNASSIGNED_SESSION_NAME;
    }

    nextVisit.attachments = toArray(nextVisit.attachments).map((attachment) => {
      const nextAttachment = deepClone(attachment);
      nextAttachment.clinicId = destinationClinicId;
      nextAttachment.animalId = destinationAnimal.id;
      nextAttachment.visitId = nextVisit.id;
      return nextAttachment;
    });
    nextVisit.events = toArray(nextVisit.events).map((eventRecord) => {
      const nextEvent = deepClone(eventRecord);
      nextEvent.clinicId = destinationClinicId;
      nextEvent.animalId = destinationAnimal.id;
      nextEvent.visitId = nextVisit.id;
      return nextEvent;
    });

    return nextVisit;
  }

  function remapPregnancyCheckRecord(check, destinationClinicId, destinationAnimalId) {
    const nextCheck = deepClone(check);
    nextCheck.clinicId = destinationClinicId;
    nextCheck.animalId = destinationAnimalId;
    return nextCheck;
  }

  function remapTombstones(tombstones, destinationClinicId) {
    return normalizeTombstones(tombstones).map((tombstone) => {
      const nextTombstone = deepClone(tombstone);
      nextTombstone.clinicId = destinationClinicId;
      return nextTombstone;
    });
  }

  async function upsertSession(repository, clinicId, session) {
    if (session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      return repository.getSession(clinicId, session.id);
    }

    try {
      await repository.getSession(clinicId, session.id);
      return repository.updateSession(session.id, session, { clinicId });
    } catch (error) {
      return repository.createSession(session);
    }
  }

  async function upsertAnimal(repository, clinicId, animal) {
    try {
      await repository.getAnimal(clinicId, animal.id);
      return repository.updateAnimal(animal.id, animal, { clinicId });
    } catch (error) {
      return repository.createAnimal(animal);
    }
  }

  async function upsertVisit(repository, clinicId, animalId, visit) {
    const visitPayload = deepClone(visit);
    const attachments = toArray(visitPayload.attachments);
    const events = toArray(visitPayload.events);

    delete visitPayload.attachments;
    delete visitPayload.events;

    const savedVisit = await repository.saveVisit(clinicId, animalId, visitPayload);
    await repository.replaceVisitAttachments(clinicId, animalId, savedVisit.id, attachments);
    await repository.replaceProtocolEvents(clinicId, animalId, savedVisit.id, events);
    return savedVisit;
  }

  async function maybeMergeImportedTombstones(repository, clinicId, tombstones) {
    if (!repository || typeof repository.mergeImportedSyncTombstones !== "function" || !normalizeTombstones(tombstones).length) {
      return;
    }

    await repository.mergeImportedSyncTombstones(clinicId, remapTombstones(tombstones, clinicId));
  }

  async function buildBackupPayload(repository, clinicId) {
    const resolvedClinicId = clinicId || app.data.activeClinicId;
    const clinic = await repository.getClinic(resolvedClinicId);
    const sessions = await repository.listSessions(resolvedClinicId);
    const animals = await repository.listAnimals(resolvedClinicId);
    const relatedRecords = await collectVisitsAndChecks(repository, resolvedClinicId, animals);

    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: app.domain.modelUtils.nowIso(),
      clinic: deepClone(clinic),
      sessions: toArray(sessions),
      animals: toArray(animals),
      visits: toArray(relatedRecords.visits),
      pregnancyChecks: toArray(relatedRecords.pregnancyChecks),
      sync: buildSyncMetadata(repository, resolvedClinicId),
      app: {
        repositoryMode: app.data && app.data.repositoryMode ? app.data.repositoryMode : repository.name || "unknown",
      },
    };
  }

  async function importBackupPayload(repository, destinationClinicId, payload) {
    const validatedPayload = validateBackupPayload(payload);
    const resolvedClinicId = destinationClinicId || (app.data && app.data.activeClinicId) || validatedPayload.clinic.id;
    const summary = summarizeBackupPayload(validatedPayload, resolvedClinicId);
    const importedSessionIds = {};
    const importedAnimalsById = {};
    const sessions = toArray(validatedPayload.sessions);
    const animals = toArray(validatedPayload.animals);
    const visits = toArray(validatedPayload.visits);
    const pregnancyChecks = toArray(validatedPayload.pregnancyChecks);

    await repository.getClinic(resolvedClinicId);

    for (let index = 0; index < sessions.length; index += 1) {
      const importedSession = await upsertSession(repository, resolvedClinicId, remapSessionRecord(sessions[index], resolvedClinicId));
      importedSessionIds[importedSession.id] = importedSession;
    }

    importedSessionIds[app.domain.modelUtils.UNASSIGNED_SESSION_ID] =
      importedSessionIds[app.domain.modelUtils.UNASSIGNED_SESSION_ID] || (await repository.getSession(resolvedClinicId, app.domain.modelUtils.UNASSIGNED_SESSION_ID));

    for (let index = 0; index < animals.length; index += 1) {
      const importedAnimal = await upsertAnimal(
        repository,
        resolvedClinicId,
        remapAnimalRecord(animals[index], resolvedClinicId, importedSessionIds)
      );
      importedAnimalsById[importedAnimal.id] = importedAnimal;
    }

    for (let index = 0; index < visits.length; index += 1) {
      const sourceVisit = visits[index];
      const destinationAnimal = importedAnimalsById[sourceVisit.animalId];

      if (!destinationAnimal) {
        continue;
      }

      await upsertVisit(
        repository,
        resolvedClinicId,
        destinationAnimal.id,
        remapVisitRecord(sourceVisit, resolvedClinicId, destinationAnimal, importedSessionIds)
      );
    }

    for (let index = 0; index < pregnancyChecks.length; index += 1) {
      const sourceCheck = pregnancyChecks[index];
      const destinationAnimal = importedAnimalsById[sourceCheck.animalId];

      if (!destinationAnimal) {
        continue;
      }

      await repository.savePregnancyCheck(
        resolvedClinicId,
        destinationAnimal.id,
        remapPregnancyCheckRecord(sourceCheck, resolvedClinicId, destinationAnimal.id)
      );
    }

    await maybeMergeImportedTombstones(repository, resolvedClinicId, validatedPayload.sync && validatedPayload.sync.tombstones);

    if (typeof repository.recomputeAllSessionDateRanges === "function") {
      await repository.recomputeAllSessionDateRanges(resolvedClinicId);
    }

    return summary;
  }

  function updateSummaryBadge() {
    const refs = app.dom && app.dom.refs;

    if (!refs || !refs.backupSummaryBadge) {
      return;
    }

    const repository = app.data && app.data.repository;
    const clinicId = app.data && app.data.activeClinicId ? app.data.activeClinicId : "--";
    const syncState = repository && typeof repository.getSyncState === "function" ? repository.getSyncState() : null;
    const pendingPart = syncState ? ` | pending ${syncState.pendingCount}` : "";

    refs.backupSummaryBadge.textContent = `Backup JSON clinica ${clinicId}${pendingPart}`;
  }

  async function exportJsonBackup() {
    const repository = app.data.repository;
    const clinicId = app.data.activeClinicId;
    const payload = await buildBackupPayload(repository, clinicId);

    downloadText(JSON.stringify(payload, null, 2), buildBackupFileName(clinicId));
    updateSummaryBadge();
    return payload;
  }

  async function handleImportSelection(file) {
    if (!file) {
      return null;
    }

    const repository = app.data.repository;
    const clinicId = app.data.activeClinicId;
    const syncState = repository && typeof repository.getSyncState === "function" ? repository.getSyncState() : null;
    const rawText = await readFileAsText(file);
    const payload = validateBackupPayload(JSON.parse(rawText));
    const summary = summarizeBackupPayload(payload, clinicId);
    const firstWarning = `Importare il backup JSON?\n\nOrigine: ${summary.sourceClinicId}\nDestinazione: ${summary.destinationClinicId}\nSessioni: ${summary.sessions}\nAnimali: ${summary.animals}\nVisite: ${summary.visits}\nControlli gravidanza: ${summary.pregnancyChecks}\nTombstone sync: ${summary.tombstones}`;
    const secondWarning = syncState && syncState.pendingCount > 0
      ? `Sono presenti ${syncState.pendingCount} modifiche locali non ancora sincronizzate.\n\nSe continui, i record con lo stesso ID saranno aggiornati nella clinica corrente. Nessun record esistente verra cancellato automaticamente dal backup. Procedere?`
      : 'I record con lo stesso ID saranno aggiornati nella clinica corrente. Nessun record esistente verra cancellato automaticamente dal backup. Procedere?';

    if (!window.confirm(firstWarning)) {
      return null;
    }

    if (!window.confirm(secondWarning)) {
      return null;
    }

    const imported = await importBackupPayload(repository, clinicId, payload);

    if (app.workspace && typeof app.workspace.loadClinic === "function") {
      await app.workspace.loadClinic();
    }

    if (app.workspace && typeof app.workspace.loadSessions === "function") {
      await app.workspace.loadSessions();
    }

    if (app.workspace && typeof app.workspace.refreshAnimals === "function") {
      await app.workspace.refreshAnimals();
    }

    updateSummaryBadge();
    return imported;
  }

  app.backup = {
    init() {
      const refs = app.dom && app.dom.refs;

      if (!refs || !refs.exportJsonBackupBtn || !refs.importJsonBackupBtn || !refs.importJsonBackupFileInput) {
        return;
      }

      refs.exportJsonBackupBtn.addEventListener("click", () => {
        this.exportJsonBackup().then(() => {
          app.ui.toast("Backup JSON esportato");
        }).catch((error) => {
          console.error(error);
          app.ui.toast("Errore durante l'export JSON", "warn");
        });
      });

      refs.importJsonBackupBtn.addEventListener("click", () => {
        refs.importJsonBackupFileInput.value = "";
        refs.importJsonBackupFileInput.click();
      });

      refs.importJsonBackupFileInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];

        this.handleImportSelection(file).then((summary) => {
          if (!summary) {
            return;
          }

          app.ui.toast(
            `Backup JSON importato: ${summary.sessions} sessioni, ${summary.animals} animali, ${summary.visits} visite`,
            "success"
          );
        }).catch((error) => {
          console.error(error);
          app.ui.toast(error && error.message ? error.message : "Errore durante l'import JSON", "warn");
        });
      });

      updateSummaryBadge();
    },

    refreshSummary() {
      updateSummaryBadge();
    },

    buildBackupPayload,
    importBackupPayload,
    exportJsonBackup,
    handleImportSelection,
    summarizeBackupPayload,
    validateBackupPayload,
  };
})();
