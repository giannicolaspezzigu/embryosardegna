# Firebase Setup

Status: `READY FOR CONFIGURATION`

Last updated: `2026-04-06`

This project is now prepared to switch from the local `mock repository` to a real `Firestore repository`.

Current behavior:

- if `provider = "mock"` the app works exactly as today
- if `provider = "firestore"` and Firebase is configured correctly, the app uses the online database

The runtime switch is controlled in:

- `assets/scripts/repositories/runtimeConfig.js`

The Firestore repository adapter is already available in:

- `assets/scripts/repositories/firestoreRepository.js`

## Why Firestore Here

Firestore is a pragmatic choice for this prototype because it supports:

- web client
- future mobile app
- offline cache and sync
- simple document model for `animals`, `visits`, `attachments`, `events`

## Step 1. Create Firebase Project

Create a Firebase project in the Firebase Console.

Recommended:

- use a project name dedicated to this prototype
- choose a European region
- keep one main clinic id: `clinic_main`

## Step 2. Register the Web App

Inside the Firebase project:

- add a new Web app
- copy the Firebase config object

You will need these values:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## Step 3. Enable Firestore

Create a Firestore database.

For the very first internal prototype:

- you may use `test mode` temporarily

Important:

- `test mode` is acceptable only for a controlled prototype
- before real use, the next step must be `authentication + security rules`

## Step 4. Load Firebase SDK in HTML

To activate Firestore in the browser, add the Firebase compat SDK scripts in:

- `embryosardegna.html`

Place them before:

- `assets/scripts/repositories/firestoreRepository.js`

Example structure:

```html
<script src="https://www.gstatic.com/firebasejs/VERSION/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/VERSION/firebase-firestore-compat.js"></script>
```

Replace `VERSION` with the current Firebase compat version from the official docs.

Why compat:

- this prototype currently uses classic browser scripts, not ES modules
- compat lets us integrate Firestore without introducing a build step yet

## Step 5. Configure Runtime

Open:

- `assets/scripts/repositories/runtimeConfig.js`

Change it from:

```js
provider: "mock"
```

to:

```js
provider: "firestore"
```

Then set:

```js
firebase: {
  enabled: true,
  enableOffline: true,
  config: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
}
```

## Step 6. Start the App

When the Firebase config and SDK are present:

- reload the page
- the badge should show `Repo FIRESTORE`

At that point:

- new animals will go to Firestore
- new visits will go to Firestore
- attachments, protocol events, and pregnancy checks will go to Firestore

## Current Collection Layout

```text
clinics/{clinicId}
clinics/{clinicId}/animals/{animalId}
clinics/{clinicId}/animals/{animalId}/visits/{visitId}
clinics/{clinicId}/animals/{animalId}/visits/{visitId}/attachments/{attachmentId}
clinics/{clinicId}/animals/{animalId}/visits/{visitId}/events/{eventId}
clinics/{clinicId}/animals/{animalId}/pregnancyChecks/{checkId}
```

This layout matches the frozen `v2` data model.

## Important Next Security Step

Before putting the system in real use:

1. add Firebase Authentication
2. replace temporary test rules
3. limit data access to authorized users only
4. introduce clinic/member authorization logic

## Suggested Next Implementation Step

After Firebase is connected and the repository badge shows `Repo FIRESTORE`:

1. test create animal
2. test save visit
3. test edit visit
4. test attachment upload
5. verify data persists after page reload
6. then implement authentication and harden rules
