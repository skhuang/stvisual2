import { t } from '../i18n/index.js';
import { locationForUnit } from './urlRouter.js';

// Per-section prefix for a tab's i18n label key. The integrated view's tab
// bars are the source of truth for these labels; the older sections use a
// `<prefix>.<tab>` camel-prefix (e.g. `blackboxTab.bva`), the four newest
// use a dotted `<section>.tab.<tab>` form, and `advanced` abbreviates to
// `advTab`. `unitTitle` joins prefix + '.' + tab to recover the exact key.
// A companion test asserts every tabbed unit resolves to a real label here,
// so a new tabbed section that forgets its entry fails loudly.
const TAB_LABEL_PREFIX = {
  blackbox:   'blackboxTab',
  flow:       'flowTab',
  types:      'typesTab',
  mbt:        'mbtTab',
  syntax:     'syntaxTab',
  acceptance: 'acceptanceTab',
  agile:      'agileTab',
  advanced:   'advTab',
  slicing:    'slicing.tab',
  tdd:        'tdd.tab',
  exploit:    'exploit.tab',
  sbst:       'sbst.tab',
  graph:      'graph.tab',
  logic:      'logic.tab',
};

// Best available human title for a unit: the tab label (recovered via
// TAB_LABEL_PREFIX) when the unit lives in a tabbed section, else the
// section title.
export function unitTitle(unit) {
  const loc = locationForUnit(unit);
  if (!loc) return unit.id;
  if (loc.tab) {
    const prefix = TAB_LABEL_PREFIX[loc.section];
    if (prefix) {
      const key = `${prefix}.${loc.tab}`;
      const label = t(key);
      if (label !== key) return label;
    }
  }
  const sKey = `section.${loc.section}.title`;
  const sTitle = t(sKey);
  return sTitle !== sKey ? sTitle : t(`section.${loc.section}`);
}
