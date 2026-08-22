import { describe, it, expect } from 'vitest';
import { graphFromEdgesText } from '../components/GraphCoverageExplorer.js';

// Regression: dropdown presets / recent inputs / difficulty default are
// exchanged as edges-text and rebuilt by graphFromEdgesText. It used to lay
// every node on a flat y=170 row, so branch siblings overlapped. It must now
// produce a layered left→right layout with siblings spread vertically.
describe('graphFromEdgesText layout', () => {
  it('layers a diamond CFG: siblings share a column but differ in y', () => {
    // S -> A, S -> B, A -> T, B -> T  (A and B are parallel branch siblings)
    const g = graphFromEdgesText('S,A\nS,B\nA,T\nB,T');
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(g.startNodeId).toBe('S');
    expect(g.endNodeId).toBe('T');
    // A and B are at the same depth → same x, different y (no overlap)
    expect(by.A.x).toBe(by.B.x);
    expect(by.A.y).not.toBe(by.B.y);
    // depth increases left→right: S < A/B < T
    expect(by.S.x).toBeLessThan(by.A.x);
    expect(by.A.x).toBeLessThan(by.T.x);
    // not all nodes collapsed onto one row
    expect(new Set(g.nodes.map((n) => n.y)).size).toBeGreaterThan(1);
  });

  it('keeps a straight-line CFG on a single row (each node its own column)', () => {
    const g = graphFromEdgesText('S,A\nA,B\nB,T');
    const ys = new Set(g.nodes.map((n) => n.y));
    expect(ys.size).toBe(1); // no siblings → all on the spine row
    const xs = g.nodes.map((n) => n.x).sort((a, b) => a - b);
    expect(new Set(xs).size).toBe(4); // four distinct columns
  });

  it('tolerates a back-edge (loop) without deepening the loop target', () => {
    // S -> A, A -> B, B -> A (back-edge), B -> T
    const g = graphFromEdgesText('S,A\nA,B\nB,A\nB,T');
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(by.A.x).toBeLessThan(by.B.x); // A stays shallower than B
    expect(by.T.x).toBeGreaterThanOrEqual(by.B.x); // end at/after B
    expect(g.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });
});
