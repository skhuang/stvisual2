import { describe, it, expect, beforeEach } from 'vitest';
import { renderApp } from '../app.js';
import { getInputDifficulty, setInputDifficulty } from '../utils/inputDifficulty.js';

describe('difficulty selector (unit view header)', () => {
  beforeEach(() => { setInputDifficulty('normal', { persist: false }); window.history.replaceState(null, '', '/?explorer=graph-structural'); document.body.innerHTML = ''; });
  it('renders and updates global difficulty', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    renderApp(c);
    const sel = document.querySelector('[data-testid="input-difficulty"]');
    expect(sel).toBeTruthy();
    sel.value = 'large'; sel.dispatchEvent(new Event('change'));
    expect(getInputDifficulty()).toBe('large');
  });
});
