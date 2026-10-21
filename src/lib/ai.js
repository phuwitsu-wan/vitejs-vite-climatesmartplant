import { today, thaiDate } from './date.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// meta-llama/llama-4-scout-17b-16e-instruct ถูก Groq ปลดระวางไปแล้วตั้งแต่ 17 ก.ค. 2026
// Groq เอกสารทางการระบุว่ารุ่นที่รองรับภาพ (vision) ตอนนี้คือ qwen/qwen3.6-27b และ qwen/qwen3.8-27b
// แต่บางบัญชี/แผนอาจเข้าถึงได้ไม่เท่ากัน จึงลองทั้งสองตัวตามลำดับ ไม่พึ่งตัวเดียว
const GROQ_VISION_MODELS = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'];
const TIMEOUT = 30000;

function geminiKey() { return import.meta.env.VITE_GEMINI_API_KEY || ''; }
function groqKey() { return import.meta.env.VITE_GROQ_API_KEY || ''; }

export function aiProvider() {
  if (geminiKey()) return 'gemini';
  if (groqKey()) return 'groq';
  return 'offline';
}

export const PROVIDER_LABEL = {
  gemini: 'Google Gemini (แผนฟรี)',
  groq: 'Groq Llama (แผนฟรี)',
  offline: 'โหมดออฟไลน์ ตอบจากข้อมูลในแอป'
};

const SYSTEM_PROMPT = [
  'คุณคือผู้ช่วยนักวิชาการส่งเสริมการเกษตรของกลุ่มอารักขาพืช สำนักงานเกษตรจังหวัดเพชรบูรณ์',
  'ตอบเป็นภาษาไทยที่เกษตรกรอ่านเข้าใจง่าย กระชับ ตรงประเด็น ไม่เกิน 200 คำ',
  'ยึดหลักการจัดการศัตรูพืชแบบผสมผสาน (IPM) เสมอ คือสำรวจก่อน ใช้วิธีเขตกรรมและชีวภัณฑ์ก่อน',
  'แนะนำสารเคมีเฉพาะเมื่อจำเป็นและเกินเกณฑ์เศรษฐกิจ ให้ระบุกลุ่มกลไกออกฤทธิ์ เตือนการสลับกลุ่ม และระยะปลอดภัยก่อนเก็บเกี่ยวทุกครั้ง',
  'ใช้ข้อมูลบริบทแปลงที่ให้มาเป็นหลัก ถ้าข้อมูลไม่พอให้ถามกลับหรือบอกตรง ๆ ว่าต้องสำรวจแปลงเพิ่ม',
  'ห้ามแต่งตัวเลขอัตราสารหรือปุ๋ยที่ไม่แน่ใจ ให้บอกว่าควรตรวจสอบจากฉลากหรือเจ้าหน้าที่',
  'ไม่ตอบเรื่องที่ไม่เกี่ยวกับการเกษตรและการผลิตพืช'
].join('\n');

const VISION_PROMPT = [
  SYSTEM_PROMPT,
  '',
  'งานนี้คือการวินิจฉัยอาการผิดปกติของพืชจากภาพถ่ายที่เกษตรกรส่งมา ให้ตอบตามหัวข้อนี้เท่านั้น',
  '1. สิ่งที่เห็นในภาพ อธิบายอาการที่สังเกตได้จริง อย่าเดาเกินภาพ',
  '2. สาเหตุที่เป็นไปได้ เรียง 1-3 อันดับ พร้อมระบุระดับความมั่นใจเป็น สูง กลาง หรือ ต่ำ',
  '3. วิธีตรวจยืนยันในแปลง ให้ระบุว่าต้องไปดูอะไรเพิ่มและสุ่มกี่จุด',
  '4. สิ่งที่ควรทำทันที เน้นเขตกรรมและชีวภัณฑ์ก่อน',
  '5. เมื่อใดจึงควรใช้สารเคมี ระบุเกณฑ์เศรษฐกิจและกลุ่มกลไกออกฤทธิ์ พร้อมเตือนระยะปลอดภัย',
  'ถ้าภาพไม่ชัด ถ่ายไกลเกินไป หรือไม่ใช่ภาพพืช ให้บอกตรง ๆ ว่าวินิจฉัยไม่ได้ และแนะนำวิธีถ่ายใหม่',
  'ปิดท้ายทุกครั้งว่า การวินิจฉัยจากภาพเป็นการประเมินเบื้องต้น ควรให้เจ้าหน้าที่ตรวจแปลงจริงยืนยัน'
].join('\n');

