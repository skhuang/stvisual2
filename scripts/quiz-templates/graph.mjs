import { makeRng, randInt, shuffle } from '../../src/utils/randomInput.js';
import { mcQuestion, esc } from './index.mjs';

// Difficulty scales the CFG size: easy is a tiny 3-node if-graph, medium/hard add
// more nodes and more "extra" (branch/merge) edges on top of a spanning base.
function nodeCountFor(level) {
  if (level === 'easy') return 3;
  if (level === 'medium') return 5;
  return 7; // hard (and any unrecognized level defaults to the largest allowed)
}

function extraEdgeCountFor(level) {
  if (level === 'easy') return 1;
  if (level === 'medium') return 2;
  return 3;
}

// Build a small DAG-shaped control-flow graph on nodes 1..n.
// Every edge [u, v] satisfies u < v, so the graph is acyclic by construction.
// Base: each node v in 2..n gets exactly one edge from a random earlier node
// (a spanning tree, so exactly n-1 base edges, all distinct since each v is unique).
// Extra: a handful of additional u<v edges chosen from the remaining non-edges,
// modelling if/else branches and merge points in a CFG.
function buildGraph(rng, n, extraCount) {
  const edges = [];
  const key = (u, v) => `${u}-${v}`;
  const seen = new Set();
  for (let v = 2; v <= n; v++) {
    const u = randInt(rng, 1, v - 1);
    edges.push([u, v]);
    seen.add(key(u, v));
  }
  const nonEdges = [];
  for (let u = 1; u <= n; u++) {
    for (let v = u + 1; v <= n; v++) {
      if (!seen.has(key(u, v))) nonEdges.push([u, v]);
    }
  }
  const chosen = shuffle(rng, nonEdges).slice(0, Math.min(extraCount, nonEdges.length));
  for (const pair of chosen) edges.push(pair);
  edges.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return edges;
}

// Count directed edges (trivial enumeration, kept as a function for symmetry/clarity).
function countEdges(edges) {
  return edges.length;
}

// Count length-2 paths u->v->w: for every edge (u,v), count every edge (v2,w)
// whose start v2 equals v. This is a direct enumeration over all edge pairs
// sharing a middle node, i.e. every (u,v,w) triple with edges u->v and v->w.
function countEdgePairs(edges) {
  let count = 0;
  for (const [, v] of edges) {
    for (const [v2] of edges) {
      if (v2 === v) count++;
    }
  }
  return count;
}

function renderEdges(edges) {
  return edges.map(([u, v]) => `${u}→${v}`).join(', ');
}

// Pick 3 distinct non-negative distractors near `correct`, never equal to it.
function distinctDistractors(rng, correct) {
  const set = new Set();
  let guard = 0;
  const poolMax = correct + 4;
  while (set.size < 3 && guard < 100) {
    guard++;
    const v = randInt(rng, 0, poolMax);
    if (v !== correct) set.add(v);
  }
  let fallback = 0;
  while (set.size < 3) {
    if (fallback !== correct && !set.has(fallback)) set.add(fallback);
    fallback++;
  }
  return [...set];
}

export function generate(level, seed, count = 15) {
  const rng = makeRng(seed);
  const out = [];
  const n = nodeCountFor(level);
  const extraCount = extraEdgeCountFor(level);

  for (let i = 0; i < count; i++) {
    const edges = buildGraph(rng, n, extraCount);
    const edgesStr = esc(renderEdges(edges));
    const kind = i % 2;

    if (kind === 0) {
      const correct = countEdges(edges);
      const distractors = distinctDistractors(rng, correct);
      out.push(mcQuestion(rng, {
        name: `Graph edge-count ${level} ${i + 1}`,
        prompt: `The control-flow graph below has nodes 1..${n} and directed edges: <code>${edgesStr}</code>. `
          + `How many directed edges does this graph have?`,
        correct: String(correct),
        distractors: distractors.map(String),
        general: `Count each directed edge listed once; the edge list above is the complete edge set.`,
      }));
    } else {
      const correct = countEdgePairs(edges);
      const distractors = distinctDistractors(rng, correct);
      out.push(mcQuestion(rng, {
        name: `Graph edge-pair-count ${level} ${i + 1}`,
        prompt: `The control-flow graph below has nodes 1..${n} and directed edges: <code>${edgesStr}</code>. `
          + `How many length-2 paths u→v→w exist, i.e. pairs of edges (u→v) and (v→w) that share the middle node v `
          + `(count each valid (u, v, w) triple once)?`,
        correct: String(correct),
        distractors: distractors.map(String),
        general: `For every edge u→v, check each edge v→w with matching middle node v; each match is one length-2 path.`,
      }));
    }
  }
  return out;
}
