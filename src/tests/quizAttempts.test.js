import { describe, it, expect, beforeEach } from 'vitest';
import { QuizAttempts } from '../utils/quizAttempts.js';

describe('QuizAttempts', () => {
  beforeEach(() => localStorage.clear());

  it('records newest-first and caps at 10', () => {
    for (let i = 0; i < 12; i++) {
      QuizAttempts.record(localStorage, 'graph-coverage', { id: i, correct: i });
    }
    const r = QuizAttempts.recentFor(localStorage, 'graph-coverage', 10);
    expect(r).toHaveLength(10);
    expect(r[0].id).toBe(11);
  });

  it('upsert replaces an attempt by id', () => {
    QuizAttempts.upsert(localStorage, 'x', { id: 7, correct: 1 });
    QuizAttempts.upsert(localStorage, 'x', { id: 7, correct: 5 });
    const r = QuizAttempts.recentFor(localStorage, 'x', 10);
    expect(r).toHaveLength(1);
    expect(r[0].correct).toBe(5);
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('stvisual:quiz:attempts:bad', '{nope');
    expect(QuizAttempts.recentFor(localStorage, 'bad', 10)).toEqual([]);
  });
});
