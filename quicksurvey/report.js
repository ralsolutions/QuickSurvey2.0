// src/lib/report.js
// Client-side PDF survey report — no backend, works offline in the PWA.
// Requires: npm i jspdf
import { jsPDF } from 'jspdf';
import { RT, HAZARDS, HC, ST, SC, SL, getMeas } from './shared.js';

// ── palette (mirrors shared.js) ────────────────────────────────────────────
const NAVY = [17, 24, 39], NAVY2 = [30, 58, 95], BLUE = [37, 99, 235];
const MUTED = [148, 163, 184], INK = [31, 41, 55], SOFT = [75, 85, 99], LINE = [221, 225, 231];
const SCP = { torepair: [59, 130, 246], fixing: [139, 92, 246], done: [34, 197, 94] };
const HCP = { yellow: [217, 119, 6], orange: [234, 88, 12], red: [220, 38, 38] };
const HL  = { yellow: 'RECOMMENDATION', orange: 'URGENT', red: 'HAZARD' };
const DECLINED = [220, 38, 38];

const rtLabel = id => (RT.find(r => r.id === id) || { label: 'Other' }).label;
const slug = s => (s || 'survey').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/(^-|-$)/g, '');

// Draw all pins onto a copy of the elevation image, return a JPEG data-URL.
function compositeElevation(el) {
  return new Promise(resolve => {
    if (!el.img) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const r = Math.max(15, Math.round(Math.min(W, H) * 0.024));
      (el.pins || []).forEach(p => {
        const cx = (p.x / 100) * W, cy = (p.y / 100) * H;
        const col = (p.approval === 'declined') ? '#dc2626' : (HC[p.hazard] || '#6b7280');
        ctx.save();
        // soft shadow
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2.5, r * 0.16); ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 ' + Math.round(r * 1.05) + 'px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(p.id), cx, cy + r * 0.04);
      });
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(el.img);
    img.src = el.img;
  });
}

