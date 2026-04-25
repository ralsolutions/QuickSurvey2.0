import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { C, RT, HC, HAZARDS, ST, SC, SL } from '../lib/constants.js';
import { fmtDate, getMeas, useDebouncedCallback } from '../lib/helpers.js';
import { dbGetPrices, dbSavePrices } from '../lib/db.js';
import { PhotoImg } from './PhotoImg.jsx';
import { PhotoNav } from './PhotoNav.jsx';

// Mobile card-style row
function MobilePinCard({ pin, price, onPriceChange, onPhotoNav, isClient }) {
  const [open, setOpen] = useState(false);
  const surveyIds = pin.surveyPhotoIds || [];
  const fixingIds = pin.fixingPhotoIds || [];
  const doneIds = pin.donePhotoIds || [];
  const allIds = [...surveyIds, ...fixingIds, ...doneIds];
  const legacyAll = [...(pin.surveyPhotos || []), ...(pin.fixingPhotos || []), ...(pin.donePhotos || [])];
  const hasPhotos = allIds.length > 0 || legacyAll.length > 0;
  const meas = parseFloat(getMeas(pin)) || 0;
  const total = price && meas ? (price * meas).toFixed(2) : '—';
  const isDecl = pin.approval === 'declined';

  return (
    <div style={{ background: C.card, border: '1px solid ' + (isDecl ? '#fecaca' : C.border), borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ background: isDecl ? C.declined : (HC[pin.hazard] || '#6b7280'), borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono', flexShrink: 0 }}>{pin.id}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isDecl ? C.declined : C.navyDark, fontFamily: 'Barlow Condensed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.repairName}</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono' }}>{pin._elev} · {getMeas(pin)} · {SL[pin.status]}</div>
        </div>
        <div style={{ fontSize: 11, color: SC[pin.status] || C.textDim, fontWeight: 700, flexShrink: 0 }}>{open ? '▴' : '▾'}</div>
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid ' + C.border }}>
          {!isClient && pin.repairType !== 'other' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.2, fontWeight: 700, fontFamily: 'Barlow Condensed' }}>UNIT PRICE</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: C.textDim }}>$</span>
                <input type="number" min="0" step="0.01" value={price || ''} onChange={e => onPriceChange(parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ flex: 1, background: C.surface, border: '1px solid ' + C.border, borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', fontFamily: 'DM Mono' }}/>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DM Mono' }}>/ {(RT.find(r => r.id === pin.repairType) || {}).unit}</span>
              </div>
              <div style={{ fontSize: 11, color: total !== '—' ? C.blue : C.textMuted, fontWeight: 700, marginTop: 4, fontFamily: 'DM Mono' }}>= ${total}</div>
            </div>
          )}
          {pin.comment && <div style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic', marginBottom: 6 }}>"{pin.comment}"</div>}
          {hasPhotos && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allIds.map((id, i) => (
                <div key={id} onClick={() => onPhotoNav({ ids: allIds, startIdx: i })} style={{ width: 44, height: 34, borderRadius: 4, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                  <PhotoImg photoId={id} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                </div>
              ))}
              {allIds.length === 0 && legacyAll.map((p, i) => (
                <div key={i} onClick={() => onPhotoNav({ urls: legacyAll, startIdx: i })} style={{ width: 44, height: 34, borderRadius: 4, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                  <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Desktop full table row
function DesktopPinRow({ pin, price, onPriceChange, onPhotoNav, isClient }) {
  const surveyIds = pin.surveyPhotoIds || [];
  const fixingIds = pin.fixingPhotoIds || [];
  const doneIds = pin.donePhotoIds || [];
  const allIds = [...surveyIds, ...fixingIds, ...doneIds];
  const legacyAll = [...(pin.surveyPhotos || []), ...(pin.fixingPhotos || []), ...(pin.donePhotos || [])];
  const meas = parseFloat(getMeas(pin)) || 0;
  const total = price && meas ? (price * meas).toFixed(2) : '—';
  const isDecl = pin.approval === 'declined';
  const isOther = pin.repairType === 'other';

  return (
    <tr style={{ borderBottom: '1px solid ' + C.border, background: isDecl ? '#fef2f211' : 'transparent' }}>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', width: 36 }}>
        <div style={{ background: isDecl ? C.declined : (HC[pin.hazard] || '#6b7280'), borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono' }}>{pin.id}</div>
      </td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isDecl ? C.declined : C.navyDark, fontFamily: 'Barlow Condensed' }}>{pin.repairName}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{pin._elev}</div>
        {pin.comment && <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', marginTop: 2 }}>"{pin.comment.length > 40 ? pin.comment.slice(0, 40) + '...' : pin.comment}"</div>}
      </td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', fontSize: 11, color: C.textDim, fontFamily: 'DM Mono' }}>{(RT.find(r => r.id === pin.repairType) || {}).label}</td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', fontSize: 11, color: C.blue, fontFamily: 'DM Mono', fontWeight: 600 }}>{getMeas(pin)}</td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', width: 110 }}>
        {!isClient && !isOther ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 11, color: C.textDim }}>$</span>
            <input type="number" min="0" step="0.01" value={price || ''} onChange={e => onPriceChange(parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ width: 70, background: C.surface, border: '1px solid ' + C.border, borderRadius: 4, padding: '3px 6px', fontSize: 11, outline: 'none', fontFamily: 'DM Mono' }}/>
          </div>
        ) : <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'DM Mono' }}>{price ? '$' + price : '—'}</span>}
      </td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', fontSize: 12, color: total !== '—' ? C.blue : C.textMuted, fontWeight: 700, fontFamily: 'DM Mono' }}>${total}</td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top', width: 70 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: SC[pin.status], background: (SC[pin.status] || C.border) + '22', padding: '2px 6px', borderRadius: 4, letterSpacing: 1 }}>{SL[pin.status]}</span>
      </td>
      <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
        {(allIds.length > 0 || legacyAll.length > 0) && (
          <div style={{ display: 'flex', gap: 3 }}>
            {allIds.slice(0, 3).map((id, i) => (
              <div key={id} onClick={() => onPhotoNav({ ids: allIds, startIdx: i })} style={{ width: 32, height: 24, borderRadius: 3, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                <PhotoImg photoId={id} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            ))}
            {allIds.length === 0 && legacyAll.slice(0, 3).map((p, i) => (
              <div key={i} onClick={() => onPhotoNav({ urls: legacyAll, startIdx: i })} style={{ width: 32, height: 24, borderRadius: 3, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
              </div>
            ))}
            {Math.max(allIds.length, legacyAll.length) > 3 && <span style={{ fontSize: 10, color: C.textMuted, alignSelf: 'center' }}>+{Math.max(allIds.length, legacyAll.length) - 3}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

export function SummaryTable({ project, user, onClose, isMobile }) {
  const [prices, setPrices] = useState({});
  const [photoNav, setPhotoNav] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetPrices(project.id).then(p => { setPrices(p || {}); setLoading(false); });
  }, [project.id]);

  // Debounced save — don't hammer IndexedDB on every keystroke
  const [savePricesDebounced] = useDebouncedCallback(async (newPrices) => {
    await dbSavePrices(project.id, newPrices);
  }, 400);

  const onPriceChange = useCallback((pinId, price) => {
    setPrices(prev => {
      const next = { ...prev, [pinId]: price };
      savePricesDebounced(next);
      return next;
    });
  }, [savePricesDebounced]);

  const isClient = user.role === 'client';
  const allPins = project.elevations.flatMap(e => (e.pins || []).map(p => ({ ...p, _elev: e.name })));

  // Apply filters
  let filtered = allPins;
  if (filter === 'torepair') filtered = filtered.filter(p => p.status === ST.TOREPAIR);
  if (filter === 'fixing') filtered = filtered.filter(p => p.status === ST.FIXING);
  if (filter === 'done') filtered = filtered.filter(p => p.status === ST.DONE);
  if (filter === 'declined') filtered = filtered.filter(p => p.approval === 'declined');
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p => (p.repairName || '').toLowerCase().includes(q) || ('' + p.id).includes(q) || (p._elev || '').toLowerCase().includes(q));
  }

  // Calculate totals
  const total = filtered.reduce((sum, p) => {
    const price = prices[p.id];
    const meas = parseFloat(getMeas(p)) || 0;
    if (price && meas) return sum + price * meas;
    return sum;
  }, 0);

  const counts = {
    all: allPins.length,
    torepair: allPins.filter(p => p.status === ST.TOREPAIR).length,
    fixing: allPins.filter(p => p.status === ST.FIXING).length,
    done: allPins.filter(p => p.status === ST.DONE).length,
    declined: allPins.filter(p => p.approval === 'declined').length,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 250, padding: isMobile ? 0 : 16 }}>
      <div style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: isMobile ? '16px 16px 0 0' : 14, width: '100%', maxWidth: isMobile ? '100%' : 1100, maxHeight: isMobile ? '94vh' : '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: C.navyDark, borderRadius: isMobile ? '16px 16px 0 0' : '14px 14px 0 0' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 800, color: '#fff' }}>📊 Summary</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{project.name} · {filtered.length} pins · ${total.toFixed(2)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, background: C.card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ID, elevation..." style={{ flex: '1 1 200px', minWidth: 0, background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', fontFamily: 'Barlow,sans-serif' }}/>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'torepair', label: 'To Repair' },
              { id: 'fixing', label: 'Fixing' },
              { id: 'done', label: 'Done' },
              { id: 'declined', label: 'Decl.' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid ' + (filter === f.id ? C.blue : C.border), background: filter === f.id ? C.blueDim : 'transparent', color: filter === f.id ? C.blue : C.textDim, fontSize: 11, cursor: 'pointer', fontWeight: filter === f.id ? 700 : 400, fontFamily: 'Barlow Condensed' }}>
                {f.label} ({counts[f.id]})
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '14px 18px' }}>
          {loading && <div style={{ textAlign: 'center', color: C.textMuted, padding: 30 }}>Loading...</div>}
          {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, padding: 30, fontSize: 13 }}>No pins match the filter</div>}
          {!loading && filtered.length > 0 && (
            isMobile ? (
              filtered.map(p => <MobilePinCard key={p.id} pin={p} price={prices[p.id]} onPriceChange={v => onPriceChange(p.id, v)} onPhotoNav={setPhotoNav} isClient={isClient}/>)
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: C.card, border: '1px solid ' + C.border, borderRadius: 8 }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: '2px solid ' + C.border }}>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>REPAIR</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>TYPE</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>MEAS.</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>UNIT $</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>TOTAL $</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>STATUS</th>
                    <th style={{ textAlign: 'left', padding: '10px 6px', fontSize: 10, color: C.textMuted, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>PHOTOS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => <DesktopPinRow key={p.id} pin={p} price={prices[p.id]} onPriceChange={v => onPriceChange(p.id, v)} onPhotoNav={setPhotoNav} isClient={isClient}/>)}
                </tbody>
              </table>
            )
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid ' + C.border, background: C.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderRadius: isMobile ? 0 : '0 0 14px 14px' }}>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: 'Barlow Condensed' }}>SHOWING {filtered.length} OF {allPins.length} PINS</div>
          <div style={{ fontSize: 18, color: C.blue, fontWeight: 700, fontFamily: 'DM Mono' }}>${total.toFixed(2)}</div>
        </div>
      </div>
      {photoNav && <PhotoNav photoIds={photoNav.ids} photos={photoNav.urls} initIdx={photoNav.startIdx} onClose={() => setPhotoNav(null)}/>}
    </div>
  );
}
