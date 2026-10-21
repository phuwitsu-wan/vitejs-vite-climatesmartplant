import React, { useMemo, useState } from 'react';
import { TASK_META, ACTIVITY_TYPES } from '../data/crops.js';
import { ymd, addDays, thaiMonthYear, thaiDate, thaiDow, today, diffDays, toDate } from '../lib/date.js';
import { weatherIcon } from '../lib/weather.js';
import { stageOnDate, stageSegments } from '../lib/agronomy.js';
import { fertilizerForAge } from '../data/fertilizer.js';
import { rulesForCrop } from '../data/alertRules.js';
import { phiChemicalsForCrop } from '../data/phiChemicals.js';
import StageBar from './StageBar.jsx';
import PestImage from './PestImage.jsx';

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// ไล่สีจุดบนไทม์ไลน์ตามสัดส่วนความร้อนสะสม (GDD) ที่ทำได้แล้วในระยะนั้น (0–100)
// เทา (ยังไม่เริ่ม) -> เหลืองอำพัน (กำลังสะสม) -> เขียว (ครบ/ผ่านระยะ)
function gddColor(pct) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const stops = [
    { at: 0, c: [206, 212, 218] },   // เทา #CED4DA
    { at: 50, c: [245, 159, 0] },    // เหลืองอำพัน #F59F00
    { at: 100, c: [43, 138, 62] }    // เขียว #2B8A3E
  ];
  let a = stops[0], b = stops[1];
  if (p >= 50) { a = stops[1]; b = stops[2]; }
  const span = b.at - a.at || 1;
  const t = (p - a.at) / span;
  const mix = function (i) { return Math.round(a.c[i] + (b.c[i] - a.c[i]) * t); };
  return 'rgb(' + mix(0) + ',' + mix(1) + ',' + mix(2) + ')';
}

