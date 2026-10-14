import { describe, it, expect } from 'vitest';
import { presetForDifficulty, randomGraph } from '../data/graphCoverageRandom.js';
import { buildDataFlowGraph } from '../utils/dataFlow.js';
import { createGraphCoverageExplorer } from '../components/GraphCoverageExplorer.js';

describe('graph data-flow generator carries variables', () => {
  it('annotates every generated node with sourceText', () => {
    for (const tier of ['edge', 'normal', 'special', 'large']) {
      const graph = presetForDifficulty(tier);
      for (const node of graph.nodes) {
        expect(node.sourceText, `${tier}/${node.id}`).toBeTruthy();
      }
    }
  });

  it('produces non-empty def→use edges for every tier (preset + random)', () => {
    for (const tier of ['edge', 'normal', 'special', 'large']) {
      expect(buildDataFlowGraph(presetForDifficulty(tier)).edges.length, `preset ${tier}`)
        .toBeGreaterThan(0);
      expect(buildDataFlowGraph(randomGraph(tier)).edges.length, `random ${tier}`)
        .toBeGreaterThan(0);
    }
  });

  it('start node defines params and the chain reuses earlier variables', () => {
    const graph = presetForDifficulty('normal');
    const start = graph.nodes.find((n) => n.id === 'S');
    expect(start.sourceText).toMatch(/function\s+\w+\s*\(\s*x\s*,\s*y\s*\)/);
    const dfg = buildDataFlowGraph(graph);
    // At least one edge should carry a param defined at the start node.
    expect(dfg.edges.some((e) => e.from === 'S' && (e.variable === 'x' || e.variable === 'y')))
      .toBe(true);
  });
});

describe('GraphCoverageExplorer dataflow preset renders variables', () => {
  it('shows a non-empty DFG and data-flow requirements out of the box', () => {
    const el = createGraphCoverageExplorer({ preset: 'dataflow' });
    expect(el.querySelector('[data-testid="graph-dfg-card"]')).toBeTruthy();
    // No "no variables" empty state.
    expect(el.querySelector('[data-testid="graph-dfg-empty"]')).toBeNull();
    // At least one def→use edge drawn on the DFG.
    expect(el.querySelectorAll('[data-testid^="dfg-edge-"]').length).toBeGreaterThan(0);
    // The all-defs criterion (default for this preset) yields requirements.
    expect(el.querySelectorAll('[data-requirement-id]').length).toBeGreaterThan(0);
  });

  it('loads a comma-labelled program example (Next Date) with its real variables', () => {
    const el = createGraphCoverageExplorer({ preset: 'dataflow' });
    document.body.appendChild(el);
    const select = el.querySelector('[data-testid="ex-select"]');
    expect(select).toBeTruthy();
    const option = [...select.options].find((o) => o.textContent.trim().startsWith('Next Date'));
    expect(option, 'Next Date option present').toBeTruthy();

    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    // The real CFG loaded (not the generated fallback), labels with commas and
    // all. Its title and variables must reflect Next Date.
    expect(el.querySelector('.graph-coverage-header h3').textContent).toMatch(/Next Date/);
    const dfgVars = new Set(
      [...el.querySelectorAll('[data-testid^="dfg-edge-"] text')]
        .flatMap((node) => node.textContent.split(',').map((s) => s.trim())),
    );
    expect(dfgVars.has('year')).toBe(true);
    expect(dfgVars.has('month')).toBe(true);
    expect(dfgVars.has('day')).toBe(true);
    // No structural-label or call-name pollution.
    for (const bogus of ['Start', 'End', 'Merge', 'isValidDate', 'daysInMonth']) {
      expect(dfgVars.has(bogus), bogus).toBe(false);
    }
    el.remove();
  });
});
