import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudIntegrationClient, __resetForTests } from '../utils/cloudIntegration.js';
import * as cfg from '../config/cloudConfig.js';

// The dispatch added for maccount SSO routes createCloudIntegrationClient() to a
// stubbed maccount adapter whenever firebaseEnabled is false (the real default).
// These pre-existing tests exercise the Firebase branch, so force firebaseEnabled
// true here while keeping every other resolved config value untouched, and reset
// the module-level client cache so each test rebuilds against the active mock.
const realGetResolvedCloudConfig = cfg.getResolvedCloudConfig;

beforeEach(() => {
  __resetForTests();
  vi.spyOn(cfg, 'getResolvedCloudConfig').mockImplementation(() => ({
    ...realGetResolvedCloudConfig(),
    firebaseEnabled: true,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cloudIntegration client', () => {
  it('exposes expected capability flags', () => {
    const client = createCloudIntegrationClient();

    expect(typeof client.isConfigured).toBe('boolean');
    expect(Array.isArray(client.missingKeys)).toBe(true);
    expect(typeof client.isSupportedOrigin).toBe('boolean');
  });

  it('exposes getUser method', () => {
    const client = createCloudIntegrationClient();
    expect(typeof client.getUser).toBe('function');
    expect(client.getUser()).toBeNull();
  });

  it('exposes saveResult method', () => {
    const client = createCloudIntegrationClient();
    expect(typeof client.saveResult).toBe('function');
  });

  it('exposes loadCourseResults method that resolves to empty array when unconfigured', async () => {
    const client = createCloudIntegrationClient();
    const results = await client.loadCourseResults('TEST');
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('fails sign-in in unsupported test environment with meaningful message', async () => {
    const client = createCloudIntegrationClient();

    if (!client.isSupportedOrigin) {
      await expect(client.signInWithGoogle()).rejects.toThrow('Google OAuth 不支援 file://');
      return;
    }

    if (!client.isConfigured) {
      await expect(client.signInWithGoogle()).rejects.toThrow('Firebase 設定不完整');
      return;
    }

    await expect(client.signInWithGoogle()).rejects.toThrow(/operation-not-supported|popup|auth|SDK 尚未載入/i);
  });

  it('saveResult rejects when unconfigured or unsupported', async () => {
    const client = createCloudIntegrationClient();
    if (client.isConfigured && client.isSupportedOrigin) return; // skip in live env
    await expect(
      client.saveResult('uid', 'Name', 'a@b.com', 'ABC', { explorer: 'graph', score: 1, total: 2 })
    ).rejects.toThrow();
  });
});

import { DRIVE_SCOPES } from '../utils/cloudIntegration.js';

describe('cloudIntegration — private-slides additions', () => {
  it('exports both drive.file and drive.readonly in DRIVE_SCOPES', () => {
    expect(DRIVE_SCOPES).toEqual(expect.arrayContaining([
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ]));
    expect(DRIVE_SCOPES.length).toBe(2);
  });

  it('createCloudIntegrationClient returns the same instance on repeated calls', () => {
    const a = createCloudIntegrationClient();
    const b = createCloudIntegrationClient();
    expect(a).toBe(b);
  });

  it('the client exposes getAccessToken returning null when not signed in', () => {
    const client = createCloudIntegrationClient();
    expect(typeof client.getAccessToken).toBe('function');
    expect(client.getAccessToken()).toBe(null);
  });
});

describe('cloudIntegration — maccount dispatch', () => {
  it('firebase disabled -> maccount adapter with stubbed data methods', async () => {
    vi.spyOn(cfg, 'getResolvedCloudConfig').mockReturnValue({
      firebase: {}, drive: {}, firebaseEnabled: false,
      maccount: { workerBaseUrl: 'https://m.example', appId: 'stvisual2' } });
    const maccount = await import('../utils/maccountClient.js');
    vi.spyOn(maccount, 'getMaccountClient').mockReturnValue({
      isConfigured: true, getUser: () => ({ student_id: 'S', uid: 'S' }),
      subscribeAuthState: (cb) => { cb({ uid: 'S' }); return () => {}; },
      signIn: vi.fn(), signOut: vi.fn(), handleRedirect: async () => false });
    const c = createCloudIntegrationClient();
    expect(c.isMaccount).toBe(true);
    expect(c.getUser().uid).toBe('S');
    expect(c.getAccessToken()).toBe(null);
    await expect(c.loadSettings('S')).resolves.toEqual({});   // no-op, no Firestore
    expect(() => c.signInWithGoogle()).not.toThrow();          // alias -> signIn
  });
});
