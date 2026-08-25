import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JUDGE_FRONTEND_BASE } from '../config/cloudConfig.js';

// The lab registry is a build artifact; stub it so the viewer can be driven
// with both kinds of lab (judge-wired and not).
const LAB = {
  slug: 'lab02-coverage',
  titleZh: '涵蓋率', titleEn: 'Coverage',
  week: 4, difficulty: 2,
  repoUrl: null,
  judgeProblemId: 'st-lab02-coverage',
  statementHtml: { zh: '<h1>zh</h1>', en: '<h1>en</h1>' },
  samples: [],
};
const PLAIN = { ...LAB, slug: 'plain', judgeProblemId: null };

vi.mock('../data/labRendered.js', () => ({
  LAB_RENDERED: { metric: [LAB], plain: [PLAIN] },
}));

// A controllable cloud client: tests mutate `clientState` before opening.
const clientState = { isConfigured: true, user: null, signIn: vi.fn(), _subs: [] };
vi.mock('../utils/cloudIntegration.js', () => ({
  createCloudIntegrationClient: () => ({
    get isConfigured() { return clientState.isConfigured; },
    getUser: () => clientState.user,
    subscribeAuthState: (cb) => { clientState._subs.push(cb); cb(clientState.user); return () => {}; },
    signIn: () => clientState.signIn(),
  }),
}));

const { LabViewer } = await import('../components/LabViewer.js');
const q = (sel) => document.querySelector(`[data-testid="${sel}"]`);

describe('LabViewer practice-on-judge link-out', () => {
  beforeEach(() => {
    clientState.isConfigured = true;
    clientState.user = null;
    clientState.signIn = vi.fn();
    // NOTE: do not reset _subs — LabViewer subscribes once for the module's
    // lifetime; resetting would orphan its callback in later tests.
  });
  afterEach(() => { LabViewer.close(); });

  it('shows the disabled placeholder for a lab with no judge problem', () => {
    LabViewer.open('plain');
    const btn = q('lab-judge');
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.disabled).toBe(true);
    expect(q('lab-judge-signin')).toBeNull();
  });

  it('shows a sign-in button when configured but signed out', () => {
    clientState.isConfigured = true;
    clientState.user = null;
    LabViewer.open('metric');
    expect(q('lab-judge-signin')).toBeTruthy();
    // no link yet
    expect(q('lab-judge')).toBeNull();
  });

  it('sign-in button calls the client signIn (maccount redirect)', () => {
    LabViewer.open('metric');
    q('lab-judge-signin').click();
    expect(clientState.signIn).toHaveBeenCalledTimes(1);
  });

  it('shows a link to the judge /bank/<id> when signed in', () => {
    clientState.user = { student_id: '0856001', uid: '0856001' };
    LabViewer.open('metric');
    const link = q('lab-judge');
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(`${JUDGE_FRONTEND_BASE}/bank/st-lab02-coverage`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(q('lab-judge-signin')).toBeNull();
  });

  it('shows the link directly when the client is unconfigured (no sign-in gate)', () => {
    clientState.isConfigured = false;
    clientState.user = null;
    LabViewer.open('metric');
    const link = q('lab-judge');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(`${JUDGE_FRONTEND_BASE}/bank/st-lab02-coverage`);
    expect(q('lab-judge-signin')).toBeNull();
  });

  it('re-renders to the link after an auth-state change to signed-in', () => {
    LabViewer.open('metric');
    expect(q('lab-judge-signin')).toBeTruthy();
    // simulate maccount handleRedirect completing: notify subscribers with a user
    clientState.user = { student_id: 'S', uid: 'S' };
    clientState._subs.forEach((cb) => cb(clientState.user));
    expect(q('lab-judge')?.tagName).toBe('A');
    expect(q('lab-judge-signin')).toBeNull();
  });
});
