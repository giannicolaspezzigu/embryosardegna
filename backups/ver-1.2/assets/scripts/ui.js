(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function setStatsBlock(block, values) {
    block.value.textContent = values.all;
    block.left.textContent = `Sin: ${values.L}`;
    block.right.textContent = `Des: ${values.R}`;
  }

  app.ui = {
    init() {
      this.setDateBadge(app.state.sessionStartedAt);
      this.bindStaticControls();
      this.buildTray();
      this.resetTranscript();
      this.resetUterusBadges();
      this.renderStats();
      this.renderOvarySummary("L");
      this.renderOvarySummary("R");
    },

    bindStaticControls() {
      const refs = app.dom.refs;

      refs.clearSelectionBtn.addEventListener("click", () => {
        app.stateApi.clearSelection();
        this.refreshTray();
        this.toast("Selezione cancellata");
      });

      refs.uterusButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setUterusValue(button.dataset.param, Number(button.dataset.value), button);
        });
      });
    },

    setDateBadge(date) {
      app.dom.refs.dateBadge.textContent = app.utils.formatDateBadge(date);
    },

    buildTray() {
      const { tray } = app.dom.refs;

      tray.innerHTML = "";

      app.config.sizes.forEach((size) => {
        const diameter = Math.max(18, size * 6 + 6);
        const chip = document.createElement("div");

        chip.className = "chip";
        chip.dataset.size = String(size);
        chip.innerHTML =
          `<div class="chip-circle" style="width:${diameter}px;height:${diameter}px">` +
          `<span class="chip-size" style="font-size:${Math.max(7, diameter * 0.38)}px">${size}</span>` +
          "</div>" +
          `<span class="chip-lbl">${size}mm</span>`;

        chip.addEventListener("click", () => {
          app.stateApi.selectFollicle(size, null);
          this.refreshTray();
        });

        chip.draggable = true;
        chip.addEventListener("dragstart", (event) => {
          app.stateApi.selectFollicle(size, null);
          this.refreshTray();
          event.dataTransfer.setData("size", String(size));
        });

        tray.appendChild(chip);
      });

      const customChip = document.createElement("div");
      customChip.className = "chip chip-custom";
      customChip.innerHTML =
        '<div class="chip-circle" style="width:24px;height:24px">' +
        '<span class="chip-size" style="font-size:10px">+</span>' +
        "</div>" +
        '<input type="number" id="customSizeInput" min="0.5" max="20" step="0.5" placeholder="mm">';
      tray.appendChild(customChip);

      const customInput = customChip.querySelector("input");
      customInput.addEventListener("click", (event) => event.stopPropagation());
      customInput.addEventListener("change", (event) => {
        this.setCustomSize(event.target.value);
      });

      const divider = document.createElement("div");
      divider.style.cssText = "width:1px;background:var(--border);align-self:stretch;margin:0 4px;";
      tray.appendChild(divider);

      const ovulationChip = document.createElement("div");
      ovulationChip.className = "chip chip-ov";
      ovulationChip.innerHTML = '<span class="chip-icon">&#x1F4A5;</span><span class="chip-lbl">OVULAZIONE</span>';
      ovulationChip.addEventListener("click", () => {
        app.stateApi.selectSpecial("ov");
        this.refreshTray();
      });
      tray.appendChild(ovulationChip);

      const corpusLuteumChip = document.createElement("div");
      corpusLuteumChip.className = "chip chip-cl";
      corpusLuteumChip.innerHTML = '<span class="chip-icon">&#x1F7E1;</span><span class="chip-lbl">CORPO LUTEO</span>';
      corpusLuteumChip.addEventListener("click", () => {
        app.stateApi.selectSpecial("cl");
        this.refreshTray();
      });
      tray.appendChild(corpusLuteumChip);

      const cystChip = document.createElement("div");
      cystChip.className = "chip chip-cyst";
      cystChip.innerHTML = '<span class="chip-icon">&#x25CE;</span><span class="chip-lbl">CISTI</span>';
      cystChip.addEventListener("click", () => {
        app.stateApi.selectSpecial("cyst");
        this.refreshTray();
      });
      tray.appendChild(cystChip);

      this.refreshTray();
    },

    refreshTray() {
      const selection = app.state.selection;
      const { tray } = app.dom.refs;

      tray.querySelectorAll(".chip[data-size]").forEach((chip) => {
        const chipSize = Number(chip.dataset.size);
        const isActive =
          selection.type === "fol" &&
          selection.customSize === null &&
          chipSize === selection.size;

        chip.classList.toggle("active", isActive);
      });

      const ovulationChip = tray.querySelector(".chip-ov");
      const corpusLuteumChip = tray.querySelector(".chip-cl");
      const cystChip = tray.querySelector(".chip-cyst");

      if (ovulationChip) {
        ovulationChip.classList.toggle("active", selection.type === "ov");
      }

      if (corpusLuteumChip) {
        corpusLuteumChip.classList.toggle("active", selection.type === "cl");
      }

      if (cystChip) {
        cystChip.classList.toggle("active", selection.type === "cyst");
      }

      const customChip = tray.querySelector(".chip-custom");
      const customInput = tray.querySelector("#customSizeInput");
      const customActive = selection.type === "fol" && selection.customSize !== null;

      if (customChip) {
        customChip.classList.toggle("active", customActive);
      }

      if (customInput) {
        customInput.value = selection.customSize === null ? "" : selection.customSize;
      }
    },

    setCustomSize(rawValue) {
      const value = parseFloat(rawValue);

      if (Number.isNaN(value) || value <= 0) {
        return;
      }

      app.stateApi.setCustomSize(value);
      this.refreshTray();
    },

    renderOvarySummary(side) {
      const summary = app.session.getSummary(side);
      const parts = [];

      if (summary.follicles > 0) {
        parts.push(`<b>${summary.follicles}</b> fol (avg ${summary.averageSize.toFixed(1)}mm)`);
      }

      if (summary.ovulations > 0) {
        parts.push(`<b>${summary.ovulations}</b> OV`);
      }

      if (summary.corporaLutea > 0) {
        parts.push(`<b>${summary.corporaLutea}</b> CL`);
      }

      if (summary.cysts > 0) {
        parts.push(`<b>${summary.cysts}</b> cisti`);
      }

      app.dom.refs.ftot[side].innerHTML = parts.length > 0 ? parts.join(" | ") : "-";
    },

    renderStats() {
      const stats = app.session.getStats();
      const { total, small, medium, large } = app.dom.refs.stats;

      setStatsBlock(total, stats.total);
      setStatsBlock(small, stats.small);
      setStatsBlock(medium, stats.medium);
      setStatsBlock(large, stats.large);
    },

    resetUterusBadges() {
      Object.keys(app.dom.refs.uterusBadges).forEach((param) => {
        app.dom.refs.uterusBadges[param].textContent = "-";
      });
    },

    resetUterusControls() {
      app.state.uterus = { T: null, V: null, L: null };
      this.resetUterusBadges();
      app.dom.refs.uterusButtons.forEach((button) => {
        button.classList.remove("active");
      });
    },

    setUterusValue(param, value, button) {
      const group = app.dom.refs.uterusGroups[param];

      app.state.uterus[param] = value;

      group.querySelectorAll(".uparam-btn").forEach((currentButton) => {
        currentButton.classList.remove("active");
      });

      button.classList.add("active");
      app.dom.refs.uterusBadges[param].textContent = `${value} - ${app.config.uterusLabels[param][value]}`;
    },

    addLog(side, data, type) {
      const timestamp = app.utils.formatLogTime(new Date());
      const label = app.utils.logSideLabel(side);
      const row = { timestamp, label, data, type };
      const { logBody } = app.dom.refs;

      app.state.logRows.push(row);

      if (app.state.logRows.length === 1) {
        logBody.innerHTML = "";
      }

      const element = document.createElement("div");
      element.className = `log-row${type === "voice" ? " voice" : ""}`;
      element.innerHTML =
        `<span class="lt">${timestamp}</span>` +
        `<span class="ls">${label}</span>` +
        `<span class="ld">${data}</span>`;

      logBody.appendChild(element);
      logBody.scrollTop = logBody.scrollHeight;
    },

    resetLog() {
      app.state.logRows = [];
      app.dom.refs.logBody.innerHTML =
        '<div class="log-row"><span class="lt">-</span><span class="ls">-</span><span class="ld" style="color:var(--muted)">Inizia ad aggiungere strutture.</span></div>';
    },

    toast(message, type) {
      const toastElement = app.dom.refs.toast;

      toastElement.textContent = message;
      toastElement.style.background =
        type === "warn" ? "var(--accent3)" : type === "gold" ? "var(--gold)" : "var(--accent)";
      toastElement.style.color = type === "warn" ? "#fff" : "#000";
      toastElement.classList.add("show");

      clearTimeout(toastElement._timer);
      toastElement._timer = setTimeout(() => {
        toastElement.classList.remove("show");
      }, 2400);
    },

    setVoiceListeningState(isListening) {
      app.dom.refs.voiceBtn.classList.toggle("listening", isListening);
      app.dom.refs.voiceBtnTxt.textContent = isListening ? "Ascolto..." : "Comando Vocale";
    },

    setTranscriptText(text, active) {
      app.dom.refs.transcript.className = active ? "transcript active" : "transcript";
      app.dom.refs.transcript.textContent = text;
    },

    resetTranscript() {
      app.dom.refs.transcript.className = "transcript";
      app.dom.refs.transcript.innerHTML = `<i>${app.config.transcriptPlaceholder}</i>`;
    },
  };
})();
