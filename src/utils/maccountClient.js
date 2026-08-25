import { getResolvedCloudConfig } from '../config/cloudConfig.js';

const USER_KEY = 'stvisual:maccount:user';
let cachedClient = null;

const isPlaceholder = (v) => !v || /^__.+__$/.test(v);

export function stripMtoken(href, hash) {
  const base = href.replace(/#.*$/, '');
  const segs = (hash || '').replace(/^#/, '').split(/[#&]/).filter((s) => s && !/^mtoken=/.test(s));
  return segs.length ? base + '#' + segs.join('&') : base;
}

function stubClient(reason) {
  return { isConfigured: false, missingReason: reason,
    getUser: () => null,
    subscribeAuthState(cb) { cb(null); return () => {}; },
    signIn() {}, signOut() {}, handleRedirect: () => Promise.resolve(false) };
}

function buildClient() {
  const cfg = getResolvedCloudConfig().maccount || null;
  if (typeof location !== 'undefined' && location.protocol === 'file:')
    return stubClient('Sign-in requires http(s), not file://.');
  if (!cfg || isPlaceholder(cfg.workerBaseUrl))
    return stubClient('maccount worker URL not configured.');

  const base = cfg.workerBaseUrl.replace(/\/$/, '');
  const appId = cfg.appId || 'stvisual2';
  const subs = [];
  let redirectPromise = null;

  const readUser = () => {
    try { const raw = sessionStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };
  let user = readUser();
  const setUser = (u) => {
    user = u;
    try { u ? sessionStorage.setItem(USER_KEY, JSON.stringify(u)) : sessionStorage.removeItem(USER_KEY); } catch {}
    subs.forEach((cb) => { try { cb(user); } catch {} });
  };

  async function runRedirect() {
    const hash = location.hash || '';
    const m = hash.match(/[#&]mtoken=([^&]+)/);
    if (!m) return false;
    let res;
    try {
      res = await fetch(base + '/api/app/verify', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: decodeURIComponent(m[1]) }) });
    } catch { return false; }
    if (!res || !res.ok) return false;
    let data; try { data = await res.json(); } catch { return false; }
    if (!data || !data.student_id) return false;
    try { history.replaceState(null, '', stripMtoken(location.href, location.hash)); } catch {}
    setUser({ student_id: data.student_id, uid: data.student_id, displayName: data.student_id,
      providers: { github: !!(data.providers && data.providers.github),
                   google: !!(data.providers && data.providers.google) } });
    return true;
  }

  return { isConfigured: true, missingReason: '',
    getUser: () => user,
    subscribeAuthState(cb) { subs.push(cb); try { cb(user); } catch {}
      return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    signIn() { location.assign(base + '/auth/app/start?app=' + encodeURIComponent(appId)
      + '&return=' + encodeURIComponent(location.href)); },
    signOut() { setUser(null); },
    handleRedirect() {
      if (!redirectPromise) redirectPromise = runRedirect().then((ok) => { if (!ok) redirectPromise = null; return ok; });
      return redirectPromise;
    } };
}

export function getMaccountClient() { return (cachedClient ||= buildClient()); }
export function __resetForTests() { cachedClient = null; }
