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

// Reorder one multichoice question's options so the correct answer isn't always
// first. Returns a shallow-cloned question (never mutates the shared rendered
// data); truefalse/shortanswer and single-option questions are returned as-is.
// Grading and rendering are purely index-based over q.answers and each option
// carries its own fraction, so moving options needs no other changes.
function shuffleAnswers(q, rng) {
  if (!q || q.type !== 'multichoice' || !Array.isArray(q.answers) || q.answers.length < 2) return q;
  return { ...q, answers: shuffle(rng, q.answers) };
}

// Apply per-question answer shuffling across a deck. Seeded so the same seed
// yields the same order: en/zh stay aligned (identical seed + position), and
// resume/review reproduce exactly. A null/undefined seed leaves options in
// their authored order (preview/readiness checks and legacy saved attempts).
function withShuffledAnswers(deck, seed) {
  if (seed == null) return deck;
  const s = seed >>> 0;
  return deck.map((q, i) => shuffleAnswers(q, makeRng((s ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0)));
}

export function pickDeck(rendered, id, lang, difficulty, seed) {
  if (difficulty !== 'mixed') {
    return withShuffledAnswers(bucketFor(rendered, id, lang, difficulty), seed);
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
  return out.length === 15 ? withShuffledAnswers(out, seed) : [];
}

// A difficulty is "ready" (Begin shown) when its deck can be built:
// mixed needs a full 15 (5/5/5); a fixed level needs at least one question.
export function difficultyReady(rendered, id, lang, difficulty, seed) {
  const n = pickDeck(rendered, id, lang, difficulty, seed).length;
  return difficulty === 'mixed' ? n >= 15 : n > 0;
}
