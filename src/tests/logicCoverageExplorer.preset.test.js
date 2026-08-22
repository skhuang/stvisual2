import { describe, it, expect } from 'vitest';
import { createLogicCoverageExplorer, LOGIC_PRESETS } from '../components/LogicCoverageExplorer.js';
import { logicCoverageCriteria } from '../data/testingData.js';

describe('LogicCoverageExplorer presets', () => {
  it('preset criteria ids all exist', () => {
    const known = new Set(logicCoverageCriteria.map((c) => c.id));
    for (const cfg of Object.values(LOGIC_PRESETS)) cfg.criteria.forEach((id) => expect(known.has(id)).toBe(true));
  });
  it('basic preset shows only pc/cc/coc chips and the truth table, hides K-maps', () => {
    const el = createLogicCoverageExplorer({ preset: 'basic' });
    const chips = [...el.querySelectorAll('[data-testid^="logic-criterion-"]')].map((c) => c.dataset.criterion);
    expect(chips.sort()).toEqual(['cc', 'coc', 'pc']);
    expect(el.querySelector('[data-testid="logic-truth-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="logic-kmap-f"]')).toBeNull();
    expect(el.querySelector('[data-testid="ex-select"]')).toBeTruthy();
  });
  it('dnf preset shows K-maps', () => {
    expect(createLogicCoverageExplorer({ preset: 'dnf' }).querySelector('[data-testid="logic-kmap-f"]')).toBeTruthy();
  });
  it('no preset shows the full 14-criterion switcher', () => {
    expect(createLogicCoverageExplorer().querySelectorAll('[data-testid^="logic-criterion-"]').length).toBe(14);
  });
});
