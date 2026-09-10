// Maps an Explorer unit id to the slide deck (SLIDE_DECKS id) that teaches it,
// for the per-unit "Slides" button in the unit view. Most units share the id of
// their deck and need no entry here; this table only lists the units whose deck
// id differs, or several units that share one deck (e.g. the sbst-* units all
// point at the search-based-testing deck). A unit with neither an entry here nor
// a same-id deck simply shows no Slides button (see hasSlideDeck gating).
export const SLIDE_DECK_BY_UNIT = {
  'testing-method-tree': 'course-intro',
  'testing-flow': 'testing-flow-pyramid',
  'testing-types-table': 'testing-types',
  'pyramid-adjuster': 'test-pyramid',
  'graph-structural': 'graph-coverage',
  'graph-path': 'graph-coverage',
  'graph-dataflow': 'data-flow-coverage',
  'logic-basic': 'logic-coverage',
  'logic-active-clause': 'logic-coverage',
  'logic-inactive-clause': 'logic-coverage',
  'logic-dnf': 'logic-coverage',
  'syntax-coverage': 'grammar-mutation',
  'grammar-coverage': 'grammar-mutation',
  'property-based-testing': 'property-based',
  'risk-based-testing': 'risk-based',
  'equivalence-class': 'equivalence-partitioning',
  'metamorphic-testing': 'metamorphic',
  'exploratory-testing': 'exploratory',
  'equivalent-mutant': 'equivalent-mutants',
  'llm-pipeline': 'llm-test-pipeline',
  'test-quality': 'test-quality-gates',
  'sailor-pipeline': 'sailor-vulnerability',
  'performance-load-profile': 'performance-load',
  'w-method-conformance': 'w-method',
  'continuous-testing-pipeline': 'continuous-testing',
  'slice-dicing': 'fault-localization-dicing',
  'slice-coverage': 'slice-based-coverage',
  'slice-regression': 'regression-test-selection',
  'tdd-cycle': 'test-driven-development',
  'tdd-rules': 'test-driven-development',
  'exploit-overflow': 'exploit-generation',
  'exploit-sqli': 'exploit-generation',
  'exploit-cmdi': 'exploit-generation',
  'exploit-path': 'exploit-generation',
  'sbst-branch': 'search-based-testing',
  'sbst-compare': 'search-based-testing',
  'sbst-suite': 'search-based-testing',
};

// The deck id that a unit's Slides button should open: the curated override, or
// the unit id itself when it already matches a deck id.
export function slideDeckIdForUnit(unitId) {
  return SLIDE_DECK_BY_UNIT[unitId] || unitId;
}
