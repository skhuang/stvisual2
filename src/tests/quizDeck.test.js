import { describe, it, expect } from 'vitest';
import { pickDeck, difficultyReady } from '../utils/quizDeck.js';

const bucket = (lang, lv) => Array.from({ length: 15 }, (_, i) => ({ name: `${lang}-${lv}-${i}`, type: 'multichoice', answers: [] }));
const rendered = {
  t: {
    en: { easy: bucket('en', 'easy'), medium: bucket('en', 'medium'), hard: bucket('en', 'hard') },
    zh: { easy: bucket('zh', 'easy'), medium: bucket('zh', 'medium'), hard: bucket('zh', 'hard') },
  },
};

describe('pickDeck', () => {
  it('returns the requested bucket for a fixed level', () => {
    expect(pickDeck(rendered, 't', 'en', 'easy').map((q) => q.name)).toEqual(bucket('en', 'easy').map((q) => q.name));
  });

  it('mixed draws 5+5+5 = 15', () => {
    const d = pickDeck(rendered, 't', 'en', 'mixed', 123);
    expect(d).toHaveLength(15);
    expect(d.filter((q) => q.name.includes('-easy-'))).toHaveLength(5);
    expect(d.filter((q) => q.name.includes('-medium-'))).toHaveLength(5);
    expect(d.filter((q) => q.name.includes('-hard-'))).toHaveLength(5);
  });

  it('mixed is deterministic for a given seed', () => {
    const a = pickDeck(rendered, 't', 'en', 'mixed', 42).map((q) => q.name);
    const b = pickDeck(rendered, 't', 'en', 'mixed', 42).map((q) => q.name);
    expect(a).toEqual(b);
  });

  it('mixed keeps en/zh parallel for the same seed', () => {
    const en = pickDeck(rendered, 't', 'en', 'mixed', 7).map((q) => q.name.replace('en-', ''));
    const zh = pickDeck(rendered, 't', 'zh', 'mixed', 7).map((q) => q.name.replace('zh-', ''));
    expect(en).toEqual(zh);
  });

  it('returns [] when a bucket is missing', () => {
    const partial = { t: { en: { easy: bucket('en', 'easy') }, zh: { easy: bucket('zh', 'easy') } } };
    expect(pickDeck(partial, 't', 'en', 'mixed', 1)).toEqual([]);
    expect(pickDeck(partial, 't', 'en', 'hard')).toEqual([]);
  });
});

// Buckets whose questions carry real options (correct one authored first, as
// the whole corpus is) so we can exercise answer shuffling.
const optBucket = (lang, lv) => Array.from({ length: 15 }, (_, i) => ({
  name: `${lang}-${lv}-${i}`, type: 'multichoice', single: true,
  answers: [
    { text: 'correct', fraction: 100 },
    { text: 'b', fraction: 0 },
    { text: 'c', fraction: 0 },
    { text: 'd', fraction: 0 },
  ],
}));
const optRendered = {
  t: {
    en: { easy: optBucket('en', 'easy'), medium: optBucket('en', 'medium'), hard: optBucket('en', 'hard') },
    zh: { easy: optBucket('zh', 'easy'), medium: optBucket('zh', 'medium'), hard: optBucket('zh', 'hard') },
  },
};
const correctIdx = (q) => q.answers.findIndex((a) => a.fraction > 0);

describe('pickDeck answer shuffling', () => {
  it('leaves options in authored order when no seed is given', () => {
    const d = pickDeck(optRendered, 't', 'en', 'easy');
    expect(d.every((q) => correctIdx(q) === 0)).toBe(true);
  });

  it('moves the correct answer off position 0 for at least some questions when seeded', () => {
    const d = pickDeck(optRendered, 't', 'en', 'easy', 12345);
    expect(d.some((q) => correctIdx(q) !== 0)).toBe(true);
    // Every question still has exactly one correct option and the same set.
    expect(d.every((q) => q.answers.filter((a) => a.fraction > 0).length === 1)).toBe(true);
    expect(d.every((q) => q.answers.length === 4)).toBe(true);
  });

  it('is deterministic: same seed yields the same answer order', () => {
    const a = pickDeck(optRendered, 't', 'en', 'easy', 999).map(correctIdx);
    const b = pickDeck(optRendered, 't', 'en', 'easy', 999).map(correctIdx);
    expect(a).toEqual(b);
  });

  it('keeps en/zh answer order aligned for the same seed (fixed level)', () => {
    const en = pickDeck(optRendered, 't', 'en', 'easy', 55).map(correctIdx);
    const zh = pickDeck(optRendered, 't', 'zh', 'easy', 55).map(correctIdx);
    expect(en).toEqual(zh);
  });

  it('keeps en/zh answer order aligned for the same seed (mixed)', () => {
    const en = pickDeck(optRendered, 't', 'en', 'mixed', 77).map(correctIdx);
    const zh = pickDeck(optRendered, 't', 'zh', 'mixed', 77).map(correctIdx);
    expect(en).toEqual(zh);
  });

  it('does not mutate the shared rendered buckets', () => {
    pickDeck(optRendered, 't', 'en', 'easy', 31415);
    expect(optRendered.t.en.easy.every((q) => correctIdx(q) === 0)).toBe(true);
  });
});

describe('difficultyReady', () => {
  it('is false for a fixed level with 0 questions', () => {
    const empty = { t: { en: { easy: [] }, zh: { easy: [] } } };
    expect(difficultyReady(empty, 't', 'en', 'easy')).toBe(false);
  });

  it('is true for a fixed level with at least 1 question', () => {
    const oneQ = { t: { en: { easy: bucket('en', 'easy').slice(0, 1) }, zh: { easy: bucket('zh', 'easy').slice(0, 1) } } };
    expect(difficultyReady(oneQ, 't', 'en', 'easy')).toBe(true);
  });

  it('is true for mixed when every level has >= 5 (pickDeck returns 15)', () => {
    expect(difficultyReady(rendered, 't', 'en', 'mixed', 0)).toBe(true);
  });

  it('is false for mixed when a level is empty (pickDeck returns [])', () => {
    const partial = { t: { en: { easy: bucket('en', 'easy') }, zh: { easy: bucket('zh', 'easy') } } };
    expect(difficultyReady(partial, 't', 'en', 'mixed', 1)).toBe(false);
  });
});