async function readErrorDetail(res) {
  try {
    const j = await res.clone().json();
    if (j && j.error && j.error.message) return j.error.message;
  } catch (e) { /* ignore */ }
  try { return (await res.text()).slice(0, 200); } catch (e) { return ''; }
}

async function fetchWithTimeout(url, opt, ms) {
  const c = new AbortController();
  const id = setTimeout(function () { c.abort(); }, ms || TIMEOUT);
  try {
    return await fetch(url, Object.assign({}, opt, { signal: c.signal }));
  } finally { clearTimeout(id); }
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function withRetry(fn, tries) {
  let last = null;
  for (let i = 0; i < (tries || 3); i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const m = String(e.message || '');
      if (m.indexOf('503') < 0 && m.indexOf('429') < 0 && m.indexOf('abort') < 0) break;
      await sleep(900 * (i + 1));
    }
  }
  throw last;
}

export function buildContext(ctx) {
  if (!ctx || !ctx.plot) return 'ยังไม่มีข้อมูลแปลง';
  const p = ctx.plot, c = ctx.crop, st = ctx.stageInfo, w = ctx.todayRow;
  const L = [];
  L.push('ข้อมูลแปลงของผู้ใช้ ณ วันที่ ' + thaiDate(today(), true));
  L.push('ชื่อแปลง ' + p.name + ' พื้นที่ ' + (p.areaRai || '-') + ' ไร่');
  if (c && st) {
    L.push('ชนิดพืช ' + c.name + ' อายุ ' + st.age + ' วัน ระยะ ' +
      (st.afterHarvest ? 'สิ้นสุดรอบการผลิตแล้ว' : st.stage.name));
    L.push('ความร้อนสะสม ' + st.gdd + ' GDD จากเป้าหมาย ' + st.maturityGdd + ' GDD อัตราเฉลี่ย ' + st.rate + ' GDD ต่อวัน');
    L.push('คาดว่าสิ้นสุดรอบการผลิต ' + thaiDate(st.endDate, true));
  }
  if (w) {
    L.push('อากาศวันนี้ ' + Math.round(w.tmin) + ' ถึง ' + Math.round(w.tmax) + ' องศา ความชื้น ' +
      (w.rhMean === undefined ? '-' : w.rhMean) + '% ฝน ' + (w.rain || 0).toFixed(1) + ' มม.');
  }
  if (ctx.soil) {
    L.push('ดิน ' + ctx.soil.textureName + ' pH ' + (ctx.soil.ph === null ? '-' : ctx.soil.ph) +
      ' อินทรียวัตถุ ' + (ctx.soil.om === null ? '-' : ctx.soil.om + '%'));
  }
  if (ctx.water && ctx.water.summary) {
    const s = ctx.water.summary;
    L.push('สมดุลน้ำในดิน ความจุ ' + s.taw + ' มม. เหลือใช้ได้ ' + s.available + ' มม. ใช้ไปแล้ว ' + s.pctRaw +
      '% ของเกณฑ์ ETc วันนี้ ' + s.etcToday + ' มม. คำแนะนำ ' + s.advice);
  }
  if (ctx.alerts && ctx.alerts.length) {
    L.push('การแจ้งเตือนขณะนี้:');
    for (let i = 0; i < Math.min(3, ctx.alerts.length); i++) {
      L.push(' - [' + ctx.alerts[i].levelLabel + '] ' + ctx.alerts[i].name + ' : ' + ctx.alerts[i].progress);
    }
  }
  if (ctx.nearby && ctx.nearby.length) {
    L.push('รายงานการระบาดรอบแปลง:');
    for (let i = 0; i < Math.min(3, ctx.nearby.length); i++) L.push(' - ' + ctx.nearby[i].text);
  }
  if (ctx.phiLocks && ctx.phiLocks.length) {
    L.push('ระยะปลอดภัยที่ยังมีผล: ' + ctx.phiLocks.map(function (x) {
      return x.chem + ' เก็บเกี่ยวได้ ' + x.safeDate;
    }).join(', '));
  }
  return L.join('\n');
}

