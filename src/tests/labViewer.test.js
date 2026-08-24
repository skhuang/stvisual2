import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The lab registry is a build artifact; stub it so the viewer can be driven
// with both kinds of lab (judge-wired and not).
const LAB = {
  slug: 'lab02-coverage',
  titleZh: '涵蓋率', titleEn: 'Coverage',
  week: 4, difficulty: 2,
  repoUrl: null, judgeUrl: null,
  judgeProblemId: 'st-lab02-coverage',
  judgeBase: 'https://judge.example/',
  statementHtml: { zh: '<h1>zh</h1>', en: '<h1>en</h1>' },
  samples: [],
};
const PLAIN = { ...LAB, slug: 'plain', judgeProblemId: null, judgeBase: null };

vi.mock('../data/labRendered.js', () => ({
  LAB_RENDERED: { metric: [LAB], plain: [PLAIN] },
}));

const { LabViewer } = await import('../components/LabViewer.js');

const q = (sel) => document.querySelector(`[data-testid="${sel}"]`);
const file = (name = 'test_triangle.py', body = 'def test_x(): pass\n') =>
  new File([body], name, { type: 'text/x-python' });

function attachFile(f) {
  const input = q('lab-test-file');
  // jsdom's FileList is read-only; define one the change-free code path reads.
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  return input;
}

/** Let the poll loop's setTimeout + awaited fetches settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await vi.advanceTimersByTimeAsync(1500);
  }
}

describe('LabViewer judge submission', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    LabViewer.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the disabled placeholder for a lab with no judge problem', () => {
    LabViewer.open('plain');
    expect(q('lab-judge')).toBeTruthy();
    expect(q('lab-judge').disabled).toBe(true);
    expect(q('lab-submit-tests')).toBeNull();
  });

  it('shows the Submit tests control when judgeProblemId is set', () => {
    LabViewer.open('metric');
    expect(q('lab-submit-tests')).toBeTruthy();
    expect(q('lab-test-file')).toBeTruthy();
    expect(q('lab-judge')).toBeNull();
  });

  it('refuses to submit with no file chosen', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    LabViewer.open('metric');
    q('lab-submit-tests').click();
    await tick(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q('lab-judge-result').textContent).toMatch(/choose/i);
  });

  it('uploads the file, polls, and renders verdict + message', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ submission_id: 42, status: 'queued' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ submission_id: 42, status: 'queued' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission_id: 42, status: 'done', verdict: 'WA', score: 26, max_score: 100,
          message: 'branch coverage 55.6% (bar 90%)',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    LabViewer.open('metric');
    attachFile(file());
    q('lab-submit-tests').click();
    await tick(3);

    const [postUrl, postInit] = fetchMock.mock.calls[0];
    expect(postUrl).toBe('https://judge.example/bank/st-lab02-coverage/submit');
    expect(postInit.method).toBe('POST');
    expect(postInit.body.get('file')).toBeInstanceOf(File);

    expect(fetchMock.mock.calls[1][0]).toBe('https://judge.example/bank/submission/42');

    expect(q('lab-judge-verdict').textContent).toBe('WA 26/100');
    expect(q('lab-judge-message').textContent).toBe('branch coverage 55.6% (bar 90%)');
  });

  it('records the finished attempt in localStorage', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ submission_id: 7 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ submission_id: 7, status: 'done', verdict: 'AC', score: 100, max_score: 100, message: 'branch coverage 100.0%' }),
      }));
    LabViewer.open('metric');
    attachFile(file());
    q('lab-submit-tests').click();
    await tick(2);

    const raw = localStorage.getItem('stvisual:quiz:attempts:lab:lab02-coverage');
    expect(raw).toBeTruthy();
    const [a] = JSON.parse(raw);
    expect(a).toMatchObject({ id: 7, verdict: 'AC', score: 100 });
  });

  it('reports a rejected submission without polling', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetchMock);
    LabViewer.open('metric');
    attachFile(file());
    q('lab-submit-tests').click();
    await tick(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(q('lab-judge-result').textContent).toMatch(/429/);
  });

  it('reports an unreachable judge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    LabViewer.open('metric');
    attachFile(file());
    q('lab-submit-tests').click();
    await tick(1);
    expect(q('lab-judge-result').textContent).toMatch(/reach/i);
  });

  it('escapes judge text rather than injecting it as markup', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ submission_id: 1 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          submission_id: 1, status: 'done', verdict: 'WA', score: 0, max_score: 100,
          message: '<img src=x onerror=alert(1)>',
        }),
      }));
    LabViewer.open('metric');
    attachFile(file());
    q('lab-submit-tests').click();
    await tick(2);
    const el = q('lab-judge-message');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
