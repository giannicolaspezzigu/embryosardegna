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
      await this.loadClinic();
      await this.refreshAnimals();
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
      app.dom.refs.repoModeBadge.textContent = `Repo ${String(app.data.repositoryMode || "--").toUpperCase()}`;
    },

    async loadClinic() {
      const clinic = await app.data.repository.getClinic(app.data.activeClinicId);
      app.state.workspace.clinic = clinic;
    },

    async refreshAnimals(preferredAnimalId) {
      const animals = await app.data.repository.listAnimals(app.data.activeClinicId);

      app.state.workspace.animals = animals;
      this.renderAnimalList();

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
        refs.animalList.innerHTML = createEmptyState("Nessun animale corrisponde ai filtri correnti.");
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
      const metaParts = [formatSpecies(animal.species), animal.breed || "Razza N/D", animal.farmName || "Allevamento N/D"];

      refs.selectedAnimalTitle.textContent = animal.displayName || animal.animalCode;
      refs.selectedAnimalMeta.textContent = metaParts.join(" | ");

      refs.selectedAnimalPills.innerHTML = [
        animal.reproductiveRole ? `<span class="pill accent">${escapeHtml(formatRole(animal.reproductiveRole))}</span>` : "",
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

          return (
            `<button class="visit-card${isActive ? " active" : ""}" type="button" data-visit-id="${escapeHtml(visit.id)}">` +
            '<div class="visit-card-head">' +
            `<div class="visit-card-title">${escapeHtml(app.utils.formatLongDate(visit.visitAt))}</div>` +
            `<span class="mini-badge">${escapeHtml(formatVisitPurpose(visit.visitPurpose))}</span>` +
            "</div>" +
            `<div class="visit-card-meta">${escapeHtml(visit.summary.headline || "Sintesi non disponibile")}</div>` +
            `<div class="visit-card-meta">Tot ${escapeHtml(visit.ovaries.total.totalFollicles)} | OV ${escapeHtml(visit.ovaries.total.ovulations)} | CL ${escapeHtml(visit.ovaries.total.corporaLutea)} | ${escapeHtml(formatProgramType(visit.protocolContext.programType))}</div>` +
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

          return (
            `<button class="visit-row${isActive ? " active" : ""}" type="button" data-visit-id="${escapeHtml(visit.id)}">` +
            '<div class="visit-row-head">' +
            `<div class="visit-row-title">${escapeHtml(app.utils.formatShortDateTime(visit.visitAt))}</div>` +
            `<span class="mini-badge">${escapeHtml(visit.summary.shortText || "N/D")}</span>` +
            "</div>" +
            `<div class="visit-row-meta">${escapeHtml(formatVisitPurpose(visit.visitPurpose))} | ${escapeHtml(visit.summary.headline || "Senza headline")}</div>` +
            `<div class="visit-row-meta">Follicoli ${escapeHtml(visit.ovaries.total.totalFollicles)} | Allegati ${escapeHtml((visit.attachments || []).length)} | Eventi ${escapeHtml((visit.events || []).length)}</div>` +
            "</button>"
          );
        })
        .join("");
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
    },

    getSelectedAnimalVisits() {
      const animalId = app.state.context.activeAnimalId;
      return animalId ? (app.state.workspace.visitsByAnimalId[animalId] || []) : [];
    },

    openAnimalModal() {
      const refs = app.dom.refs;

      refs.animalCodeInput.value = "";
      refs.animalSpeciesInput.value = "ovine";
      refs.animalBreedInput.value = "";
      refs.animalFarmInput.value = "";
      refs.animalRoleInput.value = "recipient";
      refs.animalParityInput.value = "";
      refs.animalModal.classList.add("open");
      refs.animalCodeInput.focus();
    },

    closeAnimalModal() {
      app.dom.refs.animalModal.classList.remove("open");
    },

    async handleCreateAnimal() {
      const refs = app.dom.refs;
      const animalCode = refs.animalCodeInput.value.trim();

      if (!animalCode) {
        app.ui.toast("Inserisci un codice animale", "warn");
        refs.animalCodeInput.focus();
        return;
      }

      const payload = {
        clinicId: app.data.activeClinicId,
        animalCode,
        displayName: animalCode,
        species: refs.animalSpeciesInput.value,
        breed: refs.animalBreedInput.value.trim(),
        farmName: refs.animalFarmInput.value.trim(),
        reproductiveRole: refs.animalRoleInput.value,
        parity: refs.animalParityInput.value ? Number(refs.animalParityInput.value) : null,
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
