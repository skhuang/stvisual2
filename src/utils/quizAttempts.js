// localStorage-backed recent-attempt log (newest first, capped at 10).
// Ported from dsvisual js/quiz_attempts.js.
function key(quizId) { return 'stvisual:quiz:attempts:' + quizId; }

function recentFor(storage, quizId, limit) {
  try {
    const raw = storage.getItem(key(quizId));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit || 10);
  } catch { return []; }
}

function record(storage, quizId, attempt) {
  try {
    const arr = recentFor(storage, quizId, 100);
    arr.unshift(attempt);
    storage.setItem(key(quizId), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore quota/privacy errors */ }
}

function upsert(storage, quizId, attempt) {
  try {
    const arr = recentFor(storage, quizId, 100);
    const i = arr.findIndex((a) => a && a.id === attempt.id);
    if (i >= 0) arr[i] = attempt; else arr.unshift(attempt);
    storage.setItem(key(quizId), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore */ }
}

function clearFor(storage, quizId) { try { storage.removeItem(key(quizId)); } catch { /* ignore */ } }

export const QuizAttempts = { key, record, upsert, recentFor, clearFor };
