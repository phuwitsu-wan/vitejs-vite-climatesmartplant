import React from 'react';
import { openExternal } from '../lib/liff.js';

const FB_URL = 'https://www.facebook.com/xarakkha.phuch.phechrburn?locale=th_TH';

export default function About() {
  return (
    <>
      <section className="card about-card">
        <div className="card-title">เกี่ยวกับเรา</div>
        <p className="about-text">
          ข้อมูลหลักในแอปพลิเคชันนี้ ได้มาจากการรวบรวมข้อมูลเอกสารงานวิจัยและจากข้อมูลแหล่งอ้างอิงที่เชื่อถือได้
          ผลสัมฤทธิ์ของการใช้งานอาจมีความแตกต่างกันไปตามสภาพแวดล้อม
          ซึ่งผู้ใช้งานต้องปรับใช้ให้เหมาะสมกับสภาพพื้นที่จริงด้วย
        </p>
        <p className="about-text">
          การจัดทำแอปพลิเคชันนี้ โดยกลุ่มอารักขาพืช สำนักงานเกษตรจังหวัดเพชรบูรณ์
          จัดทำเพื่อประโยชน์ทางวิชาการ เกษตรกร และผู้ที่สนใจ
        </p>
      </section>

      <section className="card">
        <div className="card-title">ติดต่อเรา</div>
        <p className="small muted">
          ติดตามข่าวสารการระบาดของศัตรูพืชและสอบถามข้อมูลเพิ่มเติมได้ที่เพจ
          กลุ่มอารักขาพืช สำนักงานเกษตรจังหวัดเพชรบูรณ์
        </p>
        <button className="btn btn-fb w-full mt" onClick={function () { openExternal(FB_URL); }}>
          เปิดเพจเฟซบุ๊ก กลุ่มอารักขาพืช เพชรบูรณ์
        </button>
      </section>
    </>
  );
}