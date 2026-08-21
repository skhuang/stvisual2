import { describe, it, expect, beforeEach } from 'vitest';
import { renderUnitView } from '../views/unitView.js';
import { parseAppLocation } from '../utils/urlRouter.js';

function render(url) {
  window.history.replaceState(null, '', url);
  const container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  renderUnitView(container, parseAppLocation(window.location.search, ''));
  return container;
}

describe('unit view', () => {
  beforeEach(() => { document.body.className = ''; });

  it('mounts exactly one explorer inside unit-main', () => {
    const c = render('/?explorer=graph-coverage');
    const main = c.querySelector('[data-testid="unit-main"]');
    expect(main).toBeTruthy();
    expect(main.children.length).toBe(1);
    expect(c.querySelector('[data-testid="app-nav"]')).toBeNull();
  });

  it('renders a back link to the overview and a fullscreen toggle', () => {
    const c = render('/?explorer=BoundaryValueExplorer');
    expect(c.querySelector('a.unit-back').getAttribute('href')).toBe('./');
    expect(c.querySelector('[data-testid="viz-focus-toggle"]')).toBeTruthy();
  });

  it('fullscreen toggle flips body.viz-focus; Escape exits', () => {
    const c = render('/?explorer=graph-coverage');
    c.querySelector('[data-testid="viz-focus-toggle"]').click();
    expect(document.body.classList.contains('viz-focus')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('viz-focus')).toBe(false);
  });
});
