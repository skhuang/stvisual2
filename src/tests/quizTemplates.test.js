import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { generate as boundary } from '../../scripts/quiz-templates/boundary.mjs';
import { generate as logic } from '../../scripts/quiz-templates/logic.mjs';
import { generate as graph } from '../../scripts/quiz-templates/graph.mjs';
import { generate as mutation, OUTCOMES } from '../../scripts/quiz-templates/mutation.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata', isArray: (n) => n === 'answer' });
const parseOne = (xml) => parser.parse(`<quiz>${xml}</quiz>`).quiz.question;

describe('boundary template', () => {
  it('produces the requested count of parseable questions', () => {
    const qs = boundary('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });
  it('has exactly one correct answer per question', () => {
    boundary('medium', 2, 5).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });
  it('is deterministic for a fixed seed', () => {
    expect(boundary('hard', 3, 5)).toEqual(boundary('hard', 3, 5));
  });
});

// Decode the small set of HTML entities used by esc() in scripts/quiz-templates/index.mjs.
function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function extractExpr(promptText) {
  const decoded = decodeEntities(promptText);
  const m = decoded.match(/<code>(.*?)<\/code>/);
  if (!m) throw new Error(`no <code> expression found in prompt: ${promptText}`);
  return m[1];
}

function lettersOf(expr) {
  return [...new Set(expr.match(/[a-d]/g) || [])].sort();
}

// Independent re-implementation (does not call anything from logic.mjs): builds a
// fresh evaluator directly from the expression text recovered from the question XML.
function evalExprIndependently(letters, expr, bits) {
  const fn = new Function(...letters, `return ${expr};`);
  return fn(...bits.map(Boolean));
}

function countSatisfyingIndependently(letters, expr) {
  const n = letters.length;
  let count = 0;
  for (let mask = 0; mask < (1 << n); mask++) {
    const bits = letters.map((_, i) => (mask >> i) & 1);
    if (evalExprIndependently(letters, expr, bits)) count++;
  }
  return count;
}

function activeClauseCountIndependently(letters, expr, bits) {
  const base = evalExprIndependently(letters, expr, bits);
  let active = 0;
  for (let i = 0; i < letters.length; i++) {
    const flipped = bits.slice();
    flipped[i] = flipped[i] ? 0 : 1;
    if (evalExprIndependently(letters, expr, flipped) !== base) active++;
  }
  return active;
}

describe('logic template', () => {
  it('produces the requested count of parseable multichoice questions', () => {
    const qs = logic('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });

  it('has exactly one correct answer per question', () => {
    logic('medium', 2, 12).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });

  it('is deterministic for a fixed seed', () => {
    expect(logic('hard', 3, 12)).toEqual(logic('hard', 3, 12));
  });

  it('CORRECTNESS: stated satisfying-row / active-clause counts match an independent recomputation', () => {
    ['easy', 'medium', 'hard'].forEach((level) => {
      logic(level, 42, 12).forEach((x) => {
        const q = parseOne(x);
        const promptText = q.questiontext.text.__cdata;
        const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
        const statedCorrect = Number(correctAnswer.text.__cdata ?? correctAnswer.text);

        const expr = extractExpr(promptText);
        const letters = lettersOf(expr);
        expect(letters.length).toBeGreaterThan(0);
        expect(letters.length).toBeLessThanOrEqual(4); // hard render-budget cap

        if (/how many of the \d+ possible assignments/.test(promptText)) {
          // Kind A: number of satisfying rows out of 2^n.
          const recomputed = countSatisfyingIndependently(letters, expr);
          expect(statedCorrect).toBe(recomputed);
        } else {
          // Kind B: number of "active" clauses at a specific assignment.
          const rowMatch = decodeEntities(promptText).match(/evaluated at ([^,<]+(?:, [^,<]+)*), how many/);
          expect(rowMatch).toBeTruthy();
          const bits = letters.map((l) => {
            const token = rowMatch[1].split(', ').find((t) => t.toLowerCase().startsWith(`${l}=`));
            expect(token).toBeTruthy();
            return token.toUpperCase().endsWith('T') ? 1 : 0;
          });
          const recomputed = activeClauseCountIndependently(letters, expr, bits);
          expect(statedCorrect).toBe(recomputed);
        }
      });
    });
  });
});

// Independent re-implementation for the graph template: parses the edge list straight
// out of the rendered prompt text (never touches graph.mjs internals) and recomputes
// both candidate quantities from scratch.
function extractGraphFacts(promptText) {
  const decoded = decodeEntities(promptText);
  const nodeMatch = decoded.match(/nodes 1\.\.(\d+)/);
  if (!nodeMatch) throw new Error(`no node count found in prompt: ${promptText}`);
  const n = Number(nodeMatch[1]);

  const codeMatch = decoded.match(/<code>(.*?)<\/code>/);
  if (!codeMatch) throw new Error(`no <code> edge list found in prompt: ${promptText}`);
  const edges = codeMatch[1].split(', ').filter(Boolean).map((tok) => {
    const [u, v] = tok.split('→').map(Number);
    return [u, v];
  });

  return { n, edges };
}

function countEdgesIndependently(edges) {
  return edges.length;
}

function countEdgePairsIndependently(edges) {
  let count = 0;
  for (const [, v] of edges) {
    for (const [v2] of edges) {
      if (v2 === v) count++;
    }
  }
  return count;
}

describe('graph template', () => {
  it('produces the requested count of parseable multichoice questions', () => {
    const qs = graph('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });

  it('has exactly one correct answer per question', () => {
    graph('medium', 2, 12).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });

  it('is deterministic for a fixed seed', () => {
    expect(graph('hard', 3, 12)).toEqual(graph('hard', 3, 12));
  });

  it('HAND-VERIFIED: an easy-level 3-node if-graph always has exactly 3 edges', () => {
    // easy always builds n=3 nodes: a 2-edge spanning base (1..3) plus exactly 1 extra
    // edge chosen from the single remaining non-edge slot -- so the edge count is
    // deterministically 3 regardless of seed, matching a textbook 3-node if-graph
    // (e.g. 1->2, 1->3, 2->3: an if/else that merges back together).
    graph('easy', 7, 10).forEach((x) => {
      const q = parseOne(x);
      const promptText = q.questiontext.text.__cdata;
      const { n, edges } = extractGraphFacts(promptText);
      expect(n).toBe(3);
      expect(edges).toHaveLength(3);
      if (/How many directed edges/.test(promptText)) {
        const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
        const statedCorrect = Number(correctAnswer.text.__cdata ?? correctAnswer.text);
        expect(statedCorrect).toBe(3);
      }
    });
  });

  it('CORRECTNESS: stated edge-count / edge-pair-count matches an independent recomputation', () => {
    ['easy', 'medium', 'hard'].forEach((level) => {
      graph(level, 42, 12).forEach((x) => {
        const q = parseOne(x);
        const promptText = q.questiontext.text.__cdata;
        const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
        const statedCorrect = Number(correctAnswer.text.__cdata ?? correctAnswer.text);

        const { n, edges } = extractGraphFacts(promptText);
        expect(n).toBeGreaterThan(0);
        edges.forEach(([u, v]) => {
          expect(u).toBeLessThan(v); // acyclic-by-construction invariant
          expect(v).toBeLessThanOrEqual(n);
        });

        if (/How many directed edges does this graph have/.test(promptText)) {
          expect(statedCorrect).toBe(countEdgesIndependently(edges));
        } else if (/How many length-2 paths/.test(promptText)) {
          expect(statedCorrect).toBe(countEdgePairsIndependently(edges));
        } else {
          throw new Error(`unrecognized graph question kind: ${promptText}`);
        }
      });
    });
  });
});

const MUTATION_OUTCOMES = Object.values(OUTCOMES);

describe('mutation template', () => {
  it('produces the requested count of parseable multichoice questions', () => {
    const qs = mutation('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });

  it('has exactly one correct answer per question', () => {
    mutation('medium', 2, 12).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });

  it('is deterministic for a fixed seed', () => {
    expect(mutation('hard', 3, 12)).toEqual(mutation('hard', 3, 12));
  });

  it('CORRECTNESS: every answer is one of the three allowed outcomes, and both KILLED and EQUIVALENT appear in a hard batch', () => {
    const qs = mutation('hard', 42, 16);
    const seen = new Set();
    qs.forEach((x) => {
      const q = parseOne(x);
      // exactly 3 options (correct + 2 distractors), every one from the fixed outcome set
      expect(q.answer).toHaveLength(3);
      q.answer.forEach((a) => {
        const text = a.text.__cdata ?? a.text;
        expect(MUTATION_OUTCOMES).toContain(text);
      });
      const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
      const text = correctAnswer.text.__cdata ?? correctAnswer.text;
      seen.add(text);
    });
    expect(seen.has(OUTCOMES.KILLED)).toBe(true);
    expect(seen.has(OUTCOMES.EQUIVALENT)).toBe(true);
  });

  it('HAND-VERIFIED: the loop off-by-one case is genuinely killed by every generated test input (independent recomputation)', () => {
    let checked = 0;
    mutation('hard', 7, 24).forEach((x) => {
      const q = parseOne(x);
      const promptText = q.questiontext.text.__cdata;
      const decoded = decodeEntities(promptText);
      const m = decoded.match(/arr = \[([^\]]+)\], n = (\d+)/);
      if (!m) return; // not a loop-boundary question
      checked++;
      const arr = m[1].split(',').map((s) => Number(s.trim()));
      const n = Number(m[2]);
      const originalSum = arr.slice(0, n).reduce((s, v) => s + v, 0);
      const mutantSum = arr.slice(0, n + 1).reduce((s, v) => s + v, 0);
      expect(originalSum).not.toBe(mutantSum); // independently confirms a real behavior difference
      const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
      const text = correctAnswer.text.__cdata ?? correctAnswer.text;
      expect(text).toBe(OUTCOMES.KILLED);
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('HAND-VERIFIED: the dead-store and non-negative-length cases are always classified EQUIVALENT', () => {
    let checked = 0;
    mutation('hard', 11, 24).forEach((x) => {
      const q = parseOne(x);
      const name = q.name.text;
      if (!/dead store|non-negative array length/.test(name)) return;
      checked++;
      const correctAnswer = q.answer.find((a) => a['@_fraction'] === '100');
      const text = correctAnswer.text.__cdata ?? correctAnswer.text;
      expect(text).toBe(OUTCOMES.EQUIVALENT);
    });
    expect(checked).toBeGreaterThan(0);
  });
});
