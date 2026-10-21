import { today, addDays, diffDays, thaiDate, thaiDateShort, ymd } from './date.js';
import { TASK_META } from '../data/crops.js';
import { SCOUT_TARGETS, GENERIC_SCOUT } from '../data/scoutTargets.js';
import { PEST_GUIDE } from '../data/pestGuide.js';
import { phiLocks } from '../data/phi.js';
import { dateAtGdd, gddAtDate } from './agronomy.js';

const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function avg(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }

export function summarize(rows) {
  if (!rows || !rows.length) return null;
  const tmean = [], rh = [], rhn = [];
  let rainSum = 0, rainDays = 0, rainMax = 0, wetDays = 0, dry = 0, dryMax = 0;
  let tmaxPeak = -99, tminLow = 99;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.tmax !== undefined && r.tmax !== null) {
      tmean.push((r.tmax + r.tmin) / 2);
      if (r.tmax > tmaxPeak) tmaxPeak = r.tmax;
      if (r.tmin < tminLow) tminLow = r.tmin;
    }
    if (r.rhMean !== undefined) rh.push(r.rhMean);
    if (r.rhNight !== undefined) rhn.push(r.rhNight);
    const rain = r.rain || 0;
    rainSum += rain;
    if (rain >= 1) { rainDays++; dry = 0; } else { dry++; if (dry > dryMax) dryMax = dry; }
    if (rain > rainMax) rainMax = rain;
    if ((r.wetHours || 0) >= 8 || (r.rhNight || 0) >= 90) wetDays++;
  }
  return {
    days: rows.length, from: rows[0].date, to: rows[rows.length - 1].date,
    tmeanAvg: +avg(tmean).toFixed(1), tmaxPeak: Math.round(tmaxPeak), tminLow: Math.round(tminLow),
    rhAvg: Math.round(avg(rh)), rhNightAvg: Math.round(avg(rhn)),
    rainSum: +rainSum.toFixed(1), rainDays: rainDays, rainMax: +rainMax.toFixed(1),
    wetDays: wetDays, dryStreak: dryMax
  };
}

export function monthlySummary(rows) {
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const k = r.date.slice(0, 7);
    if (!map[k]) map[k] = { key: k, t: [], rh: [], rain: 0, rainDays: 0 };
    if (r.tmax !== undefined && r.tmax !== null) map[k].t.push((r.tmax + r.tmin) / 2);
    if (r.rhMean !== undefined) map[k].rh.push(r.rhMean);
    map[k].rain += (r.rain || 0);
    if ((r.rain || 0) >= 1) map[k].rainDays++;
  }
  return Object.keys(map).sort().map(function (k) {
    const m = map[k];
    const y = +k.slice(0, 4) + 543;
    return {
      key: k, label: TH_MONTH[+k.slice(5, 7) - 1] + ' ' + y,
      tmeanAvg: +avg(m.t).toFixed(1), rhAvg: Math.round(avg(m.rh)),
      rainSum: +m.rain.toFixed(1), rainDays: m.rainDays
    };
  });
}

export function dailyReportText(rows, plot) {
  const L = ['วันที่,อุณหภูมิสูงสุด,อุณหภูมิต่ำสุด,ความชื้นเฉลี่ย,ความชื้นกลางคืน,ฝน(มม.)'];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    L.push([r.date, r.tmax, r.tmin, r.rhMean, r.rhNight, (r.rain || 0).toFixed(1)].join(','));
  }
  return 'รายงานอากาศแปลง ' + plot.name + '\n' + L.join('\n');
}

/**
 * ข้อ 6 ตารางเฝ้าระวังรายระยะ
 * แจกแจงว่าแต่ละระยะการเจริญเติบโตต้องระวังโรคและแมลงอะไร พร้อมเกณฑ์และวิธีสำรวจ
 */