export default function CalendarView({ plot, derived, activities, weather }) {
  const [cursor, setCursor] = useState(function () { return new Date(); });
  const [selected, setSelected] = useState(today());
  const [openPest, setOpenPest] = useState(null);
  const [showAllFert, setShowAllFert] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  if (!plot || !derived) return <div className="card skeleton">กำลังสร้างปฏิทิน</div>;

  const tasks = derived.tasks;
  const crop = derived.crop;
  const curve = derived.curve;
  const endDate = derived.endDate;
  const plotActs = activities.filter(function (a) { return a.plotId === plot.id; });

  const byDate = useMemo(function () {
    const m = {};
    for (let i = 0; i < tasks.length; i++) {
      const x = tasks[i];
      if (!m[x.date]) m[x.date] = { tasks: [], acts: [] };
      m[x.date].tasks.push(x);
    }
    for (let i = 0; i < plotActs.length; i++) {
      const a = plotActs[i];
      if (!m[a.date]) m[a.date] = { tasks: [], acts: [] };
      m[a.date].acts.push(a);
    }
    return m;
  }, [tasks, plotActs]);

  const wxByDate = useMemo(function () {
    const m = {};
    const s = (weather && weather.series) || [];
    for (let i = 0; i < s.length; i++) m[s[i].date] = s[i];
    return m;
  }, [weather]);

  const grid = useMemo(function () {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const out = [];
    for (let i = 0; i < 42; i++) out.push(addDays(start, i));
    return out;
  }, [cursor]);

  const sel = byDate[selected] || { tasks: [], acts: [] };
  const selWx = wxByDate[selected];
  const selStage = stageOnDate(crop, plot, curve, selected);
  const age = selStage.age;

  const ageLabel = selStage.beforeStart
    ? 'ก่อนเริ่มรอบการผลิต ' + Math.abs(age) + ' วัน'
    : selStage.afterHarvest
      ? 'หลังสิ้นสุดรอบการผลิต'
      : age === 0 ? 'วันเริ่มรอบการผลิต'
        : 'อายุพืช ' + age + ' วัน' + (age >= 30 ? ' (ประมาณ ' + Math.floor(age / 30) + ' เดือน ' + (age % 30) + ' วัน)' : '');

  const selSegments = stageSegments(crop, plot, curve, selected);
  // ใช้สูตรเดียวกับหลอดสีเขียวที่แสดงอยู่ด้านล่าง (ไล่มาจาก selSegments ที่คำนึงถึง afterHarvest แล้ว)
  // แทนการคำนวณแบบเดิมที่ใช้ อายุ/ระยะปลูกทั้งหมด ซึ่งไม่สัมพันธ์กับ GDD หรือสถานะสิ้นสุดรอบเลย
  let pct = selStage.afterHarvest ? 100 : selStage.beforeStart ? 0 : Math.round(
    selSegments.reduce(function (acc, s) { return acc + s.widthPct * (s.fillPct / 100); }, 0)
  );
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  const selMonth = toDate(selected).getMonth() + 1;
  const fert = (selStage.afterHarvest || selStage.beforeStart) ? { items: [], note: '', all: [] } : fertilizerForAge(crop.id, age, selMonth);
  const pests = (selStage.afterHarvest || selStage.beforeStart) ? [] : rulesForCrop(crop.id, selStage.stage ? selStage.stage.key : null);

  const typesInSeason = {};
  for (let i = 0; i < tasks.length; i++) typesInSeason[tasks[i].type] = true;

  function marksFor(cell) {
    if (!cell) return [];
    const seen = {};
    const out = [];
    for (let i = 0; i < cell.tasks.length; i++) {
      const ty = cell.tasks[i].type;
      if (seen[ty]) continue;
      seen[ty] = true;
      const meta = TASK_META[ty];
      out.push({ k: ty, emoji: meta ? meta.emoji : '\u{1F4CC}', label: meta ? meta.label : ty });
    }
    return out;
  }

  return (
    <>
      <section className="card">
        <div className="cal-head">
          <button className="icon-btn" onClick={function () { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }}>ก่อนหน้า</button>
          <div className="cal-title">{thaiMonthYear(cursor)}</div>
          <button className="icon-btn" onClick={function () { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }}>ถัดไป</button>
        </div>

        <div className="cal-grid cal-dow">
          {DOW.map(function (d) { return <div key={d} className="cal-dow-cell">{d}</div>; })}
        </div>

        <div className="cal-grid">
          {grid.map(function (d) {
            const ds = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const cell = byDate[ds];
            const wx = wxByDate[ds];
            const isToday = ds === today();
            const heavyRain = wx && (wx.rain || 0) >= 20;
            const marks = marksFor(cell);
            const cls = ['cal-cell'];
            if (!inMonth) cls.push('cal-out');
            if (heavyRain) cls.push('cal-rain');
            if (isToday) cls.push('cal-today');
            if (selected === ds) cls.push('cal-selected');
            return (
              <button key={ds} className={cls.join(' ')} onClick={function () { setSelected(ds); }}>
                <span className="cal-num">{d.getDate()}</span>
                <span className="cal-marks">
                  {marks.slice(0, 2).map(function (m) {
                    return <span key={m.k} className="cal-emoji" title={m.label}>{m.emoji}</span>;
                  })}
                  {marks.length > 2 ? <span className="cal-more">+{marks.length - 2}</span> : null}
                  {cell && cell.acts.length ? <span className="cal-emoji cal-check">{'\u2714'}</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        <button className="btn btn-sm w-full mt" onClick={function () { setShowLegend(!showLegend); }}>
          {showLegend ? 'ซ่อนคำอธิบายสัญลักษณ์' : 'ดูคำอธิบายสัญลักษณ์'}
        </button>

        {showLegend && (
          <div className="legend-box">
            <div className="sub-title">คำอธิบายสัญลักษณ์ในปฏิทิน</div>
            {Object.keys(TASK_META).map(function (k) {
              if (!typesInSeason[k]) return null;
              const v = TASK_META[k];
              return (
                <div key={k} className="legend-row">
                  <span className="legend-emoji">{v.emoji}</span>
                  <div className="flex1"><b className="small">{v.label}</b><div className="small muted">{v.desc}</div></div>
                </div>
              );
            })}
            <div className="legend-row">
              <span className="legend-emoji cal-check">{'\u2714'}</span>
              <div className="flex1"><b className="small">บันทึกแล้ว</b><div className="small muted">วันที่เกษตรกรบันทึกกิจกรรมไว้</div></div>
            </div>
            <div className="legend-row">
              <span className="legend-emoji">{'\u{1F327}'}</span>
              <div className="flex1"><b className="small">พื้นหลังสีฟ้า</b><div className="small muted">วันที่ฝนตกตั้งแต่ 20 มิลลิเมตรขึ้นไป</div></div>
            </div>
            <div className="legend-row">
              <i className="legend-box-sample legend-sel" />
              <div className="flex1"><b className="small">กรอบสีดำ</b><div className="small muted">วันที่กำลังเลือกดูอยู่ ส่วนกรอบสีเขียวคือวันนี้</div></div>
            </div>
          </div>
        )}
      </section>

      <section className="card age-card">
        <div className="age-head">
          <div>
            <div className="small muted">{thaiDate(selected, true)} วัน{thaiDow(selected)}</div>
            <div className="age-big">{ageLabel}</div>
          </div>
          <div className="age-badge">{crop.emoji}</div>
        </div>

        <div className="age-grid">
          <div className="age-item">
            <span className="small muted">ระยะการเจริญเติบโต</span>
            <b>{selStage.afterHarvest ? 'สิ้นสุดรอบแล้ว' : selStage.beforeStart ? 'ยังไม่เริ่มรอบ' : selStage.stage.name}</b>
          </div>
          <div className="age-item"><span className="small muted">ความร้อนสะสม</span><b>{selStage.gdd} GDD</b></div>
          <div className="age-item"><span className="small muted">ระยะถัดไป</span><b>{selStage.next ? selStage.next.name : 'ระยะสุดท้าย'}</b></div>
          <div className="age-item"><span className="small muted">ความคืบหน้าทั้งรอบ</span><b>{pct}%</b></div>
        </div>

        <StageBar segments={selSegments} />

        {!selStage.afterHarvest && !selStage.beforeStart && derived.endDate && (function () {
          const daysToHarvest = Math.max(0, diffDays(selected, derived.endDate));
          const phiList = phiChemicalsForCrop(plot.crop);
          const avoid = phiList.filter(function (c) { return c.days >= daysToHarvest; });
          if (!phiList.length) return null;
          return (
            <div className="phi-box mt">
              <div className="card-title" style={{ fontSize: 14 }}>ตรวจสอบก่อนพ่นสาร (PHI)</div>
              {avoid.length > 0 ? (
                <>
                  <p className="small warn">
                    เหลืออีก {daysToHarvest} วันก่อนเก็บเกี่ยว (นับจากวันที่เลือก) สารต่อไปนี้ <b>ควรงดพ่น</b> เพราะ PHI (ระยะปลอดภัยก่อนเก็บเกี่ยว) นานกว่าวันที่เหลือ
                  </p>
                  {avoid.map(function (c, i) {
                    return (
                      <div key={i} className="small">
                        🚫 <b>{c.trade}</b> ({c.active}) — PHI {c.days} วัน{c.specific ? '' : ' (ค่าทั่วไป ไม่เจาะจงพืชนี้)'}
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="small">ยังไม่มีสารในฐานข้อมูลที่ต้องงดพ่นช่วงนี้ ตามจำนวนวันที่เหลือก่อนเก็บเกี่ยว</p>
              )}
              <p className="small muted mt">
                ข้อมูล PHI จากคู่มือผลิตภัณฑ์ยูนิไลฟ์ (ยี่ห้อเดียว เป็นค่าโดยประมาณ) ไม่ครอบคลุมสารทุกยี่ห้อในท้องตลาด
                ควรตรวจสอบกับฉลากสารเคมีจริงทุกครั้งก่อนตัดสินใจพ่น
              </p>
            </div>
          );
        })()}

        {selWx && (
          <div className="day-wx">
            {weatherIcon(selWx)} {Math.round(selWx.tmin)} – {Math.round(selWx.tmax)} องศา ·
            ฝน {(selWx.rain || 0).toFixed(1)} มม. · ความชื้น {selWx.rhMean === undefined ? '-' : selWx.rhMean}%
            {!selWx.isPast ? <span className="tag-forecast">พยากรณ์</span> : null}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">งานและบันทึกของวันที่เลือก</div>
        {sel.tasks.length === 0 && sel.acts.length === 0 && <p className="muted small">ไม่มีรายการในวันนี้</p>}
        {sel.tasks.map(function (x) {
          const meta = TASK_META[x.type] || { label: x.type, emoji: '', color: '#888' };
          const past = diffDays(today(), x.date) < 0 && !x.done;
          return (
            <div key={x.key} className={'task ' + (past ? 'task-past' : '')}>
              <div className="task-icon" style={{ background: meta.color + '1A', color: meta.color }}>{meta.emoji}</div>
              <div className="task-body">
                <div className="task-title">
                  <span className="type-chip" style={{ background: meta.color }}>{meta.label}</span> {x.title}
                  {x.done ? <span className="tag-done">ทำแล้ว</span> : null}
                </div>
                {x.detail ? <div className="small">{x.detail}</div> : null}
                {x.reason ? <div className="small shift-note">{x.reason}</div> : null}
              </div>
            </div>
          );
        })}
        {sel.acts.map(function (a) {
          const m = ACTIVITY_TYPES.filter(function (x) { return x.key === a.type; })[0];
          return (
            <div key={a.id} className="task task-log">
              <div className="task-icon log-icon">{m ? m.emoji : '\u{1F4DD}'}</div>
              <div className="task-body">
                <div className="task-title">บันทึก {m ? m.label : a.type}</div>
                {a.detail ? <div className="small">{a.detail}</div> : null}
                {a.note ? <div className="small muted">{a.note}</div> : null}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="card-title">ปุ๋ยสำหรับช่วงอายุนี้</div>
        {selStage.afterHarvest
          ? <p className="muted small">สิ้นสุดรอบการผลิตแล้ว ไม่มีกำหนดใส่ปุ๋ยสำหรับรอบนี้</p>
          : fert.items.length === 0
            ? <p className="muted small">ไม่มีกำหนดใส่ปุ๋ยในช่วงอายุ {age} วัน กดปุ่มด้านล่างเพื่อดูแผนทั้งรอบ</p>
            : fert.items.map(function (f, i) {
              return (
                <div key={i} className="fert-box">
                  <div className="fert-when">{f.when}</div>
                  <div className="fert-row"><span>สูตรหลัก</span><b>{f.formula}</b></div>
                  <div className="fert-row"><span>อัตราใช้</span><b className="fert-rate">{f.rate}</b></div>
                  {f.altFormula && (
                    <div className="fert-row"><span>สูตรทางเลือก</span><span>{f.altFormula} · {f.altRate}</span></div>
                  )}
                  <div className="fert-row"><span>วิธีใส่</span><span className="fert-method">{f.method}</span></div>
                  {f.soilNote && <div className="small muted mt">ปรับตามดิน: {f.soilNote}</div>}
                </div>
              );
            })}
        <button className="btn btn-sm w-full mt" onClick={function () { setShowAllFert(!showAllFert); }}>
          {showAllFert ? 'ซ่อนแผนปุ๋ยทั้งรอบ' : 'ดูแผนปุ๋ยทั้งรอบการผลิต'}
        </button>
        {showAllFert && (
          <div className="fert-all">
            {(fert.all && fert.all.length ? fert.all : fertilizerForAge(crop.id, 0, selMonth).all).map(function (f, i) {
              return (
                <div key={i} className="fert-line">
                  <div className="fert-line-when">{f.when}</div>
                  <div className="small">{f.formula} · <b>{f.rate}</b></div>
                  {f.altFormula && <div className="small muted">ทางเลือก: {f.altFormula} · {f.altRate}</div>}
                  <div className="small muted">{f.method}</div>
                </div>
              );
            })}
            <div className="small muted mt">หมายเหตุ {fert.note || fertilizerForAge(crop.id, 0, selMonth).note}</div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">
          ศัตรูพืชที่ต้องเฝ้าระวังในระยะนี้
          <span className="badge">{pests.length}</span>
        </div>
        <div className="stage-note small">
          แสดงตามวันที่เลือก {thaiDate(selected)} · อายุพืช {age} วัน ·
          ระยะ {selStage.afterHarvest ? 'สิ้นสุดรอบแล้ว' : selStage.beforeStart ? 'ยังไม่เริ่มรอบ' : selStage.stage.name}
        </div>
        {selStage.afterHarvest && <p className="muted small mt">สิ้นสุดรอบการผลิตแล้ว จึงไม่มีรายการเฝ้าระวัง</p>}
        {selStage.beforeStart && <p className="muted small mt">ยังไม่ถึงวันเริ่มรอบการผลิต</p>}
        {!selStage.afterHarvest && !selStage.beforeStart && pests.length === 0 && (
          <p className="muted small mt">ไม่มีข้อมูลศัตรูพืชสำหรับระยะนี้</p>
        )}

        {pests.map(function (p) {
          return (
            <div key={p.id} className={'pest-card pest-' + p.kind}>
              <div className="pest-head" onClick={function () { setOpenPest(openPest === p.id ? null : p.id); }}>
                <div className="flex1">
                  <span className="pest-tag">{p.kind === 'disease' ? 'โรคพืช' : 'แมลงศัตรูพืช'} · ความมั่นใจ {p.conf}</span>
                  <div className="pest-name">{p.name}</div>
                  <div className="small muted">{p.risk}</div>
                </div>
                <span className="chev">{openPest === p.id ? 'ปิด' : 'ดู'}</span>
              </div>
              {openPest === p.id && (
                <div className="pest-body">
                  <div className="sub-title">เกณฑ์แจ้งเตือน</div>
                  <p className="small">{p.rule}</p>
                  <div className="sub-title">ลักษณะการเข้าทำลาย</div>
                  <PestImage name={p.name} query={p.img} />
                  <div className="sub-title">การเฝ้าระวังและการจัดการ</div>
                  <ul className="actions">{p.act.map(function (x, i) { return <li key={i}>{x}</li>; })}</ul>
                  {p.chem && p.chem.length > 0 && (
                    <>
                      <div className="sub-title">กลุ่มสารและอัตราใช้</div>
                      <ul className="chem-list">{p.chem.map(function (c, i) { return <li key={i}>{c}</li>; })}</ul>
                      <div className="chem-warn">
                        ใช้เมื่อจำเป็นและเกินเกณฑ์เศรษฐกิจเท่านั้น สลับกลุ่มกลไกออกฤทธิ์ อ่านฉลากและเว้นระยะเก็บเกี่ยวทุกครั้ง
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="card-title">ไทม์ไลน์ระยะการเจริญเติบโต</div>
        <div className="small muted">สีของแต่ละจุดแสดงความคืบหน้าจริงตามความร้อนสะสม (GDD) ของระยะนั้น เทาเข้ม = ยังไม่เริ่ม ไล่ไปเหลือง-เขียวตามสัดส่วนที่สะสมได้แล้ว เขียวเข้ม = ผ่านระยะนั้นแล้ว</div>
        <div className="timeline">
          {derived.timeline.map(function (s) {
            const seg = (derived.segments || []).find(function (x) { return x.key === s.key; });
            const fill = seg ? seg.fillPct : (s.reached ? 100 : 0);
            return (
              <div key={s.key} className={'tl-item ' + (s.reached ? 'tl-done' : '') + (seg && seg.isNow ? ' tl-now' : '')}>
                <div className="tl-dot" style={{ background: gddColor(fill) }} />
                <div>
                  <div className="tl-name">{s.name}</div>
                  <div className="small muted">
                    {s.date ? thaiDate(s.date) + (s.reached ? '' : ' (คาดการณ์)') : '-'}
                    {seg && !s.reached ? ' · สะสมแล้ว ' + Math.round(fill) + '%' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="small muted mt">รอบการผลิตนี้สิ้นสุดวันที่ {thaiDate(endDate, true)}</div>
      </section>
    </>
  );
}