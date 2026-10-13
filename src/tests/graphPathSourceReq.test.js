import { describe, expect, it } from 'vitest';
import { pathCoversRequirement, pathSourceLines } from '../components/GraphCoverageExplorer.js';

// Tiny fixture CFG: S -> A -> B -> T, where A and B map to source lines and S/T
// do not. (Mirrors how generated CFGs attach `sourceLine` only to statement
// nodes, leaving synthetic start/end nodes without one.)
const fixtureGraph = {
  nodes: [
    { id: 'S', label: 'Start' },
    { id: 'A', label: 'A', sourceLine: 3 },
    { id: 'B', label: 'B', sourceLine: 1 },
    { id: 'C', label: 'C', sourceLine: 3 },
    { id: 'T', label: 'End' },
  ],
  edges: [
    { id: 'S-A', from: 'S', to: 'A' },
    { id: 'A-B', from: 'A', to: 'B' },
    { id: 'B-C', from: 'B', to: 'C' },
    { id: 'C-T', from: 'C', to: 'T' },
  ],
};

describe('pathSourceLines', () => {
  it('returns sorted unique source lines for the path nodes', () => {
    // A(3), B(1), C(3) -> deduped + numeric sort => [1, 3]
    expect(pathSourceLines(fixtureGraph, ['S', 'A', 'B', 'C', 'T'])).toEqual([1, 3]);
  });

  it('ignores nodes that have no sourceLine', () => {
    // Only S and T (no sourceLine) in the path => []
    expect(pathSourceLines(fixtureGraph, ['S', 'T'])).toEqual([]);
  });

  it('ignores unknown node ids and returns [] for an empty path', () => {
    expect(pathSourceLines(fixtureGraph, ['A', 'ghost'])).toEqual([3]);
    expect(pathSourceLines(fixtureGraph, [])).toEqual([]);
  });
});

describe('pathCoversRequirement', () => {
  const pathNodes = new Set(['S', 'A', 'B', 'T']);
  const pathEdges = new Set(['S-A', 'A-B']);

  it('is true when every requirement node and edge is in the path sets', () => {
    expect(
      pathCoversRequirement(pathNodes, pathEdges, { nodes: ['A', 'B'], edges: ['A-B'] }),
    ).toBe(true);
  });

  it('is false when a required node is missing', () => {
    expect(
      pathCoversRequirement(pathNodes, pathEdges, { nodes: ['A', 'C'], edges: ['A-B'] }),
    ).toBe(false);
  });

  it('is false when a required edge is missing', () => {
    expect(
      pathCoversRequirement(pathNodes, pathEdges, { nodes: ['A', 'B'], edges: ['B-C'] }),
    ).toBe(false);
  });

  it('treats missing nodes/edges arrays as no constraint', () => {
    expect(pathCoversRequirement(pathNodes, pathEdges, {})).toBe(true);
    expect(pathCoversRequirement(pathNodes, pathEdges, null)).toBe(false);
  });
});
