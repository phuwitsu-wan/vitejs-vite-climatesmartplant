import { CROPS } from '../data/crops.js';
import { today, addDays, diffDays, toDate, ymd } from './date.js';
import { pickScoutTargets, scoutTitle, weatherFeatures } from './scout.js';
import { phiLocks, harvestBlocked } from '../data/phi.js';

const FALLBACK_RATE = 12;   // GDD ต่อวัน กรณีข้อมูลไม่พอ
const RAIN_BLOCK = 10;      // มม. ที่ถือว่าฝนแรงพอจะเลื่อนงานไวฝน

// date.js: addDays() คืนค่าเป็น Date object (จำเป็นสำหรับ CalendarView ที่ต้องเรียก .getDate()/.getMonth())
// แต่ไฟล์นี้เก็บวันที่เป็น string "YYYY-MM-DD" ทุกจุด (เทียบ <, >, .slice() กับ series/tasks อื่น)
// การส่ง Date object ปนเข้าไปทำให้การเทียบ/slice พังแบบเงียบๆ หรือ error ตรงๆ (ต้นเหตุ error หน้ารายงาน)
// ใช้ wrapper นี้แทน addDays ทุกจุดในไฟล์นี้ เพื่อให้ผลลัพธ์เป็น string เสมอ
function addDaysStr(d, n) { return ymd(addDays(d, n)); }

export function gddOfDay(row, crop) {
  if (!row || row.tmax === undefined || row.tmax === null) return 0;
  const tmax = Math.min(row.tmax, crop.tcap);
  const tmin = Math.max(row.tmin, crop.tbase);
  if (tmax <= crop.tbase) return 0;
  const g = (tmax + tmin) / 2 - crop.tbase;
  return g > 0 ? g : 0;
}

export function buildGddCurve(series, plot) {
  const crop = CROPS[plot.crop];
  const out = [];
  let cum = 0;
  for (let i = 0; i < series.length; i++) {
    const r = series[i];
    if (r.date < plot.plantedAt) continue;
    const d = gddOfDay(r, crop);
    cum += d;
    out.push({
      date: r.date, gdd: Math.round(cum), daily: +d.toFixed(1),
      isPast: r.isPast, tmax: r.tmax, tmin: r.tmin, rain: r.rain || 0
    });
  }
  return out;
}

export function gddRate(curve) {
  if (!curve || !curve.length) return FALLBACK_RATE;
  const n = Math.min(14, curve.length);
  const s = curve.slice(curve.length - n);
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s[i].daily;
  const r = sum / s.length;
  return r > 1 ? r : FALLBACK_RATE;
}

export function gddAtDate(curve, date) {
  let g = 0;
  for (let i = 0; i < curve.length; i++) if (curve[i].date <= date) g = curve[i].gdd;
  return g;
}

// แปลงค่า GDD เป้าหมายเป็นวันที่ ถ้าเกินข้อมูลที่มีจะคาดการณ์ด้วยอัตราสะสมปัจจุบัน
export function dateAtGdd(curve, plot, target) {
  if (!curve || !curve.length) {
    return addDaysStr(plot.plantedAt, Math.max(0, Math.round(target / FALLBACK_RATE)));
  }
  for (let i = 0; i < curve.length; i++) if (curve[i].gdd >= target) return curve[i].date;
  const last = curve[curve.length - 1];
  const rate = gddRate(curve);
  const need = Math.ceil((target - last.gdd) / rate);
  return addDaysStr(last.date, need > 0 ? need : 0);
}

function monthAnchorDate(plot, month, day) {
  const start = toDate(plot.plantedAt);
  let y = start.getFullYear();
  let d = y + '-' + String(month).padStart(2, '0') + '-' + String(day || 1).padStart(2, '0');
  if (d < plot.plantedAt) {
    y++;
    d = y + '-' + String(month).padStart(2, '0') + '-' + String(day || 1).padStart(2, '0');
  }
  return d;
}

export function maturityGdd(crop) {
  if (crop.gddMature) return crop.gddMature;
  const last = crop.stages[crop.stages.length - 1];
  return last.gdd || 0;
}

