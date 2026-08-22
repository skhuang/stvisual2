// Recent-input history, localStorage-backed. Ported from dsvisual
// js/examples_store.js; cap default raised to 10.
export function key(methodId) { return 'stvisual:examples:' + methodId; }

export function load(storage, methodId) {
  try {
    const raw = storage.getItem(key(methodId));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.text === 'string');
  } catch { return []; }
}

export function save(storage, methodId, text, defaultText, cap = 10) {
  try {
    if (text == null) return;
    text = String(text);
    if (text === '' || text === defaultText) return;
    const arr = load(storage, methodId).filter((e) => e.text !== text);
    arr.unshift({ text });
    storage.setItem(key(methodId), JSON.stringify(arr.slice(0, cap)));
  } catch { /* storage unavailable */ }
}
