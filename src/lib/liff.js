import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

export const liffState = { ready: false, inClient: false, mock: false, profile: null };

function mockProfile() {
  return { userId: 'LOCAL_USER', displayName: 'เกษตรกร (โหมดทดสอบ)', pictureUrl: '' };
}

export async function initLiff() {
  if (!LIFF_ID) {
    liffState.mock = true; liffState.ready = true; liffState.profile = mockProfile();
    return liffState;
  }
  try {
    await liff.init({ liffId: LIFF_ID });
    liffState.inClient = liff.isInClient();
    if (!liff.isLoggedIn() && !liffState.inClient) {
      liff.login({ redirectUri: window.location.href });
      return liffState;
    }
    liffState.profile = await liff.getProfile();
    liffState.ready = true;
  } catch (err) {
    console.error('LIFF init failed', err);
    liffState.mock = true; liffState.ready = true; liffState.profile = mockProfile();
  }
  return liffState;
}

export function closeApp() {
  try { if (!liffState.mock && liff.isInClient()) liff.closeWindow(); } catch (e) { console.warn(e); }
}

export function openExternal(url) {
  try {
    if (!liffState.mock && liff.openWindow) { liff.openWindow({ url: url, external: true }); return; }
  } catch (e) { console.warn(e); }
  window.open(url, '_blank');
}

export async function shareText(text) {
  const msg = { type: 'text', text: text };
  if (liffState.mock) { window.alert('โหมดทดสอบ ข้อความที่จะส่ง\n\n' + text); return; }
  try {
    if (liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker')) await liff.shareTargetPicker([msg]);
    else if (liff.isInClient && liff.isInClient()) await liff.sendMessages([msg]);
    else window.alert(text);
  } catch (e) { console.error(e); window.alert(text); }
}