// Photo processing: compression and watermarking
//
// Heavy work runs in a Web Worker if available. The worker uses OffscreenCanvas + createImageBitmap.
// Falls back to main-thread <img>/<canvas> for browsers that don't support OffscreenCanvas
// (e.g. older iOS Safari).

import { RT } from './constants.js';
import { getMeas } from './helpers.js';
import { makePhotoId, dbPutPhoto } from './db.js';

let _worker = null;
let _workerSupported = null;

function getWorker() {
  if (_worker) return _worker;
  if (_workerSupported === false) return null;
  try {
    _worker = new Worker(new URL('../workers/photo.worker.js', import.meta.url), { type: 'module' });
    _workerSupported = true;
    return _worker;
  } catch (e) {
    _workerSupported = false;
    return null;
  }
}

// Test OffscreenCanvas support — Safari 16.4+ supports it but older iOS doesn't
function offscreenSupported() {
  try {
    return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
  } catch { return false; }
}

let _msgId = 0;
const _pending = new Map();

function workerCall(type, payload) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    if (!w || !offscreenSupported()) return reject(new Error('worker_unsupported'));
    const id = ++_msgId;
    _pending.set(id, { resolve, reject });
    w.postMessage({ id, type, ...payload });
  });
}

// Set up the single message handler once
function ensureWorkerListener() {
  const w = getWorker();
  if (!w || w.__listenerSetup) return;
  w.addEventListener('message', e => {
    const { id, ok, result, error } = e.data || {};
    const p = _pending.get(id);
    if (!p) return;
    _pending.delete(id);
    if (ok) p.resolve(result);
    else p.reject(new Error(error || 'worker_error'));
  });
  w.addEventListener('error', () => {
    // Reject everything pending if the worker crashes
    for (const p of _pending.values()) p.reject(new Error('worker_crashed'));
    _pending.clear();
    _worker = null;
    _workerSupported = false;
  });
  w.__listenerSetup = true;
}

// ── MAIN-THREAD FALLBACK ──────────────────────────────────────────────────────

function fallbackCompress(file, maxW = 900, quality = 0.5) {
  return new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(b => resolve(b || file), 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = ev.target.result;
    };
    fr.onerror = () => resolve(file);
    fr.readAsDataURL(file);
  });
}

function fallbackWatermark(blob, pinForLabel, userName) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      drawWatermarkOnContext(ctx, img.width, img.height, pinForLabel, userName);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve(b || blob); }, 'image/jpeg', 0.72);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

// Shared watermark drawing logic — used by both worker and fallback
function drawWatermarkOnContext(ctx, width, height, pin, userName) {
  const repType = (RT.find(r => r.id === pin.repairType) || { label: '' }).label;
  const line1 = '#' + pin.id + '  ' + (pin.repairName || 'Repair') + '  ' + repType + '  ' + getMeas(pin);
  const line2 = new Date().toLocaleString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line3 = userName || 'User';
  const fs = Math.max(20, Math.round(height * 0.033));
  const lh = Math.round(fs * 1.6);
  const pad = Math.round(fs * 0.75);
  const stripH = lh * 3 + pad * 2;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, height - stripH, width, stripH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, height - stripH, Math.max(5, Math.round(width * 0.005)), stripH);
  const tx = pad + Math.max(5, Math.round(width * 0.005)) + 6;
  ctx.font = '700 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line1, tx, height - stripH + pad + fs);
  ctx.font = '400 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(line2, tx, height - stripH + pad + lh + fs);
  ctx.font = '600 ' + fs + 'px Arial,sans-serif';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(line3, tx, height - stripH + pad + lh * 2 + fs);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

// Compress a File or Blob to a smaller JPEG Blob
export async function compress(input, maxW = 1600, quality = 0.7) {
  if (offscreenSupported() && getWorker()) {
    try {
      ensureWorkerListener();
      // For File/Blob we send it directly — the worker uses createImageBitmap
      const result = await workerCall('compress', { blob: input, maxW, quality });
      return result;
    } catch {
      // Fall through to main-thread
    }
  }
  return fallbackCompress(input, maxW, quality);
}

// Apply watermark overlay (compresses first as part of the pipeline)
export async function watermark(blob, pinForLabel, userName) {
  if (offscreenSupported() && getWorker()) {
    try {
      ensureWorkerListener();
      // Send pin metadata to the worker so it can label the image
      const labelData = {
        id: pinForLabel.id,
        repairName: pinForLabel.repairName,
        repairType: pinForLabel.repairType,
        repairTypeLabel: (RT.find(r => r.id === pinForLabel.repairType) || { label: '' }).label,
        measurement: getMeas(pinForLabel),
        userName: userName || 'User',
      };
      const result = await workerCall('watermark', { blob, labelData });
      return result;
    } catch {
      // Fall through
    }
  }
  // Compress first, then watermark
  const compressed = await fallbackCompress(blob, 900, 0.5);
  return fallbackWatermark(compressed, pinForLabel, userName);
}

// Save a watermarked photo to IndexedDB and return its photo id
export async function processAndStorePhoto(blob, pinForLabel, userName, projectId) {
  const wmBlob = await watermark(blob, pinForLabel, userName);
  const photoId = makePhotoId();
  await dbPutPhoto(photoId, wmBlob, projectId);
  return photoId;
}

// Save a plain compressed photo (no watermark) — used for elevation images
export async function processAndStoreElevationPhoto(blob, projectId) {
  const compressed = await compress(blob, 1600, 0.7);
  const photoId = makePhotoId();
  await dbPutPhoto(photoId, compressed, projectId);
  return photoId;
}
