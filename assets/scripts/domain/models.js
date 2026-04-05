(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const domain = (app.domain = app.domain || {});

  function createId(prefix) {
    const randomPart = Math.random().toString(36).slice(2, 10);
    const timePart = Date.now().toString(36);
    return `${prefix}_${timePart}_${randomPart}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createLastVisitSummaryTemplate() {
    return {
      totalFollicles: 0,
      smallFollicles: 0,
      mediumFollicles: 0,
      largeFollicles: 0,
      ovulations: 0,
      corporaLutea: 0,
      uterusTone: null,
      uterusVascularization: null,
      uterusLuminalFluid: null,
      pregnancyStatus: "unknown",
    };
  }

  function createCountsTemplate() {
    return {
      totalFollicles: 0,
      smallFollicles: 0,
      mediumFollicles: 0,
      largeFollicles: 0,
      ovulations: 0,
      corporaLutea: 0,
      cysts: 0,
      averageFollicleSizeMm: null,
      largestFollicleMm: null,
    };
  }

  function createClinicTemplate() {
    return {
      id: "",
      name: "",
      timezone: "Europe/Rome",
      defaultSpecies: ["ovine"],
      createdAt: nowIso(),
      schemaVersion: 2,
    };
  }

  function createAnimalTemplate() {
    return {
      id: "",
      clinicId: "clinic_main",
      animalCode: "",
      displayName: "",
      species: "ovine",
      breed: "",
      sex: "female",
      earTag: "",
      farmId: "",
      farmName: "",
      groupId: "",
      groupName: "",
      birthDate: null,
      ageMonths: null,
      parity: null,
      bodyWeightKg: null,
      bodyConditionScore: null,
      lactationStatus: "unknown",
      reproductiveRole: "monitoring_only",
      status: "active",
      notes: "",
      researchTags: [],
      visitCount: 0,
      lastVisitAt: null,
      lastVisitId: null,
      lastVisitSummary: createLastVisitSummaryTemplate(),
      speciesData: {
        ovine: {
          flockRole: "",
          ramExposureDate: null,
        },
        bovine: {
          lactationNumber: null,
          daysInMilk: null,
          postpartumDays: null,
          milkYieldKg: null,
        },
      },
      extensions: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: "",
      deletedAt: null,
      schemaVersion: 2,
    };
  }

  function createUterusTemplate() {
    return {
      tone: null,
      vascularization: null,
      luminalFluid: null,
      edemaScore: null,
      textureScore: null,
      leftHornNotes: "",
      rightHornNotes: "",
      pathologyFlags: [],
    };
  }

  function createOvarySideTemplate() {
    return {
      counts: createCountsTemplate(),
      structures: [],
    };
  }

  function createVisitSummaryTemplate() {
    return {
      headline: "",
      shortText: "",
      clinicalImpression: "",
      pregnancyStatus: "unknown",
    };
  }

  function createProtocolContextTemplate() {
    return {
      programType: "unknown",
      protocolName: "",
      cycleDay: null,
      daysFromEstrus: null,
      daysFromAI: null,
      daysFromET: null,
    };
  }

  function createResearchTemplate() {
    return {
      studyId: null,
      cohort: null,
      season: "unknown",
      samplingPoint: null,
    };
  }

  function createVisitTemplate() {
    return {
      id: "",
      clinicId: "clinic_main",
      animalId: "",
      visitAt: nowIso(),
      visitPurpose: "follicular_monitoring",
      operatorId: "",
      operatorName: "",
      deviceId: "",
      species: "ovine",
      notes: "",
      annotationText: "",
      examMode: {
        bMode: true,
        doppler: false,
      },
      uterus: createUterusTemplate(),
      ovaries: {
        left: createOvarySideTemplate(),
        right: createOvarySideTemplate(),
        total: createCountsTemplate(),
      },
      summary: createVisitSummaryTemplate(),
      protocolContext: createProtocolContextTemplate(),
      research: createResearchTemplate(),
      extensions: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: "",
      syncStatus: "pending",
      schemaVersion: 2,
    };
  }

  function createStructureTemplate() {
    return {
      id: "",
      side: "L",
      type: "follicle",
      sizeMm: null,
      clAreaMm2: null,
      clDiameterMm: null,
      isCavitary: null,
      dopplerPerfusionScore: null,
      clockHour: null,
      position: {
        x: null,
        y: null,
        normalized: true,
      },
      source: "manual_entry",
      notes: "",
      createdAt: nowIso(),
    };
  }

  function createProtocolEventTemplate() {
    return {
      id: "",
      eventAt: nowIso(),
      type: "other",
      name: "",
      dose: "",
      unit: "",
      route: "",
      notes: "",
    };
  }

  function createPregnancyCheckTemplate() {
    return {
      id: "",
      checkAt: nowIso(),
      method: "ultrasound",
      daysFromBreeding: null,
      pregnancyStatus: "unknown",
      embryoCount: null,
      heartbeatDetected: null,
      fetalViability: "",
      crlMm: null,
      estimatedGestationalAgeDays: null,
      notes: "",
      schemaVersion: 2,
    };
  }

  function createAttachmentTemplate() {
    return {
      id: "",
      type: "image",
      url: "",
      thumbnailUrl: "",
      capturedAt: nowIso(),
      label: "",
      notes: "",
    };
  }

  domain.modelUtils = {
    createId,
    nowIso,
  };

  domain.models = {
    createClinicTemplate,
    createAnimalTemplate,
    createVisitTemplate,
    createStructureTemplate,
    createProtocolEventTemplate,
    createPregnancyCheckTemplate,
    createAttachmentTemplate,
    createCountsTemplate,
    createLastVisitSummaryTemplate,
    createUterusTemplate,
    createOvarySideTemplate,
    createVisitSummaryTemplate,
    createProtocolContextTemplate,
    createResearchTemplate,
  };
})();
