import React from 'react';

// กันไม่ให้ error ที่ยังไม่คาดคิดในอนาคตทำให้ทั้งแอปขึ้นเป็นจอขาว
// ถ้ามีอะไรพังระหว่างแสดงผล จะเห็นการ์ดนี้แทน พร้อมปุ่มลองใหม่
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="boot" style={{ padding: 20, textAlign: 'center' }}>
          <div className="boot-logo">{'\u26A0\uFE0F'}</div>
          <p><b>เกิดข้อผิดพลาดในหน้านี้</b></p>
          <p className="small muted" style={{ maxWidth: 420, margin: '8px auto' }}>
            {String(this.state.error.message || this.state.error)}
          </p>
          <button className="btn btn-primary mt" onClick={function () { window.location.reload(); }}>
            โหลดแอปใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
