(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function normalizeVoiceText(rawText) {
    return rawText
      .toLowerCase()
      .replace(/millimetri|millimetro/g, "mm")
      .replace(/\buno\b/g, "1")
      .replace(/\bdue\b/g, "2")
      .replace(/\btre\b/g, "3")
      .replace(/\bquattro\b/g, "4")
      .replace(/\bcinque\b/g, "5")
      .replace(/\bsei\b/g, "6")
      .replace(/\bsette\b/g, "7")
      .replace(/\botto\b/g, "8")
      .replace(/\bnove\b/g, "9")
      .replace(/\bdieci\b/g, "10")
      .replace(/virgola/g, ".")
      .replace(/,/g, ".");
  }

  app.voice = {
    init() {
      app.dom.refs.voiceBtn.addEventListener("click", () => this.toggle());
    },

    toggle() {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        app.ui.toast("Usa Chrome per il comando vocale", "warn");
        return;
      }

      if (app.state.isListening) {
        if (app.state.recognition) {
          app.state.recognition.stop();
        }
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      app.stateApi.setRecognition(recognition);
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        app.stateApi.setListening(true);
        app.ui.setVoiceListeningState(true);
        app.ui.setTranscriptText("Parla ora...", true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ");

        app.ui.setTranscriptText(transcript, true);

        if (event.results[event.results.length - 1].isFinal) {
          this.parse(transcript);
        }
      };

      recognition.onerror = () => this.stop();
      recognition.onend = () => this.stop();
      recognition.start();
    },

    stop() {
      app.stateApi.setListening(false);
      app.stateApi.setRecognition(null);
      app.ui.setVoiceListeningState(false);
    },

    parse(rawText) {
      const text = normalizeVoiceText(rawText);
      const side = /sinistr|left/.test(text) ? "L" : /destr|right/.test(text) ? "R" : null;
      const sides = side ? [side] : ["L", "R"];
      const hourMatch = text.match(/ore\s+(\d+)/);
      const hour = hourMatch ? parseInt(hourMatch[1], 10) : null;

      if (/ovulaz/.test(text)) {
        sides.forEach((currentSide) => {
          const position = app.utils.randomOvaryPosition(app.dom.refs.canvases[currentSide]);

          app.session.addStructure(currentSide, {
            type: "ov",
            x: position.x,
            y: position.y,
            clockHour: hour,
            source: "voice",
          });

          app.canvas.drawSide(currentSide);
          app.ui.addLog(currentSide, "Ovulazione (voce)", "voice");
        });

        app.ui.toast(`Ovulazione -> ${side ? app.utils.shortSideLabel(side) : "entrambi"}`);
        app.ui.setTranscriptText(`OK ${rawText}`, true);
        return;
      }

      if (/corpo luteo|\bcl\b/.test(text)) {
        const surfaceMatch = text.match(/([\d.]+)\s*mm/);
        const parsedSurface = surfaceMatch ? parseFloat(surfaceMatch[1]) : null;
        const surface = Number.isNaN(parsedSurface) ? null : parsedSurface;

        sides.forEach((currentSide) => {
          const position = app.utils.randomOvaryPosition(app.dom.refs.canvases[currentSide]);

          app.session.addStructure(currentSide, {
            type: "cl",
            clSurf: surface,
            x: position.x,
            y: position.y,
            clockHour: hour,
            source: "voice",
          });

          app.canvas.drawSide(currentSide);
          app.ui.addLog(currentSide, surface ? `CL ${surface}mm2 (voce)` : "CL (voce)", "voice");
        });

        app.ui.toast(
          `CL${surface ? ` ${surface}mm2` : ""} -> ${side ? app.utils.shortSideLabel(side) : "entrambi"}`,
          "gold"
        );
        app.ui.setTranscriptText(`OK ${rawText}`, true);
        return;
      }

      if (/cist/.test(text)) {
        const sizeMatch = text.match(/([\d.]+)\s*mm/);
        const parsedSize = sizeMatch ? parseFloat(sizeMatch[1]) : 6;
        const size = Number.isNaN(parsedSize) ? 6 : parsedSize;

        sides.forEach((currentSide) => {
          const position = app.utils.randomOvaryPosition(app.dom.refs.canvases[currentSide]);

          app.session.addStructure(currentSide, {
            type: "cyst",
            size,
            x: position.x,
            y: position.y,
            clockHour: hour,
            source: "voice",
          });

          app.canvas.drawSide(currentSide);
          app.ui.addLog(currentSide, `Cisti ${size}mm (voce)`, "voice");
        });

        app.ui.toast(`Cisti ${size}mm -> ${side ? app.utils.shortSideLabel(side) : "entrambi"}`, "warn");
        app.ui.setTranscriptText(`OK ${rawText}`, true);
        return;
      }

      const countMatch = text.match(/(\d+)\s+foll/);
      const sizeMatch = text.match(/da\s+([\d.]+)\s*mm/) || text.match(/([\d.]+)\s*mm/);
      if (!sizeMatch) {
        app.ui.toast("Comando non riconosciuto", "warn");
        app.ui.setTranscriptText(`ERRORE ${rawText}`, true);
        return;
      }

      const count = countMatch ? parseInt(countMatch[1], 10) : 1;
      const size = parseFloat(sizeMatch[1]);

      sides.forEach((currentSide) => {
        const canvas = app.dom.refs.canvases[currentSide];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radiusX = canvas.width * 0.38;
        const radiusY = canvas.height * 0.35;

        for (let index = 0; index < count; index += 1) {
          let x;
          let y;

          if (hour !== null) {
            const baseAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
            const spread = count > 1 ? (index - (count - 1) / 2) * 0.28 : 0;
            const angle = baseAngle + spread;
            const distance = 0.5 + Math.random() * 0.3;

            x = centerX + radiusX * distance * Math.cos(angle);
            y = centerY + radiusY * distance * Math.sin(angle);
          } else {
            const angle = Math.random() * Math.PI * 2;
            const distance = 0.25 + Math.random() * 0.55;

            x = centerX + radiusX * distance * Math.cos(angle);
            y = centerY + radiusY * distance * Math.sin(angle);
          }

          app.session.addStructure(currentSide, {
            type: "fol",
            size,
            x: app.utils.clamp(x, 18, canvas.width - 18),
            y: app.utils.clamp(y, 18, canvas.height - 18),
            clockHour: hour,
            source: "voice",
          });
        }

        app.canvas.drawSide(currentSide);
      });

      const description = `${count}x ${size}mm${hour ? ` ore ${hour}` : ""}`;
      app.ui.addLog(side || "B", `${description} (voce)`, "voice");
      app.ui.toast(`${description} -> ${side ? app.utils.shortSideLabel(side) : "entrambi"}`);
      app.ui.setTranscriptText(`OK ${rawText}`, true);
    },
  };
})();
