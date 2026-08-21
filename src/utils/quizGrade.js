// Grades one quiz question. Ported from dsvisual js/quiz_grade.js.
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function saMatch(given, answer, usecase) {
  let g = String(given == null ? '' : given).trim();
  let a = String(answer.text == null ? '' : answer.text).trim();
  if (g === '') return false;
  if (!usecase) { g = g.toLowerCase(); a = a.toLowerCase(); }
  const rx = new RegExp('^' + a.split('*').map(escRe).join('.*') + '$');
  return rx.test(g);
}

function bestIndex(answers) {
  let bi = -1, bf = 0;
  answers.forEach((a, i) => { if (a.fraction > bf) { bf = a.fraction; bi = i; } });
  return bi;
}

export function gradeQuestion(q, given) {
  if (q.type === 'shortanswer') {
    const isCorrect = q.answers.some((a) => a.fraction > 0 && saMatch(given, a, q.usecase));
    return {
      isCorrect,
      correctAnswers: q.answers.filter((a) => a.fraction > 0).map((a) => a.text),
      feedback: q.generalFeedback,
    };
  }
  if (q.type === 'truefalse' || (q.type === 'multichoice' && q.single)) {
    const ci = bestIndex(q.answers);
    const isCorrect = given === ci;
    const fb = (given != null && q.answers[given] && q.answers[given].feedback) || q.generalFeedback;
    return { isCorrect, correctAnswers: [ci], feedback: fb };
  }
  // multichoice, multiple answers: exact positive set; any negative pick kills.
  const sel = Array.isArray(given) ? [...given].sort((a, b) => a - b) : [];
  const correct = q.answers
    .map((a, i) => ({ i, f: a.fraction }))
    .filter((x) => x.f > 0).map((x) => x.i).sort((a, b) => a - b);
  const anyNeg = sel.some((i) => q.answers[i] && q.answers[i].fraction < 0);
  const isCorrect = !anyNeg && sel.length === correct.length && sel.every((v, k) => v === correct[k]);
  return { isCorrect, correctAnswers: correct, feedback: q.generalFeedback };
}
