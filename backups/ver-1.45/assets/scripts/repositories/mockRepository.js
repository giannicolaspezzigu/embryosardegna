(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  function sortByDateDesc(items, fieldName) {
    return items.sort((left, right) => {
      return new Date(right[fieldName]).getTime() - new Date(left[fieldName]).getTime();
    });
  }

  function buildVisitReturnValue(visitNode) {
    const visitRecord = app.domain.helpers.deepClone(visitNode.record);

    visitRecord.attachments = Object.keys(visitNode.attachments).map((attachmentId) => {
      return app.domain.helpers.deepClone(visitNode.attachments[attachmentId]);
    });
    visitRecord.events = sortByDateDesc(
      Object.keys(visitNode.events).map((eventId) => app.domain.helpers.deepClone(visitNode.events[eventId])),
      "eventAt"
    );

    return visitRecord;
  }

  function getRecordSessionId(record) {
    return (record && record.sessionId) || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
  }

  function getVisitTimestamp(visit) {
    const timestamp = visit && visit.visitAt ? new Date(visit.visitAt).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function getLatestBodyConditionScore(visits, fallbackValue) {
    for (let index = 0; index < (visits || []).length; index += 1) {
      const visit = visits[index];

      if (visit && visit.bodyConditionScore !== null && visit.bodyConditionScore !== undefined) {
        return visit.bodyConditionScore;
      }
    }

    return fallbackValue === undefined ? null : fallbackValue;
  }

  function createUnassignedSessionRecord(clinicId) {
    return app.domain.normalizers.session(
      app.domain.helpers.mergeDeep(app.domain.models.createUnassignedSessionTemplate(), {
        clinicId,
      })
    );
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

  function buildSeedFollicleSizes(counts) {
    const normalizedCounts = counts || {};
    const sizes = [];
    const smallPalette = [2, 2.4, 2.8];
    const mediumPalette = [3.2, 3.8, 4.2, 4.8];
    const largePalette = [5.6, 6, 6.5, 7];

    for (let index = 0; index < (normalizedCounts.smallFollicles || 0); index += 1) {
      sizes.push(smallPalette[index % smallPalette.length]);
    }

    for (let index = 0; index < (normalizedCounts.mediumFollicles || 0); index += 1) {
      sizes.push(mediumPalette[index % mediumPalette.length]);
    }

    for (let index = 0; index < (normalizedCounts.largeFollicles || 0); index += 1) {
      sizes.push(largePalette[index % largePalette.length]);
    }

    if ((normalizedCounts.largeFollicles || 0) > 0 && normalizedCounts.largestFollicleMm) {
      sizes[sizes.length - 1] = normalizedCounts.largestFollicleMm;
    }

    return sizes.slice(0, normalizedCounts.totalFollicles || sizes.length);
  }

  function buildSeedStructures(side, options) {
    const settings = options || {};
    const counts = settings.counts || {};
    const follicleSizes = settings.follicleSizes || buildSeedFollicleSizes(counts);
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const hourOffset = settings.hourOffset || 0;
    const clAreas = settings.clAreas || [];
    const structures = [];

    follicleSizes.forEach((sizeMm, index) => {
      structures.push({
        side,
        type: "follicle",
        sizeMm,
        clockHour: hours[(hourOffset + index) % hours.length],
        source: "tap",
      });
    });

    for (let index = 0; index < (counts.ovulations || 0); index += 1) {
      structures.push({
        side,
        type: "ovulation",
        clockHour: hours[(hourOffset + follicleSizes.length + index) % hours.length],
        source: "voice",
      });
    }

    for (let index = 0; index < (counts.corporaLutea || 0); index += 1) {
      structures.push({
        side,
        type: "corpus_luteum",
        clAreaMm2: clAreas[index] || 110 + index * 12,
        clockHour: hours[(hourOffset + follicleSizes.length + (counts.ovulations || 0) + index) % hours.length],
        source: "manual_entry",
      });
    }

    for (let index = 0; index < (counts.cysts || 0); index += 1) {
      structures.push({
        side,
        type: "cyst",
        sizeMm: 8 + index,
        clockHour:
          hours[(hourOffset + follicleSizes.length + (counts.ovulations || 0) + (counts.corporaLutea || 0) + index) % hours.length],
        source: "tap",
      });
    }

    return structures;
  }

  function buildSeedTotalCounts(leftCounts, rightCounts) {
    return {
      totalFollicles: (leftCounts.totalFollicles || 0) + (rightCounts.totalFollicles || 0),
      smallFollicles: (leftCounts.smallFollicles || 0) + (rightCounts.smallFollicles || 0),
      mediumFollicles: (leftCounts.mediumFollicles || 0) + (rightCounts.mediumFollicles || 0),
      largeFollicles: (leftCounts.largeFollicles || 0) + (rightCounts.largeFollicles || 0),
      ovulations: (leftCounts.ovulations || 0) + (rightCounts.ovulations || 0),
      corporaLutea: (leftCounts.corporaLutea || 0) + (rightCounts.corporaLutea || 0),
      cysts: (leftCounts.cysts || 0) + (rightCounts.cysts || 0),
    };
  }

  function createMockSnapshotDataUrl(title, accentColor) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
        <rect width="640" height="420" fill="#07100d"/>
        <rect x="18" y="18" width="604" height="384" rx="18" fill="#0d1a14" stroke="${accentColor}" stroke-width="4"/>
        <ellipse cx="320" cy="210" rx="190" ry="118" fill="rgba(77,184,255,0.10)" stroke="${accentColor}" stroke-width="4"/>
        <circle cx="272" cy="188" r="26" fill="rgba(0,224,160,0.18)" stroke="#00e0a0" stroke-width="3"/>
        <circle cx="366" cy="226" r="34" fill="rgba(245,197,24,0.20)" stroke="#f5c518" stroke-width="3"/>
        <text x="40" y="56" fill="${accentColor}" font-size="28" font-family="Arial, sans-serif" font-weight="700">${title}</text>
        <text x="40" y="92" fill="#d6f0e4" font-size="18" font-family="Arial, sans-serif">Mock snapshot demo repository</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function MockEmbryoRepository(options) {
    const settings = options || {};

    this.name = "mock";
    this.defaultClinicId = settings.defaultClinicId || "clinic_main";
    this.store = {
      clinics: {},
    };

    this.seedDefaultData();
  }

  MockEmbryoRepository.prototype.ensureClinicNode = function (clinicId) {
    const resolvedClinicId = clinicId || this.defaultClinicId;

    if (!this.store.clinics[resolvedClinicId]) {
      const clinicRecord = app.domain.normalizers.clinic({
        id: resolvedClinicId,
        name: resolvedClinicId === "clinic_main" ? "Embryo Sardegna" : resolvedClinicId,
      });

      this.store.clinics[resolvedClinicId] = createClinicNode(clinicRecord);
    }

    return this.store.clinics[resolvedClinicId];
  };

  MockEmbryoRepository.prototype.ensureUnassignedSession = function (clinicId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const session = createUnassignedSessionRecord(clinicNode.record.id);

    if (!clinicNode.sessions[session.id]) {
      clinicNode.sessions[session.id] = session;
    }

    return app.domain.helpers.deepClone(clinicNode.sessions[session.id]);
  };

  MockEmbryoRepository.prototype.ensureAnimalNode = function (clinicId, animalId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const animalNode = clinicNode.animals[animalId];

    if (!animalNode) {
      throw new Error(`Animal not found: ${animalId}`);
    }

    return animalNode;
  };

  MockEmbryoRepository.prototype.ensureVisitNode = function (clinicId, animalId, visitId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const visitNode = animalNode.visits[visitId];

    if (!visitNode) {
      throw new Error(`Visit not found: ${visitId}`);
    }

    return visitNode;
  };

  MockEmbryoRepository.prototype.upsertAnimalRecord = function (clinicId, payload) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const normalizedAnimal = app.domain.normalizers.animal(payload);
    const existingNode = clinicNode.animals[normalizedAnimal.id];

    if (existingNode) {
      existingNode.record = normalizedAnimal;
      return existingNode;
    }

    const animalNode = createAnimalNode(normalizedAnimal);
    clinicNode.animals[normalizedAnimal.id] = animalNode;
    return animalNode;
  };

  MockEmbryoRepository.prototype.upsertVisitRecord = function (clinicId, animalId, payload) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const normalizedVisit = app.domain.normalizers.visit(payload);
    const existingNode = animalNode.visits[normalizedVisit.id];

    if (existingNode) {
      existingNode.record = normalizedVisit;
      return existingNode;
    }

    const visitNode = createVisitNode(normalizedVisit);
    animalNode.visits[normalizedVisit.id] = visitNode;
    return visitNode;
  };

  MockEmbryoRepository.prototype.recomputeAnimalRollup = function (clinicId, animalId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const visitNodes = Object.keys(animalNode.visits).map((visitId) => animalNode.visits[visitId]);
    const orderedVisits = sortByDateDesc(
      visitNodes.map((visitNode) => app.domain.helpers.deepClone(visitNode.record)),
      "visitAt"
    );
    const latestVisit = orderedVisits[0] || null;
    const mergedAnimal = app.domain.helpers.mergeDeep(animalNode.record, {
      visitCount: orderedVisits.length,
      lastVisitAt: latestVisit ? latestVisit.visitAt : null,
      lastVisitId: latestVisit ? latestVisit.id : null,
      lastVisitSummary: latestVisit ? app.domain.normalizers.animalSnapshotFromVisit(latestVisit) : null,
      bodyConditionScore: getLatestBodyConditionScore(orderedVisits, orderedVisits.length ? null : animalNode.record.bodyConditionScore),
      updatedAt: app.domain.modelUtils.nowIso(),
    });

    animalNode.record = app.domain.normalizers.animal(mergedAnimal);
  };

  MockEmbryoRepository.prototype.recomputeSessionDateRange = function (clinicId, sessionId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      this.ensureUnassignedSession(clinicId);
    } else if (!clinicNode.sessions[resolvedSessionId]) {
      return null;
    }

    const timestamps = [];

    Object.keys(clinicNode.animals).forEach((animalId) => {
      const animalNode = clinicNode.animals[animalId];

      Object.keys(animalNode.visits).forEach((visitId) => {
        const visit = animalNode.visits[visitId].record;

        if (getRecordSessionId(visit) !== resolvedSessionId) {
          return;
        }

        const timestamp = getVisitTimestamp(visit);

        if (timestamp !== null) {
          timestamps.push(timestamp);
        }
      });
    });

    timestamps.sort((left, right) => left - right);

    const existingSession = clinicNode.sessions[resolvedSessionId];
    const nextStartDate = timestamps.length ? new Date(timestamps[0]).toISOString() : null;
    const nextEndDate = timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;

    if ((existingSession.startDate || null) === nextStartDate && (existingSession.endDate || null) === nextEndDate) {
      return app.domain.helpers.deepClone(existingSession);
    }

    const normalizedSession = app.domain.normalizers.session(
      app.domain.helpers.mergeDeep(existingSession, {
        startDate: nextStartDate,
        endDate: nextEndDate,
        updatedAt: app.domain.modelUtils.nowIso(),
      })
    );

    clinicNode.sessions[resolvedSessionId] = normalizedSession;
    return app.domain.helpers.deepClone(normalizedSession);
  };

  MockEmbryoRepository.prototype.recomputeSessionsDateRange = function (clinicId, sessionIds) {
    const uniqueSessionIds = Array.from(new Set((sessionIds || []).filter(Boolean)));

    uniqueSessionIds.forEach((sessionId) => {
      this.recomputeSessionDateRange(clinicId, sessionId);
    });
  };

  MockEmbryoRepository.prototype.recomputeAllSessionDateRanges = async function (clinicId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    this.ensureUnassignedSession(clinicId);
    this.recomputeSessionsDateRange(clinicId, Object.keys(clinicNode.sessions));
  };

  MockEmbryoRepository.prototype.updateAnimalVisitsSession = function (clinicId, animalId, session) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);

    Object.keys(animalNode.visits).forEach((visitId) => {
      const visitNode = animalNode.visits[visitId];
      visitNode.record = app.domain.normalizers.visit(
        app.domain.helpers.mergeDeep(visitNode.record, {
          sessionId: session.id,
          sessionName: session.name,
          updatedAt: app.domain.modelUtils.nowIso(),
        })
      );
    });
  };

  MockEmbryoRepository.prototype.updateSessionReferences = function (clinicId, session) {
    const clinicNode = this.ensureClinicNode(clinicId);

    Object.keys(clinicNode.animals).forEach((animalId) => {
      const animalNode = clinicNode.animals[animalId];

      if (animalNode.record.sessionId !== session.id) {
        return;
      }

      animalNode.record = app.domain.normalizers.animal(
        app.domain.helpers.mergeDeep(animalNode.record, {
          sessionName: session.name,
          updatedAt: app.domain.modelUtils.nowIso(),
        })
      );
      this.updateAnimalVisitsSession(clinicId, animalId, session);
    });
  };

  MockEmbryoRepository.prototype.seedDefaultData = function () {
    const clinicNode = this.ensureClinicNode(this.defaultClinicId);
    const createdAt = app.domain.modelUtils.nowIso();

    clinicNode.record = app.domain.normalizers.clinic({
      id: this.defaultClinicId,
      name: "Embryo Sardegna",
      defaultSpecies: ["ovine", "bovine", "caprine"],
      createdAt,
    });
    this.ensureUnassignedSession(this.defaultClinicId);

    const ov184Visit01LeftCounts = {
      totalFollicles: 5,
      smallFollicles: 2,
      mediumFollicles: 2,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 1,
      averageFollicleSizeMm: 3.8,
      largestFollicleMm: 6,
    };
    const ov184Visit01RightCounts = {
      totalFollicles: 4,
      smallFollicles: 1,
      mediumFollicles: 2,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 0,
      averageFollicleSizeMm: 4.2,
      largestFollicleMm: 6.5,
    };
    const ov184Visit02LeftCounts = {
      totalFollicles: 6,
      smallFollicles: 1,
      mediumFollicles: 4,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 1,
      averageFollicleSizeMm: 4.4,
      largestFollicleMm: 6.5,
    };
    const ov184Visit02RightCounts = {
      totalFollicles: 5,
      smallFollicles: 1,
      mediumFollicles: 3,
      largeFollicles: 1,
      ovulations: 1,
      corporaLutea: 0,
      averageFollicleSizeMm: 4.6,
      largestFollicleMm: 7,
    };
    const ov184Visit03LeftCounts = {
      totalFollicles: 4,
      smallFollicles: 1,
      mediumFollicles: 2,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 1,
      averageFollicleSizeMm: 4.9,
      largestFollicleMm: 6.5,
    };
    const ov184Visit03RightCounts = {
      totalFollicles: 3,
      smallFollicles: 1,
      mediumFollicles: 1,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 1,
      averageFollicleSizeMm: 5.1,
      largestFollicleMm: 7,
    };
    const ov233Visit01LeftCounts = {
      totalFollicles: 8,
      smallFollicles: 1,
      mediumFollicles: 5,
      largeFollicles: 2,
      ovulations: 0,
      corporaLutea: 0,
      averageFollicleSizeMm: 5.1,
      largestFollicleMm: 7,
    };
    const ov233Visit01RightCounts = {
      totalFollicles: 7,
      smallFollicles: 2,
      mediumFollicles: 4,
      largeFollicles: 1,
      ovulations: 0,
      corporaLutea: 0,
      averageFollicleSizeMm: 4.7,
      largestFollicleMm: 6.5,
    };

    this.upsertAnimalRecord(this.defaultClinicId, {
      id: "animal_ov_184",
      clinicId: this.defaultClinicId,
      animalCode: "OV-184",
      displayName: "OV-184",
      species: "ovine",
      breed: "Sarda",
      sex: "female",
      farmName: "Azienda Rossi",
      groupName: "Recipienti A",
      parity: 2,
      reproductiveRole: "recipient",
      status: "active",
      createdAt,
      updatedAt: createdAt,
      updatedBy: "system",
    });

    this.upsertAnimalRecord(this.defaultClinicId, {
      id: "animal_ov_233",
      clinicId: this.defaultClinicId,
      animalCode: "OV-233",
      displayName: "OV-233",
      species: "ovine",
      breed: "Sarda",
      sex: "female",
      farmName: "Azienda Piras",
      groupName: "Donatrici",
      parity: 4,
      reproductiveRole: "donor",
      status: "active",
      createdAt,
      updatedAt: createdAt,
      updatedBy: "system",
    });

    this.upsertVisitRecord(this.defaultClinicId, "animal_ov_184", {
      id: "visit_ov_184_01",
      clinicId: this.defaultClinicId,
      animalId: "animal_ov_184",
      visitAt: "2026-03-25T08:30:00.000Z",
      visitPurpose: "recipient_selection",
      operatorName: "Antonio Spezzigu",
      species: "ovine",
      uterus: {
        tone: 2,
        vascularization: 1,
        luminalFluid: 1,
      },
      ovaries: {
        left: {
          counts: ov184Visit01LeftCounts,
          structures: buildSeedStructures("L", {
            counts: ov184Visit01LeftCounts,
            hourOffset: 8,
            clAreas: [110],
          }),
        },
        right: {
          counts: ov184Visit01RightCounts,
          structures: buildSeedStructures("R", {
            counts: ov184Visit01RightCounts,
            hourOffset: 2,
          }),
        },
        total: buildSeedTotalCounts(ov184Visit01LeftCounts, ov184Visit01RightCounts),
      },
      summary: {
        headline: "9 follicoli, 1 CL sx",
        shortText: "T2 V1 L1",
      },
      protocolContext: {
        programType: "et",
        protocolName: "Recipient protocol A",
      },
      syncStatus: "synced",
    });

    this.upsertVisitRecord(this.defaultClinicId, "animal_ov_184", {
      id: "visit_ov_184_02",
      clinicId: this.defaultClinicId,
      animalId: "animal_ov_184",
      visitAt: "2026-03-30T08:45:00.000Z",
      visitPurpose: "follicular_monitoring",
      operatorName: "Antonio Spezzigu",
      species: "ovine",
      uterus: {
        tone: 2,
        vascularization: 2,
        luminalFluid: 1,
      },
      ovaries: {
        left: {
          counts: ov184Visit02LeftCounts,
          structures: buildSeedStructures("L", {
            counts: ov184Visit02LeftCounts,
            hourOffset: 7,
            clAreas: [118],
          }),
        },
        right: {
          counts: ov184Visit02RightCounts,
          structures: buildSeedStructures("R", {
            counts: ov184Visit02RightCounts,
            hourOffset: 1,
          }),
        },
        total: buildSeedTotalCounts(ov184Visit02LeftCounts, ov184Visit02RightCounts),
      },
      summary: {
        headline: "11 follicoli, 1 OV dx, 1 CL sx",
        shortText: "T2 V2 L1",
      },
      protocolContext: {
        programType: "et",
        protocolName: "Recipient protocol A",
      },
      syncStatus: "synced",
    });

    this.upsertVisitRecord(this.defaultClinicId, "animal_ov_184", {
      id: "visit_ov_184_03",
      clinicId: this.defaultClinicId,
      animalId: "animal_ov_184",
      visitAt: "2026-04-05T08:20:00.000Z",
      visitPurpose: "pregnancy_diagnosis",
      operatorName: "Antonio Spezzigu",
      species: "ovine",
      uterus: {
        tone: 2,
        vascularization: 2,
        luminalFluid: 1,
      },
      ovaries: {
        left: {
          counts: ov184Visit03LeftCounts,
          structures: buildSeedStructures("L", {
            counts: ov184Visit03LeftCounts,
            hourOffset: 6,
            clAreas: [124],
          }),
        },
        right: {
          counts: ov184Visit03RightCounts,
          structures: buildSeedStructures("R", {
            counts: ov184Visit03RightCounts,
            hourOffset: 0,
            clAreas: [132],
          }),
        },
        total: buildSeedTotalCounts(ov184Visit03LeftCounts, ov184Visit03RightCounts),
      },
      summary: {
        headline: "7 follicoli, 2 CL, gravidanza sospetta",
        shortText: "T2 V2 L1",
        pregnancyStatus: "suspected",
      },
      protocolContext: {
        programType: "et",
        protocolName: "Recipient protocol A",
        daysFromET: 18,
      },
      syncStatus: "synced",
    });

    this.upsertVisitRecord(this.defaultClinicId, "animal_ov_233", {
      id: "visit_ov_233_01",
      clinicId: this.defaultClinicId,
      animalId: "animal_ov_233",
      visitAt: "2026-04-02T09:05:00.000Z",
      visitPurpose: "follicular_monitoring",
      operatorName: "Antonio Spezzigu",
      species: "ovine",
      uterus: {
        tone: 3,
        vascularization: 2,
        luminalFluid: 1,
      },
      ovaries: {
        left: {
          counts: ov233Visit01LeftCounts,
          structures: buildSeedStructures("L", {
            counts: ov233Visit01LeftCounts,
            hourOffset: 8,
          }),
        },
        right: {
          counts: ov233Visit01RightCounts,
          structures: buildSeedStructures("R", {
            counts: ov233Visit01RightCounts,
            hourOffset: 1,
          }),
        },
        total: buildSeedTotalCounts(ov233Visit01LeftCounts, ov233Visit01RightCounts),
      },
      summary: {
        headline: "15 follicoli totali",
        shortText: "T3 V2 L1",
      },
      protocolContext: {
        programType: "moet",
        protocolName: "Donor stimulation",
      },
      syncStatus: "synced",
    });

    this.saveVisitAttachment(this.defaultClinicId, "animal_ov_184", "visit_ov_184_03", {
      id: "att_ov184_03_01",
      type: "snapshot",
      url: createMockSnapshotDataUrl("Snapshot ovaio dx", "#4db8ff"),
      thumbnailUrl: createMockSnapshotDataUrl("Thumb ovaio dx", "#00e0a0"),
      capturedAt: "2026-04-05T08:21:00.000Z",
      label: "Snapshot ovaio dx",
      notes: "Mock attachment per demo",
    });

    this.saveProtocolEvent(this.defaultClinicId, "animal_ov_184", "visit_ov_184_03", {
      id: "evt_ov184_03_01",
      eventAt: "2026-03-18T09:00:00.000Z",
      type: "et",
      name: "Embryo transfer",
      notes: "Transfer eseguito su corno ipsilaterale al CL",
    });

    this.saveProtocolEvent(this.defaultClinicId, "animal_ov_184", "visit_ov_184_03", {
      id: "evt_ov184_03_02",
      eventAt: "2026-03-15T08:30:00.000Z",
      type: "hormone",
      name: "eCG",
      dose: "400",
      unit: "IU",
      route: "im",
      notes: "",
    });

    this.saveProtocolEvent(this.defaultClinicId, "animal_ov_233", "visit_ov_233_01", {
      id: "evt_ov233_01_01",
      eventAt: "2026-03-28T08:00:00.000Z",
      type: "hormone",
      name: "FSH",
      dose: "superov protocol",
      unit: "",
      route: "",
      notes: "Stimolazione donatrice",
    });

    this.recomputeAnimalRollup(this.defaultClinicId, "animal_ov_184");
    this.recomputeAnimalRollup(this.defaultClinicId, "animal_ov_233");
    this.recomputeAllSessionDateRanges(this.defaultClinicId);
  };

  MockEmbryoRepository.prototype.getClinic = async function (clinicId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    return app.domain.helpers.deepClone(clinicNode.record);
  };

  MockEmbryoRepository.prototype.listAnimals = async function (clinicId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const animals = Object.keys(clinicNode.animals).map((animalId) => {
      return app.domain.helpers.deepClone(clinicNode.animals[animalId].record);
    });

    return animals.sort((left, right) => {
      const leftTimestamp = left.lastVisitAt ? new Date(left.lastVisitAt).getTime() : 0;
      const rightTimestamp = right.lastVisitAt ? new Date(right.lastVisitAt).getTime() : 0;

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      return left.animalCode.localeCompare(right.animalCode);
    });
  };

  MockEmbryoRepository.prototype.listSessions = async function (clinicId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    this.ensureUnassignedSession(clinicId);
    const sessions = Object.keys(clinicNode.sessions).map((sessionId) => {
      return app.domain.helpers.deepClone(clinicNode.sessions[sessionId]);
    });

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

  MockEmbryoRepository.prototype.getSession = async function (clinicId, sessionId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      return this.ensureUnassignedSession(clinicId);
    }

    if (!clinicNode.sessions[resolvedSessionId]) {
      throw new Error(`Session not found: ${resolvedSessionId}`);
    }

    return app.domain.helpers.deepClone(clinicNode.sessions[resolvedSessionId]);
  };

  MockEmbryoRepository.prototype.createSession = async function (payload) {
    const normalizedSession = app.domain.normalizers.session(payload);
    const clinicNode = this.ensureClinicNode(normalizedSession.clinicId);

    this.ensureUnassignedSession(normalizedSession.clinicId);
    clinicNode.sessions[normalizedSession.id] = normalizedSession;

    return this.getSession(normalizedSession.clinicId, normalizedSession.id);
  };

  MockEmbryoRepository.prototype.updateSession = async function (sessionId, patch, options) {
    const settings = options || {};
    const clinicId = settings.clinicId || this.defaultClinicId;
    const clinicNode = this.ensureClinicNode(clinicId);
    const existingSession = await this.getSession(clinicId, sessionId);
    const normalizedSession = app.domain.normalizers.session(app.domain.helpers.mergeDeep(existingSession, patch || {}));

    clinicNode.sessions[sessionId] = normalizedSession;

    if (existingSession.name !== normalizedSession.name) {
      this.updateSessionReferences(clinicId, normalizedSession);
    }

    return this.getSession(clinicId, sessionId);
  };

  MockEmbryoRepository.prototype.deleteSession = async function (clinicId, sessionId, options) {
    const settings = options || {};
    const resolvedSessionId = sessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;

    if (resolvedSessionId === app.domain.modelUtils.UNASSIGNED_SESSION_ID) {
      throw new Error("Cannot delete the unassigned session");
    }

    await this.getSession(clinicId, resolvedSessionId);

    const clinicNode = this.ensureClinicNode(clinicId);
    const unassignedSession = this.ensureUnassignedSession(clinicId);
    const result = {
      sessionId: resolvedSessionId,
      deletedAnimals: 0,
      deletedVisits: 0,
      reassignedAnimals: 0,
    };
    const animalIds = Object.keys(clinicNode.animals);
    const affectedSessionIds = [];

    for (let index = 0; index < animalIds.length; index += 1) {
      const animalId = animalIds[index];
      const animalNode = clinicNode.animals[animalId];

      if (!animalNode) {
        continue;
      }

      const animalBelongsToSession = getRecordSessionId(animalNode.record) === resolvedSessionId;

      if (settings.deleteAnimals && animalBelongsToSession) {
        result.deletedVisits += Object.keys(animalNode.visits).length;
        await this.deleteAnimal(clinicId, animalId);
        result.deletedAnimals += 1;
        continue;
      }

      let animalChanged = false;
      const visitIds = Object.keys(animalNode.visits);

      for (let visitIndex = 0; visitIndex < visitIds.length; visitIndex += 1) {
        const visitId = visitIds[visitIndex];
        const visitNode = animalNode.visits[visitId];

        if (animalBelongsToSession || getRecordSessionId(visitNode.record) === resolvedSessionId) {
          affectedSessionIds.push(getRecordSessionId(visitNode.record));
          delete animalNode.visits[visitId];
          result.deletedVisits += 1;
          animalChanged = true;
        }
      }

      if (animalBelongsToSession) {
        animalNode.record = app.domain.normalizers.animal(
          app.domain.helpers.mergeDeep(animalNode.record, {
            sessionId: unassignedSession.id,
            sessionName: unassignedSession.name,
            updatedAt: app.domain.modelUtils.nowIso(),
            updatedBy: "demo_user",
          })
        );
        result.reassignedAnimals += 1;
        animalChanged = true;
      }

      if (animalChanged) {
        this.recomputeAnimalRollup(clinicId, animalId);
      }
    }

    this.recomputeSessionsDateRange(
      clinicId,
      affectedSessionIds.filter((affectedSessionId) => affectedSessionId !== resolvedSessionId)
    );
    delete clinicNode.sessions[resolvedSessionId];
    this.ensureUnassignedSession(clinicId);
    return result;
  };

  MockEmbryoRepository.prototype.createAnimal = async function (payload) {
    const normalizedAnimal = app.domain.normalizers.animal(payload);
    this.upsertAnimalRecord(normalizedAnimal.clinicId, normalizedAnimal);
    return this.getAnimal(normalizedAnimal.clinicId, normalizedAnimal.id);
  };

  MockEmbryoRepository.prototype.updateAnimal = async function (animalId, patch, options) {
    const settings = options || {};
    const clinicId = settings.clinicId || this.defaultClinicId;
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const existingSessionId = animalNode.record.sessionId;
    const existingSessionName = animalNode.record.sessionName;
    const mergedRecord = app.domain.helpers.mergeDeep(animalNode.record, patch || {});

    if (patch && patch.sessionId && !patch.sessionName) {
      const session = await this.getSession(clinicId, patch.sessionId);
      mergedRecord.sessionName = session.name;
    }

    animalNode.record = app.domain.normalizers.animal(mergedRecord);

    if (existingSessionId !== animalNode.record.sessionId || existingSessionName !== animalNode.record.sessionName) {
      this.updateAnimalVisitsSession(clinicId, animalId, {
        id: animalNode.record.sessionId,
        name: animalNode.record.sessionName,
      });
      this.recomputeSessionsDateRange(clinicId, [existingSessionId, animalNode.record.sessionId]);
    }

    return this.getAnimal(clinicId, animalId);
  };

  MockEmbryoRepository.prototype.assignAnimalSession = async function (clinicId, animalId, sessionId) {
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

  MockEmbryoRepository.prototype.getAnimal = async function (clinicId, animalId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    return app.domain.helpers.deepClone(animalNode.record);
  };

  MockEmbryoRepository.prototype.deleteAnimal = async function (clinicId, animalId) {
    const clinicNode = this.ensureClinicNode(clinicId);
    const animalNode = clinicNode.animals[animalId];

    if (!animalNode) {
      throw new Error(`Animal not found: ${animalId}`);
    }

    const affectedSessionIds = [getRecordSessionId(animalNode.record)];

    Object.keys(animalNode.visits).forEach((visitId) => {
      affectedSessionIds.push(getRecordSessionId(animalNode.visits[visitId].record));
    });

    delete clinicNode.animals[animalId];
    this.recomputeSessionsDateRange(clinicId, affectedSessionIds);
    return true;
  };

  MockEmbryoRepository.prototype.listAnimalVisits = async function (clinicId, animalId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const visits = Object.keys(animalNode.visits).map((visitId) => buildVisitReturnValue(animalNode.visits[visitId]));
    return sortByDateDesc(visits, "visitAt");
  };

  MockEmbryoRepository.prototype.getVisit = async function (clinicId, animalId, visitId) {
    const visitNode = this.ensureVisitNode(clinicId, animalId, visitId);
    return buildVisitReturnValue(visitNode);
  };

  MockEmbryoRepository.prototype.saveVisit = async function (clinicId, animalId, visitPayload) {
    const animalRecord = await this.getAnimal(clinicId, animalId);
    const normalizedVisit = app.domain.normalizers.visit(
      app.domain.helpers.mergeDeep(visitPayload || {}, {
        clinicId,
        sessionId: (visitPayload && visitPayload.sessionId) || animalRecord.sessionId,
        sessionName: (visitPayload && visitPayload.sessionName) || animalRecord.sessionName,
        animalId,
      })
    );
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const existingNode = animalNode.visits[normalizedVisit.id];
    const previousSessionId = existingNode ? getRecordSessionId(existingNode.record) : null;

    if (existingNode) {
      const attachments = existingNode.attachments;
      const events = existingNode.events;

      existingNode.record = normalizedVisit;
      existingNode.attachments = attachments;
      existingNode.events = events;
    } else {
      animalNode.visits[normalizedVisit.id] = createVisitNode(normalizedVisit);
    }

    this.recomputeAnimalRollup(clinicId, animalId);
    this.recomputeSessionsDateRange(clinicId, [previousSessionId, normalizedVisit.sessionId]);
    return this.getVisit(clinicId, animalId, normalizedVisit.id);
  };

  MockEmbryoRepository.prototype.saveVisitRecord = async function (clinicId, animalId, visitPayload) {
    const animalRecord = await this.getAnimal(clinicId, animalId);
    const normalizedVisit = app.domain.normalizers.visit(
      app.domain.helpers.mergeDeep(visitPayload || {}, {
        clinicId,
        sessionId: (visitPayload && visitPayload.sessionId) || animalRecord.sessionId,
        sessionName: (visitPayload && visitPayload.sessionName) || animalRecord.sessionName,
        animalId,
      })
    );
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const existingNode = animalNode.visits[normalizedVisit.id];

    if (existingNode) {
      const attachments = existingNode.attachments;
      const events = existingNode.events;

      existingNode.record = normalizedVisit;
      existingNode.attachments = attachments;
      existingNode.events = events;
    } else {
      animalNode.visits[normalizedVisit.id] = createVisitNode(normalizedVisit);
    }

    return this.getVisit(clinicId, animalId, normalizedVisit.id);
  };

  MockEmbryoRepository.prototype.deleteVisit = async function (clinicId, animalId, visitId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);

    if (!animalNode.visits[visitId]) {
      throw new Error(`Visit not found: ${visitId}`);
    }

    const deletedSessionId = getRecordSessionId(animalNode.visits[visitId].record);

    delete animalNode.visits[visitId];
    this.recomputeAnimalRollup(clinicId, animalId);
    this.recomputeSessionDateRange(clinicId, deletedSessionId);
    return true;
  };

  MockEmbryoRepository.prototype.listPregnancyChecks = async function (clinicId, animalId) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const checks = Object.keys(animalNode.pregnancyChecks).map((checkId) => {
      return app.domain.helpers.deepClone(animalNode.pregnancyChecks[checkId]);
    });

    return sortByDateDesc(checks, "checkAt");
  };

  MockEmbryoRepository.prototype.savePregnancyCheck = async function (clinicId, animalId, payload) {
    const animalNode = this.ensureAnimalNode(clinicId, animalId);
    const normalizedCheck = app.domain.normalizers.pregnancyCheck(payload);

    animalNode.pregnancyChecks[normalizedCheck.id] = normalizedCheck;
    return app.domain.helpers.deepClone(normalizedCheck);
  };

  MockEmbryoRepository.prototype.saveVisitAttachment = async function (clinicId, animalId, visitId, payload) {
    const visitNode = this.ensureVisitNode(clinicId, animalId, visitId);
    const normalizedAttachment = app.domain.normalizers.attachment(payload);

    visitNode.attachments[normalizedAttachment.id] = normalizedAttachment;
    return app.domain.helpers.deepClone(normalizedAttachment);
  };

  MockEmbryoRepository.prototype.replaceVisitAttachments = async function (clinicId, animalId, visitId, payloads) {
    const visitNode = this.ensureVisitNode(clinicId, animalId, visitId);

    visitNode.attachments = {};

    (payloads || []).forEach((payload) => {
      const normalizedAttachment = app.domain.normalizers.attachment(payload);
      visitNode.attachments[normalizedAttachment.id] = normalizedAttachment;
    });

    return Object.keys(visitNode.attachments).map((attachmentId) => {
      return app.domain.helpers.deepClone(visitNode.attachments[attachmentId]);
    });
  };

  MockEmbryoRepository.prototype.saveProtocolEvent = async function (clinicId, animalId, visitId, payload) {
    const visitNode = this.ensureVisitNode(clinicId, animalId, visitId);
    const normalizedEvent = app.domain.normalizers.protocolEvent(payload);

    visitNode.events[normalizedEvent.id] = normalizedEvent;
    return app.domain.helpers.deepClone(normalizedEvent);
  };

  MockEmbryoRepository.prototype.replaceProtocolEvents = async function (clinicId, animalId, visitId, payloads) {
    const visitNode = this.ensureVisitNode(clinicId, animalId, visitId);

    visitNode.events = {};

    (payloads || []).forEach((payload) => {
      const normalizedEvent = app.domain.normalizers.protocolEvent(payload);
      visitNode.events[normalizedEvent.id] = normalizedEvent;
    });

    return Object.keys(visitNode.events).map((eventId) => {
      return app.domain.helpers.deepClone(visitNode.events[eventId]);
    });
  };

  MockEmbryoRepository.prototype.getSyncTombstone = async function (clinicId, tombstoneKey) {
    if (!this.syncTombstones || !this.syncTombstones[tombstoneKey]) {
      return null;
    }

    const tombstone = this.syncTombstones[tombstoneKey];

    if ((tombstone.clinicId || clinicId) !== clinicId) {
      return null;
    }

    return app.domain.helpers.deepClone(tombstone);
  };

  repositories.MockEmbryoRepository = MockEmbryoRepository;
})();
