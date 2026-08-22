import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { INPUT_DIFFICULTIES, getInputDifficulty, setInputDifficulty, onInputDifficultyChange } from '../utils/inputDifficulty.js';

describe('inputDifficulty', () => {
  beforeEach(() => { localStorage.clear(); setInputDifficulty('normal', { persist: false }); });
  afterEach(() => setInputDifficulty('normal', { persist: false }));

  it('exposes the four tiers and defaults to normal', () => {
    expect(INPUT_DIFFICULTIES).toEqual(['normal', 'special', 'edge', 'large']);
    expect(getInputDifficulty()).toBe('normal');
  });

  it('set persists and notifies; unknown tier is ignored', () => {
    let seen = null;
    const off = onInputDifficultyChange((t) => { seen = t; });
    setInputDifficulty('large');
    expect(getInputDifficulty()).toBe('large');
    expect(seen).toBe('large');
    expect(localStorage.getItem('stvisual:input-difficulty')).toBe('large');
    setInputDifficulty('nope');
    expect(getInputDifficulty()).toBe('large');
    off();
    setInputDifficulty('edge');
    expect(seen).toBe('large'); // unsubscribed
  });
});
