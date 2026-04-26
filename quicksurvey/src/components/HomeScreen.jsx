import { useState, useEffect, useRef } from 'react';
import { C, ROLES, ST, dbGetAll, dbDelete, exportProject, importProjectFromFile } from '../lib/shared.js';
import { RoleSwitcher } from './RoleSwitcher.jsx';

export function HomeScreen({ onOpen, onCreate, user, onRoleSwitch, onSwitchUser, onLogout }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRole, setShowRole] = useState(false);
  const fileInputRef = useRef(null);
  useEffect(() => { dbGetAll().then(all => { setList(all.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1)); setLoading(false); }); }, []);
  const del = async id => { if (!confirm('Delete this project?')) return; await dbDelete(id); setList(l => l.filter(p => p.id !== id)); };
  const handleExport = async (e, p) => { e.stopPropagation(); try { await exportProject(p); } catch (err) { alert('Export failed: ' + err.message); } };
  const handleImport = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const imported = await importProjectFromFile(f); const all = await dbGetAll(); setList(all.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1)); alert('✓ Imported "' + imported.name + '" successfully'); }
    catch (err) { alert('Import failed: ' + err.message); }
    e.target.value = '';
  };
  const canCreate = user.role === 'admin' || user.role === 'manager';
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.navyDark, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: C.blue, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="white"/><rect x="9" y="1" width="6" height="6" rx="1" fill="white" opacity="0.4"/><rect x="1" y="9" width="6" height="6" rx="1" fill="white" opacity="0.4"/><rect x="9" y="9" width="6" height="6" rx="1" fill="white"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>QUICK SURVEY</div>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>by RAL Solutions</div>
          </div>
        </div>
        <button onClick={() => setShowRole(true)} style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid #2563eb44', borderRadius: 8, color: '#93c5fd', fontSize: 12, cursor: 'pointer', padding: '6px 14px', fontFamily: 'Barlow Condensed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#475569', letterSpacing: 1 }}>{user.company}</span>
          <span>{user.name}</span>
          <span style={{ fontSize: 9, background: '#2563eb33', padding: '2px 6px', borderRadius: 4, letterSpacing: 1 }}>{user.role.toUpperCase()}</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: 560, maxWidth: '100%' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 30, fontWeight: 800, color: C.navyDark, marginBottom: 4 }}>Projects</div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>{user.company} · {(ROLES.find(r => r.id === user.role) || {}).label}</div>
          {loading && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '36px' }}>Loading...</div>}
          {!loading && list.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '36px', border: '2px dashed ' + C.border, borderRadius: 12, marginBottom: 14, background: C.card }}>No projects yet</div>}
          {list.map(p => {
            const ptotal = p.elevations.reduce((s, e) => s + (e.pins || []).length, 0);
            const done = p.elevations.reduce((s, e) => s + (e.pins || []).filter(pi => pi.status === ST.DONE).length, 0);
            const pct = ptotal > 0 ? Math.round(done / ptotal * 100) : 0;
            return (
              <div key={p.id} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s' }}
                onClick={() => onOpen(p)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.navyDark, fontFamily: 'Barlow Condensed' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{p.elevations.length} elevation{p.elevations.length !== 1 ? 's' : ''}</span><span>·</span><span>{ptotal} pins</span>
                    {ptotal > 0 && <><span>·</span><span style={{ color: C.done, fontWeight: 600 }}>{pct}% done</span></>}
                  </div>
                  {ptotal > 0 && <div style={{ marginTop: 6, height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: pct === 100 ? C.done : C.blue, borderRadius: 2 }}/></div>}
                </div>
                <button title="Export project" style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 13, padding: '4px 8px' }} onClick={e => handleExport(e, p)}>⭳</button>
                {canCreate && <button style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 15, padding: '4px 8px' }} onClick={e => { e.stopPropagation(); del(p.id); }}>🗑</button>}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {canCreate && <button onClick={onCreate} style={{ flex: 1, padding: '13px', background: C.navyDark, border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>+ NEW PROJECT</button>}
            {canCreate && <button onClick={() => fileInputRef.current?.click()} title="Import project from JSON" style={{ padding: '13px 16px', background: 'transparent', border: '1.5px solid ' + C.border, borderRadius: 10, color: C.textDim, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', letterSpacing: 1, whiteSpace: 'nowrap' }}>⭱ IMPORT</button>}
            <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImport}/>
          </div>
        </div>
      </div>
      {showRole && <RoleSwitcher user={user} onSwitch={r => { onRoleSwitch(r); setShowRole(false); }} onSwitchUser={u => { onSwitchUser(u); setShowRole(false); }} onLogout={onLogout} onClose={() => setShowRole(false)}/>}
    </div>
  );
}
