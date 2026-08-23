// Builds src/data/quizRendered.js from quizzes/{en,zh}/*.xml (Moodle XML).
// Supported question types: multichoice, truefalse, shortanswer.
// Usage: node scripts/build-quiz.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => name === 'question' || name === 'answer',
});

export const LEVELS = ['easy', 'medium', 'hard'];

function categoryLevel(q) {
  // q is a <question type="category">; return its last path segment.
  const text = rawText(q.category);          // e.g. "$course$/top/Graph Coverage/easy"
  const seg = String(text).split('/').map((s) => s.trim()).filter(Boolean).pop();
  return seg || '';
}

function rawText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  const t = node.text !== undefined ? node.text : node;
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (t.__cdata !== undefined) return String(t.__cdata);
  if (t['#text'] !== undefined) return String(t['#text']);
  return '';
}

export function sanitize(html) {
  return String(html)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function normQuestion(q) {
  const type = q['@_type'];
  if (type !== 'multichoice' && type !== 'truefalse' && type !== 'shortanswer') return null;
  const answersRaw = q.answer || [];
  const answers = (Array.isArray(answersRaw) ? answersRaw : [answersRaw]).map((a) => ({
    text: sanitize(rawText(a)),
    fraction: parseFloat(a['@_fraction'] || '0') || 0,
    feedback: sanitize(rawText(a.feedback)),
  }));
  const out = {
    type,
    name: rawText(q.name),
    text: sanitize(rawText(q.questiontext)),
    answers,
    generalFeedback: sanitize(rawText(q.generalfeedback)),
  };
  if (type === 'multichoice') out.single = String(q.single) === 'true';
  if (type === 'shortanswer') out.usecase = String(q.usecase) === '1';
  return out;
}

export function parseQuizXml(xml) {
  const doc = parser.parse(xml);
  const questions = doc?.quiz?.question ?? [];
  const groups = {};
  let current = null;
  const seen = new Set();
  for (const q of questions) {
    if (q['@_type'] === 'category') {
      const level = categoryLevel(q);
      if (!LEVELS.includes(level)) {
        throw new Error(`quiz: unknown difficulty level "${level}" (expected ${LEVELS.join('/')})`);
      }
      if (seen.has(level)) throw new Error(`quiz: duplicate "${level}" category marker`);
      seen.add(level);
      current = level;
      groups[level] = groups[level] || [];
      continue;
    }
    const norm = normQuestion(q);
    if (!norm) continue;                       // unsupported type — skip silently as before
    if (!current) throw new Error('quiz: question appears before any category marker');
    groups[current].push(norm);
  }
  return groups;
}

function buildLang(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).sort()) {
    const id = f.replace(/\.xml$/, '');
    const groups = parseQuizXml(fs.readFileSync(path.join(dir, f), 'utf8'));
    const total = LEVELS.reduce((n, lv) => n + (groups[lv]?.length || 0), 0);
    if (!total) throw new Error(`quiz: no supported questions in ${dir}/${f}`);
    out[id] = groups;
  }
  return out;
}

export function buildAll() {
  const en = buildLang(path.join(ROOT, 'quizzes', 'en'));
  const zh = buildLang(path.join(ROOT, 'quizzes', 'zh'));
  const rendered = {};
  for (const id of [...new Set([...Object.keys(en), ...Object.keys(zh)])].sort()) {
    rendered[id] = { en: en[id] || {}, zh: zh[id] || {} };
  }
  return rendered;
}

export function validate(rendered, { strict } = {}) {
  const warnings = [];
  for (const [id, langs] of Object.entries(rendered)) {
    const enB = Object.keys(langs.en || {}).sort();
    const zhB = Object.keys(langs.zh || {}).sort();
    if (enB.join(',') !== zhB.join(',')) {
      throw new Error(`quiz: ${id} en/zh bucket parity mismatch (en=${enB} zh=${zhB})`);
    }
    for (const lv of LEVELS) {
      const enLen = langs.en?.[lv]?.length || 0;
      const zhLen = langs.zh?.[lv]?.length || 0;
      if (enLen > 0 && zhLen > 0 && enLen !== zhLen) {
        throw new Error(`quiz: ${id} ${lv} en/zh length mismatch (en=${enLen} zh=${zhLen})`);
      }
    }
    for (const lang of ['en', 'zh']) {
      for (const lv of LEVELS) {
        const n = langs[lang]?.[lv]?.length || 0;
        if (n !== 15) {
          const msg = `quiz: ${id} ${lang}/${lv} has ${n}/15`;
          if (strict) throw new Error(msg);
          if (n > 0 && n < 15) warnings.push(msg);
        }
      }
      if (strict) {
        for (const lv of LEVELS) {
          if (!(langs[lang]?.[lv]?.length)) throw new Error(`quiz: ${id} ${lang} missing ${lv} bucket`);
        }
      }
    }
  }
  return { warnings };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const rendered = buildAll();
  const strict = process.argv.includes('--strict');
  const { warnings } = validate(rendered, { strict });
  warnings.forEach((w) => console.warn('WARN', w));
  const file = path.join(ROOT, 'src', 'data', 'quizRendered.js');
  fs.writeFileSync(file,
    '// AUTO-GENERATED by scripts/build-quiz.mjs — do not edit by hand.\n'
    + '// Source of truth: quizzes/{en,zh}/*.xml\n'
    + 'export const QUIZ_RENDERED = ' + JSON.stringify(rendered, null, 2) + ';\n');
  console.log('Generated quiz banks:', Object.keys(rendered).join(', ') || '(none)');
}
