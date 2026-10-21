import { CROPS } from '../data/crops.js';
import { ALERT_RULES, CONF_LABEL, TRIGGER_LABEL } from '../data/alertRules.js';
import { today, diffDays } from './date.js';

const LEVEL_RANK = { high: 3, alert: 2, watch: 1 };

export const LEVEL_LABEL = {
  high: 'เฝ้าระวังสูง (HIGH ALERT)',
  alert: 'แจ้งเตือน (ALERT)',
  watch: 'เริ่มเข้าเงื่อนไข (WATCH)'
};

function num(v) { return typeof v === 'number' && !isNaN(v) ? v : null; }
function inRange(v, r) { return v !== null && v >= r[0] && v <= r[1]; }

function matchDay(d, c) {
  if (!c) return false;
  if (c.tmean && !inRange(num(d.tmean), c.tmean)) return false;
  if (c.tmax && !inRange(num(d.tmax), c.tmax)) return false;
  if (c.tmin && !inRange(num(d.tmin), c.tmin)) return false;
  if (c.tmaxGte !== undefined && !(num(d.tmax) !== null && d.tmax >= c.tmaxGte)) return false;
  if (c.rh && !inRange(num(d.rhMean), c.rh)) return false;
  if (c.rhGte !== undefined && !(num(d.rhMean) !== null && d.rhMean >= c.rhGte)) return false;
  if (c.rhLte !== undefined && !(num(d.rhMean) !== null && d.rhMean <= c.rhLte)) return false;
  if (c.rhNightGte !== undefined && !(num(d.rhNight) !== null && d.rhNight >= c.rhNightGte)) return false;
  if (c.wetGte !== undefined && !((d.wetHours || 0) >= c.wetGte)) return false;
  if (c.rainGte !== undefined && !((d.rain || 0) >= c.rainGte)) return false;
  if (c.rainLte !== undefined && !((d.rain || 0) <= c.rainLte)) return false;
  if (c.dryGte !== undefined && !((d.dryStreak || 0) >= c.dryGte)) return false;
  return true;
}

function extraPass(series, idx, extra) {
  if (!extra) return true;
  if (extra.rainSumDays) {
    let s = 0;
    for (let i = Math.max(0, idx - extra.rainSumDays + 1); i <= idx; i++) s += series[i].rain || 0;
    if (extra.rainSumGte !== undefined && !(s >= extra.rainSumGte)) return false;
    if (extra.rainSumLte !== undefined && !(s <= extra.rainSumLte)) return false;
  }
  return true;
}

function countWindow(series, idx, rule) {
  const need = rule.need || 1;
  const win = rule.within || need;
  let count = 0;
  const hits = [];
  for (let i = Math.max(0, idx - win + 1); i <= idx; i++) {
    if (matchDay(series[i], rule.cond)) { count++; hits.push(series[i].date); }
  }
  return { count: count, hits: hits };
}

function eventWindow(series, idx, rule) {
  const win = rule.windowDays || rule.within || 2;
  const hits = [];
  for (let i = Math.max(0, idx - win + 1); i <= idx; i++) {
    if (matchDay(series[i], rule.cond)) hits.push(series[i].date);
  }
  return hits;
}

export function evaluateAlerts(plot, series, stageInfo, activities) {
  const t = today();
  let idx = -1;
  for (let i = 0; i < series.length; i++) if (series[i].date === t) { idx = i; break; }
  if (idx < 0) return [];

  const crop = CROPS[plot.crop];
  if (!crop) return [];
  if (stageInfo && (stageInfo.afterHarvest || stageInfo.beforeStart)) return [];

  const acts = activities || [];
  let pestLogged = false;
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    if (a.plotId === plot.id && a.type === 'pest') {
      const d = diffDays(a.date, t);
      if (d >= 0 && d <= 14) pestLogged = true;
    }
  }

  const stageKey = stageInfo && stageInfo.stage ? stageInfo.stage.key : null;
  const out = [];

  for (let i = 0; i < ALERT_RULES.length; i++) {
    const rule = ALERT_RULES[i];
    if (rule.crop !== crop.id) continue;
    if (rule.stages && stageKey && rule.stages.indexOf(stageKey) < 0) continue;
    if (!extraPass(series, idx, rule.extra)) continue;

    let level = null;
    let progress = '';
    let evidence = [];

    if (rule.type === 'scout') {
      level = 'watch';
      progress = 'ต้องยืนยันด้วยการสำรวจแปลง ไม่ใช้สภาพอากาศเป็นตัวกระตุ้น';
      evidence = ['เกณฑ์ชนิดนี้ให้แจ้งเตือนเมื่อตรวจพบอาการหรือตัวศัตรูพืชโดยตรง'];
    } else if (rule.type === 'event' || rule.type === 'window') {
      const hits = eventWindow(series, idx, rule);
      if (!hits.length) continue;
      const lastHit = hits[hits.length - 1];
      const ago = diffDays(lastHit, t);
      level = rule.type === 'event' ? 'alert' : (ago <= 7 ? 'alert' : 'watch');
      progress = 'พบเหตุการณ์เมื่อ ' + (ago === 0 ? 'วันนี้' : ago + ' วันก่อน');
      evidence = ['เหตุการณ์กระตุ้นวันที่ ' + lastHit, 'หน้าต่างเฝ้าระวัง ' + (rule.windowDays || rule.within || 2) + ' วัน'];
    } else {
      const res = countWindow(series, idx, rule);
      const need = rule.need || 1;
      if (res.count <= 0) continue;
      const unit = rule.type === 'nights' ? 'คืน' : 'วัน';
      progress = 'เข้าเงื่อนไขแล้ว ' + res.count + ' / ' + need + ' ' + unit;
      if (res.count >= need) level = 'alert';
      else if (res.count >= Math.max(1, need - 2)) level = 'watch';
      else continue;
      evidence = ['จำนวน' + unit + 'ที่เข้าเงื่อนไข ' + res.count + ' จากกรอบ ' + (rule.within || need) + ' วัน'];
      if (res.hits.length) evidence.push('วันที่เข้าเงื่อนไขล่าสุด ' + res.hits[res.hits.length - 1]);
    }

    if (level === 'alert' && (rule.conf === 'H' || pestLogged)) level = 'high';

    const r0 = series[idx];
    evidence.push('วันนี้ อุณหภูมิเฉลี่ย ' + (r0.tmean === null ? '-' : Math.round(r0.tmean)) +
      ' องศา ความชื้น ' + (r0.rhMean === undefined ? '-' : r0.rhMean) +
      ' เปอร์เซ็นต์ ฝน ' + (r0.rain || 0).toFixed(1) + ' มม.');

    out.push({
      id: rule.id, name: rule.name, kind: rule.kind, level: level,
      levelLabel: LEVEL_LABEL[level], conf: rule.conf, confLabel: CONF_LABEL[rule.conf],
      triggerLabel: TRIGGER_LABEL[rule.type], progress: progress, risk: rule.risk,
      rule: rule.rule, act: rule.act || [], chem: rule.chem || [], img: rule.img || null,
      evidence: evidence, boosted: pestLogged && rule.kind === 'pest'
    });
  }

  out.sort(function (a, b) { return LEVEL_RANK[b.level] - LEVEL_RANK[a.level]; });
  return out;
}