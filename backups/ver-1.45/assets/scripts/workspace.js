(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createEmptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function createMetricCard(label, value, subtext) {
    return (
      '<div class="metric-card">' +
      `<div class="metric-label">${escapeHtml(label)}</div>` +
      `<div class="metric-value">${escapeHtml(value)}</div>` +
      `<div class="metric-sub">${escapeHtml(subtext || " ")}</div>` +
      "</div>"
    );
  }

  function formatSpecies(species) {
    return app.utils.humanizeEnum(app.config.speciesLabels, species, "Specie");
  }

  function formatRole(role) {
    return app.utils.humanizeEnum(app.config.reproductiveRoleLabels, role, "Ruolo");
  }

  function formatVisitPurpose(purpose) {
    return app.utils.humanizeEnum(app.config.visitPurposeLabels, purpose, "Ecografia");
  }

  function formatProgramType(programType) {
    return app.utils.humanizeEnum(app.config.programTypeLabels, programType, "Non definito");
  }

  function formatPregnancyStatus(status) {
    return app.utils.humanizeEnum(app.config.pregnancyStatusLabels, status, "Non definito");
  }

  const ACTIVE_SESSION_STORAGE_KEY = "embryosardegna.activeSessionId";

  function getRecordSessionId(record) {
    return (record && record.sessionId) || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
  }

  function getRecordSessionName(record) {
    return (record && record.sessionName) || app.domain.modelUtils.UNASSIGNED_SESSION_NAME;
  }

  function formatSessionOption(session) {
    const code = session.code ? ` | ${session.code}` : "";
    return `${session.name}${code}`;
  }

  function createSessionOptionsHtml(sessions, selectedSessionId, options) {
    const settings = options || {};
    const allOption = settings.includeAll ? '<option value="all">Tutte le sessioni</option>' : "";

    return (
      allOption +
      sessions
        .map((session) => {
          const selected = session.id === selectedSessionId ? " selected" : "";
          return `<option value="${escapeHtml(session.id)}"${selected}>${escapeHtml(formatSessionOption(session))}</option>`;
        })
        .join("")
    );
  }

  function isoToDateInputValue(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateInputValueToIso(value) {
    if (!value) {
      return null;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
  }

  function formatStructureType(type) {
    const labels = {
      follicle: "Follicolo",
      ovulation: "Ovulazione",
      corpus_luteum: "Corpo luteo",
      cyst: "Cisti",
      other: "Altro",
    };

    return labels[type] || type;
  }

  function formatAttachmentType(type) {
    const labels = {
      image: "Immagine",
      snapshot: "Snapshot",
      video: "Video",
      document: "Documento",
      report: "Referto",
    };

    return labels[type] || type || "Allegato";
  }

  const MINI_OVARY = {
    width: 150,
    height: 106,
    centerX: 75,
    centerY: 55,
    radiusX: 55,
    radiusY: 35,
  };
  const PREVIEW_FALLBACK_HOURS = [10, 2, 4, 8, 12, 6, 1, 5, 7, 11, 3, 9];

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizePreviewStructureType(type) {
    if (type === "fol" || type === "follicle") {
      return "follicle";
    }

    if (type === "ov" || type === "ovulation") {
      return "ovulation";
    }

    if (type === "cl" || type === "corpus_luteum") {
      return "corpus_luteum";
    }

    if (type === "cyst") {
      return "cyst";
    }

    return "other";
  }

  function previewSideColor(side) {
    return side === "L" ? "#00e0a0" : "#4db8ff";
  }

  function previewSideFill(side) {
    return side === "L" ? "rgba(0,224,160,0.08)" : "rgba(77,184,255,0.08)";
  }

  function summarizePreviewStructures(structures) {
    const summary = {
      totalFollicles: 0,
      smallFollicles: 0,
      mediumFollicles: 0,
      largeFollicles: 0,
      ovulations: 0,
      corporaLutea: 0,
      cysts: 0,
    };

    structures.forEach((structure) => {
      const type = normalizePreviewStructureType(structure.type);

      if (type === "follicle") {
        const size = finiteNumber(structure.sizeMm) || finiteNumber(structure.size);
        summary.totalFollicles += 1;

        if (size !== null) {
          if (size < 3) {
            summary.smallFollicles += 1;
          } else if (size <= 5) {
            summary.mediumFollicles += 1;
          } else {
            summary.largeFollicles += 1;
          }
        }

        return;
      }

      if (type === "ovulation") {
        summary.ovulations += 1;
        return;
      }

      if (type === "corpus_luteum") {
        summary.corporaLutea += 1;
        return;
      }

      if (type === "cyst") {
        summary.cysts += 1;
      }
    });

    return summary;
  }

  function representativePreviewFollicleSize(category, counts, index) {
    if (category === "small") {
      return index % 2 === 0 ? 2 : 2.5;
    }

    if (category === "medium") {
      return index % 2 === 0 ? 4 : 5;
    }

    const largest = finiteNumber(counts.largestFollicleMm);
    return largest !== null ? Math.max(5.5, largest - index * 0.5) : 6;
  }

  function pushSyntheticPreviewStructures(structures, side, type, count, factory) {
    for (let index = 0; index < count; index += 1) {
      const nextIndex = structures.length;
      structures.push(
        Object.assign(
          {
            side,
            type,
            clockHour: PREVIEW_FALLBACK_HOURS[nextIndex % PREVIEW_FALLBACK_HOURS.length],
            syntheticPreview: true,
          },
          factory ? factory(index) : {}
        )
      );
    }
  }

  function buildPreviewStructuresForSide(visit, sideKey, side) {
    const sideRecord = (visit.ovaries && visit.ovaries[sideKey]) || {};
    const counts = sideRecord.counts || {};
    const structures = Array.isArray(sideRecord.structures)
      ? sideRecord.structures.map((structure) => Object.assign({ side }, structure))
      : [];
    const initial = summarizePreviewStructures(structures);

    pushSyntheticPreviewStructures(
      structures,
      side,
      "follicle",
      Math.max(0, (finiteNumber(counts.smallFollicles) || 0) - initial.smallFollicles),
      (index) => ({ sizeMm: representativePreviewFollicleSize("small", counts, index) })
    );

    pushSyntheticPreviewStructures(
      structures,
      side,
      "follicle",
      Math.max(0, (finiteNumber(counts.mediumFollicles) || 0) - initial.mediumFollicles),
      (index) => ({ sizeMm: representativePreviewFollicleSize("medium", counts, index) })
    );

    pushSyntheticPreviewStructures(
      structures,
      side,
      "follicle",
      Math.max(0, (finiteNumber(counts.largeFollicles) || 0) - initial.largeFollicles),
      (index) => ({ sizeMm: representativePreviewFollicleSize("large", counts, index) })
    );

    const afterFollicleBuckets = summarizePreviewStructures(structures);
    pushSyntheticPreviewStructures(
      structures,
      side,
      "follicle",
      Math.max(0, (finiteNumber(counts.totalFollicles) || 0) - afterFollicleBuckets.totalFollicles),
      () => ({ sizeMm: 4 })
    );

    const afterFollicles = summarizePreviewStructures(structures);
    pushSyntheticPreviewStructures(
      structures,
      side,
      "ovulation",
      Math.max(0, (finiteNumber(counts.ovulations) || 0) - afterFollicles.ovulations)
    );
    pushSyntheticPreviewStructures(
      structures,
      side,
      "corpus_luteum",
      Math.max(0, (finiteNumber(counts.corporaLutea) || 0) - afterFollicles.corporaLutea)
    );
    pushSyntheticPreviewStructures(
      structures,
      side,
      "cyst",
      Math.max(0, (finiteNumber(counts.cysts) || 0) - afterFollicles.cysts),
      () => ({ sizeMm: 8 })
    );

    return structures;
  }

  function previewClockPosition(clockHour, index) {
    const hour = finiteNumber(clockHour) || PREVIEW_FALLBACK_HOURS[index % PREVIEW_FALLBACK_HOURS.length];
    const angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;

    return {
      x: MINI_OVARY.centerX + MINI_OVARY.radiusX * 0.58 * Math.cos(angle),
      y: MINI_OVARY.centerY + MINI_OVARY.radiusY * 0.58 * Math.sin(angle),
    };
  }

  function previewStructurePosition(structure, index) {
    const position = structure.position || {};
    const positionX = finiteNumber(position.x);
    const positionY = finiteNumber(position.y);

    if (position.normalized && positionX !== null && positionY !== null) {
      return {
        x: clampNumber(positionX * MINI_OVARY.width, 18, MINI_OVARY.width - 18),
        y: clampNumber(positionY * MINI_OVARY.height, 18, MINI_OVARY.height - 18),
      };
    }

    const rawX = positionX !== null ? positionX : finiteNumber(structure.x);
    const rawY = positionY !== null ? positionY : finiteNumber(structure.y);

    if (rawX !== null && rawY !== null) {
      const x = rawX <= 1 ? rawX * MINI_OVARY.width : (rawX / 280) * MINI_OVARY.width;
      const y = rawY <= 1 ? rawY * MINI_OVARY.height : (rawY / 220) * MINI_OVARY.height;

      return {
        x: clampNumber(x, 18, MINI_OVARY.width - 18),
        y: clampNumber(y, 18, MINI_OVARY.height - 18),
      };
    }

    return previewClockPosition(structure.clockHour, index);
  }

  function buildMiniStructureSvg(structure, side, index) {
    const type = normalizePreviewStructureType(structure.type);
    const position = previewStructurePosition(structure, index);
    const x = Math.round(position.x * 10) / 10;
    const y = Math.round(position.y * 10) / 10;
    const sideColor = previewSideColor(side);

    if (type === "follicle") {
      const size = finiteNumber(structure.sizeMm) || finiteNumber(structure.size) || 4;
      const radius = clampNumber(size * 1.55, 4.5, 13);
      const fontSize = clampNumber(radius * 0.72, 5.5, 8);

      return (
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="${previewSideFill(side)}" stroke="${sideColor}" stroke-width="1.4" />` +
        `<text x="${x}" y="${y + 0.4}" class="visit-ovary-marker-text" fill="${sideColor}" font-size="${fontSize}">${escapeHtml(size)}</text>`
      );
    }

    if (type === "cyst") {
      const size = finiteNumber(structure.sizeMm) || finiteNumber(structure.size) || 8;
      const radius = clampNumber(size * 1.25, 7, 14);

      return (
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="rgba(255,144,66,0.08)" stroke="#ff9042" stroke-width="1.6" stroke-dasharray="4 3" />` +
        `<text x="${x}" y="${y + 0.5}" class="visit-ovary-marker-text" fill="#ff9042" font-size="6.5">CY</text>`
      );
    }

    if (type === "ovulation") {
      const radius = 7.5;

      return (
        `<circle cx="${x}" cy="${y}" r="${radius + 1}" fill="rgba(255,107,107,0.12)" />` +
        `<line x1="${x - radius}" y1="${y}" x2="${x + radius}" y2="${y}" stroke="#ff6b6b" stroke-width="1.8" />` +
        `<line x1="${x}" y1="${y - radius}" x2="${x}" y2="${y + radius}" stroke="#ff6b6b" stroke-width="1.8" />` +
        `<line x1="${x - radius * 0.7}" y1="${y - radius * 0.7}" x2="${x + radius * 0.7}" y2="${y + radius * 0.7}" stroke="#ff6b6b" stroke-width="1.4" />` +
        `<line x1="${x + radius * 0.7}" y1="${y - radius * 0.7}" x2="${x - radius * 0.7}" y2="${y + radius * 0.7}" stroke="#ff6b6b" stroke-width="1.4" />`
      );
    }

    if (type === "corpus_luteum") {
      return (
        `<circle cx="${x}" cy="${y}" r="9" fill="rgba(245,197,24,0.2)" stroke="#f5c518" stroke-width="1.8" />` +
        `<text x="${x}" y="${y + 0.5}" class="visit-ovary-marker-text" fill="#f5c518" font-size="6.7">CL</text>`
      );
    }

    return "";
  }

  function buildMiniOvarySideSvg(visit, sideKey, side, label) {
    const sideColor = previewSideColor(side);
    const structures = buildPreviewStructuresForSide(visit, sideKey, side);
    const structureSvg = structures.map((structure, index) => buildMiniStructureSvg(structure, side, index)).join("");
    const hourSvg = [12, 3, 6, 9]
      .map((hour) => {
        const position = previewClockPosition(hour, 0);
        const x = Math.round((MINI_OVARY.centerX + (position.x - MINI_OVARY.centerX) * 1.42) * 10) / 10;
        const y = Math.round((MINI_OVARY.centerY + (position.y - MINI_OVARY.centerY) * 1.42) * 10) / 10;

        return `<text x="${x}" y="${y}" class="visit-ovary-hour" fill="${sideColor}">${hour}</text>`;
      })
      .join("");

    return (
      `<div class="visit-ovary-side" aria-label="${escapeHtml(label)}">` +
      `<svg class="visit-ovary-svg" viewBox="0 0 ${MINI_OVARY.width} ${MINI_OVARY.height}" focusable="false">` +
      `<text x="8" y="13" class="visit-ovary-side-label" fill="${sideColor}">${escapeHtml(label)}</text>` +
      hourSvg +
      `<ellipse cx="${MINI_OVARY.centerX}" cy="${MINI_OVARY.centerY}" rx="${MINI_OVARY.radiusX}" ry="${MINI_OVARY.radiusY}" fill="${previewSideFill(side)}" stroke="${sideColor}" stroke-width="1.6" />` +
      structureSvg +
      "</svg>" +
      "</div>"
    );
  }

  function buildVisitOvaryPreview(visit) {
    return (
      '<div class="visit-ovary-preview" aria-label="Anteprima grafica ovaie">' +
      buildMiniOvarySideSvg(visit, "left", "L", "SX") +
      buildMiniOvarySideSvg(visit, "right", "R", "DX") +
      "</div>"
    );
  }

  function buildStructuresList(visit) {
    const leftStructures = visit.ovaries.left.structures || [];
    const rightStructures = visit.ovaries.right.structures || [];
    const allStructures = leftStructures.concat(rightStructures);

    if (!allStructures.length) {
      return createEmptyState("Nessuna struttura raw salvata in questa visita.");
    }

    return (
      '<div class="detail-structures">' +
      allStructures
        .map((structure) => {
          const sizePart =
            structure.sizeMm !== null
              ? `${structure.sizeMm} mm`
              : structure.clAreaMm2 !== null
                ? `${structure.clAreaMm2} mm2`
                : "-";
          const clockPart = structure.clockHour ? `ore ${structure.clockHour}` : "posizione libera";
          const sidePart = structure.side === "R" ? "DX" : "SX";

          return (
            '<div class="detail-structure-item">' +
            `${escapeHtml(sidePart)} | ${escapeHtml(formatStructureType(structure.type))} | ${escapeHtml(sizePart)} | ${escapeHtml(clockPart)}` +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function buildAttachmentButtons(visit) {
    const attachments = visit.attachments || [];

    if (!attachments.length) {
      return createEmptyState("Nessun allegato associato a questa visita.");
    }

    return (
      '<div class="detail-inline-list">' +
      attachments
        .map((attachment, index) => {
          const label = attachment.label || formatAttachmentType(attachment.type);
          return (
            `<button class="attachment-chip" type="button" data-attachment-index="${index}">` +
            `${escapeHtml(label)}` +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function buildEventList(visit) {
    const events = visit.events || [];

    if (!events.length) {
      return createEmptyState("Nessun evento protocollo registrato.");
    }

    return (
      '<div class="detail-structures">' +
      events
        .map((eventRecord) => {
          const label = eventRecord.name || eventRecord.type || "Evento";
          const dateText = eventRecord.eventAt ? app.utils.formatShortDateTime(eventRecord.eventAt) : "-";
          const notes = eventRecord.notes || "Nessuna nota";

          return (
            '<div class="detail-structure-item">' +
            `${escapeHtml(label)} | ${escapeHtml(dateText)} | ${escapeHtml(notes)}` +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function buildVisitDetailHtml(visit) {
    return (
      '<div class="detail-grid">' +
      '<div class="detail-card">' +
      '<div class="detail-label">Sintesi Clinica</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Headline</span><strong>${escapeHtml(visit.summary.headline || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Scopo</span><strong>${escapeHtml(formatVisitPurpose(visit.visitPurpose))}</strong></div>` +
      `<div class="detail-kv-row"><span>Programma</span><strong>${escapeHtml(formatProgramType(visit.protocolContext.programType))}</strong></div>` +
      `<div class="detail-kv-row"><span>Gravidanza</span><strong>${escapeHtml(formatPregnancyStatus(visit.summary.pregnancyStatus))}</strong></div>` +
      `<div class="detail-kv-row"><span>Operatore</span><strong>${escapeHtml(visit.operatorName || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>BCS</span><strong>${escapeHtml(
        visit.bodyConditionScore !== null && visit.bodyConditionScore !== undefined ? visit.bodyConditionScore : "-"
      )}</strong></div>` +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Utero</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Tono</span><strong>${escapeHtml(visit.uterus.tone || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Vascolarizzazione</span><strong>${escapeHtml(visit.uterus.vascularization || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Liquido luminale</span><strong>${escapeHtml(visit.uterus.luminalFluid || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Edema / Texture</span><strong>${escapeHtml(`${visit.uterus.edemaScore || "-"} / ${visit.uterus.textureScore || "-"}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>Flag patologici</span><strong>${escapeHtml(String((visit.uterus.pathologyFlags || []).length))}</strong></div>` +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Ovaio Sinistro</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Follicoli</span><strong>${escapeHtml(visit.ovaries.left.counts.totalFollicles)}</strong></div>` +
      `<div class="detail-kv-row"><span>Piccoli / Medi / Grandi</span><strong>${escapeHtml(`${visit.ovaries.left.counts.smallFollicles} / ${visit.ovaries.left.counts.mediumFollicles} / ${visit.ovaries.left.counts.largeFollicles}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>OV / CL / Cisti</span><strong>${escapeHtml(`${visit.ovaries.left.counts.ovulations} / ${visit.ovaries.left.counts.corporaLutea} / ${visit.ovaries.left.counts.cysts}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>Follicolo max</span><strong>${escapeHtml(visit.ovaries.left.counts.largestFollicleMm || "-")}</strong></div>` +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Ovaio Destro</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Follicoli</span><strong>${escapeHtml(visit.ovaries.right.counts.totalFollicles)}</strong></div>` +
      `<div class="detail-kv-row"><span>Piccoli / Medi / Grandi</span><strong>${escapeHtml(`${visit.ovaries.right.counts.smallFollicles} / ${visit.ovaries.right.counts.mediumFollicles} / ${visit.ovaries.right.counts.largeFollicles}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>OV / CL / Cisti</span><strong>${escapeHtml(`${visit.ovaries.right.counts.ovulations} / ${visit.ovaries.right.counts.corporaLutea} / ${visit.ovaries.right.counts.cysts}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>Follicolo max</span><strong>${escapeHtml(visit.ovaries.right.counts.largestFollicleMm || "-")}</strong></div>` +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Totali</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Follicoli totali</span><strong>${escapeHtml(visit.ovaries.total.totalFollicles)}</strong></div>` +
      `<div class="detail-kv-row"><span>Piccoli / Medi / Grandi</span><strong>${escapeHtml(`${visit.ovaries.total.smallFollicles} / ${visit.ovaries.total.mediumFollicles} / ${visit.ovaries.total.largeFollicles}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>OV / CL / Cisti</span><strong>${escapeHtml(`${visit.ovaries.total.ovulations} / ${visit.ovaries.total.corporaLutea} / ${visit.ovaries.total.cysts}`)}</strong></div>` +
      `<div class="detail-kv-row"><span>Allegati / Eventi</span><strong>${escapeHtml(`${(visit.attachments || []).length} / ${(visit.events || []).length}`)}</strong></div>` +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Protocollo</div>' +
      '<div class="detail-kv">' +
      `<div class="detail-kv-row"><span>Nome</span><strong>${escapeHtml(visit.protocolContext.protocolName || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Tipo</span><strong>${escapeHtml(formatProgramType(visit.protocolContext.programType))}</strong></div>` +
      `<div class="detail-kv-row"><span>Giorni da ET</span><strong>${escapeHtml(visit.protocolContext.daysFromET || "-")}</strong></div>` +
      `<div class="detail-kv-row"><span>Giorni da IA</span><strong>${escapeHtml(visit.protocolContext.daysFromAI || "-")}</strong></div>` +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Strutture Salvate</div>' +
      buildStructuresList(visit) +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Allegati cliccabili</div>' +
      buildAttachmentButtons(visit) +
      "</div>" +
      '<div class="detail-card">' +
      '<div class="detail-label">Eventi Protocollo</div>' +
      buildEventList(visit) +
      "</div>" +
      (visit.annotationText || visit.notes
        ? '<div class="detail-card">' +
          '<div class="detail-label">Note</div>' +
          `<div class="detail-stack">${escapeHtml(visit.annotationText || visit.notes)}</div>` +
          "</div>"
        : "")
    );
  }

  function notifySecondaryViews() {
    if (app.managementView && typeof app.managementView.refresh === "function") {
      app.managementView.refresh();
    }

    if (app.analyticsView && typeof app.analyticsView.refresh === "function") {
      app.analyticsView.refresh();
    }
  }

  app.workspace = {
    async init() {
      this.bindEvents();
      this.renderRepositoryMode();

      if (app.ui && typeof app.ui.updateBootLoading === "function") {
        app.ui.updateBootLoading(74, "Lettura profilo clinica...");
      }

      await this.loadClinic();

      if (app.ui && typeof app.ui.updateBootLoading === "function") {
        app.ui.updateBootLoading(82, "Caricamento sessioni disponibili...");
      }

      await this.loadSessions({ recomputeDateRanges: true });
      this.renderSessionControls();
      this.renderCurrentSession();
      this.renderVisitHistoryPanelState();

      const savedSessionId = app.platform.storage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      const canRestoreSession = savedSessionId && app.state.workspace.sessions.some((session) => session.id === savedSessionId);

      if (canRestoreSession) {
        if (app.ui && typeof app.ui.updateBootLoading === "function") {
          app.ui.updateBootLoading(90, "Ripristino sessione attiva...");
        }

        await this.activateSession(savedSessionId, { silent: true, keepModalClosed: true });
      } else {
        this.clearSelectedAnimal();
      }

      if (app.data.repository && typeof app.data.repository.subscribeDataChange === "function") {
        app.data.repository.subscribeDataChange(() => {
          this.handleRepositoryDataChanged().catch((error) => {
            console.error(error);
          });
        });
      }

      if (app.ui && typeof app.ui.updateBootLoading === "function") {
        app.ui.updateBootLoading(96, "Workspace pronto.");
      }

      this.openSessionModal();
    },

    bindEvents() {
      const refs = app.dom.refs;

      refs.animalSearchInput.addEventListener("input", (event) => {
        app.state.workspace.animalSearchTerm = event.target.value.trim().toLowerCase();
        this.renderAnimalList();
      });

      refs.newAnimalBtn.addEventListener("click", () => {
        this.openAnimalModal();
      });

      refs.openSessionModalBtn.addEventListener("click", () => {
        this.openSessionModal();
      });

      refs.closeSessionModalBtn.addEventListener("click", () => {
        this.closeSessionModal();
      });

      refs.sessionModal.addEventListener("click", (event) => {
        if (event.target === refs.sessionModal) {
          this.closeSessionModal();
        }
      });

      refs.loadSessionBtn.addEventListener("click", () => {
        this.loadSelectedSessionFromModal().catch((error) => {
          console.error(error);
          app.ui.toast("Errore durante il caricamento della sessione", "warn");
        });
      });

      refs.createAndLoadSessionBtn.addEventListener("click", () => {
        this.createAndLoadSessionFromModal();
      });

      refs.cancelAnimalBtn.addEventListener("click", () => {
        this.closeAnimalModal();
      });

      refs.saveAnimalBtn.addEventListener("click", () => {
        this.handleCreateAnimal();
      });

      refs.animalModal.addEventListener("click", (event) => {
        if (event.target === refs.animalModal) {
          this.closeAnimalModal();
        }
      });

      refs.animalList.addEventListener("click", (event) => {
        const item = event.target.closest("[data-animal-id]");

        if (!item) {
          return;
        }

        this.selectAnimal(item.dataset.animalId);
      });

      refs.recentVisitsList.addEventListener("click", (event) => {
        const item = event.target.closest("[data-visit-id]");

        if (!item) {
          return;
        }

        this.selectVisit(item.dataset.visitId);
      });

      refs.toggleVisitHistoryBtn.addEventListener("click", () => {
        this.toggleVisitHistory();
      });

      refs.visitHistoryList.addEventListener("click", (event) => {
        const item = event.target.closest("[data-visit-id]");

        if (!item) {
          return;
        }

        this.selectVisit(item.dataset.visitId);
      });

      refs.selectedVisitDetail.addEventListener("click", (event) => {
        const button = event.target.closest("[data-attachment-index]");
        const visit = app.state.workspace.selectedVisit;

        if (!button || !visit) {
          return;
        }

        const attachment = (visit.attachments || [])[Number(button.dataset.attachmentIndex)];

        if (attachment && app.attachmentViewer) {
          app.attachmentViewer.open(attachment);
        }
      });
    },

    renderRepositoryMode() {
      if (app.dom.refs.repoModeBadge) {
        app.dom.refs.repoModeBadge.hidden = true;
        app.dom.refs.repoModeBadge.textContent = "";
      }
    },

    async loadClinic() {
      const clinic = await app.data.repository.getClinic(app.data.activeClinicId);
      app.state.workspace.clinic = clinic;
    },

    async loadSessions(options) {
      const settings = options || {};

      if (settings.recomputeDateRanges && typeof app.data.repository.recomputeAllSessionDateRanges === "function") {
        await app.data.repository.recomputeAllSessionDateRanges(app.data.activeClinicId);
      }

      const sessions = await app.data.repository.listSessions(app.data.activeClinicId);
      app.state.workspace.sessions = sessions;

      if (app.state.context.activeSessionId) {
        app.state.workspace.activeSession =
          sessions.find((session) => session.id === app.state.context.activeSessionId) || app.state.workspace.activeSession;
      }

      return sessions;
    },

    getSessionById(sessionId) {
      return (
        app.state.workspace.sessions.find((session) => session.id === sessionId) ||
        app.state.workspace.sessions.find((session) => session.id === app.domain.modelUtils.UNASSIGNED_SESSION_ID) ||
        null
      );
    },

    renderSessionControls() {
      const refs = app.dom.refs;
      const sessions = app.state.workspace.sessions || [];
      const activeSessionId = app.state.context.activeSessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
      const sessionOptions = createSessionOptionsHtml(sessions, activeSessionId);

      refs.sessionLoadSelect.innerHTML = sessionOptions;
      refs.managementActiveSessionSelect.innerHTML = sessionOptions;
      refs.managementAnimalSessionInput.innerHTML = sessionOptions;
      refs.exportSessionInput.innerHTML = createSessionOptionsHtml(sessions, activeSessionId, { includeAll: true });

      refs.sessionLoadSelect.value = activeSessionId;
      refs.managementActiveSessionSelect.value = activeSessionId;
      refs.exportSessionInput.value = activeSessionId;

      const animal = app.state.workspace.selectedAnimal;
      if (animal) {
        refs.managementAnimalSessionInput.value = getRecordSessionId(animal);
      }
    },

    renderCurrentSession() {
      const session = app.state.workspace.activeSession;
      const label = session ? session.name : "--";
      app.dom.refs.openSessionModalBtn.textContent = `Sessione: ${label}`;
      app.dom.refs.managementSessionHeading.textContent = session
        ? `Sessione corrente: ${session.name}`
        : "Carica, crea o modifica una sessione di studio";
    },

    async activateSession(sessionId, options) {
      const settings = options || {};
      const session = this.getSessionById(sessionId);

      if (!session) {
        app.ui.toast("Sessione non disponibile", "warn");
        return;
      }

      app.state.context.activeSessionId = session.id;
      app.state.workspace.activeSession = session;

      app.platform.storage.setItem(ACTIVE_SESSION_STORAGE_KEY, session.id);

      this.renderCurrentSession();
      this.renderSessionControls();

      if (!settings.keepModalClosed) {
        this.closeSessionModal();
      }

      await this.refreshAnimals();

      if (!settings.silent) {
        app.ui.toast(`Sessione caricata: ${session.name}`);
      }
    },

    openSessionModal() {
      this.renderSessionControls();
      app.dom.refs.closeSessionModalBtn.hidden = !app.state.context.activeSessionId;
      app.dom.refs.sessionModal.classList.add("open");
      app.dom.refs.sessionLoadSelect.focus();
    },

    closeSessionModal() {
      if (app.state.context.activeSessionId) {
        app.dom.refs.sessionModal.classList.remove("open");
      }
    },

    async loadSelectedSessionFromModal() {
      const sessionId = app.dom.refs.sessionLoadSelect.value || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
      await this.activateSession(sessionId);
    },

    async createSession(payload) {
      const createdSession = await app.data.repository.createSession(
        app.domain.helpers.mergeDeep(payload || {}, {
          clinicId: app.data.activeClinicId,
          updatedBy: "demo_user",
        })
      );

      await this.loadSessions();
      this.renderSessionControls();
      return createdSession;
    },

    async createAndLoadSessionFromModal() {
      const refs = app.dom.refs;
      const name = refs.newSessionNameInput.value.trim();

      if (!name) {
        app.ui.toast("Inserisci un nome per la nuova sessione", "warn");
        refs.newSessionNameInput.focus();
        return;
      }

      refs.createAndLoadSessionBtn.disabled = true;

      try {
        const session = await this.createSession({
          name,
          code: refs.newSessionCodeInput.value.trim(),
          status: "active",
        });

        refs.newSessionNameInput.value = "";
        refs.newSessionCodeInput.value = "";
        await this.activateSession(session.id);
      } catch (error) {
        console.error(error);
        app.ui.toast("Errore durante la creazione della sessione", "warn");
      } finally {
        refs.createAndLoadSessionBtn.disabled = false;
      }
    },

    async refreshAnimals(preferredAnimalId) {
      const allAnimals = await app.data.repository.listAnimals(app.data.activeClinicId);
      const activeSessionId = app.state.context.activeSessionId;
      const animals = activeSessionId
        ? allAnimals.filter((animal) => getRecordSessionId(animal) === activeSessionId)
        : [];

      app.state.workspace.allAnimals = allAnimals;
      app.state.workspace.animals = animals;
      this.renderAnimalList();

      if (app.exporter && typeof app.exporter.refreshFilters === "function") {
        app.exporter.refreshFilters();
      }

      if (!animals.length) {
        this.clearSelectedAnimal();
        notifySecondaryViews();
        return;
      }

      const candidateAnimalId = preferredAnimalId || app.state.context.activeAnimalId || null;
      const nextAnimalId =
        (candidateAnimalId && animals.some((animal) => animal.id === candidateAnimalId) ? candidateAnimalId : null) ||
        (animals[0] ? animals[0].id : null);

      if (nextAnimalId) {
        await this.selectAnimal(nextAnimalId);
      }
    },

    async handleRepositoryDataChanged() {
      await this.loadClinic();
      await this.loadSessions();

      const currentSessionId = app.state.context.activeSessionId;

      if (!currentSessionId) {
        this.renderSessionControls();
        this.renderCurrentSession();
        return;
      }

      const resolvedSession = this.getSessionById(currentSessionId);

      if (resolvedSession) {
        app.state.workspace.activeSession = resolvedSession;
      } else {
        app.state.context.activeSessionId = app.domain.modelUtils.UNASSIGNED_SESSION_ID;
        app.state.workspace.activeSession = this.getSessionById(app.domain.modelUtils.UNASSIGNED_SESSION_ID);
      }

      this.renderSessionControls();
      this.renderCurrentSession();
      await this.refreshAnimals(app.state.context.activeAnimalId);
    },

    getFilteredAnimals() {
      const term = app.state.workspace.animalSearchTerm;

      if (!term) {
        return app.state.workspace.animals.slice();
      }

      return app.state.workspace.animals.filter((animal) => {
        const haystack = [
          animal.animalCode,
          animal.displayName,
          animal.farmName,
          animal.groupName,
          animal.earTag,
          animal.breed,
          getRecordSessionName(animal),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.indexOf(term) >= 0;
      });
    },

    renderAnimalList() {
      const refs = app.dom.refs;
      const filteredAnimals = this.getFilteredAnimals();

      refs.animalCountBadge.textContent = String(app.state.workspace.animals.length);

      if (!filteredAnimals.length) {
        const session = app.state.workspace.activeSession;
        const message = session
          ? `Nessun animale nella sessione ${session.name}.`
          : "Carica una sessione per visualizzare gli animali.";
        refs.animalList.innerHTML = createEmptyState(app.state.workspace.animalSearchTerm ? "Nessun animale corrisponde ai filtri correnti." : message);
        return;
      }

      refs.animalList.innerHTML = filteredAnimals
        .map((animal) => {
          const isActive = animal.id === app.state.context.activeAnimalId;
          const lastVisitText = animal.lastVisitAt ? app.utils.formatShortDateTime(animal.lastVisitAt) : "Nessuna visita";
          const statusText = animal.visitCount ? `${animal.visitCount} visite` : "0 visite";

          return (
            `<button class="animal-item${isActive ? " active" : ""}" type="button" data-animal-id="${escapeHtml(animal.id)}">` +
            '<div class="animal-item-head">' +
            `<span class="animal-item-code">${escapeHtml(animal.displayName || animal.animalCode)}</span>` +
            `<span class="mini-badge">${escapeHtml(formatSpecies(animal.species))}</span>` +
            "</div>" +
            `<div class="animal-item-meta">${escapeHtml(animal.farmName || "Allevamento non indicato")} | ${escapeHtml(animal.breed || "Razza N/D")}</div>` +
            `<div class="animal-item-foot">${escapeHtml(formatRole(animal.reproductiveRole))} | ${escapeHtml(statusText)} | Ultima ${escapeHtml(lastVisitText)}</div>` +
            "</button>"
          );
        })
        .join("");
    },

    async selectAnimal(animalId) {
      const previousAnimalId = app.state.context.activeAnimalId;
      const animal = await app.data.repository.getAnimal(app.data.activeClinicId, animalId);
      const visits = await app.data.repository.listAnimalVisits(app.data.activeClinicId, animalId);

      app.state.context.activeAnimalId = animalId;
      app.state.workspace.selectedAnimal = animal;
      app.state.workspace.visitsByAnimalId[animalId] = visits;

      this.renderAnimalList();
      this.renderSelectedAnimal(animal);
      this.renderRecentVisits(visits);
      this.renderVisitHistory(visits);
      this.syncSelectedAnimalToEditor(animal);
      if (previousAnimalId && previousAnimalId !== animalId && app.visitEditor && typeof app.visitEditor.resetEditor === "function") {
        app.visitEditor.resetEditor();
      }

      if (!visits.length) {
        this.clearSelectedVisit();
        notifySecondaryViews();
        return;
      }

      const currentVisitId = app.state.context.activeVisitId;
      const hasCurrentVisit = visits.some((visit) => visit.id === currentVisitId);
      const nextVisitId = hasCurrentVisit ? currentVisitId : visits[0].id;

      await this.selectVisit(nextVisitId);
      notifySecondaryViews();
    },

    renderSelectedAnimal(animal) {
      const refs = app.dom.refs;
      const lastSummary = animal.lastVisitSummary || {};
      const metaParts = [
        formatSpecies(animal.species),
        animal.breed || "Razza N/D",
        animal.farmName || "Allevamento N/D",
        getRecordSessionName(animal),
        animal.birthDate ? `Nato ${app.utils.formatLongDate(animal.birthDate)}` : "Nascita N/D",
      ];

      refs.selectedAnimalTitle.textContent = animal.displayName || animal.animalCode;
      refs.selectedAnimalMeta.textContent = metaParts.join(" | ");

      refs.selectedAnimalPills.innerHTML = [
        animal.reproductiveRole ? `<span class="pill accent">${escapeHtml(formatRole(animal.reproductiveRole))}</span>` : "",
        animal.sessionId ? `<span class="pill blue">${escapeHtml(getRecordSessionName(animal))}</span>` : "",
        animal.groupName ? `<span class="pill blue">${escapeHtml(animal.groupName)}</span>` : "",
        animal.status ? `<span class="pill">${escapeHtml(animal.status.toUpperCase())}</span>` : "",
        animal.lastVisitSummary && animal.lastVisitSummary.pregnancyStatus !== "unknown"
          ? `<span class="pill gold">${escapeHtml(formatPregnancyStatus(animal.lastVisitSummary.pregnancyStatus))}</span>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      refs.selectedAnimalMetrics.innerHTML =
        createMetricCard(
          "Visite",
          animal.visitCount || 0,
          animal.lastVisitAt ? `Ultima ${app.utils.formatShortDateTime(animal.lastVisitAt)}` : "Ancora nessuna visita"
        ) +
        createMetricCard("Follicoli", lastSummary.totalFollicles || 0, "Ultima visita") +
        createMetricCard("OV / CL", `${lastSummary.ovulations || 0} / ${lastSummary.corporaLutea || 0}`, "Ultima visita") +
        createMetricCard(
          "Parita / BCS",
          `${animal.parity !== null && animal.parity !== undefined ? animal.parity : "-"} / ${
            animal.bodyConditionScore !== null && animal.bodyConditionScore !== undefined ? animal.bodyConditionScore : "-"
          }`,
          animal.earTag || "Tag auricolare N/D"
        );
    },

    renderRecentVisits(visits) {
      const refs = app.dom.refs;
      const recentVisits = visits.slice(0, 3);

      if (!recentVisits.length) {
        refs.recentVisitsList.innerHTML = createEmptyState("Nessuna ecografia ancora registrata per questo animale.");
        return;
      }

      refs.recentVisitsList.innerHTML = recentVisits
        .map((visit) => {
          const isActive = visit.id === app.state.context.activeVisitId;
          const visitBody = isActive
            ? buildVisitOvaryPreview(visit)
            : `<div class="visit-card-meta">Tot ${escapeHtml(visit.ovaries.total.totalFollicles)} | OV ${escapeHtml(visit.ovaries.total.ovulations)} | CL ${escapeHtml(visit.ovaries.total.corporaLutea)} | ${escapeHtml(formatProgramType(visit.protocolContext.programType))}</div>`;

          return (
            `<button class="visit-card${isActive ? " active" : ""}" type="button" data-visit-id="${escapeHtml(visit.id)}">` +
            '<div class="visit-card-head">' +
            `<div class="visit-card-title">${escapeHtml(app.utils.formatLongDate(visit.visitAt))}</div>` +
            `<span class="mini-badge">${escapeHtml(formatVisitPurpose(visit.visitPurpose))}</span>` +
            "</div>" +
            `<div class="visit-card-meta">${escapeHtml(visit.summary.headline || "Sintesi non disponibile")}</div>` +
            visitBody +
            "</button>"
          );
        })
        .join("");
    },

    renderVisitHistory(visits) {
      const refs = app.dom.refs;

      if (!visits.length) {
        refs.visitHistoryList.innerHTML = createEmptyState("Lo storico completo apparira qui dopo il primo salvataggio.");
        return;
      }

      refs.visitHistoryList.innerHTML = visits
        .map((visit) => {
          const isActive = visit.id === app.state.context.activeVisitId;
          const visitBody = isActive
            ? buildVisitOvaryPreview(visit)
            : `<div class="visit-row-meta">Follicoli ${escapeHtml(visit.ovaries.total.totalFollicles)} | Allegati ${escapeHtml((visit.attachments || []).length)} | Eventi ${escapeHtml((visit.events || []).length)}</div>`;

          return (
            `<button class="visit-row${isActive ? " active" : ""}" type="button" data-visit-id="${escapeHtml(visit.id)}">` +
            '<div class="visit-row-head">' +
            `<div class="visit-row-title">${escapeHtml(app.utils.formatShortDateTime(visit.visitAt))}</div>` +
            `<span class="mini-badge">${escapeHtml(visit.summary.shortText || "N/D")}</span>` +
            "</div>" +
            `<div class="visit-row-meta">${escapeHtml(formatVisitPurpose(visit.visitPurpose))} | ${escapeHtml(visit.summary.headline || "Senza headline")}</div>` +
            visitBody +
            "</button>"
          );
        })
        .join("");
    },

    renderVisitHistoryPanelState() {
      const refs = app.dom.refs;
      const expanded = Boolean(app.state.workspace.visitHistoryExpanded);

      refs.visitHistoryBody.hidden = !expanded;
      refs.toggleVisitHistoryBtn.textContent = expanded ? "Chiudi storico" : "Apri storico";
      refs.toggleVisitHistoryBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    },

    setVisitHistoryExpanded(expanded) {
      app.state.workspace.visitHistoryExpanded = Boolean(expanded);
      this.renderVisitHistoryPanelState();
    },

    toggleVisitHistory() {
      this.setVisitHistoryExpanded(!app.state.workspace.visitHistoryExpanded);
    },

    async selectVisit(visitId) {
      const animalId = app.state.context.activeAnimalId;

      if (!animalId) {
        return;
      }

      const visit = await app.data.repository.getVisit(app.data.activeClinicId, animalId, visitId);

      app.state.context.activeVisitId = visitId;
      app.state.workspace.selectedVisit = visit;

      const visits = app.state.workspace.visitsByAnimalId[animalId] || [];
      this.renderRecentVisits(visits);
      this.renderVisitHistory(visits);
      this.renderVisitDetail(visit);
      notifySecondaryViews();
    },

    renderVisitDetail(visit) {
      app.dom.refs.selectedVisitHeading.textContent = `${formatVisitPurpose(visit.visitPurpose)} | ${app.utils.formatShortDateTime(visit.visitAt)}`;
      app.dom.refs.selectedVisitMeta.textContent = `${visit.operatorName || "Operatore N/D"} | ${visit.summary.headline || "Dettaglio clinico disponibile sotto"}`;
      app.dom.refs.selectedVisitDetail.innerHTML = buildVisitDetailHtml(visit);
    },

    clearSelectedAnimal() {
      app.state.context.activeAnimalId = null;
      app.state.workspace.selectedAnimal = null;
      this.syncSelectedAnimalToEditor(null);
      app.dom.refs.selectedAnimalTitle.textContent = "Nessun animale selezionato";
      app.dom.refs.selectedAnimalMeta.textContent = "Crea o seleziona un animale dal pannello a sinistra.";
      app.dom.refs.selectedAnimalPills.innerHTML = "";
      app.dom.refs.selectedAnimalMetrics.innerHTML = createEmptyState("La scheda animale mostrera indicatori sintetici e dati longitudinali.");
      app.dom.refs.recentVisitsList.innerHTML = createEmptyState("Le ultime 3 ecografie appariranno qui.");
      app.dom.refs.visitHistoryList.innerHTML = createEmptyState("Lo storico completo apparira qui.");
      this.clearSelectedVisit();
      notifySecondaryViews();
    },

    clearSelectedVisit() {
      app.state.context.activeVisitId = null;
      app.state.workspace.selectedVisit = null;
      app.dom.refs.selectedVisitHeading.textContent = "Nessuna ecografia selezionata";
      app.dom.refs.selectedVisitMeta.textContent = "Seleziona una visita per visualizzare il dettaglio completo.";
      app.dom.refs.selectedVisitDetail.innerHTML = createEmptyState(
        "Il dettaglio visita mostrera utero, conteggi ovarici, strutture raw, allegati ed eventi di protocollo."
      );
    },

    syncSelectedAnimalToEditor(animal) {
      app.dom.refs.sheepId.value = animal ? animal.animalCode : "";
      if (app.visitEditor && typeof app.visitEditor.updatePostPartumDaysDisplay === "function") {
        app.visitEditor.updatePostPartumDaysDisplay();
      }
    },

    getSelectedAnimalVisits() {
      const animalId = app.state.context.activeAnimalId;
      return animalId ? (app.state.workspace.visitsByAnimalId[animalId] || []) : [];
    },

    getAnimalDefaultsForActiveSession() {
      const activeSessionId = app.state.context.activeSessionId;
      const selectedAnimal = app.state.workspace.selectedAnimal;
      const sessionAnimals = app.state.workspace.animals || [];
      const fallbackAnimal = sessionAnimals.length ? sessionAnimals[0] : null;
      const sourceAnimal =
        selectedAnimal && getRecordSessionId(selectedAnimal) === activeSessionId ? selectedAnimal : fallbackAnimal;

      if (!sourceAnimal || getRecordSessionId(sourceAnimal) !== activeSessionId) {
        return {
          species: "",
          breed: "",
          farmName: "",
          reproductiveRole: "",
        };
      }

      return {
        species: sourceAnimal.species || "ovine",
        breed: sourceAnimal.breed || "",
        farmName: sourceAnimal.farmName || "",
        reproductiveRole: sourceAnimal.reproductiveRole || "monitoring_only",
      };
    },

    openAnimalModal() {
      const refs = app.dom.refs;

      if (!app.state.context.activeSessionId) {
        app.ui.toast("Carica prima una sessione", "warn");
        this.openSessionModal();
        return;
      }

      const defaults = this.getAnimalDefaultsForActiveSession();

      refs.animalCodeInput.value = "";
      refs.animalSpeciesInput.value = defaults.species;
      refs.animalBreedInput.value = defaults.breed;
      refs.animalFarmInput.value = defaults.farmName;
      refs.animalRoleInput.value = defaults.reproductiveRole;
      refs.animalParityInput.value = "";
      refs.animalBirthDateInput.value = "";
      refs.animalLastParturitionDateInput.value = "";
      refs.animalModal.classList.add("open");
      refs.animalCodeInput.focus();
    },

    closeAnimalModal() {
      app.dom.refs.animalModal.classList.remove("open");
    },

    async handleCreateAnimal() {
      const refs = app.dom.refs;
      const animalCode = refs.animalCodeInput.value.trim();
      const activeSession = app.state.workspace.activeSession;

      if (!animalCode) {
        app.ui.toast("Inserisci un codice animale", "warn");
        refs.animalCodeInput.focus();
        return;
      }

      if (!activeSession) {
        app.ui.toast("Carica prima una sessione", "warn");
        this.openSessionModal();
        return;
      }

      const payload = {
        clinicId: app.data.activeClinicId,
        sessionId: activeSession.id,
        sessionName: activeSession.name,
        animalCode,
        displayName: animalCode,
        species: refs.animalSpeciesInput.value,
        breed: refs.animalBreedInput.value.trim(),
        farmName: refs.animalFarmInput.value.trim(),
        reproductiveRole: refs.animalRoleInput.value,
        parity: refs.animalParityInput.value ? Number(refs.animalParityInput.value) : null,
        birthDate: dateInputValueToIso(refs.animalBirthDateInput.value),
        lastParturitionDate: dateInputValueToIso(refs.animalLastParturitionDateInput.value),
        status: "active",
        updatedBy: "demo_user",
      };

      refs.saveAnimalBtn.disabled = true;
      refs.saveAnimalBtn.textContent = "Creazione...";

      try {
        const animal = await app.data.repository.createAnimal(payload);

        app.state.context.activeAnimalId = animal.id;
        app.state.context.activeVisitId = null;
        app.state.workspace.selectedAnimal = animal;
        app.state.workspace.selectedVisit = null;
        app.state.workspace.visitsByAnimalId[animal.id] = [];

        this.closeAnimalModal();
        this.renderAnimalList();
        this.renderSelectedAnimal(animal);
        this.renderRecentVisits([]);
        this.renderVisitHistory([]);
        this.clearSelectedVisit();
        this.syncSelectedAnimalToEditor(animal);

        await this.refreshAnimals(animal.id);
        app.ui.toast(`Animale ${animal.animalCode} creato`);
      } finally {
        refs.saveAnimalBtn.disabled = false;
        refs.saveAnimalBtn.textContent = "Crea animale";
      }
    },
  };
})();
