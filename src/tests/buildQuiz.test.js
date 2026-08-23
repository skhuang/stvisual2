import { describe, it, expect } from 'vitest';
import { parseQuizXml, sanitize, LEVELS, validate } from '../../scripts/build-quiz.mjs';

const cat = (path) => `<question type="category"><category><text>${path}</text></category></question>`;
const mc = (name) => `<question type="multichoice"><name><text>${name}</text></name>`
  + `<questiontext format="html"><text><![CDATA[<p>${name}?</p>]]></text></questiontext><single>true</single>`
  + `<answer fraction="100"><text>yes</text></answer><answer fraction="0"><text>no</text></answer></question>`;
const wrap = (inner) => `<?xml version="1.0"?><quiz>${inner}</quiz>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category"><category><text>$course$/top/X/easy</text></category></question>
  <question type="multichoice">
    <name><text>Q1</text></name>
    <questiontext format="html"><text><![CDATA[<p>Pick one</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text>right</text><feedback><text>yes</text></feedback></answer>
    <answer fraction="0"><text>wrong</text><feedback><text>no</text></feedback></answer>
    <generalfeedback><text>because</text></generalfeedback>
  </question>
  <question type="truefalse">
    <name><text>Q2</text></name>
    <questiontext format="html"><text><![CDATA[<p>True?</p>]]></text></questiontext>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
</quiz>`;

describe('build-quiz', () => {
  it('parses multichoice/truefalse and drops category rows', () => {
    const qs = parseQuizXml(XML);
    expect(qs.easy).toHaveLength(2);
    expect(qs.easy[0]).toMatchObject({
      type: 'multichoice', name: 'Q1', single: true, generalFeedback: 'because',
    });
    expect(qs.easy[0].answers[0]).toEqual({ text: 'right', fraction: 100, feedback: 'yes' });
    expect(qs.easy[1].type).toBe('truefalse');
  });

  it('sanitizes scripts, handlers and javascript: urls', () => {
    expect(sanitize('<p onclick="x()">a<script>bad()</script></p>'))
      .toBe('<p>a</p>');
    expect(sanitize('<a href="javascript:x">l</a>')).not.toContain('javascript:');
  });
});

describe('parseQuizXml category grouping', () => {
  it('groups questions under the preceding level marker', () => {
    const xml = wrap(cat('$course$/top/Graph Coverage/easy') + mc('e1') + mc('e2')
      + cat('$course$/top/Graph Coverage/hard') + mc('h1'));
    const g = parseQuizXml(xml);
    expect(g.easy.map((q) => q.name)).toEqual(['e1', 'e2']);
    expect(g.hard.map((q) => q.name)).toEqual(['h1']);
    expect(g.medium).toBeUndefined();
  });

  it('throws on a question before any level marker', () => {
    expect(() => parseQuizXml(wrap(mc('orphan')))).toThrow(/before.*category|no category/i);
  });

  it('throws on an unknown level token', () => {
    expect(() => parseQuizXml(wrap(cat('$course$/top/X/simple') + mc('q')))).toThrow(/level|simple/i);
  });

  it('throws on a duplicate level marker in one file', () => {
    const xml = wrap(cat('$course$/top/X/easy') + mc('a') + cat('$course$/top/X/easy') + mc('b'));
    expect(() => parseQuizXml(xml)).toThrow(/duplicate/i);
  });

  it('exports canonical levels', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
  });
});

describe('quiz validate', () => {
  const q = { type: 'multichoice', name: 'x', text: '', answers: [{ text: 'a', fraction: 100 }], generalFeedback: '' };
  const bucket = (n) => Array.from({ length: n }, () => q);

  it('throws when en and zh expose different buckets', () => {
    const r = { t: { en: { easy: bucket(1) }, zh: { easy: bucket(1), hard: bucket(1) } } };
    expect(() => validate(r, { strict: false })).toThrow(/parity|en.*zh/i);
  });

  it('warns (not throws) on <15 without strict', () => {
    const r = { t: { en: { easy: bucket(3) }, zh: { easy: bucket(3) } } };
    const { warnings } = validate(r, { strict: false });
    expect(warnings.join('\n')).toMatch(/easy.*3\/15|15/);
  });

  it('throws on incomplete buckets under strict', () => {
    const r = { t: { en: { easy: bucket(15) }, zh: { easy: bucket(15) } } };
    expect(() => validate(r, { strict: true })).toThrow(/medium|hard|15/i);
  });

  it('passes a complete topic under strict', () => {
    const full = { easy: bucket(15), medium: bucket(15), hard: bucket(15) };
    expect(() => validate({ t: { en: full, zh: full } }, { strict: true })).not.toThrow();
  });
});
