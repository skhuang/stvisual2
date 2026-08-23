import { shuffle } from '../../src/utils/randomInput.js';

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mcQuestion(rng, { name, prompt, correct, distractors, general }) {
  const answers = shuffle(rng, [
    { text: correct, f: 100 },
    ...distractors.map((d) => ({ text: d, f: 0 })),
  ]);
  const ans = answers.map((a) => `<answer fraction="${a.f}"><text>${esc(a.text)}</text></answer>`).join('');
  return `<question type="multichoice"><name><text>${esc(name)}</text></name>`
    + `<questiontext format="html"><text><![CDATA[<p>${prompt}</p>]]></text></questiontext>`
    + `<single>true</single>${ans}`
    + (general ? `<generalfeedback><text>${esc(general)}</text></generalfeedback>` : '')
    + `</question>`;
}