function offlineAnswer(question, ctx) {
  const has = function (arr) {
    for (let i = 0; i < arr.length; i++) if (question.indexOf(arr[i]) >= 0) return true;
    return false;
  };
  if (!ctx || !ctx.plot) return 'ยังไม่มีข้อมูลแปลงในระบบ กรุณาสร้างแปลงก่อนครับ';
  if (has(['ปุ๋ย', 'สูตร'])) {
    const f = ctx.fert;
    if (f && f.items && f.items.length) {
      const L = ['ช่วงอายุ ' + ctx.stageInfo.age + ' วัน มีกำหนดใส่ปุ๋ยดังนี้'];
      for (let i = 0; i < f.items.length; i++) L.push('• ' + f.items[i].when + ' สูตร ' + f.items[i].formula + ' อัตรา ' + f.items[i].rate);
      return L.join('\n');
    }
    return 'ช่วงอายุนี้ยังไม่มีกำหนดใส่ปุ๋ยตามแผนครับ';
  }
  if (has(['น้ำ', 'รดน้ำ', 'แล้ง'])) {
    if (ctx.water && ctx.water.summary) return ctx.water.summary.advice;
    return 'ยังประเมินสมดุลน้ำไม่ได้ กรุณารีเฟรชหน้าหลักครับ';
  }
  if (has(['ดิน', 'กรด'])) {
    if (!ctx.soil) return 'ยังไม่มีข้อมูลดิน กดดึงข้อมูลดินที่หน้าหลักก่อนครับ';
    return 'ดินแปลงนี้เป็น' + ctx.soil.textureName + ' pH ' + ctx.soil.ph + ' อินทรียวัตถุ ' + ctx.soil.om + '%';
  }
  return 'ขณะนี้ยังไม่ได้ตั้งค่า AI หรือเชื่อมต่อไม่ได้ ผมจึงตอบได้เฉพาะเรื่องปุ๋ย น้ำ ดิน และอายุพืชจากข้อมูลในแอปครับ';
}

async function callGemini(messages, context) {
  const contents = messages.map(function (m) {
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] };
  });
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT + '\n\nบริบทแปลงปัจจุบัน\n' + context }] },
    contents: contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 900 }
  };
  const res = await fetchWithTimeout(GEMINI_URL + '?key=' + geminiKey(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Gemini ' + res.status + ' ' + (await readErrorDetail(res)));
  const j = await res.json();
  const c = j.candidates && j.candidates[0];
  const part = c && c.content && c.content.parts && c.content.parts[0];
  return part && part.text ? part.text.trim() : 'ไม่ได้รับคำตอบจากระบบ';
}

async function callGroq(messages, context) {
  const msgs = [{ role: 'system', content: SYSTEM_PROMPT + '\n\nบริบทแปลงปัจจุบัน\n' + context }];
  for (let i = 0; i < messages.length; i++) {
    msgs.push({ role: messages[i].role === 'assistant' ? 'assistant' : 'user', content: messages[i].text });
  }
  const res = await fetchWithTimeout(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + groqKey() },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: msgs, temperature: 0.4, max_tokens: 900 })
  });
  if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await readErrorDetail(res)));
  const j = await res.json();
  const c = j.choices && j.choices[0];
  return c && c.message ? c.message.content.trim() : 'ไม่ได้รับคำตอบจากระบบ';
}

export async function askAI(messages, ctx) {
  const last = messages[messages.length - 1];
  const provider = aiProvider();
  if (provider === 'offline') return offlineAnswer(last.text, ctx);
  const context = buildContext(ctx);
  if (geminiKey()) {
    try { return await withRetry(function () { return callGemini(messages, context); }, 3); }
    catch (e) { console.error(e); }
  }
  if (groqKey()) {
    try { return await withRetry(function () { return callGroq(messages, context); }, 2); }
    catch (e) { console.error(e); }
  }
  return 'เชื่อมต่อผู้ช่วย AI ไม่สำเร็จ\n\n' + offlineAnswer(last.text, ctx);
}

/* ───── ข้อ 1 วินิจฉัยจากภาพถ่าย ───── */

