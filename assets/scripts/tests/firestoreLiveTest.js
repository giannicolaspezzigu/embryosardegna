(function () {
  const app = window.EmbryoApp;
  const summaryNode = document.getElementById("summary");
  const resultsNode = document.getElementById("results");
  const progress = [];

  function setProgress(message) {
    progress.push(message);
    if (summaryNode) {
      summaryNode.innerHTML = `<strong>${message}</strong><div>${progress.join(" | ")}</div>`;
    }
  }

  if (summaryNode) {
    summaryNode.innerHTML = "<strong>Script live test caricato...</strong>";
  }

  window.addEventListener("error", function (event) {
    if (!summaryNode) {
      return;
    }

    summaryNode.className = "summary fail";
    summaryNode.innerHTML = `<strong>Errore script</strong><div>${event.message || "Errore sconosciuto"}</div>`;
  });

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

  function createResult(name, status, details) {
    return {
      name,
      status,
      details,
    };
  }

  function renderResults(results) {
    const failed = results.filter((item) => item.status !== "pass");
    const summaryClass = failed.length ? "fail" : "pass";

    summaryNode.className = `summary ${summaryClass}`;
    summaryNode.innerHTML = failed.length
      ? `<strong>${results.length - failed.length}/${results.length} verifiche superate</strong><div>${failed.length} errori</div>`
      : `<strong>${results.length}/${results.length} verifiche superate</strong><div>clinic_sync_test pronta per test reali</div>`;

    resultsNode.innerHTML = results
      .map((result) => {
        return `<article class="result ${result.status}"><strong>${result.name}</strong><pre>${result.details}</pre></article>`;
      })
      .join("");
  }

  async function runCheck(name, fn) {
    try {
      const details = await fn();
      return createResult(name, "pass", details || "OK");
    } catch (error) {
      return createResult(name, "fail", error && error.message ? error.message : String(error));
    }
  }

  async function seedAndVerify() {
    const runtimeConfig = window.EmbryoRuntimeConfig || {};
    const clinicId = runtimeConfig.clinicId || "clinic_main";
    const repository = new app.repositories.FirestoreEmbryoRepository({
      defaultClinicId: clinicId,
      config: runtimeConfig.firebase.config,
      enableOffline: false,
    });

    setProgress("wait firestore.ready");
    await repository.ready();
    setProgress("firestore.ready ok");

    assertEqual(clinicId, "clinic_sync_test", "Il test live non sta usando la clinica di prova");
    assert(repository && repository.name === "firestore", "Repository Firestore remoto non disponibile");

    setProgress("create session");
    const baseSession = await repository.createSession({
      id: "session_live_sync_test",
      clinicId,
      name: "Sessione test sync live",
      code: "LIVE-SYNC",
      notes: "Dataset di test generato automaticamente dalla copia locale",
      updatedBy: "codex_live_test",
    });
    setProgress("create animal donor");
    const donorAnimal = await repository.createAnimal({
      id: "animal_live_sync_ov_001",
      clinicId,
      sessionId: baseSession.id,
      sessionName: baseSession.name,
      animalCode: "TEST-SYNC-001",
      displayName: "TEST-SYNC-001",
      species: "ovine",
      breed: "Sarda",
      farmName: "Clinic Sync Test",
      reproductiveRole: "donor",
      updatedBy: "codex_live_test",
    });
    setProgress("create animal recipient");
    const recipientAnimal = await repository.createAnimal({
      id: "animal_live_sync_ov_002",
      clinicId,
      sessionId: baseSession.id,
      sessionName: baseSession.name,
      animalCode: "TEST-SYNC-002",
      displayName: "TEST-SYNC-002",
      species: "ovine",
      breed: "Sarda",
      farmName: "Clinic Sync Test",
      reproductiveRole: "recipient",
      updatedBy: "codex_live_test",
    });

    setProgress("write probe tombstone");
    await repository.upsertSyncTombstone(clinicId, {
      key: "visit:visit_live_sync_probe_delete",
      entityType: "visit",
      entityId: "visit_live_sync_probe_delete",
      clinicId,
      animalId: donorAnimal.id,
      visitId: "visit_live_sync_probe_delete",
      deletedAt: new Date("2026-04-23T10:05:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-23T10:05:00.000Z").toISOString(),
      updatedBy: "codex_live_test",
      deviceId: "live_test_probe",
    });

    setProgress("read remote clinic");
    const remoteClinic = await repository.getClinic(clinicId);
    setProgress("read remote sessions");
    const remoteSessions = await repository.listSessions(clinicId);
    setProgress("read remote animals");
    const remoteAnimals = await repository.listAnimals(clinicId);
    setProgress("read remote tombstones");
    const remoteTombstones = await repository.listSyncTombstones(clinicId);
    const probeTombstone = remoteTombstones.find((item) => item && item.key === "visit:visit_live_sync_probe_delete");
    setProgress("read remote session detail");
    const remoteSession = await repository.getSession(clinicId, baseSession.id);

    return {
      clinicId,
      remoteClinic,
      remoteSessions,
      remoteAnimals,
      remoteTombstones,
      probeTombstone,
      remoteSession,
      repositoryMode: repository.name,
    };
  }

  async function main() {
    const results = [];
    let snapshot = null;

    setProgress("main avviato");

    results.push(
      await runCheck("Bootstrap repository sync su clinica test", async function () {
        const runtimeConfig = window.EmbryoRuntimeConfig || {};
        setProgress("runtime config letta");
        assertEqual(runtimeConfig.clinicId, "clinic_sync_test", "clinicId locale inatteso");
        assert(runtimeConfig.firebase && runtimeConfig.firebase.enabled, "Firebase non abilitato nel runtime config");
        return `provider=${runtimeConfig.provider}, clinicId=${runtimeConfig.clinicId}`;
      })
    );

    results.push(
      await runCheck("Seed dati reali su Firestore test", async function () {
        setProgress("seed firestore");
        snapshot = await seedAndVerify();
        setProgress("seed firestore completato");
        return `Clinica=${snapshot.clinicId}, sessioni=${snapshot.remoteSessions.length}, animali=${snapshot.remoteAnimals.length}, tombstones=${snapshot.remoteTombstones.length}`;
      })
    );

    results.push(
      await runCheck("Sessione e animali seed presenti sul remoto", async function () {
        assert(snapshot, "Snapshot remoto assente");
        assertEqual(snapshot.remoteClinic.id, "clinic_sync_test", "La clinica remota letta non corrisponde");
        assert(snapshot.remoteSessions.some((item) => item.id === "session_live_sync_test"), "La sessione seed non e presente sul remoto");
        assert(snapshot.remoteAnimals.some((item) => item.id === "animal_live_sync_ov_001"), "L'animale donor seed non e presente sul remoto");
        assert(snapshot.remoteAnimals.some((item) => item.id === "animal_live_sync_ov_002"), "L'animale recipient seed non e presente sul remoto");
        return "Sessione e animali seed confermati sul Firestore di test";
      })
    );

    results.push(
      await runCheck("syncTombstones scrivibile e leggibile", async function () {
        assert(snapshot, "Snapshot remoto assente");
        assert(snapshot.probeTombstone, "Tombstone probe non trovata sul remoto");
        assertEqual(snapshot.probeTombstone.entityType, "visit", "entityType tombstone inatteso");
        assertEqual(snapshot.probeTombstone.entityId, "visit_live_sync_probe_delete", "entityId tombstone inatteso");
        return `Tombstone key=${snapshot.probeTombstone.key}`;
      })
    );

    results.push(
      await runCheck("Date sessione remota aggiornate", async function () {
        assert(snapshot, "Snapshot remoto assente");
        assertEqual(snapshot.remoteSession.startDate, null, "startDate remota inattesa");
        assertEqual(snapshot.remoteSession.endDate, null, "endDate remota inattesa");
        return `startDate=${snapshot.remoteSession.startDate}, endDate=${snapshot.remoteSession.endDate}`;
      })
    );

    setProgress("render risultati");
    renderResults(results);
    window.__firestoreLiveTestResults = results;
  }

  main().catch((error) => {
    renderResults([
      createResult("Errore generale test Firestore live", "fail", error && error.message ? error.message : String(error)),
    ]);
  });
})();
