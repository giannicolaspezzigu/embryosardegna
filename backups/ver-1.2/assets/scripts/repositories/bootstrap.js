(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  function createRepositoryFromRuntimeConfig() {
    const runtimeConfig = window.EmbryoRuntimeConfig || {};
    const defaultClinicId = runtimeConfig.clinicId || "clinic_main";

    if (repositories.isRuntimeFirestoreConfigured && repositories.isRuntimeFirestoreConfigured(runtimeConfig)) {
      try {
        return new repositories.FirestoreEmbryoRepository({
          defaultClinicId,
          config: runtimeConfig.firebase.config,
          enableOffline: runtimeConfig.firebase.enableOffline !== false,
        });
      } catch (error) {
        console.warn("Firestore repository unavailable, fallback to mock repository.", error);
      }
    }

    return new repositories.MockEmbryoRepository({
      defaultClinicId,
    });
  }

  repositories.bootstrap = {
    init() {
      const repository = createRepositoryFromRuntimeConfig();

      repositories.assertContract(repository);

      app.data = app.data || {};
      app.data.repository = repository;
      app.data.activeClinicId = repository.defaultClinicId || "clinic_main";
      app.data.repositoryMode = repository.name;

      app.state.context = app.state.context || {};
      app.state.context.clinicId = app.data.activeClinicId;
      app.state.context.activeAnimalId = null;
      app.state.context.activeVisitId = null;
    },
  };
})();
