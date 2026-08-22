import { describe, it, expect } from 'vitest';
import { createGraphCoverageExplorer, GRAPH_PRESETS } from '../components/GraphCoverageExplorer.js';
import { graphCoverageCriteria } from '../data/testingData.js';

describe('GraphCoverageExplorer presets', () => {
  it('preset criteria ids all exist in graphCoverageCriteria', () => {
    const known = new Set(graphCoverageCriteria.map((c) => c.id));
    for (const cfg of Object.values(GRAPH_PRESETS)) {
      cfg.criteria.forEach((id) => expect(known.has(id)).toBe(true));
    }
  });
  it('structural preset shows only its chips and hides editor/upload', () => {
    const el = createGraphCoverageExplorer({ preset: 'structural' });
    const chips = el.querySelectorAll('[data-testid^="criterion-"]');
    expect([...chips].map((c) => c.dataset.criterion).sort()).toEqual(['edge', 'node']);
    expect(el.querySelector('[data-testid="graph-source-card"]')).toBeNull();
    expect(el.querySelector('[data-testid="graph-editor-card"]')).toBeNull();
    expect(el.querySelector('[data-testid="ex-select"]')).toBeTruthy(); // example controls present
    expect(el.querySelector('[data-testid="test-path-metrics"]')).toBeNull();
  });
  it('dataflow preset keeps the DFG card; path preset hides it', () => {
    expect(createGraphCoverageExplorer({ preset: 'dataflow' }).querySelector('[data-testid="graph-dfg-card"]')).toBeTruthy();
    expect(createGraphCoverageExplorer({ preset: 'path' }).querySelector('[data-testid="graph-dfg-card"]')).toBeNull();
  });
  it('no preset renders the full 8-criterion switcher and editor', () => {
    const el = createGraphCoverageExplorer();
    expect(el.querySelectorAll('[data-testid^="criterion-"]').length).toBe(8);
    expect(el.querySelector('[data-testid="graph-editor-card"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="test-path-metrics"]')).toBeTruthy();
  });
});
