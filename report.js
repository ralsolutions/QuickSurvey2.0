import { useState } from 'react';
import { C, IS, LS } from '../lib/shared.js';

// Asked right before the PDF is generated. Both fields are optional: leave one
// blank and that section is simply skipped in the report. Prefilled from the
// project so previously typed text is remembered.
export function ExportOptions({ project, busy, onGenerate, onClose }) {
  const [overview, setOverview] = useState(project?.overview || '');
  const [scope, setScope] = useState(project?.scope || '');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', background: C.navyDark, borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>📄 Export PDF</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
            Add optional sections to the report. Leave a box empty to skip it.
          </div>

          <label style={LS}>OVERVIEW <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span></label>
          <textarea value={overview} onChange={e => setOverview(e.target.value)} rows={5}
            placeholder="A short summary of what the survey found and why it matters. Appears on the cover."
            style={{ ...IS, resize: 'vertical', marginBottom: 16 }}/>

          <label style={LS}>RECOMMENDED SCOPE OF WORKS <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span></label>
          <textarea value={scope} onChange={e => setScope(e.target.value)} rows={5}
            placeholder="What you recommend be done, and the priority. Appears as a closing section."
            style={{ ...IS, resize: 'vertical' }}/>
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid ' + C.border, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 8, color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onGenerate(overview.trim(), scope.trim())} disabled={busy}
            style={{ flex: 2, padding: '10px', background: '#166534', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'Barlow Condensed' }}>
            {busy ? 'GENERATING…' : 'GENERATE PDF →'}
          </button>
        </div>
      </div>
    </div>
  );
}
