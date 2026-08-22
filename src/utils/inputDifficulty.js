// Global "random-input difficulty" state, shape mirrors src/i18n/index.js.
const STORAGE_KEY = 'stvisual:input-difficulty';
export const INPUT_DIFFICULTIES = ['normal', 'special', 'edge', 'large'];
const DEFAULT = 'normal';

let current = (() => {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved && INPUT_DIFFICULTIES.includes(saved)) return saved;
  } catch {}
  return DEFAULT;
})();

const listeners = new Set();

export function getInputDifficulty() { return current; }

export function setInputDifficulty(tier, { persist = true } = {}) {
  if (!INPUT_DIFFICULTIES.includes(tier) || tier === current) return;
  current = tier;
  if (persist) { try { globalThis.localStorage?.setItem(STORAGE_KEY, tier); } catch {} }
  listeners.forEach((cb) => { try { cb(tier); } catch (err) { console.error(err); } });
}

export function onInputDifficultyChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
