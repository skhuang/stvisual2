import { describe, expect, it } from 'vitest';
import { graphCoverageGraph, graphCoverageProgramExamples } from '../data/testingData.js';
import {
  getAllDefsRequirements,
  getAllDuPathsRequirements,
  getAllUsesRequirements,
} from '../utils/graphCoverage.js';
import { generateControlFlowGraphFromProgram } from '../utils/programToGraph.js';

describe('graph coverage default data has real variable data', () => {
  it('the default control-flow graph yields data-flow requirements', () => {
    expect(getAllDefsRequirements(graphCoverageGraph).length).toBeGreaterThan(0);
    expect(getAllUsesRequirements(graphCoverageGraph).length).toBeGreaterThan(0);
    expect(getAllDuPathsRequirements(graphCoverageGraph).length).toBeGreaterThan(0);
  });

  it('the Data-Flow Demo example yields def/use pairs from its generated CFG', () => {
    const example = graphCoverageProgramExamples.find((entry) => entry.id === 'dataflow-demo');
    expect(example).toBeTruthy();

    const graph = generateControlFlowGraphFromProgram({
      sourceCode: example.sourceCode,
      language: example.language,
      title: example.name,
    });

    expect(getAllDefsRequirements(graph).length).toBeGreaterThan(0);
    expect(getAllUsesRequirements(graph).length).toBeGreaterThan(0);
    expect(getAllDuPathsRequirements(graph).length).toBeGreaterThan(0);
  });
});
