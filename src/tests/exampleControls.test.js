import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createExampleControls } from '../components/ExampleControls.js';
import { save } from '../utils/examplesStore.js';

describe('ExampleControls', () => {
  beforeEach(() => localStorage.clear());

  it('lists placeholder + current-default + presets + recent, and fires callbacks', () => {
    save(localStorage, 'graph', 'RECENT-1', 'DEFAULT');
    const onLoad = vi.fn(), onRandom = vi.fn();
    const { element, refresh } = createExampleControls({
      methodId: 'graph',
      getDefaultText: () => 'DEFAULT',
      presets: [{ value: 'PRESET-A', label: 'Preset A' }],
      onLoad, onRandom,
    });
    const select = element.querySelector('[data-testid="ex-select"]');
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain('DEFAULT');     // current-default option
    expect(values).toContain('PRESET-A');    // preset
    expect(values).toContain('RECENT-1');    // recent
    // pick a preset -> onLoad
    select.value = 'PRESET-A';
    select.dispatchEvent(new Event('change'));
    expect(onLoad).toHaveBeenCalledWith('PRESET-A');
    // 🎲 -> onRandom
    element.querySelector('[data-testid="ex-random"]').click();
    expect(onRandom).toHaveBeenCalled();
    // refresh picks up a new saved entry
    save(localStorage, 'graph', 'RECENT-2', 'DEFAULT');
    refresh();
    expect([...element.querySelector('[data-testid="ex-select"]').options].map((o) => o.value)).toContain('RECENT-2');
  });
});
