import { useState } from 'react';
import { C, RT, HC, HAZARDS, ST, SC, SL, IS, LS, pCol, getMeas, wm } from '../lib/shared.js';
import { DrawingCanvas } from './DrawingCanvas.jsx';
import { PhotoNav } from './PhotoNav.jsx';

export function PinModal({ pin, repairList, onSave, onTrash, onDuplicate, onClose, onAddRT, isMobile, user }) {
  const isNew = !pin.repairName;
  const isDup = pin._justDuplicated === true;
  const isClient = user.role === 'client';
  const [view, setView] = useState(isNew ? (repairList.length > 0 ? 'choose' : 'new') : (isDup ? 'fill' : 'status'));
  const [selR, setSelR] = useState(repairList.find(r => r.name === pin.repairName) || null);
  const [newName, setNewName] = useState(isDup ? (pin.repairName || '') : '');
  const [rtype, setRtype] = useState(isDup ? (pin.repairType || 'linear') : 'linear');
  const [meas, setMeas] = useState(() => ({ ...(pin.measurements || {}) }));
  const [comment, setComment] = useState(isDup ? (pin.comment || '') : '');
  const [hazard, setHazard] = useState(pin.hazard || 'yellow');
  const [staging, setStaging] = useState([]);
  const [saving, setSaving] = useState(false);
  const [photoNav, setPhotoNav] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [origMeas, setOrigMeas] = useState(null);

  const MIN = 1; const MAX = 3;
  const ert = selR ? selR.type : rtype;
  const rt = RT.find(r => r.id === ert);
  const isOther = ert === 'other';

  const surveyPhotos = pin.surveyPhotos || [];
  const fixingPhotos = pin.fixingPhotos || [];
  const donePhotos = pin.donePhotos || [];
  const allPhotos = [...surveyPhotos, ...fixingPhotos, ...donePhotos];
  const cur = pin.status || ST.TOREPAIR;
  const isDeclined = pin.approval === 'declined';

  const measChanged = origMeas !== null && Object.keys({ ...origMeas, ...meas }).some(k => (origMeas[k] || '').toString() !== (meas[k] || '').toString());
  const canSave = staging.length >= MIN;
  const commentOk = isOther ? comment.trim().length >= 5 : (!measChanged || comment.trim().length >= 10);

  const enterFixing = () => { setMeas({ ...(pin.measurements || {}) }); setOrigMeas({ ...(pin.measurements || {}) }); setComment(''); setStaging([]); setView('fixing'); };
  const enterDone = () => { setMeas({ ...(pin.measurements || {}) }); setOrigMeas({ ...(pin.measurements || {}) }); setComment(''); setStaging([]); setView('done'); };

  const addPhotos = files => { const rem = MAX - staging.length; Array.from(files).slice(0, rem).forEach(f => { const fr = new FileReader(); fr.onload = ev => setStaging(p => [...p, ev.target.result]); fr.readAsDataURL(f); }); };
  const pickR = r => { setSelR(r); setRtype(r.type); setMeas({}); setView('fill'); };

  const saveSurvey = async () => {
    if (!canSave) { alert('At least 1 photo required.'); return; }
    if (isOther && comment.trim().length < 5) { alert('Other type requires a comment (min 5 characters).'); return; }
    if (hazard === 'red' && comment.trim().length < 5) { alert('Hazard level requires a comment (min 5 characters).'); return; }
    setSaving(true);
    const rn = selR ? selR.name : newName;
    if (!selR) onAddRT({ name: rn, type: ert });
    const { _justDuplicated, ...pinClean } = pin;
    const pinData = { ...pinClean, repairName: rn, repairType: ert, measurements: { ...meas }, createdBy: user.name };
    const tagged = await Promise.all(staging.map(p => wm(p, pinData, user.name)));
    onSave({ ...pinData, comment, hazard, status: ST.TOREPAIR, approval: 'pending', surveyPhotos: tagged, fixingPhotos: [], donePhotos: [] });
    setSaving(false);
  };

  const savePhase = async (type) => {
    if (!canSave) { alert('At least 1 photo required.'); return; }
    if (!commentOk) { alert(isOther ? 'Comment required (min 5 chars).' : 'Measurement changed — comment of at least 10 chars required.'); return; }
    setSaving(true);
    const pinForWm = { ...pin, measurements: { ...meas } };
    const tagged = await Promise.all(staging.map(p => wm(p, pinForWm, user.name)));
    let updated = { ...pin, measurements: { ...meas } };
    if (type === 'fixing') { updated.fixingPhotos = tagged; updated.status = ST.FIXING; if (comment.trim()) updated.fixingComment = comment.trim(); }
    else { updated.donePhotos = tagged; updated.status = ST.DONE; if (comment.trim()) updated.doneComment = comment.trim(); }
    onSave(updated); setSaving(false);
  };

  const StagingArea = ({ label }) => (
    <div style={{ marginBottom: 12 }}>
      {staging.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {staging.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: 60, height: 48, borderRadius: 6, overflow: 'hidden', border: '1px solid ' + C.border }}>
              <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
              <button onClick={() => setDrawingMode(i)} style={{ position: 'absolute', bottom: 1, right: 1, background: '#2563eb99', border: 'none', borderRadius: '50%', color: '#fff', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title="Draw on photo">✎</button>
              <button onClick={() => setStaging(s => s.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 1, right: 1, background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: '50%', color: '#fff', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          ))}
        </div>
      )}
      {staging.length < MAX && (
        <label style={{ display: 'block', padding: '11px', border: '1px dashed ' + C.borderDark, borderRadius: 8, textAlign: 'center', color: C.textDim, fontSize: 12, cursor: 'pointer', background: C.surface }}>
          📷 {label} ({staging.length}/{MAX})
          <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={e => addPhotos(e.target.files)}/>
        </label>
      )}
      {staging.length >= MIN && <div style={{ fontSize: 10, color: C.done, marginTop: 4, textAlign: 'center' }}>✓ Ready</div>}
    </div>
  );

  const statusColor = isDeclined ? C.declined : (SC[cur] || C.blue);
  const hbc = HC[hazard] || C.border;

  if (drawingMode !== null) {
    return <DrawingCanvas imageSrc={staging[drawingMode]} onClose={drawn => { if (drawn) { setStaging(s => { const ns = [...s]; ns[drawingMode] = drawn; return ns; }); } setDrawingMode(null); }}/>;
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 200, padding: isMobile ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: '1px solid ' + (isDeclined ? C.declined + '55' : isNew ? C.border : hbc + '55'), borderRadius: isMobile ? '16px 16px 0 0' : 14, width: isMobile ? '100%' : 390, maxWidth: '100%', maxHeight: isMobile ? '94vh' : '92vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)', paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0 }}>

        <div style={{ padding: '13px 17px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDeclined ? '#450a0a' : C.navyDark, borderRadius: isMobile ? '16px 16px 0 0' : '14px 14px 0 0', position: 'sticky', top: 0, zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ background: pCol(pin, user.name), borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono' }}>{pin.id}</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>PIN #{pin.id}</span>
            {!isNew && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statusColor + '33', color: statusColor, letterSpacing: 1, border: '1px solid ' + statusColor + '55' }}>{isDeclined ? 'DECLINED' : SL[cur]}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isNew && !isClient && <button onClick={() => onDuplicate(pin.id)} title="Duplicate pin" style={{ background: 'none', border: '1px solid #2563eb40', borderRadius: 6, color: '#93c5fd', cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 0.5 }}>⎘ DUPLICATE</button>}
            {!isNew && !isClient && <button onClick={() => onTrash(pin.id)} style={{ background: 'none', border: '1px solid #ef444430', borderRadius: 6, color: '#ef444488', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}>🗑</button>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 17px' }}>
          {view === 'status' && (
            <>
              <div style={{ padding: '10px 14px', background: isDeclined ? '#fef2f2' : C.surface, borderRadius: 8, border: '1px solid ' + (isDeclined ? '#fecaca' : C.border), marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDeclined ? C.declined : C.navyDark, marginBottom: 3, fontFamily: 'Barlow Condensed' }}>{pin.repairName}</div>
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: 'DM Mono' }}>{getMeas(pin)}</div>
                {pin.createdBy && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>by {pin.createdBy}</div>}
                {pin.hazard && <div style={{ fontSize: 10, color: HC[pin.hazard], marginTop: 4, fontWeight: 700 }}>{(HAZARDS.find(h => h.id === pin.hazard) || { label: '' }).label}</div>}
                {pin.comment && <div style={{ fontSize: 11, color: C.textDim, marginTop: 5, fontStyle: 'italic', borderTop: '1px solid ' + C.border, paddingTop: 5 }}>"{pin.comment}"</div>}
                {pin.fixingComment && <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 3, fontStyle: 'italic' }}>📐 "{pin.fixingComment}"</div>}
                {pin.approvalComment && <div style={{ fontSize: 10, color: C.declined, marginTop: 4, fontStyle: 'italic', padding: '6px 8px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>Client: "{pin.approvalComment}"</div>}
                {pin.approval && pin.approval !== 'pending' && <div style={{ fontSize: 10, fontWeight: 700, color: pin.approval === 'approved' ? C.done : C.declined, marginTop: 4 }}>{pin.approval === 'approved' ? '✓ Approved by client' : '✗ Declined by client'}</div>}
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                {[ST.TOREPAIR, ST.FIXING, ST.DONE].map((s, i) => {
                  const order = [ST.TOREPAIR, ST.FIXING, ST.DONE];
                  const reached = order.indexOf(cur) >= order.indexOf(s);
                  const col = isDeclined ? C.declined : (reached ? SC[s] : C.border);
                  return (
                    <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ height: 4, width: '100%', borderRadius: 2, background: col }}/>
                      <span style={{ fontSize: 8, color: col, fontFamily: 'Barlow Condensed', fontWeight: reached ? 700 : 400 }}>{SL[s].toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>

              {allPhotos.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, letterSpacing: 1.5, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>PHOTOS ({allPhotos.length})</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {allPhotos.map((p, i) => (
                      <div key={i} onClick={() => setPhotoNav({ photos: allPhotos, startIdx: i })} style={{ width: 52, height: 40, borderRadius: 5, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                        <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isClient && cur === ST.TOREPAIR && !isDeclined && (
                <button onClick={enterFixing} style={{ width: '100%', padding: '10px', background: '#8b5cf614', border: '1px solid #8b5cf6', borderRadius: 8, color: '#7c3aed', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6, fontFamily: 'Barlow Condensed' }}>
                  📸 Add Fixing Photos →
                </button>
              )}
              {!isClient && cur === ST.FIXING && (
                <button onClick={enterDone} style={{ width: '100%', padding: '10px', background: '#22c55e14', border: '1px solid #22c55e', borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6, fontFamily: 'Barlow Condensed' }}>
                  ✓ Add Done Photos →
                </button>
              )}
              {!isClient && isDeclined && cur === ST.FIXING && (
                <button onClick={enterDone} style={{ width: '100%', padding: '10px', background: '#dc262614', border: '1px solid #dc2626', borderRadius: 8, color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6, fontFamily: 'Barlow Condensed' }}>
                  ✓ Finish Declined Repair →
                </button>
              )}
              {cur === ST.DONE && (
                <div style={{ textAlign: 'center', padding: '10px', background: isDeclined ? '#dc262610' : '#22c55e10', border: '1px solid ' + (isDeclined ? '#dc262633' : '#22c55e33'), borderRadius: 8, color: isDeclined ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 700, marginBottom: 6, fontFamily: 'Barlow Condensed' }}>{isDeclined ? '✗ DECLINED — COMPLETED' : '✓ COMPLETE'}</div>
              )}
            </>
          )}

          {view === 'choose' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Repairs ({repairList.length})</button>
                <button onClick={() => setView('new')} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}>+ New</button>
              </div>
              {repairList.map((r, i) => (
                <div key={i} onClick={() => pickR(r)} style={{ padding: '10px 12px', borderRadius: 7, border: '1px solid ' + C.border, background: C.surface, marginBottom: 6, cursor: 'pointer', transition: 'border-color 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.blue} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ fontSize: 13, color: C.navyDark, fontWeight: 600, fontFamily: 'Barlow Condensed' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono', marginTop: 2 }}>{(RT.find(t => t.id === r.type) || { label: '' }).label}</div>
                </div>
              ))}
            </>
          )}

          {view === 'new' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {repairList.length > 0 && <button onClick={() => setView('choose')} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}>← Repairs</button>}
                <button style={{ flex: repairList.length > 0 ? 1 : 2, padding: '7px', borderRadius: 6, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ New repair</button>
              </div>
              <label style={LS}>REPAIR NAME</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Spalling, Joint, Crack, Gutter..." style={{ ...IS, marginBottom: 14 }}/>
              <label style={LS}>REPAIR TYPE</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 16 }}>
                {RT.map(t => (
                  <button key={t.id} onClick={() => setRtype(t.id)}
                    style={{ padding: '8px', borderRadius: 6, border: '1.5px solid ' + (rtype === t.id ? C.blue : C.border), background: rtype === t.id ? C.blueDim : C.card, color: rtype === t.id ? C.blue : C.textDim, fontSize: 12, fontWeight: rtype === t.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed' }}>
                    {t.label}{t.id === 'other' ? ' (no meas.)' : ''}
                  </button>
                ))}
              </div>
              <button disabled={!newName.trim()} onClick={() => setView('fill')}
                style={{ width: '100%', padding: '9px', background: newName.trim() ? C.navyDark : '#e5e7eb', border: 'none', borderRadius: 8, color: newName.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default', fontFamily: 'Barlow Condensed' }}>
                CONTINUE →
              </button>
            </>
          )}

          {view === 'fill' && (
            <>
              <div style={{ padding: '8px 12px', background: C.surface, borderRadius: 7, border: '1px solid ' + C.border, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: C.navyDark, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Barlow Condensed' }}>{selR ? selR.name : newName}</span>
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono', flexShrink: 0 }}>{(RT.find(t => t.id === ert) || { label: '' }).label}</span>
                <button onClick={() => { setView(repairList.length > 0 ? 'choose' : 'new'); setSelR(null); }} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✎</button>
              </div>

              {rt && !isOther && (
                <>
                  <label style={LS}>MEASUREMENTS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: rt.fields.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginBottom: 6 }}>
                    {rt.fields.map(f => (
                      <div key={f.k}>
                        <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{f.l}</div>
                        <input type="number" min="0" value={meas[f.k] || ''} onChange={e => { const v = e.target.value; setMeas(prev => ({ ...prev, [f.k]: v })); }} placeholder="0" style={{ ...IS, padding: '7px 8px' }}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.blue, marginBottom: 14, fontFamily: 'DM Mono', padding: '5px 10px', background: C.blueDim, borderRadius: 6, border: '1px solid ' + C.blueBorder }}>= {rt.calc(meas)}</div>
                </>
              )}

              {isOther && (
                <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Other — no measurements. Comment is required.</div>
                </div>
              )}

              <label style={{ ...LS, color: isOther && comment.trim().length < 5 ? '#dc2626' : C.textDim }}>
                COMMENT {isOther ? <span style={{ color: '#dc2626' }}>* required (min 5 chars)</span> : '(optional)'}
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder={isOther ? "Describe the issue, location, observations..." : "Location, observations..."}
                rows={isOther ? 3 : 2} style={{ ...IS, resize: 'none', marginBottom: 14 }}/>

              <label style={LS}>HAZARD LEVEL</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 14 }}>
                {HAZARDS.map(h => (
                  <button key={h.id} onClick={() => setHazard(h.id)}
                    style={{ padding: '7px 4px', borderRadius: 6, border: '1.5px solid ' + (hazard === h.id ? h.color : C.border), background: hazard === h.id ? h.color + '15' : C.card, color: hazard === h.id ? h.color : C.textDim, fontSize: 10, fontWeight: hazard === h.id ? 700 : 400, cursor: 'pointer', textAlign: 'center' }}>
                    ● {h.label}
                  </button>
                ))}
              </div>

              <label style={LS}>PHOTOS (1–3)</label>
              <StagingArea label="Add survey photos"/>

              <button onClick={saveSurvey} disabled={saving || !canSave || (isOther && comment.trim().length < 5)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: (canSave && (!isOther || comment.trim().length >= 5)) ? C.navyDark : '#e5e7eb', color: (canSave && (!isOther || comment.trim().length >= 5)) ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: (canSave && (!isOther || comment.trim().length >= 5)) ? 'pointer' : 'default', opacity: saving ? 0.6 : 1, fontFamily: 'Barlow Condensed' }}>
                {saving ? 'SAVING...' : 'SAVE PIN →'}
              </button>
            </>
          )}

          {view === 'fixing' && (
            <>
              <div style={{ padding: '10px 14px', background: isDeclined ? '#fef2f2' : '#8b5cf610', borderRadius: 8, border: '1px solid ' + (isDeclined ? '#fecaca' : '#8b5cf633'), marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isDeclined ? C.declined : '#7c3aed', fontFamily: 'Barlow Condensed' }}>{isDeclined ? 'FIXING DECLINED REPAIR' : 'FIXING PHOTOS'}</div>
                <div style={{ fontSize: 11, color: isDeclined ? '#dc262699' : '#7c3aed99', marginTop: 2 }}>1–3 photos{!isOther ? ' · you can update the measurement if needed' : ''}</div>
              </div>
              {rt && !isOther && (
                <>
                  <label style={{ ...LS, color: measChanged ? '#ea580c' : C.textDim }}>MEASUREMENTS {measChanged && <span style={{ color: '#ea580c', fontWeight: 700 }}>● CHANGED</span>}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: rt.fields.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginBottom: 6 }}>
                    {rt.fields.map(f => (
                      <div key={f.k}><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{f.l}</div>
                        <input type="number" min="0" value={meas[f.k] || ''} onChange={e => { const v = e.target.value; setMeas(prev => ({ ...prev, [f.k]: v })); }} placeholder="0" style={{ ...IS, padding: '7px 8px', borderColor: measChanged ? '#8b5cf6' : C.border }}/></div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.blue, marginBottom: 12, fontFamily: 'DM Mono', padding: '5px 10px', background: C.blueDim, borderRadius: 6, border: '1px solid ' + C.blueBorder }}>= {rt.calc(meas)}</div>
                </>
              )}
              <label style={{ ...LS, color: measChanged && comment.trim().length < 10 ? '#dc2626' : C.textDim }}>
                COMMENT {measChanged ? <span style={{ color: '#dc2626' }}>* required (min 10 chars)</span> : '(optional)'}
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={measChanged ? 'Explain why the measurement changed...' : 'Notes for this phase...'} rows={2} style={{ ...IS, resize: 'none', marginBottom: 4, borderColor: measChanged && comment.trim().length < 10 ? '#dc2626' : C.border }}/>
              {measChanged && comment.trim().length > 0 && comment.trim().length < 10 && <div style={{ fontSize: 10, color: '#dc2626', marginBottom: 6 }}>{10 - comment.trim().length} more characters needed</div>}
              <div style={{ marginBottom: 10 }}/>
              <label style={LS}>FIXING PHOTOS (1–3)</label>
              <StagingArea label="Add fixing photos"/>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setView('status')} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => savePhase('fixing')} disabled={saving || !canSave || !commentOk}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: (canSave && commentOk) ? (isDeclined ? '#dc2626' : '#7c3aed') : '#e5e7eb', color: (canSave && commentOk) ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'Barlow Condensed' }}>
                  {saving ? 'SAVING...' : 'SAVE FIXING →'}
                </button>
              </div>
            </>
          )}

          {view === 'done' && (
            <>
              <div style={{ padding: '10px 14px', background: isDeclined ? '#fef2f2' : '#22c55e10', borderRadius: 8, border: '1px solid ' + (isDeclined ? '#fecaca' : '#22c55e33'), marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isDeclined ? C.declined : '#16a34a', fontFamily: 'Barlow Condensed' }}>{isDeclined ? 'FINISHING DECLINED REPAIR' : 'DONE PHOTOS'}</div>
                <div style={{ fontSize: 11, color: isDeclined ? '#dc262699' : '#16a34a99', marginTop: 2 }}>1–3 photos · document the completed repair</div>
              </div>
              {rt && !isOther && (
                <>
                  <label style={{ ...LS, color: measChanged ? '#ea580c' : C.textDim }}>MEASUREMENTS {measChanged && <span style={{ color: '#ea580c', fontWeight: 700 }}>● CHANGED</span>}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: rt.fields.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginBottom: 6 }}>
                    {rt.fields.map(f => (
                      <div key={f.k}><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{f.l}</div>
                        <input type="number" min="0" value={meas[f.k] || ''} onChange={e => { const v = e.target.value; setMeas(prev => ({ ...prev, [f.k]: v })); }} placeholder="0" style={{ ...IS, padding: '7px 8px', borderColor: measChanged ? '#22c55e' : C.border }}/></div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.blue, marginBottom: 12, fontFamily: 'DM Mono', padding: '5px 10px', background: C.blueDim, borderRadius: 6, border: '1px solid ' + C.blueBorder }}>= {rt.calc(meas)}</div>
                </>
              )}
              <label style={{ ...LS, color: measChanged && comment.trim().length < 10 ? '#dc2626' : C.textDim }}>
                COMMENT {measChanged ? <span style={{ color: '#dc2626' }}>* required (min 10 chars)</span> : '(optional)'}
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={measChanged ? 'Explain why the measurement changed...' : 'Final notes...'} rows={2} style={{ ...IS, resize: 'none', marginBottom: 4, borderColor: measChanged && comment.trim().length < 10 ? '#dc2626' : C.border }}/>
              {measChanged && comment.trim().length > 0 && comment.trim().length < 10 && <div style={{ fontSize: 10, color: '#dc2626', marginBottom: 6 }}>{10 - comment.trim().length} more characters needed</div>}
              <div style={{ marginBottom: 10 }}/>
              <label style={LS}>DONE PHOTOS (1–3)</label>
              <StagingArea label="Add done photos"/>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setView('status')} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => savePhase('done')} disabled={saving || !canSave || !commentOk}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: (canSave && commentOk) ? (isDeclined ? '#dc2626' : '#16a34a') : '#e5e7eb', color: (canSave && commentOk) ? '#fff' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'Barlow Condensed' }}>
                  {saving ? 'SAVING...' : (isDeclined ? 'CLOSE DECLINED ✓' : 'MARK DONE ✓')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {photoNav && <PhotoNav photos={photoNav.photos} initIdx={photoNav.startIdx} onClose={() => setPhotoNav(null)}/>}
    </div>
  );
}
