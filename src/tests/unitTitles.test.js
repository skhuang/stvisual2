import { describe, it, expect, afterEach } from 'vitest';
import { unitTitle } from '../utils/unitTitles.js';
import { EXPLORER_UNITS, UNIT_BY_ID } from '../data/explorerUnits.js';
import { locationForUnit } from '../utils/urlRouter.js';
import { setLocale, getLocale } from '../i18n/index.js';

const original = getLocale();
afterEach(() => setLocale(original, { persist: false }));

describe('unitTitle', () => {
  it('resolves a tabbed unit to its own tab label, not the section title', () => {
    setLocale('en', { persist: false });
    expect(unitTitle(UNIT_BY_ID.get('boundary-value'))).toBe('Boundary Value Analysis');
    expect(unitTitle(UNIT_BY_ID.get('equivalence-class'))).toBe('Equivalence Classes');
    expect(unitTitle(UNIT_BY_ID.get('mbt-workflow'))).toBe('MBT Workflow');
    expect(unitTitle(UNIT_BY_ID.get('equivalent-mutant'))).toBe('Equivalent Mutants');
    expect(unitTitle(UNIT_BY_ID.get('program-slicing'))).toBe('Program Slicing');
  });

  it('translates tab labels to Traditional Chinese', () => {
    setLocale('zh', { persist: false });
    expect(unitTitle(UNIT_BY_ID.get('boundary-value'))).toBe('邊界值分析');
    expect(unitTitle(UNIT_BY_ID.get('mbt-workflow'))).toBe('MBT 工作流程');
  });

  it('every unit in a tabbed section resolves to a real, section-distinct label (both locales)', () => {
    for (const locale of ['en', 'zh']) {
      setLocale(locale, { persist: false });

      const bySection = new Map();
      for (const unit of EXPLORER_UNITS) {
        const loc = locationForUnit(unit);
        if (!loc?.tab) continue; // single-unit sections legitimately use the section title
        if (!bySection.has(loc.section)) bySection.set(loc.section, []);
        bySection.get(loc.section).push(unit);
      }

      for (const [section, units] of bySection) {
        const titles = units.map((u) => unitTitle(u));
        // no title may still be a raw i18n key (would mean a missing dict entry)
        titles.forEach((label, i) => {
          expect(label, `${locale} ${section}/${units[i].id} unresolved key`)
            .not.toMatch(/Tab\.|\.tab\./);
        });
        // titles within a section must be distinct — the reported bug was
        // that every unit collapsed to the shared section title.
        expect(new Set(titles).size, `${locale} ${section} has duplicate unit titles`)
          .toBe(units.length);
      }
    }
  });
});
