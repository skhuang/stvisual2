import { describe, it, expect, beforeEach } from 'vitest';
import { renderApp } from '../app.js';

describe('renderApp dispatch', () => {
  let container;
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('renders the integrated app on a bare URL', () => {
    renderApp(container);
    expect(container.querySelector('[data-testid="app-nav"]')).toBeTruthy();
  });

  it('renders the integrated app for ?view=all&explorer=…', () => {
    window.history.replaceState(null, '', '/?view=all&explorer=graph-coverage');
    renderApp(container);
    expect(container.querySelector('[data-testid="app-nav"]')).toBeTruthy();
  });

  it('shows a dismissible notice for an unknown ?explorer=', () => {
    window.history.replaceState(null, '', '/?explorer=NopeExplorer');
    renderApp(container);
    const notice = document.querySelector('[data-testid="unit-not-found"]');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain('NopeExplorer');
    notice.querySelector('button').click();
    expect(document.querySelector('[data-testid="unit-not-found"]')).toBeNull();
  });
});
