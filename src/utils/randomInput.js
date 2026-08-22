// Seedable RNG + helpers for domain random-input generators.
export const DIFFICULTIES = ['normal', 'special', 'edge', 'large'];

// mulberry32 — deterministic when seeded; time-seeded otherwise.
export function makeRng(seed) {
  let a = (seed == null) ? ((Math.random() * 2 ** 32) >>> 0) : (seed >>> 0);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function uniqueInts(rng, n, lo, hi) {
  const pool = [];
  for (let v = lo; v <= hi; v++) pool.push(v);
  return shuffle(rng, pool).slice(0, n);
}
