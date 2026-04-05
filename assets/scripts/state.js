(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  app.config = {
    sizes: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7],
    transcriptPlaceholder: 'Es: "3 follicoli 4mm ore 6 sinistro" - "corpo luteo 8mm destro" - "ovulazione sinistro"',
    sideLabels: { L: "Sinistro", R: "Destro" },
    shortSideLabels: { L: "Sin.", R: "Des." },
    logSideLabels: { L: "SIN", R: "DES", B: "ENT" },
    speciesLabels: { ovine: "Ovino", bovine: "Bovino" },
    reproductiveRoleLabels: {
      recipient: "Ricevente",
      donor: "Donatrice",
      breeding_female: "Riproduttrice",
      breeding_male: "Maschio riproduttore",
      monitoring_only: "Monitoraggio",
    },
    visitPurposeLabels: {
      follicular_monitoring: "Monitoraggio follicolare",
      recipient_selection: "Selezione ricevente",
      breeding_exam: "Esame riproduttivo",
      pregnancy_diagnosis: "Diagnosi gravidanza",
      follow_up: "Follow-up",
      male_repro_exam: "Esame maschile",
      research_scan: "Ecografia di ricerca",
    },
    programTypeLabels: {
      natural_mating: "Monta naturale",
      ai: "IA",
      tai: "TAI",
      et: "Embryo transfer",
      moet: "MOET",
      synchronization: "Sincronizzazione",
      unknown: "Non definito",
    },
    pregnancyStatusLabels: {
      unknown: "Non definito",
      suspected: "Sospetta",
      positive: "Positiva",
      negative: "Negativa",
      loss_suspected: "Perdita sospetta",
      loss_confirmed: "Perdita confermata",
      completed: "Conclusa",
    },
    uterusLabels: {
      T: ["-", "Ipotonico", "Normale", "Ipertonico"],
      V: ["-", "Scarsa", "Moderata", "Abbondante"],
      L: ["-", "Assente", "Lieve", "Abbondante"],
    },
  };

  app.state = {
    context: {
      clinicId: null,
      activeAnimalId: null,
      activeVisitId: null,
    },
    selection: {
      type: "fol",
      size: 3,
      customSize: null,
    },
    structs: { L: [], R: [] },
    uterus: { T: null, V: null, L: null },
    logRows: [],
    recognition: null,
    isListening: false,
    pendingCL: null,
    sessionStartedAt: new Date(),
    workspace: {
      clinic: null,
      animals: [],
      activeView: "operational",
      animalSearchTerm: "",
      selectedAnimal: null,
      visitsByAnimalId: {},
      selectedVisit: null,
    },
  };

  app.stateApi = {
    getSelectedType() {
      return app.state.selection.type;
    },

    getSelectedSize() {
      return app.state.selection.customSize || app.state.selection.size;
    },

    selectFollicle(size, customSize) {
      app.state.selection.type = "fol";
      app.state.selection.size = size;
      app.state.selection.customSize = customSize || null;
    },

    selectSpecial(type) {
      app.state.selection.type = type;
      app.state.selection.size = null;
      app.state.selection.customSize = null;
    },

    setCustomSize(size) {
      app.state.selection.type = "fol";
      app.state.selection.size = size;
      app.state.selection.customSize = size;
    },

    clearSelection() {
      app.state.selection.type = null;
      app.state.selection.size = null;
      app.state.selection.customSize = null;
    },

    setListening(value) {
      app.state.isListening = value;
    },

    setRecognition(recognition) {
      app.state.recognition = recognition;
    },

    setPendingCL(payload) {
      app.state.pendingCL = payload;
    },

    clearPendingCL() {
      app.state.pendingCL = null;
    },
  };
})();
