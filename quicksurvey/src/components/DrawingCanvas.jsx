import { useRef, useState, useEffect } from 'react';

// Draw on a photo before saving. Receives a Blob (or data URL string), returns a Blob with annotations.
export function DrawingCanvas({ imageSrc, onClose }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ff3b30');
  const [size, setSize] = useState(12);
  const [baseImage, setBaseImage] = useState(null);
  const [drawingData, setDrawingData] = useState([]);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const startRef = useRef(null);
  const lastRef = useRef(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const dataRef = useRef(drawingData);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { dataRef.current = drawingData; }, [drawingData]);

  useEffect(() => {
    if (!imageSrc) return;
    let url = null;
    let cleanup = false;

    const loadAndDraw = async (src) => {
      const img = new Image();
      img.onload = () => {
        if (cleanup) return;
        const c = canvasRef.current;
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setBaseImage(ctx.getImageData(0, 0, c.width, c.height));
        ctxRef.current = ctx;
      };
      img.src = src;
    };

    if (typeof imageSrc === 'string') {
      loadAndDraw(imageSrc);
    } else if (imageSrc instanceof Blob) {
      url = URL.createObjectURL(imageSrc);
      loadAndDraw(url);
    }
    return () => {
      cleanup = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageSrc]);

  const playback = d => {
    const ctx = ctxRef.current;
    ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = d.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (d.tool === 'pen') {
      ctx.beginPath();
      d.points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    } else if (d.tool === 'arrow') {
      const { x1, y1, x2, y2 } = d;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const ah = Math.max(15, d.size * 3), ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ah * Math.cos(ang - Math.PI / 6), y2 - ah * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - ah * Math.cos(ang + Math.PI / 6), y2 - ah * Math.sin(ang + Math.PI / 6));
      ctx.closePath(); ctx.fill();
    } else if (d.tool === 'rect') {
      ctx.strokeRect(Math.min(d.x1, d.x2), Math.min(d.y1, d.y2), Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1));
    }
  };

  const redraw = () => {
    const c = canvasRef.current;
    if (!c || !baseImage) return;
    const ctx = c.getContext('2d');
    ctx.putImageData(baseImage, 0, 0);
    dataRef.current.forEach(d => playback(d));
  };

  const getCoords = e => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    let cx, cy;
    if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else if (e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    else { cx = e.clientX; cy = e.clientY; }
    return { x: (cx - rect.left) * (c.width / rect.width), y: (cy - rect.top) * (c.height / rect.height) };
  };

  const startDraw = e => {
    if (e && e.preventDefault) e.preventDefault();
    const pos = getCoords(e);
    if (!pos) return;
    drawingRef.current = true;
    startRef.current = pos;
    lastRef.current = pos;
    if (toolRef.current === 'pen') {
      const stroke = { tool: 'pen', color: colorRef.current, size: sizeRef.current, points: [pos] };
      dataRef.current = [...dataRef.current, stroke];
      setDrawingData(dataRef.current);
    }
  };

  const moveDraw = e => {
    if (!drawingRef.current) return;
    if (e && e.preventDefault) e.preventDefault();
    const pos = getCoords(e);
    if (!pos) return;
    lastRef.current = pos;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (toolRef.current === 'pen') {
      ctx.strokeStyle = colorRef.current; ctx.lineWidth = sizeRef.current; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const stroke = dataRef.current[dataRef.current.length - 1];
      const prev = stroke.points[stroke.points.length - 1];
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      stroke.points.push(pos);
    } else {
      redraw();
      const s = startRef.current;
      ctx.strokeStyle = colorRef.current; ctx.fillStyle = colorRef.current; ctx.lineWidth = sizeRef.current; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (toolRef.current === 'arrow') {
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        const ah = Math.max(15, sizeRef.current * 3), ang = Math.atan2(pos.y - s.y, pos.x - s.x);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - ah * Math.cos(ang - Math.PI / 6), pos.y - ah * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(pos.x - ah * Math.cos(ang + Math.PI / 6), pos.y - ah * Math.sin(ang + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      } else if (toolRef.current === 'rect') {
        ctx.strokeRect(Math.min(s.x, pos.x), Math.min(s.y, pos.y), Math.abs(pos.x - s.x), Math.abs(pos.y - s.y));
      }
    }
  };

  const endDraw = e => {
    if (!drawingRef.current) return;
    if (e && e.preventDefault) e.preventDefault();
    drawingRef.current = false;
    const s = startRef.current;
    const l = lastRef.current;
    const t = toolRef.current;
    if (t === 'pen') {
      setDrawingData([...dataRef.current]);
    } else if (s && l && (t === 'arrow' || t === 'rect')) {
      if (Math.abs(l.x - s.x) > 2 || Math.abs(l.y - s.y) > 2) {
        const shape = { tool: t, color: colorRef.current, size: sizeRef.current, x1: s.x, y1: s.y, x2: l.x, y2: l.y };
        dataRef.current = [...dataRef.current, shape];
        setDrawingData(dataRef.current);
      } else {
        redraw();
      }
    }
    startRef.current = null;
    lastRef.current = null;
  };

  const undo = () => { dataRef.current = dataRef.current.slice(0, -1); setDrawingData(dataRef.current); redraw(); };
  const clear = () => {
    if (!confirm('Clear all drawings?')) return;
    dataRef.current = []; setDrawingData([]);
    const c = canvasRef.current;
    if (c && baseImage) c.getContext('2d').putImageData(baseImage, 0, 0);
  };
  const save = () => {
    const c = canvasRef.current;
    c.toBlob(blob => onClose(blob), 'image/jpeg', 0.72);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ts = e => startDraw(e);
    const tm = e => moveDraw(e);
    const te = e => endDraw(e);
    c.addEventListener('touchstart', ts, { passive: false });
    c.addEventListener('touchmove', tm, { passive: false });
    c.addEventListener('touchend', te, { passive: false });
    c.addEventListener('touchcancel', te, { passive: false });
    return () => {
      c.removeEventListener('touchstart', ts);
      c.removeEventListener('touchmove', tm);
      c.removeEventListener('touchend', te);
      c.removeEventListener('touchcancel', te);
    };
  }, [baseImage]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ padding: '12px 20px', background: '#111827', borderBottom: '1px solid #1e3a5f', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>✎ DRAW ON PHOTO</span>
        <button onClick={() => onClose(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer', padding: '4px 10px', minWidth: 40, minHeight: 40 }}>×</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflow: 'auto', width: '100%', touchAction: 'none' }}>
        <canvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
          style={{ maxWidth: '96vw', maxHeight: '68vh', border: '2px solid #1e3a5f', borderRadius: 8, cursor: tool === 'pen' ? 'crosshair' : 'default', display: 'block', touchAction: 'none' }}/>
      </div>
      <div style={{ padding: '10px 12px', background: '#111827', borderTop: '1px solid #1e3a5f', width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {['pen', 'arrow', 'rect'].map(t => (
            <button key={t} onClick={() => setTool(t)} style={{ padding: '8px 12px', borderRadius: 5, border: '1px solid ' + (tool === t ? '#2563eb' : '#1e3a5f'), background: tool === t ? '#2563eb22' : 'transparent', color: tool === t ? '#2563eb' : '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: tool === t ? 700 : 400, fontFamily: 'Barlow Condensed', minHeight: 36 }}>
              {t === 'pen' ? '✏ Pen' : t === 'arrow' ? '→ Arrow' : '▢ Rect'}
            </button>
          ))}
          <div style={{ width: 32, height: 36, borderRadius: 4, border: '2px solid ' + color, background: color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono' }}>Size</span>
            <input type="range" min="1" max="20" value={size} onChange={e => setSize(parseInt(e.target.value))} style={{ width: 70, height: 20, cursor: 'pointer' }}/>
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'DM Mono', minWidth: 16 }}>{size}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={undo} style={{ padding: '8px 12px', borderRadius: 5, border: '1px solid #475569', background: 'transparent', color: '#64748b', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow Condensed', minHeight: 36 }}>↶ UNDO</button>
          <button onClick={clear} style={{ padding: '8px 12px', borderRadius: 5, border: '1px solid #ef444444', background: 'transparent', color: '#ef444488', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow Condensed', minHeight: 36 }}>✕ CLEAR</button>
          <button onClick={save} style={{ padding: '8px 16px', borderRadius: 5, border: '1px solid #22c55e', background: '#22c55e22', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', minHeight: 36 }}>✓ SAVE</button>
        </div>
      </div>
    </div>
  );
}
