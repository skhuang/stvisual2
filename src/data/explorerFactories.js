// componentName → factory. The factory returns a mounted-ready DOM element.
import { createTestingMethodTree } from '../components/TestingMethodTree.js';
import { createGraphCoverageExplorer } from '../components/GraphCoverageExplorer.js';
import { createLogicCoverageExplorer } from '../components/LogicCoverageExplorer.js';
import { createTestingFlow } from '../components/TestingFlow.js';
import { createTestingTypesTable } from '../components/TestingTypesTable.js';
import { createSyntaxCoverageExplorer } from '../components/SyntaxCoverageExplorer.js';
import { createGrammarCoverageExplorer } from '../components/GrammarCoverageExplorer.js';
import { createSpecMutationExplorer } from '../components/SpecMutationExplorer.js';
import { createSymbolicExecutionExplorer } from '../components/SymbolicExecutionExplorer.js';
import { createConcolicExecutionExplorer } from '../components/ConcolicExecutionExplorer.js';
import { createFuzzTestingExplorer } from '../components/FuzzTestingExplorer.js';
import { createTestGenerationExplorer } from '../components/TestGenerationExplorer.js';
import { createBoundaryValueExplorer } from '../components/BoundaryValueExplorer.js';
import { createEquivalenceClassExplorer } from '../components/EquivalenceClassExplorer.js';
import { createInputSpacePartitioningExplorer } from '../components/InputSpacePartitioningExplorer.js';
import { createDecisionTableExplorer } from '../components/DecisionTableExplorer.js';
import { createStateTransitionExplorer } from '../components/StateTransitionExplorer.js';
import { createMetamorphicTestingExplorer } from '../components/MetamorphicTestingExplorer.js';
import { createExploratoryTestingExplorer } from '../components/ExploratoryTestingExplorer.js';
import { createTestDoublesExplorer } from '../components/TestDoublesExplorer.js';
import { createDefectCostExplorer } from '../components/DefectCostExplorer.js';
import { createVModelExplorer } from '../components/VModelExplorer.js';
import { createPyramidAdjusterExplorer } from '../components/PyramidAdjusterExplorer.js';
import { createPairwiseExplorer } from '../components/PairwiseExplorer.js';
import { createCauseEffectExplorer } from '../components/CauseEffectExplorer.js';
import { createCodeCoverageExplorer } from '../components/CodeCoverageExplorer.js';
import { createIntegrationTestingExplorer } from '../components/IntegrationTestingExplorer.js';
import { createPropertyBasedTestingExplorer } from '../components/PropertyBasedTestingExplorer.js';
import { createRiskBasedTestingExplorer } from '../components/RiskBasedTestingExplorer.js';
import { createGroupTheoryExplorer } from '../components/GroupTheoryExplorer.js';
import { createEquivalentMutantExplorer } from '../components/EquivalentMutantExplorer.js';
import { createMutationScoreExplorer } from '../components/MutationScoreExplorer.js';
import { createLLMPipelineExplorer } from '../components/LLMPipelineExplorer.js';
import { createTestQualityExplorer } from '../components/TestQualityExplorer.js';
import { createFaultDirectedTestingExplorer } from '../components/FaultDirectedTestingExplorer.js';
import { createSAILORPipelineExplorer } from '../components/SAILORPipelineExplorer.js';
import { createBDDGherkinExplorer } from '../components/BDDGherkinExplorer.js';
import { createUseCaseDerivationExplorer } from '../components/UseCaseDerivationExplorer.js';
import { createE2EUserJourneyExplorer } from '../components/E2EUserJourneyExplorer.js';
import { createContractTestingExplorer } from '../components/ContractTestingExplorer.js';
import { createPerformanceLoadProfileExplorer } from '../components/PerformanceLoadProfileExplorer.js';
import { createChaosEngineeringExplorer } from '../components/ChaosEngineeringExplorer.js';
import { createATDDCycleExplorer } from '../components/ATDDCycleExplorer.js';
import { createFlakyDiagnosisExplorer } from '../components/FlakyDiagnosisExplorer.js';
import { createMBTWorkflowExplorer } from '../components/MBTWorkflowExplorer.js';
import { createFSMTestGenerationExplorer } from '../components/FSMTestGenerationExplorer.js';
import { createWMethodConformanceExplorer } from '../components/WMethodConformanceExplorer.js';
import { createEFSMGuardedTransitionExplorer } from '../components/EFSMGuardedTransitionExplorer.js';
import { createUsageModelStatisticalExplorer } from '../components/UsageModelStatisticalExplorer.js';
import { createModelMutationExplorer } from '../components/ModelMutationExplorer.js';
import { createAgileQuadrantsExplorer } from '../components/AgileQuadrantsExplorer.js';
import { createSprintCadenceExplorer } from '../components/SprintCadenceExplorer.js';
import { createDefinitionGatesExplorer } from '../components/DefinitionGatesExplorer.js';
import { createExampleMappingExplorer } from '../components/ExampleMappingExplorer.js';
import { createContinuousTestingPipelineExplorer } from '../components/ContinuousTestingPipelineExplorer.js';
import { createRegressionDebtExplorer } from '../components/RegressionDebtExplorer.js';
import { createProgramSlicingExplorer } from '../components/ProgramSlicingExplorer.js';
import { createSliceDicingExplorer } from '../components/SliceDicingExplorer.js';
import { createSliceCoverageExplorer } from '../components/SliceCoverageExplorer.js';
import { createSliceRegressionExplorer } from '../components/SliceRegressionExplorer.js';
import { createTddCycleExplorer } from '../components/TddCycleExplorer.js';
import { createTddRulesExplorer } from '../components/TddRulesExplorer.js';
import { createExploitOverflowExplorer } from '../components/ExploitOverflowExplorer.js';
import { createExploitSqliExplorer } from '../components/ExploitSqliExplorer.js';
import { createExploitCmdiExplorer } from '../components/ExploitCmdiExplorer.js';
import { createExploitPathExplorer } from '../components/ExploitPathExplorer.js';
import { createSbstBranchExplorer } from '../components/SbstBranchExplorer.js';
import { createSbstCompareExplorer } from '../components/SbstCompareExplorer.js';
import { createSbstSuiteExplorer } from '../components/SbstSuiteExplorer.js';

