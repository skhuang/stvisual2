# stvisual2 — maccount SSO Login (replace Firebase login)

**Date:** 2026-08-24
**Status:** Approved design → spec for review
**Reference implementation:** dsvisual `js/cloud-integration.js` + `js/cloud-config.js` (maccount SSO singleton) and `tests/unit/cloud-integration.test.js`
**Related:** [[dsvisual-sso-preserve-app-hash]] — return URL is `#m=method#mtoken=token`; strip only `mtoken`, keep the app hash.

## Goal

Replace stvisual2's login mechanism (Firebase Google sign-in) with **maccount
SSO**, mirroring dsvisual, so a signed-in identity is available (the prerequisite
for the future "Practice on judge" link-out). **This round changes only the
login.** The Firebase-backed data features (per-user settings sync, the Firestore
Teacher Dashboard / class results, Google Drive upload) are **disabled behind a
flag** — code kept, not deleted — pending a later data-backend decision.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Login mechanism | maccount SSO (port dsvisual's client) |
| Firebase data features (settings sync, Teacher Dashboard, Drive) | **Disabled this round**, behind a config flag; code retained |
| Integration seam | `createCloudIntegrationClient()` returns the maccount client when maccount is configured |
| appId | `"stvisual2"` (register in maccount); worker URL shared with dsvisual |
| Judge frontend host | record `https://ds2026summer.cs.nycu.edu.tw` as a constant now; the lab link-out button is a **separate follow-up** |

## Architecture — the single seam

Every cloud consumer imports one factory: `createCloudIntegrationClient()` from
`src/utils/cloudIntegration.js` (callers: `SyntaxCoverageExplorer.js`,
`LogicCoverageExplorer.js`, `SlideViewer.js`, `TeacherDashboard.js`,
`CloudStoragePanel.js`, `MutationScoreExplorer.js`, …). The migration changes
**what that factory returns**, so callers are largely untouched:

- When `maccount.workerBaseUrl` is configured → return a **maccount SSO client**
  exposing the identity API **plus null/no-op stubs** for the data methods every
  caller already invokes (`getAccessToken()` → `null`, settings load/save →
  resolved no-ops), so no consumer throws.
- The existing Firebase client code stays in the file behind
  `getResolvedCloudConfig().firebaseEnabled` (default **off**); it is not the
  default path this round.

Note vs dsvisual: dsvisual's client deliberately has **no** `getAccessToken`/
Drive surface; stvisual2's must **keep** those method names (returning null),
because existing callers (e.g. `SlideViewer.getAccessToken()`) call them.

## The maccount SSO client (port of dsvisual)

New module `src/utils/maccountClient.js`, a singleton mirroring dsvisual's:

- **Config**: `getResolvedCloudConfig().maccount = { workerBaseUrl, appId }`.
  `workerBaseUrl` is `__MACCOUNT_WORKER_URL__` (placeholder, injected at deploy
  like the Firebase keys); `appId` defaults to `"stvisual2"`.
- **sessionStorage key**: `stvisual:maccount:user`.
- **Stub client** (no-op, `getUser()`→null, `signIn()` no-op) when unconfigured
  (`__…__` placeholder) or on `location.protocol === 'file:'`.
- **API**:
  - `getUser()` → the stored user object or `null`.
  - `subscribeAuthState(cb)` → calls `cb(user)` immediately + on change; returns
    an unsubscribe fn.
  - `signIn()` → `location.assign(base + '/auth/app/start?app=' +
    encodeURIComponent(appId) + '&return=' + encodeURIComponent(location.href))`.
  - `signOut()` → clear sessionStorage + notify subscribers `cb(null)`.
  - `handleRedirect()` → memoized: read `#…mtoken=…` from `location.hash`; if
    present, POST `{ token }` to `base + '/api/app/verify'`; on success store the
    normalized user + notify; then `history.replaceState` the URL with the
    `mtoken` fragment stripped (see below). Returns a promise; memo cleared on
    failure so a retry can re-run (dsvisual behavior).
  - **Identity-only extras** consumed by stvisual2 callers, stubbed:
    `getAccessToken()` → `null`; any `loadSettings*/saveSettings*` → resolved
    no-ops.
- **`stripMtoken(href, hash)`**: fragments may mix `#`/`&` (return arrives as
  `…#m=method#mtoken=token`); split on `[#&]`, drop only segments matching
  `^mtoken=`, rejoin the rest with `&`. **The query string (`?explorer=…`) is
  part of `href`'s base and is preserved untouched** — this is the app-state
  preservation the gotcha is about.

## Data flow

1. User clicks Sign in → `client.signIn()` → browser leaves for the maccount
   worker's `/auth/app/start` (carries `return=<current full URL incl. query>`).
2. maccount authenticates (NYCU), redirects back to `return` with
   `#m=<method>#mtoken=<token>` appended.
3. On boot, `app.js` calls `client.handleRedirect()` → token verified at
   `/api/app/verify` → user stored in `sessionStorage` → subscribers notified →
   URL cleaned (mtoken stripped, `?explorer=` + app hash preserved).
4. `getUser()` / `subscribeAuthState` now report the signed-in 學號; the sign-in
   button flips to a "signed in as …" chip.

## Wiring changes

- `src/app.js` (or the boot path): call `client.handleRedirect()` once at
  startup.
- The sign-in UI (currently invoking Firebase `signInWithGoogle`) calls
  `client.signIn()`; the auth chip reads `client.getUser()` /
  `subscribeAuthState`.
- **Hide/disable Firebase-only UI** while `firebaseEnabled` is off:
  `TeacherDashboard.js` (and its `stvisual:open-teacher-dashboard` entry point),
  `CloudStoragePanel.js`, and `SlideViewer.js`'s Drive-upload affordance — gate
  each on a capability check (`client.getAccessToken() != null` or a
  `client.hasData` flag) so they render nothing / a "sign-in only" state rather
  than erroring.
- Explorers that call `subscribeAuthState` for **settings sync**
  (`SyntaxCoverageExplorer.js:714`, `LogicCoverageExplorer.js:1156`) keep
  subscribing (they get the maccount user) but the load/save calls resolve to
  no-ops this round.

## Config + build

- `src/config/cloudConfig.js`: add a `maccount: { workerBaseUrl:
  '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' }` block and thread it through
  `getResolvedCloudConfig()` (merge with `globalThis.STVISUAL_CLOUD_CONFIG.maccount`),
  plus a `firebaseEnabled: false` default.
- Deploy injects the real `workerBaseUrl` (same maccount worker dsvisual uses).
- **Regenerate `src/standalone.js`** via `npm run build:standalone` — the auth
  change touches bundled source; the `standalone-bundle` CI check fails otherwise.
- Record `JUDGE_FRONTEND_BASE = 'https://ds2026summer.cs.nycu.edu.tw'` as a
  constant (e.g. in `cloudConfig.js`) for the follow-up link-out; not wired to UI
  this round.

## Testing

- New `src/tests/maccountClient.test.js`, mirroring dsvisual's
  `tests/unit/cloud-integration.test.js`:
  1. `signIn` redirects to `/auth/app/start` with `app=stvisual2` + encoded return.
  2. `handleRedirect`: `#mtoken` → verify POST → `getUser()` set → fragment stripped.
  3. **preserves a pre-existing app hash AND `?explorer=` query, strips only mtoken.**
  4. provider/user-field normalization (drop unknown fields).
  5. memoizes the in-flight exchange across concurrent calls.
  6. retries after a failed exchange (memo cleared on failure only).
  7. swallows a malformed `#mtoken` without throwing.
  8. verify failure leaves user null.
  9. `signOut` clears the user and notifies.
  10. not configured → stub; `getUser()` null; `signIn()` no-op.
  11. `getAccessToken()` returns `null` (kept as a method, unlike dsvisual).
- Update `src/tests/cloudIntegration.test.js` + the `*.cloud.test.jsx` explorer
  tests so the disabled-Firebase path asserts **no Firestore/Drive calls fire**
  and settings save/load are no-ops.
- `npm run test` (Vitest) + `npm run test:e2e` (Playwright) green; `standalone-bundle`
  green after rebuild.

## Non-goals (explicit follow-ups)

- **The lab link-out** (LabViewer → `${JUDGE_FRONTEND_BASE}/bank/<pid>`, mirroring
  dsvisual's `dsjudgeControlHtml`) — the next spec/PR after login lands. Revising
  the in-page "Submit tests" upload from stvisual2 #11 belongs there.
- **Closing dsjudge #229** (cross-origin CORS) — unnecessary under the same-origin
  link-out model; handled when the link-out lands.
- **Re-homing the Firebase data features** (settings sync, Teacher Dashboard,
  Drive) onto a new backend — a later, separate project.
- No change to the maccount worker itself (reuse dsvisual's endpoints
  `/auth/app/start`, `/api/app/verify`); just register a `stvisual2` app id.

## Verification

- Signed-out → click Sign in → maccount → back to the **same explorer/URL** (query
  + hash intact, no `mtoken` left) → auth chip shows the 學號.
- No Firestore/Drive network calls occur in a session (verify via devtools /
  test spies).
- All Vitest + Playwright suites pass; `standalone-bundle` passes.
- `file://` and unconfigured builds fall back to the stub client (no errors).
