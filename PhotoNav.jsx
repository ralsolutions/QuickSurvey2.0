import { useState } from 'react';
import { C, IS, LS } from '../lib/shared.js';

export function Setup({ onDone, onBack }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [cnt, setCnt] = useState(1);
  const [names, setNames] = useState(['North']);
  const [phases, setPhases] = useState(['Survey', 'Repairing', 'Done']);
  const phaseKeys = ['torepair', 'fixing', 'done'];
  const defs = ['North', 'South', 'East', 'West', 'Roof', 'Entry', 'Rear', 'Side'];
  const updCnt = n => { const c = Math.min(8, Math.max(1, parseInt(n) || 1)); setCnt(c); setNames(p => { const a = [...p]; while (a.length < c) a.push(defs[a.length] || 'Elevation ' + (a.length + 1)); return a.slice(0, c); }); };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.navyDark, padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, flexShrink: 0 }}>
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>QUICK SURVEY — NEW PROJECT</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 36, width: 460, maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {step === 0 ? (
            <>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 800, color: C.navyDark, marginBottom: 20 }}>Project details</div>
              <label style={LS}>PROJECT NAME *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Auckland Tower" style={{ ...IS, marginBottom: 18 }} onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}/>
              <label style={LS}>ELEVATIONS (1–8)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button onClick={() => updCnt(cnt - 1)} style={{ width: 38, height: 38, borderRadius: 7, border: '1px solid ' + C.border, background: C.bg, color: C.textDim, fontSize: 20, cursor: 'pointer' }}>−</button>
                <input value={cnt} onChange={e => updCnt(e.target.value)} style={{ flex: 1, background: C.bg, border: '1px solid ' + C.border, borderRadius: 7, padding: '9px', color: C.navyDark, fontSize: 20, outline: 'none', textAlign: 'center', fontWeight: 700, fontFamily: 'Barlow Condensed' }}/>
                <button onClick={() => updCnt(cnt + 1)} style={{ width: 38, height: 38, borderRadius: 7, border: '1px solid ' + C.border, background: C.bg, color: C.textDim, fontSize: 20, cursor: 'pointer' }}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onBack} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button disabled={!name.trim()} onClick={() => setStep(1)} style={{ flex: 2, padding: '11px', background: name.trim() ? C.navyDark : '#e5e7eb', border: 'none', borderRadius: 8, color: name.trim() ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'Barlow Condensed' }}>NEXT →</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 800, color: C.navyDark, marginBottom: 20 }}>Name your elevations</div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {Array.from({ length: cnt }).map((_, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <label style={LS}>ELEVATION {i + 1}</label>
                    <input value={names[i] || ''} onChange={e => { const n = [...names]; n[i] = e.target.value; setNames(n); }} placeholder={defs[i] || 'Elevation ' + (i + 1)} style={{ ...IS }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid ' + C.border }}>
                <label style={LS}>PHASE NAMES</label>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Each pin moves through these stages. Rename them to suit the job.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {phases.map((ph, i) => (
                    <input key={i} value={ph} onChange={e => { const n = [...phases]; n[i] = e.target.value; setPhases(n); }} placeholder={['Survey', 'Repairing', 'Done'][i]} style={{ ...IS, textAlign: 'center' }}/>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={() => setStep(0)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => onDone(name.trim(), names, { torepair: (phases[0] || 'Survey').trim() || 'Survey', fixing: (phases[1] || 'Repairing').trim() || 'Repairing', done: (phases[2] || 'Done').trim() || 'Done' })} style={{ flex: 2, padding: '10px', background: C.navyDark, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>START SURVEY</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
