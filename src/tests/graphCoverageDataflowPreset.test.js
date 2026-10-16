import { describe, it, expect } from 'vitest';
import { presetForDifficulty, randomGraph } from '../data/graphCoverageRandom.js';
import { buildDataFlowGraph } from '../utils/dataFlow.js';
import { createGraphCoverageExplorer, moveNode } from '../components/GraphCoverageExplorer.js';

describe('moveNode', () => {
  it('repositions a node by id with rounded coordinates', () => {
    const graph = { nodes: [{ id: 'A', label: 'A', x: 10, y: 20 }] };
    expect(moveNode(graph, 'A', 33.6, 44.2)).toBe(true);
    expect(graph.nodes[0]).toMatchObject({ x: 34, y: 44 });
  });
  it('returns false for an unknown node id and leaves the graph untouched', () => {
    const graph = { nodes: [{ id: 'A', label: 'A', x: 10, y: 20 }] };
    expect(moveNode(graph, 'Z', 1, 2)).toBe(false);
    expect(graph.nodes[0]).toMatchObject({ x: 10, y: 20 });
  });
});

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

  it('lists def/use before the requirements (per-node + per-variable tables)', () => {
    const el = createGraphCoverageExplorer({ preset: 'dataflow' });
    const card = el.querySelector('[data-testid="graph-defuse-card"]');
    expect(card).toBeTruthy();
    expect(el.querySelector('[data-testid="graph-defuse-empty"]')).toBeNull();

    const nodeTable = el.querySelector('[data-testid="graph-defuse-node-table"]');
    const varTable = el.querySelector('[data-testid="graph-defuse-var-table"]');
    expect(nodeTable).toBeTruthy();
    expect(varTable).toBeTruthy();
    // Per-node rows exist; per-variable rows include the params x and y.
    expect(nodeTable.querySelectorAll('[data-defuse-node]').length).toBeGreaterThan(0);
    const vars = [...varTable.querySelectorAll('[data-defuse-var]')].map((r) => r.getAttribute('data-defuse-var'));
    expect(vars).toContain('x');
    expect(vars).toContain('y');

    // The def/use card comes before the Test Requirements list in the DOM.
    const firstReq = el.querySelector('[data-requirement-id]');
    expect(firstReq).toBeTruthy();
    expect(card.compareDocumentPosition(firstReq) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('flags a definition with no reachable use as untestable (DU anomaly)', () => {
    const el = createGraphCoverageExplorer({ preset: 'dataflow' });
    const varTable = el.querySelector('[data-testid="graph-defuse-var-table"]');
    // The default generated graph defines v2 at C but never uses it.
    const v2Row = varTable.querySelector('[data-defuse-var="v2"]');
    expect(v2Row, 'v2 row present').toBeTruthy();
    expect(v2Row.getAttribute('data-defuse-untestable')).toBe('1');
    expect(el.querySelector('[data-testid="defuse-untestable-v2"]')).toBeTruthy();
    // A normal variable (x is used) is not flagged.
    const xRow = varTable.querySelector('[data-defuse-var="x"]');
    expect(xRow.getAttribute('data-defuse-untestable')).toBeNull();
    // The explanatory note appears when at least one dead def exists.
    expect(el.querySelector('[data-testid="graph-defuse-note"]')).toBeTruthy();
    // The dead def is also marked in the per-node def column.
    expect(el.querySelector('.graph-defuse-dead')).toBeTruthy();
  });

  it('flags use-before-def / undefined-variable uses (UR anomaly) via the demo', () => {
    const el = createGraphCoverageExplorer({ preset: 'dataflow' });
    document.body.appendChild(el);
    const select = el.querySelector('[data-testid="ex-select"]');
    const option = [...select.options].find((o) => o.textContent.trim().startsWith('Data-Flow Anomaly'));
    expect(option, 'anomaly demo option present').toBeTruthy();
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const varTable = el.querySelector('[data-testid="graph-defuse-var-table"]');
    // `rate` is never defined → every use is undefined → row badge.
    const rateRow = varTable.querySelector('[data-defuse-var="rate"]');
    expect(rateRow, 'rate row present').toBeTruthy();
    expect(rateRow.getAttribute('data-defuse-undefined')).toBe('1');
    expect(el.querySelector('[data-testid="defuse-undefined-rate"]')).toBeTruthy();
    // `total` is used before its def but also used after → not all uses bad → no row badge.
    const totalRow = varTable.querySelector('[data-defuse-var="total"]');
    expect(totalRow.getAttribute('data-defuse-undefined')).toBeNull();
    // but at least one use site is marked, and the UR note is present.
    expect(el.querySelector('.graph-defuse-undef')).toBeTruthy();
    expect(el.querySelector('[data-testid="graph-defuse-undef-note"]')).toBeTruthy();
    el.remove();
  });

  it('shows the def/use table in the full explorer only for data-flow criteria', () => {
    const el = createGraphCoverageExplorer();
    document.body.appendChild(el);
    // Default criterion is "node" → no def/use table.
    expect(el.querySelector('[data-testid="graph-defuse-card"]')).toBeNull();
    // Switching to all-uses reveals it.
    el.querySelector('[data-testid="criterion-all-uses"]').click();
    expect(el.querySelector('[data-testid="graph-defuse-card"]')).toBeTruthy();
    // Switching back to a structural criterion hides it again.
    el.querySelector('[data-testid="criterion-node"]').click();
    expect(el.querySelector('[data-testid="graph-defuse-card"]')).toBeNull();
    el.remove();
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
