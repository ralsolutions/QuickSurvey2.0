import { useState } from 'react';
import { C, ROLES, IS, LS } from '../lib/shared.js';

export function UserSetup({ onDone }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('crew');
  const [company, setCompany] = useState('');
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.navyDark, padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: C.blue, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="white"/><rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.4"/><rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.4"/><rect x="9" y="9" width="6" height="6" rx="1" fill="white"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>QUICK SURVEY</div>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>by RAL Solutions</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 36, width: 420, maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 800, color: C.navyDark, marginBottom: 6 }}>Welcome</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 24 }}>Set up your profile to get started</div>
          <label style={LS}>YOUR NAME *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lionel Melo" style={{ ...IS, marginBottom: 16 }}/>
          <label style={LS}>COMPANY / ENVIRONMENT (optional)</label>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Be Wash, Altitude Access..." style={{ ...IS, marginBottom: 16 }}/>
          <label style={LS}>YOUR ROLE</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 24 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setRole(r.id)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid ' + (role === r.id ? C.blue : C.border), background: role === r.id ? C.blueDim : C.card, color: role === r.id ? C.blue : C.textDim, fontSize: 13, fontWeight: role === r.id ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{r.desc}</div>
              </button>
            ))}
          </div>
          <button disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), role, company: company.trim() || 'Independent' })}
            style={{ width: '100%', padding: '12px', background: name.trim() ? C.navyDark : '#e5e7eb', border: 'none', borderRadius: 8, color: name.trim() ? '#fff' : '#9ca3af', fontSize: 15, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>
            GET STARTED
          </button>
        </div>
      </div>
    </div>
  );
}