export function stageWatchTable(crop, plot, curve) {
  const t = today();
  const list = SCOUT_TARGETS[crop.id] || [];
  const guideList = PEST_GUIDE[crop.id] || [];
  const out = [];
  for (let i = 0; i < crop.stages.length; i++) {
    const s = crop.stages[i];
    const n = crop.stages[i + 1];
    const start = crop.stageMode === 'month' ? null : dateAtGdd(curve, plot, s.gdd);
    const end = (!n) ? null : (crop.stageMode === 'month' ? null : dateAtGdd(curve, plot, n.gdd));
    const targets = list.filter(function (x) { return !x.stages || x.stages.indexOf(s.key) >= 0; });
    // ข้อ 6: รายการอ้างอิงแบบเต็ม (ชื่อวิทยาศาสตร์ อาการ การจัดการ และสารเคมีพร้อมกลุ่มออกฤทธิ์+อัตราใช้)
    const guide = guideList.filter(function (x) { return x.stageKeys && x.stageKeys.indexOf(s.key) >= 0; });
    out.push({
      key: s.key, name: s.name, gdd: s.gdd, kc: s.kc,
      startDate: start, endDate: end,
      current: start && (!end || t < end) && t >= start,
      targets: targets.length ? targets.map(function (x) {
        return { name: x.name, type: x.type, ett: x.ett, method: x.method, when: whenText(x.when) };
      }) : [{ name: GENERIC_SCOUT.name, type: 'general', ett: GENERIC_SCOUT.ett, method: GENERIC_SCOUT.method, when: '-' }],
      guide: guide
    });
  }
  return out;
}

// รวมข้อความสรุป "เฝ้าระวังรายระยะ" ทั้งหมดเป็น plain text เพื่อคัดลอก/แชร์ (ข้อ 6)
export function stageWatchText(plot, crop, watch) {
  const L = ['เฝ้าระวังรายระยะ: แปลง ' + plot.name + ' (' + crop.name + ')', ''];
  for (let i = 0; i < watch.length; i++) {
    const w = watch[i];
    L.push((w.current ? '>> ' : '') + 'ระยะ ' + w.name + (w.current ? ' (ระยะปัจจุบัน)' : ''));
    for (let j = 0; j < w.targets.length; j++) {
      const x = w.targets[j];
      L.push('  - ' + x.name + (x.ett ? ' : ' + x.ett : ''));
    }
    if (w.guide && w.guide.length) {
      for (let j = 0; j < w.guide.length; j++) {
        const g = w.guide[j];
        L.push('  [ข้อมูลอ้างอิง] ' + g.name);
        if (g.watch) L.push('    สังเกต: ' + g.watch);
        if (g.manage) L.push('    จัดการ: ' + g.manage);
        if (g.chem && g.chem.length) {
          for (let k = 0; k < g.chem.length; k++) {
            L.push('    สาร: ' + (g.chem[k].g ? '[กลุ่ม ' + g.chem[k].g + '] ' : '') + g.chem[k].t);
          }
        }
      }
    }
    L.push('');
  }
  L.push('หมายเหตุ: อัตราสารเป็นข้อมูลอ้างอิง ควรตรวจสอบกับฉลากจริงหรือเจ้าหน้าที่ก่อนใช้งาน');
  return L.join('\n');
}

function whenText(w) {
  if (!w) return 'ทุกสภาพอากาศ';
  const k = Object.keys(w);
  if (!k.length) return 'ทุกสภาพอากาศ';
  const L = [];
  if (w.rhMin) L.push('ความชื้นเฉลี่ยตั้งแต่ ' + w.rhMin + '%');
  if (w.rhNightMin) L.push('ความชื้นกลางคืนตั้งแต่ ' + w.rhNightMin + '%');
  if (w.tmaxMin) L.push('อุณหภูมิสูงสุดตั้งแต่ ' + w.tmaxMin + '°C');
  if (w.tmaxMax) L.push('อุณหภูมิสูงสุดไม่เกิน ' + w.tmaxMax + '°C');
  if (w.tminMax) L.push('อุณหภูมิต่ำสุดไม่เกิน ' + w.tminMax + '°C');
  if (w.rain7Min) L.push('ฝนสะสม 7 วันตั้งแต่ ' + w.rain7Min + ' มม.');
  if (w.rain7Max) L.push('ฝนสะสม 7 วันไม่เกิน ' + w.rain7Max + ' มม.');
  if (w.dryStreakMin) L.push('ฝนทิ้งช่วงตั้งแต่ ' + w.dryStreakMin + ' วัน');
  if (w.wetHoursMin) L.push('ใบเปียกนานตั้งแต่ ' + w.wetHoursMin + ' ชั่วโมง');
  return L.join(' และ ');
}

