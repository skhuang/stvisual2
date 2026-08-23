import { describe, it, expect } from 'vitest';
import { pickDeck } from '../utils/quizDeck.js';

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
