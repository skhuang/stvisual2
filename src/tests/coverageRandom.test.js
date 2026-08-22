// src/tests/coverageRandom.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../utils/randomInput.js';
import * as G from '../data/graphCoverageRandom.js';
import * as Lg from '../data/logicCoverageRandom.js';

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

function clauseSet(expr) { return new Set((expr.match(/[a-z]/g) || [])); }

function isBalanced(expr) {
  const opens = (expr.match(/\(/g) || []).length;
  const closes = (expr.match(/\)/g) || []).length;
  return opens === closes;
}

describe('logicCoverageRandom', () => {
  const TIERS = ['normal', 'special', 'edge', 'large'];
  it('presetForDifficulty yields a parseable predicate per tier', () => {
    for (const tier of TIERS) {
      const { expression, bindings } = Lg.presetForDifficulty(tier);
      expect(typeof expression).toBe('string');
      expect(expression.length).toBeGreaterThan(0);
      clauseSet(expression).forEach((c) => expect(bindings[c]).toBeTruthy());
    }
  });
  it('randomPredicate (seeded) respects tier clause-count bands', () => {
    expect(clauseSet(Lg.randomPredicate('edge', makeRng(1)).expression).size).toBe(1);
    const normal = clauseSet(Lg.randomPredicate('normal', makeRng(1)).expression).size;
    expect(normal).toBeGreaterThanOrEqual(2); expect(normal).toBeLessThanOrEqual(3);
    expect(clauseSet(Lg.randomPredicate('large', makeRng(1)).expression).size).toBeGreaterThanOrEqual(4);
  });
  it('every tier expression (preset + random, multiple seeds) has balanced parentheses', () => {
    for (const tier of TIERS) {
      expect(isBalanced(Lg.presetForDifficulty(tier).expression)).toBe(true);
      for (let seed = 1; seed <= 20; seed++) {
        expect(isBalanced(Lg.randomPredicate(tier, makeRng(seed)).expression)).toBe(true);
      }
    }
  });
});
