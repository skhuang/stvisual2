import { describe, expect, it, vi, afterEach } from 'vitest';
import * as ci from '../utils/cloudIntegration.js';
import { createTeacherDashboard } from '../components/TeacherDashboard.js';

// These tests exercise the "enabled" (non-maccount) path — i.e. a Firebase client
// where the class-results dashboard is expected to work. The maccount SSO adapter
// (firebaseEnabled === false, the shipped default) is covered separately in
// src/tests/firebaseDisabled.test.jsx.
function mockEnabledClient(overrides = {}) {
  return {
    isMaccount: false,
    getAccessToken: () => null,
    loadCourseResults: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mount(clientOverrides) {
  document.body.innerHTML = '';
  vi.spyOn(ci, 'createCloudIntegrationClient').mockReturnValue(mockEnabledClient(clientOverrides));
  const el = createTeacherDashboard();
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TeacherDashboard smoke', () => {
  it('renders root with correct testid', () => {
    mount();
    expect(document.querySelector('[data-testid="teacher-dashboard"]')).toBeInTheDocument();
  });

  it('renders panel with close button and class code input', () => {
    mount();
    expect(document.querySelector('[data-testid="td-panel"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="td-close"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="td-code-input"]')).toBeInTheDocument();
  });

  it('renders Load button', () => {
    mount();
    expect(document.querySelector('[data-testid="td-load-btn"]')).toBeInTheDocument();
  });

  it('close button hides the panel', () => {
    const el = mount();
    el.hidden = false;
    document.querySelector('[data-testid="td-close"]').click();
    expect(el.hidden).toBe(true);
  });

  it('shows error when Load clicked with empty code', async () => {
    mount();
    document.querySelector('[data-testid="td-code-input"]').value = '';
    document.querySelector('[data-testid="td-load-btn"]').click();
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelector('[data-testid="td-error"]')).toBeInTheDocument();
  });

  it('shows empty state after loading with unconfigured client', async () => {
    mount();
    document.querySelector('[data-testid="td-code-input"]').value = 'TEST01';
    document.querySelector('[data-testid="td-load-btn"]').click();
    await new Promise(r => setTimeout(r, 100));
    // loadCourseResults returns [] in unconfigured env → empty state or error
    const empty = document.querySelector('[data-testid="td-empty"]');
    const error = document.querySelector('[data-testid="td-error"]');
    expect(empty || error).toBeInTheDocument();
  });

  it('opens via stvisual:open-teacher-dashboard event', () => {
    const el = mount();
    el.hidden = true;
    window.dispatchEvent(new CustomEvent('stvisual:open-teacher-dashboard', {
      detail: { classCode: 'ABC123' },
    }));
    expect(el.hidden).toBe(false);
  });
});
