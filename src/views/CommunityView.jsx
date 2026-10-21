import React, { useEffect, useState } from 'react';
import { fetchNearby, summarizeNearby, reportOutbreak, communityMode } from '../lib/community.js';
import { SCOUT_TARGETS } from '../data/scoutTargets.js';
import { today, thaiDate } from '../lib/date.js';
import { CROPS } from '../data/crops.js';

export default function CommunityView({ plot, derived, onReported }) {
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [radius, setRadius] = useState(5);
  const [form, setForm] = useState({ pest: '', kind: 'insect', severity: 'found', count: '', note: '', date: today() });

  const load = async function (r) {
    if (!plot) return;
    setBusy(true);
    const data = await fetchNearby(plot, r || radius, 14);
    // ข้อ 6: แจ้งเตือนเฉพาะรายงานของพืชชนิดเดียวกับแปลงนี้เท่านั้น
    const sameCropData = data.filter(function (x) { return x.crop === plot.crop; });
    setRows(sameCropData);
    setGroups(summarizeNearby(sameCropData));
    setBusy(false);
  };

  useEffect(function () { load(radius); }, [plot ? plot.id : null, radius]);

  if (!plot) return <div className="card">ยังไม่ได้เลือกแปลง</div>;

  const options = (SCOUT_TARGETS[plot.crop] || []).map(function (t) { return t; });
  const mode = communityMode();

  const submit = async function (e) {
    e.preventDefault();
    if (!form.pest) { window.alert('กรุณาเลือกหรือพิมพ์ชื่อศัตรูพืช'); return; }
    setBusy(true);
    const res = await reportOutbreak(plot, {
      pest: form.pest, kind: form.kind, severity: form.severity,
      count: form.count ? Number(form.count) : null, note: form.note, date: form.date
    });
    setBusy(false);
    setForm(Object.assign({}, form, { count: '', note: '' }));
    window.alert(res.mode === 'online'
      ? 'ส่งรายงานแล้ว ขอบคุณครับ ข้อมูลนี้จะช่วยเตือนเพื่อนเกษตรกรรอบ ๆ โดยไม่เปิดเผยตัวตนและไม่ระบุแปลง'
      : 'บันทึกไว้ในเครื่องแล้ว (ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ส่วนกลาง จึงยังไม่แชร์ให้แปลงอื่น)');
    if (onReported) onReported();
    load(radius);
  };

  return (
    <>
      <section className="card">
        <div className="card-title">
          สถานการณ์ศัตรูพืชรอบแปลง
          <span className="badge badge-grey">{mode === 'online' ? 'เชื่อมต่อส่วนกลาง' : 'โหมดเฉพาะเครื่อง'}</span>
        </div>
        <div className="filter-row">
          {[3, 5, 10, 20].map(function (r) {
            return (
              <button key={r} className={'chip ' + (radius === r ? 'chip-active' : '')} onClick={function () { setRadius(r); }}>
                รัศมี {r} กม.
              </button>
            );
          })}
        </div>
        {busy && <p className="muted small">กำลังโหลดข้อมูล...</p>}
        {!busy && groups.length === 0 && <p className="ok-msg">ยังไม่มีรายงานการระบาดในรัศมี {radius} กม. ภายใน 14 วันที่ผ่านมา</p>}
        {groups.map(function (g, i) {
          return (
            <div key={i} className={'risk-row ' + (g.nearestKm <= 5 && g.sameCrop ? 'risk-high' : g.nearestKm <= 10 ? 'risk-alert' : 'risk-watch')}>
              <div className="flex1">
                <div className="task-title">{g.pest}</div>
                <div className="small">{g.text}</div>
                <div className="small muted">พืชที่รายงาน {CROPS[g.crop] ? CROPS[g.crop].name : g.crop}</div>
              </div>
            </div>
          );
        })}
        <p className="small muted mt">
          รายงานทั้งหมดไม่ระบุตัวตนและไม่เก็บพิกัดจริง ระบบปัดตำแหน่งลงตารางกริดประมาณ 1 กิโลเมตรก่อนส่ง
        </p>
      </section>

      <section className="card">
        <div className="card-title">แจ้งสิ่งที่พบในแปลงของคุณ</div>
        <form onSubmit={submit}>
          <div className="field">
            <span>ศัตรูพืชที่พบ</span>
            <div className="crop-grid">
              {options.map(function (o) {
                return (
                  <button type="button" key={o.key}
                    className={'crop-btn ' + (form.pest === o.name ? 'crop-active' : '')}
                    onClick={function () { setForm(Object.assign({}, form, { pest: o.name, kind: o.type })); }}>
                    <span className="crop-icon">{o.type === 'disease' ? '\u{1F9A0}' : '\u{1F41B}'}</span>{o.name}
                  </button>
                );
              })}
            </div>
            <input className="mt" type="text" placeholder="หรือพิมพ์ชื่อเอง"
              value={form.pest} onChange={function (e) { setForm(Object.assign({}, form, { pest: e.target.value })); }} />
          </div>

          <label className="field">
            <span>วันที่พบ</span>
            <input type="date" max={today()} value={form.date}
              onChange={function (e) { setForm(Object.assign({}, form, { date: e.target.value })); }} />
          </label>

          <div className="row gap">
            <label className="field flex1">
              <span>ระดับความรุนแรง</span>
              <select value={form.severity} onChange={function (e) { setForm(Object.assign({}, form, { severity: e.target.value })); }}>
                <option value="found">พบประปราย ยังไม่ถึงเกณฑ์</option>
                <option value="threshold">ถึงเกณฑ์ต้องจัดการ</option>
                <option value="outbreak">ระบาดรุนแรง</option>
              </select>
            </label>
            <label className="field flex1">
              <span>จำนวนที่นับได้</span>
              <input type="number" step="0.1" placeholder="ตัวต่อต้น หรือ %"
                value={form.count} onChange={function (e) { setForm(Object.assign({}, form, { count: e.target.value })); }} />
            </label>
          </div>

          <label className="field">
            <span>หมายเหตุ</span>
            <textarea rows="2" maxLength="140" value={form.note}
              onChange={function (e) { setForm(Object.assign({}, form, { note: e.target.value })); }} />
          </label>

          <button className="btn btn-primary w-full" type="submit" disabled={busy}>ส่งรายงานแบบไม่ระบุตัวตน</button>
        </form>
      </section>
    </>
  );
}