// All shared utilities — copied straight from the working single-file version.
// No logic changes, only `import { useState, useEffect, ... } from 'react'`
// replaces the destructure of React.

import { useState, useEffect, useRef, useCallback } from 'react';

export const SKEY_USER = 'ral-qs-user-v7';
export const APP_VERSION = 'v8';

// Debounce utility for persistence
export function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  const call = useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { fnRef.current(...args); timerRef.current = null; }, delay);
  }, [delay]);
  const flush = useCallback((...args) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    fnRef.current(...args);
  }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return [call, flush];
}

export const C = {
  bg: '#e4e7ec', surface: '#f5f6f8', card: '#ffffff',
  navyDark: '#111827', navyMid: '#1e3a5f',
  blue: '#2563eb', blueDim: '#2563eb12', blueBorder: '#2563eb40',
  border: '#dde1e7', borderDark: '#c4c9d4',
  text: '#111827', textDim: '#4b5563', textMuted: '#9ca3af',
  torepair: '#3b82f6', fixing: '#8b5cf6', done: '#22c55e',
  declined: '#dc2626',
  greyPin: '#9ca3af',
};

export function useIsMobile(bp = 900) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

export const ST = { TOREPAIR: 'torepair', FIXING: 'fixing', DONE: 'done' };
export const SC = { torepair: C.torepair, fixing: C.fixing, done: C.done };
export const SL = { torepair: 'To Repair', fixing: 'Fixing', done: 'Done' };

export const ROLES = [
  { id: 'admin', label: 'Admin', desc: 'Full control' },
  { id: 'manager', label: 'Manager', desc: 'Create projects, manage crew' },
  { id: 'crew', label: 'Crew', desc: 'Survey & repair work' },
  { id: 'client', label: 'Client', desc: 'Review & approve surveys' },
];

export const RT = [
  { id: 'volumen', label: 'Volume', unit: 'L',
    fields: [{ k: 'largo', l: 'Length (mm)' }, { k: 'ancho', l: 'Width (mm)' }, { k: 'prof', l: 'Depth (mm)' }],
    calc: d => { const v = (parseFloat(d.largo || 0) * parseFloat(d.ancho || 0) * parseFloat(d.prof || 0)) / 1000000; return v > 0 ? v.toFixed(3) + ' L' : '—'; } },
  { id: 'area', label: 'Area', unit: 'm²',
    fields: [{ k: 'd1', l: 'Dim 1 (mm)' }, { k: 'd2', l: 'Dim 2 (mm)' }],
    calc: d => { const a = (parseFloat(d.d1 || 0) * parseFloat(d.d2 || 0)) / 1000000; return a > 0 ? a.toFixed(4) + ' m²' : '—'; } },
  { id: 'linear', label: 'Linear m', unit: 'm',
    fields: [{ k: 'len', l: 'Length (mm)' }],
    calc: d => { const m = parseFloat(d.len || 0) / 1000; return m > 0 ? m.toFixed(3) + ' m' : '—'; } },
  { id: 'cantidad', label: 'Qty', unit: 'ud',
    fields: [{ k: 'qty', l: 'Quantity' }],
    calc: d => parseFloat(d.qty || 0) > 0 ? parseFloat(d.qty || 0).toFixed(0) + ' ud' : '—' },
  { id: 'other', label: 'Other', unit: '—',
    fields: [],
    calc: () => '—' },
];

export const HAZARDS = [
  { id: 'yellow', label: 'Recommendation', color: '#d97706' },
  { id: 'orange', label: 'Urgent', color: '#ea580c' },
  { id: 'red', label: 'Hazard', color: '#dc2626' },
];
export const HC = { yellow: '#d97706', orange: '#ea580c', red: '#dc2626' };

export const pCol = (p, currentUser) => {
  if (p.approval === 'declined') return C.declined;
  if (currentUser && p.createdBy && p.createdBy !== currentUser) return C.greyPin;
  return HC[p.hazard] || '#6b7280';
};

export const getMeas = (pin, m) => {
  const r = RT.find(r => r.id === pin.repairType);
  if (!r || !(m || pin.measurements)) return '—';
  return r.calc(m || pin.measurements);
};

