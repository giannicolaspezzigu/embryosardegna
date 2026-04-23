(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  app.utils = {
    formatDateBadge(date) {
      return (
        date.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        }) +
        " " +
        date.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    },

    formatLogTime(date) {
      return date.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    formatShortDateTime(value) {
      if (!value) {
        return "-";
      }

      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "-";
      }

      return date.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    formatLongDate(value) {
      if (!value) {
        return "-";
      }

      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "-";
      }

      return date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    },

    toLocalDateTimeInputValue(value) {
      const date = value instanceof Date ? value : new Date(value || Date.now());

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const pad = (number) => String(number).padStart(2, "0");

      return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
      );
    },

    localDateTimeInputToIso(value) {
      if (!value) {
        return new Date().toISOString();
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    },

    humanizeEnum(labelMap, key, fallbackValue) {
      if (!key) {
        return fallbackValue || "-";
      }

      return labelMap[key] || fallbackValue || key;
    },

    sideLabel(side) {
      return app.config.sideLabels[side] || "Entrambi";
    },

    shortSideLabel(side) {
      return app.config.shortSideLabels[side] || "Entrambi";
    },

    logSideLabel(side) {
      return app.config.logSideLabels[side] || side;
    },

    getPointer(event) {
      if (event.changedTouches && event.changedTouches.length > 0) {
        return event.changedTouches[0];
      }

      if (event.touches && event.touches.length > 0) {
        return event.touches[0];
      }

      return event;
    },

    canvasPosition(canvas, event) {
      const rect = canvas.getBoundingClientRect();
      const source = this.getPointer(event);
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY,
      };
    },

    isInsideOvary(canvas, x, y) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radiusX = canvas.width * 0.42;
      const radiusY = canvas.height * 0.4;

      return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1;
    },

    randomOvaryPosition(canvas) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radiusX = canvas.width * 0.35;
      const radiusY = canvas.height * 0.32;
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.3 + Math.random() * 0.5;

      return {
        x: this.clamp(centerX + radiusX * distance * Math.cos(angle), 18, canvas.width - 18),
        y: this.clamp(centerY + radiusY * distance * Math.sin(angle), 18, canvas.height - 18),
      };
    },

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    escapeCsv(value) {
      const normalizedValue = value === null || value === undefined ? "" : value;
      return `"${String(normalizedValue).replace(/"/g, '""')}"`;
    },
  };
})();
