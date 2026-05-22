(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});
  const STORAGE_KEY = "embryo_auth_session_v1";
  const state = {
    initialAuthPromise: null,
    sessionObserverAttached: false,
    currentSession: null,
  };

  function getStorage() {
    if (app.platform && app.platform.storage) {
      return app.platform.storage;
    }

    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readJson(rawValue) {
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getRuntimeConfig() {
    if (app.platform && typeof app.platform.getRuntimeConfig === "function") {
      return app.platform.getRuntimeConfig() || {};
    }

    return window.EmbryoRuntimeConfig || {};
  }

  function setRuntimeConfig(config) {
    if (app.platform && typeof app.platform.setRuntimeConfig === "function") {
      app.platform.setRuntimeConfig(config || {});
      return;
    }

    window.EmbryoRuntimeConfig = config || {};
  }

  function getAuthConfig() {
    const runtimeConfig = getRuntimeConfig();

    return Object.assign(
      {
        enabled: false,
        loginPage: "./intro.html",
        appPage: "./embryosardegna.html",
        persistence: "local",
        usernameEmailDomain: "embryosardegna.local",
        userProfileCollection: "users",
        useCachedAccessOffline: true,
      },
      runtimeConfig.auth || {}
    );
  }

  function getFirebaseGlobal() {
    if (app.platform && app.platform.providers && typeof app.platform.providers.getFirebase === "function") {
      return app.platform.providers.getFirebase();
    }

    return window.firebase || null;
  }

  function hasFirebaseConfig(runtimeConfig) {
    const config = runtimeConfig && runtimeConfig.firebase ? runtimeConfig.firebase.config : null;
    return Boolean(config && config.apiKey && config.projectId && config.appId);
  }

  function ensureFirebaseApp() {
    const runtimeConfig = getRuntimeConfig();
    const firebaseGlobal = getFirebaseGlobal();

    if (!firebaseGlobal || typeof firebaseGlobal.initializeApp !== "function") {
      throw new Error("Firebase SDK non disponibile nella pagina.");
    }

    if (!hasFirebaseConfig(runtimeConfig)) {
      throw new Error("Configurazione Firebase incompleta.");
    }

    if (firebaseGlobal.apps && firebaseGlobal.apps.length > 0) {
      return firebaseGlobal.apps[0];
    }

    return firebaseGlobal.initializeApp(runtimeConfig.firebase.config);
  }

  function getAuthInstance() {
    if (!getAuthConfig().enabled) {
      return null;
    }

    const firebaseGlobal = getFirebaseGlobal();

    if (!firebaseGlobal || typeof firebaseGlobal.auth !== "function") {
      throw new Error("Firebase Authentication non disponibile nella pagina.");
    }

    ensureFirebaseApp();
    return firebaseGlobal.auth();
  }

  function getFirestoreInstance() {
    const firebaseGlobal = getFirebaseGlobal();

    if (!firebaseGlobal || typeof firebaseGlobal.firestore !== "function") {
      throw new Error("Firebase Firestore non disponibile nella pagina.");
    }

    ensureFirebaseApp();
    return firebaseGlobal.firestore();
  }

  function getAuthPersistenceValue() {
    const firebaseGlobal = getFirebaseGlobal();
    const persistence = firebaseGlobal && firebaseGlobal.auth && firebaseGlobal.auth.Auth && firebaseGlobal.auth.Auth.Persistence;

    if (!persistence) {
      return null;
    }

    const mode = String(getAuthConfig().persistence || "local").toLowerCase();

    if (mode === "session") {
      return persistence.SESSION;
    }

    if (mode === "none") {
      return persistence.NONE;
    }

    return persistence.LOCAL;
  }

  function readCachedSession() {
    const storage = getStorage();

    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }

    return readJson(storage.getItem(STORAGE_KEY));
  }

  function writeCachedSession(session) {
    const storage = getStorage();

    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(session || null));
  }

  function clearCachedSession() {
    const storage = getStorage();

    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(STORAGE_KEY);
    }

    state.currentSession = null;
  }

  function isOfflineLikeError(error) {
    const message = String((error && error.message) || "").toLowerCase();
    const code = String((error && error.code) || "").toLowerCase();
    const isOnline =
      app.platform && app.platform.network && typeof app.platform.network.isOnline === "function"
        ? app.platform.network.isOnline()
        : typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
          ? navigator.onLine
          : true;

    if (!isOnline) {
      return true;
    }

    return (
      code === "unavailable" ||
      code === "auth/network-request-failed" ||
      message.indexOf("offline") >= 0 ||
      message.indexOf("network") >= 0 ||
      message.indexOf("unavailable") >= 0 ||
      message.indexOf("failed to get document because the client is offline") >= 0
    );
  }

  function normalizeLoginIdentifier(rawIdentifier) {
    const identifier = String(rawIdentifier || "").trim().toLowerCase();

    if (!identifier) {
      return "";
    }

    if (identifier.indexOf("@") >= 0) {
      return identifier;
    }

    const emailDomain = String(getAuthConfig().usernameEmailDomain || "").trim().replace(/^@+/, "");
    return emailDomain ? `${identifier}@${emailDomain}` : identifier;
  }

  function buildAccessError(message, code) {
    const error = new Error(message);
    error.code = code || "auth/access-denied";
    return error;
  }

  function buildActiveMemberships(membershipDocs) {
    return membershipDocs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          clinicId: doc.id,
          active: data.active !== false,
          role: data.role || "operator",
          label: data.label || doc.id,
          defaultClinic: Boolean(data.defaultClinic),
        };
      })
      .filter((item) => item.active);
  }

  async function loadAccessProfile(uid) {
    const db = getFirestoreInstance();
    const userCollection = getAuthConfig().userProfileCollection;
    const userRef = db.collection(userCollection).doc(uid);
    const [userSnapshot, clinicsSnapshot] = await Promise.all([userRef.get(), userRef.collection("clinics").get()]);

    return {
      profile: userSnapshot.exists ? userSnapshot.data() || {} : {},
      memberships: buildActiveMemberships(clinicsSnapshot.docs),
    };
  }

  function chooseClinicId(profile, memberships, cachedSession) {
    const membershipIds = memberships.map((item) => item.clinicId);
    const runtimeConfig = getRuntimeConfig();
    const candidates = [
      cachedSession && cachedSession.clinicId,
      profile && profile.defaultClinicId,
      memberships.find((item) => item.defaultClinic) ? memberships.find((item) => item.defaultClinic).clinicId : null,
      runtimeConfig.clinicId,
    ].filter(Boolean);

    for (let index = 0; index < candidates.length; index += 1) {
      const clinicId = candidates[index];

      if (membershipIds.indexOf(clinicId) >= 0) {
        return clinicId;
      }
    }

    return membershipIds[0] || null;
  }

  function getMembershipByClinicId(memberships, clinicId) {
    const list = Array.isArray(memberships) ? memberships : [];
    return list.find((item) => item.clinicId === clinicId) || null;
  }

  function buildSessionFromProfile(user, profileData, cachedSession) {
    const profile = profileData && profileData.profile ? profileData.profile : {};
    const memberships = profileData && Array.isArray(profileData.memberships) ? profileData.memberships : [];
    const clinicId = chooseClinicId(profile, memberships, cachedSession);
    const selectedMembership = getMembershipByClinicId(memberships, clinicId);

    return {
      uid: user.uid,
      email: user.email || "",
      displayName: profile.displayName || user.displayName || user.email || user.uid,
      clinicId,
      clinicLabel: (selectedMembership && (selectedMembership.label || selectedMembership.clinicId)) || clinicId || "",
      role: (selectedMembership && selectedMembership.role) || profile.role || "operator",
      memberships,
      defaultClinicId: clinicId,
      profile,
      resolvedAt: new Date().toISOString(),
      source: "remote",
    };
  }

  async function resolveAccessSession(user, options) {
    const settings = options || {};
    const cachedSession = readCachedSession();

    try {
      const profileData = await loadAccessProfile(user.uid);
      const session = buildSessionFromProfile(user, profileData, cachedSession);

      if (!session.clinicId && settings.allowNoClinic !== true) {
        throw buildAccessError("Utente autenticato ma senza clinica assegnata.", "auth/no-clinic-access");
      }

      writeCachedSession(session);
      state.currentSession = session;
      return session;
    } catch (error) {
      if (getAuthConfig().useCachedAccessOffline !== false && cachedSession && cachedSession.uid === user.uid && isOfflineLikeError(error)) {
        state.currentSession = Object.assign({}, cachedSession, {
          email: user.email || cachedSession.email || "",
          displayName: cachedSession.displayName || user.displayName || user.email || user.uid,
          source: "cache",
        });
        return state.currentSession;
      }

      throw error;
    }
  }

  function getLoginPageUrl() {
    return getAuthConfig().loginPage || "./intro.html";
  }

  function getAppPageUrl() {
    return getAuthConfig().appPage || "./embryosardegna.html";
  }

  function redirectTo(url) {
    if (typeof window === "undefined" || !url) {
      return;
    }

    window.location.replace(url);
  }

  function applySessionToRuntime(session) {
    if (!session) {
      return;
    }

    const runtimeConfig = getRuntimeConfig();
    const nextRuntimeConfig = Object.assign({}, runtimeConfig, {
      clinicId: session.clinicId,
    });

    setRuntimeConfig(nextRuntimeConfig);
    app.data = app.data || {};
    app.data.activeClinicId = session.clinicId;
    app.data.authSession = session;
    app.state = app.state || {};
    app.state.context = app.state.context || {};
    app.state.context.clinicId = session.clinicId;
    state.currentSession = session;
  }

  function buildClinicSwitchedSession(session, clinicId) {
    const currentSession = session || state.currentSession || readCachedSession();

    if (!currentSession) {
      throw buildAccessError("Sessione utente non disponibile.", "auth/no-session");
    }

    const memberships = Array.isArray(currentSession.memberships) ? currentSession.memberships : [];
    const selectedMembership = getMembershipByClinicId(memberships, clinicId);

    if (!selectedMembership || selectedMembership.active === false) {
      throw buildAccessError("Utente autenticato ma senza accesso alla clinica richiesta.", "auth/no-clinic-access");
    }

    return Object.assign({}, currentSession, {
      clinicId,
      clinicLabel: selectedMembership.label || selectedMembership.clinicId || clinicId,
      role: selectedMembership.role || currentSession.role || "operator",
      resolvedAt: new Date().toISOString(),
      source: "cache",
    });
  }

  function switchClinic(clinicId) {
    const nextSession = buildClinicSwitchedSession(state.currentSession || readCachedSession(), clinicId);
    writeCachedSession(nextSession);
    applySessionToRuntime(nextSession);
    return nextSession;
  }

  function renderClinicControls(wrapper, selectElement, session) {
    if (!wrapper || !selectElement) {
      return;
    }

    const memberships = session && Array.isArray(session.memberships) ? session.memberships : [];

    if (!session || !memberships.length) {
      wrapper.hidden = true;
      selectElement.innerHTML = "";
      return;
    }

    wrapper.hidden = false;
    selectElement.innerHTML = memberships
      .map((membership) => {
        const selected = membership.clinicId === session.clinicId ? " selected" : "";
        const label = membership.label || membership.clinicId;
        return `<option value="${escapeHtml(membership.clinicId)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
    selectElement.value = session.clinicId || memberships[0].clinicId;
    selectElement.disabled = memberships.length <= 1;
    selectElement.title = memberships.length <= 1 ? "Clinica assegnata" : "Cambia clinica attiva";
  }

  function isIntroPage() {
    if (typeof window === "undefined" || !window.location) {
      return false;
    }

    return /(?:^|\/)intro\.html$/i.test(window.location.pathname || "");
  }

  function attachSessionObserver() {
    if (state.sessionObserverAttached || !getAuthConfig().enabled) {
      return;
    }

    const auth = getAuthInstance();
    state.sessionObserverAttached = true;

    auth.onAuthStateChanged((user) => {
      if (user) {
        return;
      }

      clearCachedSession();

      if (!isIntroPage()) {
        redirectTo(getLoginPageUrl());
      }
    });
  }

  function waitForInitialAuthState() {
    if (state.initialAuthPromise) {
      return state.initialAuthPromise;
    }

    if (!getAuthConfig().enabled) {
      state.initialAuthPromise = Promise.resolve(null);
      return state.initialAuthPromise;
    }

    const auth = getAuthInstance();

    state.initialAuthPromise = new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        () => {
          unsubscribe();
          resolve(null);
        }
      );
    });

    return state.initialAuthPromise;
  }

  async function signInWithPassword(identifier, password) {
    const auth = getAuthInstance();
    const email = normalizeLoginIdentifier(identifier);
    const persistence = getAuthPersistenceValue();

    if (!email) {
      throw buildAccessError("Inserisci un identificativo utente valido.", "auth/invalid-identifier");
    }

    if (persistence) {
      await auth.setPersistence(persistence);
    }

    const credentials = await auth.signInWithEmailAndPassword(email, String(password || ""));

    try {
      const session = await resolveAccessSession(credentials.user, {
        allowNoClinic: false,
      });

      applySessionToRuntime(session);
      attachSessionObserver();
      return session;
    } catch (error) {
      clearCachedSession();

      try {
        await auth.signOut();
      } catch (signOutError) {
        console.warn(signOutError);
      }

      throw error;
    }
  }

  async function signOut() {
    const auth = getAuthInstance();

    clearCachedSession();

    if (auth) {
      await auth.signOut();
    }
  }

  async function prepareAppAccess(options) {
    const settings = options || {};

    if (!getAuthConfig().enabled) {
      return null;
    }

    const user = await waitForInitialAuthState();

    if (!user) {
      clearCachedSession();

      if (settings.redirectOnFailure !== false) {
        redirectTo(getLoginPageUrl());
      }

      return null;
    }

    let session = null;

    try {
      session = await resolveAccessSession(user, {
        allowNoClinic: false,
      });
    } catch (error) {
      clearCachedSession();

      try {
        await getAuthInstance().signOut();
      } catch (signOutError) {
        console.warn(signOutError);
      }

      if (settings.redirectOnFailure !== false) {
        redirectTo(getLoginPageUrl());
        return null;
      }

      throw error;
    }

    if (!session || !session.clinicId) {
      clearCachedSession();

      if (settings.redirectOnFailure !== false) {
        redirectTo(getLoginPageUrl());
      }

      return null;
    }

    applySessionToRuntime(session);
    attachSessionObserver();
    return session;
  }

  async function redirectIfAuthenticated() {
    if (!getAuthConfig().enabled) {
      return null;
    }

    const user = await waitForInitialAuthState();

    if (!user) {
      return null;
    }

    let session = null;

    try {
      session = await resolveAccessSession(user, {
        allowNoClinic: false,
      });
    } catch (error) {
      clearCachedSession();

      try {
        await getAuthInstance().signOut();
      } catch (signOutError) {
        console.warn(signOutError);
      }

      throw error;
    }

    if (session && session.clinicId) {
      applySessionToRuntime(session);
      attachSessionObserver();
      redirectTo(getAppPageUrl());
      return session;
    }

    return null;
  }

  function getFriendlyErrorMessage(error) {
    const code = String((error && error.code) || "");

    if (code === "auth/invalid-email" || code === "auth/invalid-identifier") {
      return "Identificativo non valido.";
    }

    if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
      return "Credenziali non valide.";
    }

    if (code === "auth/user-disabled") {
      return "Utente disabilitato.";
    }

    if (code === "auth/network-request-failed") {
      return "Connessione assente o instabile.";
    }

    if (code === "auth/too-many-requests") {
      return "Troppi tentativi di accesso. Riprova piu tardi.";
    }

    if (code === "auth/no-clinic-access") {
      return "Utente autenticato ma senza clinica assegnata.";
    }

    if (code === "permission-denied") {
      return "Utente autenticato ma non autorizzato al profilo clinica.";
    }

    return (error && error.message) || "Accesso non riuscito.";
  }

  function bindShellControls(refs) {
    const logoutButton = refs && refs.logoutBtn ? refs.logoutBtn : document.getElementById("logoutBtn");
    const clinicSwitcher = refs && refs.clinicSwitcher ? refs.clinicSwitcher : document.getElementById("clinicSwitcher");
    const clinicSelect = refs && refs.clinicSelect ? refs.clinicSelect : document.getElementById("clinicSelect");
    const session = state.currentSession || readCachedSession();

    renderClinicControls(clinicSwitcher, clinicSelect, session);

    if (session && logoutButton) {
      logoutButton.title = `Disconnetti ${session.displayName || session.email || session.uid}`;
    }

    if (!logoutButton || logoutButton.dataset.authBound === "true") {
      return;
    }

    logoutButton.dataset.authBound = "true";

    if (clinicSelect && clinicSelect.dataset.authBound !== "true") {
      clinicSelect.dataset.authBound = "true";
      clinicSelect.addEventListener("change", async () => {
        const targetClinicId = clinicSelect.value;
        const currentSession = state.currentSession || readCachedSession();

        if (!currentSession || !targetClinicId || targetClinicId === currentSession.clinicId) {
          return;
        }

        clinicSelect.disabled = true;
        logoutButton.disabled = true;

        try {
          if (app.ui && typeof app.ui.beginClinicSwitchLoading === "function") {
            app.ui.beginClinicSwitchLoading({
              clinicId: targetClinicId,
              clinicLabel: clinicSelect.options[clinicSelect.selectedIndex]
                ? clinicSelect.options[clinicSelect.selectedIndex].text
                : targetClinicId,
            });
          }

          switchClinic(targetClinicId);
          redirectTo(getAppPageUrl());
        } catch (error) {
          console.error(error);
          if (app.ui && typeof app.ui.failBootLoading === "function") {
            app.ui.failBootLoading();
          }
          renderClinicControls(clinicSwitcher, clinicSelect, state.currentSession || readCachedSession());
          logoutButton.disabled = false;

          if (app.ui && typeof app.ui.toast === "function") {
            app.ui.toast("Errore durante il cambio clinica", "warn");
          }
        }
      });
    }

    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await signOut();
        redirectTo(getLoginPageUrl());
      } catch (error) {
        console.error(error);
        logoutButton.disabled = false;

        if (app.ui && typeof app.ui.toast === "function") {
          app.ui.toast("Errore durante il logout", "warn");
        }
      }
    });
  }

  app.auth = {
    isEnabled() {
      return Boolean(getAuthConfig().enabled);
    },
    getRuntimeConfig,
    getAuthConfig,
    getCurrentUser() {
      const auth = getAuthInstance();
      return auth ? auth.currentUser : null;
    },
    getCurrentSession() {
      return state.currentSession || readCachedSession();
    },
    normalizeLoginIdentifier,
    waitForInitialAuthState,
    prepareAppAccess,
    redirectIfAuthenticated,
    signInWithPassword,
    signOut,
    switchClinic,
    clearCachedSession,
    getFriendlyErrorMessage,
    bindShellControls,
  };
})();
