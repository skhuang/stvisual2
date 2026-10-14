// Per-difficulty control-flow-graph presets and randomized generator for the
// Graph Coverage explorer's "example input" feature. Graph shape matches
// `graphCoverageGraph` in ./testingData.js.
import { makeRng, randInt, pick } from '../utils/randomInput.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQR'.split('');

function node(id, depth, row, kind) {
  return { id, label: id === 'S' ? 'Start' : id === 'T' ? 'End' : id, x: 80 + depth * 140, y: 170 + row * 90, kind: kind || 'node' };
}
function graphFrom(nodes, edges) {
  return { id: 'random-cfg', title: '隨機控制流程圖', titleEn: 'Random CFG',
    startNodeId: 'S', endNodeId: 'T', nodes, edges: edges.map((e) => ({ id: `${e.from}-${e.to}`, from: e.from, to: e.to, ...(e.control ? { control: e.control } : {}) })) };
}

// Give every node a `sourceText` line so the data-flow analyzer (extractDefUse
// in utils/dataFlow.js) finds real variable definitions and uses. Without this
// the generated CFGs carry only abstract ids and the Data-Flow Coverage view
// reports zero def/use requirements. The scheme is deterministic:
//   - start: `function run(x, y)`      → defines the two params
//   - assignment node: `vK = a + b`    → defines vK, reuses two earlier vars
//   - decision/fork node: `if (a > b)` → two pure uses, no def
//   - diamond sibling: `vParallel = x - y` → a parallel def of the var its
//     partner on the spine defines, so successors see merging def→use paths
//   - end: `return v0` (or `x`)        → a use that reaches back to the spine
function annotateSource(nodes, chain, siblingOf) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const work = ['x', 'y']; // variables available to reference on the right-hand side
  const defVarOf = new Map(); // spine node id -> the variable it defines
  let assignIdx = 0; // counts assignment nodes, for both var naming and operand rotation
  let decisionIdx = 0;

  const start = byId.get('S');
  if (start) start.sourceText = 'function run(x, y)';

  for (let idx = 1; idx < chain.length - 1; idx++) {
    const n = byId.get(chain[idx]);
    if (!n) continue;
    if (n.kind === 'decision') {
      const a = work[decisionIdx % work.length];
      const b = work[(decisionIdx + 1) % work.length];
      n.sourceText = `if (${a} > ${b})`;
      decisionIdx++;
    } else {
      const a = work[assignIdx % work.length];
      const b = work[(assignIdx + 1) % work.length];
      const v = `v${assignIdx}`;
      n.sourceText = `${v} = ${a} + ${b}`;
      defVarOf.set(n.id, v);
      work.push(v);
      assignIdx++;
    }
  }

  for (const [sibId, parallelId] of siblingOf) {
    const n = byId.get(sibId);
    if (!n) continue;
    const parallelVar = defVarOf.get(parallelId);
    if (parallelVar) {
      n.sourceText = `${parallelVar} = x - y`; // merge def: same lvalue, different path
    } else {
      const v = `v${assignIdx++}`;
      n.sourceText = `${v} = x * y`;
      work.push(v);
    }
  }

  const end = byId.get('T');
  if (end) {
    const firstDef = defVarOf.values().next().value;
    end.sourceText = `return ${firstDef || 'x'}`;
  }
}

// Build a spine S -> mids... -> T with `branchCount` diamond branches and
// `loopCount` back-edges. midCount excludes S and T.
function build(midCount, branchCount, loopCount) {
  const mids = LETTERS.slice(0, midCount);
  const chain = ['S', ...mids, 'T'];
  const nodes = chain.map((id, i) => node(id, i, 0, id === 'S' ? 'start' : id === 'T' ? 'end' : 'node'));
  const edges = [];
  for (let i = 0; i < chain.length - 1; i++) edges.push({ from: chain[i], to: chain[i + 1] });
  // diamonds: pick a chain node, add a parallel sibling that rejoins the next node
  const siblingOf = new Map(); // sibling id -> the spine node it runs parallel to
  let sib = 0;
  for (let b = 0; b < branchCount && b + 1 < mids.length; b++) {
    const at = 1 + b; // index into chain, a mid node
    const from = chain[at - 1], rejoin = chain[at + 1];
    const sibId = `X${sib++}`;
    nodes.push(node(sibId, at, 1));
    // mark the fork node as a decision
    const forkNode = nodes.find((n) => n.id === from); if (forkNode && forkNode.kind === 'node') forkNode.kind = 'decision';
    edges.push({ from, to: sibId }, { from: sibId, to: rejoin });
    siblingOf.set(sibId, chain[at]);
  }
  // loops: add a back-edge from a later mid to an earlier mid
  for (let l = 0; l < loopCount && mids.length >= 2; l++) {
    const hi = 1 + Math.min(mids.length - 1, 2 + l), lo = 1 + Math.min(mids.length - 2, l);
    if (hi > lo) edges.push({ from: chain[hi], to: chain[lo], control: { x: 80 + lo * 140, y: 40 } });
  }
  annotateSource(nodes, chain, siblingOf);
  return graphFrom(nodes, edges);
}

export function presetForDifficulty(tier) {
  switch (tier) {
    case 'edge':    return build(1, 0, 0);            // S -> A -> T
    case 'large':   return build(8, 3, 2);
    case 'special': return build(4, 2, 2);            // loops + branches
    case 'normal':
    default:        return build(3, 1, 1);
  }
}

export function randomGraph(tier, rng = makeRng()) {
  switch (tier) {
    case 'edge':    return build(randInt(rng, 1, 2), 0, 0);
    case 'large':   return build(randInt(rng, 8, 12), randInt(rng, 2, 3), randInt(rng, 1, 2));
    case 'special': return build(randInt(rng, 4, 6), randInt(rng, 1, 2), 2);
    case 'normal':
    default:        return build(randInt(rng, 3, 5), randInt(rng, 1, 2), pick(rng, [0, 1]));
  }
}

export function graphToEdgesText(graph) {
  return graph.edges.map((e) => `${e.id || `${e.from}-${e.to}`},${e.from},${e.to}`).join('\n');
}

export function edgesTextLooksValid(text) {
  return String(text).trim().split('\n').every((l) => l.split(',').length >= 3);
}
