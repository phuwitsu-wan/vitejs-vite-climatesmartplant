import React, { useMemo, useState } from 'react';
import { ACTIVITY_TYPES } from '../data/crops.js';
import { today, thaiDate } from '../lib/date.js';

export default function LogView({ plot, activities, onAdd, onRemove }) {
  const [form, setForm] = useState({ type: 'fertilizer', date: today(), detail: '', qty: '', unit: 'กก./ไร่', note: '' });
  const [filter, setFilter] = useState('all');

  if (!plot) return <div className="card">ยังไม่ได้เลือกแปลง</div>;

  const list = useMemo(function () {
    return activities
      .filter(function (a) { return a.plotId === plot.id; })
      .filter(function (a) { return filter === 'all' || a.type === filter; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }, [activities, plot.id, filter]);

  const submit = function (e) {
    e.preventDefault();
    onAdd({
      plotId: plot.id, type: form.type, date: form.date,
      detail: form.detail.trim(), qty: form.qty ? Number(form.qty) : null,
      unit: form.unit, note: form.note.trim()
    });
    setForm(Object.assign({}, form, { detail: '', qty: '', note: '' }));
    window.alert('บันทึกเรียบร้อย ระบบจะนำไปปรับปฏิทินให้อัตโนมัติ');
  };

  const isInput = form.type === 'fertilizer' || form.type === 'spray';

  return (
    <>
      <section className="card">
        <div className="card-title">บันทึกกิจกรรมในแปลง</div>
        <form onSubmit={submit}>
          <div className="field">
            <span>ประเภทกิจกรรม</span>
            <div className="type-grid">
              {ACTIVITY_TYPES.map(function (t) {
                return (
                  <button type="button" key={t.key}
                    className={'type-btn ' + (form.type === t.key ? 'type-active' : '')}
                    onClick={function () { setForm(Object.assign({}, form, { type: t.key })); }}>
                    <span>{t.emoji}</span>{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="field">
            <span>วันที่</span>
            <input type="date" value={form.date} max={today()}
              onChange={function (e) { setForm(Object.assign({}, form, { date: e.target.value })); }} required />
          </label>

          <label className="field">
            <span>{isInput ? 'ชนิดปุ๋ยหรือสารที่ใช้' : 'รายละเอียด'}</span>
            <input type="text" value={form.detail}
              placeholder={isInput ? 'เช่น 46-0-0' : 'เช่น พบหนอน 3 ต้นจาก 20 ต้น'}
              onChange={function (e) { setForm(Object.assign({}, form, { detail: e.target.value })); }} />
          </label>

          {isInput && (
            <div className="row gap">
              <label className="field flex1">
                <span>ปริมาณ</span>
                <input type="number" step="0.1" value={form.qty}
                  onChange={function (e) { setForm(Object.assign({}, form, { qty: e.target.value })); }} />
              </label>
              <label className="field flex1">
                <span>หน่วย</span>
                <select value={form.unit} onChange={function (e) { setForm(Object.assign({}, form, { unit: e.target.value })); }}>
                  <option>กก./ไร่</option><option>กก./ต้น</option><option>ลิตร/ไร่</option>
                  <option>ซีซี/น้ำ 20 ลิตร</option><option>กรัม/น้ำ 20 ลิตร</option>
                </select>
              </label>
            </div>
          )}

          <label className="field">
            <span>หมายเหตุ</span>
            <textarea rows="2" value={form.note}
              onChange={function (e) { setForm(Object.assign({}, form, { note: e.target.value })); }} />
          </label>

          <button className="btn btn-primary w-full" type="submit">บันทึกกิจกรรม</button>
        </form>
      </section>

      <section className="card">
        <div className="card-title">ประวัติ ({list.length} รายการ)</div>
        <div className="filter-row">
          <button className={'chip ' + (filter === 'all' ? 'chip-active' : '')} onClick={function () { setFilter('all'); }}>ทั้งหมด</button>
          {ACTIVITY_TYPES.map(function (t) {
            return (
              <button key={t.key} className={'chip ' + (filter === t.key ? 'chip-active' : '')} onClick={function () { setFilter(t.key); }}>
                {t.emoji} {t.label}
              </button>
            );
          })}
        </div>

        {list.length === 0 && <p className="muted small">ยังไม่มีบันทึก</p>}
        {list.map(function (a) {
          const m = ACTIVITY_TYPES.filter(function (x) { return x.key === a.type; })[0];
          return (
            <div key={a.id} className="log-row">
              <div className="log-icon-lg">{m ? m.emoji : ''}</div>
              <div className="flex1">
                <div className="task-title">{m ? m.label : a.type}{a.detail ? <span className="muted"> · {a.detail}</span> : null}</div>
                <div className="small muted">{thaiDate(a.date)}{a.qty ? ' · ' + a.qty + ' ' + a.unit : ''}</div>
                {a.note ? <div className="small">{a.note}</div> : null}
              </div>
              <button className="icon-btn danger" onClick={function () { onRemove(a.id); }}>ลบ</button>
            </div>
          );
        })}
      </section>
    </>
  );
}