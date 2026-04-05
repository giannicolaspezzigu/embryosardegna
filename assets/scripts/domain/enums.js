(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const domain = (app.domain = app.domain || {});

  domain.enums = {
    species: ["ovine", "bovine"],
    sex: ["female", "male", "unknown"],
    animalStatus: ["active", "inactive", "archived", "sold", "deceased"],
    reproductiveRole: ["recipient", "donor", "breeding_female", "breeding_male", "monitoring_only"],
    lactationStatus: ["dry", "lactating", "unknown"],
    visitPurpose: [
      "follicular_monitoring",
      "recipient_selection",
      "breeding_exam",
      "pregnancy_diagnosis",
      "follow_up",
      "male_repro_exam",
      "research_scan",
    ],
    programType: ["natural_mating", "ai", "tai", "et", "moet", "synchronization", "unknown"],
    structureType: ["follicle", "ovulation", "corpus_luteum", "cyst", "other"],
    scanSource: ["tap", "drag", "voice", "import", "manual_entry"],
    eventType: [
      "hormone",
      "device_inserted",
      "device_removed",
      "estrus_observed",
      "ai",
      "et",
      "natural_mating",
      "pregnancy_diagnosis",
      "clinical_note",
      "other",
    ],
    pregnancyStatus: ["unknown", "suspected", "positive", "negative", "loss_suspected", "loss_confirmed", "completed"],
    attachmentType: ["image", "video", "snapshot", "document", "report"],
    season: ["breeding", "non_breeding", "transitional", "unknown"],
    syncStatus: ["pending", "synced", "error"],
  };
})();
