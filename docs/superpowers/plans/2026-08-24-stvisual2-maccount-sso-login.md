# stvisual2 maccount SSO Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stvisual2's login (Firebase Google sign-in) with maccount SSO, mirroring dsvisual, while disabling — not deleting — the Firebase-backed data features (settings sync, Teacher Dashboard, Drive) this round.

**Architecture:** One seam: `createCloudIntegrationClient()` returns a **maccount-SSO-backed adapter** that implements the full existing client surface — identity methods real (`getUser`/`subscribeAuthState`/`signIn`/`signOut`), data methods as null/no-op stubs — so every consumer keeps working unchanged. The Firebase client stays behind a `firebaseEnabled:false` flag. A ported `src/utils/maccountClient.js` singleton does the redirect/verify/session dance.

**Tech Stack:** Vanilla ES-module JS, Vitest (unit), Playwright (e2e), the shared maccount worker (`/auth/app/start`, `/api/app/verify`).

**Spec:** `docs/superpowers/specs/2026-08-24-stvisual2-maccount-sso-login-design.md`

## Global Constraints

- Port source (verbatim behavior): dsvisual `js/cloud-integration.js` + `tests/unit/cloud-integration.test.js`.
- sessionStorage key: `stvisual:maccount:user`. appId: `stvisual2`. Endpoints: `<base>/auth/app/start`, `<base>/api/app/verify`. Verify response shape: `{ student_id, providers: { github, google } }`.
- `stripMtoken` strips **only** `mtoken=` fragment segments; preserves the `?explorer=…` query (part of the base) and any other `#` app hash ([[dsvisual-sso-preserve-app-hash]]).
- Config placeholder style: `__MACCOUNT_WORKER_URL__` (injected at deploy, same as Firebase keys). `isPlaceholder = !v || /^__.+__$/.test(v)`.
- Firebase disabled this round: `getResolvedCloudConfig().firebaseEnabled === false` default; no Firestore/Drive calls fire.
- Keep `getAccessToken()` as a method returning `null` (stvisual2 callers invoke it — differs from dsvisual).
- After any bundled-source change, run `npm run build:standalone` and commit `src/standalone.js` (the `standalone-bundle` CI check enforces it).
- `main` push is allowed on stvisual2, but land this via a PR branch `feat/maccount-sso-login` (repo uses PRs; CI: unit-test, browser-test, standalone-bundle).

---

### Task 1: `maccountClient.js` — the SSO singleton

**Files:**
- Create: `src/utils/maccountClient.js`
- Test: `src/tests/maccountClient.test.js`

**Interfaces:**
- Consumes: `getResolvedCloudConfig()` from `src/config/cloudConfig.js` (Task 2 adds the `maccount` block; until then the test injects config directly).
- Produces: `export function getMaccountClient()` → singleton with `{ isConfigured, missingReason, getUser(), subscribeAuthState(cb)→unsub, signIn(), signOut(), handleRedirect()→Promise<bool> }`; and `export function stripMtoken(href, hash)` (pure, for tests). `getUser()` returns a normalized object `{ student_id, uid, displayName, providers:{github,google} }` or `null`. Also `export function __resetForTests()` to clear the singleton.

