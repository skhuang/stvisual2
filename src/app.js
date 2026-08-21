// Thin route dispatcher. `?explorer=` (without ?view=all) → unit view
// (Task 4; until then everything falls through to the integrated app).
import { parseAppLocation } from './utils/urlRouter.js';
import { t, setLocale } from './i18n/index.js';
import { renderIntegratedApp } from './views/integratedView.js';
import { renderUnitView } from './views/unitView.js';

function showUnitNotFound(rawId) {
  const notice = document.createElement('div');
  notice.className = 'unit-not-found';
  notice.dataset.testid = 'unit-not-found';
  notice.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.textContent = t('unit.notFound', { id: rawId });
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', t('common.close'));
  dismiss.addEventListener('click', () => notice.remove());
  notice.append(msg, dismiss);
  document.body.prepend(notice);
}

export function renderApp(container) {
  const state = parseAppLocation(
    globalThis.location?.search ?? '',
    globalThis.location?.hash ?? '',
  );
  // Apply a URL-supplied language before the first paint (the integrated
  // view repeats this harmlessly for its own repaint bookkeeping).
  if (state.lang) setLocale(state.lang, { persist: false });

  if (state.unknownExplorer) showUnitNotFound(state.unknownExplorer);

  if (state.explorer && state.view !== 'all') {
    renderUnitView(container, state);
    return;
  }

  renderIntegratedApp(container);
}
