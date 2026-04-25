import { useState, useEffect, useRef, useCallback } from 'react';
import { C, HC, RT } from './constants.js';

// ── DATE ──────────────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NZ') + ' ' + d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

// ── PIN HELPERS ───────────────────────────────────────────────────────────────
export function pCol(p, currentUser) {
  if (p.approval === 'declined') return C.declined;
  if (currentUser && p.createdBy && p.createdBy !== currentUser) return C.greyPin;
  return HC[p.hazard] || '#6b7280';
}

export function getMeas(pin, m) {
  const r = RT.find(r => r.id === pin.repairType);
  if (!r || !(m || pin.measurements)) return '—';
  return r.calc(m || pin.measurements);
}

// ── HOOKS ─────────────────────────────────────────────────────────────────────

// Detect mobile based on viewport width
export function useIsMobile(bp = 900) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

// Debounced callback — useful for delaying writes to IndexedDB
export function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const call = useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fnRef.current(...args);
      timerRef.current = null;
    }, delay);
  }, [delay]);

  const flush = useCallback((...args) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    fnRef.current(...args);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return [call, flush];
}

// Online/offline status
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
