import { t, getLocale, setLocale, onLocaleChange, getSupportedLocales } from '../i18n/index.js';
import { UNIT_BY_COMPONENT } from '../data/explorerUnits.js';
import { FACTORY_BY_COMPONENT } from '../data/explorerFactories.js';
import { unitTitle } from '../utils/unitTitles.js';
import { initVizFocus } from '../utils/vizFocus.js';
import { QuizViewer } from '../components/QuizViewer.js';
import { LabViewer } from '../components/LabViewer.js';
import { INPUT_DIFFICULTIES, getInputDifficulty, setInputDifficulty } from '../utils/inputDifficulty.js';

// Single-Explorer classroom view: minimal header, one mounted explorer,
// fullscreen focus mode. Quiz/Lab buttons are appended by later features.
export function renderUnitView(container, urlState) {
  const unit = UNIT_BY_COMPONENT.get(urlState.explorer);
  if (!unit) return; // dispatcher guarantees resolution; belt-and-braces

  function paint() {
    const title = unitTitle(unit);
    document.title = `${title} · ${t('app.title')}`;
    container.innerHTML = `
      <div class="app unit-app" data-testid="unit-app">
        <header class="unit-header">
          <a class="unit-back" href="./">← ${t('unit.back')}</a>
          <h1 class="unit-title">${title}</h1>
          <div class="unit-tools">
            <div class="app-lang" role="group" aria-label="${t('app.lang.label')}">
              ${getSupportedLocales().map((loc) => `
                <button type="button" class="app-lang__btn${getLocale() === loc ? ' active' : ''}"
                        data-unit-lang="${loc}">${t(`app.lang.${loc}`)}</button>`).join('')}
            </div>
            <label class="unit-difficulty">
              <select data-testid="input-difficulty" aria-label="${t('settings.difficulty')}">
                ${INPUT_DIFFICULTIES.map((d) => `<option value="${d}"${getInputDifficulty() === d ? ' selected' : ''}>${t('difficulty.' + d)}</option>`).join('')}
              </select>
            </label>
            <button type="button" class="btn secondary viz-focus-toggle"
                    data-testid="viz-focus-toggle" aria-pressed="false">
              ⛶ ${t('unit.fullscreen')}
            </button>
            ${QuizViewer.has(unit.quizId ?? unit.id) ? `
              <button type="button" class="btn secondary" data-testid="unit-quiz-btn">
                ${t('btn.quiz')}
              </button>` : ''}
            ${LabViewer.has(unit.id) ? `
              <button type="button" class="btn secondary" data-testid="unit-lab-btn">
                ${t('btn.lab')}
              </button>` : ''}
          </div>
        </header>
        <main class="unit-main" data-testid="unit-main"></main>
      </div>`;
    const factory = FACTORY_BY_COMPONENT[unit.componentName];
    container.querySelector('.unit-main').appendChild(factory());
    container.querySelectorAll('[data-unit-lang]').forEach((btn) =>
      btn.addEventListener('click', () => setLocale(btn.dataset.unitLang)));
    container.querySelector('[data-testid="input-difficulty"]')
      ?.addEventListener('change', (e) => setInputDifficulty(e.target.value));
    container.querySelector('[data-testid="unit-quiz-btn"]')
      ?.addEventListener('click', () => QuizViewer.open(unit.quizId ?? unit.id));
    container.querySelector('[data-testid="unit-lab-btn"]')
      ?.addEventListener('click', () => LabViewer.open(unit.id));
  }

  paint();
  onLocaleChange(() => paint());
  initVizFocus({ root: container });
  const exitBtn = document.getElementById('viz-focus-exit');
  if (exitBtn) exitBtn.textContent = `✕ ${t('unit.exitFullscreen')}`;
}
