import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { generate as boundary } from '../../scripts/quiz-templates/boundary.mjs';
import { generate as logic } from '../../scripts/quiz-templates/logic.mjs';

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
