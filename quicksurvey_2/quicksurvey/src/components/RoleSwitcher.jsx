import { useState, useEffect } from 'react';
import { C, ROLES, TEST_USERS } from '../lib/shared.js';

export function RoleSwitcher({ user, onSwitch, onSwitchUser, onLogout, onClose }) {
  const [installAvail, setInstallAvail] = useState(typeof window !== 'undefined' && window.__qsInstallAvailable === true);
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    const a = () => setInstallAvail(true);
    const d = () => setInstallAvail(false);
    window.addEventListener('qs-install-available', a);
    window.addEventListener('qs-install-done', d);
    return () => { window.removeEventListener('qs-install-available', a); window.removeEventListener('qs-install-done', d); };
  }, []);
  const doInstall = async () => {
    if (!window.__qsInstallApp) return;
    setInstalling(true);
    try { await window.__qsInstallApp(); } catch (e) {}
    setInstalling(false);
  };
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 24, width: 380, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 20, fontWeight: 800, color: C.navyDark, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>{user.name} · {user.company}</div>

        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 8, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>SWITCH USER</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {TEST_USERS.map(u => {
            const active = user.name === u.name;
            return (
              <button key={u.name} onClick={() => onSwitchUser(u)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid ' + (active ? '#8b5cf6' : C.border), background: active ? '#8b5cf610' : C.card, color: active ? '#7c3aed' : C.textDim, fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'Barlow Condensed', textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: active ? '#7c3aed' : '#d1d5db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, margin: '0 auto 6px', fontFamily: 'DM Mono' }}>{u.initials}</div>
                {u.name}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 8, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>ROLE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ROLES.map(r => {
            const active = user.role === r.id;
            return (
              <button key={r.id} onClick={() => onSwitch(r.id)}
                style={{ padding: '12px 14px', borderRadius: 8, border: '1.5px solid ' + (active ? C.blue : C.border), background: active ? C.blueDim : C.card, color: active ? C.blue : C.textDim, fontSize: 14, fontWeight: active ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><span style={{ fontWeight: 700 }}>{r.label}</span><span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>{r.desc}</span></div>
                {active && <span style={{ fontSize: 16 }}>✓</span>}
              </button>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid ' + C.border, marginTop: 16, paddingTop: 12 }}>
          {isStandalone ? (
            <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 10, fontSize: 12, color: '#16a34a', textAlign: 'center', fontFamily: 'Barlow Condensed', fontWeight: 700 }}>
              ✓ Running as installed app
            </div>
          ) : installAvail ? (
            <button onClick={doInstall} disabled={installing} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', letterSpacing: 0.5, marginBottom: 10, opacity: installing ? 0.6 : 1 }}>
              {installing ? 'INSTALLING...' : '⬇ INSTALL ON THIS DEVICE'}
            </button>
          ) : isIOS ? (
            <div style={{ padding: '10px 12px', background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, marginBottom: 10, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: C.navyDark, marginBottom: 4, fontFamily: 'Barlow Condensed', fontSize: 12, letterSpacing: 1 }}>INSTALL ON iPHONE / iPAD</div>
              Tap the <span style={{ fontFamily: 'monospace' }}>Share</span> button in Safari, then <span style={{ fontWeight: 700 }}>Add to Home Screen</span>.
            </div>
          ) : null}
          <button onClick={onLogout} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #dc262644', background: '#dc262608', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>↩ LOG OUT / SWITCH COMPANY</button>
          <div style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: 6 }}>Returns to the Welcome screen to change name, company, or role</div>
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid ' + C.border, background: 'transparent', color: C.textDim, fontSize: 13, cursor: 'pointer', marginTop: 10 }}>Close</button>
      </div>
    </div>
  );
}
