import React, { useState, useRef, useEffect } from 'react';
import { askAI, diagnoseImage, compressImage, QUICK_QUESTIONS, aiProvider, PROVIDER_LABEL } from '../lib/ai.js';

function nowTime() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatView({ plot, derived, weather, soil, soilAdvice, nearby }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'สวัสดีครับ ผมคือผู้ช่วยนักวิชาการเกษตรประจำแปลง ' + (plot ? plot.name : '') +
      '\n\nถามเรื่องปุ๋ย น้ำ ดิน โรคแมลง หรือกดปุ่มรูปภาพเพื่อถ่ายใบหรือผลที่ผิดปกติให้ผมช่วยวินิจฉัยเบื้องต้นได้เลยครับ',
    time: nowTime()
  }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);   // ภาพที่รอส่ง
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(function () {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, pending]);

  if (!plot) return <div className="card">ยังไม่ได้เลือกแปลง</div>;

  const buildCtx = function () {
    return {
      plot: plot,
      crop: derived ? derived.crop : null,
      stageInfo: derived ? derived.stageInfo : null,
      todayRow: weather && weather.series ? weather.series.filter(function (r) { return r.isPast; }).slice(-1)[0] : null,
      fert: derived ? derived.fert : null,
      water: derived ? derived.water : null,
      alerts: derived ? derived.alerts : [],
      tasks: derived ? derived.tasks : [],
      phiLocks: derived ? derived.phiLocks : [],
      soil: soil, soilAdvice: soilAdvice, nearby: nearby || []
    };
  };

  const pickImage = async function (e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const img = await compressImage(f, 1024);
      setPending(img);
    } catch (err) {
      window.alert('อ่านไฟล์ภาพไม่สำเร็จ กรุณาลองใหม่');
    }
    e.target.value = '';
  };

  const sendImage = async function () {
    if (!pending || busy) return;
    const note = input.trim();
    setInput('');
    const img = pending;
    setPending(null);

    const next = messages.concat([{
      role: 'user',
      text: note || 'ช่วยดูอาการจากภาพนี้ให้หน่อยครับ',
      image: img.dataUrl,
      time: nowTime()
    }]);
    setMessages(next);
    setBusy(true);
    const reply = await diagnoseImage(img, note, buildCtx());
    setMessages(next.concat([{ role: 'assistant', text: reply, kind: 'diagnosis', time: nowTime() }]));
    setBusy(false);
  };

  const send = async function (txt) {
    if (pending) return sendImage();
    const q = (txt || input).trim();
    if (!q || busy) return;
    setInput('');
    const next = messages.concat([{ role: 'user', text: q, time: nowTime() }]);
    setMessages(next);
    setBusy(true);
    const reply = await askAI(next.map(function (m) { return { role: m.role, text: m.text }; }), buildCtx());
    setMessages(next.concat([{ role: 'assistant', text: reply, time: nowTime() }]));
    setBusy(false);
  };

  const p = aiProvider();

  return (
    <section className="card chat-container">
      <div className="card-title">
        ผู้ช่วย AI แปลง {plot.name}
        <span className="badge badge-grey">{PROVIDER_LABEL[p] || p}</span>
      </div>

      <div className="chat-messages">
        {messages.map(function (m, i) {
          return (
            <div key={i} className={'msg ' + (m.role === 'user' ? 'msg-user' : 'msg-ai')}>
              {m.image ? <img className="msg-img" src={m.image} alt="ภาพที่ส่งวินิจฉัย" /> : null}
              {m.kind === 'diagnosis' ? <div className="diag-tag">ผลวินิจฉัยเบื้องต้นจากภาพ</div> : null}
              <div className="msg-bubble">{m.text}</div>
              <div className="msg-time">{m.time}</div>
            </div>
          );
        })}
        {busy && (
          <div className="msg msg-ai">
            <div className="msg-bubble muted">กำลังวิเคราะห์จากข้อมูลแปลงและภาพที่ส่งมา...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {pending && (
        <div className="pending-img">
          <img src={pending.dataUrl} alt="ภาพที่เลือก" />
          <div className="flex1">
            <div className="small"><b>พร้อมส่งวินิจฉัย</b></div>
            <div className="small muted">พิมพ์อาการเพิ่มเติมได้ เช่น พบที่ใบล่าง เริ่มเป็นหลังฝนตก</div>
          </div>
          <button className="icon-btn danger" onClick={function () { setPending(null); }}>ยกเลิก</button>
        </div>
      )}

      {!pending && (
        <div className="chat-quick">
          {QUICK_QUESTIONS.map(function (qq, i) {
            return <button key={i} className="cq-btn" disabled={busy} onClick={function () { send(qq); }}>{qq}</button>;
          })}
        </div>
      )}

      <div className="chat-input-row">
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={pickImage} />
        <button className="btn btn-cam" disabled={busy} onClick={function () { fileRef.current.click(); }}>
          {'\u{1F4F7}'}
        </button>
        <input type="text" value={input}
          placeholder={pending ? 'อธิบายอาการเพิ่มเติม (ไม่บังคับ)' : 'พิมพ์คำถามเกี่ยวกับการจัดการแปลง...'}
          onChange={function (e) { setInput(e.target.value); }}
          onKeyDown={function (e) { if (e.key === 'Enter') send(); }}
          disabled={busy} />
        <button className="btn btn-primary" disabled={busy || (!input.trim() && !pending)} onClick={function () { send(); }}>
          {pending ? 'วินิจฉัย' : 'ส่ง'}
        </button>
      </div>
    </section>
  );
}