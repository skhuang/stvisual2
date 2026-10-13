import { describe, expect, it } from 'vitest';
import { pathToHighlight, pathColor, PALETTE, SHARED_PATH_COLOR } from '../components/GraphCoverageExplorer.js';

describe('pathColor', () => {
  it('returns the curated palette for the first entries, stable by index', () => {
    PALETTE.forEach((c, i) => expect(pathColor(i)).toBe(c));
    expect(pathColor(2)).toBe(pathColor(2)); // deterministic
  });

  it('gives distinct colors well past the palette length (T7+ and beyond the cliff)', () => {
    const colors = Array.from({ length: 24 }, (_, i) => pathColor(i));
    expect(new Set(colors).size).toBe(24); // all distinct — no repeat at index 12
    colors.slice(PALETTE.length).forEach((c) => expect(c).not.toBe(SHARED_PATH_COLOR));
  });
});

const graph = {
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c' },
  ],
};

describe('pathToHighlight', () => {
  it('maps a full path to its nodes and edge ids', () => {
    expect(pathToHighlight(graph, ['a', 'b', 'c'])).toEqual({
      nodes: ['a', 'b', 'c'],
      edges: ['e1', 'e2'],
    });
  });

  it('skips consecutive pairs with no matching edge', () => {
    // a -> c has no edge, so it is skipped; b -> c (e2) is kept.
    expect(pathToHighlight(graph, ['a', 'c', 'b', 'c'])).toEqual({
      nodes: ['a', 'c', 'b', 'c'],
      edges: ['e2'],
    });
  });

  it('returns no edges for a single-node path', () => {
    expect(pathToHighlight(graph, ['a'])).toEqual({ nodes: ['a'], edges: [] });
  });

  it('returns no edges for an empty path', () => {
    expect(pathToHighlight(graph, [])).toEqual({ nodes: [], edges: [] });
  });

  it('does not mutate the input path', () => {
    const path = ['a', 'b', 'c'];
    const result = pathToHighlight(graph, path);
    expect(path).toEqual(['a', 'b', 'c']);
    expect(result.nodes).not.toBe(path);
  });
});
