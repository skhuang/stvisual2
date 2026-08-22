import { t } from '../i18n/index.js';
import { load } from '../utils/examplesStore.js';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const truncate = (s) => String(s).length > 28 ? String(s).slice(0, 28) + '…' : String(s);

export function createExampleControls({ methodId, getDefaultText, presets = [], onLoad, onRandom }) {
  const element = document.createElement('div');
  element.className = 'example-controls';

  function optionsHtml() {
    const def = getDefaultText();
    let html = `<option value="">${esc(t('example.pick'))}</option>`;
    html += `<option value="${esc(def)}">${esc(t('example.currentDefault'))}</option>`;
    for (const p of presets) {
      if (p.value === def) continue;
      html += `<option value="${esc(p.value)}">${esc(p.label)}</option>`;
    }
    for (const entry of load(localStorage, methodId)) {
      if (entry.text === def) continue;
      html += `<option value="${esc(entry.text)}">${esc(truncate(entry.text))}</option>`;
    }
    return html;
  }

  function paint() {
    element.innerHTML = `
      <select class="ex-select" data-testid="ex-select" aria-label="${esc(t('example.pick'))}">${optionsHtml()}</select>
      <button type="button" class="ex-random" data-testid="ex-random" title="${esc(t('example.random'))}" aria-label="${esc(t('example.random'))}">🎲</button>`;
    element.querySelector('.ex-select').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v) onLoad?.(v);
    });
    element.querySelector('.ex-random').addEventListener('click', () => onRandom?.());
  }

  paint();
  return { element, refresh: paint };
}
