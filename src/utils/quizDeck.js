import { makeRng, shuffle } from './randomInput.js';

export const LEVELS = ['easy', 'medium', 'hard'];

function bucketFor(rendered, id, lang, lv) {
  const topic = rendered[id];
  if (!topic) return [];
  const b = topic[lang]?.[lv];
  if (b && b.length) return b;
  const en = topic.en?.[lv];
  return (en && en.length) ? en : [];
}

export function mixSeed() { return (Date.now() >>> 0) ^ Math.floor(Math.random() * 2 ** 32); }

export function pickDeck(rendered, id, lang, difficulty, seed) {
  if (difficulty !== 'mixed') {
    return bucketFor(rendered, id, lang, difficulty);
  }
  // Sample 5 indices per level from a canonical bucket length, then map into the
  // chosen language so en/zh stay parallel for the same seed.
  const rng = makeRng(seed);
  const out = [];
  for (const lv of LEVELS) {
    const src = bucketFor(rendered, id, lang, lv);
    if (src.length < 5) return [];
    const idxs = shuffle(rng, src.map((_, i) => i)).slice(0, 5).sort((a, b) => a - b);
    idxs.forEach((i) => out.push(src[i]));
  }
  return out.length === 15 ? out : [];
}