// ข้อ 2: สิ้นสุดรอบการผลิตคำนวณจาก GDD เป็นหลัก วันตายตัวใช้เป็นกรอบกันค่าเพี้ยน
export function seasonEnd(crop, plot, curve) {
  if (crop.stageMode === 'month' || crop.perennial) {
    return addDaysStr(plot.plantedAt, crop.cycleDays);
  }
  const target = maturityGdd(crop);
  if (!target) return addDaysStr(plot.plantedAt, crop.cycleDays);
  let d = dateAtGdd(curve, plot, target);
  const min = addDaysStr(plot.plantedAt, Math.round(crop.cycleDays * 0.65));
  const max = addDaysStr(plot.plantedAt, Math.round(crop.cycleDays * 1.5));
  if (d < min) d = min;
  if (d > max) d = max;
  return d;
}

export function stageKeyAtGdd(crop, gdd, date) {
  if (crop.stageMode === 'month') {
    const m = toDate(date).getMonth() + 1;
    for (let i = 0; i < crop.stages.length; i++) {
      const s = crop.stages[i];
      if (s.months && s.months.indexOf(m) >= 0) return s.key;
    }
    return crop.stages[0].key;
  }
  let key = crop.stages[0].key;
  for (let i = 0; i < crop.stages.length; i++) if (gdd >= crop.stages[i].gdd) key = crop.stages[i].key;
  return key;
}

// แกนกลางของการคำนวณระยะการเติบโต รับ "วันที่ที่ต้องการดู" (dateStr) เป็นพารามิเตอร์
// เพื่อให้ใช้ซ้ำได้ทั้งกรณี "วันนี้" (currentStage) และ "วันไหนก็ได้" (stageOnDate ใช้ในปฏิทิน)
// หมายเหตุ: ลำดับพารามิเตอร์ (crop, plot, curve, ...) ตรงกับฟังก์ชันอื่นทุกตัวในไฟล์นี้
// (seasonEnd, stageTimeline, stageSegments, harvestCutoff ฯลฯ) และตรงกับที่ CalendarView.jsx เรียกใช้จริง
function computeStage(crop, plot, curve, dateStr) {
  const t = dateStr;
  const beforeStart = t < plot.plantedAt;
  const age = diffDays(plot.plantedAt, t);
  const gdd = beforeStart ? 0 : gddAtDate(curve, t);
  const end = seasonEnd(crop, plot, curve);
  const afterHarvest = !crop.perennial && !beforeStart && t > end;

  let idx = 0;
  let basis = 'gdd';
  if (afterHarvest) {
    // สิ้นสุดรอบแล้วตามวันที่ (end ถูกยึดกรอบไว้แล้วใน seasonEnd) ไม่ต้องรอ GDD ไล่ตามทัน
    // ถือว่าทุกระยะผ่านหมดแล้ว แสดงระยะสุดท้ายและ 100% เสมอ ไม่ว่า GDD สะสมจริงจะถึงเป้าหรือไม่
    idx = crop.stages.length - 1;
    basis = crop.stageMode === 'month' ? 'month' : (curve.length ? 'gdd' : 'dap');
  } else if (crop.stageMode === 'month') {
    basis = 'month';
    const m = toDate(t).getMonth() + 1;
    for (let i = 0; i < crop.stages.length; i++) {
      const s = crop.stages[i];
      if (s.months && s.months.indexOf(m) >= 0) idx = i;
    }
  } else {
    if (!curve.length) basis = 'dap';
    for (let i = 0; i < crop.stages.length; i++) {
      if (basis === 'gdd' ? gdd >= crop.stages[i].gdd : age >= crop.stages[i].dap) idx = i;
    }
  }

  const stage = crop.stages[idx];
  const next = crop.stages[idx + 1] || null;
  const nextDate = next ? (crop.stageMode === 'month'
    ? monthAnchorDate(plot, next.months[0], 1)
    : dateAtGdd(curve, plot, next.gdd)) : null;
  let pct = 100;
  if (!afterHarvest && next && basis === 'gdd' && next.gdd > stage.gdd) {
    pct = ((gdd - stage.gdd) / (next.gdd - stage.gdd)) * 100;
    if (pct < 0) pct = 0; if (pct > 100) pct = 100;
  }

  return {
    age: age, gdd: gdd, rate: +gddRate(curve).toFixed(1),
    stage: stage, index: idx, next: next, nextDate: nextDate,
    pctToNext: Math.round(pct), basis: basis, endDate: end,
    maturityGdd: maturityGdd(crop),
    beforeStart: beforeStart,
    afterHarvest: afterHarvest
  };
}

