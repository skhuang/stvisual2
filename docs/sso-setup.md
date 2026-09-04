# maccount SSO login — setup

stvisual2 signs students in with **maccount SSO** (the same worker dsvisual uses).
The client is `src/utils/maccountClient.js`; its worker URL is injected into
`src/config/cloudConfig.js` at build time from the `MACCOUNT_WORKER_URL`
environment variable (via `scripts/inject-env.mjs`).

**If it is not configured, login is a harmless no-op** — the SSO client falls back
to a stub, the sign-in button does nothing, and the rest of the app works.

## 1. Register the app on the maccount worker

The maccount worker must know this app id and allow it to return to the site's
origin. Register (or confirm) on the maccount side:

- **app id:** `stvisual2` (this is `cloudConfig.maccount.appId`; keep in sync).
- **allowed return origin:** the GitHub Pages origin — `https://skhuang.github.io`
  (the app returns to `https://skhuang.github.io/stvisual2/…`).
- For **local development**, also allow `http://localhost:<port>` (whatever
  `npm run dev` / the preview server uses).

The sign-in flow is: `signIn()` → `<worker>/auth/app/start?app=stvisual2&return=<href>`
→ maccount authenticates → returns to `<href>#…mtoken=<token>` → the client POSTs
the token to `<worker>/api/app/verify`. So the worker must accept `app=stvisual2`
and the return origin above.

## 2. Set the worker URL for the build

`MACCOUNT_WORKER_URL` is **not a secret** — it is a public URL, so it lives as a
GitHub Actions **Variable**, not a Secret.

- GitHub → the stvisual2 repo → **Settings → Secrets and variables → Actions →
  Variables → New repository variable**:
  - **Name:** `MACCOUNT_WORKER_URL`
  - **Value:** the maccount worker base URL, e.g.
    `https://maccount-api.skhuang.workers.dev`

`deploy-pages.yml` passes it as `MACCOUNT_WORKER_URL: ${{ vars.MACCOUNT_WORKER_URL }}`,
and `inject-env` writes it into `cloudConfig.js` during `npm run pages:build`.

> Leaving the variable unset builds fine — login stays a stub until it is set.

## 3. Local development

Copy `.env.example` → `.env` and set:

```
MACCOUNT_WORKER_URL=https://maccount-api.skhuang.workers.dev
```

`scripts/inject-env.mjs` reads `.env` (without overriding real `process.env`) and
injects it into `cloudConfig.js`. Make sure your dev origin is in the worker's
allowed-return list (step 1).

## 4. Verify

After a deploy (or a local build with the variable set):

- `src/config/cloudConfig.js` in the built output has
  `maccount.workerBaseUrl` = the real URL, not `__MACCOUNT_WORKER_URL__`.
- On the live site, signed-out → **Sign in** → you're redirected to maccount,
  then back to the **same** page (URL preserved, `mtoken` stripped) and the
  auth chip shows your 學號.
- If the button does nothing: the variable is unset/empty (stub), the app id
  isn't registered, or the return origin isn't allow-listed on the worker.

## Notes

- The worker URL is shared with **dsvisual** (`MACCOUNT_WORKER_URL =
  https://maccount-api.skhuang.workers.dev`); only the **app id** differs
  (`stvisual2` vs `dsvisual`).
- Firebase data features (settings sync, Teacher Dashboard, Drive) are disabled
  in this build (`cloudConfig.firebaseEnabled = false`); SSO provides identity
  only. See `docs/superpowers/specs/2026-08-24-stvisual2-maccount-sso-login-design.md`.
