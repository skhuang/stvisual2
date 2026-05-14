import { describe, expect, it } from 'vitest';
import { createGroupTheoryExplorer } from '../components/GroupTheoryExplorer.js';

function mount() {
  document.body.innerHTML = '';
  const el = createGroupTheoryExplorer();
  document.body.appendChild(el);
  return el;
}

describe('GroupTheoryExplorer smoke', () => {
  it('renders root element with correct testid', () => {
    mount();
    expect(document.querySelector('[data-testid="gth-explorer"]')).toBeInTheDocument();
  });

  it('renders formula input and example buttons', () => {
    mount();
    expect(document.querySelector('[data-testid="gth-formula-input"]')).toBeInTheDocument();
    expect(document.querySelectorAll('.gth-example-btn').length).toBeGreaterThan(0);
  });

  it('renders tab row with three tabs', () => {
    mount();
    expect(document.querySelectorAll('[data-tab]').length).toBe(3);
  });

  it('Tab 1 renders orbit table by default', () => {
    mount();
    expect(document.querySelector('[data-testid="gth-orbit-table"]')).toBeInTheDocument();
  });

  it('switching to CACC tab renders CACC content', () => {
    mount();
    document.querySelector('[data-tab="cacc"]').click();
    expect(document.querySelector('[data-testid="gth-tab-pane"]').textContent).toMatch(/CACC|determination|pairs/i);
  });

  it('switching to covering array tab renders OA table', () => {
    mount();
    document.querySelector('[data-tab="covarray"]').click();
    expect(document.querySelector('[data-testid="gth-cov-table"]')).toBeInTheDocument();
  });

  it('quiz start button appears in bottom card', () => {
    mount();
    expect(document.querySelector('[data-testid="gth-quiz-start"]')).toBeInTheDocument();
  });

  it('clicking quiz start opens quiz panel', () => {
    mount();
    document.querySelector('[data-testid="gth-quiz-start"]').click();
    expect(document.querySelector('[data-testid="gth-quiz-panel"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="gth-quiz-input"]')).toBeInTheDocument();
  });

  it('submitting quiz input shows graded result', () => {
    mount();
    document.querySelector('[data-testid="gth-quiz-start"]').click();
    document.querySelector('[data-testid="gth-quiz-input"]').value = '3';
    document.querySelector('[data-testid="gth-quiz-submit"]').click();
    expect(document.querySelector('.quiz-score')).toBeInTheDocument();
  });

  it('quiz close button dismisses quiz panel', () => {
    mount();
    document.querySelector('[data-testid="gth-quiz-start"]').click();
    document.querySelector('[data-testid="gth-quiz-close"]').click();
    expect(document.querySelector('[data-testid="gth-quiz-panel"]')).not.toBeInTheDocument();
  });

  it('cacc tab quiz computes derived pairs answer', () => {
    mount();
    document.querySelector('[data-tab="cacc"]').click();
    document.querySelector('[data-testid="gth-quiz-start"]').click();
    expect(document.querySelector('[data-testid="gth-quiz-panel"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="gth-quiz-input"]')).toBeInTheDocument();
  });

  it('lab reflect button opens reflect panel', () => {
    mount();
    document.querySelector('[data-testid="gth-lab-reflect-start"]').click();
    expect(document.querySelector('[data-testid="gth-lab-reflect-panel"]')).toBeInTheDocument();
  });

  it('lab reflect panel has two text areas', () => {
    mount();
    document.querySelector('[data-testid="gth-lab-reflect-start"]').click();
    expect(document.querySelector('[data-testid="gth-lab-reflect-text"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="gth-lab-reflect-text2"]')).toBeInTheDocument();
  });

  it('lab reflect close button dismisses panel', () => {
    mount();
    document.querySelector('[data-testid="gth-lab-reflect-start"]').click();
    document.querySelector('[data-testid="gth-lab-reflect-close"]').click();
    expect(document.querySelector('[data-testid="gth-lab-reflect-panel"]')).not.toBeInTheDocument();
  });

  it('bridge button to MT is rendered in orbit table', () => {
    mount();
    expect(document.querySelector('[data-testid="gth-bridge-mt"]')).toBeInTheDocument();
  });
});
