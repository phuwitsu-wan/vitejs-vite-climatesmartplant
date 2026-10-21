export const TZ = 'Asia/Bangkok';

export function ymd(d) {
  const x = d instanceof Date ? d : new Date(d);
  const m = String(x.getMonth() + 1);
  const day = String(x.getDate());
  return x.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

export function toDate(dateStr) { return new Date(dateStr + 'T00:00:00'); }

export function addDays(d, n) {
  const x = d instanceof Date ? new Date(d) : new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function shift(dateStr, n) { return ymd(addDays(toDate(dateStr), n)); }

export function diffDays(a, b) {
  return Math.round((toDate(ymd(b)) - toDate(ymd(a))) / 86400000);
}

export function today() { return ymd(new Date()); }

const M_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const M_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function thaiDate(dateStr, full) {
  const d = toDate(dateStr);
  const m = full ? M_FULL[d.getMonth()] : M_SHORT[d.getMonth()];
  return d.getDate() + ' ' + m + ' ' + (d.getFullYear() + 543);
}

export function thaiDateShort(dateStr) {
  const d = toDate(dateStr);
  return d.getDate() + ' ' + M_SHORT[d.getMonth()];
}

export function thaiDow(dateStr) { return DOW_FULL[toDate(dateStr).getDay()]; }
export function thaiMonthYear(d) { return M_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
export function monthKey(dateStr) { return dateStr.slice(0, 7); }

export function thaiMonthKey(key) {
  const p = key.split('-');
  return M_FULL[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543);
}

export function relativeLabel(dateStr) {
  const n = diffDays(today(), dateStr);
  if (n === 0) return 'วันนี้';
  if (n === 1) return 'พรุ่งนี้';
  if (n === 2) return 'มะรืนนี้';
  if (n < 0) return 'เลยมาแล้ว ' + Math.abs(n) + ' วัน';
  return 'อีก ' + n + ' วัน';
}