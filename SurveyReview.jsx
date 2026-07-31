import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { C, RT, HC, HAZARDS, ST, SC, SL, useIsMobile, getMeas, dbGetPrices, dbSavePrices, cleanNumeric , plabel } from '../lib/shared.js';
import { PhotoNav } from './PhotoNav.jsx';

function CommentCell({ pin }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const stages = [
    { key: 'comment', label: 'To Repair', color: '#3b82f6', bg: '#eff6ff', val: pin.comment && pin.comment.trim() ? pin.comment.trim() : null },
    { key: 'fixingComment', label: 'In Progress', color: '#7c3aed', bg: '#f5f3ff', val: pin.fixingComment && pin.fixingComment.trim() ? pin.fixingComment.trim() : null },
    { key: 'doneComment', label: 'Done', color: '#16a34a', bg: '#f0fdf4', val: pin.doneComment && pin.doneComment.trim() ? pin.doneComment.trim() : null },
    { key: 'approvalComment', label: 'Client', color: '#dc2626', bg: '#fef2f2', val: pin.approvalComment && pin.approvalComment.trim() ? pin.approvalComment.trim() : null },
  ];
  const active = stages.filter(s => s.val && s.val.trim());
  if (!active.length) return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;
  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow > 200 ? r.bottom + 6 : r.top - 6;
      const left = Math.min(r.left, window.innerWidth - 310);
      setPos({ top, left, flipUp: spaceBelow <= 200 });
    }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={triggerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, cursor: 'pointer', alignItems: 'center' }} onClick={toggle}>
        {active.map(s => (<span key={s.key} style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 7px', borderRadius: 4, fontFamily: 'Barlow Condensed', letterSpacing: 0.3, border: '1px solid ' + s.color + '44', whiteSpace: 'nowrap' }}>{s.label}</span>))}
        <span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && ReactDOM.createPortal(
        <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', top: pos.flipUp ? undefined : pos.top, bottom: pos.flipUp ? (window.innerHeight - pos.top + 4) : undefined, left: pos.left, zIndex: 9999, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', minWidth: 240, maxWidth: 320, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', fontFamily: 'Barlow,sans-serif' }}>
          {active.map((s, i) => (<div key={s.key} style={{ marginBottom: i < active.length - 1 ? 10 : 0 }}><div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginBottom: 4, fontFamily: 'Barlow Condensed', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>{s.label.toUpperCase()}</div><div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', paddingLeft: 13 }}>{s.val}</div></div>))}
        </div>, document.body
      )}
    </div>
  );
}

export function SummaryTable({ project, onClose, user }) {
  const isMobile = useIsMobile();
  const [photoNav, setPhotoNav] = useState(null);
  const [filter, setFilter] = useState('all');
  const [prices, setPrices] = useState({});
  const canPrice = user.role === 'admin' || user.role === 'manager';
  useEffect(() => { dbGetPrices(project.id).then(p => setPrices(p || {})); }, [project.id]);
  const savePrice = async (name, val) => { const np = { ...prices, [name]: val }; setPrices(np); await dbSavePrices(project.id, np); };

  const allPins = project.elevations.flatMap(e => (e.pins || []).map(p => ({ ...p, _elev: e.name })));
  const types = [...new Set(allPins.map(p => p.repairType))].filter(Boolean);
  const filtered = filter === 'all' ? allPins : allPins.filter(p => p.repairType === filter);

  // Build pricing buckets — DECLINED pins are tracked separately so they don't pollute the total
  const totalsMap = {};
  const declinedMap = {};
  filtered.forEach(pin => {
    const r = RT.find(r => r.id === pin.repairType); if (!r) return;
    const key = pin.repairName + '__' + pin.repairType;
    const isDecl = pin.approval === 'declined';
    const target = isDecl ? declinedMap : totalsMap;
    if (!target[key]) target[key] = { repairName: pin.repairName, typeLabel: r.label, unit: r.unit, vals: [], count: 0 };
    target[key].count++;
    const num = parseFloat(r.calc(pin.measurements || {}));
    if (!isNaN(num) && num > 0) target[key].vals.push(num);
  });

  // Grand total only counts approved/pending — declined are excluded
  const grandTotal = Object.entries(totalsMap).reduce((s, [, v]) => { const q = v.vals.reduce((a, b) => a + b, 0); const p = parseFloat(prices[v.repairName] || 0); return s + q * p; }, 0);
  const declinedCount = filtered.filter(p => p.approval === 'declined').length;

  const TH = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', letterSpacing: 1, fontFamily: 'Barlow Condensed' };
  const TD = { padding: '9px 12px', fontSize: 12, borderBottom: '1px solid ' + C.border, verticalAlign: 'middle' };

  const MobilePinCard = ({ pin }) => {
    const allP = [...(pin.surveyPhotos || []), ...(pin.fixingPhotos || []), ...(pin.donePhotos || [])];
    const isDecl = pin.approval === 'declined';
    const sc = isDecl ? C.declined : (SC[pin.status] || C.textMuted);
    const hazColor = pin.hazard ? HC[pin.hazard] : '#6b7280';
    return (
      <div style={{ background: isDecl ? '#fef2f2' : C.card, border: '1px solid ' + (isDecl ? '#fecaca' : C.border), borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ background: isDecl ? C.declined : hazColor, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono', flexShrink: 0 }}>{pin.id}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: isDecl ? C.declined : C.navyDark, fontFamily: 'Barlow Condensed', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{pin.repairName || '—'}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono' }}>{(RT.find(r => r.id === pin.repairType) || { label: '—' }).label}</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
              <span style={{ fontSize: 11, color: C.blue, fontFamily: 'DM Mono', fontWeight: 600 }}>{getMeas(pin)}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: allP.length > 0 || pin.comment || pin.fixingComment || pin.doneComment || pin.approvalComment ? 8 : 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sc + '18', padding: '3px 8px', borderRadius: 6, fontFamily: 'Barlow Condensed', letterSpacing: 0.3 }}>{plabel(project, pin.status) || '—'}</span>
          {pin.hazard && <span style={{ fontSize: 10, fontWeight: 700, color: HC[pin.hazard], background: HC[pin.hazard] + '18', padding: '3px 8px', borderRadius: 6, fontFamily: 'Barlow Condensed', letterSpacing: 0.3 }}>{(HAZARDS.find(h => h.id === pin.hazard) || { label: '' }).label}</span>}
          {pin.approval && pin.approval !== 'pending' ?
            <span style={{ fontSize: 10, fontWeight: 700, color: pin.approval === 'approved' ? C.done : C.declined, background: (pin.approval === 'approved' ? C.done : C.declined) + '18', padding: '3px 8px', borderRadius: 6, fontFamily: 'Barlow Condensed', letterSpacing: 0.3 }}>{pin.approval === 'approved' ? '✓ Approved' : '✗ Declined'}</span>
            : <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, background: '#f3f4f6', padding: '3px 8px', borderRadius: 6, fontFamily: 'Barlow Condensed', letterSpacing: 0.3 }}>Pending review</span>
          }
        </div>
        {allP.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: (pin.comment || pin.fixingComment || pin.doneComment || pin.approvalComment) ? 8 : 0 }}>
            {allP.slice(0, 5).map((p, i) => (
              <div key={i} onClick={() => setPhotoNav({ photos: allP, startIdx: i })} style={{ width: 54, height: 42, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', border: '1px solid ' + C.border, flexShrink: 0 }}>
                <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
              </div>
            ))}
            {allP.length > 5 && <div onClick={() => setPhotoNav({ photos: allP, startIdx: 5 })} style={{ width: 54, height: 42, borderRadius: 5, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.blue, fontWeight: 700, cursor: 'pointer', background: C.blueDim, fontFamily: 'DM Mono' }}>+{allP.length - 5}</div>}
          </div>
        )}
        {(pin.comment || pin.fixingComment || pin.doneComment || pin.approvalComment) && (
          <div style={{ borderTop: '1px solid ' + C.border, paddingTop: 7, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pin.comment && <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 6px', borderRadius: 3, fontFamily: 'Barlow Condensed', letterSpacing: 0.3, marginRight: 5, border: '1px solid #3b82f644' }}>To Repair</span>{pin.comment}</div>}
            {pin.fixingComment && <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: 3, fontFamily: 'Barlow Condensed', letterSpacing: 0.3, marginRight: 5, border: '1px solid #7c3aed44' }}>In Progress</span>{pin.fixingComment}</div>}
            {pin.doneComment && <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: 3, fontFamily: 'Barlow Condensed', letterSpacing: 0.3, marginRight: 5, border: '1px solid #16a34a44' }}>Done</span>{pin.doneComment}</div>}
            {pin.approvalComment && <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 3, fontFamily: 'Barlow Condensed', letterSpacing: 0.3, marginRight: 5, border: '1px solid #dc262644' }}>Client</span>{pin.approvalComment}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: isMobile ? 0 : 16 }}>
      <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: isMobile ? '100%' : 1060, maxHeight: isMobile ? '100dvh' : '92vh', height: isMobile ? '100dvh' : 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: isMobile ? '12px 14px' : '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: C.navyDark, borderRadius: isMobile ? 0 : '14px 14px 0 0', paddingTop: isMobile ? 'calc(12px + env(safe-area-inset-top))' : undefined, gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: isMobile ? 16 : 20, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Quick Survey · {new Date().toLocaleDateString('en-NZ')}{!isMobile && (' · ' + user.name)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {grandTotal > 0 && canPrice && !isMobile && (
              <div style={{ padding: '6px 14px', background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: '#93c5fd', letterSpacing: 1.5, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>TOTAL ESTIMATE</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Barlow Condensed' }}>$ {grandTotal.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            )}
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer', maxWidth: isMobile ? 90 : 'none' }}>
              <option value="all" style={{ background: '#111' }}>All types</option>
              {types.map(t => <option key={t} value={t} style={{ background: '#111' }}>{(RT.find(r => r.id === t) || { label: t }).label}</option>)}
            </select>
            <button onClick={onClose} aria-label="Close summary" style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.5)', color: '#fca5a5', fontSize: 22, cursor: 'pointer', width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 14px' : '16px 20px', background: C.bg }}>
          {project.elevations.map((el, ei) => {
            const ePins = filtered.filter(p => p._elev === el.name); if (!ePins.length) return null;
            return (
              <div key={ei} style={{ marginBottom: isMobile ? 18 : 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navyDark, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Barlow Condensed' }}>
                  <span style={{ fontSize: 9, color: C.blue, background: C.blueDim, padding: '2px 8px', borderRadius: 4, letterSpacing: 1, border: '1px solid ' + C.blueBorder }}>ELEVATION</span>
                  {el.name}
                  <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono' }}>{ePins.length} pin{ePins.length !== 1 ? 's' : ''}</span>
                </div>
                {isMobile ? (
                  <div>{ePins.map(pin => <MobilePinCard key={pin.id} pin={pin}/>)}</div>
                ) : (
                  <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: C.navyDark }}>{['ID', 'Repair', 'Type', 'Measurement', 'Status', 'Hazard', 'Approval', 'Photos', 'Notes'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                      <tbody>
                        {ePins.map(pin => {
                          const allP = [...(pin.surveyPhotos || []), ...(pin.fixingPhotos || []), ...(pin.donePhotos || [])];
                          const isDecl = pin.approval === 'declined';
                          const sc = isDecl ? C.declined : (SC[pin.status] || C.textMuted);
                          return (
                            <tr key={pin.id} style={{ background: isDecl ? '#fef2f2' : 'transparent' }}>
                              <td style={TD}><div style={{ background: isDecl ? C.declined : (HC[pin.hazard] || '#6b7280'), borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono' }}>{pin.id}</div></td>
                              <td style={{ ...TD, fontWeight: 600, color: isDecl ? C.declined : C.navyDark, fontFamily: 'Barlow Condensed', fontSize: 13 }}>{pin.repairName || '—'}</td>
                              <td style={{ ...TD, fontFamily: 'DM Mono', color: C.textDim, fontSize: 11 }}>{(RT.find(r => r.id === pin.repairType) || { label: '—' }).label}</td>
                              <td style={{ ...TD, fontFamily: 'DM Mono', color: C.blue, fontSize: 11 }}>{getMeas(pin)}</td>
                              <td style={TD}><span style={{ fontSize: 10, fontWeight: 700, color: sc, background: sc + '18', padding: '2px 8px', borderRadius: 8, fontFamily: 'Barlow Condensed' }}>{plabel(project, pin.status) || '—'}</span></td>
                              <td style={TD}>{pin.hazard ? <span style={{ fontSize: 10, fontWeight: 700, color: HC[pin.hazard], background: HC[pin.hazard] + '18', padding: '2px 6px', borderRadius: 6 }}>{(HAZARDS.find(h => h.id === pin.hazard) || { label: '' }).label}</span> : <span style={{ color: C.textMuted }}>—</span>}</td>
                              <td style={TD}>{pin.approval && pin.approval !== 'pending' ? <span style={{ fontSize: 10, fontWeight: 700, color: pin.approval === 'approved' ? C.done : C.declined, background: (pin.approval === 'approved' ? C.done : C.declined) + '18', padding: '2px 6px', borderRadius: 6 }}>{pin.approval === 'approved' ? '✓ Approved' : '✗ Declined'}</span> : <span style={{ color: C.textMuted, fontSize: 10 }}>Pending</span>}</td>
                              <td style={TD}>{allP.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div onClick={() => setPhotoNav({ photos: allP, startIdx: 0 })} style={{ width: 40, height: 30, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: '1px solid ' + C.border, flexShrink: 0 }}>
                                    <img src={allP[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
                                  </div>
                                  {allP.length > 1 && <span onClick={() => setPhotoNav({ photos: allP, startIdx: 0 })} style={{ fontSize: 10, color: C.blue, cursor: 'pointer' }}>+{allP.length - 1}</span>}
                                </div>
                              ) : <span style={{ color: C.textMuted, fontSize: 11 }}>—</span>}</td>
                              <td style={{ ...TD, maxWidth: 180, minWidth: 120 }}><CommentCell pin={pin}/></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {(Object.keys(totalsMap).length > 0 || Object.keys(declinedMap).length > 0) && canPrice && (
            <div style={{ padding: '16px', background: C.card, border: '1px solid ' + C.border, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>QUANTITIES & PRICING</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                {Object.entries(totalsMap).map(([k, v]) => {
                  const qty = v.vals.reduce((a, b) => a + b, 0);
                  const price = parseFloat(prices[v.repairName] || '');
                  const subtotal = isNaN(price) ? 0 : qty * price;
                  return (
                    <div key={k} style={{ background: C.surface, borderRadius: 9, padding: '12px 14px', border: '1px solid ' + C.border }}>
                      <div style={{ fontSize: 13, color: C.navyDark, fontWeight: 700, fontFamily: 'Barlow Condensed', marginBottom: 1 }}>{v.repairName}</div>
                      <div style={{ fontSize: 9, color: C.textMuted, fontFamily: 'DM Mono', marginBottom: 8 }}>{v.typeLabel} · {v.count} item{v.count !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.blue, fontFamily: 'Barlow Condensed', marginBottom: 8 }}>{qty > 0 ? qty.toFixed(3) : 0} <span style={{ fontSize: 10, color: C.textMuted }}>{v.unit}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: C.textDim }}>$</span>
                        <input type="text" inputMode="decimal" placeholder="Price / unit" value={prices[v.repairName] || ''} onChange={e => savePrice(v.repairName, cleanNumeric(e.target.value))}
                          style={{ flex: 1, background: C.card, border: '1px solid ' + C.borderDark, borderRadius: 5, padding: '5px 7px', color: C.navyDark, fontSize: 12, outline: 'none', fontFamily: 'DM Mono' }}/>
                        <span style={{ fontSize: 9, color: C.textMuted }}>/{v.unit}</span>
                      </div>
                      {subtotal > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: C.navyDark, fontFamily: 'Barlow Condensed', marginTop: 6, paddingTop: 6, borderTop: '1px solid ' + C.border }}>= $ {subtotal.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                    </div>
                  );
                })}
              </div>
              {/* Show declined repairs separately — informational only, NOT counted in total */}
              {Object.keys(declinedMap).length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #fecaca' }}>
                  <div style={{ fontSize: 10, color: C.declined, letterSpacing: 1.5, marginBottom: 8, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>
                    ✗ DECLINED — NOT INCLUDED IN TOTAL ({declinedCount})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                    {Object.entries(declinedMap).map(([k, v]) => {
                      const qty = v.vals.reduce((a, b) => a + b, 0);
                      return (
                        <div key={k} style={{ background: '#fef2f2', borderRadius: 9, padding: '10px 12px', border: '1px solid #fecaca', opacity: 0.85 }}>
                          <div style={{ fontSize: 13, color: C.declined, fontWeight: 700, fontFamily: 'Barlow Condensed', marginBottom: 1, textDecoration: 'line-through', textDecorationColor: '#dc262666' }}>{v.repairName}</div>
                          <div style={{ fontSize: 9, color: '#dc262699', fontFamily: 'DM Mono', marginBottom: 4 }}>{v.typeLabel} · {v.count} declined item{v.count !== 1 ? 's' : ''}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.declined, fontFamily: 'Barlow Condensed', textDecoration: 'line-through', textDecorationColor: '#dc262666' }}>{qty > 0 ? qty.toFixed(3) : 0} <span style={{ fontSize: 9 }}>{v.unit}</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {grandTotal > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid ' + C.border, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 12, color: C.textDim }}>Grand total estimate{declinedCount > 0 ? ' (declined excluded)' : ''}</div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 30, fontWeight: 800, color: C.navyDark }}>$ {grandTotal.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              )}
            </div>
          )}
          {!filtered.length && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '40px' }}>No pins to show</div>}
        </div>
        {/* Mobile-only footer with grand total + always-visible close button */}
        {isMobile && (
          <div style={{ flexShrink: 0, borderTop: '1px solid ' + C.border, padding: '10px 14px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', background: C.navyDark, display: 'flex', alignItems: 'center', gap: 10 }}>
            {grandTotal > 0 && canPrice && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: '#93c5fd', letterSpacing: 1.5, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>TOTAL ESTIMATE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'Barlow Condensed' }}>$ {grandTotal.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            )}
            <button onClick={onClose} style={{ flex: grandTotal > 0 && canPrice ? 'none' : 1, padding: '12px 24px', background: C.blue, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>✓ DONE</button>
          </div>
        )}
      </div>
      {photoNav && <PhotoNav photos={photoNav.photos} initIdx={photoNav.startIdx} onClose={() => setPhotoNav(null)}/>}
    </div>
  );
}
