import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ci from '../utils/cloudIntegration.js';
import { createTeacherDashboard } from '../components/TeacherDashboard.js';
import { createCloudStoragePanel } from '../components/CloudStoragePanel.js';

// The brief's original sketch imports `openTeacherDashboard` — the real export
// from src/components/TeacherDashboard.js is `createTeacherDashboard()`, which
// returns a detached root element rather than taking a container argument.
// Adapted accordingly below.

function maccountClient(overrides = {}) {
  return {
    isMaccount: true,
    isConfigured: true,
    isSupportedOrigin: true,
    originWarning: '',
    missingKeys: [],
    getUser: () => ({ uid: 'S' }),
    getAccessToken: () => null,
    subscribeAuthState: (cb) => { cb({ uid: 'S' }); return () => {}; },
    signIn: vi.fn(),
    loadCourseResults: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Firebase-only UI hidden while data features are disabled (maccount adapter)', () => {
  it('teacher dashboard shows a disabled notice under maccount and calls no data method', () => {
    const client = maccountClient();
    vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue(client);

    const root = createTeacherDashboard();
    document.body.append(root);
    root.hidden = false;

    expect(root.textContent).toMatch(/unavailable|停用|disabled/i);
    // The live search/table UI must not be present.
    expect(root.querySelector('[data-testid="teacher-dashboard-live"]')).toBeNull();
    expect(root.querySelector('[data-testid="td-load-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="td-code-input"]')).toBeNull();
    expect(root.querySelector('[data-testid="td-table"]')).toBeNull();
    expect(client.loadCourseResults).not.toHaveBeenCalled();
  });

  it('cloud storage panel hides cloud data actions under maccount but keeps the auth chip', () => {
    const client = maccountClient({
      getUser: () => null,
      subscribeAuthState: (cb) => { cb(null); return () => {}; },
    });
    vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue(client);

    const root = createCloudStoragePanel();
    document.body.append(root);

    // Auth chip retained.
    expect(root.querySelector('[data-testid="cloud-signin-btn"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="cloud-signout-btn"]')).toBeTruthy();

    // Cloud data actions (settings save/load, Drive upload/listing) hidden.
    expect(root.querySelector('[data-testid="cloud-save-settings-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="cloud-load-settings-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="cloud-upload-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="cloud-file-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="cloud-refresh-drive-btn"]')).toBeNull();
  });
});
