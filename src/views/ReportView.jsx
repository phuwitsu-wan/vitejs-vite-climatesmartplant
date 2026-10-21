import React, { useState } from 'react';
import { fetchHistory, weatherIcon } from '../lib/weather.js';
import { summarize, monthlySummary, dailyReportText, buildPlanReport, planReportText, stageWatchText } from '../lib/report.js';
import { thaiDate, thaiDateShort, thaiDow, today, diffDays } from '../lib/date.js';
import { TASK_META } from '../data/crops.js';
import { shareText } from '../lib/liff.js';

export default function ReportView({ plot, derived, activities }) {
  const [tab, setTab] = useState('plan');
  const [days, setDays] = useState(180);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [limit, setLimit] = useState(60);
  const [openStage, setOpenStage] = useState(null);

  if (!plot) return <div className="card">ยังไม่ได้เลือกแปลง</div>;
  if (!derived) return <div className="card skeleton">กำลังเตรียมข้อมูล</div>;

  const crop = derived.crop;
  const plan = buildPlanReport(plot, crop, derived, derived.alerts, activities, derived.endDate);
  const sum = rows ? summarize(rows) : null;
  const months = rows ? monthlySummary(rows) : [];

  const pull = async function (n) {
    setBusy(true); setErr(''); setDays(n); setLimit(60);
    try { setRows(await fetchHistory(plot.lat, plot.lon, n)); }
    catch (e) { setErr('ดึงข้อมูลย้อนหลังไม่สำเร็จ'); }
    setBusy(false);
  };

  const copyText = async function (txt) {
    try { await navigator.clipboard.writeText(txt); window.alert('คัดลอกรายงานแล้ว'); }
    catch (e) { window.prompt('คัดลอกข้อความด้านล่าง', txt); }
  };

  const renderTaskRow = function (x, past) {
    const meta = TASK_META[x.type] || { label: x.type, color: '#888' };
    const d = diffDays(today(), x.date);
    return (
      <div key={x.key} className={'plan-row ' + (past ? 'plan-row-past' : '')}>
        <div className="plan-date" style={{ borderColor: past ? '#C6CDD3' : meta.color }}>
          <b>{thaiDateShort(x.date)}</b><span>วัน{thaiDow(x.date)}</span>
        </div>
        <div className="flex1">
          <div className="task-title">
            <span className="type-chip" style={{ background: past ? '#AEB6BC' : meta.color }}>{meta.label}</span> {x.title}
            {x.generic ? <span className="tag-forecast">ทั่วไป</span> : null}
            {x.postponed ? <span className="tag-forecast">เลื่อนแล้ว</span> : null}
          </div>
          <div className="small muted">
            {d < 0 ? 'เลยกำหนด ' + Math.abs(d) + ' วัน' : d === 0 ? 'วันนี้' : 'อีก ' + d + ' วัน'}
            {x.gddAt ? ' · ' + x.gddAt + ' GDD' : ''}{x.done ? ' · บันทึกแล้ว' : ''}
          </div>
          {x.detail ? <div className="small">{x.detail}</div> : null}
          {x.note ? <div className="small shift-note">{x.note}</div> : null}
          {x.phiWarn ? <div className="phi-warn">{x.phiWarn}</div> : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="card">
        <div className="seg">
          <button className={'seg-btn ' + (tab === 'plan' ? 'seg-active' : '')} onClick={function () { setTab('plan'); }}>ปฏิทิน</button>
          <button className={'seg-btn ' + (tab === 'watch' ? 'seg-active' : '')} onClick={function () { setTab('watch'); }}>เฝ้าระวังรายระยะ</button>
          <button className={'seg-btn ' + (tab === 'weather' ? 'seg-active' : '')} onClick={function () { setTab('weather'); }}>อากาศ</button>
        </div>
      </section>

      {tab === 'plan' && (
        <>
          <section className="card report-cta">
            <div className="card-title">สรุปปฏิทินการผลิต แปลง {plot.name}</div>
            <div className="plan-head">
              <div className="plan-kpi"><b>{plan.gdd}</b><span>GDD สะสม</span></div>
              <div className="plan-kpi"><b>{plan.tasksTotal}</b><span>งานทั้งรอบการผลิต</span></div>
              <div className="plan-kpi"><b>{plan.rate}</b><span>GDD ต่อวัน</span></div>
              <div className="plan-kpi"><b>{plan.overdue.length}</b><span>เลยกำหนด</span></div>
            </div>
            <div className="small muted mt">
              {crop.name} · อายุ {plan.age} วัน · ระยะ {plan.stage.afterHarvest ? 'สิ้นสุดรอบแล้ว' : plan.stage.stage.name}
              {' '}(คำนวณจาก{plan.stage.basis === 'gdd' ? 'ความร้อนสะสม' : plan.stage.basis === 'month' ? 'ช่วงเดือน' : 'อายุวัน'})
            </div>
            <div className="small muted">
              สิ้นสุดรอบการผลิต {thaiDate(plan.endDate, true)}
              {plan.daysToEnd >= 0 ? ' (อีก ' + plan.daysToEnd + ' วัน)' : ' (ผ่านมาแล้ว ' + Math.abs(plan.daysToEnd) + ' วัน)'}
            </div>
          </section>

          {plan.phiLocks.length > 0 && (
            <section className="card">
              <div className="card-title">ระยะปลอดภัยก่อนเก็บเกี่ยวที่ยังมีผล <span className="badge badge-grey">{plan.phiLocks.length}</span></div>
              {plan.phiLocks.map(function (p) {
                return (
                  <div key={p.id} className="phi-row">
                    <div className="flex1">
                      <div className="task-title">{p.chem} <span className="mini-chip" style={{ background: '#495057' }}>กลุ่ม {p.group}</span></div>
                      <div className="small muted">พ่นเมื่อ {thaiDate(p.sprayDate)} · ระยะปลอดภัย {p.phi} วัน</div>
                      <div className="small"><b>เก็บเกี่ยวได้ตั้งแต่ {thaiDate(p.safeDate, true)}</b></div>
                      {!p.known ? <div className="small warn">ไม่พบสารนี้ในฐานข้อมูล ใช้ค่ามาตรฐาน 14 วัน ให้ตรวจสอบจากฉลาก</div> : null}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {plan.overdue.length > 0 && (
            <section className="card">
              <div className="card-title">งานที่เลยกำหนดและยังไม่ได้บันทึก <span className="badge badge-grey">{plan.overdue.length}</span></div>
              {plan.overdue.map(function (x) { return renderTaskRow(x, true); })}
            </section>
          )}

          <section className="card">
            <div className="card-title">สิ่งที่ต้องทำใน 60 วันข้างหน้า</div>
            {plan.upcoming.length === 0 && <p className="muted small">ไม่มีงานที่กำหนดในช่วงนี้</p>}
            {plan.upcoming.map(function (x) { return renderTaskRow(x, false); })}
          </section>

          <section className="card">
            <div className="row gap">
              <button className="btn flex1" onClick={function () { copyText(planReportText(plan)); }}>คัดลอกรายงาน</button>
              <button className="btn btn-primary flex1" onClick={function () { shareText(planReportText(plan).slice(0, 4500)); }}>ส่งเข้าไลน์</button>
            </div>
          </section>
        </>
      )}

      {tab === 'watch' && (
        <section className="card">
          <div className="card-title">การเฝ้าระวังโรคและแมลงรายระยะ</div>
          <p className="small muted">
            แจกแจงว่าแต่ละระยะของ{crop.name}ต้องระวังอะไร พร้อมเงื่อนไขอากาศที่ทำให้เสี่ยง เกณฑ์ตัดสินใจ และวิธีสำรวจ
            กดที่ชื่อระยะเพื่อดูรายละเอียด
          </p>
          <button className="btn w-full" onClick={function () { copyText(stageWatchText(plot, crop, plan.stageWatch)); }}>
            📋 คัดลอกสรุปเฝ้าระวังรายระยะทั้งหมด
          </button>
          {plan.stageWatch.map(function (s) {
            const open = openStage === s.key;
            return (
              <div key={s.key} className={'watch-stage ' + (s.current ? 'watch-now' : '')}>
                <div className="watch-head" onClick={function () { setOpenStage(open ? null : s.key); }}>
                  <div className="flex1">
                    <div className="task-title">
                      {s.name}{s.current ? <span className="badge">ระยะปัจจุบัน</span> : null}
                    </div>
                    <div className="small muted">
                      {s.gdd} GDD{s.startDate ? ' · เริ่ม ' + thaiDateShort(s.startDate) : ''} · Kc {s.kc} · เฝ้าระวัง {s.targets.length} รายการ
                    </div>
                  </div>
                  <span className="chev">{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div className="watch-body">
                    {s.targets.map(function (t, i) {
                      return (
                        <div key={i} className={'watch-item ' + (t.type === 'disease' ? 'wi-disease' : t.type === 'insect' ? 'wi-insect' : 'wi-gen')}>
                          <div className="task-title">
                            <span className="mini-chip" style={{ background: t.type === 'disease' ? '#9C36B5' : t.type === 'insect' ? '#F08C00' : '#868E96' }}>
                              {t.type === 'disease' ? 'โรค' : t.type === 'insect' ? 'แมลง/ไร' : 'ทั่วไป'}
                            </span> {t.name}
                          </div>
                          <div className="small"><b>เงื่อนไขอากาศเสี่ยง:</b> {t.when}</div>
                          <div className="small"><b>เกณฑ์ตัดสินใจ:</b> {t.ett}</div>
                          <div className="small"><b>วิธีสำรวจ:</b> {t.method}</div>
                        </div>
                      );
                    })}
                    {s.guide && s.guide.length > 0 && (
                      <div className="watch-guide">
                        <div className="small muted" style={{ marginTop: 10, marginBottom: 4 }}>
                          ข้อมูลอ้างอิงเพิ่มเติม (จากฐานข้อมูลศัตรูพืชฉบับเต็ม)
                        </div>
                        {s.guide.map(function (g, i) {
                          return (
                            <div key={i} className={'watch-item ' + (g.type === 'โรค' ? 'wi-disease' : 'wi-insect')}>
                              <div className="task-title">
                                <span className="mini-chip" style={{ background: g.type === 'โรค' ? '#9C36B5' : '#F08C00' }}>{g.type}</span> {g.name}
                              </div>
                              {g.cond && <div className="small"><b>เงื่อนไขเสี่ยง:</b> {g.cond}</div>}
                              {g.watch && <div className="small"><b>อาการที่สังเกต:</b> {g.watch}</div>}
                              {g.manage && <div className="small"><b>การจัดการ:</b> {g.manage}</div>}
                              {g.chem && g.chem.length > 0 && (
                                <div className="small">
                                  <b>สารที่ใช้ได้:</b>
                                  {g.chem.map(function (c, j) {
                                    return <div key={j}>· {c.g ? '[กลุ่ม ' + c.g + '] ' : ''}{c.t}</div>;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <p className="small muted">อัตราสารเป็นข้อมูลอ้างอิง ควรตรวจสอบกับฉลากจริงหรือเจ้าหน้าที่ก่อนใช้งาน</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {tab === 'weather' && (
        <>
          <section className="card report-cta">
            <div className="card-title">รายงานอุณหภูมิ ความชื้น และปริมาณน้ำฝน</div>
            <div className="report-btns">
              <button className="btn btn-primary" disabled={busy} onClick={function () { pull(180); }}>
                {busy && days === 180 ? 'กำลังดึง' : 'ย้อนหลัง 180 วัน'}
              </button>
              <button className="btn" disabled={busy} onClick={function () { pull(90); }}>90 วัน</button>
              <button className="btn" disabled={busy} onClick={function () { pull(30); }}>30 วัน</button>
            </div>
            {err ? <p className="warn small mt">{err}</p> : null}
          </section>

          {sum && (
            <section className="card">
              <div className="card-title">สรุปภาพรวม {sum.days} วัน</div>
              <table className="rep-table mt">
                <tbody>
                  <tr><td>อุณหภูมิเฉลี่ย</td><td><b>{sum.tmeanAvg} องศา</b></td></tr>
                  <tr><td>ความชื้นเฉลี่ย</td><td><b>{sum.rhAvg} เปอร์เซ็นต์</b></td></tr>
                  <tr><td>ฝนสะสมรวม</td><td><b>{sum.rainSum} มม.</b></td></tr>
                  <tr><td>วันที่ฝนตก</td><td><b>{sum.rainDays} วัน</b></td></tr>
                  <tr><td>ฝนทิ้งช่วงสูงสุด</td><td><b>{sum.dryStreak} วัน</b></td></tr>
                </tbody>
              </table>
            </section>
          )}

          {months.length > 0 && (
            <section className="card">
              <div className="card-title">สรุปรายเดือน</div>
              <div className="tbl-wrap">
                <table className="grid-table">
                  <thead><tr><th>เดือน</th><th>อุณหภูมิ</th><th>ความชื้น</th><th>ฝนรวม</th><th>วันฝนตก</th></tr></thead>
                  <tbody>
                    {months.map(function (m) {
                      return <tr key={m.key}><td>{m.label}</td><td>{m.tmeanAvg}</td><td>{m.rhAvg}</td><td>{m.rainSum}</td><td>{m.rainDays}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {rows && (
            <section className="card">
              <div className="card-title">ตารางรายวัน ({rows.length} วัน)</div>
              <div className="tbl-wrap">
                <table className="grid-table">
                  <thead><tr><th>วันที่</th><th>สูงสุด</th><th>ต่ำสุด</th><th>ชื้น</th><th>ฝน</th><th>อากาศ</th></tr></thead>
                  <tbody>
                    {rows.slice(0).reverse().slice(0, limit).map(function (r) {
                      return (
                        <tr key={r.date} className={(r.rain || 0) >= 20 ? 'row-rain' : ''}>
                          <td>{thaiDateShort(r.date)}</td>
                          <td>{r.tmax === null ? '-' : Math.round(r.tmax)}</td>
                          <td>{r.tmin === null ? '-' : Math.round(r.tmin)}</td>
                          <td>{r.rhMean === undefined ? '-' : r.rhMean}</td>
                          <td>{(r.rain || 0).toFixed(1)}</td>
                          <td>{weatherIcon(r)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {limit < rows.length && (
                <button className="btn btn-sm w-full mt" onClick={function () { setLimit(limit + 60); }}>
                  โหลดเพิ่มอีก 60 วัน
                </button>
              )}
              <div className="row gap mt">
                <button className="btn flex1" onClick={function () { copyText(dailyReportText(rows, plot)); }}>คัดลอก CSV</button>
                <button className="btn btn-primary flex1" onClick={function () { shareText(dailyReportText(rows, plot).slice(0, 4500)); }}>ส่งเข้าไลน์</button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}