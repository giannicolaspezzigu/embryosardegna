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
    const normalizedAnimal = app.domain.normalizers.animal(mergedAnimal);

    await this.animalRef(clinicId, animalId).set(normalizedAnimal);

    return this.getAnimal(clinicId, animalId);
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
    const normalizedVisit = app.domain.normalizers.visit(
      app.domain.helpers.mergeDeep(visitPayload || {}, {
        clinicId,
        animalId,
      })
    );

    await this.ready();
    await this.visitRef(clinicId, animalId, normalizedVisit.id).set(normalizedVisit);
    await this.recomputeAnimalRollup(clinicId, animalId);

    return this.getVisit(clinicId, animalId, normalizedVisit.id);
  };

  FirestoreEmbryoRepository.prototype.deleteVisit = async function (clinicId, animalId, visitId) {
    await this.ready();
    await deleteCollection(this.attachmentsCollection(clinicId, animalId, visitId));
    await deleteCollection(this.eventsCollection(clinicId, animalId, visitId));
    await this.visitRef(clinicId, animalId, visitId).delete();
    await this.recomputeAnimalRollup(clinicId, animalId);
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
