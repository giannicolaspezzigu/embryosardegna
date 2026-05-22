# Go Live `clinic_main`

Status: `READY FOR LIVE ROLLOUT`

Last updated: `2026-04-24`

## Goal

Publish the new authenticated app on top of the real production clinic:

- production clinic: `clinic_main`
- test clinic: `clinic_sync_test`

Important:

- creating Auth users and Firestore access documents does **not** modify the existing medical data already stored under `clinics/clinic_main`
- existing clinic data stays untouched until an authenticated operator starts using the new app and saves new changes

## What Is Already Ready In Code

- real login through Firebase Authentication
- Firestore access rules by clinic membership
- automatic clinic resolution from the authenticated user's profile
- offline/local-first sync
- backup/export JSON
- production fallback clinic set to `clinic_main`

## Recommended Rollout Order

### 1. Keep one test user

Do **not** remove your existing test user on `clinic_sync_test`.

Keep at least one account that still lands on:

- `clinic_sync_test`

This stays your safe test path after go-live.

### 2. Create the real operators in Firebase Authentication

For each real operator create one Auth account.

You can choose either:

- real email accounts
- technical accounts such as `nome.cognome@embryosardegna.local`

If you want the short login alias in the form, technical accounts are simpler.

Examples:

- `antonio.spezzigu@embryosardegna.local`
- `operatore.studio1@embryosardegna.local`

After creating each user, copy the generated `uid`.

### 3. Create the Firestore access profile for each user

For each operator create:

#### A. User profile document

Path:

- `users/{uid}`

Example:

```json
{
  "displayName": "Antonio Spezzigu",
  "role": "operator",
  "defaultClinicId": "clinic_main"
}
```

#### B. Clinic membership document

Path:

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

If one person must access both production and test:

- keep `defaultClinicId: "clinic_main"` in the main user profile
- also add `users/{uid}/clinics/clinic_sync_test`

### 4. Keep rules as they are

Current rules already support this model:

- authenticated user required
- access only to assigned clinics
- no client writes to `users/{uid}` access documents

No rules change is required for go-live unless you want a different authorization model.

### 5. Pre-deploy checks

Before publishing:

1. login with one real production user
2. confirm landing on `clinic_main`
3. confirm existing animals/sessions/visits are visible
4. do **not** save test edits on real records during this check if you want zero production writes before launch
5. logout
6. login again with the test user and confirm `clinic_sync_test` still works

### 6. Publish

When the checks above are done:

1. publish the updated app
2. inform operators of their credentials
3. let them work on `clinic_main`

## Minimal Firestore Data To Create For Each Real User

Example with placeholders:

### `users/{uid}`

```json
{
  "displayName": "Nome Operatore",
  "role": "operator",
  "defaultClinicId": "clinic_main"
}
```

### `users/{uid}/clinics/clinic_main`

```json
{
  "active": true,
  "role": "operator",
  "label": "Clinica live",
  "defaultClinic": true
}
```

## Safety Notes

- this rollout does not require migrating the existing `clinic_main` medical data
- the new optional fields (`birthDate`, `bodyConditionScore`, sync metadata, etc.) are backward-compatible with the old data
- production data will only change when authenticated users start saving through the new version

## Suggested First Live Validation

After deploy, do one controlled validation with a real operator:

1. open app
2. login
3. open one known animal
4. verify historical data loads
5. save one intentional real update
6. verify sync indicator returns green
7. verify the same data from a second account or second browser session
