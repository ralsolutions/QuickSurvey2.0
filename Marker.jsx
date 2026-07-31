import { useState } from 'react';
import { C, RT, HC, HAZARDS, ST, IS, getMeas } from '../lib/shared.js';
import { PhotoNav } from './PhotoNav.jsx';

function ReviewPinRow({ pin, canApprove, showActions, onApprove, onDecline, onPhotoNav }) {
  const [showDecline, setShowDecline] = useState(false);
  const [comment, setComment] = useState('');
  const photos = pin.surveyPhotos || [];
  const isDecl = pin.approval === 'declined';
  const isAppr = pin.approval === 'approved';

  const handleDecline = () => {
    onDecline(pin.id, comment);
    setShowDecline(false);
    setComment('');
  };

  return (
    <div style={{ padding: '14px 16px', background: isDecl ? '#fef2f2' : isAppr ? '#f0fdf4' : C.card, border: '1px solid ' + (isDecl ? '#fecaca' : isAppr ? '#bbf7d0' : C.border), borderRadius: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ background: isDecl ? C.declined : (HC[pin.hazard] || '#6b7280'), borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono', flexShrink: 0 }}>{pin.id}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: isDecl ? C.declined : C.navyDark, fontFamily: 'Barlow Condensed' }}>{pin.repairName}</span>
            <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono' }}>{(RT.find(r => r.id === pin.repairType) || { label: '' }).label}</span>
            <span style={{ fontSize: 10, color: C.blue, fontFamily: 'DM Mono' }}>{getMeas(pin)}</span>
            {pin.hazard && <span style={{ fontSize: 9, fontWeight: 700, color: HC[pin.hazard], background: HC[pin.hazard] + '18', padding: '2px 6px', borderRadius: 6 }}>{(HAZARDS.find(h => h.id === pin.hazard) || {}).label}</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{pin._elev}{pin.createdBy ? ' · by ' + pin.createdBy : ''}</div>
          {pin.comment && <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>"{pin.comment}"</div>}
          {pin.approvalComment && <div style={{ fontSize: 11, color: C.declined, marginTop: 4, padding: '4px 8px', background: '#fef2f2', borderRadius: 4, border: '1px solid #fecaca' }}>Declined: "{pin.approvalComment}"</div>}
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {photos.map((p, i) => (
                <div key={i} onClick={() => onPhotoNav({ photos, startIdx: i })} style={{ width: 48, height: 36, borderRadius: 4, overflow: 'hidden', border: '1px solid ' + C.border, cursor: 'pointer' }}>
                  <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""/>
                </div>
              ))}
            </div>
          )}
          {isAppr && <div style={{ fontSize: 11, fontWeight: 700, color: C.done, marginTop: 8 }}>✓ Approved</div>}
          {isDecl && <div style={{ fontSize: 11, fontWeight: 700, color: C.declined, marginTop: 8 }}>✗ Declined</div>}
        </div>
        {showActions && canApprove && !isAppr && !isDecl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <button onClick={() => onApprove(pin.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #22c55e', background: '#22c55e18', color: '#16a34a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', whiteSpace: 'nowrap' }}>✓ Approve</button>
            <button onClick={() => setShowDecline(!showDecline)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #dc2626', background: '#dc262618', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed', whiteSpace: 'nowrap' }}>✗ Decline</button>
          </div>
        )}
      </div>
      {showDecline && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca' }}>
          <label style={{ fontSize: 10, color: C.declined, fontWeight: 700, marginBottom: 4, display: 'block', letterSpacing: 1 }}>REASON FOR DECLINING (optional)</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Explain why this repair is declined..." rows={2} style={{ ...IS, resize: 'none', marginBottom: 8, borderColor: '#fecaca' }}/>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowDecline(false)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.textDim, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDecline} style={{ flex: 2, padding: '7px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>CONFIRM DECLINE</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SurveyReview({ project, user, onApprove, onDecline, onClose }) {
  const [photoNav, setPhotoNav] = useState(null);
  const canApprove = user.role === 'admin' || user.role === 'client';

  const allPins = project.elevations.flatMap(e => (e.pins || []).map(p => ({ ...p, _elev: e.name })));
  const surveyPins = allPins.filter(p => p.status === ST.TOREPAIR);
  const declinedPins = allPins.filter(p => p.approval === 'declined');
  const approvedPins = allPins.filter(p => p.approval === 'approved' && p.status === ST.TOREPAIR);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 16 }}>
      <div style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: C.navyDark, borderRadius: '14px 14px 0 0' }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 20, fontWeight: 800, color: '#fff' }}>📋 Survey Review</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{project.name} · {surveyPins.length} pending · {approvedPins.length} approved · {declinedPins.length} declined</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {surveyPins.filter(p => p.approval === 'pending' || !p.approval).length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 10, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>PENDING REVIEW ({surveyPins.filter(p => p.approval === 'pending' || !p.approval).length})</div>
              {surveyPins.filter(p => p.approval === 'pending' || !p.approval).map(p => <ReviewPinRow key={p.id} pin={p} showActions={true} canApprove={canApprove} onApprove={onApprove} onDecline={onDecline} onPhotoNav={setPhotoNav}/>)}
            </>
          )}
          {approvedPins.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.done, letterSpacing: 2, marginBottom: 10, marginTop: 20, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>APPROVED ({approvedPins.length})</div>
              {approvedPins.map(p => <ReviewPinRow key={p.id} pin={p} showActions={false} canApprove={canApprove} onApprove={onApprove} onDecline={onDecline} onPhotoNav={setPhotoNav}/>)}
            </>
          )}
          {declinedPins.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.declined, letterSpacing: 2, marginBottom: 10, marginTop: 20, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>DECLINED ({declinedPins.length})</div>
              {declinedPins.map(p => <ReviewPinRow key={p.id} pin={p} showActions={false} canApprove={canApprove} onApprove={onApprove} onDecline={onDecline} onPhotoNav={setPhotoNav}/>)}
            </>
          )}
          {surveyPins.length === 0 && declinedPins.length === 0 && approvedPins.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '40px' }}>No survey pins to review</div>
          )}
        </div>
      </div>
      {photoNav && <PhotoNav photos={photoNav.photos} initIdx={photoNav.startIdx} onClose={() => setPhotoNav(null)}/>}
    </div>
  );
}