export async function generateSurveyPdf(project, { user } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const PW = 210, PH = 297, M = 14;
  let y = M, pageNo = 0;
  const setFill = c => doc.setFillColor(...c), setText = c => doc.setTextColor(...c), setDraw = c => doc.setDrawColor(...c);

  const footer = () => {
    pageNo++;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText(MUTED);
    doc.text('Quick Survey · ' + (project.company || project.user || ''), M, PH - 7);
    doc.text(project.name || '', PW / 2, PH - 7, { align: 'center' });
    doc.text('Page ' + pageNo, PW - M, PH - 7, { align: 'right' });
    setDraw(LINE); doc.setLineWidth(0.2); doc.line(M, PH - 10, PW - M, PH - 10);
  };
  const need = h => { if (y + h > PH - 14) { footer(); doc.addPage(); y = M; } };
  const chip = (x, yy, label, col, textCol = [255, 255, 255]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    const w = doc.getTextWidth(label) + 6;
    setFill(col); doc.roundedRect(x, yy - 3.4, w, 5, 1.2, 1.2, 'F');
    setText(textCol); doc.text(label, x + 3, yy);
    return w;
  };
  const statusChip = (p) => p.approval === 'declined'
    ? { label: 'DECLINED', col: DECLINED }
    : { label: (SL[p.status] || 'NEW').toUpperCase(), col: SCP[p.status] || SOFT };

  const dateStr = new Date(project.createdAt || Date.now()).toLocaleDateString('en-NZ',
    { day: 'numeric', month: 'short', year: 'numeric' });

  const elevations = (project.elevations || []).filter(e => (e.pins && e.pins.length) || e.img);
  const allPins = elevations.flatMap(e => e.pins || []);

  // ── COVER ──
  setFill(NAVY); doc.rect(0, 0, PW, 54, 'F');
  setFill(BLUE); doc.rect(0, 54, PW, 1.4, 'F');
  setText([71, 85, 105]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setCharSpace(2);
  doc.text('QUICK SURVEY', M, 20); doc.setCharSpace(0);
  setText([255, 255, 255]); doc.setFontSize(23);
  doc.text(project.name || 'Survey', M, 34, { maxWidth: PW - 2 * M });
  setText(MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Building Inspection Report', M, 44);
  y = 70;

  const meta = [
    ['CLIENT', project.client || '—'],
    ['DATE', dateStr],
    ['SURVEYOR', project.user || user?.name || '—'],
    ['COMPANY', project.company || user?.company || '—'],
  ];
  const colW = (PW - 2 * M) / 2;
  meta.forEach((m, i) => {
    const cx = M + (i % 2) * colW, cy = y + Math.floor(i / 2) * 16;
    setText(MUTED); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setCharSpace(1);
    doc.text(m[0], cx, cy); doc.setCharSpace(0);
    setText(INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text(String(m[1]), cx, cy + 6, { maxWidth: colW - 6 });
  });
  y += 40; setDraw(LINE); doc.setLineWidth(0.3); doc.line(M, y, PW - M, y); y += 12;

  const byStatus = Object.keys(SCP).map(k => [k, allPins.filter(p => p.status === k && p.approval !== 'declined').length]);
  const byHaz = Object.keys(HCP).map(k => [k, allPins.filter(p => p.hazard === k).length]);
  setText(INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(String(allPins.length), M, y);
  doc.setFontSize(11); setText(SOFT); doc.setFont('helvetica', 'normal');
  doc.text('defects logged across ' + elevations.length + ' elevation(s)', M + 8, y); y += 10;
  setText(MUTED); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setCharSpace(1.2);
  doc.text('BY STATUS', M, y); doc.setCharSpace(0); y += 5;
  let cx = M; byStatus.forEach(([k, n]) => { cx += chip(cx, y, (SL[k] || k).toUpperCase() + '  ' + n, SCP[k]) + 4; }); y += 9;
  setText(MUTED); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setCharSpace(1.2);
  doc.text('BY PRIORITY', M, y); doc.setCharSpace(0); y += 5;
  cx = M; byHaz.forEach(([k, n]) => { cx += chip(cx, y, HL[k] + '  ' + n, HCP[k]) + 4; });
  footer();

  // ── PER ELEVATION: marked image + defect schedule ──
  for (const el of elevations) {
    doc.addPage(); y = M;
    setFill(NAVY2); doc.roundedRect(M, y, PW - 2 * M, 9, 1.5, 1.5, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setCharSpace(1.5);
    doc.text('ELEVATION — ' + (el.name || '').toUpperCase(), M + 4, y + 6); doc.setCharSpace(0); y += 14;

    const marked = await compositeElevation(el);
    if (marked) {
      const pr = doc.getImageProperties(marked); const ar = pr.width / pr.height;
      let w = PW - 2 * M, h = w / ar; if (h > 150) { h = 150; w = h * ar; }
      const dx = M + (PW - 2 * M - w) / 2;
      doc.addImage(marked, 'JPEG', dx, y, w, h, undefined, 'FAST');
      setDraw(LINE); doc.setLineWidth(0.3); doc.rect(dx, y, w, h); y += h + 8;
    }

    const pins = el.pins || [];
    if (pins.length) {
      need(14);
      setText(MUTED); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setCharSpace(1.2);
      doc.text('DEFECT SCHEDULE', M, y); doc.setCharSpace(0); y += 2;
      setDraw(LINE); doc.line(M, y, PW - M, y); y += 6;
      const cols = [M + 6, M + 16, M + 94, M + 118, PW - M - 22];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText(SOFT);
      doc.text('#', cols[0], y, { align: 'center' }); doc.text('DEFECT', cols[1], y);
      doc.text('MEASURE', cols[2], y); doc.text('PRIORITY', cols[3], y); doc.text('STATUS', cols[4], y);
      y += 2; setDraw(LINE); doc.line(M, y, PW - M, y); y += 5;
      pins.forEach(p => {
        need(8);
        const hc = HCP[p.hazard] || SOFT;
        setFill(p.approval === 'declined' ? DECLINED : hc); doc.circle(cols[0], y - 1.3, 2.6, 'F');
        setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text(String(p.id), cols[0], y - 0.3, { align: 'center' });
        setText(INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(doc.splitTextToSize(p.repairName || 'Unnamed', 72)[0], cols[1], y);
        setText(SOFT); doc.setFontSize(8.5);
        doc.text(rtLabel(p.repairType) + ' · ' + getMeas(p), cols[2], y);
        setText(hc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text(HL[p.hazard] || '—', cols[3], y);
        const sc = statusChip(p); setText(sc.col); doc.text(sc.label, cols[4], y);
        y += 3; setDraw([238, 240, 244]); doc.line(M, y, PW - M, y); y += 5;
      });
    }
  }

  // ── PIN DETAILS ──
  doc.addPage(); y = M;
  setText(INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setCharSpace(1);
  doc.text('DEFECT DETAILS', M, y + 2); doc.setCharSpace(0); y += 6;
  setDraw(NAVY2); doc.setLineWidth(0.6); doc.line(M, y, PW - M, y); y += 9;

  for (const el of elevations) {
    for (const p of (el.pins || [])) {
      const hc = HCP[p.hazard] || SOFT;
      const commentLines = doc.splitTextToSize(p.comment || 'No comment.', PW - 2 * M);
      need(15 + 8 + commentLines.length * 4.4 + 8);
      // header bar
      setFill(p.approval === 'declined' ? DECLINED : hc); doc.roundedRect(M, y, PW - 2 * M, 11, 1.5, 1.5, 'F');
      doc.setFillColor(255, 255, 255); doc.circle(M + 7, y + 5.5, 4.2, 'F');
      setText(hc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(String(p.id), M + 7, y + 7, { align: 'center' });
      setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(p.repairName || 'Unnamed', M + 15, y + 7, { maxWidth: PW - 2 * M - 60 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text((el.name || '') + ' elevation', PW - M - 3, y + 7, { align: 'right' });
      y += 15;
      // meta chips
      let mx = M;
      mx += chip(mx, y, rtLabel(p.repairType).toUpperCase() + '  ' + getMeas(p), [71, 85, 105]) + 4;
      mx += chip(mx, y, HL[p.hazard] || '—', hc) + 4;
      const sc = statusChip(p); mx += chip(mx, y, sc.label, sc.col) + 4;
      if (p.createdBy) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText(MUTED); doc.text('by ' + p.createdBy, mx + 1, y); }
      y += 8;
      // comment
      setText(SOFT); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text(commentLines, M, y); y += commentLines.length * 4.4 + 4;
      if (p.approval === 'declined' && p.approvalComment) {
        const dl = doc.splitTextToSize('Declined: ' + p.approvalComment, PW - 2 * M);
        setText(DECLINED); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
        doc.text(dl, M, y); y += dl.length * 4 + 3;
      }
      // photos 2-up
      const photos = (p.surveyPhotos || []).filter(Boolean);
      if (photos.length) {
        const gap = 5, cw = (PW - 2 * M - gap) / 2, maxH = 62;
        for (let i = 0; i < photos.length; i += 2) {
          need(maxH * 0.6 + 6);
          const rowY = y; let rowH = 0;
          [photos[i], photos[i + 1]].forEach((ph, j) => {
            if (!ph) return;
            try {
              const pr = doc.getImageProperties(ph); const ar = pr.width / pr.height;
              let w = cw, h = w / ar; if (h > maxH) { h = maxH; w = h * ar; }
              const x = M + j * (cw + gap);
              doc.addImage(ph, 'JPEG', x, rowY, w, h, undefined, 'FAST');
              setDraw(LINE); doc.setLineWidth(0.2); doc.rect(x, rowY, w, h);
              rowH = Math.max(rowH, h);
            } catch (e) { /* skip bad image */ }
          });
          y = rowY + rowH + gap;
        }
      } else {
        setText(MUTED); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
        doc.text('No survey photos attached.', M, y); y += 5;
      }
      y += 5; setDraw(LINE); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y); y += 8;
    }
  }
  footer();

  // ── save / share ──
  const filename = 'survey-' + slug(project.name) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
  const blob = doc.output('blob');
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: project.name || 'Survey report' });
      return;
    }
  } catch (e) { /* fall through to download */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
