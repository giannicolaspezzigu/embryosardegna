(function () {
  const app = window.EmbryoApp;
  const resultsNode = document.getElementById("results");
  const summaryNode = document.getElementById("summary");
  const TEST_CLINIC_ID = "clinic_test";

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function iso(value) {
    return new Date(value).toISOString();
  }

  function resetTestRuntime() {
    const runtime = window.__EmbryoTestRuntime;

    runtime.online = false;
    runtime.listeners = [];
    runtime.storage = {};
    window.__setEmbryoTestOnline(false);
  }

  function MemoryStateStore() {
    this.state = null;
  }

  MemoryStateStore.prototype.load = async function () {
    return this.state ? deepClone(this.state) : null;
  };

  MemoryStateStore.prototype.save = async function (state) {
    this.state = deepClone(state);
    return deepClone(state);
  };

  function createRemoteRepository() {
    const remote = new app.repositories.MockEmbryoRepository({
      defaultClinicId: TEST_CLINIC_ID,
    });

    remote.store = {
      clinics: {},
    };
    remote.syncTombstones = {};
    remote.syncMarker = null;
    remote.syncMarkerListeners = [];
    remote.listSyncTombstones = async function (clinicId) {
      return Object.keys(this.syncTombstones)
        .map((key) => deepClone(this.syncTombstones[key]))
        .filter((tombstone) => (tombstone.clinicId || clinicId) === clinicId);
    };
    remote.upsertSyncTombstone = async function (clinicId, tombstone) {
      const nextTombstone = deepClone(tombstone);
      nextTombstone.clinicId = nextTombstone.clinicId || clinicId;
      this.syncTombstones[nextTombstone.key] = nextTombstone;
      return deepClone(nextTombstone);
    };
    remote.touchClinicSyncMarker = async function (clinicId, payload) {
      this.syncMarker = {
        clinicId,
        syncRevision: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        syncUpdatedAt: new Date().toISOString(),
        syncDeviceId: (payload && payload.deviceId) || "",
      };
      this.syncMarkerListeners.slice().forEach((listener) => {
        listener({
          clinicId,
          revision: this.syncMarker.syncRevision,
          updatedAt: this.syncMarker.syncUpdatedAt,
          deviceId: this.syncMarker.syncDeviceId,
          initial: false,
        });
      });
      return deepClone(this.syncMarker);
    };
    remote.subscribeClinicSyncMarker = function (clinicId, listener) {
      if (typeof listener !== "function") {
        return function () {};
      }

      const initialMarker = this.syncMarker
        ? {
            clinicId,
            revision: this.syncMarker.syncRevision,
            updatedAt: this.syncMarker.syncUpdatedAt,
            deviceId: this.syncMarker.syncDeviceId,
            initial: true,
          }
        : {
            clinicId,
            revision: null,
            updatedAt: null,
            deviceId: "",
            initial: true,
          };

      listener(initialMarker);
      this.syncMarkerListeners.push(listener);

      return () => {
        this.syncMarkerListeners = this.syncMarkerListeners.filter((current) => current !== listener);
      };
    };
    remote.deleteSessionRecord = async function (clinicId, sessionId) {
      const clinicNode = this.ensureClinicNode(clinicId);
      delete clinicNode.sessions[sessionId];
      return true;
    };

    return remote;
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}. Atteso: ${expected}. Ricevuto: ${actual}.`);
    }
  }

  async function expectMissing(promiseFactory, message) {
    let failed = false;

    try {
      await promiseFactory();
    } catch (error) {
      failed = true;
    }

    if (!failed) {
      throw new Error(message);
    }
  }

  async function createRepository(options) {
    const settings = options || {};
    const repository = new app.repositories.SyncedEmbryoRepository({
      defaultClinicId: TEST_CLINIC_ID,
      remoteRepository: settings.remoteRepository || null,
      stateStore: settings.stateStore || new MemoryStateStore(),
      seedLocalDemo: false,
      pollIntervalMs: Object.prototype.hasOwnProperty.call(settings, "pollIntervalMs") ? settings.pollIntervalMs : 0,
      syncOnWindowFocus: settings.syncOnWindowFocus === true,
      syncOnVisibility: settings.syncOnVisibility === true,
    });

    await repository.ready();
    return repository;
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function runTest(name, fn) {
    try {
      await fn();
      return {
        name,
        status: "pass",
        details: "OK",
      };
    } catch (error) {
      return {
        name,
        status: "fail",
        details: error && error.message ? error.message : String(error),
      };
    }
  }

  function renderResults(testResults) {
    const passed = testResults.filter((result) => result.status === "pass").length;
    const failed = testResults.length - passed;

    summaryNode.className = `summary ${failed ? "fail" : "pass"}`;
    summaryNode.innerHTML = `<strong>${passed}/${testResults.length} test superati</strong><span>${failed ? `${failed} falliti` : "nessun errore"}</span>`;

    resultsNode.innerHTML = testResults
      .map((result) => {
        return `
          <article class="test ${result.status}">
            <h2>${result.name}</h2>
            <pre>${result.details}</pre>
          </article>
        `;
      })
      .join("");
  }

  async function testLocalStateStoreFallback() {
    resetTestRuntime();

    const store = new app.repositories.LocalStateStore({
      dbName: "sync_smoke_test_store",
      stateKey: "state",
    });
    store.hasIndexedDb = function () {
      return false;
    };

    await store.save({
      hello: "world",
      count: 1,
    });

    const loaded = await store.load();

    assertEqual(loaded.hello, "world", "Il fallback storage non ha riletto il payload salvato");
    assertEqual(loaded.count, 1, "Il fallback storage ha perso i dati numerici");
  }

  async function testOfflineCreateThenOnlineSync() {
    resetTestRuntime();

    const remote = createRemoteRepository();
    const stateStore = new MemoryStateStore();
    const repository = await createRepository({
      remoteRepository: remote,
      stateStore,
    });

    const session = await repository.createSession({
      id: "session_alpha",
      clinicId: TEST_CLINIC_ID,
      name: "Sessione Alpha",
      code: "ALPHA",
    });
    const animal = await repository.createAnimal({
      id: "animal_alpha",
      clinicId: TEST_CLINIC_ID,
      sessionId: session.id,
      sessionName: session.name,
      animalCode: "OV-001",
      displayName: "OV-001",
    });
    const visit = await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_alpha_1",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-10T08:00:00.000Z",
    });

    assertEqual(repository.getSyncState().pendingCount, 3, "Le scritture offline non sono finite in coda");

    const localSession = await repository.getSession(TEST_CLINIC_ID, session.id);
    assertEqual(localSession.startDate, iso("2026-04-10T08:00:00.000Z"), "La data inizio sessione non e' stata calcolata dalla visita");
    assertEqual(localSession.endDate, iso("2026-04-10T08:00:00.000Z"), "La data fine sessione non e' stata calcolata dalla visita");

    window.__setEmbryoTestOnline(true);
    await repository.syncNow();

    const remoteSession = await remote.getSession(TEST_CLINIC_ID, session.id);
    const remoteAnimal = await remote.getAnimal(TEST_CLINIC_ID, animal.id);
    const remoteVisits = await remote.listAnimalVisits(TEST_CLINIC_ID, animal.id);

    assertEqual(remoteSession.name, "Sessione Alpha", "La sessione non e' arrivata sul repository remoto");
    assertEqual(remoteAnimal.displayName, "OV-001", "L'animale non e' arrivato sul repository remoto");
    assertEqual(remoteVisits.length, 1, "La visita non e' arrivata sul repository remoto");
    assertEqual(remoteVisits[0].id, visit.id, "La visita sincronizzata ha un id inatteso");
    assertEqual(repository.getSyncState().state, "synced", "Lo stato sync non e' tornato verde dopo la sincronizzazione");
  }

  async function testRemoteNewerWins() {
    resetTestRuntime();

    const remote = createRemoteRepository();
    const repository = await createRepository({
      remoteRepository: remote,
    });

    await repository.createAnimal({
      id: "animal_conflict",
      clinicId: TEST_CLINIC_ID,
      animalCode: "OV-C",
      displayName: "Locale",
    });

    remote.upsertAnimalRecord(TEST_CLINIC_ID, {
      id: "animal_conflict",
      clinicId: TEST_CLINIC_ID,
      sessionId: app.domain.modelUtils.UNASSIGNED_SESSION_ID,
      sessionName: app.domain.modelUtils.UNASSIGNED_SESSION_NAME,
      animalCode: "OV-C",
      displayName: "Remoto recente",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
      updatedBy: "remote_user",
      syncStatus: "synced",
    });

    window.__setEmbryoTestOnline(true);
    await repository.syncNow();

    const mergedAnimal = await repository.getAnimal(TEST_CLINIC_ID, "animal_conflict");

    assertEqual(mergedAnimal.displayName, "Remoto recente", "Nel conflitto non ha vinto il record remoto piu' recente");
    assertEqual(mergedAnimal.syncStatus, "synced", "Il record fuso non e' tornato in stato synced");
  }

  async function testVisitDeleteProducesRemoteTombstone() {
    resetTestRuntime();

    const remote = createRemoteRepository();
    const repository = await createRepository({
      remoteRepository: remote,
    });

    const animal = await repository.createAnimal({
      id: "animal_delete_visit",
      clinicId: TEST_CLINIC_ID,
      animalCode: "OV-DV",
      displayName: "OV-DV",
    });
    const visit = await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_delete_me",
      visitAt: "2026-04-11T08:30:00.000Z",
    });

    window.__setEmbryoTestOnline(true);
    await repository.syncNow();

    window.__setEmbryoTestOnline(false);
    await repository.deleteVisit(TEST_CLINIC_ID, animal.id, visit.id);

    assert(
      Boolean(repository.syncMeta.tombstones["visit:visit_delete_me"]),
      "La delete offline della visita non ha creato la tombstone locale"
    );

    window.__setEmbryoTestOnline(true);
    await repository.syncNow();

    const remoteVisits = await remote.listAnimalVisits(TEST_CLINIC_ID, animal.id);

    assertEqual(remoteVisits.length, 0, "La visita eliminata e' rimasta sul remoto");
    assert(
      Boolean(remote.syncTombstones["visit:visit_delete_me"]),
      "La tombstone della visita non e' stata sincronizzata sul remoto"
    );
  }

  async function testSessionDatesAndDeleteSessionWithoutAnimals() {
    resetTestRuntime();

    const repository = await createRepository();
    const session = await repository.createSession({
      id: "session_beta",
      clinicId: TEST_CLINIC_ID,
      name: "Sessione Beta",
      code: "BETA",
    });
    const animal = await repository.createAnimal({
      id: "animal_beta",
      clinicId: TEST_CLINIC_ID,
      sessionId: session.id,
      sessionName: session.name,
      animalCode: "OV-B",
      displayName: "OV-B",
    });
    const visitOne = await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_beta_1",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-01T08:00:00.000Z",
    });
    const visitTwo = await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_beta_2",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-20T08:00:00.000Z",
    });

    let currentSession = await repository.getSession(TEST_CLINIC_ID, session.id);
    assertEqual(currentSession.startDate, iso("2026-04-01T08:00:00.000Z"), "La startDate non corrisponde alla prima visita");
    assertEqual(currentSession.endDate, iso("2026-04-20T08:00:00.000Z"), "La endDate non corrisponde all'ultima visita");

    await repository.deleteVisit(TEST_CLINIC_ID, animal.id, visitTwo.id);
    currentSession = await repository.getSession(TEST_CLINIC_ID, session.id);
    assertEqual(currentSession.endDate, iso("2026-04-01T08:00:00.000Z"), "La endDate non si aggiorna dopo la delete dell'ultima visita");

    await repository.deleteVisit(TEST_CLINIC_ID, animal.id, visitOne.id);
    currentSession = await repository.getSession(TEST_CLINIC_ID, session.id);
    assertEqual(currentSession.startDate, null, "La startDate non torna null quando la sessione rimane senza visite");
    assertEqual(currentSession.endDate, null, "La endDate non torna null quando la sessione rimane senza visite");

    await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_beta_3",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-15T08:00:00.000Z",
    });

    const deleteResult = await repository.deleteSession(TEST_CLINIC_ID, session.id, {
      deleteAnimals: false,
    });
    const reassignedAnimal = await repository.getAnimal(TEST_CLINIC_ID, animal.id);
    const remainingVisits = await repository.listAnimalVisits(TEST_CLINIC_ID, animal.id);
    const unassignedSession = await repository.getSession(TEST_CLINIC_ID, app.domain.modelUtils.UNASSIGNED_SESSION_ID);

    assertEqual(deleteResult.deletedVisits, 1, "La delete sessione non ha rimosso le visite collegate");
    assertEqual(deleteResult.reassignedAnimals, 1, "La delete sessione non ha riassegnato l'animale");
    assertEqual(reassignedAnimal.sessionId, app.domain.modelUtils.UNASSIGNED_SESSION_ID, "L'animale non e' stato spostato su Da assegnare");
    assertEqual(remainingVisits.length, 0, "Le visite della sessione eliminata sono ancora presenti");
    assertEqual(unassignedSession.id, app.domain.modelUtils.UNASSIGNED_SESSION_ID, "La sessione Da assegnare non e' disponibile");
    await expectMissing(
      function () {
        return repository.getSession(TEST_CLINIC_ID, session.id);
      },
      "La sessione eliminata risulta ancora recuperabile"
    );
  }

  async function testDeletingAnimalRecomputesSessionDates() {
    resetTestRuntime();

    const repository = await createRepository();
    const session = await repository.createSession({
      id: "session_gamma",
      clinicId: TEST_CLINIC_ID,
      name: "Sessione Gamma",
      code: "GAMMA",
    });
    const animal = await repository.createAnimal({
      id: "animal_gamma",
      clinicId: TEST_CLINIC_ID,
      sessionId: session.id,
      sessionName: session.name,
      animalCode: "OV-G",
      displayName: "OV-G",
    });

    await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_gamma_1",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-12T08:00:00.000Z",
    });

    let currentSession = await repository.getSession(TEST_CLINIC_ID, session.id);
    assertEqual(currentSession.startDate, iso("2026-04-12T08:00:00.000Z"), "La sessione non ha registrato la visita prima della delete animale");
    assertEqual(currentSession.endDate, iso("2026-04-12T08:00:00.000Z"), "La sessione non ha registrato la visita prima della delete animale");

    await repository.deleteAnimal(TEST_CLINIC_ID, animal.id);
    currentSession = await repository.getSession(TEST_CLINIC_ID, session.id);

    assertEqual(currentSession.startDate, null, "La startDate non si aggiorna dopo la delete dell'animale");
    assertEqual(currentSession.endDate, null, "La endDate non si aggiorna dopo la delete dell'animale");
  }

  async function testBackupExportImportRoundTrip() {
    resetTestRuntime();

    const sourceRepository = await createRepository();
    const session = await sourceRepository.createSession({
      id: "session_backup",
      clinicId: TEST_CLINIC_ID,
      name: "Sessione Backup",
      code: "BKP",
    });
    const animal = await sourceRepository.createAnimal({
      id: "animal_backup",
      clinicId: TEST_CLINIC_ID,
      sessionId: session.id,
      sessionName: session.name,
      animalCode: "OV-BKP",
      displayName: "OV-BKP",
    });
    const visit = await sourceRepository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_backup_1",
      sessionId: session.id,
      sessionName: session.name,
      visitAt: "2026-04-16T09:00:00.000Z",
      summary: {
        headline: "Backup visit",
        shortText: "BKP",
      },
    });

    await sourceRepository.replaceVisitAttachments(TEST_CLINIC_ID, animal.id, visit.id, [
      {
        id: "attachment_backup_1",
        label: "report",
        kind: "image",
        url: "https://example.invalid/report.jpg",
      },
    ]);
    await sourceRepository.replaceProtocolEvents(TEST_CLINIC_ID, animal.id, visit.id, [
      {
        id: "event_backup_1",
        eventAt: "2026-04-16T09:10:00.000Z",
        eventType: "treatment",
        name: "PGF2a",
      },
    ]);
    await sourceRepository.savePregnancyCheck(TEST_CLINIC_ID, animal.id, {
      id: "check_backup_1",
      checkAt: "2026-04-17T09:00:00.000Z",
      status: "positive",
      embryoCount: 1,
    });

    const payload = await app.backup.buildBackupPayload(sourceRepository, TEST_CLINIC_ID);
    const targetRepository = await createRepository();
    const summary = await app.backup.importBackupPayload(targetRepository, TEST_CLINIC_ID, payload);
    const importedAnimal = await targetRepository.getAnimal(TEST_CLINIC_ID, animal.id);
    const importedVisits = await targetRepository.listAnimalVisits(TEST_CLINIC_ID, animal.id);
    const importedChecks = await targetRepository.listPregnancyChecks(TEST_CLINIC_ID, animal.id);

    assertEqual(summary.animals, 1, "Il riepilogo import backup non riporta il numero corretto di animali");
    assertEqual(importedAnimal.displayName, "OV-BKP", "L'animale non e' stato ripristinato dal backup");
    assertEqual(importedVisits.length, 1, "Le visite non sono state ripristinate dal backup");
    assertEqual((importedVisits[0].attachments || []).length, 1, "Gli allegati visita non sono stati ripristinati dal backup");
    assertEqual((importedVisits[0].events || []).length, 1, "Gli eventi visita non sono stati ripristinati dal backup");
    assertEqual(importedChecks.length, 1, "I controlli gravidanza non sono stati ripristinati dal backup");
  }

  async function testBackupPreservesOfflineTombstones() {
    resetTestRuntime();

    const sourceRepository = await createRepository();
    const animal = await sourceRepository.createAnimal({
      id: "animal_backup_delete",
      clinicId: TEST_CLINIC_ID,
      animalCode: "OV-BDEL",
      displayName: "OV-BDEL",
    });
    const visit = await sourceRepository.saveVisit(TEST_CLINIC_ID, animal.id, {
      id: "visit_backup_delete",
      visitAt: "2026-04-18T08:00:00.000Z",
    });

    await sourceRepository.deleteVisit(TEST_CLINIC_ID, animal.id, visit.id);

    const payload = await app.backup.buildBackupPayload(sourceRepository, TEST_CLINIC_ID);
    const targetRepository = await createRepository();

    await app.backup.importBackupPayload(targetRepository, TEST_CLINIC_ID, payload);

    assert(
      Boolean(targetRepository.syncMeta.tombstones["visit:visit_backup_delete"]),
      "La tombstone offline non e' stata ripristinata dal backup JSON"
    );
  }

  async function testRemoteChangesAutoRefreshOtherProfile() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const repositoryA = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });
    const repositoryB = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animal = await repositoryA.createAnimal({
        id: "animal_multi_profile",
        clinicId: TEST_CLINIC_ID,
        animalCode: "OV-MP",
        displayName: "OV-MP",
      });

      await repositoryA.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_multi_profile",
        visitAt: "2026-04-21T08:00:00.000Z",
      });
      await repositoryA.syncNow();
      await wait(950);

      const visits = await repositoryB.listAnimalVisits(TEST_CLINIC_ID, animal.id);

      assertEqual(visits.length, 1, "Il secondo profilo non ha recepito la visita remota senza sync manuale");
      assertEqual(visits[0].id, "visit_multi_profile", "La visita arrivata al secondo profilo e' inattesa");
    } finally {
      repositoryA.dispose();
      repositoryB.dispose();
    }
  }

  async function testLocalWriteDuringSyncIsNotLost() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const originalListAnimals = remote.listAnimals.bind(remote);
    remote.listAnimals = async function (clinicId) {
      await wait(220);
      return originalListAnimals(clinicId);
    };

    const repository = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animal = await repository.createAnimal({
        id: "animal_sync_race",
        clinicId: TEST_CLINIC_ID,
        animalCode: "OV-RACE",
        displayName: "OV-RACE",
      });
      await repository.syncNow();

      const inFlightSync = repository.syncNow();
      await wait(40);
      await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_sync_race_local",
        visitAt: "2026-04-22T08:00:00.000Z",
      });
      await inFlightSync;

      const localVisitsAfterSync = await repository.listAnimalVisits(TEST_CLINIC_ID, animal.id);

      assertEqual(localVisitsAfterSync.length, 1, "La visita scritta durante lo sync e' stata persa localmente");
      assertEqual(localVisitsAfterSync[0].id, "visit_sync_race_local", "La visita locale sopravvissuta e' inattesa");
      await wait(350);

      const remoteVisits = await remote.listAnimalVisits(TEST_CLINIC_ID, animal.id);
      assertEqual(repository.getSyncState().pendingCount, 0, "La visita scritta durante lo sync e' rimasta pendente");
      assertEqual(remoteVisits.length, 1, "La visita scritta durante lo sync non e' arrivata sul remoto col push mirato");
      assertEqual(remoteVisits[0].id, "visit_sync_race_local", "La visita remota sincronizzata e' inattesa");
    } finally {
      repository.dispose();
    }
  }

  async function testMultipleLocalWritesDuringSyncFlushTogether() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const originalListAnimals = remote.listAnimals.bind(remote);
    remote.listAnimals = async function (clinicId) {
      await wait(900);
      return originalListAnimals(clinicId);
    };

    const repository = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animal = await repository.createAnimal({
        id: "animal_sync_batch",
        clinicId: TEST_CLINIC_ID,
        animalCode: "OV-BATCH",
        displayName: "OV-BATCH",
      });
      await repository.syncNow();

      const inFlightSync = repository.syncNow();
      await wait(40);
      await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_sync_batch_1",
        visitAt: "2026-04-23T08:00:00.000Z",
      });
      await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_sync_batch_2",
        visitAt: "2026-04-23T08:10:00.000Z",
      });

      await wait(500);

      const remoteVisitsDuringSync = await remote.listAnimalVisits(TEST_CLINIC_ID, animal.id);
      const remoteIdsDuringSync = remoteVisitsDuringSync.map((visit) => visit.id).sort();

      assertEqual(repository.getSyncState().pendingCount, 0, "Le due visite non sono state svuotate dalla coda col push mirato");
      assertEqual(remoteIdsDuringSync.join(","), "visit_sync_batch_1,visit_sync_batch_2", "Le due visite non sono arrivate insieme sul remoto");

      await inFlightSync;
    } finally {
      repository.dispose();
    }
  }

  async function testBatchedDerivedRefreshForMultipleAnimals() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const counters = {
      saveVisitRecord: 0,
      saveVisit: 0,
      animalRollups: [],
      sessionRanges: [],
    };
    const originalSaveVisitRecord = remote.saveVisitRecord.bind(remote);
    const originalSaveVisit = remote.saveVisit.bind(remote);
    const originalRecomputeAnimalRollup = remote.recomputeAnimalRollup.bind(remote);
    const originalRecomputeSessionsDateRange = remote.recomputeSessionsDateRange.bind(remote);

    remote.saveVisitRecord = async function (clinicId, animalId, visitPayload) {
      counters.saveVisitRecord += 1;
      return originalSaveVisitRecord(clinicId, animalId, visitPayload);
    };
    remote.saveVisit = async function (clinicId, animalId, visitPayload) {
      counters.saveVisit += 1;
      return originalSaveVisit(clinicId, animalId, visitPayload);
    };
    remote.recomputeAnimalRollup = async function (clinicId, animalId) {
      counters.animalRollups.push(animalId);
      return originalRecomputeAnimalRollup(clinicId, animalId);
    };
    remote.recomputeSessionsDateRange = async function (clinicId, sessionIds) {
      counters.sessionRanges.push((sessionIds || []).slice().sort().join(","));
      return originalRecomputeSessionsDateRange(clinicId, sessionIds);
    };

    const repository = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animalIds = ["animal_batch_a", "animal_batch_b", "animal_batch_c", "animal_batch_d"];

      for (let index = 0; index < animalIds.length; index += 1) {
        await repository.createAnimal({
          id: animalIds[index],
          clinicId: TEST_CLINIC_ID,
          animalCode: `OV-BD-${index + 1}`,
          displayName: `OV-BD-${index + 1}`,
        });
      }

      await repository.syncNow();

      counters.saveVisitRecord = 0;
      counters.saveVisit = 0;
      counters.animalRollups = [];
      counters.sessionRanges = [];

      for (let index = 0; index < animalIds.length; index += 1) {
        await repository.saveVisit(TEST_CLINIC_ID, animalIds[index], {
          id: `visit_batch_derived_${index + 1}`,
          visitAt: `2026-04-24T08:0${index}:00.000Z`,
        });
      }

      await wait(900);

      const remoteVisitCounts = [];

      for (let index = 0; index < animalIds.length; index += 1) {
        const visits = await remote.listAnimalVisits(TEST_CLINIC_ID, animalIds[index]);
        remoteVisitCounts.push(visits.length);
      }

      assertEqual(counters.saveVisitRecord, 4, "Le visite non sono passate dal salvataggio remoto leggero");
      assertEqual(counters.saveVisit, 0, "Il push mirato ha usato ancora saveVisit con ricalcoli per ogni visita");
      assertEqual(counters.animalRollups.slice().sort().join(","), animalIds.slice().sort().join(","), "I rollup animali non sono stati raggruppati correttamente");
      assertEqual(counters.sessionRanges.length, 1, "Il range sessione e' stato ricalcolato piu' volte nello stesso flush");
      assertEqual(remoteVisitCounts.join(","), "1,1,1,1", "Non tutte le visite batch sono arrivate sul remoto");
      assertEqual(repository.getSyncState().pendingCount, 0, "Il batch con derivati raggruppati e' rimasto pendente");
    } finally {
      repository.dispose();
    }
  }

  async function testMatchedVisitStillRefreshesDerivedData() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const repository = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animal = await repository.createAnimal({
        id: "animal_partial_retry",
        clinicId: TEST_CLINIC_ID,
        animalCode: "OV-PR",
        displayName: "OV-PR",
      });
      await repository.syncNow();

      window.__setEmbryoTestOnline(false);

      await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_partial_retry",
        visitAt: "2026-04-25T08:00:00.000Z",
      });

      const localVisit = await repository.getVisit(TEST_CLINIC_ID, animal.id, "visit_partial_retry");

      await remote.saveVisitRecord(TEST_CLINIC_ID, animal.id, localVisit);

      const staleRemoteAnimal = await remote.getAnimal(TEST_CLINIC_ID, animal.id);

      assertEqual(staleRemoteAnimal.visitCount, 0, "Il setup del test non ha lasciato il rollup remoto arretrato");

      window.__setEmbryoTestOnline(true);
      await repository.flushQueuedLocalChanges({
        reason: "test-partial-retry",
      });

      const refreshedRemoteAnimal = await remote.getAnimal(TEST_CLINIC_ID, animal.id);
      const refreshedRemoteSession = await remote.getSession(TEST_CLINIC_ID, app.domain.modelUtils.UNASSIGNED_SESSION_ID);

      assertEqual(repository.getSyncState().pendingCount, 0, "Il retry con visita gia' presente e' rimasto pendente");
      assertEqual(refreshedRemoteAnimal.visitCount, 1, "Il rollup animale non e' stato recuperato dopo una scrittura primaria gia' presente");
      assertEqual(refreshedRemoteSession.startDate, iso("2026-04-25T08:00:00.000Z"), "La sessione non e' stata recuperata dopo una scrittura primaria gia' presente");
    } finally {
      repository.dispose();
    }
  }

  async function testTargetedFlushDoesNotOverwriteNewerRemoteVisit() {
    resetTestRuntime();
    window.__setEmbryoTestOnline(true);

    const remote = createRemoteRepository();
    const repository = await createRepository({
      remoteRepository: remote,
      pollIntervalMs: 0,
      syncOnWindowFocus: false,
      syncOnVisibility: false,
    });

    try {
      const animal = await repository.createAnimal({
        id: "animal_conflict_flush",
        clinicId: TEST_CLINIC_ID,
        animalCode: "OV-CF",
        displayName: "OV-CF",
      });
      await repository.syncNow();

      await remote.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_conflict_flush",
        visitAt: "2026-04-24T08:00:00.000Z",
        operatorName: "Remoto recente",
        updatedAt: "2030-01-01T00:00:00.000Z",
        updatedBy: "remote_user",
        syncStatus: "synced",
      });

      await repository.saveVisit(TEST_CLINIC_ID, animal.id, {
        id: "visit_conflict_flush",
        visitAt: "2026-04-24T08:00:00.000Z",
        operatorName: "Locale vecchio",
      });

      await wait(900);

      const localVisit = await repository.getVisit(TEST_CLINIC_ID, animal.id, "visit_conflict_flush");
      const remoteVisit = await remote.getVisit(TEST_CLINIC_ID, animal.id, "visit_conflict_flush");

      assertEqual(repository.getSyncState().pendingCount, 0, "Il conflitto sul push mirato non e' stato riconciliato");
      assertEqual(localVisit.operatorName, "Remoto recente", "La visita remota piu' recente non ha vinto localmente");
      assertEqual(remoteVisit.operatorName, "Remoto recente", "Il push mirato ha sovrascritto una visita remota piu' recente");
    } finally {
      repository.dispose();
    }
  }

  async function main() {
    const tests = [
      ["LocalStateStore usa fallback storage", testLocalStateStoreFallback],
      ["Create offline e sync online", testOfflineCreateThenOnlineSync],
      ["Merge: vince il remoto piu' recente", testRemoteNewerWins],
      ["Delete visita genera tombstone remota", testVisitDeleteProducesRemoteTombstone],
      ["Date sessione e delete sessione senza animali", testSessionDatesAndDeleteSessionWithoutAnimals],
      ["Delete animale aggiorna date sessione", testDeletingAnimalRecomputesSessionDates],
      ["Backup JSON export/import ripristina i record", testBackupExportImportRoundTrip],
      ["Backup JSON conserva le tombstone offline", testBackupPreservesOfflineTombstones],
      ["Nuovi dati remoti arrivano anche senza sync manuale", testRemoteChangesAutoRefreshOtherProfile],
      ["Scritture locali durante uno sync non vengono perse", testLocalWriteDuringSyncIsNotLost],
      ["Scritture locali multiple durante sync escono insieme", testMultipleLocalWritesDuringSyncFlushTogether],
      ["Derivati raggruppati su visite di animali diversi", testBatchedDerivedRefreshForMultipleAnimals],
      ["Derivati recuperati dopo scrittura primaria gia' presente", testMatchedVisitStillRefreshesDerivedData],
      ["Push mirato non sovrascrive remoto piu' recente", testTargetedFlushDoesNotOverwriteNewerRemoteVisit],
    ];
    const testResults = [];

    for (let index = 0; index < tests.length; index += 1) {
      const current = tests[index];
      testResults.push(await runTest(current[0], current[1]));
    }

    renderResults(testResults);
    window.__syncSmokeTestResults = testResults;
  }

  main();
})();
