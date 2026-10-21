import { TEXTURE_INFO } from '../data/soilGuide.js';
import { today, addDays, diffDays, thaiDate, ymd } from './date.js';

// ความลึกรากที่ใช้คำนวณน้ำที่เป็นประโยชน์ หน่วยเมตร
const ROOT_DEPTH = {
  rice: 0.35, ricePhoto: 0.35, maize: 0.6, cassava: 0.8, chili: 0.4, mungbean: 0.5,
  sugarcane: 0.8, garlic: 0.3, cabbage: 0.35,
  durian: 0.8, avocado: 0.7, avocadoLight: 0.7, avocadoHeavy: 0.7,
  tamarind: 0.9, mangoRipe: 0.9, mangoGreen: 0.9
};
const DEFAULT_AWC = 140;    // มม. ต่อเมตร กรณีไม่มีข้อมูลดิน
const MM_PER_RAI_M3 = 1.6;  // 1 มม. ต่อไร่ เท่ากับ 1.6 ลูกบาศก์เมตร

// สัดส่วนฝนที่พืชใช้ประโยชน์ได้จริง (ที่เหลือซึมลึกเกินรากหรือไหลบ่าทิ้ง) ปรับตามเนื้อดิน
// ดินทรายระบายเร็วเก็บน้ำได้น้อยกว่า ดินร่วนเก็บได้ดีที่สุด ดินเหนียวระบายช้าเสี่ยงไหลบ่าเมื่อฝนแรง
const EFF_FACTOR_BY_TEXTURE = {
  sand: 65, loamysand: 70, sandyloam: 75, loam: 80, siltloam: 80,
  clayloam: 78, sandyclay: 72, clay: 70
};
const DEFAULT_EFF_FACTOR = 75;

function kcAtGdd(crop, gdd, date) {
  let kc = crop.stages[0].kc || 0.8;
  let stageName = crop.stages[0].name;
  if (crop.stageMode === 'month') {
    const m = +date.slice(5, 7);
    for (let i = 0; i < crop.stages.length; i++) {
      const s = crop.stages[i];
      if (s.months && s.months.indexOf(m) >= 0) { kc = s.kc; stageName = s.name; }
    }
    return { kc: kc, stageName: stageName };
  }
  for (let i = 0; i < crop.stages.length; i++) if (gdd >= crop.stages[i].gdd) { kc = crop.stages[i].kc; stageName = crop.stages[i].name; }
  return { kc: kc, stageName: stageName };
}

// ET0 แบบ Hargreaves อย่างง่าย เพียงพอสำหรับการวางแผนระดับแปลง
function et0Of(row) {
  if (row.et0 !== undefined && row.et0 !== null) return row.et0;
  if (row.tmax === undefined || row.tmax === null) return 4;
  const tmean = (row.tmax + row.tmin) / 2;
  const dt = Math.max(0, row.tmax - row.tmin);
  const v = 0.0023 * (tmean + 17.8) * Math.sqrt(dt) * 15.0 * 0.408;
  return Math.max(1.5, Math.min(8, +v.toFixed(2)));
}

function effRain(mm, factorPct) {
  if (!mm || mm <= 0) return 0;
  const f = (factorPct || DEFAULT_EFF_FACTOR) / 100;
  // ฝนน้อยซึมลงดินเกือบหมด (คิดที่ 70% ของ factor) ฝนมากเริ่มมีส่วนไหลบ่า/ซึมลึกเกินราก
  if (mm <= 5) return +(mm * f * 0.9).toFixed(1);
  const v = mm * f - 2;
  return v > 0 ? +v.toFixed(1) : 0;
}

/**
 * buildWaterSeries(series, crop, plot, curve, lookbackDays, forecastDays, soil)
 * คำนวณสมดุลน้ำในดินแบบสะสม แล้วตัดสินใจว่าควรให้น้ำวันไหนและปริมาณเท่าไร
 */
