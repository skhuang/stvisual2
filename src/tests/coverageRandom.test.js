// src/tests/coverageRandom.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../utils/randomInput.js';
import * as G from '../data/graphCoverageRandom.js';

const TIERS = ['normal', 'special', 'edge', 'large'];

function reachable(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.edges.forEach((e) => adj.get(e.from)?.push(e.to));
  const seen = new Set([graph.startNodeId]);
  const stack = [graph.startNodeId];
  while (stack.length) { for (const nx of adj.get(stack.pop()) || []) if (!seen.has(nx)) { seen.add(nx); stack.push(nx); } }
  return seen;
}

describe('graphCoverageRandom', () => {
  it('presetForDifficulty returns a connected S→T CFG for every tier', () => {
    for (const tier of TIERS) {
      const g = G.presetForDifficulty(tier);
      expect(g.nodes.length).toBeGreaterThanOrEqual(2);
      expect(g.startNodeId).toBeTruthy();
      expect(g.endNodeId).toBeTruthy();
      expect(reachable(g).has(g.endNodeId)).toBe(true);
    }
  });
  it('randomGraph (seeded) is connected S→T and matches tier size bands', () => {
    for (const tier of TIERS) {
      const g = G.randomGraph(tier, makeRng(7));
      expect(reachable(g).has(g.endNodeId)).toBe(true);
      const n = g.nodes.length;
      if (tier === 'edge') expect(n).toBeLessThanOrEqual(4);
      if (tier === 'large') expect(n).toBeGreaterThanOrEqual(10);
    }
  });
  it('graphToEdgesText emits id,from,to lines the explorer format accepts', () => {
    const g = G.presetForDifficulty('normal');
    const text = G.graphToEdgesText(g);
    expect(text.split('\n').length).toBe(g.edges.length);
    text.split('\n').forEach((line) => expect(line.split(',').length).toBeGreaterThanOrEqual(3));
    expect(G.edgesTextLooksValid(text)).toBe(true);
  });
});
