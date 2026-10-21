import React, { useState } from 'react';
import { openExternal } from '../lib/liff.js';

/**
 * แสดงภาพลักษณะการเข้าทำลาย
 * ถ้ามี url ในข้อมูลจะแสดงภาพ ถ้าไม่มีจะมีปุ่มเปิดคลังภาพอ้างอิงให้ดูเทียบ
 */
export default function PestImage({ name, query, urls }) {
  const [broken, setBroken] = useState({});
  const q = encodeURIComponent((query || name) + ' ลักษณะการเข้าทำลาย');
  const list = urls || [];

  return (
    <div className="pest-img-box">
      {list.length > 0 && (
        <div className="pest-img-row">
          {list.map(function (u, i) {
            if (broken[i]) return null;
            return (
              <img key={i} src={u} alt={name} className="pest-img"
                onError={function () { setBroken(Object.assign({}, broken, { [i]: true })); }} />
            );
          })}
        </div>
      )}
      <button className="btn btn-sm w-full" onClick={function () {
        openExternal('https://www.google.com/search?tbm=isch&q=' + q);
      }}>
        เปิดคลังภาพอ้างอิงลักษณะการเข้าทำลาย
      </button>
      <div className="small muted mt">
        ใช้ภาพเพื่อเทียบอาการเบื้องต้นเท่านั้น การวินิจฉัยที่แม่นยำต้องตรวจแปลงจริงหรือปรึกษาเจ้าหน้าที่
      </div>
    </div>
  );
}