export function currentStage(crop, plot, curve) {
  return computeStage(crop, plot, curve, today());
}

// ใช้ดูระยะการเติบโตของ "วันไหนก็ได้" ไม่ใช่แค่วันนี้ (ปฏิทินต้องใช้แสดงแต่ละวัน)
export function stageOnDate(crop, plot, curve, dateStr) {
  return computeStage(crop, plot, curve, dateStr);
}

export function stageTimeline(crop, plot, curve) {
  const t = today();
  const end = seasonEnd(crop, plot, curve);
  const afterHarvest = !crop.perennial && t > plot.plantedAt && t > end;
  return crop.stages.map(function (s) {
    const d = crop.stageMode === 'month'
      ? monthAnchorDate(plot, s.months[0], 1)
      : dateAtGdd(curve, plot, s.gdd);
    return { key: s.key, name: s.name, gdd: s.gdd, date: d, done: afterHarvest || d <= t };
  });
}

export function stageSegments(crop, plot, curve, dateStr) {
  const t = dateStr || today();
  const gddNow = gddAtDate(curve, t);
  const total = maturityGdd(crop) * 1.05 || 1;
  const end = seasonEnd(crop, plot, curve);
  const afterHarvest = !crop.perennial && t > plot.plantedAt && t > end;
  const out = [];
  for (let i = 0; i < crop.stages.length; i++) {
    const s = crop.stages[i];
    const n = crop.stages[i + 1];
    const start = s.gdd;
    const endG = n ? n.gdd : total;
    const span = Math.max(1, endG - start);
    let fill = afterHarvest ? 100 : ((gddNow - start) / span) * 100;
    if (fill < 0) fill = 0; if (fill > 100) fill = 100;
    out.push({
      key: s.key, name: s.name, startGdd: start, endGdd: endG,
      widthPct: (span / total) * 100, fillPct: fill,
      isNow: !afterHarvest && gddNow >= start && gddNow < endG
    });
  }
  return out;
}

export function harvestCutoff(crop, plot, curve, end) {
  if (crop.perennial) return null;              // ข้อ 3: ไม้ผลไม่ตัด
  let hd = null;
  for (let i = 0; i < crop.tasks.length; i++) {
    const t = crop.tasks[i];
    if (t.type !== 'harvest') continue;
    const d = resolveBaseDate(t, crop, plot, curve);
    if (!hd || d < hd) hd = d;
  }
  return hd || end;
}

function resolveBaseDate(task, crop, plot, curve) {
  const tr = task.trigger;
  if (tr.by === 'gdd') return dateAtGdd(curve, plot, tr.value);
  if (tr.by === 'month') return monthAnchorDate(plot, tr.value, tr.day || 1);
  return addDaysStr(plot.plantedAt, tr.value);
}

function seriesRow(series, date) {
  for (let i = 0; i < series.length; i++) if (series[i].date === date) return series[i];
  return null;
}

// เลื่อนงานที่ห้ามทำตอนฝนตกหนัก
function shiftForRain(date, series) {
  const r = seriesRow(series, date);
  if (!r || (r.rain || 0) < RAIN_BLOCK) return { date: date, shifted: false };
  for (let k = 1; k <= 6; k++) {
    const d = addDaysStr(date, k);
    const rr = seriesRow(series, d);
    if (!rr) break;
    if ((rr.rain || 0) < RAIN_BLOCK) {
      return { date: d, shifted: true, note: 'เลื่อนจาก ' + date + ' เพราะพยากรณ์ฝน ' + (r.rain || 0).toFixed(0) + ' มม.' };
    }
  }
  return { date: date, shifted: false };
}

function isDone(activities, plot, type, date) {
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (a.plotId !== plot.id) continue;
    if (a.type !== type) continue;
    const d = Math.abs(diffDays(a.date, date));
    if (d <= 3) return true;
  }
  return false;
}

/**
 * ข้อ 2 3 4 5 7 รวมกัน
 * opts = { curve, waterPlan, soil }
 */
