// localStorage-backed recent-attempt log (newest first, capped at 10).
// Ported from dsvisual js/quiz_attempts.js.
// Keyed by quizId, optionally scoped by difficulty; omitting difficulty
// keeps reading/writing the legacy flat key so pre-existing attempts
// remain visible.
function key(quizId, difficulty) {
  const base = 'stvisual:quiz:attempts:' + quizId;
  return difficulty ? base + ':' + difficulty : base;
}

function recentFor(storage, quizId, limit, difficulty) {
  try {
    const raw = storage.getItem(key(quizId, difficulty));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit || 10);
  } catch { return []; }
}

function record(storage, quizId, attempt, difficulty) {
  try {
    const arr = recentFor(storage, quizId, 100, difficulty);
    arr.unshift(attempt);
    storage.setItem(key(quizId, difficulty), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore quota/privacy errors */ }
}

function upsert(storage, quizId, attempt, difficulty) {
  try {
    const arr = recentFor(storage, quizId, 100, difficulty);
    const i = arr.findIndex((a) => a && a.id === attempt.id);
    if (i >= 0) arr[i] = attempt; else arr.unshift(attempt);
    storage.setItem(key(quizId, difficulty), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore */ }
}

function clearFor(storage, quizId, difficulty) { try { storage.removeItem(key(quizId, difficulty)); } catch { /* ignore */ } }

export const QuizAttempts = { key, record, upsert, recentFor, clearFor };
