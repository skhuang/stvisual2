import { describe, it, expect, afterEach } from 'vitest';
import { getResolvedCloudConfig, JUDGE_FRONTEND_BASE } from '../config/cloudConfig.js';

afterEach(() => { delete globalThis.STVISUAL_CLOUD_CONFIG; });

it('defaults: maccount placeholder, firebase disabled', () => {
  const c = getResolvedCloudConfig();
  expect(c.maccount.appId).toBe('stvisual2');
  expect(c.maccount.workerBaseUrl).toMatch(/^__.*__$/);
  expect(c.firebaseEnabled).toBe(false);
});
it('runtime override merges maccount + firebaseEnabled', () => {
  globalThis.STVISUAL_CLOUD_CONFIG = { maccount: { workerBaseUrl: 'https://m.example' }, firebaseEnabled: true };
  const c = getResolvedCloudConfig();
  expect(c.maccount.workerBaseUrl).toBe('https://m.example');
  expect(c.maccount.appId).toBe('stvisual2');   // kept from base
  expect(c.firebaseEnabled).toBe(true);
});
it('exposes the judge frontend base', () => {
  expect(JUDGE_FRONTEND_BASE).toBe('https://ds2026summer.cs.nycu.edu.tw');
});