export function generateTasks(plot, series, activities, opts) {
  const crop = CROPS[plot.crop];
  const o = opts || {};
  const curve = o.curve || buildGddCurve(series, plot);
  const end = seasonEnd(crop, plot, curve);
  const cutoff = harvestCutoff(crop, plot, curve, end);
  const locks = phiLocks(activities, plot.id, addDaysStr);
  const out = [];

  for (let i = 0; i < crop.tasks.length; i++) {
    const t = crop.tasks[i];
    if (t.mode && plot.waterMode && t.mode !== plot.waterMode) continue;
    if (t.type === 'water' && o.waterPlan && o.waterPlan.managed) continue; // ข้อ 5 ให้สมดุลน้ำคุมแทน

    let base = resolveBaseDate(t, crop, plot, curve);
    let stopDate = end;
    if (t.stopAtStage) {
      for (let k = 0; k < crop.stages.length; k++) {
        if (crop.stages[k].key === t.stopAtStage) stopDate = dateAtGdd(curve, plot, crop.stages[k].gdd);
      }
    }
    if (cutoff && t.type !== 'harvest' && stopDate > cutoff) stopDate = cutoff;

    const dates = [base];
    if (t.repeatDays) {
      let d = base;
      for (let k = 0; k < 40; k++) {
        d = addDaysStr(d, t.repeatDays);
        if (d > stopDate) break;
        dates.push(d);
      }
    }

    for (let k = 0; k < dates.length; k++) {
      let d = dates[k];
      // ข้อ 3 ตัดงานทุกชนิดที่เลยวันเก็บเกี่ยว ยกเว้นงานเก็บเกี่ยวเองและไม้ผล
      if (cutoff && t.type !== 'harvest' && d > cutoff) continue;
      if (!crop.perennial && d > addDaysStr(end, 14)) continue;

      let shifted = false, note = '';
      if (t.rainSensitive) {
        const s = shiftForRain(d, series);
        d = s.date; shifted = s.shifted; note = s.note || '';
      }

      const item = {
        key: t.id + '-' + k,
        taskId: t.id,
        type: t.type,
        title: t.title,
        detail: t.detail || '',
        date: d,
        gddTarget: t.trigger.by === 'gdd' ? t.trigger.value : null,
        gddAt: gddAtDate(curve, d),
        shifted: shifted,
        note: note,
        done: isDone(activities, plot, t.type, d)
      };

      // ข้อ 4 ระบุชนิดศัตรูพืชที่ต้องสำรวจตามระยะและอากาศ
      if (t.type === 'scout') {
        const f = weatherFeatures(series, d);
        const stageKey = stageKeyAtGdd(crop, item.gddAt, d);
        const pick = pickScoutTargets(crop, stageKey, f);
        item.title = scoutTitle(pick);
        item.generic = pick.generic;
        item.targets = pick.targets;
        item.stageKey = stageKey;
        item.detail = pick.generic
          ? pick.reason + ' — ' + pick.targets[0].method
          : pick.targets.map(function (x) { return x.name + ': ' + x.method; }).join(' | ');
      }

      // ข้อ 7 ตรวจระยะปลอดภัยก่อนเก็บเกี่ยว
      if (t.type === 'harvest') {
        const blk = harvestBlocked(locks, d);
        if (blk) {
          item.phiWarn = 'ห้ามเก็บเกี่ยวก่อน ' + blk.safeDate + ' เพราะพ่น' + blk.chem +
            ' เมื่อ ' + blk.sprayDate + ' ระยะปลอดภัย ' + blk.phi + ' วัน';
          item.phiSafeDate = blk.safeDate;
        }
      }

      out.push(item);
    }
  }

  // ข้อ 5 งานให้น้ำที่มาจากสมดุลน้ำจริง
  if (o.waterPlan && o.waterPlan.managed && o.waterPlan.nextDate) {
    const w = o.waterPlan;
    out.push({
      key: 'water-plan',
      taskId: 'water-balance',
      type: 'water',
      title: w.postponed ? 'ให้น้ำ (เลื่อนออกไปแล้ว)' : 'ให้น้ำ ' + w.amountMm + ' มม.',
      detail: w.advice,
      date: w.nextDate,
      gddAt: gddAtDate(curve, w.nextDate),
      source: 'water-balance',
      postponed: w.postponed,
      done: isDone(activities, plot, 'water', w.nextDate)
    });
  }

  out.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  return out;
}

export { phiLocks };