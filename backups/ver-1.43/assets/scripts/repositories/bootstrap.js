(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const repositories = (app.repositories = app.repositories || {});

  function createRemoteRepositoryFromRuntimeConfig(runtimeConfig) {
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

    return null;
  }

  function createRepositoryFromRuntimeConfig() {
    const runtimeConfig = app.platform && typeof app.platform.getRuntimeConfig === "function" ? app.platform.getRuntimeConfig() : window.EmbryoRuntimeConfig || {};
    const defaultClinicId = runtimeConfig.clinicId || "clinic_main";
    const remoteRepository = createRemoteRepositoryFromRuntimeConfig(runtimeConfig);
    const syncEnabled = runtimeConfig.sync ? runtimeConfig.sync.enabled !== false : true;

    if (syncEnabled && repositories.SyncedEmbryoRepository) {
      return new repositories.SyncedEmbryoRepository({
        defaultClinicId,
        remoteRepository,
        pollIntervalMs: runtimeConfig.sync && runtimeConfig.sync.pollIntervalMs,
        syncOnWindowFocus: !runtimeConfig.sync || runtimeConfig.sync.syncOnWindowFocus !== false,
        syncOnVisibility: !runtimeConfig.sync || runtimeConfig.sync.syncOnVisibility !== false,
      });
    }

    if (remoteRepository) {
      return remoteRepository;
    }

    return new repositories.MockEmbryoRepository({
      defaultClinicId,
    });
  }

  repositories.bootstrap = {
    init() {
      const runtimeConfig = app.platform && typeof app.platform.getRuntimeConfig === "function" ? app.platform.getRuntimeConfig() : window.EmbryoRuntimeConfig || {};
      const repository = createRepositoryFromRuntimeConfig();

      repositories.assertContract(repository);

      app.data = app.data || {};
      app.data.repository = repository;
      app.data.activeClinicId = repository.defaultClinicId || "clinic_main";
      app.data.repositoryMode = repository.name;
      app.data.runtimeConfig = runtimeConfig;

      app.state.context = app.state.context || {};
      app.state.context.clinicId = app.data.activeClinicId;
      app.state.context.activeSessionId = null;
      app.state.context.activeAnimalId = null;
      app.state.context.activeVisitId = null;
    },
  };
})();
