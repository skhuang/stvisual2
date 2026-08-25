import { it, expect, vi } from 'vitest';
import * as ci from '../utils/cloudIntegration.js';
import { createCloudStoragePanel } from '../components/CloudStoragePanel.js';

it('sign-in button triggers maccount signIn (no popup)', () => {
  const signIn = vi.fn();
  const signInWithGoogle = vi.fn(() => Promise.reject(new Error('popup path should not be used')));
  vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue({
    isMaccount: true, isConfigured: true, isSupportedOrigin: true, getUser: () => null,
    subscribeAuthState: (cb) => { cb(null); return () => {}; },
    signIn, signInWithGoogle, getAccessToken: () => null,
  });
  const root = createCloudStoragePanel();
  document.body.append(root);
  root.querySelector('[data-testid="cloud-signin-btn"]').click();
  expect(signIn).toHaveBeenCalled();
  expect(signInWithGoogle).not.toHaveBeenCalled();
});
