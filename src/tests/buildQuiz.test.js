import { describe, it, expect } from 'vitest';
import { parseQuizXml, sanitize } from '../../scripts/build-quiz.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category"><category><text>$course$/top/X</text></category></question>
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
    expect(qs).toHaveLength(2);
    expect(qs[0]).toMatchObject({
      type: 'multichoice', name: 'Q1', single: true, generalFeedback: 'because',
    });
    expect(qs[0].answers[0]).toEqual({ text: 'right', fraction: 100, feedback: 'yes' });
    expect(qs[1].type).toBe('truefalse');
  });

  it('sanitizes scripts, handlers and javascript: urls', () => {
    expect(sanitize('<p onclick="x()">a<script>bad()</script></p>'))
      .toBe('<p>a</p>');
    expect(sanitize('<a href="javascript:x">l</a>')).not.toContain('javascript:');
  });
});
