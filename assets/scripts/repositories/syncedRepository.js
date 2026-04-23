(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  const DEVICE_ID_STORAGE_KEY = "embryosardegna.sync.deviceId";
  const STATE_VERSION = 1;
  const STATUS_SYNCED = "synced";
  const STATUS_PENDING = "pending";
  const STATUS_ERROR = "error";
  const DEFAULT_POLL_INTERVAL_MS = 300000;
  const DEFAULT_SCHEDULE_DELAY_MS = 600;
  const FOREGROUND_SCHEDULE_DELAY_MS = 150;

  function deepClone(value) {
    return app.domain.helpers.deepClone(value);
  }

  function nowIso() {
    return app.domain.modelUtils.nowIso();
  }

  function toTimestamp(value) {
    const timestamp = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function stringifyError(error) {
    if (!error) {
      return "Errore sconosciuto";
    }

    if (typeof error === "string") {
      return error;
    }

    return error.message || String(error);
  }

  function getOrCreateDeviceId() {
    let deviceId = app.platform.storage.getItem(DEVICE_ID_STORAGE_KEY);

    if (!deviceId) {
      deviceId = app.domain.modelUtils.createId("device");
      app.platform.storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }

    return deviceId;
  }

  function createQueueEntry(action, entityType, entityId) {
    return {
      id: app.domain.modelUtils.createId("syncop"),
      action,
      entityType,
      entityId,
      createdAt: nowIso(),
    };
  }

  function buildEntityKey(entityType, entityId) {
    return `${entityType}:${entityId}`;
  }

  function createTombstone(entityType, entityId, options) {
    const settings = options || {};
    const deletedAt = settings.deletedAt || nowIso();

    return {
      key: buildEntityKey(entityType, entityId),
      entityType,
      entityId,
      clinicId: settings.clinicId || "clinic_main",
      animalId: settings.animalId || null,
      visitId: settings.visitId || null,
      deletedAt,
      updatedAt: deletedAt,
      updatedBy: settings.updatedBy || "system",
      deviceId: settings.deviceId || "",
    };
  }

  function getRecordUpdatedAt(record) {
    if (!record) {
      return 0;
    }

    return toTimestamp(record.updatedAt || record.createdAt || record.visitAt || record.checkAt || record.capturedAt || record.eventAt);
  }

  function getTombstoneUpdatedAt(tombstone) {
    return toTimestamp(tombstone && (tombstone.deletedAt || tombstone.updatedAt));
  }

  function normalizeSyncedRecord(record) {
    const nextRecord = deepClone(record || {});

    if (Object.prototype.hasOwnProperty.call(nextRecord, "syncStatus")) {
      nextRecord.syncStatus = STATUS_SYNCED;
    }

    return nextRecord;
  }

  function chooseWinner(localRecord, remoteRecord, localTombstone, remoteTombstone) {
    const candidates = [];

    if (localRecord) {
      candidates.push({
        kind: "record",
        source: "local",
        timestamp: getRecordUpdatedAt(localRecord),
        payload: localRecord,
      });
    }

    if (remoteRecord) {
      candidates.push({
        kind: "record",
        source: "remote",
        timestamp: getRecordUpdatedAt(remoteRecord),
        payload: remoteRecord,
      });
    }

    if (localTombstone) {
      candidates.push({
        kind: "tombstone",
        source: "local",
        timestamp: getTombstoneUpdatedAt(localTombstone),
        payload: localTombstone,
      });
    }

    if (remoteTombstone) {
      candidates.push({
        kind: "tombstone",
        source: "remote",
        timestamp: getTombstoneUpdatedAt(remoteTombstone),
        payload: remoteTombstone,
      });
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }

      if (left.kind !== right.kind) {
        return left.kind === "tombstone" ? -1 : 1;
      }

      if (left.source !== right.source) {
        return left.source === "remote" ? -1 : 1;
      }

      return 0;
    });

    return candidates[0];
  }

  function createClinicNode(clinicRecord) {
    return {
      record: clinicRecord,
      members: {},
      sessions: {},
      animals: {},
    };
  }

  function createAnimalNode(animalRecord) {
    return {
      record: animalRecord,
      visits: {},
      pregnancyChecks: {},
    };
  }

  function createVisitNode(visitRecord) {
    return {
      record: visitRecord,
      attachments: {},
      events: {},
    };
  }

  function createUnassignedSessionRecord(clinicId) {
    return app.domain.normalizers.session(
      app.domain.helpers.mergeDeep(app.domain.models.createUnassignedSessionTemplate(), {
        clinicId,
      })
    );
  }

  function createEmptyStore() {
    return {
      clinics: {},
    };
  }

  function isFinitePositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function resolvePollIntervalMs(value) {
    if (!Number.isFinite(value)) {
      return DEFAULT_POLL_INTERVAL_MS;
    }

    return Math.max(0, Number(value));
  }

  function resolveScheduleOptions(reasonOrOptions, delayOrOptions, explicitOptions) {
    const output = {
      reason: "scheduled",
      delayMs: DEFAULT_SCHEDULE_DELAY_MS,
      silent: false,
    };

    if (typeof reasonOrOptions === "string") {
      output.reason = reasonOrOptions || output.reason;
    } else if (reasonOrOptions && typeof reasonOrOptions === "object") {
      return resolveScheduleOptions(reasonOrOptions.reason, reasonOrOptions.delayMs, reasonOrOptions);
    }

    if (isFinitePositiveNumber(delayOrOptions)) {
      output.delayMs = delayOrOptions;
    } else if (delayOrOptions && typeof delayOrOptions === "object") {
      explicitOptions = delayOrOptions;
    }

    if (explicitOptions && typeof explicitOptions === "object") {
      if (typeof explicitOptions.reason === "string" && explicitOptions.reason) {
        output.reason = explicitOptions.reason;
      }

      if (isFinitePositiveNumber(explicitOptions.delayMs)) {
        output.delayMs = explicitOptions.delayMs;
      }

      output.silent = explicitOptions.silent === true;
    }

    return output;
  }

  function resolveRunSyncOptions(options) {
    const settings = options || {};

    return {
      reason: settings.reason || "manual",
      silent: settings.silent === true,
    };
  }

  function createEmptySnapshot(defaultClinicId) {
    return {
      clinic: app.domain.normalizers.clinic({
        id: defaultClinicId,
        name: "Embryo Sardegna",
      }),
      sessions: [],
      animals: [],
      visits: [],
      pregnancyChecks: [],
    };
  }

  function createBaseSyncMeta(defaultClinicId) {
    return {
      version: STATE_VERSION,
      clinicId: defaultClinicId,
      deviceId: getOrCreateDeviceId(),
      queue: [],
      tombstones: {},
      lastSyncAt: null,
      lastError: null,
      networkOnline: app.platform.network.isOnline(),
      syncing: false,
    };
  }

  function normalizeSyncMeta(value, defaultClinicId) {
    const base = createBaseSyncMeta(defaultClinicId);
    const input = value || {};

    return {
      version: input.version || base.version,
      clinicId: input.clinicId || base.clinicId,
      deviceId: input.deviceId || base.deviceId,
      queue: Array.isArray(input.queue) ? input.queue.map((entry) => deepClone(entry)) : [],
      tombstones: input.tombstones ? deepClone(input.tombstones) : {},
      lastSyncAt: input.lastSyncAt || null,
      lastError: input.lastError || null,
      networkOnline: typeof input.networkOnline === "boolean" ? input.networkOnline : base.networkOnline,
      syncing: false,
    };
  }

  function cloneVisitFromNode(visitNode) {
    const visitRecord = deepClone(visitNode.record);

    visitRecord.attachments = Object.keys(visitNode.attachments || {}).map((attachmentId) => {
      return deepClone(visitNode.attachments[attachmentId]);
    });
    visitRecord.events = Object.keys(visitNode.events || {}).map((eventId) => {
      return deepClone(visitNode.events[eventId]);
    });

    return visitRecord;
  }

  function buildSnapshotFromLocalStore(store, clinicId) {
    const snapshot = createEmptySnapshot(clinicId);
    const clinicNode = store && store.clinics ? store.clinics[clinicId] : null;

    if (!clinicNode) {
      snapshot.sessions = [createUnassignedSessionRecord(clinicId)];
      return snapshot;
    }

    snapshot.clinic = deepClone(clinicNode.record);
    snapshot.sessions = Object.keys(clinicNode.sessions || {}).map((sessionId) => deepClone(clinicNode.sessions[sessionId]));

    Object.keys(clinicNode.animals || {}).forEach((animalId) => {
      const animalNode = clinicNode.animals[animalId];
      const animalRecord = deepClone(animalNode.record);

      snapshot.animals.push(animalRecord);

      Object.keys(animalNode.visits || {}).forEach((visitId) => {
        snapshot.visits.push(cloneVisitFromNode(animalNode.visits[visitId]));
      });

      Object.keys(animalNode.pregnancyChecks || {}).forEach((checkId) => {
        const check = deepClone(animalNode.pregnancyChecks[checkId]);
        check.clinicId = check.clinicId || clinicId;
        check.animalId = check.animalId || animalId;
        snapshot.pregnancyChecks.push(check);
      });
    });

    if (!snapshot.sessions.some((session) => session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID)) {
      snapshot.sessions.unshift(createUnassignedSessionRecord(clinicId));
    }

    return snapshot;
  }

  async function buildSnapshotFromRepository(repository, clinicId) {
    const snapshot = createEmptySnapshot(clinicId);

    if (!repository) {
      snapshot.sessions = [createUnassignedSessionRecord(clinicId)];
      return snapshot;
    }

    snapshot.clinic = await repository.getClinic(clinicId);
    snapshot.sessions = await repository.listSessions(clinicId);
    snapshot.animals = await repository.listAnimals(clinicId);

    for (let index = 0; index < snapshot.animals.length; index += 1) {
      const animal = snapshot.animals[index];
      const [visits, pregnancyChecks] = await Promise.all([
        repository.listAnimalVisits(clinicId, animal.id),
        repository.listPregnancyChecks(clinicId, animal.id),
      ]);

      visits.forEach((visit) => {
        snapshot.visits.push(deepClone(visit));
      });

      pregnancyChecks.forEach((check) => {
        const nextCheck = deepClone(check);
        nextCheck.clinicId = nextCheck.clinicId || clinicId;
        nextCheck.animalId = nextCheck.animalId || animal.id;
        snapshot.pregnancyChecks.push(nextCheck);
      });
    }

    if (!snapshot.sessions.some((session) => session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID)) {
      snapshot.sessions.unshift(createUnassignedSessionRecord(clinicId));
    }

    return snapshot;
  }

  function buildStoreFromSnapshot(snapshot, clinicId) {
    const store = createEmptyStore();
    const clinicRecord = app.domain.normalizers.clinic(snapshot.clinic || { id: clinicId, name: "Embryo Sardegna" });
    const clinicNode = createClinicNode(clinicRecord);

    (snapshot.sessions || []).forEach((sessionRecord) => {
      const normalizedSession = app.domain.normalizers.session(sessionRecord);
      clinicNode.sessions[normalizedSession.id] = normalizedSession;
    });

    if (!clinicNode.sessions[app.domain.modelUtils.UNASSIGNED_SESSION_ID]) {
      const unassigned = createUnassignedSessionRecord(clinicId);
      clinicNode.sessions[unassigned.id] = unassigned;
    }

    (snapshot.animals || []).forEach((animalRecord) => {
      const normalizedAnimal = app.domain.normalizers.animal(animalRecord);
      clinicNode.animals[normalizedAnimal.id] = createAnimalNode(normalizedAnimal);
    });

    (snapshot.visits || []).forEach((visitRecord) => {
      const animalNode = clinicNode.animals[visitRecord.animalId];

      if (!animalNode) {
        return;
      }

      const visitPayload = deepClone(visitRecord);
      const attachments = Array.isArray(visitPayload.attachments) ? visitPayload.attachments.slice() : [];
      const events = Array.isArray(visitPayload.events) ? visitPayload.events.slice() : [];

      delete visitPayload.attachments;
      delete visitPayload.events;

      const normalizedVisit = app.domain.normalizers.visit(visitPayload);
      const visitNode = createVisitNode(normalizedVisit);

      attachments.forEach((attachmentRecord) => {
        const normalizedAttachment = app.domain.normalizers.attachment(attachmentRecord);
        visitNode.attachments[normalizedAttachment.id] = normalizedAttachment;
      });

      events.forEach((eventRecord) => {
        const normalizedEvent = app.domain.normalizers.protocolEvent(eventRecord);
        visitNode.events[normalizedEvent.id] = normalizedEvent;
      });

      animalNode.visits[normalizedVisit.id] = visitNode;
    });

    (snapshot.pregnancyChecks || []).forEach((checkRecord) => {
      const animalNode = clinicNode.animals[checkRecord.animalId];

      if (!animalNode) {
        return;
      }

      const normalizedCheck = app.domain.normalizers.pregnancyCheck(checkRecord);
      animalNode.pregnancyChecks[normalizedCheck.id] = normalizedCheck;
    });

    store.clinics[clinicId] = clinicNode;
    return store;
  }

  function mapRecordsById(records) {
    const map = {};

    (records || []).forEach((record) => {
      if (!record || !record.id) {
        return;
      }

      map[record.id] = deepClone(record);
    });

    return map;
  }

  function filterTombstonesByType(tombstones, entityType) {
    const output = {};

    Object.keys(tombstones || {}).forEach((key) => {
      const tombstone = tombstones[key];

      if (tombstone && tombstone.entityType === entityType) {
        output[tombstone.entityId] = deepClone(tombstone);
      }
    });

    return output;
  }

  function mergeRecordsByType(entityType, localRecords, remoteRecords, localTombstones, remoteTombstones) {
    const localMap = mapRecordsById(localRecords);
    const remoteMap = mapRecordsById(remoteRecords);
    const localTombMap = filterTombstonesByType(localTombstones, entityType);
    const remoteTombMap = filterTombstonesByType(remoteTombstones, entityType);
    const ids = Array.from(
      new Set(
        Object.keys(localMap)
          .concat(Object.keys(remoteMap))
          .concat(Object.keys(localTombMap))
          .concat(Object.keys(remoteTombMap))
      )
    );
    const records = [];
    const tombstones = {};

    ids.forEach((entityId) => {
      const winner = chooseWinner(localMap[entityId], remoteMap[entityId], localTombMap[entityId], remoteTombMap[entityId]);

      if (!winner) {
        return;
      }

      if (winner.kind === "tombstone") {
        tombstones[winner.payload.key] = deepClone(winner.payload);
        return;
      }

      records.push(normalizeSyncedRecord(winner.payload));
    });

    return {
      records,
      tombstones,
    };
  }

  function mergeSnapshots(localSnapshot, remoteSnapshot, localTombstones, remoteTombstones, clinicId) {
    const mergedSessions = mergeRecordsByType("session", localSnapshot.sessions, remoteSnapshot.sessions, localTombstones, remoteTombstones);
    const mergedAnimals = mergeRecordsByType("animal", localSnapshot.animals, remoteSnapshot.animals, localTombstones, remoteTombstones);
    const mergedVisits = mergeRecordsByType("visit", localSnapshot.visits, remoteSnapshot.visits, localTombstones, remoteTombstones);
    const mergedPregnancyChecks = mergeRecordsByType(
      "pregnancyCheck",
      localSnapshot.pregnancyChecks,
      remoteSnapshot.pregnancyChecks,
      localTombstones,
      remoteTombstones
    );
    const clinic = deepClone(remoteSnapshot.clinic || localSnapshot.clinic || { id: clinicId, name: "Embryo Sardegna" });
    const tombstones = Object.assign({}, mergedSessions.tombstones, mergedAnimals.tombstones, mergedVisits.tombstones, mergedPregnancyChecks.tombstones);
    const sessions = mergedSessions.records.slice();

    if (!sessions.some((session) => session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID)) {
      sessions.unshift(normalizeSyncedRecord(createUnassignedSessionRecord(clinicId)));
    }

    const sessionMap = mapRecordsById(sessions);
    const animals = mergedAnimals.records.map((animal) => {
      const nextAnimal = deepClone(animal);

      if (!sessionMap[nextAnimal.sessionId]) {
        nextAnimal.sessionId = app.domain.modelUtils.UNASSIGNED_SESSION_ID;
        nextAnimal.sessionName = app.domain.modelUtils.UNASSIGNED_SESSION_NAME;
      } else {
        nextAnimal.sessionName = sessionMap[nextAnimal.sessionId].name;
      }

      return normalizeSyncedRecord(nextAnimal);
    });
    const animalMap = mapRecordsById(animals);
    const visits = mergedVisits.records
      .filter((visit) => animalMap[visit.animalId])
      .map((visit) => {
        const nextVisit = deepClone(visit);
        const parentAnimal = animalMap[nextVisit.animalId];

        if (!sessionMap[nextVisit.sessionId]) {
          nextVisit.sessionId = parentAnimal.sessionId;
          nextVisit.sessionName = parentAnimal.sessionName;
        } else {
          nextVisit.sessionName = sessionMap[nextVisit.sessionId].name;
        }

        nextVisit.attachments = Array.isArray(nextVisit.attachments)
          ? nextVisit.attachments.map((attachment) => normalizeSyncedRecord(attachment))
          : [];
        nextVisit.events = Array.isArray(nextVisit.events)
          ? nextVisit.events.map((eventRecord) => normalizeSyncedRecord(eventRecord))
          : [];

        return normalizeSyncedRecord(nextVisit);
      });
    const pregnancyChecks = mergedPregnancyChecks.records
      .filter((check) => animalMap[check.animalId])
      .map((check) => normalizeSyncedRecord(check));

    return {
      snapshot: {
        clinic,
        sessions,
        animals,
        visits,
        pregnancyChecks,
      },
      tombstones,
    };
  }

  function snapshotRecordMap(snapshot, key) {
    return mapRecordsById(snapshot[key] || []);
  }

  function hasDifferentRecord(left, right) {
    return JSON.stringify(left || null) !== JSON.stringify(right || null);
  }

  function getVisitPayloadWithoutRelations(visit) {
    const payload = deepClone(visit);

    delete payload.attachments;
    delete payload.events;

    return payload;
  }

  function createEmptyLocalRepository(defaultClinicId, seedDemo) {
    const localRepository = new repositories.MockEmbryoRepository({
      defaultClinicId,
    });

    if (seedDemo === false) {
      localRepository.store = createEmptyStore();
    }

    return localRepository;
  }

  function SyncedEmbryoRepository(options) {
    const settings = options || {};

    this.name = settings.remoteRepository ? "synced" : "local";
    this.defaultClinicId = settings.defaultClinicId || "clinic_main";
    this.remote = settings.remoteRepository || null;
    this.stateStore =
      settings.stateStore ||
      new repositories.LocalStateStore({
        dbName: settings.stateDbName || `embryosardegna_state_${this.defaultClinicId}`,
      });
    this.local = createEmptyLocalRepository(this.defaultClinicId, settings.seedLocalDemo !== false && !this.remote);
    this.listeners = [];
    this.dataListeners = [];
    this.syncTimer = null;
    this.syncTimerDueAt = 0;
    this.pullTimer = null;
    this.syncPromise = null;
    this.autoSyncBound = false;
    this.remoteMarkerUnsubscribe = null;
    this.lastObservedRemoteRevision = null;
    this.pollIntervalMs = resolvePollIntervalMs(settings.pollIntervalMs);
    this.syncOnWindowFocus = settings.syncOnWindowFocus !== false;
    this.syncOnVisibility = settings.syncOnVisibility !== false;
    this.syncMeta = createBaseSyncMeta(this.defaultClinicId);
    this.readyPromise = this.bootstrap(settings);
    this.networkUnsubscribe = app.platform.network.onStatusChange((online) => {
      this.syncMeta.networkOnline = Boolean(online);
      this.emitSyncState();
      this.persistState();

      if (online) {
        this.scheduleSync("network-online", {
          delayMs: FOREGROUND_SCHEDULE_DELAY_MS,
          silent: true,
        });
      }
    });
  }

  SyncedEmbryoRepository.prototype.bootstrap = async function (settings) {
    const persistedState = await this.stateStore.load();

    if (persistedState && persistedState.store) {
      this.local.store = deepClone(persistedState.store);
      this.syncMeta = normalizeSyncMeta(persistedState.sync, this.defaultClinicId);
    } else {
      this.syncMeta = createBaseSyncMeta(this.defaultClinicId);

      if (this.remote) {
        this.local.store = createEmptyStore();
      }

      await this.persistState();
    }

    this.syncMeta.networkOnline = app.platform.network.isOnline();
    this.emitSyncState();

    if (this.remote && this.syncMeta.networkOnline) {
      await this.runSync({
        reason: "bootstrap",
        silent: true,
      });
    }

    this.bindAutoSyncTriggers();

    return settings || {};
  };

  SyncedEmbryoRepository.prototype.ready = async function () {
    await this.readyPromise;
  };

  SyncedEmbryoRepository.prototype.getSyncState = function () {
    const pendingCount = this.syncMeta.queue.length;
    let state = "synced";

    if (this.syncMeta.syncing) {
      state = "syncing";
    } else if (this.syncMeta.lastError) {
      state = "error";
    } else if (pendingCount > 0) {
      state = "pending";
    } else if (!this.syncMeta.networkOnline) {
      state = "offline";
    }

    return {
      state,
      pendingCount,
      lastSyncAt: this.syncMeta.lastSyncAt,
      lastError: this.syncMeta.lastError,
      networkOnline: this.syncMeta.networkOnline,
      syncing: this.syncMeta.syncing,
      deviceId: this.syncMeta.deviceId,
    };
  };

  SyncedEmbryoRepository.prototype.emitSyncState = function () {
    const syncState = this.getSyncState();

    this.listeners.forEach((listener) => {
      try {
        listener(syncState);
      } catch (error) {
        console.error(error);
      }
    });
  };

  SyncedEmbryoRepository.prototype.subscribeSyncState = function (listener) {
    if (typeof listener !== "function") {
      return function () {};
    }

    this.listeners.push(listener);
    listener(this.getSyncState());

    return () => {
      this.listeners = this.listeners.filter((current) => current !== listener);
    };
  };

  SyncedEmbryoRepository.prototype.emitDataChange = function (payload) {
    this.dataListeners.forEach((listener) => {
      try {
        listener(payload || {});
      } catch (error) {
        console.error(error);
      }
    });
  };

  SyncedEmbryoRepository.prototype.subscribeDataChange = function (listener) {
    if (typeof listener !== "function") {
      return function () {};
    }

    this.dataListeners.push(listener);

    return () => {
      this.dataListeners = this.dataListeners.filter((current) => current !== listener);
    };
  };

  SyncedEmbryoRepository.prototype.persistState = async function () {
    try {
      await this.stateStore.save({
        version: STATE_VERSION,
        store: deepClone(this.local.store),
        sync: deepClone(this.syncMeta),
      });
    } catch (error) {
      console.warn("Local synced repository state could not be persisted.", error);
    }
  };

  SyncedEmbryoRepository.prototype.enqueue = function (action, entityType, entityId) {
    const queueKey = buildEntityKey(entityType, entityId);
    const nextEntry = createQueueEntry(action, entityType, entityId);

    this.syncMeta.queue = this.syncMeta.queue.filter((entry) => {
      return buildEntityKey(entry.entityType, entry.entityId) !== queueKey;
    });
    this.syncMeta.queue.push(nextEntry);
    this.syncMeta.lastError = null;
    this.emitSyncState();
  };

  SyncedEmbryoRepository.prototype.clearEntityTombstone = function (entityType, entityId) {
    delete this.syncMeta.tombstones[buildEntityKey(entityType, entityId)];
  };

  SyncedEmbryoRepository.prototype.storeTombstone = function (tombstone) {
    if (!tombstone || !tombstone.key) {
      return;
    }

    this.syncMeta.tombstones[tombstone.key] = deepClone(tombstone);
    this.syncMeta.queue = this.syncMeta.queue.filter((entry) => {
      return buildEntityKey(entry.entityType, entry.entityId) !== tombstone.key;
    });
    this.syncMeta.lastError = null;
    this.emitSyncState();
  };

  SyncedEmbryoRepository.prototype.scheduleSync = function () {
    const scheduleOptions = resolveScheduleOptions(arguments[0], arguments[1], arguments[2]);

    if (!this.remote || !this.syncMeta.networkOnline) {
      return;
    }

    const nextDueAt = Date.now() + scheduleOptions.delayMs;

    if (this.syncTimer && this.syncTimerDueAt && this.syncTimerDueAt <= nextDueAt) {
      return;
    }

    clearTimeout(this.syncTimer);
    this.syncTimerDueAt = nextDueAt;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncTimerDueAt = 0;
      this.runSync({
        reason: scheduleOptions.reason,
        silent: scheduleOptions.silent,
      }).catch((error) => {
        console.error(error);
      });
    }, scheduleOptions.delayMs);
  };

  SyncedEmbryoRepository.prototype.bindAutoSyncTriggers = function () {
    if (!this.remote || this.autoSyncBound) {
      return;
    }

    this.autoSyncBound = true;

    if (typeof window !== "undefined" && this.syncOnWindowFocus) {
      this.handleWindowFocus = () => {
        this.scheduleSync("window-focus", {
          delayMs: FOREGROUND_SCHEDULE_DELAY_MS,
          silent: true,
        });
      };
      window.addEventListener("focus", this.handleWindowFocus);
    }

    if (typeof document !== "undefined" && this.syncOnVisibility) {
      this.handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          this.scheduleSync("visibility-visible", {
            delayMs: FOREGROUND_SCHEDULE_DELAY_MS,
            silent: true,
          });
        }
      };
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    if (typeof this.remote.subscribeClinicSyncMarker === "function") {
      this.remoteMarkerUnsubscribe = this.remote.subscribeClinicSyncMarker(this.defaultClinicId, (marker) => {
        if (!marker) {
          return;
        }

        if (marker.revision) {
          const isInitial = marker.initial === true && this.lastObservedRemoteRevision === null;
          const isOwnRevision = marker.deviceId && marker.deviceId === this.syncMeta.deviceId;
          const isAlreadySeen = marker.revision === this.lastObservedRemoteRevision;

          this.lastObservedRemoteRevision = marker.revision;

          if (!isInitial && !isOwnRevision && !isAlreadySeen) {
            this.scheduleSync("remote-revision", {
              delayMs: FOREGROUND_SCHEDULE_DELAY_MS,
              silent: true,
            });
          }
        }
      });
    }

    if (isFinitePositiveNumber(this.pollIntervalMs)) {
      this.pullTimer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }

        this.scheduleSync("poll", {
          delayMs: DEFAULT_SCHEDULE_DELAY_MS,
          silent: true,
        });
      }, this.pollIntervalMs);
    }
  };

  SyncedEmbryoRepository.prototype.dispose = function () {
    clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.syncTimerDueAt = 0;
    clearInterval(this.pullTimer);

    if (typeof this.networkUnsubscribe === "function") {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    if (typeof this.remoteMarkerUnsubscribe === "function") {
      this.remoteMarkerUnsubscribe();
      this.remoteMarkerUnsubscribe = null;
    }

    if (typeof window !== "undefined" && this.handleWindowFocus) {
      window.removeEventListener("focus", this.handleWindowFocus);
      this.handleWindowFocus = null;
    }

    if (typeof document !== "undefined" && this.handleVisibilityChange) {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      this.handleVisibilityChange = null;
    }
  };

  SyncedEmbryoRepository.prototype.markPendingRecord = function (entityType, payload) {
    const nextPayload = deepClone(payload || {});
    const timestamp = nowIso();

    nextPayload.updatedAt = timestamp;
    nextPayload.updatedBy = nextPayload.updatedBy || "demo_user";
    nextPayload.deviceId = this.syncMeta.deviceId;
    nextPayload.syncStatus = STATUS_PENDING;

    if (!nextPayload.createdAt) {
      nextPayload.createdAt = timestamp;
    }

    if (entityType === "pregnancyCheck") {
      nextPayload.clinicId = nextPayload.clinicId || this.defaultClinicId;
    }

    return nextPayload;
  };

  SyncedEmbryoRepository.prototype.touchLocalVisit = async function (clinicId, animalId, visitId) {
    const currentVisit = await this.local.getVisit(clinicId, animalId, visitId);
    const visitPayload = this.markPendingRecord("visit", currentVisit);

    await this.local.saveVisit(clinicId, animalId, visitPayload);
    this.clearEntityTombstone("visit", visitId);
    this.enqueue("upsert", "visit", visitId);
  };

  SyncedEmbryoRepository.prototype.collectSessionDeleteTombstones = function (clinicId, sessionId, deleteAnimals) {
    const clinicNode = this.local.ensureClinicNode(clinicId);
    const tombstones = [];
    const sessionRecord = clinicNode.sessions[sessionId];

    if (sessionRecord) {
      tombstones.push(
        createTombstone("session", sessionId, {
          clinicId,
          updatedBy: "demo_user",
          deviceId: this.syncMeta.deviceId,
        })
      );
    }

    Object.keys(clinicNode.animals || {}).forEach((animalId) => {
      const animalNode = clinicNode.animals[animalId];
      const animalBelongsToSession = (animalNode.record.sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID) === sessionId;

      if (deleteAnimals && animalBelongsToSession) {
        tombstones.push(
          createTombstone("animal", animalId, {
            clinicId,
            updatedBy: "demo_user",
            deviceId: this.syncMeta.deviceId,
          })
        );
        return;
      }

      Object.keys(animalNode.visits || {}).forEach((visitId) => {
        const visitRecord = animalNode.visits[visitId].record;
        const visitBelongsToSession = (visitRecord.sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID) === sessionId;

        if (animalBelongsToSession || visitBelongsToSession) {
          tombstones.push(
            createTombstone("visit", visitId, {
              clinicId,
              animalId,
              visitId,
              updatedBy: "demo_user",
              deviceId: this.syncMeta.deviceId,
            })
          );
        }
      });
    });

    return tombstones;
  };

  SyncedEmbryoRepository.prototype.loadRemoteTombstones = async function () {
    if (!this.remote || typeof this.remote.listSyncTombstones !== "function") {
      return {};
    }

    const tombstones = await this.remote.listSyncTombstones(this.defaultClinicId);
    const output = {};

    (tombstones || []).forEach((tombstone) => {
      if (tombstone && tombstone.key) {
        output[tombstone.key] = deepClone(tombstone);
      }
    });

    return output;
  };

  SyncedEmbryoRepository.prototype.upsertRemoteSession = async function (sessionRecord) {
    try {
      await this.remote.getSession(this.defaultClinicId, sessionRecord.id);
      await this.remote.updateSession(sessionRecord.id, sessionRecord, {
        clinicId: this.defaultClinicId,
      });
    } catch (error) {
      await this.remote.createSession(sessionRecord);
    }
  };

  SyncedEmbryoRepository.prototype.upsertRemoteAnimal = async function (animalRecord) {
    try {
      await this.remote.getAnimal(this.defaultClinicId, animalRecord.id);
      await this.remote.updateAnimal(animalRecord.id, animalRecord, {
        clinicId: this.defaultClinicId,
      });
    } catch (error) {
      await this.remote.createAnimal(animalRecord);
    }
  };

  SyncedEmbryoRepository.prototype.upsertRemoteVisit = async function (visitRecord) {
    const visitPayload = getVisitPayloadWithoutRelations(visitRecord);

    await this.remote.saveVisit(this.defaultClinicId, visitRecord.animalId, visitPayload);

    if (typeof this.remote.replaceVisitAttachments === "function") {
      await this.remote.replaceVisitAttachments(
        this.defaultClinicId,
        visitRecord.animalId,
        visitRecord.id,
        visitRecord.attachments || []
      );
    }

    if (typeof this.remote.replaceProtocolEvents === "function") {
      await this.remote.replaceProtocolEvents(
        this.defaultClinicId,
        visitRecord.animalId,
        visitRecord.id,
        visitRecord.events || []
      );
    }
  };

  SyncedEmbryoRepository.prototype.upsertRemotePregnancyCheck = async function (pregnancyCheck) {
    await this.remote.savePregnancyCheck(this.defaultClinicId, pregnancyCheck.animalId, pregnancyCheck);
  };

  SyncedEmbryoRepository.prototype.applyMergedSnapshotToRemote = async function (
    remoteSnapshot,
    mergedSnapshot,
    mergedTombstones,
    remoteTombstones
  ) {
    if (!this.remote) {
      return false;
    }

    const remoteSessionMap = snapshotRecordMap(remoteSnapshot, "sessions");
    const remoteAnimalMap = snapshotRecordMap(remoteSnapshot, "animals");
    const remoteVisitMap = snapshotRecordMap(remoteSnapshot, "visits");
    const remotePregnancyCheckMap = snapshotRecordMap(remoteSnapshot, "pregnancyChecks");
    const mergedSessionMap = snapshotRecordMap(mergedSnapshot, "sessions");
    const mergedAnimalMap = snapshotRecordMap(mergedSnapshot, "animals");
    const mergedVisitMap = snapshotRecordMap(mergedSnapshot, "visits");
    const mergedPregnancyCheckMap = snapshotRecordMap(mergedSnapshot, "pregnancyChecks");
    let remoteChanged = false;

    const mergedTombstoneKeys = Object.keys(mergedTombstones || {});

    for (let index = 0; index < mergedTombstoneKeys.length; index += 1) {
      const tombstoneKey = mergedTombstoneKeys[index];
      const tombstone = mergedTombstones[tombstoneKey];
      const remoteTombstone = remoteTombstones[tombstoneKey];

      if (!remoteTombstone || getTombstoneUpdatedAt(tombstone) > getTombstoneUpdatedAt(remoteTombstone)) {
        await this.remote.upsertSyncTombstone(this.defaultClinicId, tombstone);
        remoteChanged = true;
      }
    }

    const mergedSessions = mergedSnapshot.sessions || [];
    for (let index = 0; index < mergedSessions.length; index += 1) {
      const sessionRecord = mergedSessions[index];
      const remoteSession = remoteSessionMap[sessionRecord.id];

      if (!remoteSession || hasDifferentRecord(remoteSession, sessionRecord)) {
        await this.upsertRemoteSession(sessionRecord);
        remoteChanged = true;
      }
    }

    const mergedAnimals = mergedSnapshot.animals || [];
    for (let index = 0; index < mergedAnimals.length; index += 1) {
      const animalRecord = mergedAnimals[index];
      const remoteAnimal = remoteAnimalMap[animalRecord.id];

      if (!remoteAnimal || hasDifferentRecord(remoteAnimal, animalRecord)) {
        await this.upsertRemoteAnimal(animalRecord);
        remoteChanged = true;
      }
    }

    const mergedVisits = mergedSnapshot.visits || [];
    for (let index = 0; index < mergedVisits.length; index += 1) {
      const visitRecord = mergedVisits[index];
      const remoteVisit = remoteVisitMap[visitRecord.id];

      if (!remoteVisit || hasDifferentRecord(remoteVisit, visitRecord)) {
        await this.upsertRemoteVisit(visitRecord);
        remoteChanged = true;
      }
    }

    const mergedPregnancyChecks = mergedSnapshot.pregnancyChecks || [];
    for (let index = 0; index < mergedPregnancyChecks.length; index += 1) {
      const pregnancyCheck = mergedPregnancyChecks[index];
      const remotePregnancyCheck = remotePregnancyCheckMap[pregnancyCheck.id];

      if (!remotePregnancyCheck || hasDifferentRecord(remotePregnancyCheck, pregnancyCheck)) {
        await this.upsertRemotePregnancyCheck(pregnancyCheck);
        remoteChanged = true;
      }
    }

    const remoteVisitIds = Object.keys(remoteVisitMap);
    for (let index = 0; index < remoteVisitIds.length; index += 1) {
      const visitId = remoteVisitIds[index];
      const remoteVisit = remoteVisitMap[visitId];
      const tombstone = mergedTombstones[buildEntityKey("visit", visitId)];

      if (!mergedVisitMap[visitId] && tombstone && getTombstoneUpdatedAt(tombstone) >= getRecordUpdatedAt(remoteVisit)) {
        await this.remote.deleteVisit(this.defaultClinicId, remoteVisit.animalId, visitId);
        remoteChanged = true;
      }
    }

    const remoteAnimalIds = Object.keys(remoteAnimalMap);
    for (let index = 0; index < remoteAnimalIds.length; index += 1) {
      const animalId = remoteAnimalIds[index];
      const remoteAnimal = remoteAnimalMap[animalId];
      const tombstone = mergedTombstones[buildEntityKey("animal", animalId)];

      if (!mergedAnimalMap[animalId] && tombstone && getTombstoneUpdatedAt(tombstone) >= getRecordUpdatedAt(remoteAnimal)) {
        await this.remote.deleteAnimal(this.defaultClinicId, animalId);
        remoteChanged = true;
      }
    }

    const remoteSessionIds = Object.keys(remoteSessionMap);
    for (let index = 0; index < remoteSessionIds.length; index += 1) {
      const sessionId = remoteSessionIds[index];
      const remoteSession = remoteSessionMap[sessionId];
      const tombstone = mergedTombstones[buildEntityKey("session", sessionId)];

      if (
        sessionId !== app.domain.modelUtils.UNASSIGNED_SESSION_ID &&
        !mergedSessionMap[sessionId] &&
        tombstone &&
        getTombstoneUpdatedAt(tombstone) >= getRecordUpdatedAt(remoteSession)
      ) {
        await this.remote.deleteSessionRecord(this.defaultClinicId, sessionId);
        remoteChanged = true;
      }
    }

    return remoteChanged;
  };

  SyncedEmbryoRepository.prototype.runSync = async function () {
    const runOptions = resolveRunSyncOptions(arguments[0]);

    if (!this.remote || !this.syncMeta.networkOnline) {
      this.emitSyncState();
      return this.getSyncState();
    }

    if (this.syncPromise) {
      return this.syncPromise;
    }

    const shouldSurfaceSync = !runOptions.silent || this.syncMeta.queue.length > 0;

    this.syncMeta.syncing = shouldSurfaceSync;
    this.syncMeta.lastError = null;
    this.emitSyncState();

    this.syncPromise = (async () => {
      const syncStartedAt = nowIso();
      const syncStartedAtMs = toTimestamp(syncStartedAt);

      try {
        const localSnapshot = buildSnapshotFromLocalStore(this.local.store, this.defaultClinicId);
        const remoteSnapshot = await buildSnapshotFromRepository(this.remote, this.defaultClinicId);
        const remoteTombstones = await this.loadRemoteTombstones();
        const merged = mergeSnapshots(
          localSnapshot,
          remoteSnapshot,
          this.syncMeta.tombstones,
          remoteTombstones,
          this.defaultClinicId
        );

        const remoteChanged = await this.applyMergedSnapshotToRemote(remoteSnapshot, merged.snapshot, merged.tombstones, remoteTombstones);

        if (remoteChanged && typeof this.remote.touchClinicSyncMarker === "function") {
          const marker = await this.remote.touchClinicSyncMarker(this.defaultClinicId, {
            deviceId: this.syncMeta.deviceId,
          });

          if (marker && marker.syncRevision) {
            this.lastObservedRemoteRevision = marker.syncRevision;
          }
        }

        const authoritativeRemoteSnapshot = await buildSnapshotFromRepository(this.remote, this.defaultClinicId);
        const authoritativeRemoteTombstones = await this.loadRemoteTombstones();
        const currentLocalSnapshot = buildSnapshotFromLocalStore(this.local.store, this.defaultClinicId);
        const currentLocalTombstones = deepClone(this.syncMeta.tombstones);
        const finalMerged = mergeSnapshots(
          currentLocalSnapshot,
          authoritativeRemoteSnapshot,
          currentLocalTombstones,
          authoritativeRemoteTombstones,
          this.defaultClinicId
        );
        const nextStore = buildStoreFromSnapshot(finalMerged.snapshot, this.defaultClinicId);
        const dataChanged =
          hasDifferentRecord(this.local.store, nextStore) || hasDifferentRecord(this.syncMeta.tombstones, finalMerged.tombstones);
        const remainingQueue = this.syncMeta.queue.filter((entry) => {
          return toTimestamp(entry && entry.createdAt) > syncStartedAtMs;
        });

        this.local.store = nextStore;
        this.syncMeta.tombstones = finalMerged.tombstones;
        this.syncMeta.queue = remainingQueue;
        this.syncMeta.lastSyncAt = nowIso();
        this.syncMeta.lastError = null;
        await this.persistState();

        if (dataChanged) {
          this.emitDataChange({
            reason: "sync",
          });
        }

        this.emitSyncState();

        if (this.syncMeta.queue.length > 0) {
          this.scheduleSync("post-sync-retry", {
            delayMs: FOREGROUND_SCHEDULE_DELAY_MS,
            silent: false,
          });
        }

        return this.getSyncState();
      } catch (error) {
        this.syncMeta.lastError = stringifyError(error);
        await this.persistState();
        this.emitSyncState();
        throw error;
      } finally {
        this.syncMeta.syncing = false;
        this.syncPromise = null;
        this.emitSyncState();
      }
    })();

    return this.syncPromise;
  };

  SyncedEmbryoRepository.prototype.syncNow = async function () {
    await this.ready();
    return this.runSync();
  };

  SyncedEmbryoRepository.prototype.getClinic = async function (clinicId) {
    await this.ready();
    return this.local.getClinic(clinicId || this.defaultClinicId);
  };

  SyncedEmbryoRepository.prototype.listSessions = async function (clinicId) {
    await this.ready();
    return this.local.listSessions(clinicId || this.defaultClinicId);
  };

  SyncedEmbryoRepository.prototype.getSession = async function (clinicId, sessionId) {
    await this.ready();
    return this.local.getSession(clinicId || this.defaultClinicId, sessionId);
  };

  SyncedEmbryoRepository.prototype.createSession = async function (payload) {
    await this.ready();

    const sessionPayload = this.markPendingRecord("session", app.domain.helpers.mergeDeep(payload || {}, {
      clinicId: (payload && payload.clinicId) || this.defaultClinicId,
    }));
    const session = await this.local.createSession(sessionPayload);

    this.clearEntityTombstone("session", session.id);
    this.enqueue("upsert", "session", session.id);
    await this.persistState();
    this.scheduleSync();
    return session;
  };

  SyncedEmbryoRepository.prototype.updateSession = async function (sessionId, patch, options) {
    await this.ready();

    const nextPatch = this.markPendingRecord("session", patch || {});
    const session = await this.local.updateSession(sessionId, nextPatch, options || { clinicId: this.defaultClinicId });

    this.clearEntityTombstone("session", sessionId);
    this.enqueue("upsert", "session", sessionId);
    await this.persistState();
    this.scheduleSync();
    return session;
  };

  SyncedEmbryoRepository.prototype.deleteSession = async function (clinicId, sessionId, options) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const settings = options || {};
    const tombstones = this.collectSessionDeleteTombstones(resolvedClinicId, sessionId, Boolean(settings.deleteAnimals));
    const result = await this.local.deleteSession(resolvedClinicId, sessionId, settings);

    tombstones.forEach((tombstone) => {
      this.storeTombstone(tombstone);
    });

    this.enqueue("delete", "session", sessionId);
    await this.persistState();
    this.scheduleSync();
    return result;
  };

  SyncedEmbryoRepository.prototype.listAnimals = async function (clinicId) {
    await this.ready();
    return this.local.listAnimals(clinicId || this.defaultClinicId);
  };

  SyncedEmbryoRepository.prototype.createAnimal = async function (payload) {
    await this.ready();

    const animalPayload = this.markPendingRecord("animal", app.domain.helpers.mergeDeep(payload || {}, {
      clinicId: (payload && payload.clinicId) || this.defaultClinicId,
    }));
    const animal = await this.local.createAnimal(animalPayload);

    this.clearEntityTombstone("animal", animal.id);
    this.enqueue("upsert", "animal", animal.id);
    await this.persistState();
    this.scheduleSync();
    return animal;
  };

  SyncedEmbryoRepository.prototype.updateAnimal = async function (animalId, patch, options) {
    await this.ready();

    const nextPatch = this.markPendingRecord("animal", patch || {});
    const animal = await this.local.updateAnimal(animalId, nextPatch, options || { clinicId: this.defaultClinicId });

    this.clearEntityTombstone("animal", animalId);
    this.enqueue("upsert", "animal", animalId);
    await this.persistState();
    this.scheduleSync();
    return animal;
  };

  SyncedEmbryoRepository.prototype.assignAnimalSession = async function (clinicId, animalId, sessionId) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const session = await this.local.getSession(resolvedClinicId, sessionId);
    const animal = await this.local.updateAnimal(
      animalId,
      this.markPendingRecord("animal", {
        sessionId: session.id,
        sessionName: session.name,
        updatedBy: "demo_user",
      }),
      { clinicId: resolvedClinicId }
    );

    this.clearEntityTombstone("animal", animalId);
    this.enqueue("upsert", "animal", animalId);
    await this.persistState();
    this.scheduleSync();
    return animal;
  };

  SyncedEmbryoRepository.prototype.deleteAnimal = async function (clinicId, animalId) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const animal = await this.local.getAnimal(resolvedClinicId, animalId);
    const tombstone = createTombstone("animal", animalId, {
      clinicId: resolvedClinicId,
      updatedBy: animal.updatedBy || "demo_user",
      deviceId: this.syncMeta.deviceId,
    });

    await this.local.deleteAnimal(resolvedClinicId, animalId);
    this.storeTombstone(tombstone);
    this.enqueue("delete", "animal", animalId);
    await this.persistState();
    this.scheduleSync();
    return true;
  };

  SyncedEmbryoRepository.prototype.getAnimal = async function (clinicId, animalId) {
    await this.ready();
    return this.local.getAnimal(clinicId || this.defaultClinicId, animalId);
  };

  SyncedEmbryoRepository.prototype.listAnimalVisits = async function (clinicId, animalId) {
    await this.ready();
    return this.local.listAnimalVisits(clinicId || this.defaultClinicId, animalId);
  };

  SyncedEmbryoRepository.prototype.getVisit = async function (clinicId, animalId, visitId) {
    await this.ready();
    return this.local.getVisit(clinicId || this.defaultClinicId, animalId, visitId);
  };

  SyncedEmbryoRepository.prototype.saveVisit = async function (clinicId, animalId, visitPayload) {
    await this.ready();

    const payload = this.markPendingRecord("visit", app.domain.helpers.mergeDeep(visitPayload || {}, {
      clinicId: clinicId || this.defaultClinicId,
      animalId,
    }));
    const visit = await this.local.saveVisit(clinicId || this.defaultClinicId, animalId, payload);

    this.clearEntityTombstone("visit", visit.id);
    this.enqueue("upsert", "visit", visit.id);
    await this.persistState();
    this.scheduleSync();
    return visit;
  };

  SyncedEmbryoRepository.prototype.deleteVisit = async function (clinicId, animalId, visitId) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const visit = await this.local.getVisit(resolvedClinicId, animalId, visitId);
    const tombstone = createTombstone("visit", visitId, {
      clinicId: resolvedClinicId,
      animalId,
      visitId,
      updatedBy: visit.updatedBy || "demo_user",
      deviceId: this.syncMeta.deviceId,
    });

    await this.local.deleteVisit(resolvedClinicId, animalId, visitId);
    this.storeTombstone(tombstone);
    this.enqueue("delete", "visit", visitId);
    await this.persistState();
    this.scheduleSync();
    return true;
  };

  SyncedEmbryoRepository.prototype.listPregnancyChecks = async function (clinicId, animalId) {
    await this.ready();
    return this.local.listPregnancyChecks(clinicId || this.defaultClinicId, animalId);
  };

  SyncedEmbryoRepository.prototype.savePregnancyCheck = async function (clinicId, animalId, payload) {
    await this.ready();

    const checkPayload = this.markPendingRecord("pregnancyCheck", app.domain.helpers.mergeDeep(payload || {}, {
      clinicId: clinicId || this.defaultClinicId,
      animalId,
    }));
    const check = await this.local.savePregnancyCheck(clinicId || this.defaultClinicId, animalId, checkPayload);

    this.clearEntityTombstone("pregnancyCheck", check.id);
    this.enqueue("upsert", "pregnancyCheck", check.id);
    await this.persistState();
    this.scheduleSync();
    return check;
  };

  SyncedEmbryoRepository.prototype.saveVisitAttachment = async function (clinicId, animalId, visitId, payload) {
    await this.ready();

    const attachmentPayload = this.markPendingRecord("attachment", app.domain.helpers.mergeDeep(payload || {}, {
      clinicId: clinicId || this.defaultClinicId,
      animalId,
      visitId,
    }));
    const attachment = await this.local.saveVisitAttachment(clinicId || this.defaultClinicId, animalId, visitId, attachmentPayload);

    await this.touchLocalVisit(clinicId || this.defaultClinicId, animalId, visitId);
    await this.persistState();
    this.scheduleSync();
    return attachment;
  };

  SyncedEmbryoRepository.prototype.replaceVisitAttachments = async function (clinicId, animalId, visitId, payloads) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const nextPayloads = (payloads || []).map((payload) => {
      return this.markPendingRecord("attachment", app.domain.helpers.mergeDeep(payload || {}, {
        clinicId: resolvedClinicId,
        animalId,
        visitId,
      }));
    });
    const attachments = await this.local.replaceVisitAttachments(resolvedClinicId, animalId, visitId, nextPayloads);

    await this.touchLocalVisit(resolvedClinicId, animalId, visitId);
    await this.persistState();
    this.scheduleSync();
    return attachments;
  };

  SyncedEmbryoRepository.prototype.saveProtocolEvent = async function (clinicId, animalId, visitId, payload) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const eventPayload = this.markPendingRecord("event", app.domain.helpers.mergeDeep(payload || {}, {
      clinicId: resolvedClinicId,
      animalId,
      visitId,
    }));
    const eventRecord = await this.local.saveProtocolEvent(resolvedClinicId, animalId, visitId, eventPayload);

    await this.touchLocalVisit(resolvedClinicId, animalId, visitId);
    await this.persistState();
    this.scheduleSync();
    return eventRecord;
  };

  SyncedEmbryoRepository.prototype.replaceProtocolEvents = async function (clinicId, animalId, visitId, payloads) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const nextPayloads = (payloads || []).map((payload) => {
      return this.markPendingRecord("event", app.domain.helpers.mergeDeep(payload || {}, {
        clinicId: resolvedClinicId,
        animalId,
        visitId,
      }));
    });
    const events = await this.local.replaceProtocolEvents(resolvedClinicId, animalId, visitId, nextPayloads);

    await this.touchLocalVisit(resolvedClinicId, animalId, visitId);
    await this.persistState();
    this.scheduleSync();
    return events;
  };

  SyncedEmbryoRepository.prototype.recomputeAllSessionDateRanges = async function () {
    await this.ready();
    return null;
  };

  SyncedEmbryoRepository.prototype.mergeImportedSyncTombstones = async function (clinicId, tombstones) {
    await this.ready();

    const resolvedClinicId = clinicId || this.defaultClinicId;
    const nextTombstones = Array.isArray(tombstones) ? tombstones : [];

    nextTombstones.forEach((tombstone) => {
      if (!tombstone || !tombstone.key) {
        return;
      }

      const nextTombstone = deepClone(tombstone);
      nextTombstone.clinicId = resolvedClinicId;

      const currentTombstone = this.syncMeta.tombstones[nextTombstone.key];

      if (!currentTombstone || getTombstoneUpdatedAt(nextTombstone) >= getTombstoneUpdatedAt(currentTombstone)) {
        this.syncMeta.tombstones[nextTombstone.key] = nextTombstone;
      }
    });

    await this.persistState();
    this.emitSyncState();
    this.scheduleSync();
    return Object.keys(this.syncMeta.tombstones).length;
  };

  repositories.SyncedEmbryoRepository = SyncedEmbryoRepository;
})();
