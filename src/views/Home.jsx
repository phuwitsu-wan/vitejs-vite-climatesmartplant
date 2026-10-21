import React, { useState } from 'react';
import { TASK_META } from '../data/crops.js';
import { thaiDate, relativeLabel, today, diffDays } from '../lib/date.js';
import { weatherIcon } from '../lib/weather.js';
import { shareText } from '../lib/liff.js';
import { RULE_SOURCE } from '../data/alertRules.js';
import { notifySupported, notifyStatus, requestNotify, notifyEnabled, setNotifyEnabled, testNotify } from '../lib/notify.js';
import WaterChart from './WaterChart.jsx';
import StageBar from './StageBar.jsx';
import PestImage from './PestImage.jsx';
import About from './About.jsx';

export default function Home({ plot, weather, derived, loading, error, onRefresh, onLog, soil, soilAdvice, soilLoading, soilError, onLoadSoil }) {
  const [open, setOpen] = useState(null);
  const [showWatch, setShowWatch] = useState(false);
  const [showWaterTable, setShowWaterTable] = useState(false);
  const [showSoil, setShowSoil] = useState(false);
  const [notifyOn, setNotifyOnState] = useState(notifyEnabled());

  if (!plot) return <div className="card">ยังไม่ได้เลือกแปลง</div>;
  if (loading && !derived) return <div className="card skeleton">กำลังประมวลผลสภาพอากาศของแปลง</div>;
  if (error) {
    return (<div className="card"><p className="warn">{error}</p><button className="btn" onClick={onRefresh}>ลองใหม่</button></div>);
  }
  if (!derived) return <div className="card skeleton">กำลังโหลด</div>;

  const crop = derived.crop;
  const stageInfo = derived.stageInfo;
  const alerts = derived.alerts;
  const water = derived.water;
  const t = today();
  const series = weather.series;
  const todayRow = series.filter(function (r) { return r.date === t; })[0];
  const next7 = series.filter(function (r) { return r.date >= t; }).slice(0, 7);
  const dap = diffDays(plot.plantedAt, t);
  const cycleProgress = stageInfo.afterHarvest ? 100 : Math.round(
    (derived.segments || []).reduce(function (acc, s) { return acc + s.widthPct * (s.fillPct / 100); }, 0)
  );

  const upcoming = derived.tasks.filter(function (x) {
    const d = diffDays(t, x.date);
    return !x.done && d >= -7 && d <= 10;
  }).slice(0, 8);

  const main = alerts.filter(function (a) { return a.level !== 'watch'; });
  const watch = alerts.filter(function (a) { return a.level === 'watch'; });

  const quickLog = function (type) {
    onLog({ plotId: plot.id, type: type, date: t, note: 'บันทึกจากหน้าหลัก' });
    window.alert('บันทึกกิจกรรมเรียบร้อย');
  };

  const toggleNotify = async function () {
    if (!notifySupported()) { window.alert('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'); return; }
    if (notifyStatus() !== 'granted') {
      const p = await requestNotify();
      if (p !== 'granted') { window.alert('ยังไม่ได้รับอนุญาตให้แจ้งเตือน กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์'); return; }
      setNotifyOnState(true);
      return;
    }
    const next = !notifyOn;
    setNotifyEnabled(next);
    setNotifyOnState(next);
  };

  const shareAlert = function (a) {
    const L = [];
    L.push('[' + a.levelLabel + '] ' + a.name);
    L.push('แปลง ' + plot.name + ' พืช ' + crop.name + ' ระยะ ' + stageInfo.stage.name);
    L.push('สถานะ ' + a.progress);
    L.push('เงื่อนไขเสี่ยง ' + a.risk);
    L.push('สิ่งที่ควรทำ');
    for (let i = 0; i < a.act.length; i++) L.push(' - ' + a.act[i]);
    shareText(L.join('\n'));
  };

  const renderAlert = function (a) {
    return (
      <div key={a.id} className={'alert alert-' + a.level}>
        <div className="alert-head" onClick={function () { setOpen(open === a.id ? null : a.id); }}>
          <div className="flex1">
            <div className="alert-tag">{a.levelLabel} · {a.kind === 'disease' ? 'โรคพืช' : 'แมลงศัตรูพืช'} · {a.triggerLabel}</div>
            <div className="alert-name">{a.name}</div>
            <div className="alert-progress">{a.progress}</div>
          </div>
          <span className="chev">{open === a.id ? 'ปิด' : 'ดู'}</span>
        </div>
        {open === a.id && (
          <div className="alert-detail">
            <div className="sub-title">เงื่อนไขเสี่ยง</div>
            <p className="small">{a.risk}</p>
            <div className="sub-title">เกณฑ์แจ้งเตือน</div>
            <p className="small">{a.rule}</p>
            <div className="sub-title">ข้อมูลที่ตรวจพบ</div>
            <ul className="evidence">{a.evidence.map(function (e, i) { return <li key={i}>{e}</li>; })}</ul>
            <div className="sub-title">ลักษณะการเข้าทำลาย</div>
            <PestImage name={a.name} query={a.img} />
            <div className="sub-title">สิ่งที่ควรทำ</div>
            <ul className="actions">{a.act.map(function (x, i) { return <li key={i}>{x}</li>; })}</ul>
            {a.chem.length > 0 && (
              <>
                <div className="sub-title">กลุ่มสารและอัตราใช้</div>
                <ul className="chem-list">{a.chem.map(function (c, i) { return <li key={i}>{c}</li>; })}</ul>
                <div className="chem-warn">
                  ใช้สารเคมีเมื่อจำเป็นและเกินเกณฑ์เศรษฐกิจเท่านั้น สลับกลุ่มกลไกออกฤทธิ์
                  อ่านฉลากและเว้นระยะเก็บเกี่ยวทุกครั้ง
                </div>
              </>
            )}
            <div className="row gap mt">
              <button className="btn btn-sm" onClick={function () { shareAlert(a); }}>ส่งเข้าไลน์</button>
              <button className="btn btn-sm btn-ghost" onClick={function () { quickLog('scout'); }}>บันทึกว่าสำรวจแล้ว</button>
            </div>
            <div className="small muted mt">ระดับความมั่นใจของเกณฑ์ {a.conf} ({a.confLabel})</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <section className="card hero">
        <div className="hero-top">
          <div>
            <div className="hero-crop">{crop.emoji} {plot.name}</div>
            <div className="muted small">
              {crop.name} · {plot.areaRai || '-'} ไร่ · {plot.locationName || plot.lat.toFixed(3) + ', ' + plot.lon.toFixed(3)}
              {crop.waterModes ? ' · ' + (plot.waterMode === 'rainfed' ? 'นอกเขตชลประทาน' : 'ในเขตชลประทาน') : ''}
            </div>
          </div>
          <button className="icon-btn" onClick={onRefresh}>รีเฟรช</button>
        </div>

        <div className="stage-row">
          <div>
            <div className="small muted">ระยะปัจจุบัน</div>
            <div className="stage-name">{stageInfo.afterHarvest ? 'สิ้นสุดรอบการผลิตแล้ว' : stageInfo.stage.name}</div>
          </div>
          <div className="stage-num">
            <div className="stage-gdd">{stageInfo.gdd}</div>
            <div className="small muted">GDD สะสม</div>
          </div>
        </div>

        <StageBar segments={derived.segments} />

        <div className="small muted mt">
          อายุพืช {dap} วัน คิดเป็น {cycleProgress}% ของรอบการผลิต
          {stageInfo.afterHarvest ? ' · เก็บเกี่ยวครบรอบแล้ว' : (stageInfo.next ? ' · ระยะถัดไป ' + stageInfo.next.name : '')}
        </div>

        {!stageInfo.afterHarvest && derived.endDate && (
          <div className="harvest-forecast mt">
            <span className="small muted">คาดว่าจะเก็บเกี่ยวได้ประมาณ</span>
            <b>{thaiDate(derived.endDate)}</b>
            <span className="small muted">
              {' '}(อีกประมาณ {Math.max(0, diffDays(t, derived.endDate))} วัน)
            </span>
            <div className="small muted">
              คำนวณจากความร้อนสะสม (GDD) ถึงปัจจุบัน และคาดการณ์ล่วงหน้าด้วยอัตราสะสมเฉลี่ย 14 วันล่าสุดในช่วงที่ยังไม่มีข้อมูลพยากรณ์อากาศจริง
              วันที่จึงเป็นค่าประมาณ ปรับได้เองตามสภาพแปลงจริง
            </div>
          </div>
        )}

      </section>

      <section className="card">
        <div className="card-title">สภาพอากาศแปลงนี้</div>
        {todayRow && (
          <div className="wx-now">
            <div className="wx-icon">{weatherIcon(todayRow)}</div>
            <div className="wx-metrics">
              <div><b>{Math.round(todayRow.tmin)} – {Math.round(todayRow.tmax)}</b><span className="small muted"> องศา</span></div>
              <div><b>{(todayRow.rain || 0).toFixed(1)} มม.</b><span className="small muted"> ฝนวันนี้</span></div>
              <div><b>{todayRow.rhMean === undefined ? '-' : todayRow.rhMean}%</b><span className="small muted"> ความชื้น</span></div>
              <div><b>{todayRow.rhNight === undefined ? '-' : todayRow.rhNight}%</b><span className="small muted"> กลางคืน</span></div>
            </div>
          </div>
        )}
        <div className="wx-strip">
          {next7.map(function (r) {
            return (
              <div key={r.date} className="wx-day">
                <div className="small muted">{r.date === t ? 'วันนี้' : new Date(r.date + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short' })}</div>
                <div className="wx-day-icon">{weatherIcon(r)}</div>
                <div className="small"><b>{Math.round(r.tmax)}</b>/{Math.round(r.tmin)}</div>
                <div className="small rain">{(r.rain || 0).toFixed(0)} มม.</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── ข้อมูลดินตามพิกัดแปลง ───── */}
      <section className="card">
        <div className="card-title">ข้อมูลดินของแปลง</div>
        {!soil && !soilLoading && (
          <>
            <p className="small muted">
              ระบบสามารถดึงข้อมูลเนื้อดิน ความเป็นกรดด่าง และอินทรียวัตถุจากพิกัดแปลงนี้
              เพื่อนำมาปรับคำแนะนำการใส่ปุ๋ย การให้น้ำ และการอารักขาพืชให้เหมาะกับสภาพดินจริง
            </p>
            <button className="btn btn-primary w-full mt" onClick={onLoadSoil}>ดึงข้อมูลดินจากพิกัดแปลง</button>
          </>
        )}
        {soilLoading && <p className="small muted">กำลังดึงข้อมูลดิน...</p>}
        {soilError && <p className="warn small">{soilError}</p>}

        {soil && (
          <>
            <div className="soil-head">
              <div>
                <div className="soil-name">{soil.textureName}</div>
                <div className="small muted">{soil.drain} · {soil.hold}</div>
              </div>
              <div className="soil-badge">{'\u{1F9F1}'}</div>
            </div>
            <div className="soil-grid">
              <div className="sg"><b>{soil.sand}%</b><span>ทราย</span></div>
              <div className="sg"><b>{soil.silt}%</b><span>ทรายแป้ง</span></div>
              <div className="sg"><b>{soil.clay}%</b><span>ดินเหนียว</span></div>
              <div className="sg"><b>{soil.ph === null ? '-' : soil.ph}</b><span>pH</span></div>
              <div className="sg"><b>{soil.om === null ? '-' : soil.om + '%'}</b><span>อินทรียวัตถุ</span></div>
              <div className="sg"><b>{soil.awc}</b><span>อุ้มน้ำ มม./ม.</span></div>
            </div>

            {soilAdvice && soilAdvice.ph && (
              <div className={'soil-advice sa-' + soilAdvice.ph.level}>{soilAdvice.ph.text}</div>
            )}
            {soilAdvice && soilAdvice.om && (
              <div className={'soil-advice sa-' + soilAdvice.om.level}>{soilAdvice.om.text}</div>
            )}

            <button className="btn btn-sm w-full mt" onClick={function () { setShowSoil(!showSoil); }}>
              {showSoil ? 'ซ่อนคำแนะนำการจัดการตามสภาพดิน' : 'ดูคำแนะนำการจัดการตามสภาพดิน'}
            </button>
            {showSoil && soilAdvice && (
              <div className="mt">
                {soilAdvice.manage.map(function (m, i) {
                  return (
                    <div key={i} className="soil-manage">
                      <b className="small">{m.topic}</b>
                      <div className="small">{m.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="small muted mt">แหล่งข้อมูล {soil.source}</div>
          </>
        )}
      </section>

      {/* ───── การจัดการน้ำ ───── */}
      {water && water.summary && (
        <section className="card">
          <div className="card-title">การจัดการน้ำ ฝนเทียบกับความต้องการน้ำของพืช</div>
          <WaterChart water={water} />
          <div className={'water-advice wa-' + water.summary.level}>
            <b className="small">
              {water.summary.level === 'high' ? 'ต้องให้น้ำเสริม'
                : water.summary.level === 'warn' ? 'เริ่มขาดน้ำ'
                  : water.summary.level === 'ok' ? 'สมดุลน้ำเหมาะสม'
                    : water.summary.level === 'wet' ? 'น้ำเกินความต้องการ' : 'สิ้นสุดรอบการผลิต'}
            </b>
            <div className="small">{water.summary.advice}</div>
          </div>

          {water.summary.level !== 'done' && (
            <>
              <div className="water-kpi">
                <div className="wk"><b>{water.summary.rainSum}</b><span>ฝนใช้ได้ {water.summary.days} วันหน้า (มม.)</span></div>
                <div className="wk"><b>{water.summary.etcSum}</b><span>พืชต้องการ (มม.)</span></div>
                <div className="wk"><b>{water.summary.deficit > 0 ? '-' + water.summary.deficit : '+' + Math.abs(water.summary.deficit)}</b><span>สมดุลน้ำ (มม.)</span></div>
                <div className="wk"><b>{water.summary.kcNow}</b><span>Kc ระยะ{water.summary.stageName}</span></div>
              </div>
              <button className="btn btn-sm w-full mt" onClick={function () { setShowWaterTable(!showWaterTable); }}>
                {showWaterTable ? 'ซ่อนตารางรายวัน' : 'ดูตารางสมดุลน้ำรายวัน'}
              </button>
              {showWaterTable && (
                <div className="tbl-wrap mt">
                  <table className="grid-table">
                    <thead><tr><th>วันที่</th><th>ระยะ</th><th>ฝน</th><th>ใช้ได้</th><th>ETc</th><th>สมดุล</th></tr></thead>
                    <tbody>
                      {water.rows.map(function (r) {
                        return (
                          <tr key={r.date} className={r.isToday ? 'row-today' : (r.isPast ? '' : 'row-fc')}>
                            <td>{r.date.slice(5)}</td>
                            <td>{r.stageName}</td>
                            <td>{r.rain.toFixed(1)}</td>
                            <td>{r.effRain.toFixed(1)}</td>
                            <td>{r.etc === null ? '-' : r.etc.toFixed(1)}</td>
                            <td className={r.net === null ? '' : (r.net < 0 ? 'neg' : 'pos')}>{r.net === null ? '-' : r.net.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="small muted mt">
            ETc เท่ากับ ET0 คูณสัมประสิทธิ์พืช Kc ที่เปลี่ยนตามระยะการเจริญเติบโตตามมาตรฐาน FAO-56
            ฝนที่พืชใช้ได้จริงคิดที่ {water.summary.effFactor || 80} เปอร์เซ็นต์ ปรับตามเนื้อดินของแปลง
            ข้อมูลอากาศจาก Open-Meteo ที่พิกัดแปลงนี้
          </div>
        </section>
      )}

      {/* ───── แจ้งเตือน ───── */}
      <section className="card">
        <div className="card-title">
          การแจ้งเตือนโรคและแมลง
          <span className="badge">{alerts.length}</span>
        </div>

        <div className="notify-row">
          <div className="flex1">
            <b className="small">แจ้งเตือนผ่านเบราว์เซอร์</b>
            <div className="small muted">
              เปิดไว้เพื่อให้ระบบส่งแจ้งเตือนขึ้นหน้าจอทันทีเมื่อมีโรคหรือแมลงเข้าเกณฑ์เฝ้าระวัง
            </div>
          </div>
          <button className={'toggle ' + (notifyOn ? 'toggle-on' : '')} onClick={toggleNotify}>
            {notifyOn ? 'เปิดอยู่' : 'ปิดอยู่'}
          </button>
        </div>
        {notifyOn && (
          <button className="btn btn-sm w-full mt" onClick={function () {
            if (!testNotify()) window.alert('ส่งการแจ้งเตือนไม่สำเร็จ');
          }}>ทดสอบการแจ้งเตือน</button>
        )}

        {stageInfo.afterHarvest && (
          <p className="ok-msg mt">สิ้นสุดรอบการผลิตแล้ว ระบบจึงหยุดแจ้งเตือนศัตรูพืชสำหรับแปลงนี้</p>
        )}
        {!stageInfo.afterHarvest && alerts.length === 0 && (
          <p className="ok-msg mt">ยังไม่พบสภาพอากาศที่เข้าเกณฑ์เสี่ยงในขณะนี้ อย่าลืมสำรวจแปลงตามรอบปกติ</p>
        )}

        <div className="mt">{main.map(renderAlert)}</div>

        {watch.length > 0 && (
          <>
            <button className="btn btn-sm w-full mt" onClick={function () { setShowWatch(!showWatch); }}>
              {showWatch ? 'ซ่อนรายการเริ่มเข้าเงื่อนไข' : 'ดูรายการเริ่มเข้าเงื่อนไข ' + watch.length + ' รายการ'}
            </button>
            {showWatch && watch.map(renderAlert)}
          </>
        )}

        <div className="small muted mt">ที่มาของเกณฑ์ {RULE_SOURCE}</div>
      </section>

      <section className="card">
        <div className="card-title">งานในแปลง 10 วันข้างหน้า</div>
        {upcoming.length === 0 && <p className="muted small">ไม่มีงานที่กำหนดไว้ในช่วงนี้</p>}
        {upcoming.map(function (x) {
          const meta = TASK_META[x.type] || { label: x.type, emoji: '', color: '#888' };
          const overdue = diffDays(t, x.date) < 0;
          return (
            <div key={x.key} className={'task ' + (overdue ? 'task-past' : '')}>
              <div className="task-icon" style={{ background: meta.color + '1A', color: meta.color }}>{meta.emoji}</div>
              <div className="task-body">
                <div className="task-title">{x.title}</div>
                <div className="small muted">{thaiDate(x.date)} · {relativeLabel(x.date)}{x.estimated ? ' (คาดการณ์)' : ''}</div>
                {x.detail ? <div className="small">{x.detail}</div> : null}
                {x.reason ? <div className="small shift-note">{x.reason}</div> : null}
              </div>
              <button className="btn btn-xs" onClick={function () { quickLog(x.type); }}>ทำแล้ว</button>
            </div>
          );
        })}
      </section>

      <About />
    </>
  );
}