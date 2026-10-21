import { SCOUT_TARGETS, GENERIC_SCOUT } from '../data/scoutTargets.js';

// สรุปลักษณะอากาศรอบวันที่กำหนด ย้อนหลัง 7 วัน และล่วงหน้า 7 วัน
export function weatherFeatures(series, date) {
  if (!series || !series.length) return null;
  let idx = -1;
  for (let i = 0; i < series.length; i++) if (series[i].date <= date) idx = i;
  if (idx < 0) idx = 0;
  const from = Math.max(0, idx - 6);
  const past = series.slice(from, idx + 1);
  const next = series.slice(idx + 1, idx + 8);
  if (!past.length) return null;

  let tmax = 0, tmin = 0, rh = 0, rhn = 0, rain7 = 0, rainDays = 0, wet = 0, n = 0;
  for (let i = 0; i < past.length; i++) {
    const r = past[i];
    if (r.tmax === undefined || r.tmax === null) continue;
    tmax += r.tmax; tmin += r.tmin;
    rh += (r.rhMean || 0); rhn += (r.rhNight || r.rhMean || 0);
    rain7 += (r.rain || 0);
    if ((r.rain || 0) >= 1) rainDays++;
    if ((r.wetHours || 0) >= 8 || ((r.rhNight || 0) >= 90)) wet++;
    n++;
  }
  if (!n) return null;

  let dry = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if ((past[i].rain || 0) < 1) dry++; else break;
  }

  let rainNext = 0;
  for (let i = 0; i < next.length; i++) rainNext += (next[i].rain || 0);

  return {
    date: date,
    tmaxAvg: +(tmax / n).toFixed(1),
    tminAvg: +(tmin / n).toFixed(1),
    rhAvg: Math.round(rh / n),
    rhNightAvg: Math.round(rhn / n),
    rain7: +rain7.toFixed(1),
    rainDays7: rainDays,
    wetDays7: wet,
    dryStreak: dry,
    rainNext7: +rainNext.toFixed(1),
    samples: n
  };
}

function matchWhen(when, f) {
  if (!when) return { ok: true, score: 0 };
  const keys = Object.keys(when);
  let score = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = when[k];
    let pass = true;
    if (k === 'rhMin') pass = f.rhAvg >= v;
    else if (k === 'rhNightMin') pass = f.rhNightAvg >= v;
    else if (k === 'tmaxMin') pass = f.tmaxAvg >= v;
    else if (k === 'tmaxMax') pass = f.tmaxAvg <= v;
    else if (k === 'tminMax') pass = f.tminAvg <= v;
    else if (k === 'rain7Min') pass = f.rain7 >= v;
    else if (k === 'rain7Max') pass = f.rain7 <= v;
    else if (k === 'dryStreakMin') pass = f.dryStreak >= v;
    else if (k === 'wetHoursMin') pass = f.wetDays7 >= 2;
    if (!pass) return { ok: false, score: 0 };
    score++;
  }
  return { ok: true, score: score };
}

// เลือกเป้าหมายการสำรวจตามระยะการเจริญเติบโตและอากาศ
// ถ้าข้อมูลไม่พอหรือไม่มีชนิดใดเข้าเงื่อนไข จะคืนงานสำรวจทั่วไป
export function pickScoutTargets(crop, stageKey, f) {
  const list = SCOUT_TARGETS[crop.id] || [];
  if (!list.length) return { generic: true, targets: [GENERIC_SCOUT], reason: 'ยังไม่มีฐานข้อมูลเฝ้าระวังเฉพาะของพืชชนิดนี้' };
  if (!f || f.samples < 3) return { generic: true, targets: [GENERIC_SCOUT], reason: 'ข้อมูลอากาศย้อนหลังไม่เพียงพอต่อการระบุชนิด' };

  const hits = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.stages && stageKey && t.stages.indexOf(stageKey) < 0) continue;
    const m = matchWhen(t.when, f);
    if (!m.ok) continue;
    hits.push({
      key: t.key, name: t.name, type: t.type, ett: t.ett, method: t.method,
      score: (t.prio || 1) * 10 + m.score,
      conf: m.score >= 2 ? 'high' : (m.score === 1 ? 'medium' : 'low')
    });
  }

  if (!hits.length) {
    return { generic: true, targets: [GENERIC_SCOUT], reason: 'สภาพอากาศช่วงนี้ยังไม่เข้าเงื่อนไขเสี่ยงของศัตรูพืชชนิดใดชัดเจน' };
  }
  hits.sort(function (a, b) { return b.score - a.score; });
  const top = hits.slice(0, 3);
  const strong = top.filter(function (x) { return x.conf !== 'low'; });
  if (!strong.length) {
    return { generic: true, targets: [GENERIC_SCOUT], reason: 'เงื่อนไขที่ตรงมีน้ำหนักน้อยเกินกว่าจะระบุชนิดได้แน่ชัด', hint: top };
  }
  return { generic: false, targets: top, reason: '' };
}

// สร้างชื่องานสำรวจจากผลการเลือก
export function scoutTitle(pick) {
  if (pick.generic) return GENERIC_SCOUT.name;
  const names = pick.targets.map(function (t) { return t.name; });
  return 'สำรวจ ' + names.join(' / ');
}