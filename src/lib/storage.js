const NS = 'csc5:';
const VERSION = 5;
let uid = 'local';

export function setUser(userId) {
  uid = userId || 'local';
  try { localStorage.setItem(NS + 'lastUser', uid); } catch (e) { console.warn(e); }
}

function key(k) { return NS + uid + ':' + k; }

export function load(k, fallback) {
  try {
    const raw = localStorage.getItem(key(k));
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch (e) { return fallback; }
}

export function save(k, value) {
  try {
    localStorage.setItem(key(k), JSON.stringify(value));
    localStorage.setItem(NS + 'version', String(VERSION));
    return true;
  } catch (e) { console.warn('save failed', k, e); return false; }
}

export function uuid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function cacheGet(k, ttlMs) {
  const v = load('cache:' + k, null);
  if (!v || typeof v.t !== 'number') return null;
  if (Date.now() - v.t > ttlMs) return null;
  return v.d;
}

export function cacheSet(k, d) { save('cache:' + k, { t: Date.now(), d: d }); }

export function exportBackup(plots, activities) {
  return JSON.stringify({ app: 'climate-smart-crop-calendar', version: VERSION, at: Date.now(), plots: plots, activities: activities });
}

export function parseBackup(text) {
  try {
    const o = JSON.parse(text);
    if (!o || !Array.isArray(o.plots)) return null;
    return { plots: o.plots, activities: Array.isArray(o.activities) ? o.activities : [] };
  } catch (e) { return null; }
}

export function storageInfo() {
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(NS) === 0) used += (localStorage.getItem(k) || '').length;
    }
  } catch (e) { return { ok: false, kb: 0 }; }
  return { ok: true, kb: Math.round(used / 1024) };
}