export function buildPlanReport(plot, crop, derived, alerts, activities, endDate) {
  const t = today();
  const tasks = derived.tasks || [];
  const overdue = [], upcoming = [];
  let doneCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const x = tasks[i];
    if (x.done) doneCount++;
    if (x.date < t && !x.done) overdue.push(x);
    else if (x.date >= t && diffDays(t, x.date) <= 60) upcoming.push(x);
  }

  const map = {};
  for (let i = 0; i < tasks.length; i++) {
    const x = tasks[i];
    const k = x.date.slice(0, 7);
    if (!map[k]) map[k] = { key: k, items: [], counts: {} };
    map[k].items.push(x);
    map[k].counts[x.type] = (map[k].counts[x.type] || 0) + 1;
  }
  const months = Object.keys(map).sort().map(function (k) {
    const y = +k.slice(0, 4) + 543;
    return Object.assign(map[k], { label: TH_MONTH[+k.slice(5, 7) - 1] + ' ' + y });
  });

  const locks = phiLocks(activities, plot.id, function (d, n) { return ymd(addDays(d, n)); })
    .filter(function (l) { return l.safeDate >= t; });

  return {
    plot: plot, crop: crop,
    age: derived.stageInfo.age,
    gdd: derived.stageInfo.gdd,
    rate: derived.stageInfo.rate,
    maturityGdd: derived.stageInfo.maturityGdd,
    stage: derived.stageInfo,
    tasksTotal: tasks.length,
    doneCount: doneCount,
    overdue: overdue,
    upcoming: upcoming,
    months: months,
    alerts: alerts || [],
    endDate: endDate,
    daysToEnd: diffDays(t, endDate),
    stageWatch: stageWatchTable(crop, plot, derived.curve),
    phiLocks: locks,
    water: derived.water || null
  };
}

export function planReportText(plan) {
  const L = [];
  L.push('รายงานปฏิทินการผลิต แปลง ' + plan.plot.name);
  L.push('พืช ' + plan.crop.name + ' อายุ ' + plan.age + ' วัน');
  L.push('ความร้อนสะสม ' + plan.gdd + ' GDD จากเป้าหมาย ' + plan.maturityGdd + ' GDD (เฉลี่ย ' + plan.rate + ' GDD ต่อวัน)');
  L.push('ระยะปัจจุบัน ' + (plan.stage.afterHarvest ? 'สิ้นสุดรอบแล้ว' : plan.stage.stage.name));
  L.push('สิ้นสุดรอบการผลิต ' + thaiDate(plan.endDate, true));
  if (plan.water && plan.water.summary) L.push('น้ำ: ' + plan.water.summary.advice);
  L.push('');
  if (plan.phiLocks.length) {
    L.push('ระยะปลอดภัยก่อนเก็บเกี่ยวที่ยังมีผล');
    for (let i = 0; i < plan.phiLocks.length; i++) {
      const p = plan.phiLocks[i];
      L.push(' - ' + p.chem + ' พ่น ' + thaiDateShort(p.sprayDate) + ' เก็บเกี่ยวได้ตั้งแต่ ' + thaiDateShort(p.safeDate) + ' (' + p.phi + ' วัน)');
    }
    L.push('');
  }
  L.push('งานที่เลยกำหนด ' + plan.overdue.length + ' รายการ');
  L.push('งานใน 60 วันข้างหน้า');
  for (let i = 0; i < plan.upcoming.length; i++) {
    const x = plan.upcoming[i];
    const m = TASK_META[x.type];
    L.push(' ' + thaiDateShort(x.date) + ' [' + (m ? m.label : x.type) + '] ' + x.title);
  }
  L.push('');
  L.push('การเฝ้าระวังรายระยะ');
  for (let i = 0; i < plan.stageWatch.length; i++) {
    const s = plan.stageWatch[i];
    L.push(' ' + s.name + (s.current ? ' (ระยะปัจจุบัน)' : '') + ': ' +
      s.targets.map(function (x) { return x.name; }).join(', '));
  }
  return L.join('\n');
}