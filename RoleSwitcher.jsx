import { useState } from 'react';
import { C, IS, LS } from '../lib/shared.js';

// Add / rename / delete elevations after a project has been created.
// Works on a local copy and only commits when the user presses Save.
// Used both in the survey screen and from the Home project list.
export function ElevationsManager({ elevations, onApply, onClose, title = 'Manage elevations' }) {
  const [rows, setRows] = useState(() => (elevations || []).map(e => ({ ...e })));
  const [newName, setNewName] = useState('');

  const rename = (i, v) => setRows(r => r.map((e, j) => (j === i ? { ...e, name: v } : e)));
  const add = () => {
    const name = newName.trim() || ('Elevation ' + (rows.length + 1));
    setRows(r => [...r, { name, img: null, pins: [], trash: [] }]);
    setNewName('');
  };
  const del = (i) => {
    const e = rows[i];
    const pinCount = (e.pins || []).length;
    const msg = pinCount > 0
      ? 'Delete "' + (e.name || 'elevation') + '" and its ' + pinCount + ' pin' + (pinCount !== 1 ? 's' : '') + '? Those numbers will be freed for reuse.'
      : 'Delete "' + (e.name || 'elevation') + '"?';
    if (!confirm(msg)) return;
    setRows(r => r.filter((_, j) => j !== i));
  };
  const save = () => {
    const cleaned = rows.map((e, i) => ({ ...e, name: (e.name || '').trim() || ('Elevation ' + (i + 1)) }));
    if (cleaned.length === 0) { alert('Keep at least one elevation.'); return; }
    onApply(cleaned);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', background: C.navyDark, borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {rows.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.textMuted, width: 22, textAlign: 'center', fontFamily: 'DM Mono', flexShrink: 0 }}>{i + 1}</div>
              <input value={e.name} onChange={ev => rename(i, ev.target.value)} placeholder={'Elevation ' + (i + 1)} style={{ ...IS, flex: 1 }}/>
              <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono', width: 42, textAlign: 'right', flexShrink: 0 }}>{(e.pins || []).length} pin{(e.pins || []).length !== 1 ? 's' : ''}</span>
              <button onClick={() => del(i)} disabled={rows.length <= 1} title={rows.length <= 1 ? 'Keep at least one elevation' : 'Delete elevation'}
                style={{ background: 'none', border: '1px solid ' + (rows.length <= 1 ? C.border : '#ef444440'), borderRadius: 6, color: rows.length <= 1 ? C.textMuted : '#ef4444', cursor: rows.length <= 1 ? 'default' : 'pointer', fontSize: 13, padding: '7px 9px', flexShrink: 0 }}>🗑</button>
            </div>
          ))}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid ' + C.border }}>
            <label style={LS}>ADD ELEVATION</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newName} onChange={ev => setNewName(ev.target.value)} placeholder="e.g. West, Roof, Boulder…" style={{ ...IS, flex: 1 }} onKeyDown={ev => ev.key === 'Enter' && add()}/>
              <button onClick={add} style={{ padding: '0 16px', borderRadius: 7, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', whiteSpace: 'nowrap' }}>+ Add</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid ' + C.border, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex: 2, padding: '10px', background: C.navyDark, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>SAVE</button>
        </div>
      </div>
    </div>
  );
}
