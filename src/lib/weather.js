import { ymd, addDays, toDate, TZ } from './date.js';
import { cacheGet, cacheSet } from './storage.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const DAILY = [
  'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'precipitation_probability_max', 'et0_fao_evapotranspiration', 'wind_speed_10m_max'
].join(',');
const HOURLY = 'relative_humidity_2m';
const PAST_DAYS = 92;
const FORECAST_DAYS = 16;

function qs(params) {
  const out = [];
  for (const k in params) out.push(k + '=' + encodeURIComponent(params[k]));
  return out.join('&');
}

async function getJSON(url, params) {
  const res = await fetch(url + '?' + qs(params));
  if (!res.ok) throw new Error('Weather API ' + res.status);
  return res.json();
}

function merge(json, map) {
  if (!json) return;
  const d = json.daily;
  if (d && d.time) {
    for (let i = 0; i < d.time.length; i++) {
      const t = d.time[i];
      const row = map.get(t) || { date: t };
      if (d.temperature_2m_max) row.tmax = d.temperature_2m_max[i];
      if (d.temperature_2m_min) row.tmin = d.temperature_2m_min[i];
      if (d.precipitation_sum) row.rain = d.precipitation_sum[i];
      if (d.precipitation_probability_max) row.rainProb = d.precipitation_probability_max[i];
      if (d.et0_fao_evapotranspiration) row.et0 = d.et0_fao_evapotranspiration[i];
      if (d.wind_speed_10m_max) row.wind = d.wind_speed_10m_max[i];
      map.set(t, row);
    }
  }
  const h = json.hourly;
  if (h && h.time) {
    const acc = {};
    for (let i = 0; i < h.time.length; i++) {
      const rh = h.relative_humidity_2m ? h.relative_humidity_2m[i] : null;
      if (rh === null || rh === undefined) continue;
      const t = h.time[i];
      const day = t.slice(0, 10);
      const hour = Number(t.slice(11, 13));
      if (!acc[day]) acc[day] = { sum: 0, n: 0, max: -999, min: 999, wet: 0, nSum: 0, nN: 0 };
      const a = acc[day];
      a.sum += rh; a.n++;
      if (rh > a.max) a.max = rh;
      if (rh < a.min) a.min = rh;
      if (rh >= 90) a.wet++;
      if (hour <= 6 || hour >= 22) { a.nSum += rh; a.nN++; }
    }
    for (const day in acc) {
      const a = acc[day];
      const row = map.get(day) || { date: day };
      row.rhMean = Math.round(a.sum / a.n);
      row.rhMax = Math.round(a.max);
      row.rhMin = Math.round(a.min);
      row.wetHours = a.wet;
      row.rhNight = a.nN ? Math.round(a.nSum / a.nN) : row.rhMean;
      map.set(day, row);
    }
  }
}

function finish(map) {
  const todayStr = ymd(new Date());
  const keys = [];
  map.forEach(function (v, k) { keys.push(k); });
  keys.sort();
  let dry = 0;
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const r = map.get(keys[i]);
    const hasT = r.tmax !== null && r.tmax !== undefined && r.tmin !== null && r.tmin !== undefined;
    const tmean = hasT ? (r.tmax + r.tmin) / 2 : null;
    const rain = r.rain === null || r.rain === undefined ? 0 : r.rain;
    dry = rain < 1 ? dry + 1 : 0;
    out.push(Object.assign({}, r, { rain: rain, tmean: tmean, dryStreak: dry, isPast: r.date <= todayStr }));
  }
  return out;
}

export async function fetchWeatherSeries(lat, lon, startDate) {
  const now = new Date();
  const ck = 'wx:' + lat.toFixed(3) + ':' + lon.toFixed(3) + ':' + ymd(startDate) + ':' + ymd(now);
  const cached = cacheGet(ck, 3 * 60 * 60 * 1000);
  if (cached) return cached;

  const forecastStart = addDays(now, -PAST_DAYS);
  const needArchive = toDate(ymd(startDate)) < toDate(ymd(forecastStart));

  const jobs = [getJSON(FORECAST_URL, {
    latitude: lat, longitude: lon, daily: DAILY, hourly: HOURLY,
    timezone: TZ, past_days: PAST_DAYS, forecast_days: FORECAST_DAYS
  })];
  if (needArchive) {
    jobs.push(getJSON(ARCHIVE_URL, {
      latitude: lat, longitude: lon,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max',
      hourly: HOURLY, timezone: TZ,
      start_date: ymd(startDate), end_date: ymd(addDays(forecastStart, -1))
    }).catch(function () { return null; }));
  }

  const res = await Promise.all(jobs);
  const map = new Map();
  if (res[1]) merge(res[1], map);
  merge(res[0], map);

  const out = { series: finish(map), fetchedAt: Date.now() };
  cacheSet(ck, out);
  return out;
}

export async function fetchHistory(lat, lon, days) {
  const start = addDays(new Date(), -(days - 1));
  const data = await fetchWeatherSeries(lat, lon, start);
  const from = ymd(start);
  const to = ymd(new Date());
  return data.series.filter(function (r) { return r.date >= from && r.date <= to; });
}

export function weatherIcon(row) {
  if (!row) return '\u2601';
  const r = row.rain || 0;
  if (r >= 35) return '\u26C8';
  if (r >= 10) return '\u{1F327}';
  if (r >= 1) return '\u{1F326}';
  if ((row.tmax || 0) >= 37) return '\u{1F525}';
  return '\u2600';
}

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon + '&accept-language=th&zoom=12');
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address || {};
    const parts = [a.village || a.suburb || a.town || a.city_district, a.county || a.city, a.state];
    return parts.filter(Boolean).slice(0, 2).join(' · ');
  } catch (e) { return null; }
}

// คืนเฉพาะชื่อจังหวัด ใช้สำหรับสถิติผู้ใช้งานรายจังหวัด (ข้อ 6) แยกจาก reverseGeocode ที่ตัดคำให้สั้นสำหรับแสดงผลในฟอร์ม
export async function reverseProvince(lat, lon) {
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon + '&accept-language=th&zoom=8');
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address || {};
    return a.state || a.province || null;
  } catch (e) { return null; }
}

export function getPosition() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) return reject(new Error('อุปกรณ์ไม่รองรับการระบุตำแหน่ง'));
    navigator.geolocation.getCurrentPosition(
      function (p) { resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); },
      function (err) { reject(err); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  });
}