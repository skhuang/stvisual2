import { describe, it, expect, beforeEach } from 'vitest';
import { QuizAttempts } from '../utils/quizAttempts.js';

class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, v); }
  removeItem(k) { this.m.delete(k); }
}

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

  it('keys attempts by quizId + difficulty', () => {
    const s = new MemStorage(); // existing test helper; if absent, use a Map-backed stub
    QuizAttempts.upsert(s, 'graph-coverage', { id: 1, correct: 3, total: 15 }, 'easy');
    QuizAttempts.upsert(s, 'graph-coverage', { id: 2, correct: 9, total: 15 }, 'hard');
    expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'easy').map((a) => a.id)).toEqual([1]);
    expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'hard').map((a) => a.id)).toEqual([2]);
  });

  it('reads legacy attempts when difficulty is omitted', () => {
    const s = new MemStorage();
    s.setItem('stvisual:quiz:attempts:graph-coverage', JSON.stringify([{ id: 9, correct: 1, total: 6 }]));
    expect(QuizAttempts.recentFor(s, 'graph-coverage', 10).map((a) => a.id)).toEqual([9]);
    expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'easy')).toEqual([]);
  });
});
