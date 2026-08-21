// Fullscreen focus mode, ported from dsvisual. Toggled by any element with
// class .viz-focus-toggle; adds body.viz-focus (CSS hides chrome and expands
// the stage) and best-effort requests browser fullscreen. Exits on Escape,
// on the floating draggable ✕ button, or when browser fullscreen ends.

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsExit = () => {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (fn) fn.call(document);
};

// The two `document`-level fullscreenchange listeners are wired exactly once
// per module lifetime — never per `initVizFocus` call. A full page remount
// (e.g. in tests, or a fresh SPA navigation that wipes `document.body`) needs
// a fresh exit button and a fresh click listener on the new `root`, but it
// must NOT re-run `document.addEventListener('fullscreenchange', …)`: that
// would leak another anonymous closure onto `document` on every bypass of the
// remount guard below, forever. `latestExitFocus` lets this one permanent
// listener pair always call into whichever `exitFocus` closure is current
// after the most recent (re)wiring.
let fullscreenListenersWired = false;
let latestExitFocus = () => {};

export function initVizFocus({ root = document } = {}) {
  const body = document.body;
  // Guarded by the exit button's presence (not just a flag): a full page
  // remount — e.g. in tests, or a fresh SPA navigation that wipes
  // `document.body` — drops the previously-appended button along with the
  // click listener bound to the old `root`, so re-wiring must happen again.
  let exitBtn = document.getElementById('viz-focus-exit');
  if (body.dataset.vizFocusWired === '1' && exitBtn) return;
  body.dataset.vizFocusWired = '1';

  if (!exitBtn) {
    exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.id = 'viz-focus-exit';
    exitBtn.className = 'viz-focus-exit';
    exitBtn.hidden = true;
    exitBtn.textContent = '✕';
    document.body.appendChild(exitBtn);
  }

  const fsRequest = (el) => {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    return fn ? fn.call(el) : null;
  };
  const setPressed = (on) => {
    document.querySelectorAll('.viz-focus-toggle').forEach((b) =>
      b.setAttribute('aria-pressed', on ? 'true' : 'false'));
  };
  const onKeydown = (e) => { if (e.key === 'Escape') exitFocus(); };

  function enterFocus() {
    if (body.classList.contains('viz-focus')) return;
    body.classList.add('viz-focus');
    exitBtn.hidden = false;
    exitBtn.style.left = ''; exitBtn.style.top = '';
    exitBtn.style.right = ''; exitBtn.style.bottom = '';
    setPressed(true);
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    try {
      const p = fsRequest(document.documentElement);
      if (p && p.then) p.then(() => {
        if (!body.classList.contains('viz-focus') && fsElement()) { try { fsExit(); } catch {} }
      }, () => {});
    } catch {}
  }
  function exitFocus() {
    if (!body.classList.contains('viz-focus')) return;
    body.classList.remove('viz-focus');
    exitBtn.hidden = true;
    setPressed(false);
    document.removeEventListener('keydown', onKeydown);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    if (fsElement()) { try { fsExit(); } catch {} }
  }
  latestExitFocus = exitFocus;

  root.addEventListener('click', (e) => {
    if (e.target?.closest?.('.viz-focus-toggle')) {
      body.classList.contains('viz-focus') ? exitFocus() : enterFocus();
    }
  });
  exitBtn.addEventListener('click', () => {
    if (exitBtn.dataset.dragged === '1') { delete exitBtn.dataset.dragged; return; }
    exitFocus();
  });
  if (!fullscreenListenersWired) {
    fullscreenListenersWired = true;
    document.addEventListener('fullscreenchange', () => {
      if (!fsElement() && document.body.classList.contains('viz-focus')) latestExitFocus();
    });
    document.addEventListener('webkitfullscreenchange', () => {
      if (!fsElement() && document.body.classList.contains('viz-focus')) latestExitFocus();
    });
  }
  makeExitDraggable(exitBtn);
}

// Drag anywhere so the exit button never blocks a viz's controls. A move past
// a 4px threshold sets data-dragged so the trailing click doesn't exit focus.
function makeExitDraggable(el) {
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; moved = false;
    const r = el.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;
    const nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, ox + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, oy + dy));
    el.style.left = `${nx}px`; el.style.top = `${ny}px`;
    el.style.right = 'auto'; el.style.bottom = 'auto';
  });
  const end = () => { if (dragging && moved) el.dataset.dragged = '1'; dragging = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
