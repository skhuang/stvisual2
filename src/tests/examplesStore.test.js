import { describe, it, expect, beforeEach } from 'vitest';
import { key, load, save } from '../utils/examplesStore.js';

describe('examplesStore', () => {
  beforeEach(() => localStorage.clear());

  it('namespaces the key', () => {
    expect(key('graph')).toBe('stvisual:examples:graph');
  });

  it('saves newest-first, dedupes, and caps at 10', () => {
    for (let i = 0; i < 12; i++) save(localStorage, 'graph', `input-${i}`, 'DEFAULT');
    const r = load(localStorage, 'graph');
    expect(r).toHaveLength(10);
    expect(r[0].text).toBe('input-11');
    save(localStorage, 'graph', 'input-11', 'DEFAULT'); // dedupe -> back to front, still 10
    const r2 = load(localStorage, 'graph');
    expect(r2).toHaveLength(10);
    expect(r2[0].text).toBe('input-11');
  });

  it('skips empty and default text', () => {
    save(localStorage, 'g', '', 'DEFAULT');
    save(localStorage, 'g', 'DEFAULT', 'DEFAULT');
    expect(load(localStorage, 'g')).toEqual([]);
  });

  it('returns [] on corrupt storage', () => {
    localStorage.setItem('stvisual:examples:bad', '{not json');
    expect(load(localStorage, 'bad')).toEqual([]);
  });
});
