(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  function sortByDateDesc(items, fieldName) {
    return items.sort((left, right) => {
      return new Date(right[fieldName]).getTime() - new Date(left[fieldName]).getTime();
    });
  }

  function clone(value) {
    return app.domain.helpers.deepClone(value);
  }

  function getRecordSessionId(record) {
    return (record && record.sessionId) || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
  }

  function getVisitTimestamp(visit) {
    const timestamp = visit && visit.visitAt ? new Date(visit.visitAt).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function createUnassignedSessionRecord(clinicId) {
    return app.domain.normalizers.session(
      app.domain.helpers.mergeDeep(app.domain.models.createUnassignedSessionTemplate(), {
        clinicId,
      })
    );
  }

  function hasFirebaseConfig(config) {
    return Boolean(config && config.apiKey && config.projectId && config.appId);
  }

  function getFirebaseGlobal() {
    return window.firebase || null;
  }

  function createFirebaseApp(firebaseGlobal, config) {
    if (firebaseGlobal.apps && firebaseGlobal.apps.length > 0) {
      return firebaseGlobal.apps[0];
    }

    return firebaseGlobal.initializeApp(config);
  }

  async function deleteCollection(collectionRef) {
    const snapshot = await collectionRef.get();

    for (let index = 0; index < snapshot.docs.length; index += 1) {
      await snapshot.docs[index].ref.delete();
    }
  }

  function FirestoreEmbryoRepository(options) {
    const settings = options || {};
    const firebaseGlobal = getFirebaseGlobal();

    if (!firebaseGlobal || typeof firebaseGlobal.initializeApp !== "function") {
      throw new Error("Firebase SDK non disponibile nella pagina.");
    }

    if (!hasFirebaseConfig(settings.config)) {
      throw new Error("Configurazione Firebase incompleta.");
    }

    createFirebaseApp(firebaseGlobal, settings.config);

    this.name = "firestore";
    this.defaultClinicId = settings.defaultClinicId || "clinic_main";
    this.firebase = firebaseGlobal;
    this.db = firebaseGlobal.firestore();
    this.readyPromise = Promise.resolve();

    if (settings.enableOffline !== false && typeof this.db.enablePersistence === "function") {
      this.readyPromise = this.db
        .enablePersistence({ synchronizeTabs: true })
        .catch(() => Promise.resolve());
    }
  }

  FirestoreEmbryoRepository.prototype.ready = async function () {
    await this.readyPromise;
  };

  FirestoreEmbryoRepository.prototype.clinicRef = function (clinicId) {
    return this.db.collection("clinics").doc(clinicId || this.defaultClinicId);
  };

  FirestoreEmbryoRepository.prototype.animalsCollection = function (clinicId) {
    return this.clinicRef(clinicId).collection("animals");
  };

  FirestoreEmbryoRepository.prototype.sessionsCollection = function (clinicId) {
    return this.clinicRef(clinicId).collection("sessions");
  };

  FirestoreEmbryoRepository.prototype.sessionRef = function (clinicId, sessionId) {
    return this.sessionsCollection(clinicId).doc(sessionId);
  };

  FirestoreEmbryoRepository.prototype.animalRef = function (clinicId, animalId) {
    return this.animalsCollection(clinicId).doc(animalId);
  };

  FirestoreEmbryoRepository.prototype.visitsCollection = function (clinicId, animalId) {
    return this.animalRef(clinicId, animalId).collection("visits");
  };

  FirestoreEmbryoRepository.prototype.visitRef = function (clinicId, animalId, visitId) {
    return this.visitsCollection(clinicId, animalId).doc(visitId);
  };

  FirestoreEmbryoRepository.prototype.attachmentsCollection = function (clinicId, animalId, visitId) {
    return this.visitRef(clinicId, animalId, visitId).collection("attachments");
  };

  FirestoreEmbryoRepository.prototype.eventsCollection = function (clinicId, animalId, visitId) {
    return this.visitRef(clinicId, animalId, visitId).collection("events");
  };

  FirestoreEmbryoRepository.prototype.pregnancyChecksCollection = function (clinicId, animalId) {
    return this.animalRef(clinicId, animalId).collection("pregnancyChecks");
  };

  FirestoreEmbryoRepository.prototype.buildVisitWithRelations = async function (clinicId, animalId, visitDoc) {
    const visitRecord = app.domain.normalizers.visit(visitDoc.data());
    const [attachmentsSnap, eventsSnap] = await Promise.all([
      this.attachmentsCollection(clinicId, animalId, visitRecord.id).get(),
      this.eventsCollection(clinicId, animalId, visitRecord.id).get(),
    ]);

    visitRecord.attachments = attachmentsSnap.docs.map((doc) => app.domain.normalizers.attachment(doc.data()));
    visitRecord.events = sortByDateDesc(
      eventsSnap.docs.map((doc) => app.domain.normalizers.protocolEvent(doc.data())),
      "eventAt"
    );

    return visitRecord;
  };

  FirestoreEmbryoRepository.prototype.ensureUnassignedSession = async function (clinicId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const session = createUnassignedSessionRecord(resolvedClinicId);
    const ref = this.sessionRef(resolvedClinicId, session.id);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      await ref.set(session);
      return session;
    }

    return app.domain.normalizers.session(snapshot.data());
  };

  FirestoreEmbryoRepository.prototype.updateAnimalVisitsSession = async function (clinicId, animalId, session) {
    const snapshot = await this.visitsCollection(clinicId, animalId).get();

    for (let index = 0; index < snapshot.docs.length; index += 1) {
      const doc = snapshot.docs[index];
      const normalizedVisit = app.domain.normalizers.visit(
        app.domain.helpers.mergeDeep(doc.data(), {
          sessionId: session.id,
          sessionName: session.name,
          updatedAt: app.domain.modelUtils.nowIso(),
        })
      );

      await doc.ref.set(normalizedVisit);
    }
  };

  FirestoreEmbryoRepository.prototype.updateSessionReferences = async function (clinicId, session) {
    const snapshot = await this.animalsCollection(clinicId).get();

    for (let index = 0; index < snapshot.docs.length; index += 1) {
      const doc = snapshot.docs[index];
      const animal = app.domain.normalizers.animal(doc.data());

      if (animal.sessionId !== session.id) {
        continue;
      }

      const nextAnimal = app.domain.normalizers.animal(
        app.domain.helpers.mergeDeep(animal, {
          sessionName: session.name,
          updatedAt: app.domain.modelUtils.nowIso(),
        })
      );

      await doc.ref.set(nextAnimal);
      await this.updateAnimalVisitsSession(clinicId, animal.id, session);
    }
  };

  FirestoreEmbryoRepository.prototype.recomputeAnimalRollup = async function (clinicId, animalId) {
    const animalSnapshot = await this.animalRef(clinicId, animalId).get();

    if (!animalSnapshot.exists) {
      return;
    }

    const animalRecord = app.domain.normalizers.animal(animalSnapshot.data());
    const visits = await this.listAnimalVisits(clinicId, animalId);
    const latestVisit = visits[0] || null;
    const mergedAnimal = app.domain.helpers.mergeDeep(animalRecord, {
      visitCount: visits.length,
      lastVisitAt: latestVisit ? latestVisit.visitAt : null,
      lastVisitId: latestVisit ? latestVisit.id : null,
      lastVisitSummary: latestVisit ? app.domain.normalizers.animalSnapshotFromVisit(latestVisit) : null,
      updatedAt: app.domain.modelUtils.nowIso(),
    });

    await this.animalRef(clinicId, animalId).set(app.domain.normalizers.animal(mergedAnimal));
  };

  FirestoreEmbryoRepository.prototype.recomputeSessionDateRange = async function (clinicId, sessionId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
    let session = null;

    await this.ready();

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      session = await this.ensureUnassignedSession(resolvedClinicId);
    } else {
      const sessionSnapshot = await this.sessionRef(resolvedClinicId, resolvedSessionId).get();

      if (!sessionSnapshot.exists) {
        return null;
      }

      session = app.domain.normalizers.session(sessionSnapshot.data());
    }

    const timestamps = [];
    const animalSnapshot = await this.animalsCollection(resolvedClinicId).get();

    for (let index = 0; index < animalSnapshot.docs.length; index += 1) {
      const animal = app.domain.normalizers.animal(animalSnapshot.docs[index].data());
      const visitsSnapshot = await this.visitsCollection(resolvedClinicId, animal.id).get();

      visitsSnapshot.docs.forEach((visitDoc) => {
        const visit = app.domain.normalizers.visit(visitDoc.data());

        if (getRecordSessionId(visit) !== resolvedSessionId) {
          return;
        }

        const timestamp = getVisitTimestamp(visit);

        if (timestamp !== null) {
          timestamps.push(timestamp);
        }
      });
    }

    timestamps.sort((left, right) => left - right);

    const nextStartDate = timestamps.length ? new Date(timestamps[0]).toISOString() : null;
    const nextEndDate = timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;

    if ((session.startDate || null) === nextStartDate && (session.endDate || null) === nextEndDate) {
      return session;
    }

    const normalizedSession = app.domain.normalizers.session(
      app.domain.helpers.mergeDeep(session, {
        startDate: nextStartDate,
        endDate: nextEndDate,
        updatedAt: app.domain.modelUtils.nowIso(),
      })
    );

    await this.sessionRef(resolvedClinicId, resolvedSessionId).set(normalizedSession);
    return normalizedSession;
  };

  FirestoreEmbryoRepository.prototype.recomputeSessionsDateRange = async function (clinicId, sessionIds) {
    const uniqueSessionIds = Array.from(new Set((sessionIds || []).filter(Boolean)));

    for (let index = 0; index < uniqueSessionIds.length; index += 1) {
      await this.recomputeSessionDateRange(clinicId, uniqueSessionIds[index]);
    }
  };

  FirestoreEmbryoRepository.prototype.recomputeAllSessionDateRanges = async function (clinicId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;

    await this.ready();
    await this.ensureUnassignedSession(resolvedClinicId);

    const snapshot = await this.sessionsCollection(resolvedClinicId).get();
    await this.recomputeSessionsDateRange(
      resolvedClinicId,
      snapshot.docs.map((doc) => doc.id)
    );
  };

  FirestoreEmbryoRepository.prototype.getClinic = async function (clinicId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const ref = this.clinicRef(resolvedClinicId);

    await this.ready();

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      const clinic = app.domain.normalizers.clinic({
        id: resolvedClinicId,
        name: "Embryo Sardegna",
      });

      await ref.set(clinic);
      return clinic;
    }

    return app.domain.normalizers.clinic(snapshot.data());
  };

  FirestoreEmbryoRepository.prototype.listSessions = async function (clinicId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const fallbackSession = createUnassignedSessionRecord(resolvedClinicId);

    await this.ready();
    await this.getClinic(resolvedClinicId);

    try {
      await this.ensureUnassignedSession(resolvedClinicId);
    } catch (error) {
      console.warn("Unassigned session could not be persisted; using virtual fallback.", error);
    }

    let sessions = [];

    try {
      const snapshot = await this.sessionsCollection(resolvedClinicId).get();
      sessions = snapshot.docs.map((doc) => app.domain.normalizers.session(doc.data()));
    } catch (error) {
      console.warn("Sessions collection unavailable; using virtual fallback.", error);
      sessions = [];
    }

    if (!sessions.some((session) => session.id === fallbackSession.id)) {
      sessions.unshift(fallbackSession);
    }

    return sessions.sort((left, right) => {
      if (left.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
        return -1;
      }

      if (right.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
        return 1;
      }

      return left.name.localeCompare(right.name, "it");
    });
  };

  FirestoreEmbryoRepository.prototype.getSession = async function (clinicId, sessionId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    await this.ready();

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      try {
        return await this.ensureUnassignedSession(resolvedClinicId);
      } catch (error) {
        console.warn("Unassigned session could not be loaded; using virtual fallback.", error);
        return createUnassignedSessionRecord(resolvedClinicId);
      }
    }

    const snapshot = await this.sessionRef(resolvedClinicId, resolvedSessionId).get();

    if (!snapshot.exists) {
      throw new Error(`Session not found: ${resolvedSessionId}`);
    }

    return app.domain.normalizers.session(snapshot.data());
  };

  FirestoreEmbryoRepository.prototype.createSession = async function (payload) {
    const normalizedSession = app.domain.normalizers.session(payload);

    await this.ready();
    await this.getClinic(normalizedSession.clinicId);
    await this.ensureUnassignedSession(normalizedSession.clinicId);
    await this.sessionRef(normalizedSession.clinicId, normalizedSession.id).set(normalizedSession);

    return this.getSession(normalizedSession.clinicId, normalizedSession.id);
  };

  FirestoreEmbryoRepository.prototype.updateSession = async function (sessionId, patch, options) {
    const settings = options || {};
    const clinicId = settings.clinicId || this.defaultClinicId;
    const existingSession = await this.getSession(clinicId, sessionId);
    const mergedSession = app.domain.helpers.mergeDeep(existingSession, patch || {});
    const normalizedSession = app.domain.normalizers.session(mergedSession);

    await this.sessionRef(clinicId, sessionId).set(normalizedSession);

    if (existingSession.name !== normalizedSession.name) {
      await this.updateSessionReferences(clinicId, normalizedSession);
    }

    return this.getSession(clinicId, sessionId);
  };

  FirestoreEmbryoRepository.prototype.deleteSession = async function (clinicId, sessionId, options) {
    const settings = options || {};
    const resolvedClinicId = clinicId || this.defaultClinicId;
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      throw new Error("Cannot delete the unassigned session");
    }

    await this.ready();
    await this.getSession(resolvedClinicId, resolvedSessionId);

    const unassignedSession = await this.ensureUnassignedSession(resolvedClinicId);
    const animals = await this.listAnimals(resolvedClinicId);
    const result = {
      sessionId: resolvedSessionId,
      deletedAnimals: 0,
      deletedVisits: 0,
      reassignedAnimals: 0,
    };

    for (let index = 0; index < animals.length; index += 1) {
      const animal = animals[index];
      const animalBelongsToSession = getRecordSessionId(animal) === resolvedSessionId;
      const visits = await this.listAnimalVisits(resolvedClinicId, animal.id);

      if (settings.deleteAnimals && animalBelongsToSession) {
        result.deletedVisits += visits.length;
        await this.deleteAnimal(resolvedClinicId, animal.id);
        result.deletedAnimals += 1;
        continue;
      }

      let animalChanged = false;

      for (let visitIndex = 0; visitIndex < visits.length; visitIndex += 1) {
        const visit = visits[visitIndex];

        if (animalBelongsToSession || getRecordSessionId(visit) === resolvedSessionId) {
          await this.deleteVisit(resolvedClinicId, animal.id, visit.id);
          result.deletedVisits += 1;
          animalChanged = true;
        }
      }

      if (animalBelongsToSession) {
        await this.updateAnimal(
          animal.id,
          {
            sessionId: unassignedSession.id,
            sessionName: unassignedSession.name,
            updatedBy: "demo_user",
          },
          { clinicId: resolvedClinicId }
        );
        result.reassignedAnimals += 1;
        animalChanged = true;
      }

      if (animalChanged) {
        await this.recomputeAnimalRollup(resolvedClinicId, animal.id);
      }
    }

    await this.sessionRef(resolvedClinicId, resolvedSessionId).delete();
    await this.ensureUnassignedSession(resolvedClinicId);
    return result;
  };

  FirestoreEmbryoRepository.prototype.listAnimals = async function (clinicId) {
    await this.ready();

    const snapshot = await this.animalsCollection(clinicId).get();
    const animals = snapshot.docs.map((doc) => app.domain.normalizers.animal(doc.data()));

    return animals.sort((left, right) => {
      const leftTimestamp = left.lastVisitAt ? new Date(left.lastVisitAt).getTime() : 0;
      const rightTimestamp = right.lastVisitAt ? new Date(right.lastVisitAt).getTime() : 0;

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      return left.animalCode.localeCompare(right.animalCode);
    });
  };

  FirestoreEmbryoRepository.prototype.createAnimal = async function (payload) {
    const normalizedAnimal = app.domain.normalizers.animal(payload);

    await this.ready();
    await this.getClinic(normalizedAnimal.clinicId);
    await this.animalRef(normalizedAnimal.clinicId, normalizedAnimal.id).set(normalizedAnimal);

    return this.getAnimal(normalizedAnimal.clinicId, normalizedAnimal.id);
  };

  FirestoreEmbryoRepository.prototype.updateAnimal = async function (animalId, patch, options) {
    const settings = options || {};
    const clinicId = settings.clinicId || this.defaultClinicId;
    const existingAnimal = await this.getAnimal(clinicId, animalId);
    const mergedAnimal = app.domain.helpers.mergeDeep(existingAnimal, patch || {});

    if (patch && patch.sessionId && !patch.sessionName) {
      const session = await this.getSession(clinicId, patch.sessionId);
      mergedAnimal.sessionName = session.name;
    }

    const normalizedAnimal = app.domain.normalizers.animal(mergedAnimal);

    await this.animalRef(clinicId, animalId).set(normalizedAnimal);

    if (existingAnimal.sessionId !== normalizedAnimal.sessionId || existingAnimal.sessionName !== normalizedAnimal.sessionName) {
      await this.updateAnimalVisitsSession(clinicId, animalId, {
        id: normalizedAnimal.sessionId,
        name: normalizedAnimal.sessionName,
      });
      await this.recomputeSessionsDateRange(clinicId, [existingAnimal.sessionId, normalizedAnimal.sessionId]);
    }

    return this.getAnimal(clinicId, animalId);
  };

  FirestoreEmbryoRepository.prototype.assignAnimalSession = async function (clinicId, animalId, sessionId) {
    const session = await this.getSession(clinicId, sessionId);

    return this.updateAnimal(
      animalId,
      {
        sessionId: session.id,
        sessionName: session.name,
        updatedBy: "demo_user",
      },
      { clinicId }
    );
  };

  FirestoreEmbryoRepository.prototype.getAnimal = async function (clinicId, animalId) {
    await this.ready();

    const snapshot = await this.animalRef(clinicId, animalId).get();

    if (!snapshot.exists) {
      throw new Error(`Animal not found: ${animalId}`);
    }

    return app.domain.normalizers.animal(snapshot.data());
  };

  FirestoreEmbryoRepository.prototype.deleteAnimal = async function (clinicId, animalId) {
    const visits = await this.listAnimalVisits(clinicId, animalId);
    const pregnancyChecks = await this.listPregnancyChecks(clinicId, animalId);

    for (let index = 0; index < visits.length; index += 1) {
      await this.deleteVisit(clinicId, animalId, visits[index].id);
    }

    for (let index = 0; index < pregnancyChecks.length; index += 1) {
      await this.pregnancyChecksCollection(clinicId, animalId).doc(pregnancyChecks[index].id).delete();
    }

    await this.animalRef(clinicId, animalId).delete();
    return true;
  };

  FirestoreEmbryoRepository.prototype.listAnimalVisits = async function (clinicId, animalId) {
    await this.ready();

    const snapshot = await this.visitsCollection(clinicId, animalId).get();
    const visits = [];

    for (let index = 0; index < snapshot.docs.length; index += 1) {
      visits.push(await this.buildVisitWithRelations(clinicId, animalId, snapshot.docs[index]));
    }

    return sortByDateDesc(visits, "visitAt");
  };

  FirestoreEmbryoRepository.prototype.getVisit = async function (clinicId, animalId, visitId) {
    await this.ready();

    const snapshot = await this.visitRef(clinicId, animalId, visitId).get();

    if (!snapshot.exists) {
      throw new Error(`Visit not found: ${visitId}`);
    }

    return this.buildVisitWithRelations(clinicId, animalId, snapshot);
  };

  FirestoreEmbryoRepository.prototype.saveVisit = async function (clinicId, animalId, visitPayload) {
    const animalRecord = await this.getAnimal(clinicId, animalId);
    const normalizedVisit = app.domain.normalizers.visit(
      app.domain.helpers.mergeDeep(visitPayload || {}, {
        clinicId,
        sessionId: (visitPayload && visitPayload.sessionId) || animalRecord.sessionId,
        sessionName: (visitPayload && visitPayload.sessionName) || animalRecord.sessionName,
        animalId,
      })
    );

    await this.ready();
    const visitRef = this.visitRef(clinicId, animalId, normalizedVisit.id);
    const existingSnapshot = await visitRef.get();
    const previousSessionId = existingSnapshot.exists ? getRecordSessionId(existingSnapshot.data()) : null;

    await visitRef.set(normalizedVisit);
    await this.recomputeAnimalRollup(clinicId, animalId);
    await this.recomputeSessionsDateRange(clinicId, [previousSessionId, normalizedVisit.sessionId]);

    return this.getVisit(clinicId, animalId, normalizedVisit.id);
  };

  FirestoreEmbryoRepository.prototype.deleteVisit = async function (clinicId, animalId, visitId) {
    await this.ready();
    const visitRef = this.visitRef(clinicId, animalId, visitId);
    const visitSnapshot = await visitRef.get();
    const deletedSessionId = visitSnapshot.exists ? getRecordSessionId(visitSnapshot.data()) : null;

    await deleteCollection(this.attachmentsCollection(clinicId, animalId, visitId));
    await deleteCollection(this.eventsCollection(clinicId, animalId, visitId));
    await visitRef.delete();
    await this.recomputeAnimalRollup(clinicId, animalId);

    if (deletedSessionId) {
      await this.recomputeSessionDateRange(clinicId, deletedSessionId);
    }

    return true;
  };

  FirestoreEmbryoRepository.prototype.listPregnancyChecks = async function (clinicId, animalId) {
    await this.ready();

    const snapshot = await this.pregnancyChecksCollection(clinicId, animalId).get();
    const checks = snapshot.docs.map((doc) => app.domain.normalizers.pregnancyCheck(doc.data()));

    return sortByDateDesc(checks, "checkAt");
  };

  FirestoreEmbryoRepository.prototype.savePregnancyCheck = async function (clinicId, animalId, payload) {
    const normalizedCheck = app.domain.normalizers.pregnancyCheck(payload);

    await this.ready();
    await this.pregnancyChecksCollection(clinicId, animalId).doc(normalizedCheck.id).set(normalizedCheck);

    return clone(normalizedCheck);
  };

  FirestoreEmbryoRepository.prototype.saveVisitAttachment = async function (clinicId, animalId, visitId, payload) {
    const normalizedAttachment = app.domain.normalizers.attachment(payload);

    await this.ready();
    await this.attachmentsCollection(clinicId, animalId, visitId).doc(normalizedAttachment.id).set(normalizedAttachment);

    return clone(normalizedAttachment);
  };

  FirestoreEmbryoRepository.prototype.replaceVisitAttachments = async function (clinicId, animalId, visitId, payloads) {
    await this.ready();
    await deleteCollection(this.attachmentsCollection(clinicId, animalId, visitId));

    for (let index = 0; index < (payloads || []).length; index += 1) {
      await this.saveVisitAttachment(clinicId, animalId, visitId, payloads[index]);
    }

    const snapshot = await this.attachmentsCollection(clinicId, animalId, visitId).get();
    return snapshot.docs.map((doc) => app.domain.normalizers.attachment(doc.data()));
  };

  FirestoreEmbryoRepository.prototype.saveProtocolEvent = async function (clinicId, animalId, visitId, payload) {
    const normalizedEvent = app.domain.normalizers.protocolEvent(payload);

    await this.ready();
    await this.eventsCollection(clinicId, animalId, visitId).doc(normalizedEvent.id).set(normalizedEvent);

    return clone(normalizedEvent);
  };

  FirestoreEmbryoRepository.prototype.replaceProtocolEvents = async function (clinicId, animalId, visitId, payloads) {
    await this.ready();
    await deleteCollection(this.eventsCollection(clinicId, animalId, visitId));

    for (let index = 0; index < (payloads || []).length; index += 1) {
      await this.saveProtocolEvent(clinicId, animalId, visitId, payloads[index]);
    }

    const snapshot = await this.eventsCollection(clinicId, animalId, visitId).get();
    return sortByDateDesc(
      snapshot.docs.map((doc) => app.domain.normalizers.protocolEvent(doc.data())),
      "eventAt"
    );
  };

  repositories.FirestoreEmbryoRepository = FirestoreEmbryoRepository;

  repositories.isRuntimeFirestoreConfigured = function (runtimeConfig) {
    const config = runtimeConfig || window.EmbryoRuntimeConfig || {};
    return config.provider === "firestore" && config.firebase && config.firebase.enabled && hasFirebaseConfig(config.firebase.config);
  };
})();