export const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NZ') + ' ' + d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
};

// ── INDEXEDDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'ral-quicksurvey';
const DB_VER = 1;
const STORE = 'projects';
const PRICE_STORE = 'prices';
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PRICE_STORE)) db.createObjectStore(PRICE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbPut(project) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(project);
    req.onsuccess = () => res();
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror = e => rej(e.target.error);
  });
}

export async function dbGetPrices(projectId) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(PRICE_STORE, 'readonly');
    const req = tx.objectStore(PRICE_STORE).get(projectId);
    req.onsuccess = e => res(e.target.result ? e.target.result.prices : {});
    req.onerror = () => res({});
  });
}

export async function dbSavePrices(projectId, prices) {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(PRICE_STORE, 'readwrite');
    tx.objectStore(PRICE_STORE).put({ id: projectId, prices });
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

// ── JSON EXPORT / IMPORT ──────────────────────────────────────────────────────
export async function exportProject(project) {
  const prices = await dbGetPrices(project.id).catch(() => ({}));
  const bundle = {
    _type: 'ral-quicksurvey-export',
    _version: 1,
    _exportedAt: new Date().toISOString(),
    project,
    prices,
  };
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quicksurvey-' + (project.name || 'project').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export async function importProjectFromFile(file) {
  const text = await file.text();
  const bundle = JSON.parse(text);
  if (bundle._type !== 'ral-quicksurvey-export' || !bundle.project) throw new Error('Invalid Quick Survey export file');
  const p = bundle.project;
  const newId = Date.now().toString();
  const imported = { ...p, id: newId, _importedFrom: p.id, _importedAt: new Date().toISOString(), name: p.name + ' (imported)' };
  await dbPut(imported);
  if (bundle.prices && Object.keys(bundle.prices).length > 0) await dbSavePrices(newId, bundle.prices);
  return imported;
}

// ── COMPRESS ──────────────────────────────────────────────────────────────────
export async function compress(dataUrl, maxW = 900, quality = 0.5) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── WATERMARK ─────────────────────────────────────────────────────────────────
export async function wm(dataUrl, pin, userName) {
  const compressed = await compress(dataUrl);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const repType = (RT.find(r => r.id === pin.repairType) || { label: '' }).label;
      const line1 = '#' + pin.id + '  ' + (pin.repairName || 'Repair') + '  ' + repType + '  ' + getMeas(pin);
      const line2 = new Date().toLocaleString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const line3 = userName || 'User';
      const fs = Math.max(20, Math.round(img.height * 0.033));
      const lh = Math.round(fs * 1.6);
      const pad = Math.round(fs * 0.75);
      const stripH = lh * 3 + pad * 2;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, img.height - stripH, img.width, stripH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, img.height - stripH, Math.max(5, Math.round(img.width * 0.005)), stripH);
      const tx = pad + Math.max(5, Math.round(img.width * 0.005)) + 6;
      ctx.font = '700 ' + fs + 'px Arial,sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line1, tx, img.height - stripH + pad + fs);
      ctx.font = '400 ' + fs + 'px Arial,sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(line2, tx, img.height - stripH + pad + lh + fs);
      ctx.font = '600 ' + fs + 'px Arial,sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(line3, tx, img.height - stripH + pad + lh * 2 + fs);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(compressed);
    img.src = compressed;
  });
}

// ── STYLES ────────────────────────────────────────────────────────────────────
export const IS = { width: '100%', background: C.card, border: '1px solid ' + C.border, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'Barlow,sans-serif' };
export const LS = { fontSize: 10, color: C.textDim, display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: 1.2 };

// Strip everything except digits and a single decimal point — used in measurement inputs
// to prevent users from typing letters or symbols (especially on iOS where the keyboard
// shows extra chars on a "number" input).
export function cleanNumeric(raw) {
  if (raw == null) return '';
  let v = String(raw).replace(/[^0-9.]/g, '');
  // Keep only the first decimal point
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  }
  return v;
}

export const TEST_USERS = [
  { name: 'Lionel Melo', company: 'Altitude Access', initials: 'LM' },
  { name: 'John Smith', company: 'Altitude Access', initials: 'JS' },
];
