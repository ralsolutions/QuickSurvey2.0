import { useState } from 'react';

export function PhotoNav({ photos, initIdx = 0, onClose }) {
  const [idx, setIdx] = useState(Math.min(initIdx, photos.length - 1));
  if (!photos.length) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: '96vw' }}>
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid #2563eb44', borderRadius: '50%', color: idx === 0 ? '#333' : '#fff', width: 46, height: 46, fontSize: 22, cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <img src={photos[idx]} style={{ maxWidth: '78vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} alt=""/>
          <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>{idx + 1} / {photos.length}</div>
        </div>
        <button onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))} disabled={idx === photos.length - 1} style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid #2563eb44', borderRadius: '50%', color: idx === photos.length - 1 ? '#333' : '#fff', width: 46, height: 46, fontSize: 22, cursor: idx === photos.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
      </div>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(37,99,235,0.2)', border: '1px solid #2563eb44', borderRadius: '50%', color: '#fff', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
    </div>
  );
}
