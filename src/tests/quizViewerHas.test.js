import { describe, it, expect } from 'vitest';
import { QuizViewer } from '../components/QuizViewer.js';
import { QUIZ_RENDERED } from '../data/quizRendered.js';

// The unit view gates the quiz button on QuizViewer.has(quizId ?? id). The
// catalog now ships a bank for every explorer, so this guard can no longer be
// exercised through a real unit in e2e — it is covered here instead.
describe('QuizViewer.has', () => {
  it('is false for an unknown id', () => {
    expect(QuizViewer.has('__no_such_bank__')).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(QuizViewer.has(undefined)).toBe(false);
    expect(QuizViewer.has(null)).toBe(false);
  });

  it('is true for an id whose bank has questions', () => {
    const someId = Object.keys(QUIZ_RENDERED).find((id) => {
      const t = QUIZ_RENDERED[id];
      return ['en', 'zh'].some((lg) => t[lg] && Object.values(t[lg]).some((b) => b && b.length));
    });
    expect(someId).toBeTruthy();
    expect(QuizViewer.has(someId)).toBe(true);
  });
});
