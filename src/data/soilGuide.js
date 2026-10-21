export const TEXTURE_INFO = {
  sand: { name: 'ดินทราย', awc: 60, drain: 'ระบายน้ำเร็วมาก', hold: 'อุ้มน้ำและธาตุอาหารต่ำมาก' },
  loamysand: { name: 'ดินทรายร่วน', awc: 90, drain: 'ระบายน้ำเร็ว', hold: 'อุ้มน้ำต่ำ' },
  sandyloam: { name: 'ดินร่วนปนทราย', awc: 110, drain: 'ระบายน้ำดี', hold: 'อุ้มน้ำปานกลางค่อนข้างต่ำ' },
  loam: { name: 'ดินร่วน', awc: 150, drain: 'ระบายน้ำดี', hold: 'อุ้มน้ำและธาตุอาหารดี' },
  siltloam: { name: 'ดินร่วนปนทรายแป้ง', awc: 170, drain: 'ระบายน้ำปานกลาง', hold: 'อุ้มน้ำดีมาก' },
  clayloam: { name: 'ดินร่วนเหนียว', awc: 160, drain: 'ระบายน้ำค่อนข้างช้า', hold: 'อุ้มน้ำและธาตุอาหารดี' },
  sandyclay: { name: 'ดินเหนียวปนทราย', awc: 130, drain: 'ระบายน้ำปานกลาง', hold: 'อุ้มน้ำปานกลาง' },
  clay: { name: 'ดินเหนียว', awc: 150, drain: 'ระบายน้ำช้า เสี่ยงน้ำขัง', hold: 'อุ้มน้ำและธาตุอาหารสูง' }
};

export function textureClass(sand, silt, clay) {
  if (clay >= 40) return 'clay';
  if (clay >= 35 && sand >= 45) return 'sandyclay';
  if (clay >= 27) return 'clayloam';
  if (sand >= 85) return 'sand';
  if (sand >= 70) return 'loamysand';
  if (silt >= 50) return 'siltloam';
  if (sand >= 52) return 'sandyloam';
  return 'loam';
}

export function phAdvice(ph) {
  if (ph === null || ph === undefined) return null;
  if (ph < 5.0) return { level: 'bad', text: 'ดินเป็นกรดจัด (pH ' + ph.toFixed(1) + ') ธาตุฟอสฟอรัสถูกตรึง ควรใส่ปูนโดโลไมต์ 200–400 กก./ไร่' };
  if (ph < 5.5) return { level: 'warn', text: 'ดินเป็นกรด (pH ' + ph.toFixed(1) + ') ควรใส่ปูนขาวหรือโดโลไมต์ 100–200 กก./ไร่' };
  if (ph <= 7.0) return { level: 'good', text: 'ดินมี pH ' + ph.toFixed(1) + ' เหมาะสมกับพืชส่วนใหญ่' };
  if (ph <= 7.8) return { level: 'warn', text: 'ดินค่อนข้างเป็นด่าง (pH ' + ph.toFixed(1) + ') ควรเสริมธาตุรองทางใบ' };
  return { level: 'bad', text: 'ดินเป็นด่างจัด (pH ' + ph.toFixed(1) + ') ควรใช้ปุ๋ยที่ให้ปฏิกิริยาเป็นกรด' };
}

export function omAdvice(om) {
  if (om === null || om === undefined) return null;
  if (om < 1.0) return { level: 'bad', text: 'อินทรียวัตถุต่ำมาก (' + om.toFixed(1) + '%) ควรใส่ปุ๋ยคอกหรือปุ๋ยหมัก 1–2 ตัน/ไร่' };
  if (om < 2.0) return { level: 'warn', text: 'อินทรียวัตถุกค่อนข้างต่ำ (' + om.toFixed(1) + '%) ควรเพิ่มปุ๋ยอินทรีย์ 500–1,000 กก./ไร่' };
  return { level: 'good', text: 'อินทรียวัตถุอยู่ในเกณฑ์ดี (' + om.toFixed(1) + '%)' };
}

export function soilManagement(tex, crop) {
  const t = TEXTURE_INFO[tex];
  if (!t) return [];
  const out = [];
  const light = tex === 'sand' || tex === 'loamysand' || tex === 'sandyloam';
  const heavy = tex === 'clay' || tex === 'clayloam' || tex === 'sandyclay';

  if (light) {
    out.push({ topic: 'การให้ปุ๋ย', text: t.name + ' ชะล้างธาตุอาหารง่าย ควรแบ่งใส่ปุ๋ยทีละน้อยแต่บ่อยครั้ง' });
    out.push({ topic: 'การให้น้ำ', text: 'ดินอุ้มน้ำต่ำ (' + t.awc + ' มม.) ต้องให้น้ำถี่แต่ครั้งละน้อย' });
  } else if (heavy) {
    out.push({ topic: 'การให้ปุ๋ย', text: t.name + ' ยึดธาตุอาหารดี ใส่ปุ๋ยปริมาณมากได้แต่ต้องกลบดินให้มิด' });
    out.push({ topic: 'การให้น้ำ', text: 'ดินอุ้มน้ำสูง (' + t.awc + ' มม.) ให้น้ำทิ้งช่วงนานได้ แตระวังน้ำขังเพราะ' + t.drain });
  } else {
    out.push({ topic: 'การให้ปุ๋ย', text: t.name + ' จัดการง่าย ใช้อัตราปุ๋ยตามคำแนะนำมาตรฐานได้เลย' });
    out.push({ topic: 'การให้น้ำ', text: 'ดินอุ้มน้ำได้ดี เหมาะกับการให้น้ำตามรอบปกติ' });
  }
  return out;
}