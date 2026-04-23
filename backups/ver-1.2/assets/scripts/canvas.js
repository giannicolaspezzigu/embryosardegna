(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function sideColor(side) {
    return side === "L" ? "#00e0a0" : "#4db8ff";
  }

  function drawDeleteMarker(ctx, x, y) {
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "11px sans-serif";
    ctx.fillText("x", x, y);
  }

  app.canvas = {
    init() {
      const { canvases, confirmClBtn, skipClBtn } = app.dom.refs;

      Object.keys(canvases).forEach((side) => {
        const canvas = canvases[side];

        canvas.addEventListener("click", (event) => this.handleSelection(side, event));
        canvas.addEventListener("touchend", (event) => this.handleSelection(side, event));
        canvas.addEventListener("dragover", (event) => event.preventDefault());
        canvas.addEventListener("drop", (event) => this.handleDrop(side, event));
      });

      confirmClBtn.addEventListener("click", () => this.confirmCL());
      skipClBtn.addEventListener("click", () => this.skipCL());

      this.drawAll();
    },

    drawAll() {
      this.drawSide("L");
      this.drawSide("R");
    },

    drawSide(side) {
      const canvas = app.dom.refs.canvases[side];
      const ctx = app.dom.refs.contexts[side];
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = width * 0.42;
      const radiusY = height * 0.4;
      const color = sideColor(side);

      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusX);
      glow.addColorStop(0, side === "L" ? "rgba(0,224,160,0.07)" : "rgba(77,184,255,0.07)");
      glow.addColorStop(1, "transparent");

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      [12, 3, 6, 9].forEach((hour) => {
        const angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;

        ctx.globalAlpha = 0.28;
        ctx.fillStyle = color;
        ctx.font = "8px DM Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hour, centerX + (radiusX + 13) * Math.cos(angle), centerY + (radiusY + 13) * Math.sin(angle));
        ctx.globalAlpha = 1;
      });

      app.state.structs[side].forEach((structure) => {
        if (structure.type === "fol") {
          const radius = Math.max(5, structure.size * 3.5);

          ctx.beginPath();
          ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = side === "L" ? "rgba(0,224,160,0.16)" : "rgba(77,184,255,0.16)";
          ctx.fill();

          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.font = `bold ${Math.max(8, radius * 0.62)}px DM Mono, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(structure.size, structure.x, structure.y);

          drawDeleteMarker(ctx, structure.x + radius - 1, structure.y - radius + 2);
          return;
        }

        if (structure.type === "cyst") {
          const radius = Math.max(10, (structure.size || 6) * 3.2);

          ctx.beginPath();
          ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 144, 66, 0.08)";
          ctx.fill();

          ctx.strokeStyle = "#ff9042";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#ff9042";
          ctx.font = "bold 9px DM Mono, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("CY", structure.x, structure.y);

          if (structure.size) {
            ctx.font = "8px DM Mono, monospace";
            ctx.fillText(`${structure.size}mm`, structure.x, structure.y + radius + 8);
          }

          drawDeleteMarker(ctx, structure.x + radius - 1, structure.y - radius + 2);
          return;
        }

        if (structure.type === "ov") {
          const radius = 14;

          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.moveTo(structure.x - radius, structure.y);
          ctx.lineTo(structure.x + radius, structure.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(structure.x, structure.y - radius);
          ctx.lineTo(structure.x, structure.y + radius);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(structure.x - radius * 0.7, structure.y - radius * 0.7);
          ctx.lineTo(structure.x + radius * 0.7, structure.y + radius * 0.7);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(structure.x + radius * 0.7, structure.y - radius * 0.7);
          ctx.lineTo(structure.x - radius * 0.7, structure.y + radius * 0.7);
          ctx.stroke();

          ctx.fillStyle = "rgba(255,107,107,0.12)";
          ctx.beginPath();
          ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ff6b6b";
          ctx.font = "bold 9px DM Mono, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OV", structure.x, structure.y + radius + 8);

          drawDeleteMarker(ctx, structure.x + radius, structure.y - radius + 2);
          return;
        }

        const radius = 16;

        ctx.beginPath();
        ctx.arc(structure.x, structure.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245,197,24,0.22)";
        ctx.fill();

        ctx.strokeStyle = "#f5c518";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = "#f5c518";
        ctx.font = "bold 9px DM Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CL", structure.x, structure.y);

        if (structure.clSurf) {
          ctx.font = "8px DM Mono, monospace";
          ctx.fillText(`${structure.clSurf}mm2`, structure.x, structure.y + radius + 8);
        }

        drawDeleteMarker(ctx, structure.x + radius, structure.y - radius + 2);
      });

      app.ui.renderOvarySummary(side);
      app.ui.renderStats();
    },

    handleSelection(side, event) {
      event.preventDefault();

      const canvas = app.dom.refs.canvases[side];
      const position = app.utils.canvasPosition(canvas, event);
      const removed = app.session.removeStructureAt(side, position);

      if (removed) {
        this.drawSide(side);
        app.ui.toast("Struttura rimossa");
        return;
      }

      if (!app.utils.isInsideOvary(canvas, position.x, position.y)) {
        app.ui.toast("Tocca dentro l'ovaio", "warn");
        return;
      }

      if (app.state.selection.type === "fol") {
        const size = app.stateApi.getSelectedSize();

        if (!size) {
          app.ui.toast("Seleziona una dimensione", "warn");
          return;
        }

        app.session.addStructure(side, { type: "fol", size, x: position.x, y: position.y, source: "tap" });
        this.drawSide(side);
        app.ui.addLog(side, `1x fol ${size}mm`, "tap");
        app.ui.toast(`${size}mm -> Ovaio ${app.utils.sideLabel(side)}`);
        return;
      }

      if (app.state.selection.type === "ov") {
        app.session.addStructure(side, { type: "ov", x: position.x, y: position.y, source: "tap" });
        this.drawSide(side);
        app.ui.addLog(side, "Ovulazione", "tap");
        app.ui.toast(`Ovulazione -> Ovaio ${app.utils.sideLabel(side)}`);
        return;
      }

      if (app.state.selection.type === "cl") {
        app.stateApi.setPendingCL({ side, x: position.x, y: position.y, source: "tap" });
        app.dom.refs.clSurfInput.value = "";
        app.dom.refs.clModal.classList.add("open");
        return;
      }

      if (app.state.selection.type === "cyst") {
        const size = app.stateApi.getSelectedSize() || 6;

        app.session.addStructure(side, {
          type: "cyst",
          size,
          x: position.x,
          y: position.y,
          source: "tap",
        });
        this.drawSide(side);
        app.ui.addLog(side, `Cisti ${size}mm`, "tap");
        app.ui.toast(`Cisti -> Ovaio ${app.utils.sideLabel(side)}`, "warn");
      }
    },

    handleDrop(side, event) {
      event.preventDefault();

      const canvas = app.dom.refs.canvases[side];
      const size = parseFloat(event.dataTransfer.getData("size")) || app.stateApi.getSelectedSize();

      if (!size) {
        return;
      }

      const position = app.utils.canvasPosition(canvas, event);

      if (!app.utils.isInsideOvary(canvas, position.x, position.y)) {
        app.ui.toast("Rilascia dentro l'ovaio", "warn");
        return;
      }

      app.session.addStructure(side, { type: "fol", size, x: position.x, y: position.y, source: "drag" });
      this.drawSide(side);
      app.ui.addLog(side, `1x fol ${size}mm (drag)`, "tap");
      app.ui.toast(`${size}mm -> ${app.utils.shortSideLabel(side)}`);
    },

    closeCLModal() {
      app.stateApi.clearPendingCL();
      app.dom.refs.clModal.classList.remove("open");
    },

    confirmCL() {
      const pending = app.state.pendingCL;

      if (!pending) {
        return;
      }

      const parsedSurface = parseFloat(app.dom.refs.clSurfInput.value);
      const surface = Number.isNaN(parsedSurface) ? null : parsedSurface;

      app.session.addStructure(pending.side, {
        type: "cl",
        clSurf: surface,
        x: pending.x,
        y: pending.y,
        source: pending.source || "tap",
      });
      this.drawSide(pending.side);
      app.ui.addLog(pending.side, surface ? `CL ${surface}mm2` : "CL", "tap");
      app.ui.toast(
        `Corpo luteo${surface ? ` ${surface}mm2` : ""} -> Ovaio ${app.utils.shortSideLabel(pending.side)}`,
        "gold"
      );
      this.closeCLModal();
    },

    skipCL() {
      const pending = app.state.pendingCL;

      if (!pending) {
        return;
      }

      app.session.addStructure(pending.side, {
        type: "cl",
        clSurf: null,
        x: pending.x,
        y: pending.y,
        source: pending.source || "tap",
      });
      this.drawSide(pending.side);
      app.ui.addLog(pending.side, "CL (surf N/D)", "tap");
      app.ui.toast(`Corpo luteo -> Ovaio ${app.utils.shortSideLabel(pending.side)}`, "gold");
      this.closeCLModal();
    },
  };
})();
