import { t } from '../i18n/index.js';
import { locationForUnit } from './urlRouter.js';

// Best available human title for a unit: the tab label
// (`<section>.tab.<tab>`) when the dict has one, else the section title.
export function unitTitle(unit) {
  const loc = locationForUnit(unit);
  if (!loc) return unit.id;
  if (loc.tab) {
    const key = `${loc.section}.tab.${loc.tab}`;
    const label = t(key);
    if (label !== key) return label;
  }
  const sKey = `section.${loc.section}.title`;
  const sTitle = t(sKey);
  return sTitle !== sKey ? sTitle : t(`section.${loc.section}`);
}