- [ ] **Step 1: Write the failing tests** (mirror dsvisual's suite)

```js
// src/tests/maccountClient.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMaccountClient, stripMtoken, __resetForTests } from '../utils/maccountClient.js';
import * as cfg from '../config/cloudConfig.js';

const BASE = 'https://maccount.example';
function mockConfig(maccount) {
  vi.spyOn(cfg, 'getResolvedCloudConfig').mockReturnValue({
    firebase: {}, drive: {}, firebaseEnabled: false,
    maccount: maccount ?? { workerBaseUrl: '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' },
  });
}
beforeEach(() => { __resetForTests(); sessionStorage.clear(); vi.restoreAllMocks();
  Object.defineProperty(window, 'location', { writable: true,
    value: new URL('https://app.example/?explorer=graph-coverage') }); });

describe('stripMtoken', () => {
  it('strips only mtoken, keeps query + app hash', () => {
    expect(stripMtoken('https://a/?explorer=x#m=insert#mtoken=T', '#m=insert#mtoken=T'))
      .toBe('https://a/?explorer=x#m=insert');
    expect(stripMtoken('https://a/?explorer=x#mtoken=T', '#mtoken=T'))
      .toBe('https://a/?explorer=x');
  });
});

describe('unconfigured', () => {
  it('placeholder -> stub, getUser null, signIn no-op', () => {
    mockConfig({ workerBaseUrl: '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' });
    const c = getMaccountClient();
    expect(c.isConfigured).toBe(false);
    expect(c.getUser()).toBe(null);
    expect(() => c.signIn()).not.toThrow();
  });
});

describe('configured', () => {
  beforeEach(() => mockConfig({ workerBaseUrl: BASE, appId: 'stvisual2' }));

  it('signIn redirects to /auth/app/start with app + encoded return', () => {
    const assign = vi.fn();
    window.location = { href: 'https://app.example/?explorer=x', protocol: 'https:', hash: '', assign };
    getMaccountClient().signIn();
    expect(assign).toHaveBeenCalledWith(
      BASE + '/auth/app/start?app=stvisual2&return=' + encodeURIComponent('https://app.example/?explorer=x'));
  });

  it('handleRedirect: #mtoken -> verify -> getUser set + fragment stripped', async () => {
    const replaceState = vi.fn();
    window.history.replaceState = replaceState;
    window.location = { href: 'https://app.example/?explorer=x#mtoken=T', protocol: 'https:',
                        hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ student_id: '0856001', providers: { github: true, google: false } }) });
    const ok = await getMaccountClient().handleRedirect();
    expect(ok).toBe(true);
    expect(getMaccountClient().getUser().student_id).toBe('0856001');
    expect(replaceState).toHaveBeenCalled();
  });

  it('verify failure leaves user null', async () => {
    window.location = { href: 'https://a/#mtoken=T', protocol: 'https:', hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    expect(await getMaccountClient().handleRedirect()).toBe(false);
    expect(getMaccountClient().getUser()).toBe(null);
  });

  it('no #mtoken -> no-op false', async () => {
    window.location = { href: 'https://a/?explorer=x', protocol: 'https:', hash: '', assign: vi.fn() };
    expect(await getMaccountClient().handleRedirect()).toBe(false);
  });

  it('signOut clears user + notifies', async () => {
    window.location = { href: 'https://a/#mtoken=T', protocol: 'https:', hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ student_id: 'S', providers: {} }) });
    const c = getMaccountClient(); await c.handleRedirect();
    const seen = []; c.subscribeAuthState(u => seen.push(u));
    c.signOut();
    expect(c.getUser()).toBe(null);
    expect(seen[seen.length - 1]).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/maccountClient.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/utils/maccountClient.js`** (ESM port of dsvisual)

```js
import { getResolvedCloudConfig } from '../config/cloudConfig.js';

const USER_KEY = 'stvisual:maccount:user';
let cachedClient = null;

const isPlaceholder = (v) => !v || /^__.+__$/.test(v);

export function stripMtoken(href, hash) {
  const base = href.replace(/#.*$/, '');
  const segs = (hash || '').replace(/^#/, '').split(/[#&]/).filter((s) => s && !/^mtoken=/.test(s));
  return segs.length ? base + '#' + segs.join('&') : base;
}

function stubClient(reason) {
  return { isConfigured: false, missingReason: reason,
    getUser: () => null,
    subscribeAuthState(cb) { cb(null); return () => {}; },
    signIn() {}, signOut() {}, handleRedirect: () => Promise.resolve(false) };
}

function buildClient() {
  const cfg = getResolvedCloudConfig().maccount || null;
  if (typeof location !== 'undefined' && location.protocol === 'file:')
    return stubClient('Sign-in requires http(s), not file://.');
  if (!cfg || isPlaceholder(cfg.workerBaseUrl))
    return stubClient('maccount worker URL not configured.');

  const base = cfg.workerBaseUrl.replace(/\/$/, '');
  const appId = cfg.appId || 'stvisual2';
  const subs = [];
  let redirectPromise = null;

  const readUser = () => {
    try { const raw = sessionStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };
  let user = readUser();
  const setUser = (u) => {
    user = u;
    try { u ? sessionStorage.setItem(USER_KEY, JSON.stringify(u)) : sessionStorage.removeItem(USER_KEY); } catch {}
    subs.forEach((cb) => { try { cb(user); } catch {} });
  };

  async function runRedirect() {
    const hash = location.hash || '';
    const m = hash.match(/[#&]mtoken=([^&]+)/);
    if (!m) return false;
    let res;
    try {
      res = await fetch(base + '/api/app/verify', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: decodeURIComponent(m[1]) }) });
    } catch { return false; }
    if (!res || !res.ok) return false;
    let data; try { data = await res.json(); } catch { return false; }
    if (!data || !data.student_id) return false;
    try { history.replaceState(null, '', stripMtoken(location.href, location.hash)); } catch {}
    setUser({ student_id: data.student_id, uid: data.student_id, displayName: data.student_id,
      providers: { github: !!(data.providers && data.providers.github),
                   google: !!(data.providers && data.providers.google) } });
    return true;
  }

  return { isConfigured: true, missingReason: '',
    getUser: () => user,
    subscribeAuthState(cb) { subs.push(cb); try { cb(user); } catch {}
      return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    signIn() { location.assign(base + '/auth/app/start?app=' + encodeURIComponent(appId)
      + '&return=' + encodeURIComponent(location.href)); },
    signOut() { setUser(null); },
    handleRedirect() {
      if (!redirectPromise) redirectPromise = runRedirect().then((ok) => { if (!ok) redirectPromise = null; return ok; });
      return redirectPromise;
    } };
}

export function getMaccountClient() { return (cachedClient ||= buildClient()); }
export function __resetForTests() { cachedClient = null; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/maccountClient.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/maccountClient.js src/tests/maccountClient.test.js
git commit -m "feat(auth): maccount SSO client (ported from dsvisual)"
```

---

### Task 2: Config — `maccount` block + `firebaseEnabled` + judge base

**Files:**
- Modify: `src/config/cloudConfig.js`
- Test: `src/tests/cloudConfig.maccount.test.js`

**Interfaces:**
- Produces: `getResolvedCloudConfig()` returns `{ firebase, drive, maccount:{workerBaseUrl,appId}, firebaseEnabled:boolean }`; exported constant `export const JUDGE_FRONTEND_BASE = 'https://ds2026summer.cs.nycu.edu.tw';`. Runtime override via `globalThis.STVISUAL_CLOUD_CONFIG.maccount` and `.firebaseEnabled`.

- [ ] **Step 1: Write the failing test**

```js
// src/tests/cloudConfig.maccount.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { getResolvedCloudConfig, JUDGE_FRONTEND_BASE } from '../config/cloudConfig.js';

afterEach(() => { delete globalThis.STVISUAL_CLOUD_CONFIG; });

it('defaults: maccount placeholder, firebase disabled', () => {
  const c = getResolvedCloudConfig();
  expect(c.maccount.appId).toBe('stvisual2');
  expect(c.maccount.workerBaseUrl).toMatch(/^__.*__$/);
  expect(c.firebaseEnabled).toBe(false);
});
it('runtime override merges maccount + firebaseEnabled', () => {
  globalThis.STVISUAL_CLOUD_CONFIG = { maccount: { workerBaseUrl: 'https://m.example' }, firebaseEnabled: true };
  const c = getResolvedCloudConfig();
  expect(c.maccount.workerBaseUrl).toBe('https://m.example');
  expect(c.maccount.appId).toBe('stvisual2');   // kept from base
  expect(c.firebaseEnabled).toBe(true);
});
it('exposes the judge frontend base', () => {
  expect(JUDGE_FRONTEND_BASE).toBe('https://ds2026summer.cs.nycu.edu.tw');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/cloudConfig.maccount.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/config/cloudConfig.js`**

Add to the `cloudConfig` object a `maccount: { workerBaseUrl: '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' }` block and `firebaseEnabled: false`. Add the export:

```js
export const JUDGE_FRONTEND_BASE = 'https://ds2026summer.cs.nycu.edu.tw';
```

In `getResolvedCloudConfig()` merge maccount + firebaseEnabled from `runtimeConfig`:

```js
return {
  ...cloudConfig,
  ...runtimeConfig,
  firebase: { ...cloudConfig.firebase, ...(runtimeConfig.firebase || {}) },
  drive: { ...cloudConfig.drive, ...(runtimeConfig.drive || {}) },
  maccount: { ...cloudConfig.maccount, ...(runtimeConfig.maccount || {}) },
  firebaseEnabled: runtimeConfig.firebaseEnabled ?? cloudConfig.firebaseEnabled,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/cloudConfig.maccount.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/cloudConfig.js src/tests/cloudConfig.maccount.test.js
git commit -m "feat(config): maccount block, firebaseEnabled flag, judge base"
```

---

### Task 3: Factory dispatch — `createCloudIntegrationClient()` returns the maccount adapter

**Files:**
- Modify: `src/utils/cloudIntegration.js`
- Test: `src/tests/cloudIntegration.test.js` (extend)

**Interfaces:**
- Consumes: `getMaccountClient()` (T1), `getResolvedCloudConfig().firebaseEnabled` (T2).
- Produces: when `firebaseEnabled === false` (default), `createCloudIntegrationClient()` returns an adapter with the **full existing surface** — real identity, stubbed data: `getUser()`, `getAccessToken()`→`null`, `subscribeAuthState(cb)`→unsub, `signIn()` (new) + `signInWithGoogle()` alias→`signIn()`, `signOut()`+`signOutGoogle()` alias, and `loadSettings/saveSettings/loadLogicRecent/saveLogicRecent/loadSyntaxTests/saveSyntaxTests`→resolve `{}`/no-op, `uploadFileToDrive`→rejected "disabled". Exposes `isMaccount: true`.

- [ ] **Step 1: Write the failing test**

```js
// add to src/tests/cloudIntegration.test.js
import { createCloudIntegrationClient } from '../utils/cloudIntegration.js';
import * as maccount from '../utils/maccountClient.js';
import * as cfg from '../config/cloudConfig.js';
import { vi, it, expect } from 'vitest';

it('firebase disabled -> maccount adapter with stubbed data methods', async () => {
  vi.spyOn(cfg, 'getResolvedCloudConfig').mockReturnValue({
    firebase: {}, drive: {}, firebaseEnabled: false,
    maccount: { workerBaseUrl: 'https://m.example', appId: 'stvisual2' } });
  vi.spyOn(maccount, 'getMaccountClient').mockReturnValue({
    isConfigured: true, getUser: () => ({ student_id: 'S', uid: 'S' }),
    subscribeAuthState: (cb) => { cb({ uid: 'S' }); return () => {}; },
    signIn: vi.fn(), signOut: vi.fn(), handleRedirect: async () => false });
  const c = createCloudIntegrationClient();
  expect(c.isMaccount).toBe(true);
  expect(c.getUser().uid).toBe('S');
  expect(c.getAccessToken()).toBe(null);
  await expect(c.loadSettings('S')).resolves.toEqual({});   // no-op, no Firestore
  expect(() => c.signInWithGoogle()).not.toThrow();          // alias -> signIn
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/cloudIntegration.test.js`
Expected: FAIL (adapter/dispatch not present).

- [ ] **Step 3: Implement dispatch at the top of `createCloudIntegrationClient()`**

Before the Firebase branch:

```js
import { getMaccountClient } from './maccountClient.js';
// ...
export function createCloudIntegrationClient() {
  const config = getResolvedCloudConfig();
  if (!config.firebaseEnabled) {
    const m = getMaccountClient();
    const noop = async () => ({});
    return {
      isMaccount: true, isConfigured: m.isConfigured, missingReason: m.missingReason,
      getUser: () => m.getUser(),
      getAccessToken: () => null,
      subscribeAuthState: (cb) => m.subscribeAuthState(cb),
      signIn: () => m.signIn(),
      signInWithGoogle: () => m.signIn(),      // drop-in alias; navigates away
      signOut: () => m.signOut(),
      signOutGoogle: () => m.signOut(),
      handleRedirect: () => m.handleRedirect(),
      loadSettings: noop, saveSettings: noop,
      loadLogicRecent: async () => [], saveLogicRecent: noop,
      loadSyntaxTests: noop, saveSyntaxTests: noop,
      uploadFileToDrive: async () => { throw new Error('cloud upload disabled'); },
    };
  }
  // ---- existing Firebase implementation below (unchanged) ----
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/cloudIntegration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/cloudIntegration.js src/tests/cloudIntegration.test.js
git commit -m "feat(auth): route cloud client to maccount adapter when firebase disabled"
```

---

### Task 4: Login UI wiring + boot redirect

**Files:**
- Modify: `src/components/CloudStoragePanel.js` (sign-in button → `signIn()`, label), `src/components/SlideViewer.js` (sign-in row → `signIn()`), the app entry (`src/main.js` or `src/app.js`) to call `handleRedirect()` on boot.
- Test: `src/tests/CloudStoragePanel.maccount.test.jsx`

**Interfaces:**
- Consumes: `createCloudIntegrationClient()` adapter (T3).

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/CloudStoragePanel.maccount.test.jsx
import { it, expect, vi } from 'vitest';
import * as ci from '../utils/cloudIntegration.js';
import { renderCloudStoragePanel } from '../components/CloudStoragePanel.js'; // adjust to actual export

it('sign-in button triggers maccount signIn (no popup)', () => {
  const signIn = vi.fn();
  vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue({
    isMaccount: true, isConfigured: true, getUser: () => null,
    subscribeAuthState: (cb) => { cb(null); return () => {}; },
    signIn, signInWithGoogle: signIn, getAccessToken: () => null });
  const root = document.createElement('div'); document.body.append(root);
  renderCloudStoragePanel(root);
  root.querySelector('[data-testid="cloud-signin-btn"]').click();
  expect(signIn).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/CloudStoragePanel.maccount.test.jsx`
Expected: FAIL (button still calls `signInWithGoogle` popup path / label mismatch).

- [ ] **Step 3: Implement**

- `CloudStoragePanel.js`: the `cloud-signin-btn` click handler (≈line 177) calls `client.signIn()` (no `await`, it navigates away). Button label key → `common.maccountSignIn` ("以 NYCU 帳號登入"); add that i18n key (en/zh) in `src/i18n/dict.js`.
- `SlideViewer.js`: the `slideviewer-signin-row` click (≈line 164) calls `client.signIn()`.
- App entry (`src/main.js`): after building the client once, call `createCloudIntegrationClient().handleRedirect()` at startup so a returning `#mtoken` is exchanged before UI reads `getUser()`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/CloudStoragePanel.maccount.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CloudStoragePanel.js src/components/SlideViewer.js src/main.js src/i18n/dict.js src/tests/CloudStoragePanel.maccount.test.jsx
git commit -m "feat(auth): wire sign-in UI + boot redirect to maccount SSO"
```

---

### Task 5: Hide Firebase-only UI while disabled

**Files:**
- Modify: `src/components/TeacherDashboard.js`, `src/components/CloudStoragePanel.js` (data actions), `src/components/SlideViewer.js` (Drive upload affordance)
- Test: `src/tests/firebaseDisabled.test.jsx`

**Interfaces:**
- Consumes: the adapter's `isMaccount` / `getAccessToken()===null` capability signal (T3).

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/firebaseDisabled.test.jsx
import { it, expect, vi } from 'vitest';
import * as ci from '../utils/cloudIntegration.js';
import { openTeacherDashboard } from '../components/TeacherDashboard.js'; // adjust to actual export

it('teacher dashboard shows a disabled notice under maccount', () => {
  vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue({
    isMaccount: true, getUser: () => ({ uid: 'S' }), getAccessToken: () => null,
    subscribeAuthState: (cb) => { cb({ uid: 'S' }); return () => {}; } });
  const root = document.createElement('div'); document.body.append(root);
  openTeacherDashboard(root);
  expect(root.textContent).toMatch(/unavailable|停用|disabled/i);
  expect(root.querySelector('[data-testid="teacher-dashboard-live]')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tests/firebaseDisabled.test.jsx`
Expected: FAIL (dashboard still tries Firestore).

- [ ] **Step 3: Implement capability gates**

- `TeacherDashboard.js`: if `client.isMaccount` (or `client.getAccessToken() == null`), render a short "class-results dashboard is temporarily unavailable" notice (i18n key `dashboard.disabled`) and **do not** call any Firestore method.
- `CloudStoragePanel.js`: hide the cloud data actions (save/load/upload); keep only the auth chip (sign-in / signed-in-as) when `isMaccount`.
- `SlideViewer.js`: hide the Drive-upload affordance when `getAccessToken() == null` (private slides show a "sign-in only" state, no upload).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tests/firebaseDisabled.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TeacherDashboard.js src/components/CloudStoragePanel.js src/components/SlideViewer.js src/i18n/dict.js src/tests/firebaseDisabled.test.jsx
git commit -m "feat(auth): hide Firebase-only UI while data features disabled"
```

---

### Task 6: Rebuild standalone bundle, full test run, PR

**Files:**
- Modify: `src/standalone.js` (regenerated)

- [ ] **Step 1: Regenerate the standalone bundle**

Run: `npm run build:standalone`
Expected: "Built standalone bundle at src/standalone.js"; `git diff --stat src/standalone.js` shows the auth changes.

- [ ] **Step 2: Full local suites green**

Run:
```bash
npm run test           # Vitest unit
npm run build:quiz && npm run build:labs   # if these regenerate committed data, ensure no drift
npx playwright test    # e2e (or `npm run test:e2e`)
```
Expected: all pass; no uncommitted regenerated files besides intended ones.

- [ ] **Step 3: Commit + push branch + PR**

```bash
git add src/standalone.js
git commit -m "build: regenerate standalone bundle for maccount SSO login"
git push -u origin feat/maccount-sso-login
gh pr create --base main --head feat/maccount-sso-login \
  --title "feat(auth): maccount SSO login (replace Firebase login; data features deferred)" \
  --body "Implements docs/superpowers/specs/2026-08-24-stvisual2-maccount-sso-login-design.md. Login now uses maccount SSO (ported from dsvisual); Firebase data features (settings sync, Teacher Dashboard, Drive) disabled behind firebaseEnabled=false, code retained. 🤖 Generated with Claude Code"
```

- [ ] **Step 4: Confirm CI green on the PR**

Run: `gh pr checks --repo skhuang/stvisual2` (for the new PR)
Expected: unit-test, browser-test, standalone-bundle all pass.

---

## Final verification (whole feature)

- [ ] Signed-out → Sign in → maccount `/auth/app/start` → return to the **same** `?explorer=…` URL, no `mtoken` left, app hash intact → auth chip shows 學號.
- [ ] `getMaccountClient` unit suite green (signIn URL, verify+strip, query/hash preservation, failure→null, signOut).
- [ ] `createCloudIntegrationClient()` returns the maccount adapter; `getAccessToken()===null`; data methods no-op; `signInWithGoogle` aliases `signIn`.
- [ ] No Firestore/Drive network call fires in a session (devtools/spy).
- [ ] Teacher Dashboard / Drive upload show disabled state, no Firestore calls.
- [ ] `standalone-bundle`, unit-test, browser-test all green on the PR.
- [ ] `file://` + unconfigured builds fall back to the stub client (no errors).

## Out of scope (next steps)

- Lab link-out button (LabViewer → `${JUDGE_FRONTEND_BASE}/bank/<pid>`, mirroring dsvisual's `dsjudgeControlHtml`); revising stvisual2 #11's in-page upload; closing dsjudge #229.
- Re-homing the Firebase data features (settings sync, Teacher Dashboard, Drive) onto a new backend.

## Self-Review notes

- **Spec coverage:** SSO client→T1; config/appId/judge-base→T2; single-seam dispatch + keep `getAccessToken`→T3; login UI + boot redirect→T4; disable Firebase UI→T5; standalone rebuild + tests + PR→T6. Non-goals (link-out, data re-homing) preserved.
- **Placeholder scan:** real code throughout; UI-copy/i18n keys are described with the exact key names, not left vague. `__MACCOUNT_WORKER_URL__` is the intended injected placeholder.
- **Type consistency:** `getMaccountClient()` API (getUser/subscribeAuthState/signIn/signOut/handleRedirect) from T1 is consumed verbatim by T3's adapter; the adapter's surface (getUser/getAccessToken/subscribeAuthState/signIn/signInWithGoogle/signOut/signOutGoogle/load*/save*/uploadFileToDrive/isMaccount) matches the existing caller expectations found in CloudStoragePanel/SlideViewer/TeacherDashboard/Logic+Syntax explorers; `getResolvedCloudConfig()` shape (maccount, firebaseEnabled) defined in T2 is read in T1/T3; `stripMtoken(href, hash)` signature consistent T1↔tests.
- **Caveat for executor:** exact function export names in `CloudStoragePanel.js`/`TeacherDashboard.js` (T4/T5 test imports `renderCloudStoragePanel`/`openTeacherDashboard`) must be matched to the files' real exports — read the file and adjust the import/handler names; the behavior asserted is what matters.
