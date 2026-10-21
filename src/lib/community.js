// รายงานการระบาดในพื้นที่แบบไม่ระบุตัวตน
// ตั้งค่า VITE_COMMUNITY_API ใน .env ชี้ไปที่ Web App ของ Google Apps Script
// ถ้าไม่ตั้งค่า ระบบจะทำงานเฉพาะเครื่อง (โหมดสาธิต) โดยไม่ error

const API = import.meta.env.VITE_COMMUNITY_API || '';
const LOCAL_KEY = 'cs_community_local';
const GRID = 0.01; // ~1.1 กม. ปัดพิกัดเพื่อไม่ให้ระบุแปลงได้

export function gridLat(lat) { return Math.round(lat / GRID) * GRID; }
export function gridLon(lon) { return Math.round(lon / GRID) * GRID; }

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = function (d) { return d * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; }
}
function writeLocal(arr) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 500))); } catch (e) { /* ignore */ }
}

export function communityMode() { return API ? 'online' : 'local'; }

// ข้อ 6: นับจำนวนคนใช้งานแยกตามจังหวัด แบบไม่ระบุตัวตน (ไม่เก็บชื่อ ไม่เก็บ userId จริง ไม่เก็บพิกัดแปลง)
// บันทึกครั้งเดียวต่ออุปกรณ์ ไม่ส่งซ้ำแม้เปิดแอปใหม่ (เช็คจาก VISIT_FLAG ใน localStorage)
const VISIT_FLAG = 'cs_visit_recorded_v1';

export function hasRecordedVisit() {
  try { return localStorage.getItem(VISIT_FLAG) === '1'; } catch (e) { return true; } // ถ้าอ่านไม่ได้ ถือว่าบันทึกแล้วเพื่อไม่ยิงซ้ำ
}

// แฮชแบบง่ายไว้ไม่เก็บ userId ของ LINE ตรงๆ ในชีต (ไม่ใช่การเข้ารหัสระดับความปลอดภัยสูง แค่กันไม่ให้เห็นค่าตรงๆ)
function lightHash(s) {
  if (!s) return '';
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return 'u' + Math.abs(h).toString(36);
}

export async function recordVisit(province, userId) {
  if (hasRecordedVisit()) return { ok: true, skipped: true };
  try { localStorage.setItem(VISIT_FLAG, '1'); } catch (e) { /* ignore */ }
  const rec = { province: province || 'ไม่ทราบจังหวัด', ts: Date.now(), uid: lightHash(userId) };
  if (!API) return { ok: true, mode: 'local' };
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'visit', data: rec })
    });
    return { ok: true, mode: 'online' };
  } catch (e) {
    return { ok: false, mode: 'local', error: e.message };
  }
}

// ส่งรายงาน ไม่มี userId ไม่มีชื่อแปลง ไม่มีพิกัดจริง
export async function reportOutbreak(plot, payload) {
  const rec = {
    lat: +gridLat(plot.lat).toFixed(4),
    lon: +gridLon(plot.lon).toFixed(4),
    crop: plot.crop,
    pest: payload.pest,
    kind: payload.kind || 'insect',
    severity: payload.severity || 'found',
    count: payload.count === undefined ? null : payload.count,
    note: (payload.note || '').slice(0, 140),
    date: payload.date,
    ts: Date.now()
  };
  if (!API) {
    const arr = readLocal();
    arr.unshift(rec);
    writeLocal(arr);
    return { ok: true, mode: 'local' };
  }
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'report', data: rec })
    });
    const arr = readLocal(); arr.unshift(rec); writeLocal(arr);
    return { ok: true, mode: 'online' };
  } catch (e) {
    const arr = readLocal(); arr.unshift(rec); writeLocal(arr);
    return { ok: false, mode: 'local', error: e.message };
  }
}

// ดึงรายงานรอบแปลงในรัศมีที่กำหนด
export async function fetchNearby(plot, radiusKm, days) {
  const rad = radiusKm || 5;
  const dayMs = 86400000;
  const since = Date.now() - (days || 14) * dayMs;
  let rows = [];

  if (API) {
    try {
      const url = API + '?action=nearby&lat=' + gridLat(plot.lat).toFixed(4) +
        '&lon=' + gridLon(plot.lon).toFixed(4) + '&radius=' + rad + '&days=' + (days || 14);
      const res = await fetch(url);
      if (res.ok) {
        const j = await res.json();
        rows = j.rows || [];
      }
    } catch (e) { rows = []; }
  }
  if (!rows.length) rows = readLocal();

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.lat === undefined) continue;
    if (r.ts < since) continue;
    const km = haversine(plot.lat, plot.lon, r.lat, r.lon);
    if (km > rad) continue;
    out.push(Object.assign({}, r, {
      km: +km.toFixed(1),
      daysAgo: Math.max(0, Math.round((Date.now() - r.ts) / dayMs)),
      sameCrop: r.crop === plot.crop
    }));
  }
  out.sort(function (a, b) { return b.ts - a.ts; });
  return out;
}

// จัดกลุ่มเพื่อสรุปเป็นข้อความเตือน
export function summarizeNearby(rows) {
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const k = r.pest + '|' + r.crop;
    if (!map[k]) map[k] = { pest: r.pest, crop: r.crop, count: 0, nearestKm: 99, latestDays: 99, sameCrop: r.sameCrop };
    map[k].count++;
    if (r.km < map[k].nearestKm) map[k].nearestKm = r.km;
    if (r.daysAgo < map[k].latestDays) map[k].latestDays = r.daysAgo;
  }
  const out = Object.keys(map).map(function (k) { return map[k]; });
  out.sort(function (a, b) { return (a.nearestKm - b.nearestKm) || (a.latestDays - b.latestDays); });
  return out.map(function (g) {
    return Object.assign({}, g, {
      text: 'พบรายงาน' + g.pest + ' ในรัศมี ' + g.nearestKm + ' กม. เมื่อ ' +
        (g.latestDays === 0 ? 'วันนี้' : g.latestDays + ' วันก่อน') +
        ' รวม ' + g.count + ' รายงาน' + (g.sameCrop ? ' (พืชชนิดเดียวกับแปลงคุณ)' : '')
    });
  });
}