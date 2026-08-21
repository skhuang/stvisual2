import { describe, it, expect } from 'vitest';
import { gradeQuestion } from '../utils/quizGrade.js';

const mc = {
  type: 'multichoice', single: true,
  answers: [
    { text: 'right', fraction: 100, feedback: 'yes' },
    { text: 'wrong', fraction: 0, feedback: 'no' },
  ],
  generalFeedback: 'gf',
};

describe('gradeQuestion', () => {
  it('grades single multichoice by best-fraction index', () => {
    expect(gradeQuestion(mc, 0)).toMatchObject({ isCorrect: true, correctAnswers: [0], feedback: 'yes' });
    expect(gradeQuestion(mc, 1).isCorrect).toBe(false);
    expect(gradeQuestion(mc, null).isCorrect).toBe(false);
  });

  it('grades multi-select: exact positive set, any negative kills', () => {
    const q = { type: 'multichoice', single: false, answers: [
      { text: 'a', fraction: 50 }, { text: 'b', fraction: 50 }, { text: 'c', fraction: -100 },
    ], generalFeedback: '' };
    expect(gradeQuestion(q, [0, 1]).isCorrect).toBe(true);
    expect(gradeQuestion(q, [0]).isCorrect).toBe(false);
    expect(gradeQuestion(q, [0, 1, 2]).isCorrect).toBe(false);
  });

  it('grades shortanswer case-insensitively with * wildcard', () => {
    const q = { type: 'shortanswer', usecase: false, answers: [
      { text: 'edge*coverage', fraction: 100 },
    ], generalFeedback: 'gf' };
    expect(gradeQuestion(q, 'Edge Pair Coverage').isCorrect).toBe(true);
    expect(gradeQuestion(q, 'node coverage').isCorrect).toBe(false);
    expect(gradeQuestion(q, '').isCorrect).toBe(false);
  });

  it('grades truefalse', () => {
    const q = { type: 'truefalse', answers: [
      { text: 'true', fraction: 100 }, { text: 'false', fraction: 0 },
    ], generalFeedback: '' };
    expect(gradeQuestion(q, 0).isCorrect).toBe(true);
  });
});
