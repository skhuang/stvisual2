import { describe, it, expect } from 'vitest';
import {
  EXPLORER_UNITS, UNIT_BY_ID, UNIT_BY_COMPONENT, resolveUnit,
} from '../data/explorerUnits.js';
import { FACTORY_BY_COMPONENT } from '../data/explorerFactories.js';
import { EXPLORER_TO_LOCATION } from '../utils/urlRouter.js';

describe('explorerUnits registry', () => {
  it('covers every EXPLORER_TO_LOCATION component exactly once', () => {
    const names = EXPLORER_UNITS.map((u) => u.componentName).sort();
    expect(names).toEqual(Object.keys(EXPLORER_TO_LOCATION).sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('has unique kebab-case ids', () => {
    const ids = EXPLORER_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('resolveUnit accepts kebab id and ComponentName', () => {
    expect(resolveUnit('graph-coverage')?.componentName).toBe('GraphCoverageExplorer');
    expect(resolveUnit('GraphCoverageExplorer')?.id).toBe('graph-coverage');
    expect(resolveUnit('nope')).toBeNull();
    expect(UNIT_BY_ID.get('boundary-value').quizId).toBe('boundary-value-equivalence');
    expect(UNIT_BY_COMPONENT.get('MutationScoreExplorer').quizId).toBe('mutation-testing');
  });

  it('has a factory function for every unit', () => {
    for (const u of EXPLORER_UNITS) {
      expect(typeof FACTORY_BY_COMPONENT[u.componentName], u.componentName).toBe('function');
    }
  });
});
