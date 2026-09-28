import { describe, it, expect } from 'vitest';
import { SLIDE_DECK_BY_UNIT, slideDeckIdForUnit } from '../data/unitSlideDecks.js';
import { EXPLORER_UNITS } from '../data/explorerUnits.js';
import { SLIDE_DECKS } from '../data/slideDecks.generated.js';

const deckIds = new Set(SLIDE_DECKS.map((d) => d.id));
const unitIds = new Set(EXPLORER_UNITS.map((u) => u.id));

describe('unit → slide-deck mapping', () => {
  it('every override targets a real deck id', () => {
    for (const [unitId, deckId] of Object.entries(SLIDE_DECK_BY_UNIT)) {
      expect(deckIds.has(deckId), `${unitId} → ${deckId} (unknown deck)`).toBe(true);
    }
  });

  it('every override key is a real unit id (no stale entries)', () => {
    for (const unitId of Object.keys(SLIDE_DECK_BY_UNIT)) {
      expect(unitIds.has(unitId), `override for unknown unit "${unitId}"`).toBe(true);
    }
  });

  it('resolves overrides and falls back to the unit id', () => {
    expect(slideDeckIdForUnit('metamorphic-testing')).toBe('metamorphic');
    expect(slideDeckIdForUnit('sbst-suite')).toBe('search-based-testing');
    expect(slideDeckIdForUnit('boundary-value')).toBe('boundary-value'); // exact match, no override
  });

  // Units whose slide deck is scheduled for a later phase. The Slides button is
  // gated by hasSlideDeck, so these simply show no Slides button until the deck
  // lands. Testability Phase 1 ships the explorer; its deck arrives in Phase 4.
  const PENDING_DECK_UNITS = new Set([
    'controllability-observability',
    'testability-seams',
  ]);

  it('every explorer unit resolves to a real deck (no unit left without slides)', () => {
    const missing = EXPLORER_UNITS
      .map((u) => u.id)
      .filter((id) => !PENDING_DECK_UNITS.has(id))
      .filter((id) => !deckIds.has(slideDeckIdForUnit(id)));
    expect(missing, `units with no slide deck: ${missing.join(', ')}`).toEqual([]);
  });
});
