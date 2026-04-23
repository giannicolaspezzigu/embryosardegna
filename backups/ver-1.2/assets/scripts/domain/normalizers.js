(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const domain = (app.domain = app.domain || {});

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function mergeDeep(target, source) {
    const output = deepClone(target);

    if (!isPlainObject(source)) {
      return output;
    }

    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];

      if (sourceValue === undefined) {
        return;
      }

      if (Array.isArray(sourceValue)) {
        output[key] = deepClone(sourceValue);
        return;
      }

      if (isPlainObject(sourceValue) && isPlainObject(output[key])) {
        output[key] = mergeDeep(output[key], sourceValue);
        return;
      }

      output[key] = sourceValue;
    });

    return output;
  }

  function normalizeEnum(value, allowedValues, fallbackValue) {
    return allowedValues.indexOf(value) >= 0 ? value : fallbackValue;
  }

  function normalizeNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function normalizeString(value, fallbackValue) {
    if (value === null || value === undefined) {
      return fallbackValue;
    }

    return String(value);
  }

  function normalizeNonEmptyString(value, fallbackValue) {
    if (value === null || value === undefined) {
      return fallbackValue;
    }

    const normalizedValue = String(value).trim();
    return normalizedValue ? normalizedValue : fallbackValue;
  }

  function normalizeStringArray(value) {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }

  function normalizeDateLike(value, fallbackValue) {
    if (!value) {
      return fallbackValue;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallbackValue : date.toISOString();
  }

  function normalizeCounts(input) {
    const output = mergeDeep(domain.models.createCountsTemplate(), input);

    output.totalFollicles = normalizeNullableNumber(output.totalFollicles) || 0;
    output.smallFollicles = normalizeNullableNumber(output.smallFollicles) || 0;
    output.mediumFollicles = normalizeNullableNumber(output.mediumFollicles) || 0;
    output.largeFollicles = normalizeNullableNumber(output.largeFollicles) || 0;
    output.ovulations = normalizeNullableNumber(output.ovulations) || 0;
    output.corporaLutea = normalizeNullableNumber(output.corporaLutea) || 0;
    output.cysts = normalizeNullableNumber(output.cysts) || 0;
    output.averageFollicleSizeMm = normalizeNullableNumber(output.averageFollicleSizeMm);
    output.largestFollicleMm = normalizeNullableNumber(output.largestFollicleMm);

    return output;
  }

  function normalizeLastVisitSummary(input) {
    const output = mergeDeep(domain.models.createLastVisitSummaryTemplate(), input);

    output.totalFollicles = normalizeNullableNumber(output.totalFollicles) || 0;
    output.smallFollicles = normalizeNullableNumber(output.smallFollicles) || 0;
    output.mediumFollicles = normalizeNullableNumber(output.mediumFollicles) || 0;
    output.largeFollicles = normalizeNullableNumber(output.largeFollicles) || 0;
    output.ovulations = normalizeNullableNumber(output.ovulations) || 0;
    output.corporaLutea = normalizeNullableNumber(output.corporaLutea) || 0;
    output.uterusTone = normalizeNullableNumber(output.uterusTone);
    output.uterusVascularization = normalizeNullableNumber(output.uterusVascularization);
    output.uterusLuminalFluid = normalizeNullableNumber(output.uterusLuminalFluid);
    output.pregnancyStatus = normalizeEnum(
      output.pregnancyStatus,
      domain.enums.pregnancyStatus,
      domain.models.createLastVisitSummaryTemplate().pregnancyStatus
    );

    return output;
  }

  function normalizeStructure(input) {
    const template = domain.models.createStructureTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("str"));
    output.side = output.side === "R" ? "R" : "L";
    output.type = normalizeEnum(output.type, domain.enums.structureType, template.type);
    output.sizeMm = normalizeNullableNumber(output.sizeMm);
    output.clAreaMm2 = normalizeNullableNumber(output.clAreaMm2);
    output.clDiameterMm = normalizeNullableNumber(output.clDiameterMm);
    output.isCavitary = output.isCavitary === null || typeof output.isCavitary === "boolean" ? output.isCavitary : null;
    output.dopplerPerfusionScore = normalizeNullableNumber(output.dopplerPerfusionScore);
    output.clockHour = normalizeNullableNumber(output.clockHour);
    output.position = {
      x: normalizeNullableNumber(output.position && output.position.x),
      y: normalizeNullableNumber(output.position && output.position.y),
      normalized: output.position && typeof output.position.normalized === "boolean" ? output.position.normalized : true,
    };
    output.source = normalizeEnum(output.source, domain.enums.scanSource, template.source);
    output.notes = normalizeString(output.notes, "");
    output.createdAt = normalizeDateLike(output.createdAt, domain.modelUtils.nowIso());

    return output;
  }

  function normalizeOvarySide(input) {
    const output = mergeDeep(domain.models.createOvarySideTemplate(), input);
    output.counts = normalizeCounts(output.counts);
    output.structures = Array.isArray(output.structures) ? output.structures.map(normalizeStructure) : [];
    return output;
  }

  function normalizeUterus(input) {
    const output = mergeDeep(domain.models.createUterusTemplate(), input);

    output.tone = normalizeNullableNumber(output.tone);
    output.vascularization = normalizeNullableNumber(output.vascularization);
    output.luminalFluid = normalizeNullableNumber(output.luminalFluid);
    output.edemaScore = normalizeNullableNumber(output.edemaScore);
    output.textureScore = normalizeNullableNumber(output.textureScore);
    output.leftHornNotes = normalizeString(output.leftHornNotes, "");
    output.rightHornNotes = normalizeString(output.rightHornNotes, "");
    output.pathologyFlags = normalizeStringArray(output.pathologyFlags);

    return output;
  }

  function normalizeVisitSummary(input) {
    const template = domain.models.createVisitSummaryTemplate();
    const output = mergeDeep(template, input);

    output.headline = normalizeString(output.headline, "");
    output.shortText = normalizeString(output.shortText, "");
    output.clinicalImpression = normalizeString(output.clinicalImpression, "");
    output.pregnancyStatus = normalizeEnum(output.pregnancyStatus, domain.enums.pregnancyStatus, template.pregnancyStatus);

    return output;
  }

  function normalizeProtocolContext(input) {
    const template = domain.models.createProtocolContextTemplate();
    const output = mergeDeep(template, input);

    output.programType = normalizeEnum(output.programType, domain.enums.programType, template.programType);
    output.protocolName = normalizeString(output.protocolName, "");
    output.cycleDay = normalizeNullableNumber(output.cycleDay);
    output.daysFromEstrus = normalizeNullableNumber(output.daysFromEstrus);
    output.daysFromAI = normalizeNullableNumber(output.daysFromAI);
    output.daysFromET = normalizeNullableNumber(output.daysFromET);

    return output;
  }

  function normalizeResearch(input) {
    const template = domain.models.createResearchTemplate();
    const output = mergeDeep(template, input);

    output.studyId = output.studyId ? String(output.studyId) : null;
    output.cohort = output.cohort ? String(output.cohort) : null;
    output.season = normalizeEnum(output.season, domain.enums.season, template.season);
    output.samplingPoint = output.samplingPoint ? String(output.samplingPoint) : null;

    return output;
  }

  function normalizeClinic(input) {
    const template = domain.models.createClinicTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("clinic"));
    output.name = normalizeString(output.name, "");
    output.timezone = normalizeString(output.timezone, template.timezone);
    output.defaultSpecies = Array.isArray(output.defaultSpecies)
      ? output.defaultSpecies
          .map((item) => normalizeEnum(item, domain.enums.species, null))
          .filter((item) => item !== null)
      : deepClone(template.defaultSpecies);
    output.createdAt = normalizeDateLike(output.createdAt, domain.modelUtils.nowIso());
    output.schemaVersion = 2;

    return output;
  }

  function normalizeAnimal(input) {
    const template = domain.models.createAnimalTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("animal"));
    output.clinicId = normalizeNonEmptyString(output.clinicId, template.clinicId);
    output.animalCode = normalizeNonEmptyString(output.animalCode, output.id);
    output.displayName = normalizeNonEmptyString(output.displayName, output.animalCode);
    output.species = normalizeEnum(output.species, domain.enums.species, template.species);
    output.breed = normalizeString(output.breed, "");
    output.sex = normalizeEnum(output.sex, domain.enums.sex, template.sex);
    output.earTag = normalizeString(output.earTag, "");
    output.farmId = normalizeString(output.farmId, "");
    output.farmName = normalizeString(output.farmName, "");
    output.groupId = normalizeString(output.groupId, "");
    output.groupName = normalizeString(output.groupName, "");
    output.birthDate = output.birthDate ? normalizeDateLike(output.birthDate, null) : null;
    output.ageMonths = normalizeNullableNumber(output.ageMonths);
    output.parity = normalizeNullableNumber(output.parity);
    output.bodyWeightKg = normalizeNullableNumber(output.bodyWeightKg);
    output.bodyConditionScore = normalizeNullableNumber(output.bodyConditionScore);
    output.lactationStatus = normalizeEnum(output.lactationStatus, domain.enums.lactationStatus, template.lactationStatus);
    output.reproductiveRole = normalizeEnum(output.reproductiveRole, domain.enums.reproductiveRole, template.reproductiveRole);
    output.status = normalizeEnum(output.status, domain.enums.animalStatus, template.status);
    output.notes = normalizeString(output.notes, "");
    output.researchTags = normalizeStringArray(output.researchTags);
    output.visitCount = normalizeNullableNumber(output.visitCount) || 0;
    output.lastVisitAt = output.lastVisitAt ? normalizeDateLike(output.lastVisitAt, null) : null;
    output.lastVisitId = output.lastVisitId ? String(output.lastVisitId) : null;
    output.lastVisitSummary = normalizeLastVisitSummary(output.lastVisitSummary);
    output.speciesData = mergeDeep(template.speciesData, output.speciesData);
    output.speciesData.ovine.flockRole = normalizeString(output.speciesData.ovine.flockRole, "");
    output.speciesData.ovine.ramExposureDate = output.speciesData.ovine.ramExposureDate
      ? normalizeDateLike(output.speciesData.ovine.ramExposureDate, null)
      : null;
    output.speciesData.bovine.lactationNumber = normalizeNullableNumber(output.speciesData.bovine.lactationNumber);
    output.speciesData.bovine.daysInMilk = normalizeNullableNumber(output.speciesData.bovine.daysInMilk);
    output.speciesData.bovine.postpartumDays = normalizeNullableNumber(output.speciesData.bovine.postpartumDays);
    output.speciesData.bovine.milkYieldKg = normalizeNullableNumber(output.speciesData.bovine.milkYieldKg);
    output.extensions = isPlainObject(output.extensions) ? deepClone(output.extensions) : {};
    output.createdAt = normalizeDateLike(output.createdAt, domain.modelUtils.nowIso());
    output.updatedAt = normalizeDateLike(output.updatedAt, domain.modelUtils.nowIso());
    output.updatedBy = normalizeString(output.updatedBy, "");
    output.deletedAt = output.deletedAt ? normalizeDateLike(output.deletedAt, null) : null;
    output.schemaVersion = 2;

    return output;
  }

  function normalizeVisit(input) {
    const template = domain.models.createVisitTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("visit"));
    output.clinicId = normalizeNonEmptyString(output.clinicId, template.clinicId);
    output.animalId = normalizeNonEmptyString(output.animalId, "");
    output.visitAt = normalizeDateLike(output.visitAt, domain.modelUtils.nowIso());
    output.visitPurpose = normalizeEnum(output.visitPurpose, domain.enums.visitPurpose, template.visitPurpose);
    output.operatorId = normalizeString(output.operatorId, "");
    output.operatorName = normalizeString(output.operatorName, "");
    output.deviceId = normalizeString(output.deviceId, "");
    output.species = normalizeEnum(output.species, domain.enums.species, template.species);
    output.notes = normalizeString(output.notes, "");
    output.annotationText = normalizeString(output.annotationText, "");
    output.examMode = {
      bMode: Boolean(output.examMode && output.examMode.bMode),
      doppler: Boolean(output.examMode && output.examMode.doppler),
    };
    output.uterus = normalizeUterus(output.uterus);
    output.ovaries = {
      left: normalizeOvarySide(output.ovaries && output.ovaries.left),
      right: normalizeOvarySide(output.ovaries && output.ovaries.right),
      total: normalizeCounts(output.ovaries && output.ovaries.total),
    };
    output.summary = normalizeVisitSummary(output.summary);
    output.protocolContext = normalizeProtocolContext(output.protocolContext);
    output.research = normalizeResearch(output.research);
    output.extensions = isPlainObject(output.extensions) ? deepClone(output.extensions) : {};
    output.createdAt = normalizeDateLike(output.createdAt, domain.modelUtils.nowIso());
    output.updatedAt = normalizeDateLike(output.updatedAt, domain.modelUtils.nowIso());
    output.updatedBy = normalizeString(output.updatedBy, "");
    output.syncStatus = normalizeEnum(output.syncStatus, domain.enums.syncStatus, template.syncStatus);
    output.schemaVersion = 2;

    return output;
  }

  function normalizeProtocolEvent(input) {
    const template = domain.models.createProtocolEventTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("evt"));
    output.eventAt = normalizeDateLike(output.eventAt, domain.modelUtils.nowIso());
    output.type = normalizeEnum(output.type, domain.enums.eventType, template.type);
    output.name = normalizeString(output.name, "");
    output.dose = normalizeString(output.dose, "");
    output.unit = normalizeString(output.unit, "");
    output.route = normalizeString(output.route, "");
    output.notes = normalizeString(output.notes, "");

    return output;
  }

  function normalizePregnancyCheck(input) {
    const template = domain.models.createPregnancyCheckTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("preg"));
    output.checkAt = normalizeDateLike(output.checkAt, domain.modelUtils.nowIso());
    output.method = normalizeString(output.method, "ultrasound");
    output.daysFromBreeding = normalizeNullableNumber(output.daysFromBreeding);
    output.pregnancyStatus = normalizeEnum(output.pregnancyStatus, domain.enums.pregnancyStatus, template.pregnancyStatus);
    output.embryoCount = normalizeNullableNumber(output.embryoCount);
    output.heartbeatDetected =
      output.heartbeatDetected === null || typeof output.heartbeatDetected === "boolean" ? output.heartbeatDetected : null;
    output.fetalViability = normalizeString(output.fetalViability, "");
    output.crlMm = normalizeNullableNumber(output.crlMm);
    output.estimatedGestationalAgeDays = normalizeNullableNumber(output.estimatedGestationalAgeDays);
    output.notes = normalizeString(output.notes, "");
    output.schemaVersion = 2;

    return output;
  }

  function normalizeAttachment(input) {
    const template = domain.models.createAttachmentTemplate();
    const output = mergeDeep(template, input);

    output.id = normalizeNonEmptyString(output.id, domain.modelUtils.createId("att"));
    output.type = normalizeEnum(output.type, domain.enums.attachmentType, template.type);
    output.url = normalizeString(output.url, "");
    output.thumbnailUrl = normalizeString(output.thumbnailUrl, "");
    output.capturedAt = normalizeDateLike(output.capturedAt, domain.modelUtils.nowIso());
    output.label = normalizeString(output.label, "");
    output.notes = normalizeString(output.notes, "");

    return output;
  }

  function createAnimalSnapshotFromVisit(visit) {
    const normalizedVisit = normalizeVisit(visit);

    return normalizeLastVisitSummary({
      totalFollicles: normalizedVisit.ovaries.total.totalFollicles,
      smallFollicles: normalizedVisit.ovaries.total.smallFollicles,
      mediumFollicles: normalizedVisit.ovaries.total.mediumFollicles,
      largeFollicles: normalizedVisit.ovaries.total.largeFollicles,
      ovulations: normalizedVisit.ovaries.total.ovulations,
      corporaLutea: normalizedVisit.ovaries.total.corporaLutea,
      uterusTone: normalizedVisit.uterus.tone,
      uterusVascularization: normalizedVisit.uterus.vascularization,
      uterusLuminalFluid: normalizedVisit.uterus.luminalFluid,
      pregnancyStatus: normalizedVisit.summary.pregnancyStatus,
    });
  }

  domain.normalizers = {
    clinic: normalizeClinic,
    animal: normalizeAnimal,
    visit: normalizeVisit,
    structure: normalizeStructure,
    protocolEvent: normalizeProtocolEvent,
    pregnancyCheck: normalizePregnancyCheck,
    attachment: normalizeAttachment,
    counts: normalizeCounts,
    lastVisitSummary: normalizeLastVisitSummary,
    animalSnapshotFromVisit: createAnimalSnapshotFromVisit,
  };

  domain.helpers = {
    deepClone,
    mergeDeep,
    normalizeEnum,
    normalizeNullableNumber,
    normalizeDateLike,
    normalizeNonEmptyString,
  };
})();
