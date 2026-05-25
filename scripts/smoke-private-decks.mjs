#!/usr/bin/env node
// Smoke-test the private-slides Drive integration without spinning up the
// browser stack. Imports the real `fetchPrivateDecks` module and exercises
// it against your Drive folder using an OAuth access token you supply.
//
// Useful for debugging Drive-side issues — manifest typos, share-list misconfig,
// missing files — without the noise of a browser flow.
//
// Usage:
//   1) Get an access token with the drive.readonly scope. Easiest:
//        export DRIVE_ACCESS_TOKEN=$(gcloud auth print-access-token \
//          --scopes=https://www.googleapis.com/auth/drive.readonly)
//      (Run `gcloud auth login --enable-gdrive-access` once first if needed.)
//      OR paste a token from your browser's devtools after signing in via the
//      cloud drawer — DevTools → Application → Local Storage isn't where it
//      lives, but you can grab it from a `fetch` to drive.googleapis.com in
//      the Network tab.
//
//   2) Either set DRIVE_PRIVATE_SLIDES_FOLDER_ID in your .env (the same one
//      inject-env reads) or export it directly.
//
//   3) node scripts/smoke-private-decks.mjs
//
// The script reads .env (without overriding existing process.env), validates
// the inputs, calls fetchPrivateDecks, and pretty-prints the deck list.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env if present (does NOT override existing process.env).
try {
  const dotenv = await readFile(path.join(projectRoot, '.env'), 'utf8');
  for (const line of dotenv.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // No .env — rely on process.env.
}

const accessToken = (process.env.DRIVE_ACCESS_TOKEN || '').trim();
const folderId = (process.env.DRIVE_PRIVATE_SLIDES_FOLDER_ID || '').trim();

if (!accessToken) {
  console.error('❌ DRIVE_ACCESS_TOKEN is not set.');
  console.error('   Run `gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/drive.readonly`');
  console.error('   and export the result, or paste a token from the browser.');
  process.exit(1);
}
if (!folderId) {
  console.error('❌ DRIVE_PRIVATE_SLIDES_FOLDER_ID is not set (in .env or env).');
  process.exit(1);
}
if (/^__.+__$/.test(folderId)) {
  console.error(`❌ DRIVE_PRIVATE_SLIDES_FOLDER_ID is still a placeholder: ${folderId}`);
  console.error('   Set the real Drive folder ID.');
  process.exit(1);
}

const { fetchPrivateDecks } = await import(path.join(projectRoot, 'src/utils/privateDecks.js'));

console.log(`[smoke] Fetching manifest from folder ${folderId.slice(0, 8)}…`);
const decks = await fetchPrivateDecks({ accessToken, folderId });

if (decks.length === 0) {
  console.log('[smoke] No decks returned. Possible causes:');
  console.log('         • The folder is not shared with this Google account.');
  console.log('         • private-decks.json is missing from the folder.');
  console.log('         • The access token lacks the drive.readonly scope.');
  process.exit(0);
}

console.log(`[smoke] Found ${decks.length} deck entr${decks.length === 1 ? 'y' : 'ies'}:`);
for (const d of decks) {
  const icon = d.access === 'ok' ? '✓' : d.access === 'denied' ? '✗' : '!';
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const meta = `EN ${d.en.length}c · ZH ${d.zh.length}c`;
  console.log(
    `  ${icon} ${pad(d.id, 28)} section=${pad(d.section, 18)} access=${pad(d.access, 7)} ${meta}`,
  );
  if (d.access !== 'ok') {
    if (d.access === 'denied') {
      console.log(`     → file(s) missing from folder, or one file is unshared`);
    } else if (d.access === 'error') {
      console.log(`     → network error during fetch — retry, or check the folder is reachable`);
    }
  }
}
console.log('[smoke] Done.');
