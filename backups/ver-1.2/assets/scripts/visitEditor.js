(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const DEFAULT_OPERATOR_NAME = "Antonio Spezzigu";
  const editorState = {
    attachmentDrafts: [],
    protocolEventDrafts: [],
    mode: "new",
    importedFromVisitId: null,
    editingVisitId: null,
  };

  function createEmptyDraftState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function roundNormalized(value, max) {
    if (value === null || value === undefined || !max) {
      return null;
    }

    return Math.round((value / max) * 1000) / 1000;
  }

  function toCanvasPosition(side, structure) {
    const canvas = app.dom.refs.canvases[side];

    if (
      structure.position &&
      structure.position.normalized &&
      structure.position.x !== null &&
      structure.position.x !== undefined &&
      structure.position.y !== null &&
      structure.position.y !== undefined
    ) {
      return {
        x: app.utils.clamp(structure.position.x * canvas.width, 18, canvas.width - 18),
        y: app.utils.clamp(structure.position.y * canvas.height, 18, canvas.height - 18),
      };
    }

    if (structure.clockHour) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radiusX = canvas.width * 0.3;
      const radiusY = canvas.height * 0.28;
      const angle = (structure.clockHour / 12) * Math.PI * 2 - Math.PI / 2;

      return {
        x: app.utils.clamp(centerX + radiusX * Math.cos(angle), 18, canvas.width - 18),
        y: app.utils.clamp(centerY + radiusY * Math.sin(angle), 18, canvas.height - 18),
      };
    }

    return app.utils.randomOvaryPosition(canvas);
  }

  function inferClockHour(side, structure) {
    if (structure.clockHour) {
      return structure.clockHour;
    }

    const canvas = app.dom.refs.canvases[side];

    if (!canvas) {
      return null;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const angle = Math.atan2(structure.y - centerY, structure.x - centerX);
    const normalizedAngle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const rawHour = Math.round((normalizedAngle / (Math.PI * 2)) * 12);

    return rawHour === 0 ? 12 : rawHour;
  }

  function mapEditorTypeToDomain(type) {
    if (type === "ov") {
      return "ovulation";
    }

    if (type === "cl") {
      return "corpus_luteum";
    }

    if (type === "cyst") {
      return "cyst";
    }

    return "follicle";
  }

  function mapDomainTypeToEditor(type) {
    if (type === "ovulation") {
      return "ov";
    }

    if (type === "corpus_luteum") {
      return "cl";
    }

    if (type === "cyst") {
      return "cyst";
    }

    return "fol";
  }

  function getAttachmentTypeLabel(type) {
    const labels = {
      image: "Immagine",
      snapshot: "Snapshot",
      video: "Video",
      document: "Documento",
      report: "Referto",
    };

    return labels[type] || type || "Allegato";
  }

  function getEventTypeLabel(type) {
    const labels = {
      hormone: "Ormone",
      device_inserted: "Dispositivo inserito",
      device_removed: "Dispositivo rimosso",
      estrus_observed: "Estro osservato",
      ai: "IA",
      et: "ET",
      natural_mating: "Monta naturale",
      pregnancy_diagnosis: "Diagnosi gravidanza",
      clinical_note: "Nota clinica",
      other: "Altro",
    };

    return labels[type] || type;
  }

  function parsePathologyFlags(rawValue) {
    return String(rawValue || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result || ""));
      };

      reader.onerror = () => {
        reject(reader.error || new Error("Impossibile leggere il file"));
      };

      reader.readAsDataURL(file);
    });
  }

  function inferAttachmentType(file) {
    const mimeType = String(file.type || "").toLowerCase();
    const fileName = String(file.name || "").toLowerCase();

    if (mimeType.indexOf("image/") === 0) {
      return "image";
    }

    if (mimeType.indexOf("video/") === 0) {
      return "video";
    }

    if (mimeType === "application/pdf" || /\.pdf$/i.test(fileName)) {
      return "report";
    }

    return "document";
  }

  function setEditorMode(mode, visit) {
    editorState.mode = mode;
    editorState.importedFromVisitId = mode === "import" && visit ? visit.id : null;
    editorState.editingVisitId = mode === "edit" && visit ? visit.id : null;

    if (mode === "import" && visit) {
      app.dom.refs.editorModeBadge.textContent = `DA ${app.utils.formatShortDateTime(visit.visitAt)}`;
      return;
    }

    if (mode === "edit" && visit) {
      app.dom.refs.editorModeBadge.textContent = `MOD ${app.utils.formatShortDateTime(visit.visitAt)}`;
      return;
    }

    app.dom.refs.editorModeBadge.textContent = "NUOVA";
  }

  function buildStructures(side) {
    const canvas = app.dom.refs.canvases[side];

    return app.session.getStructures(side).map((structure) => {
      const mappedType = mapEditorTypeToDomain(structure.type);

      return {
        side,
        type: mappedType,
        sizeMm: mappedType === "follicle" || mappedType === "cyst" ? Number(structure.size) : null,
        clAreaMm2: mappedType === "corpus_luteum" && structure.clSurf !== undefined ? structure.clSurf : null,
        clDiameterMm: null,
        isCavitary: null,
        dopplerPerfusionScore: null,
        clockHour: inferClockHour(side, structure),
        position: {
          x: roundNormalized(structure.x, canvas.width),
          y: roundNormalized(structure.y, canvas.height),
          normalized: true,
        },
        source: structure.source || "manual_entry",
        notes: "",
      };
    });
  }

  function buildHeadline(totalCounts, pregnancyStatus) {
    const parts = [];

    if (totalCounts.totalFollicles > 0) {
      parts.push(`${totalCounts.totalFollicles} follicoli`);
    }

    if (totalCounts.ovulations > 0) {
      parts.push(`${totalCounts.ovulations} OV`);
    }

    if (totalCounts.corporaLutea > 0) {
      parts.push(`${totalCounts.corporaLutea} CL`);
    }

    if (totalCounts.cysts > 0) {
      parts.push(`${totalCounts.cysts} cisti`);
    }

    if (pregnancyStatus && pregnancyStatus !== "unknown") {
      parts.push(app.utils.humanizeEnum(app.config.pregnancyStatusLabels, pregnancyStatus, pregnancyStatus).toLowerCase());
    }

    return parts.length ? parts.join(", ") : "Visita ecografica";
  }

  function buildShortText(uterus) {
    return `T${uterus.tone || "-"} V${uterus.vascularization || "-"} L${uterus.luminalFluid || "-"}`;
  }

  function getDefaultContextValues() {
    return {
      visitAt: app.utils.toLocalDateTimeInputValue(new Date()),
      visitPurpose: "follicular_monitoring",
      programType: "unknown",
      protocolName: "",
      operatorName: DEFAULT_OPERATOR_NAME,
      pregnancyStatus: "unknown",
      doppler: false,
    };
  }

  function clearUterusAdvancedInputs() {
    app.dom.refs.uterusEdemaInput.value = "";
    app.dom.refs.uterusTextureInput.value = "";
    app.dom.refs.pathologyFlagsInput.value = "";
    app.dom.refs.leftHornNotesInput.value = "";
    app.dom.refs.rightHornNotesInput.value = "";
  }

  function resetMeasurementState() {
    app.state.structs = { L: [], R: [] };
    app.stateApi.clearPendingCL();
    app.ui.resetUterusControls();
    clearUterusAdvancedInputs();
    app.ui.resetLog();
    app.ui.resetTranscript();
    app.dom.refs.annotationField.value = "";
    app.dom.refs.clModal.classList.remove("open");
    app.stateApi.selectFollicle(3, null);
    app.ui.refreshTray();
    app.canvas.drawAll();
  }

  function clearAttachmentInputs() {
    app.dom.refs.attachmentFileInput.value = "";
    app.dom.refs.attachmentLabelInput.value = "";
  }

  function clearProtocolEventInputs() {
    app.dom.refs.protocolEventTypeInput.value = "hormone";
    app.dom.refs.protocolEventNameInput.value = "";
    app.dom.refs.protocolEventNotesInput.value = "";
    app.dom.refs.protocolEventAtInput.value = app.dom.refs.visitDatetimeInput.value || app.utils.toLocalDateTimeInputValue(new Date());
  }

  function clearPregnancyCheckInputs() {
    app.dom.refs.pregnancyCheckEnabledInput.checked = false;
    app.dom.refs.pregnancyCheckAtInput.value = app.dom.refs.visitDatetimeInput.value || app.utils.toLocalDateTimeInputValue(new Date());
    app.dom.refs.pregnancyDaysFromBreedingInput.value = "";
    app.dom.refs.pregnancyEmbryoCountInput.value = "";
    app.dom.refs.pregnancyHeartbeatInput.value = "";
    app.dom.refs.pregnancyViabilityInput.value = "";
    app.dom.refs.pregnancyCheckNotesInput.value = "";
    setPregnancyCheckEnabled(false);
  }

  function applyContextValues(contextValues) {
    app.dom.refs.visitDatetimeInput.value = contextValues.visitAt;
    app.dom.refs.visitPurposeInput.value = contextValues.visitPurpose;
    app.dom.refs.programTypeInput.value = contextValues.programType;
    app.dom.refs.protocolNameInput.value = contextValues.protocolName;
    app.dom.refs.operatorNameInput.value = contextValues.operatorName;
    app.dom.refs.pregnancyStatusInput.value = contextValues.pregnancyStatus;
    app.dom.refs.dopplerModeInput.checked = Boolean(contextValues.doppler);
    app.dom.refs.protocolEventAtInput.value = contextValues.visitAt;
    app.dom.refs.pregnancyCheckAtInput.value = contextValues.visitAt;
  }

  function applyUterusBasicValue(param, value) {
    if (!value) {
      return;
    }

    const button = app.dom.refs.uterusGroups[param].querySelector(`[data-value="${value}"]`);

    if (button) {
      app.ui.setUterusValue(param, Number(value), button);
    }
  }

  async function createAttachmentDraftFromInputs() {
    const file = app.dom.refs.attachmentFileInput.files && app.dom.refs.attachmentFileInput.files[0];
    const label = app.dom.refs.attachmentLabelInput.value.trim();

    if (!file) {
      return null;
    }

    const url = await readFileAsDataUrl(file);
    const attachmentType = inferAttachmentType(file);
    const draftLabel = label || file.name || getAttachmentTypeLabel(attachmentType);

    return {
      type: attachmentType,
      url,
      thumbnailUrl: attachmentType === "image" ? url : "",
      capturedAt: app.utils.localDateTimeInputToIso(app.dom.refs.visitDatetimeInput.value),
      label: draftLabel,
      notes: "",
      fileName: file.name || draftLabel,
      mimeType: file.type || "",
      sizeBytes: file.size || 0,
    };
  }

  function createProtocolEventDraftFromInputs() {
    const name = app.dom.refs.protocolEventNameInput.value.trim();
    const notes = app.dom.refs.protocolEventNotesInput.value.trim();
    const type = app.dom.refs.protocolEventTypeInput.value;

    if (!name && !notes) {
      return null;
    }

    return {
      eventAt: app.utils.localDateTimeInputToIso(app.dom.refs.protocolEventAtInput.value),
      type,
      name: name || getEventTypeLabel(type),
      notes,
    };
  }

  function renderAttachmentDrafts() {
    const { attachmentDraftList } = app.dom.refs;

    if (!editorState.attachmentDrafts.length) {
      attachmentDraftList.innerHTML = createEmptyDraftState("Nessun allegato in coda per questa visita.");
      return;
    }

    attachmentDraftList.innerHTML = editorState.attachmentDrafts
      .map((draft, index) => {
        const previewText = draft.fileName
          ? `${draft.fileName}${draft.sizeBytes ? ` | ${(draft.sizeBytes / 1024).toFixed(1)} KB` : ""}`
          : "File allegato pronto";

        return (
          '<div class="draft-item">' +
          '<div class="draft-meta">' +
          `<strong>${draft.label || "Allegato visita"}</strong>` +
          `<span>${getAttachmentTypeLabel(draft.type)}</span>` +
          `<span class="draft-preview">${previewText}</span>` +
          "</div>" +
          `<button class="draft-remove-btn" type="button" data-draft-type="attachment" data-draft-index="${index}">Rimuovi</button>` +
          "</div>"
        );
      })
      .join("");
  }

  function renderProtocolEventDrafts() {
    const { protocolEventDraftList } = app.dom.refs;

    if (!editorState.protocolEventDrafts.length) {
      protocolEventDraftList.innerHTML = createEmptyDraftState("Nessun evento protocollo in coda.");
      return;
    }

    protocolEventDraftList.innerHTML = editorState.protocolEventDrafts
      .map((draft, index) => {
        return (
          '<div class="draft-item">' +
          '<div class="draft-meta">' +
          `<strong>${draft.name || "Evento protocollo"}</strong>` +
          `<span>${getEventTypeLabel(draft.type)} | ${app.utils.formatShortDateTime(draft.eventAt)}</span>` +
          `<span>${draft.notes || "Nessuna nota"}</span>` +
          "</div>" +
          `<button class="draft-remove-btn" type="button" data-draft-type="event" data-draft-index="${index}">Rimuovi</button>` +
          "</div>"
        );
      })
      .join("");
  }

  async function addAttachmentDraft(options) {
    const settings = options || {};
    const draft = await createAttachmentDraftFromInputs();

    if (!draft) {
      if (!settings.silentIfEmpty) {
        app.ui.toast("Seleziona prima un file locale da allegare", "warn");
      }
      return false;
    }

    editorState.attachmentDrafts.push(draft);
    clearAttachmentInputs();
    renderAttachmentDrafts();

    if (!settings.silent) {
      app.ui.toast("Allegato aggiunto alla visita");
    }

    return true;
  }

  function addProtocolEventDraft(options) {
    const settings = options || {};
    const draft = createProtocolEventDraftFromInputs();

    if (!draft) {
      if (!settings.silentIfEmpty) {
        app.ui.toast("Inserisci almeno nome o note evento", "warn");
      }
      return false;
    }

    editorState.protocolEventDrafts.push(draft);
    clearProtocolEventInputs();
    renderProtocolEventDrafts();

    if (!settings.silent) {
      app.ui.toast("Evento protocollo aggiunto");
    }

    return true;
  }

  function setPregnancyCheckEnabled(enabled) {
    [
      app.dom.refs.pregnancyCheckAtInput,
      app.dom.refs.pregnancyDaysFromBreedingInput,
      app.dom.refs.pregnancyEmbryoCountInput,
      app.dom.refs.pregnancyHeartbeatInput,
      app.dom.refs.pregnancyViabilityInput,
      app.dom.refs.pregnancyCheckNotesInput,
    ].forEach((element) => {
      element.disabled = !enabled;
    });
  }

  function buildVisitPayload() {
    const selectedAnimal = app.state.workspace.selectedAnimal;
    const activeAnimalId = app.state.context.activeAnimalId || (selectedAnimal ? selectedAnimal.id : "");
    const visitAt = app.utils.localDateTimeInputToIso(app.dom.refs.visitDatetimeInput.value);
    const leftCounts = app.session.getCountsForSide("L");
    const rightCounts = app.session.getCountsForSide("R");
    const totalCounts = app.session.getTotalCounts();
    const uterus = {
      tone: app.state.uterus.T,
      vascularization: app.state.uterus.V,
      luminalFluid: app.state.uterus.L,
      edemaScore: app.dom.refs.uterusEdemaInput.value ? Number(app.dom.refs.uterusEdemaInput.value) : null,
      textureScore: app.dom.refs.uterusTextureInput.value ? Number(app.dom.refs.uterusTextureInput.value) : null,
      leftHornNotes: app.dom.refs.leftHornNotesInput.value.trim(),
      rightHornNotes: app.dom.refs.rightHornNotesInput.value.trim(),
      pathologyFlags: parsePathologyFlags(app.dom.refs.pathologyFlagsInput.value),
    };
    const annotationText = app.dom.refs.annotationField.value.trim();
    const pregnancyStatus = app.dom.refs.pregnancyStatusInput.value || "unknown";
    const payload = {
      clinicId: app.data.activeClinicId,
      animalId: activeAnimalId,
      visitAt,
      visitPurpose: app.dom.refs.visitPurposeInput.value,
      operatorName: app.dom.refs.operatorNameInput.value.trim() || DEFAULT_OPERATOR_NAME,
      deviceId: "web_local_demo",
      species: selectedAnimal ? selectedAnimal.species : "ovine",
      notes: annotationText,
      annotationText,
      examMode: {
        bMode: true,
        doppler: app.dom.refs.dopplerModeInput.checked,
      },
      uterus,
      ovaries: {
        left: {
          counts: leftCounts,
          structures: buildStructures("L"),
        },
        right: {
          counts: rightCounts,
          structures: buildStructures("R"),
        },
        total: totalCounts,
      },
      summary: {
        headline: buildHeadline(totalCounts, pregnancyStatus),
        shortText: buildShortText(uterus),
        clinicalImpression: annotationText,
        pregnancyStatus,
      },
      protocolContext: {
        programType: app.dom.refs.programTypeInput.value,
        protocolName: app.dom.refs.protocolNameInput.value.trim(),
        cycleDay: null,
        daysFromEstrus: null,
        daysFromAI: null,
        daysFromET: null,
      },
      research: {
        studyId: null,
        cohort: null,
        season: "unknown",
        samplingPoint: null,
      },
      extensions: {
        editorLog: app.state.logRows.slice(),
        mode: editorState.mode,
        importedFromVisitId: editorState.importedFromVisitId,
      },
      updatedBy: "demo_user",
      syncStatus: "synced",
    };

    if (editorState.mode === "edit" && editorState.editingVisitId) {
      const currentVisit = app.state.workspace.selectedVisit;

      payload.id = editorState.editingVisitId;

      if (currentVisit && currentVisit.id === editorState.editingVisitId && currentVisit.createdAt) {
        payload.createdAt = currentVisit.createdAt;
      }
    }

    return payload;
  }

  function buildPregnancyCheckPayload() {
    if (!app.dom.refs.pregnancyCheckEnabledInput.checked) {
      return null;
    }

    const status = app.dom.refs.pregnancyStatusInput.value || "unknown";
    const daysFromBreeding = app.dom.refs.pregnancyDaysFromBreedingInput.value;
    const embryoCount = app.dom.refs.pregnancyEmbryoCountInput.value;
    const heartbeatValue = app.dom.refs.pregnancyHeartbeatInput.value;
    const viability = app.dom.refs.pregnancyViabilityInput.value.trim();
    const notes = app.dom.refs.pregnancyCheckNotesInput.value.trim();

    if (!daysFromBreeding && !embryoCount && !heartbeatValue && !viability && !notes && status === "unknown") {
      return null;
    }

    return {
      checkAt: app.utils.localDateTimeInputToIso(app.dom.refs.pregnancyCheckAtInput.value),
      method: "ultrasound",
      daysFromBreeding: daysFromBreeding ? Number(daysFromBreeding) : null,
      pregnancyStatus: status,
      embryoCount: embryoCount ? Number(embryoCount) : null,
      heartbeatDetected: heartbeatValue === "" ? null : heartbeatValue === "true",
      fetalViability: viability,
      crlMm: null,
      estimatedGestationalAgeDays: null,
      notes,
    };
  }

  function hasMeaningfulVisitData(payload, attachments, protocolEvents, pregnancyCheck) {
    const uterus = payload.uterus || {};
    const leftStructures = payload.ovaries.left.structures || [];
    const rightStructures = payload.ovaries.right.structures || [];

    return Boolean(
      leftStructures.length ||
        rightStructures.length ||
        attachments.length ||
        protocolEvents.length ||
        pregnancyCheck ||
        payload.annotationText ||
        payload.notes ||
        uterus.tone ||
        uterus.vascularization ||
        uterus.luminalFluid ||
        uterus.edemaScore ||
        uterus.textureScore ||
        uterus.pathologyFlags.length ||
        uterus.leftHornNotes ||
        uterus.rightHornNotes
    );
  }

  function summarizeEditorStructures(structures) {
    const summary = {
      totalFollicles: 0,
      smallFollicles: 0,
      mediumFollicles: 0,
      largeFollicles: 0,
      ovulations: 0,
      corporaLutea: 0,
      cysts: 0,
    };

    (structures || []).forEach((structure) => {
      if (structure.type === "fol") {
        const size = Number(structure.size) || 0;

        summary.totalFollicles += 1;

        if (size < 3) {
          summary.smallFollicles += 1;
        } else if (size <= 5) {
          summary.mediumFollicles += 1;
        } else {
          summary.largeFollicles += 1;
        }

        return;
      }

      if (structure.type === "ov") {
        summary.ovulations += 1;
        return;
      }

      if (structure.type === "cl") {
        summary.corporaLutea += 1;
        return;
      }

      if (structure.type === "cyst") {
        summary.cysts += 1;
      }
    });

    return summary;
  }

  function createSyntheticImportedStructure(side, type, index, size, clSurf) {
    const canvas = app.dom.refs.canvases[side];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadiusX = canvas.width * 0.42;
    const baseRadiusY = canvas.height * 0.4;
    const hours = [12, 2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11];
    const radiusFactors = [0.22, 0.34, 0.46];
    const clockHour = hours[index % hours.length];
    const ring = Math.floor(index / hours.length);
    const factor = radiusFactors[Math.min(ring, radiusFactors.length - 1)];
    const angle = (clockHour / 12) * Math.PI * 2 - Math.PI / 2;

    return {
      type,
      size: size || null,
      clSurf: clSurf || null,
      x: app.utils.clamp(centerX + baseRadiusX * factor * Math.cos(angle), 18, canvas.width - 18),
      y: app.utils.clamp(centerY + baseRadiusY * factor * Math.sin(angle), 18, canvas.height - 18),
      clockHour,
      source: "import",
    };
  }

  function representativeFollicleSize(category, sideCounts, categoryIndex) {
    if (category === "small") {
      return 2.5;
    }

    if (category === "medium") {
      return 4;
    }

    const largest = Number(sideCounts.largestFollicleMm) || 6;

    if (categoryIndex === 0) {
      return largest;
    }

    return Math.max(5.5, largest - 0.5);
  }

  function buildImportedSideStructures(side, sideRecord) {
    const sideCounts = (sideRecord && sideRecord.counts) || {};
    const rawStructures = (sideRecord && sideRecord.structures) || [];
    const editorStructures = rawStructures.map((structure) => {
      const position = toCanvasPosition(side, structure);
      const editorType = mapDomainTypeToEditor(structure.type);

      return {
        type: editorType,
        size: structure.sizeMm || (editorType === "cyst" ? 6 : null),
        clSurf: structure.clAreaMm2,
        x: position.x,
        y: position.y,
        clockHour: structure.clockHour || null,
        source: "import",
      };
    });
    const current = summarizeEditorStructures(editorStructures);

    function pushMissing(type, count, factory) {
      for (let index = 0; index < count; index += 1) {
        editorStructures.push(factory(index, editorStructures.length));
      }
    }

    const missingSmall = Math.max(0, (sideCounts.smallFollicles || 0) - current.smallFollicles);
    const missingMedium = Math.max(0, (sideCounts.mediumFollicles || 0) - current.mediumFollicles);
    const missingLarge = Math.max(0, (sideCounts.largeFollicles || 0) - current.largeFollicles);

    pushMissing("fol", missingSmall, (categoryIndex, globalIndex) => {
      return createSyntheticImportedStructure(side, "fol", globalIndex, representativeFollicleSize("small", sideCounts, categoryIndex), null);
    });

    pushMissing("fol", missingMedium, (categoryIndex, globalIndex) => {
      return createSyntheticImportedStructure(side, "fol", globalIndex, representativeFollicleSize("medium", sideCounts, categoryIndex), null);
    });

    pushMissing("fol", missingLarge, (categoryIndex, globalIndex) => {
      return createSyntheticImportedStructure(side, "fol", globalIndex, representativeFollicleSize("large", sideCounts, categoryIndex), null);
    });

    const afterFollicles = summarizeEditorStructures(editorStructures);
    const targetTotalFollicles = Number(sideCounts.totalFollicles) || 0;
    const remainingFollicles = Math.max(0, targetTotalFollicles - afterFollicles.totalFollicles);

    pushMissing("fol", remainingFollicles, (_, globalIndex) => {
      return createSyntheticImportedStructure(side, "fol", globalIndex, 4, null);
    });

    const afterTotal = summarizeEditorStructures(editorStructures);

    pushMissing("ov", Math.max(0, (sideCounts.ovulations || 0) - afterTotal.ovulations), (_, globalIndex) => {
      return createSyntheticImportedStructure(side, "ov", globalIndex, null, null);
    });

    pushMissing("cl", Math.max(0, (sideCounts.corporaLutea || 0) - afterTotal.corporaLutea), (_, globalIndex) => {
      return createSyntheticImportedStructure(side, "cl", globalIndex, null, null);
    });

    pushMissing("cyst", Math.max(0, (sideCounts.cysts || 0) - afterTotal.cysts), (_, globalIndex) => {
      return createSyntheticImportedStructure(side, "cyst", globalIndex, 8, null);
    });

    return editorStructures;
  }

  function populateStructuresFromVisit(visit) {
    const nextStructures = { L: [], R: [] };

    ["left", "right"].forEach((sideKey) => {
      const side = sideKey === "left" ? "L" : "R";
      nextStructures[side] = buildImportedSideStructures(side, visit.ovaries[sideKey] || {});
    });

    app.state.structs = nextStructures;
  }

  function loadVisitIntoEditor(visit, options) {
    const settings = options || {};
    const isEditMode = settings.mode === "edit";
    const visitAtValue = isEditMode
      ? app.utils.toLocalDateTimeInputValue(visit.visitAt)
      : app.utils.toLocalDateTimeInputValue(new Date());

    resetMeasurementState();
    applyContextValues({
      visitAt: visitAtValue,
      visitPurpose: visit.visitPurpose || "follicular_monitoring",
      programType: (visit.protocolContext && visit.protocolContext.programType) || "unknown",
      protocolName: (visit.protocolContext && visit.protocolContext.protocolName) || "",
      operatorName: visit.operatorName || DEFAULT_OPERATOR_NAME,
      pregnancyStatus: (visit.summary && visit.summary.pregnancyStatus) || "unknown",
      doppler: Boolean(visit.examMode && visit.examMode.doppler),
    });

    applyUterusBasicValue("T", visit.uterus.tone);
    applyUterusBasicValue("V", visit.uterus.vascularization);
    applyUterusBasicValue("L", visit.uterus.luminalFluid);
    app.dom.refs.uterusEdemaInput.value = visit.uterus.edemaScore || "";
    app.dom.refs.uterusTextureInput.value = visit.uterus.textureScore || "";
    app.dom.refs.pathologyFlagsInput.value = (visit.uterus.pathologyFlags || []).join(", ");
    app.dom.refs.leftHornNotesInput.value = visit.uterus.leftHornNotes || "";
    app.dom.refs.rightHornNotesInput.value = visit.uterus.rightHornNotes || "";
    app.dom.refs.annotationField.value = visit.annotationText || visit.notes || "";

    editorState.attachmentDrafts = (visit.attachments || []).map((attachment) => {
      return {
        id: attachment.id,
        type: attachment.type,
        url: attachment.url,
        thumbnailUrl: attachment.thumbnailUrl,
        capturedAt: attachment.capturedAt,
        label: attachment.label,
        notes: attachment.notes || "",
        fileName: attachment.label || attachment.type || "allegato",
      };
    });

    editorState.protocolEventDrafts = (visit.events || []).map((eventRecord) => {
      return {
        id: eventRecord.id,
        eventAt: eventRecord.eventAt,
        type: eventRecord.type,
        name: eventRecord.name,
        notes: eventRecord.notes || "",
        dose: eventRecord.dose || "",
        unit: eventRecord.unit || "",
        route: eventRecord.route || "",
      };
    });

    clearAttachmentInputs();
    clearProtocolEventInputs();
    clearPregnancyCheckInputs();
    populateStructuresFromVisit(visit);
    app.canvas.drawAll();
    renderAttachmentDrafts();
    renderProtocolEventDrafts();
    setEditorMode(isEditMode ? "edit" : "import", visit);
  }

  app.visitEditor = {
    init() {
      this.bindEvents();
      this.resetEditor();
      renderAttachmentDrafts();
      renderProtocolEventDrafts();
      setEditorMode("new", null);
    },

    bindEvents() {
      app.dom.refs.saveVisitBtn.addEventListener("click", () => {
        this.saveCurrentVisit();
      });

      app.dom.refs.resetVisitEditorBtn.addEventListener("click", () => {
        this.resetEditor();
        app.ui.toast("Editor visita ripristinato");
      });

      app.dom.refs.newVisitFromScratchBtn.addEventListener("click", () => {
        this.resetEditor();
        app.ui.toast("Editor pronto per una nuova visita");
      });

      app.dom.refs.importSelectedVisitBtn.addEventListener("click", () => {
        this.importSelectedVisit();
      });

      app.dom.refs.addAttachmentBtn.addEventListener("click", async () => {
        try {
          await addAttachmentDraft();
        } catch (error) {
          console.error(error);
          app.ui.toast("Errore durante il caricamento del file allegato", "warn");
        }
      });

      app.dom.refs.attachmentFileInput.addEventListener("change", () => {
        const file = app.dom.refs.attachmentFileInput.files && app.dom.refs.attachmentFileInput.files[0];

        if (file && !app.dom.refs.attachmentLabelInput.value.trim()) {
          app.dom.refs.attachmentLabelInput.value = file.name || "";
        }
      });

      app.dom.refs.attachmentDraftList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-draft-type='attachment']");

        if (!button) {
          return;
        }

        editorState.attachmentDrafts.splice(Number(button.dataset.draftIndex), 1);
        renderAttachmentDrafts();
      });

      app.dom.refs.addProtocolEventBtn.addEventListener("click", () => {
        addProtocolEventDraft();
      });

      app.dom.refs.protocolEventDraftList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-draft-type='event']");

        if (!button) {
          return;
        }

        editorState.protocolEventDrafts.splice(Number(button.dataset.draftIndex), 1);
        renderProtocolEventDrafts();
      });

      app.dom.refs.pregnancyCheckEnabledInput.addEventListener("change", (event) => {
        setPregnancyCheckEnabled(event.target.checked);
      });

      app.dom.refs.visitDatetimeInput.addEventListener("change", () => {
        const visitAt = app.dom.refs.visitDatetimeInput.value;

        if (!app.dom.refs.protocolEventAtInput.value) {
          app.dom.refs.protocolEventAtInput.value = visitAt;
        }

        if (!app.dom.refs.pregnancyCheckAtInput.value) {
          app.dom.refs.pregnancyCheckAtInput.value = visitAt;
        }
      });
    },

    resetEditor(options) {
      const settings = options || {};
      const defaults = getDefaultContextValues();
      const preservedValues = settings.preserveContext
        ? {
            visitAt: defaults.visitAt,
            visitPurpose: app.dom.refs.visitPurposeInput.value || defaults.visitPurpose,
            programType: app.dom.refs.programTypeInput.value || defaults.programType,
            protocolName: app.dom.refs.protocolNameInput.value,
            operatorName: app.dom.refs.operatorNameInput.value || defaults.operatorName,
            pregnancyStatus: "unknown",
            doppler: false,
          }
        : defaults;

      editorState.attachmentDrafts = [];
      editorState.protocolEventDrafts = [];
      editorState.editingVisitId = null;
      editorState.importedFromVisitId = null;
      resetMeasurementState();
      applyContextValues(preservedValues);
      clearAttachmentInputs();
      clearProtocolEventInputs();
      clearPregnancyCheckInputs();
      renderAttachmentDrafts();
      renderProtocolEventDrafts();
      setEditorMode("new", null);
    },

    importSelectedVisit() {
      const visit = app.state.workspace.selectedVisit;

      if (!visit) {
        app.ui.toast("Seleziona prima una visita dallo storico o dalle ultime 3", "warn");
        return;
      }

      loadVisitIntoEditor(visit, { mode: "import" });
      app.ui.toast("Visita selezionata importata nell'editor");
    },

    editSelectedVisit() {
      const visit = app.state.workspace.selectedVisit;

      if (!visit) {
        app.ui.toast("Seleziona prima una visita da modificare", "warn");
        return;
      }

      loadVisitIntoEditor(visit, { mode: "edit" });
      app.ui.toast("Visita aperta in modifica");
    },

    loadVisitForEdit(visit) {
      if (!visit) {
        app.ui.toast("Visita non disponibile per la modifica", "warn");
        return;
      }

      loadVisitIntoEditor(visit, { mode: "edit" });
    },

    async saveCurrentVisit() {
      const animalId =
        app.state.context.activeAnimalId ||
        (app.state.workspace.selectedAnimal ? app.state.workspace.selectedAnimal.id : null);

      if (!animalId) {
        app.ui.toast("Seleziona prima un animale dal pannello sinistro", "warn");
        return;
      }

      if (!app.state.context.activeAnimalId) {
        app.state.context.activeAnimalId = animalId;
      }

      try {
        await addAttachmentDraft({ silent: true, silentIfEmpty: true });
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante il caricamento del file allegato", "warn");
        return;
      }

      addProtocolEventDraft({ silent: true, silentIfEmpty: true });

      const payload = buildVisitPayload();
      const attachments = editorState.attachmentDrafts.slice();
      const protocolEvents = editorState.protocolEventDrafts.slice();
      const pregnancyCheck = buildPregnancyCheckPayload();
      const isImported = editorState.mode === "import";
      const isEditing = editorState.mode === "edit";

      if (!hasMeaningfulVisitData(payload, attachments, protocolEvents, pregnancyCheck)) {
        app.ui.toast("Inserisci almeno una struttura, un parametro uterino, una nota, un allegato o un evento", "warn");
        return;
      }

      app.dom.refs.saveVisitBtn.disabled = true;
      app.dom.refs.saveVisitBtn.textContent = isEditing ? "Aggiornamento..." : "Salvataggio...";

      try {
        const savedVisit = await app.data.repository.saveVisit(app.data.activeClinicId, animalId, payload);

        if (isEditing && typeof app.data.repository.replaceVisitAttachments === "function") {
          await app.data.repository.replaceVisitAttachments(app.data.activeClinicId, animalId, savedVisit.id, attachments);
        } else if (typeof app.data.repository.saveVisitAttachment === "function") {
          for (let index = 0; index < attachments.length; index += 1) {
            await app.data.repository.saveVisitAttachment(app.data.activeClinicId, animalId, savedVisit.id, attachments[index]);
          }
        }

        if (isEditing && typeof app.data.repository.replaceProtocolEvents === "function") {
          await app.data.repository.replaceProtocolEvents(app.data.activeClinicId, animalId, savedVisit.id, protocolEvents);
        } else if (typeof app.data.repository.saveProtocolEvent === "function") {
          for (let index = 0; index < protocolEvents.length; index += 1) {
            await app.data.repository.saveProtocolEvent(app.data.activeClinicId, animalId, savedVisit.id, protocolEvents[index]);
          }
        }

        if (pregnancyCheck && typeof app.data.repository.savePregnancyCheck === "function") {
          await app.data.repository.savePregnancyCheck(app.data.activeClinicId, animalId, pregnancyCheck);
        }

        await app.workspace.refreshAnimals(animalId);
        await app.workspace.selectVisit(savedVisit.id);
        this.resetEditor({ preserveContext: true });

        if (isEditing) {
          app.ui.toast("Visita aggiornata");
        } else if (isImported) {
          app.ui.toast("Nuova visita derivata salvata");
        } else {
          app.ui.toast("Visita salvata nel repository demo");
        }
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante il salvataggio visita", "warn");
      } finally {
        app.dom.refs.saveVisitBtn.disabled = false;
        app.dom.refs.saveVisitBtn.textContent = "Salva visita";
      }
    },
  };
})();
