(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  function createMediaElement(tagName, className) {
    const element = document.createElement(tagName);
    element.className = className;
    return element;
  }

  function clearModalBody() {
    app.dom.refs.attachmentModalBody.innerHTML = "";
  }

  function renderAttachmentBody(attachment) {
    const refs = app.dom.refs;
    const type = attachment.type || "document";
    const url = attachment.url || "";

    clearModalBody();

    if (!url) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.textContent = "Questo allegato non contiene ancora un file visualizzabile.";
      refs.attachmentModalBody.appendChild(emptyState);
      return;
    }

    if (type === "image" || type === "snapshot") {
      const image = createMediaElement("img", "attachment-modal-media");
      image.src = url;
      image.alt = attachment.label || "Allegato visita";
      refs.attachmentModalBody.appendChild(image);
      return;
    }

    if (type === "video") {
      const video = createMediaElement("video", "attachment-modal-media");
      video.src = url;
      video.controls = true;
      video.preload = "metadata";
      refs.attachmentModalBody.appendChild(video);
      return;
    }

    if (type === "document" || type === "report") {
      const isPdf = url.indexOf("data:application/pdf") === 0 || /\.pdf($|\?)/i.test(attachment.label || "");

      if (isPdf) {
        const frame = createMediaElement("iframe", "attachment-modal-media attachment-modal-iframe");
        frame.src = url;
        frame.title = attachment.label || "Documento allegato";
        refs.attachmentModalBody.appendChild(frame);
        return;
      }
    }

    const fallback = document.createElement("div");
    fallback.className = "empty-state";
    fallback.textContent = "Anteprima non disponibile per questo formato. Usa Scarica per aprire il file.";
    refs.attachmentModalBody.appendChild(fallback);
  }

  app.attachmentViewer = {
    currentAttachment: null,

    init() {
      const refs = app.dom.refs;

      refs.closeAttachmentModalBtn.addEventListener("click", () => {
        this.close();
      });

      refs.attachmentModal.addEventListener("click", (event) => {
        if (event.target === refs.attachmentModal) {
          this.close();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && refs.attachmentModal.classList.contains("open")) {
          this.close();
        }
      });
    },

    open(attachment) {
      const refs = app.dom.refs;
      const safeAttachment = attachment || {};
      const title = safeAttachment.label || safeAttachment.type || "Allegato visita";
      const metaParts = [];

      if (safeAttachment.type) {
        metaParts.push(app.utils.humanizeEnum({ image: "Immagine", snapshot: "Snapshot", video: "Video", document: "Documento", report: "Referto" }, safeAttachment.type, safeAttachment.type));
      }

      if (safeAttachment.capturedAt) {
        metaParts.push(app.utils.formatShortDateTime(safeAttachment.capturedAt));
      }

      this.currentAttachment = safeAttachment;
      refs.attachmentModalTitle.textContent = title;
      refs.attachmentModalMeta.textContent = metaParts.join(" · ") || "Anteprima allegato";
      refs.downloadAttachmentBtn.href = safeAttachment.url || "#";
      refs.downloadAttachmentBtn.download = safeAttachment.label || "allegato-visita";
      renderAttachmentBody(safeAttachment);
      refs.attachmentModal.classList.add("open");
    },

    close() {
      const refs = app.dom.refs;

      this.currentAttachment = null;
      refs.attachmentModal.classList.remove("open");
      refs.downloadAttachmentBtn.href = "#";
      refs.downloadAttachmentBtn.removeAttribute("download");
      clearModalBody();
    },
  };
})();
