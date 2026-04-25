# Firebase Auth + Firestore Access

Status: `READY FOR CONSOLE SETUP`

Last updated: `2026-04-23`

This codebase now includes:

- real login on `intro.html`
- session persistence with Firebase Auth
- access gating before opening `embryosardegna.html`
- clinic resolution from the authenticated user's Firestore profile
- logout from the main app shell

## What Changed In Code

Relevant files:

- `intro.html`
- `assets/scripts/intro.js`
- `assets/scripts/auth.js`
- `embryosardegna.html`
- `assets/scripts/repositories/runtimeConfig.js`
- `firestore.rules`

`index.html` now redirects to `intro.html`, not directly to the app.

## Login Model

The login form accepts:

- full email, for example `operator.demo@embryosardegna.local`
- or short operator identifier, for example `operator.demo`

If the operator types only the short identifier, the app converts it to:

- `operator.demo@embryosardegna.local`

This suffix is configured in:

- `assets/scripts/repositories/runtimeConfig.js`

## Required Firebase Console Steps

## 1. Enable Email/Password Authentication

In Firebase Console:

1. Open `Authentication`
2. Open `Sign-in method`
3. Enable `Email/Password`
4. Save

## 2. Create The First Users

Create each user in Firebase Authentication.

Example:

- email: `operator.demo@embryosardegna.local`
- password: your chosen password

After creating the user, copy the generated `uid`.

## 3. Create User Access Documents In Firestore

For each authenticated user create:

### User profile document

Path:

- `users/{uid}`

Example document:

```json
{
  "displayName": "Operatore Demo",
  "role": "operator",
  "defaultClinicId": "clinic_sync_test"
}
```

### Clinic membership document

Path:

- `users/{uid}/clinics/clinic_sync_test`

Example document:

```json
{
  "active": true,
  "role": "operator",
  "label": "Clinica test sync",
  "defaultClinic": true
}
```

When you want the operator on production, create or update:

- `users/{uid}/clinics/clinic_main`

Example:

```json
{
  "active": true,
  "role": "operator",
  "label": "Clinica live",
  "defaultClinic": true
}
```

And then update `users/{uid}.defaultClinicId` to:

- `clinic_main`

## 4. Publish Firestore Security Rules

Use the rules file in:

- `firestore.rules`

These rules do this:

- require authenticated user
- allow each user to read only their own profile under `users/{uid}`
- allow clinic data access only if `users/{uid}/clinics/{clinicId}.active == true`
- block client-side writes to user access documents

## 5. First Test Flow

1. Open `intro.html`
2. Login with the test operator
3. Confirm redirect to `embryosardegna.html`
4. Confirm the user lands on `clinic_sync_test`
5. Test create/edit/delete and sync
6. Logout
7. Login again
8. Test reopen offline after a previous successful online login

## Production Switch

After test validation:

1. give the real operators membership on `clinic_main`
2. set their `defaultClinicId` to `clinic_main`
3. keep `clinic_sync_test` only for test users or admins

The app will then resolve the clinic from the authenticated profile and no longer depend on a hardcoded live clinic choice for normal usage.

## Notes

- the app keeps a cached access session locally, so a device that already logged in successfully can reopen offline and continue working with the previously assigned clinic
- first login still requires network
- these rules secure Firestore access by membership without needing custom claims yet
- custom claims remain optional for future `admin` or `superadmin` roles
