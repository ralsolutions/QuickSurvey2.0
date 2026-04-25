import { C, HC } from '../lib/constants.js';
import { fmtDate, getMeas } from '../lib/helpers.js';

export function TrashPanel({ project, onRestore, onClose }) {
  const trashed = project.elevations.flatMap((e, ei) =>
    (e.trash || []).map(p => ({ ...p, _elev: e.name, _elevIdx: ei }))
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
      <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, width: 460, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.navyDark, borderRadius: '14px 14px 0 0' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 16, fontWeight: 700, color: '#fff' }}>🗑 TRASH</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', background: C.surface }}>
          {trashed.length === 0
            ? <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '32px' }}>Trash is empty</div>
            : trashed.map((p, i) => (
              <div key={i} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <div style={{ background: HC[p.hazard] || '#6b7280', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono' }}>{p.id}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navyDark, fontFamily: 'Barlow Condensed' }}>{p.repairName || 'Unnamed'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, paddingLeft: 27 }}>{p._elev} · {getMeas(p)} · {fmtDate(p.deletedAt)}</div>
                </div>
                <button onClick={() => onRestore(p._elevIdx, p.id)} style={{ background: C.blueDim, border: '1px solid ' + C.blueBorder, borderRadius: 7, color: C.blue, fontSize: 11, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', flexShrink: 0, fontFamily: 'Barlow Condensed' }}>RESTORE</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
