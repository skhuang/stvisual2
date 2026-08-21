import { describe, it, expect } from 'vitest';
import { parseAppLocation, unitsForSection } from '../utils/urlRouter.js';

describe('parseAppLocation unit-view semantics', () => {
  it('accepts a kebab unit id and normalizes to ComponentName', () => {
    const s = parseAppLocation('?explorer=graph-coverage', '');
    expect(s.explorer).toBe('GraphCoverageExplorer');
    expect(s.unitId).toBe('graph-coverage');
    expect(s.section).toBe('graph');
  });

  it('still accepts a ComponentName and adds unitId', () => {
    const s = parseAppLocation('?explorer=BoundaryValueExplorer', '');
    expect(s.explorer).toBe('BoundaryValueExplorer');
    expect(s.unitId).toBe('boundary-value');
    expect(s.section).toBe('blackbox');
    expect(s.tab).toBe('bva');
  });

  it('flags an unknown explorer and falls back to section/tab parsing', () => {
    const s = parseAppLocation('?explorer=NopeExplorer&section=logic', '');
    expect(s.explorer).toBeUndefined();
    expect(s.unknownExplorer).toBe('NopeExplorer');
    expect(s.section).toBe('logic');
  });

  it('parses ?view=all', () => {
    const s = parseAppLocation('?view=all&explorer=graph-coverage', '');
    expect(s.view).toBe('all');
    expect(s.explorer).toBe('GraphCoverageExplorer');
  });

  it('unitsForSection returns units in tab order', () => {
    const ids = unitsForSection('syntax').map((u) => u.id);
    expect(ids).toEqual(['syntax-coverage', 'grammar-coverage', 'spec-mutation']);
    expect(unitsForSection('graph').map((u) => u.id)).toEqual(['graph-coverage']);
    expect(unitsForSection('no-such-section')).toEqual([]);
  });
});
