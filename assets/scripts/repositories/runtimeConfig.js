(function () {
  window.EmbryoRuntimeConfig = window.EmbryoRuntimeConfig || {
    provider: "firestore",
    clinicId: "clinic_main",
    auth: {
      enabled: true,
      loginPage: "./intro.html",
      appPage: "./embryosardegna.html",
      persistence: "local",
      usernameEmailDomain: "embryosardegna.local",
      userProfileCollection: "users",
      useCachedAccessOffline: true,
    },
    sync: {
      enabled: true,
      pollIntervalMs: 300000,
      syncOnWindowFocus: true,
      syncOnVisibility: true,
    },
    firebase: {
      enabled: true,
      enableOffline: true,
      config: {
        apiKey: "AIzaSyBloETEYeCBi3d1cXf7kfBGPxDJQNXjg5I",
        authDomain: "embryosardegna-proto.firebaseapp.com",
        projectId: "embryosardegna-proto",
        storageBucket: "embryosardegna-proto.firebasestorage.app",
        messagingSenderId: "381917122032",
        appId: "1:381917122032:web:fc6f93e1749ae8a528a135",
      },
    },
  };
})();
