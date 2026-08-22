import { describe, it, expect } from 'vitest';
import { makeRng, randInt, pick, shuffle, uniqueInts, DIFFICULTIES } from '../utils/randomInput.js';

describe('randomInput helpers', () => {
  it('makeRng(seed) is deterministic and in [0,1)', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
  });
  it('randInt is inclusive within range', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 200; i++) { const v = randInt(rng, 3, 7); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(7); }
  });
  it('uniqueInts returns n distinct values in range', () => {
    const r = uniqueInts(makeRng(2), 5, 0, 9);
    expect(new Set(r).size).toBe(5);
    r.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(9); });
  });
  it('shuffle preserves elements and does not mutate input', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(makeRng(3), src);
    expect(out).not.toBe(src);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
  it('pick returns a member', () => {
    expect(['a', 'b', 'c']).toContain(pick(makeRng(4), ['a', 'b', 'c']));
  });
  it('exposes the difficulty vocab', () => {
    expect(DIFFICULTIES).toEqual(['normal', 'special', 'edge', 'large']);
  });
});