export function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve({ dataUrl: s, base64: s.slice(i + 1), mime: file.type || 'image/jpeg' });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ย่อภาพก่อนส่ง ลดโควตาและทำให้เร็วขึ้น
export function compressImage(file, maxSide) {
  const max = maxSide || 1024;
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      let w = img.width, h = img.height;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = cv.toDataURL('image/jpeg', 0.82);
      resolve({ dataUrl: dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mime: 'image/jpeg' });
    };
    img.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function visionGemini(img, prompt, context) {
  const body = {
    systemInstruction: { parts: [{ text: VISION_PROMPT + '\n\nบริบทแปลงปัจจุบัน\n' + context }] },
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: img.mime, data: img.base64 } }
      ]
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1100 }
  };
  const res = await fetchWithTimeout(GEMINI_URL + '?key=' + geminiKey(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }, 60000);
  if (!res.ok) throw new Error('Gemini vision ' + res.status + ' ' + (await readErrorDetail(res)));
  const j = await res.json();
  const c = j.candidates && j.candidates[0];
  const part = c && c.content && c.content.parts && c.content.parts[0];
  return part && part.text ? part.text.trim() : 'ไม่ได้รับผลวินิจฉัยจากระบบ';
}

async function visionGroq(img, prompt, context, model) {
  const res = await fetchWithTimeout(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + groqKey() },
    body: JSON.stringify({
      model: model,
      temperature: 0.3, max_tokens: 1100,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: VISION_PROMPT + '\n\nบริบทแปลงปัจจุบัน\n' + context + '\n\nคำถามจากเกษตรกร: ' + prompt },
          { type: 'image_url', image_url: { url: 'data:' + img.mime + ';base64,' + img.base64 } }
        ]
      }]
    })
  }, 60000);
  if (!res.ok) throw new Error('Groq vision ' + res.status + ' ' + (await readErrorDetail(res)));
  const j = await res.json();
  const c = j.choices && j.choices[0];
  return c && c.message ? c.message.content.trim() : 'ไม่ได้รับผลวินิจฉัยจากระบบ';
}

export async function diagnoseImage(img, note, ctx) {
  const prompt = 'วินิจฉัยอาการผิดปกติของพืชจากภาพนี้' +
    (note ? ' เกษตรกรแจ้งเพิ่มเติมว่า ' + note : '') +
    (ctx && ctx.crop ? ' พืชคือ ' + ctx.crop.name : '');

  let context;
  try { context = buildContext(ctx); }
  catch (e) { console.error('buildContext error (diagnoseImage):', e); context = 'ยังไม่มีข้อมูลแปลง'; }

  let lastErr = null;
  if (geminiKey()) {
    try { return await withRetry(function () { return visionGemini(img, prompt, context); }, 3); }
    catch (e) { console.error('Gemini vision error:', e); lastErr = 'Gemini: ' + e.message; }
  }
  if (groqKey()) {
    for (let i = 0; i < GROQ_VISION_MODELS.length; i++) {
      const model = GROQ_VISION_MODELS[i];
      try { return await withRetry(function () { return visionGroq(img, prompt, context, model); }, 2); }
      catch (e) {
        console.error('Groq vision error (' + model + '):', e);
        lastErr = (lastErr ? lastErr + ' / ' : '') + 'Groq (' + model + '): ' + e.message;
      }
    }
  }

  const reason = lastErr ? ('เหตุผล: ' + lastErr) : 'ยังไม่ได้ตั้งค่า API key ของ Gemini หรือ Groq ในไฟล์ .env';
  return 'ยังวินิจฉัยจากภาพไม่ได้ครับ (' + reason + ')\n\n' +
    'ระหว่างนี้ให้สำรวจแปลงตามหลัก IPM คือสุ่ม 10 จุด จุดละ 10 ต้น ดูยอด ใต้ใบ โคนต้น และผล ' +
    'บันทึกชนิดและจำนวนที่พบลงแอป แล้วส่งภาพให้เจ้าหน้าที่กลุ่มอารักขาพืชตรวจสอบครับ';
}

export const QUICK_QUESTIONS = [
  'ตอนนี้ต้องให้น้ำเพิ่มไหม',
  'ช่วงอายุนี้ควรใส่ปุ๋ยอะไร',
  'สัปดาห์นี้ต้องระวังโรคหรือแมลงอะไรบ้าง',
  'ดินแปลงนี้ควรปรับปรุงอย่างไร',
  'ตอนนี้เก็บเกี่ยวได้หรือยัง ติดระยะปลอดภัยไหม'
];