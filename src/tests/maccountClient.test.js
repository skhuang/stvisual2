import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMaccountClient, stripMtoken, __resetForTests } from '../utils/maccountClient.js';
import * as cfg from '../config/cloudConfig.js';

const BASE = 'https://maccount.example';
function mockConfig(maccount) {
  vi.spyOn(cfg, 'getResolvedCloudConfig').mockReturnValue({
    firebase: {}, drive: {}, firebaseEnabled: false,
    maccount: maccount ?? { workerBaseUrl: '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' },
  });
}
beforeEach(() => { __resetForTests(); sessionStorage.clear(); vi.restoreAllMocks();
  Object.defineProperty(window, 'location', { writable: true,
    value: new URL('https://app.example/?explorer=graph-coverage') }); });

describe('stripMtoken', () => {
  it('strips only mtoken, keeps query + app hash', () => {
    expect(stripMtoken('https://a/?explorer=x#m=insert#mtoken=T', '#m=insert#mtoken=T'))
      .toBe('https://a/?explorer=x#m=insert');
    expect(stripMtoken('https://a/?explorer=x#mtoken=T', '#mtoken=T'))
      .toBe('https://a/?explorer=x');
  });
});

describe('unconfigured', () => {
  it('placeholder -> stub, getUser null, signIn no-op', () => {
    mockConfig({ workerBaseUrl: '__MACCOUNT_WORKER_URL__', appId: 'stvisual2' });
    const c = getMaccountClient();
    expect(c.isConfigured).toBe(false);
    expect(c.getUser()).toBe(null);
    expect(() => c.signIn()).not.toThrow();
  });
});

describe('configured', () => {
  beforeEach(() => mockConfig({ workerBaseUrl: BASE, appId: 'stvisual2' }));

  it('signIn redirects to /auth/app/start with app + encoded return', () => {
    const assign = vi.fn();
    window.location = { href: 'https://app.example/?explorer=x', protocol: 'https:', hash: '', assign };
    getMaccountClient().signIn();
    expect(assign).toHaveBeenCalledWith(
      BASE + '/auth/app/start?app=stvisual2&return=' + encodeURIComponent('https://app.example/?explorer=x'));
  });

  it('handleRedirect: #mtoken -> verify -> getUser set + fragment stripped', async () => {
    const replaceState = vi.fn();
    window.history.replaceState = replaceState;
    window.location = { href: 'https://app.example/?explorer=x#mtoken=T', protocol: 'https:',
                        hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ student_id: '0856001', providers: { github: true, google: false } }) });
    const ok = await getMaccountClient().handleRedirect();
    expect(ok).toBe(true);
    expect(getMaccountClient().getUser().student_id).toBe('0856001');
    expect(replaceState).toHaveBeenCalled();
  });

  it('verify failure leaves user null', async () => {
    window.location = { href: 'https://a/#mtoken=T', protocol: 'https:', hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    expect(await getMaccountClient().handleRedirect()).toBe(false);
    expect(getMaccountClient().getUser()).toBe(null);
  });

  it('no #mtoken -> no-op false', async () => {
    window.location = { href: 'https://a/?explorer=x', protocol: 'https:', hash: '', assign: vi.fn() };
    expect(await getMaccountClient().handleRedirect()).toBe(false);
  });

  it('signOut clears user + notifies', async () => {
    window.location = { href: 'https://a/#mtoken=T', protocol: 'https:', hash: '#mtoken=T', assign: vi.fn() };
    global.fetch = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ student_id: 'S', providers: {} }) });
    const c = getMaccountClient(); await c.handleRedirect();
    const seen = []; c.subscribeAuthState(u => seen.push(u));
    c.signOut();
    expect(c.getUser()).toBe(null);
    expect(seen[seen.length - 1]).toBe(null);
  });
});
