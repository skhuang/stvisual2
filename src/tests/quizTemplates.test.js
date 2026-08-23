import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { generate as boundary } from '../../scripts/quiz-templates/boundary.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata', isArray: (n) => n === 'answer' });
const parseOne = (xml) => parser.parse(`<quiz>${xml}</quiz>`).quiz.question;

describe('boundary template', () => {
  it('produces the requested count of parseable questions', () => {
    const qs = boundary('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });
  it('has exactly one correct answer per question', () => {
    boundary('medium', 2, 5).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });
  it('is deterministic for a fixed seed', () => {
    expect(boundary('hard', 3, 5)).toEqual(boundary('hard', 3, 5));
  });
});
