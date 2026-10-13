import { describe, expect, it } from 'vitest';
import { graphCoverageGraph } from '../data/testingData.js';
import { getAllUsesRequirements } from '../utils/graphCoverage.js';
import { buildDataFlowGraph } from '../utils/dataFlow.js';

describe('selected data-flow requirement maps to exactly one DFG def→use edge', () => {
  it('each all-uses requirement has a unique matching DFG edge the UI highlights', () => {
    const requirements = getAllUsesRequirements(graphCoverageGraph);
    expect(requirements.length).toBeGreaterThan(0);

    const dfg = buildDataFlowGraph(graphCoverageGraph);

    for (const req of requirements) {
      const matches = dfg.edges.filter(
        (edge) => edge.from === req.defNodeId
          && edge.to === req.useNodeId
          && edge.variable === req.variable,
      );
      expect(matches).toHaveLength(1);
    }
  });

  it('picks a representative requirement and finds its single def→use edge', () => {
    const requirements = getAllUsesRequirements(graphCoverageGraph);
    const req = requirements[0];
    const dfg = buildDataFlowGraph(graphCoverageGraph);

    const matching = dfg.edges.filter(
      (edge) => edge.from === req.defNodeId
        && edge.to === req.useNodeId
        && edge.variable === req.variable,
    );

    expect(matching).toHaveLength(1);
    expect(matching[0].from).toBe(req.defNodeId);
    expect(matching[0].to).toBe(req.useNodeId);
    expect(matching[0].variable).toBe(req.variable);
  });
});
