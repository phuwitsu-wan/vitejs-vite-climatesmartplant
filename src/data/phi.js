// ฐานข้อมูลระยะปลอดภัยก่อนเก็บเกี่ยว (Pre-Harvest Interval)
// phi = จำนวนวันขั้นต่ำหลังพ่นครั้งสุดท้ายจึงเก็บเกี่ยวได้
// ค่าเป็นค่าอ้างอิงทั่วไป ต้องยืนยันกับฉลากผลิตภัณฑ์เสมอ

export const PHI_DB = [
  { name: 'อะบาเมกติน', alt: ['abamectin'], kind: 'insecticide', group: '6', phi: 7 },
  { name: 'อีมาเมกตินเบนโซเอต', alt: ['emamectin'], kind: 'insecticide', group: '6', phi: 7 },
  { name: 'อิมิดาโคลพริด', alt: ['imidacloprid'], kind: 'insecticide', group: '4A', phi: 14 },
  { name: 'ไทอะมีทอกแซม', alt: ['thiamethoxam'], kind: 'insecticide', group: '4A', phi: 14 },
  { name: 'ไดโนทีฟูแรน', alt: ['dinotefuran'], kind: 'insecticide', group: '4A', phi: 7 },
  { name: 'คลอแรนทรานิลิโพรล', alt: ['chlorantraniliprole'], kind: 'insecticide', group: '28', phi: 7 },
  { name: 'อินดอกซาคาร์บ', alt: ['indoxacarb'], kind: 'insecticide', group: '22A', phi: 7 },
  { name: 'สไปนีโทแรม', alt: ['spinetoram'], kind: 'insecticide', group: '5', phi: 7 },
  { name: 'ฟิโพรนิล', alt: ['fipronil'], kind: 'insecticide', group: '2B', phi: 14 },
  { name: 'ไซเพอร์เมทริน', alt: ['cypermethrin'], kind: 'insecticide', group: '3A', phi: 7 },
  { name: 'แลมบ์ดาไซฮาโลทริน', alt: ['lambda'], kind: 'insecticide', group: '3A', phi: 7 },
  { name: 'คาร์บาริล', alt: ['carbaryl'], kind: 'insecticide', group: '1A', phi: 7 },
  { name: 'ไพริดาเบน', alt: ['pyridaben'], kind: 'miticide', group: '21A', phi: 7 },
  { name: 'โพรพาร์ไกต์', alt: ['propargite'], kind: 'miticide', group: '12C', phi: 14 },
  { name: 'แมนโคเซบ', alt: ['mancozeb'], kind: 'fungicide', group: 'M3', phi: 14 },
  { name: 'คลอโรทาโลนิล', alt: ['chlorothalonil'], kind: 'fungicide', group: 'M5', phi: 7 },
  { name: 'คอปเปอร์ออกซีคลอไรด์', alt: ['copper'], kind: 'fungicide', group: 'M1', phi: 5 },
  { name: 'อะซอกซีสโตรบิน', alt: ['azoxystrobin'], kind: 'fungicide', group: '11', phi: 7 },
  { name: 'ไดฟีโนโคนาโซล', alt: ['difenoconazole'], kind: 'fungicide', group: '3', phi: 14 },
  { name: 'โพรพิโคนาโซล', alt: ['propiconazole'], kind: 'fungicide', group: '3', phi: 14 },
  { name: 'คาร์เบนดาซิม', alt: ['carbendazim'], kind: 'fungicide', group: '1', phi: 14 },
  { name: 'เมทาแลกซิล', alt: ['metalaxyl'], kind: 'fungicide', group: '4', phi: 14 },
  { name: 'ฟอสอีทิลอะลูมิเนียม', alt: ['fosetyl'], kind: 'fungicide', group: '33', phi: 14 },
  { name: 'โพรคลอราซ', alt: ['prochloraz'], kind: 'fungicide', group: '3', phi: 7 },
  { name: 'บีที', alt: ['bacillus thuringiensis', 'bt'], kind: 'bio', group: '11', phi: 0 },
  { name: 'บาซิลลัส ซับทิลิส', alt: ['subtilis'], kind: 'bio', group: 'BM02', phi: 0 },
  { name: 'ไตรโคเดอร์มา', alt: ['trichoderma'], kind: 'bio', group: 'BM02', phi: 0 },
  { name: 'เอ็นพีวี', alt: ['npv'], kind: 'bio', group: '31', phi: 0 },
  { name: 'ปิโตรเลียมออยล์', alt: ['petroleum oil', 'white oil'], kind: 'bio', group: 'UNE', phi: 1 },
  { name: 'สะเดา', alt: ['azadirachtin', 'neem'], kind: 'bio', group: 'UN', phi: 1 }
];

const DEFAULT_PHI = 14;

export function lookupPHI(text) {
  if (!text) return null;
  const low = String(text).toLowerCase();
  for (let i = 0; i < PHI_DB.length; i++) {
    const it = PHI_DB[i];
    if (low.indexOf(it.name.toLowerCase()) >= 0) return it;
    for (let j = 0; j < it.alt.length; j++) {
      if (low.indexOf(it.alt[j].toLowerCase()) >= 0) return it;
    }
  }
  return null;
}

// คืนรายการล็อกระยะปลอดภัยจากประวัติการพ่นสาร
export function phiLocks(activities, plotId, addDays) {
  const out = [];
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (a.plotId !== plotId) continue;
    if (a.type !== 'spray') continue;
    const hit = lookupPHI(a.detail || a.note || '');
    const days = hit ? hit.phi : DEFAULT_PHI;
    out.push({
      id: a.id,
      sprayDate: a.date,
      chem: hit ? hit.name : (a.detail || 'สารที่ไม่ระบุชื่อ'),
      group: hit ? hit.group : '-',
      kind: hit ? hit.kind : 'unknown',
      phi: days,
      safeDate: addDays(a.date, days),
      known: !!hit
    });
  }
  out.sort(function (x, y) { return x.safeDate < y.safeDate ? 1 : -1; });
  return out;
}

// ตรวจว่าวันเก็บเกี่ยวที่วางแผนไว้ชนระยะปลอดภัยหรือไม่
export function harvestBlocked(locks, harvestDate) {
  let worst = null;
  for (let i = 0; i < locks.length; i++) {
    if (locks[i].safeDate > harvestDate) {
      if (!worst || locks[i].safeDate > worst.safeDate) worst = locks[i];
    }
  }
  return worst;
}