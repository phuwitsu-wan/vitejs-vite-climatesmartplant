import React from 'react';

/**
 * หลอดสถานะที่มีช่องแบ่งแต่ละระยะการเจริญเติบโต
 * รับ segments ตรงจาก stageSegments() ในรูปแบบ { key, name, widthPct, fillPct, isNow }
 * widthPct = สัดส่วนความกว้างของระยะนั้นเทียบกับทั้งแถบ, fillPct = ระยะนั้นเติมไปแล้วกี่เปอร์เซ็นต์
 */
export default function StageBar({ segments }) {
  if (!segments || !segments.length) return null;

  // ตำแหน่งหมุดบอกจุดปัจจุบัน = ผลรวมความกว้างแต่ละช่วงคูณสัดส่วนที่เติมแล้วของช่วงนั้น
  const markerPct = segments.reduce(function (acc, s) {
    return acc + s.widthPct * (s.fillPct / 100);
  }, 0);

  return (
    <div className="stagebar">
      <div className="sb-track">
        {segments.map(function (s, i) {
          return (
            <div key={s.key} className={'sb-seg ' + (s.isNow ? 'sb-now' : '')}
              style={{ width: s.widthPct + '%' }} title={s.name}>
              <div className="sb-fill" style={{ width: s.fillPct + '%' }} />
              {i > 0 ? <span className="sb-divider" /> : null}
            </div>
          );
        })}
        <div className="sb-marker" style={{ left: markerPct + '%' }} />
      </div>
      <div className="sb-labels">
        {segments.map(function (s) {
          return (
            <div key={s.key} className={'sb-label ' + (s.isNow ? 'sb-label-now' : '')}
              style={{ width: s.widthPct + '%' }}>
              <span>{s.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}