export function buildWaterSeries(series, crop, plot, curve, lookback, forecast, soil, activities) {
  const t = today();
  const depth = ROOT_DEPTH[crop.id] || 0.5;
  const awc = (soil && soil.awc) ? soil.awc : ((soil && TEXTURE_INFO[soil.texture]) ? TEXTURE_INFO[soil.texture].awc : DEFAULT_AWC);
  const taw = +(awc * depth).toFixed(1);
  const paddy = crop.id === 'rice' && plot.waterMode === 'irrigated';
  const p = paddy ? 0.2 : 0.5;
  const raw = +(taw * p).toFixed(1);

  const from = ymd(addDays(t, -(lookback || 14)));
  const to = ymd(addDays(t, forecast || 16));
  const effFactor = (soil && soil.texture && EFF_FACTOR_BY_TEXTURE[soil.texture]) || DEFAULT_EFF_FACTOR;

  const rows = [];
  let D = raw * 0.4; // สมมติเริ่มที่ความชื้นค่อนข้างดี
  for (let i = 0; i < series.length; i++) {
    const r = series[i];
    if (r.date < from || r.date > to) continue;
    if (r.date < plot.plantedAt) continue;

    let gdd = 0;
    for (let k = 0; k < curve.length; k++) if (curve[k].date <= r.date) gdd = curve[k].gdd;

    const stageInfo = kcAtGdd(crop, gdd, r.date);
    const kc = stageInfo.kc;
    const et0 = et0Of(r);
    const etc = +(et0 * kc).toFixed(2);
    const er = effRain(r.rain, effFactor);

    // น้ำที่เกษตรกรให้จริง ถ้ามีบันทึกไว้ ถือว่าเติมเต็มถึงความจุสนาม
    let irrigated = 0;
    if (activities && r.date <= t) {
      for (let a = 0; a < activities.length; a++) {
        if (activities[a].plotId === plot.id && activities[a].type === 'water' && activities[a].date === r.date) {
          irrigated = D;
        }
      }
    }

    D = D + etc - er - irrigated;
    if (D < 0) D = 0;
    if (D > taw) D = taw;

    rows.push({
      date: r.date, isPast: r.date <= t, isToday: r.date === t,
      rain: +(r.rain || 0).toFixed(1), effRain: er,
      et0: et0, kc: kc, etc: etc, stageName: stageInfo.stageName,
      depletion: +D.toFixed(1),
      available: +(taw - D).toFixed(1),
      pctRaw: Math.round((D / raw) * 100),
      net: +(er - etc).toFixed(1),
      taw: taw, raw: raw,
      stress: D >= raw,
      sat: er > 0 && D <= 0
    });
  }

  if (!rows.length) {
    return { rows: [], summary: { level: 'done', advice: 'ยังไม่มีข้อมูลเพียงพอในการคำนวณสมดุลน้ำ' }, managed: false };
  }

  // หาวันที่ต้องให้น้ำครั้งถัดไป
  let todayRow = null;
  for (let i = 0; i < rows.length; i++) if (rows[i].date === t) todayRow = rows[i];
  if (!todayRow) todayRow = rows[rows.length - 1];

  let nextDate = null, nextRow = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date < t) continue;
    if (rows[i].depletion >= raw) { nextDate = rows[i].date; nextRow = rows[i]; break; }
  }

  // ฝนที่กำลังจะมาเป็นเหตุผลของการเลื่อน
  let rainAhead = 0, rainDay = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date <= t) continue;
    if (nextDate && rows[i].date > nextDate) break;
    if (rows[i].rain >= 5 && !rainDay) rainDay = rows[i].date;
    rainAhead += rows[i].rain;
  }

  const amountMm = nextRow ? Math.round(nextRow.depletion) : Math.round(todayRow.depletion);
  const m3PerRai = Math.round(amountMm * MM_PER_RAI_M3);
  const totalM3 = plot.areaRai ? Math.round(m3PerRai * plot.areaRai) : null;
  const daysAhead = nextDate ? diffDays(t, nextDate) : null;

  // ผลรวมฝนที่ใช้ได้จริง vs ความต้องการน้ำของพืชตลอดช่วงพยากรณ์ที่เหลือ (ตั้งแต่วันนี้เป็นต้นไป)
  let rainSum = 0, etcSum = 0, futureDays = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].date < t) continue;
    rainSum += rows[i].effRain;
    etcSum += rows[i].etc;
    futureDays++;
  }
  rainSum = +rainSum.toFixed(1);
  etcSum = +etcSum.toFixed(1);

  let level = 'ok', advice = '', postponed = false;
  if (todayRow.depletion >= raw) {
    level = 'high';
    advice = 'ดินใช้น้ำที่เป็นประโยชน์ไปแล้ว ' + todayRow.pctRaw + '% ของค่าที่ยอมให้ ควรให้น้ำวันนี้ประมาณ ' +
      amountMm + ' มม. หรือ ' + m3PerRai + ' ลูกบาศก์เมตรต่อไร่' +
      (totalM3 ? ' รวมทั้งแปลง ' + totalM3 + ' ลูกบาศก์เมตร' : '');
  } else if (daysAhead !== null && daysAhead <= 2) {
    level = 'warn';
    advice = 'ความชื้นดินใกล้ถึงจุดที่พืชเริ่มเครียด ควรเตรียมให้น้ำใน ' + daysAhead + ' วัน ประมาณ ' + amountMm + ' มม.';
  } else if (rainAhead >= 15 && (daysAhead === null || daysAhead >= 3)) {
    level = 'wet';
    postponed = true;
    advice = 'พยากรณ์ฝนรวม ' + rainAhead.toFixed(0) + ' มม. ในช่วงนี้' +
      (rainDay ? ' โดยเฉพาะวันที่ ' + thaiDate(rainDay) : '') +
      ' ความชื้นในดินยังเหลือ ' + todayRow.available.toFixed(0) + ' มม. จากความจุ ' + taw +
      ' มม. จึงเลื่อนการให้น้ำออกไปเป็น ' + (nextDate ? thaiDate(nextDate) : 'หลังผ่านช่วงฝน') + ' ได้';
  } else {
    level = 'ok';
    postponed = daysAhead !== null && daysAhead >= 3;
    advice = 'ความชื้นในดินยังเพียงพอ ใช้ไปแล้ว ' + todayRow.pctRaw + '% ของน้ำที่ยอมให้พืชดึงไปใช้ ' +
      (nextDate ? 'ครั้งถัดไปควรให้น้ำประมาณวันที่ ' + thaiDate(nextDate) + ' ปริมาณ ' + amountMm + ' มม.'
                : 'ยังไม่ต้องให้น้ำในช่วงพยากรณ์นี้');
  }

  return {
    managed: true,
    rows: rows,
    summary: {
      level: level,
      days: futureDays,
      taw: taw, raw: raw, depletion: todayRow.depletion,
      available: todayRow.available, pctRaw: todayRow.pctRaw,
      rainSum: rainSum, etcSum: etcSum,
      deficit: Math.round(etcSum - rainSum), // บวก = ขาดน้ำ, ลบ = น้ำเกินพอ (แสดงเป็น + หรือ - ในหน้าแรก)
      etcToday: todayRow.etc, kcToday: todayRow.kc, kcNow: todayRow.kc,
      stageName: todayRow.stageName,
      rainAhead: +rainAhead.toFixed(1),
      soilName: soil ? soil.textureName : 'ไม่ทราบเนื้อดิน',
      rootDepth: depth, effFactor: effFactor,
      advice: advice
    },
    nextDate: nextDate,
    daysAhead: daysAhead,
    amountMm: amountMm,
    m3PerRai: m3PerRai,
    totalM3: totalM3,
    postponed: postponed,
    advice: advice
  };
}