export const FACTORY_BY_COMPONENT = {
  TestingMethodTree: createTestingMethodTree,
  GraphCoverageExplorer: createGraphCoverageExplorer,
  LogicCoverageExplorer: createLogicCoverageExplorer,
  GraphStructuralExplorer: () => createGraphCoverageExplorer({ preset: 'structural' }),
  GraphPathExplorer:       () => createGraphCoverageExplorer({ preset: 'path' }),
  GraphDataflowExplorer:   () => createGraphCoverageExplorer({ preset: 'dataflow' }),
  LogicBasicExplorer:          () => createLogicCoverageExplorer({ preset: 'basic' }),
  LogicActiveClauseExplorer:   () => createLogicCoverageExplorer({ preset: 'active' }),
  LogicInactiveClauseExplorer: () => createLogicCoverageExplorer({ preset: 'inactive' }),
  LogicDnfExplorer:            () => createLogicCoverageExplorer({ preset: 'dnf' }),
  TestingFlow: createTestingFlow,
  TestingTypesTable: createTestingTypesTable,
  SyntaxCoverageExplorer: createSyntaxCoverageExplorer,
  GrammarCoverageExplorer: createGrammarCoverageExplorer,
  SpecMutationExplorer: createSpecMutationExplorer,
  SymbolicExecutionExplorer: createSymbolicExecutionExplorer,
  ConcolicExecutionExplorer: createConcolicExecutionExplorer,
  FuzzTestingExplorer: createFuzzTestingExplorer,
  TestGenerationExplorer: createTestGenerationExplorer,
  BoundaryValueExplorer: createBoundaryValueExplorer,
  EquivalenceClassExplorer: createEquivalenceClassExplorer,
  InputSpacePartitioningExplorer: createInputSpacePartitioningExplorer,
  DecisionTableExplorer: createDecisionTableExplorer,
  StateTransitionExplorer: createStateTransitionExplorer,
  MetamorphicTestingExplorer: createMetamorphicTestingExplorer,
  ExploratoryTestingExplorer: createExploratoryTestingExplorer,
  TestDoublesExplorer: createTestDoublesExplorer,
  DefectCostExplorer: createDefectCostExplorer,
  VModelExplorer: createVModelExplorer,
  PyramidAdjusterExplorer: createPyramidAdjusterExplorer,
  PairwiseExplorer: createPairwiseExplorer,
  CauseEffectExplorer: createCauseEffectExplorer,
  CodeCoverageExplorer: createCodeCoverageExplorer,
  IntegrationTestingExplorer: createIntegrationTestingExplorer,
  PropertyBasedTestingExplorer: createPropertyBasedTestingExplorer,
  RiskBasedTestingExplorer: createRiskBasedTestingExplorer,
  GroupTheoryExplorer: createGroupTheoryExplorer,
  EquivalentMutantExplorer: createEquivalentMutantExplorer,
  MutationScoreExplorer: createMutationScoreExplorer,
  LLMPipelineExplorer: createLLMPipelineExplorer,
  TestQualityExplorer: createTestQualityExplorer,
  FaultDirectedTestingExplorer: createFaultDirectedTestingExplorer,
  SAILORPipelineExplorer: createSAILORPipelineExplorer,
  BDDGherkinExplorer: createBDDGherkinExplorer,
  UseCaseDerivationExplorer: createUseCaseDerivationExplorer,
  E2EUserJourneyExplorer: createE2EUserJourneyExplorer,
  ContractTestingExplorer: createContractTestingExplorer,
  PerformanceLoadProfileExplorer: createPerformanceLoadProfileExplorer,
  ChaosEngineeringExplorer: createChaosEngineeringExplorer,
  ATDDCycleExplorer: createATDDCycleExplorer,
  FlakyDiagnosisExplorer: createFlakyDiagnosisExplorer,
  MBTWorkflowExplorer: createMBTWorkflowExplorer,
  FSMTestGenerationExplorer: createFSMTestGenerationExplorer,
  WMethodConformanceExplorer: createWMethodConformanceExplorer,
  EFSMGuardedTransitionExplorer: createEFSMGuardedTransitionExplorer,
  UsageModelStatisticalExplorer: createUsageModelStatisticalExplorer,
  ModelMutationExplorer: createModelMutationExplorer,
  AgileQuadrantsExplorer: createAgileQuadrantsExplorer,
  SprintCadenceExplorer: createSprintCadenceExplorer,
  DefinitionGatesExplorer: createDefinitionGatesExplorer,
  ExampleMappingExplorer: createExampleMappingExplorer,
  ContinuousTestingPipelineExplorer: createContinuousTestingPipelineExplorer,
  RegressionDebtExplorer: createRegressionDebtExplorer,
  ProgramSlicingExplorer: createProgramSlicingExplorer,
  SliceDicingExplorer: createSliceDicingExplorer,
  SliceCoverageExplorer: createSliceCoverageExplorer,
  SliceRegressionExplorer: createSliceRegressionExplorer,
  TddCycleExplorer: createTddCycleExplorer,
  TddRulesExplorer: createTddRulesExplorer,
  ExploitOverflowExplorer: createExploitOverflowExplorer,
  ExploitSqliExplorer: createExploitSqliExplorer,
  ExploitCmdiExplorer: createExploitCmdiExplorer,
  ExploitPathExplorer: createExploitPathExplorer,
  SbstBranchExplorer: createSbstBranchExplorer,
  SbstCompareExplorer: createSbstCompareExplorer,
  SbstSuiteExplorer: createSbstSuiteExplorer,
};
