/**
 * แปลงพิกัด UTM (Universal Transverse Mercator) เป็นละติจูด/ลองจิจูด (WGS84)
 * ใช้สูตรมาตรฐานผกผันของ Transverse Mercator (Karney/Snyder series)
 * ประเทศไทยส่วนใหญ่อยู่ในโซน 47N และ 48N แถบอักษร P-R
 * โซน 47P ครอบคลุมภาคเหนือ ภาคกลาง และภาคตะวันตกส่วนใหญ่ของไทย
 */

const a = 6378137.0;           // รัศมีเส้นศูนย์สูตร WGS84 (เมตร)
const f = 1 / 298.257223563;   // ความแบนของทรงรี WGS84
const k0 = 0.9996;             // ตัวคูณมาตราส่วนของ UTM

const e2 = f * (2 - f);
const ePrime2 = e2 / (1 - e2);
const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

// แถบอักษร (latitude band) ของ UTM เรียงจากใต้ขึ้นเหนือ ใช้ตรวจว่าอยู่ซีกโลกเหนือหรือใต้
const BAND_LETTERS = 'CDEFGHJKLMNPQRSTUVWX';

function bandIsNorthern(letter) {
  // แถบ N ขึ้นไปอยู่ซีกโลกเหนือ, แถบ M ลงไปอยู่ซีกโลกใต้ (ตัดที่เส้นศูนย์สูตร)
  const idx = BAND_LETTERS.indexOf(letter.toUpperCase());
  return idx >= BAND_LETTERS.indexOf('N');
}

/**
 * utmToLatLon(zone, band, easting, northing) -> { lat, lon } หรือ null ถ้าพิกัดไม่สมเหตุสมผล
 * zone: หมายเลขโซน UTM (ไทยส่วนใหญ่คือ 47 หรือ 48)
 * band: แถบอักษร (ไทยส่วนใหญ่คือ P, บางส่วนเหนือสุด/ใต้สุดอาจเป็น Q หรือ N)
 * easting, northing: หน่วยเมตร
 */
export function utmToLatLon(zone, band, easting, northing) {
  if (!zone || !band || easting === null || easting === undefined || northing === null || northing === undefined) return null;
  if (zone < 1 || zone > 60) return null;
  if (easting < 100000 || easting > 900000) return null;
  if (northing < 0 || northing > 10000000) return null;

  const northern = bandIsNorthern(band);
  let y = northing;
  if (!northern) y = y - 10000000; // ซีกโลกใต้นับจากเส้นศูนย์สูตรลบ 10,000,000

  const x = easting - 500000; // easting อ้างอิงกลางโซนที่ 500,000
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
    + (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);

  const n1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const t1 = Math.tan(phi1) * Math.tan(phi1);
  const c1 = ePrime2 * Math.cos(phi1) * Math.cos(phi1);
  const r1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const d = x / (n1 * k0);

  const lat = phi1 - (n1 * Math.tan(phi1) / r1) * (
    d * d / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ePrime2) * d * d * d * d / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ePrime2 - 3 * c1 * c1) * d * d * d * d * d * d / 720
  );

  const lon = (d
    - (1 + 2 * t1 + c1) * d * d * d / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ePrime2 + 24 * t1 * t1) * d * d * d * d * d / 120
  ) / Math.cos(phi1);

  const lonOrigin = (zone - 1) * 6 - 180 + 3; // เส้นแวงกลางของโซน
  const latDeg = lat * 180 / Math.PI;
  const lonDeg = lonOrigin + lon * 180 / Math.PI;

  if (latDeg < -90 || latDeg > 90 || lonDeg < -180 || lonDeg > 180) return null;
  return { lat: +latDeg.toFixed(6), lon: +lonDeg.toFixed(6) };
}

export function isThaiZone(zone) {
  return zone === 47 || zone === 48;
}
