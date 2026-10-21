import { load, save } from './storage.js';
import { today } from './date.js';

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyStatus() {
  if (!notifySupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotify() {
  if (!notifySupported()) return 'unsupported';
  try {
    const p = await Notification.requestPermission();
    if (p === 'granted') save('notifyOn', true);
    return p;
  } catch (e) { return 'denied'; }
}

export function notifyEnabled() {
  return notifySupported() && Notification.permission === 'granted' && load('notifyOn', true) !== false;
}

export function setNotifyEnabled(v) { save('notifyOn', !!v); }

function sentKey(plotId) { return 'notifySent:' + plotId + ':' + today(); }

/** ส่งแจ้งเตือนผ่านเบราว์เซอร์เฉพาะรายการที่ยังไม่เคยแจ้งในวันนี้ */
export function pushAlerts(plot, alerts, cropName) {
  if (!notifyEnabled() || !plot || !alerts) return 0;
  const important = alerts.filter(function (a) { return a.level === 'high' || a.level === 'alert'; });
  if (!important.length) return 0;

  const sent = load(sentKey(plot.id), []);
  const fresh = important.filter(function (a) { return sent.indexOf(a.id) < 0; });
  if (!fresh.length) return 0;

  const head = fresh[0];
  const title = (head.level === 'high' ? 'เฝ้าระวังสูง ' : 'แจ้งเตือน ') + head.name;
  const more = fresh.length > 1 ? ' และอีก ' + (fresh.length - 1) + ' รายการ' : '';
  const body = 'แปลง ' + plot.name + ' (' + cropName + ')\n' + head.progress + more + '\nเปิดแอปเพื่อดูคำแนะนำการจัดการ';

  try {
    const n = new Notification(title, { body: body, tag: 'csc-' + plot.id, badge: undefined, icon: undefined });
    n.onclick = function () { window.focus(); n.close(); };
  } catch (e) { console.warn('notify failed', e); return 0; }

  const ids = sent.concat(fresh.map(function (a) { return a.id; }));
  save(sentKey(plot.id), ids);
  return fresh.length;
}

export function testNotify() {
  if (!notifyEnabled()) return false;
  try {
    new Notification('ทดสอบการแจ้งเตือน', { body: 'ระบบแจ้งเตือนผ่านเบราว์เซอร์ทำงานปกติแล้ว' });
    return true;
  } catch (e) { return false; }
}