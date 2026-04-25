// Photo processing worker — runs off main thread
//
// Receives messages: { id, type: 'compress' | 'watermark', blob, ... }
// Uses createImageBitmap + OffscreenCanvas (supported in modern browsers).

self.onmessage = async (e) => {
  const { id, type, blob, maxW, quality, labelData } = e.data;

  try {
    if (type === 'compress') {
      const result = await compressBlob(blob, maxW || 900, quality || 0.5);
      self.postMessage({ id, ok: true, result });
    } else if (type === 'watermark') {
      // Watermarking pipeline: compress → draw overlay → output
      const compressed = await compressBlob(blob, 900, 0.5);
      const stamped = await stampBlob(compressed, labelData);
      self.postMessage({ id, ok: true, result: stamped });
    } else {
      self.postMessage({ id, ok: false, error: 'unknown_type' });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
};

async function compressBlob(blob, maxW, quality) {
  const bitmap = await createImageBitmap(blob);
  const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await canvas.convertToBlob({ type: 'image/jpeg', quality });
}

async function stampBlob(blob, labelData) {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width, h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const line1 = '#' + labelData.id + '  ' + (labelData.repairName || 'Repair') + '  ' + labelData.repairTypeLabel + '  ' + labelData.measurement;
  const line2 = new Date().toLocaleString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line3 = labelData.userName || 'User';

  const fs = Math.max(20, Math.round(h * 0.033));
  const lh = Math.round(fs * 1.6);
  const pad = Math.round(fs * 0.75);
  const stripH = lh * 3 + pad * 2;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, h - stripH, w, stripH);

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, h - stripH, Math.max(5, Math.round(w * 0.005)), stripH);

  const tx = pad + Math.max(5, Math.round(w * 0.005)) + 6;

  ctx.font = '700 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line1, tx, h - stripH + pad + fs);

  ctx.font = '400 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(line2, tx, h - stripH + pad + lh + fs);

  ctx.font = '600 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(line3, tx, h - stripH + pad + lh * 2 + fs);

  return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
}
