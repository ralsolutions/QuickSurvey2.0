import { useState, useRef, useEffect } from 'react';
import {
  C, ST, SC, SL, HC, HAZARDS, RT,
  SKEY_USER, IS,
  useIsMobile, useDebouncedCallback,
  pCol, getMeas,
  dbPut, compress,
} from './lib/shared.js';

import { UserSetup } from './components/UserSetup.jsx';
import { HomeScreen } from './components/HomeScreen.jsx';
import { Setup } from './components/Setup.jsx';
import { PinModal } from './components/PinModal.jsx';
import { TrashPanel } from './components/TrashPanel.jsx';
import { SurveyReview } from './components/SurveyReview.jsx';
import { SummaryTable } from './components/SummaryTable.jsx';
import { RoleSwitcher } from './components/RoleSwitcher.jsx';
import { Marker, Toast } from './components/Marker.jsx';

// PWA install prompt — capture beforeinstallprompt globally so RoleSwitcher can offer install
let _deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    window.__qsInstallAvailable = true;
    window.dispatchEvent(new Event('qs-install-available'));
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    window.__qsInstallAvailable = false;
    window.dispatchEvent(new Event('qs-install-done'));
  });
  window.__qsInstallApp = async () => {
    if (!_deferredPrompt) return false;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    window.__qsInstallAvailable = false;
    window.dispatchEvent(new Event('qs-install-done'));
    return outcome === 'accepted';
  };
}

export default function App() {
  const isMobile = useIsMobile();
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const [user, setUser] = useState(() => { try { const s = localStorage.getItem(SKEY_USER); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [screen, setScreen] = useState('home');
  const [project, setProject] = useState(null);
  const [rl, setRl] = useState([]);
  const [ae, setAe] = useState(0);
  const [mode, setMode] = useState('pan');
  const [movId, setMovId] = useState(null);
  const [dupFromId, setDupFromId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan_, setPan] = useState({ x: 0, y: 0 });
  const [selPin, setSelPin] = useState(null);
  const [modal, setModal] = useState(null);
  const [nid, setNid] = useState(1);
  const [csz, setCsz] = useState({ w: 800, h: 600 });
  const [imgDims, setImgDims] = useState({ w: 1, h: 1 });
  const [showT, setShowT] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  const [toast, setToast] = useState(null);
  const cRef = useRef(null);
  const iRef = useRef(null);
  const undoStackRef = useRef([]);

  const gestureRef = useRef({ panning: false, pinching: false, tapCandidate: false, moved: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, startDist: 0, startZoom: 1, startMidX: 0, startMidY: 0, tapPos: null });

  // Canvas ResizeObserver
  useEffect(() => {
    const obs = new ResizeObserver(entries => { for (const e of entries) setCsz({ w: e.contentRect.width, h: e.contentRect.height }); });
    if (cRef.current) obs.observe(cRef.current);
    return () => obs.disconnect();
  }, []);

  // Image ResizeObserver
  useEffect(() => {
    const img = iRef.current;
    if (!img) return;
    const update = () => setImgDims({ w: img.offsetWidth || 1, h: img.offsetHeight || 1 });
    update();
    const obs = new ResizeObserver(update);
    obs.observe(img);
    return () => obs.disconnect();
  }, [project, ae, screen]);

  // Debounced persistence
  const [persistDebounced, persistFlush] = useDebouncedCallback((p) => { dbPut(p).catch(e => console.error('persist failed', e)); }, 400);

  useEffect(() => {
    const h = () => { persistFlush && persistFlush(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [persistFlush]);

  // Refs that mirror state for use inside event handlers (avoid stale closures)
  const modeRef = useRef(mode); useEffect(() => { modeRef.current = mode; }, [mode]);
  const movIdRef = useRef(movId); useEffect(() => { movIdRef.current = movId; }, [movId]);
  const dupFromIdRef = useRef(dupFromId); useEffect(() => { dupFromIdRef.current = dupFromId; }, [dupFromId]);

  const saveUser = u => { setUser(u); localStorage.setItem(SKEY_USER, JSON.stringify(u)); };
  const switchRole = r => { const nu = { ...user, role: r }; saveUser(nu); };
  const switchUser = u => { const nu = { ...user, name: u.name, company: u.company }; saveUser(nu); };
  const logout = () => { localStorage.removeItem(SKEY_USER); setUser(null); setScreen('home'); setProject(null); };

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const persist = p => persistDebounced(p);
  const persistNow = p => { persistFlush(p); };
  const openProject = p => { setProject(p); setRl(p.repairList || []); const maxId = p.elevations.flatMap(e => [...(e.pins || []), ...(e.trash || [])]).reduce((m, pi) => Math.max(m, pi.id), 0); setNid(maxId + 1); setAe(0); setMode('pan'); setScreen('survey'); undoStackRef.current = []; };
  const createProject = (name, names) => { const p = { id: Date.now().toString(), name, createdAt: new Date().toISOString(), user: user?.name, company: user?.company, repairList: [], elevations: names.map(n => ({ name: n, img: null, pins: [], trash: [] })) }; persistNow(p); openProject(p); };

  const el = project?.elevations[ae];
  const upd = (i, fn) => { setProject(p => { const e = [...p.elevations]; e[i] = fn(e[i]); const np = { ...p, elevations: e }; persist(np); return np; }); };
  const onPhoto = e => { const f = e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = async ev => { const b64 = await compress(ev.target.result, 1600, 0.7); upd(ae, el => ({ ...el, img: b64 })); setZoom(1); setPan({ x: 0, y: 0 }); }; fr.readAsDataURL(f); };

  const isClient = user?.role === 'client';
  const canEdit = !isClient;
  const canPin = canEdit;

  const pushUndo = (action) => { undoStackRef.current.push(action); if (undoStackRef.current.length > 20) undoStackRef.current.shift(); };
  const undo = () => { const action = undoStackRef.current.pop(); if (!action) { showToast('Nothing to undo'); return; } action(); };

  const clickCoords = e => {
    if (el?.img) { const img = iRef.current; if (!img) return null; const r = img.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100; if (x < 0 || x > 100 || y < 0 || y > 100) return null; return { x, y }; }
    else { const c = cRef.current; if (!c) return null; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; }
  };
  const tapCoordsFromClient = (cx, cy) => {
    if (el?.img) { const img = iRef.current; if (!img) return null; const r = img.getBoundingClientRect(); const x = (cx - r.left) / r.width * 100, y = (cy - r.top) / r.height * 100; if (x < 0 || x > 100 || y < 0 || y > 100) return null; return { x, y }; }
    else { const c = cRef.current; if (!c) return null; const r = c.getBoundingClientRect(); return { x: (cx - r.left) / r.width * 100, y: (cy - r.top) / r.height * 100 }; }
  };

  const placeOrHandleCoords = coords => {
    const m = modeRef.current;
    const mv = movIdRef.current;
    const dup = dupFromIdRef.current;

    if (dup !== null && canPin) {
      const source = el?.pins.find(p => p.id === dup);
      if (!source) { setDupFromId(null); return; }
      const clone = {
        ...source,
        id: nid,
        x: coords.x, y: coords.y,
        createdBy: user.name,
        status: ST.TOREPAIR,
        approval: 'pending',
        approvalComment: '',
        fixingComment: '',
        doneComment: '',
        surveyPhotos: [], fixingPhotos: [], donePhotos: [],
        _justDuplicated: true,
      };
      const elevIdx = ae;
      const newId = nid;
      upd(elevIdx, el => ({ ...el, pins: [...el.pins, clone] }));
      setNid(n => n + 1);
      setDupFromId(null);
      setModal(clone);
      showToast('⎘ Duplicated as pin #' + newId + ' — add new survey photos');
      pushUndo(() => { upd(elevIdx, el => ({ ...el, pins: el.pins.filter(pi => pi.id !== newId) })); showToast('↶ Undid duplicate #' + newId); });
      return;
    }

    if (m === 'pin' && canPin) {
      const p = { id: nid, x: coords.x, y: coords.y, repairName: '', repairType: 'linear', measurements: {}, comment: '', hazard: 'yellow', status: ST.TOREPAIR, approval: 'pending', createdBy: user.name, surveyPhotos: [], fixingPhotos: [], donePhotos: [] };
      const elevIdx = ae;
      const newId = nid;
      upd(elevIdx, el => ({ ...el, pins: [...el.pins, p] }));
      setNid(n => n + 1);
      setModal(p);
      pushUndo(() => { upd(elevIdx, el => ({ ...el, pins: el.pins.filter(pi => pi.id !== newId) })); showToast('↶ Undid pin #' + newId); });
    } else if (m === 'move-pin' && mv) {
      const prevPin = el?.pins.find(p => p.id === mv);
      const prevPos = prevPin ? { x: prevPin.x, y: prevPin.y } : null;
      const elevIdx = ae;
      const movedId = mv;
      upd(elevIdx, el => ({ ...el, pins: el.pins.map(p => p.id === movedId ? { ...p, ...coords } : p) }));
      setMovId(null);
      showToast('✓ Pin #' + movedId + ' repositioned');
      if (prevPos) {
        pushUndo(() => { upd(elevIdx, el => ({ ...el, pins: el.pins.map(p => p.id === movedId ? { ...p, ...prevPos } : p) })); showToast('↶ Undid move of pin #' + movedId); });
      }
    }
  };

  const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(8, Math.max(0.3, z * (e.deltaY > 0 ? 0.85 : 1.18)))); };
  const mouseDragRef = useRef({ dragging: false, sx: 0, sy: 0, spx: 0, spy: 0 });
  const onMouseDown = e => { if (modeRef.current !== 'pan' || isMobile) return; mouseDragRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, spx: pan_.x, spy: pan_.y }; };
  const onMouseMove = e => { if (!mouseDragRef.current.dragging) return; const d = mouseDragRef.current; setPan({ x: d.spx + (e.clientX - d.sx), y: d.spy + (e.clientY - d.sy) }); };
  const onMouseUp = () => { mouseDragRef.current.dragging = false; };
  const onCanvasClick = e => {
    if (mouseDragRef.current.sx !== undefined) { const moved = Math.abs(e.clientX - mouseDragRef.current.sx) > 3 || Math.abs(e.clientY - mouseDragRef.current.sy) > 3; if (moved) { mouseDragRef.current.sx = undefined; return; } }
    const coords = clickCoords(e); if (coords) placeOrHandleCoords(coords);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (isMobile) return;
    const handler = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      if (modal || showT || showTrash || showReview || showRole || showMore || showIndex) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'p' && canPin) { e.preventDefault(); setMode('pin'); setMovId(null); }
      else if (k === 'm' && canEdit) { e.preventDefault(); setMode('move-pin'); }
      else if (k === 'd' && canEdit) { e.preventDefault(); setMode('delete-pin'); setMovId(null); }
      else if (k === 'v' || k === 'h') { e.preventDefault(); setMode('pan'); setMovId(null); }
      else if (k === 'escape') { e.preventDefault(); setMode('pan'); setMovId(null); setSelPin(null); setDupFromId(null); }
      else if (k === 's') { e.preventDefault(); setShowReview(true); }
      else if (k === 'r') { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, canPin, canEdit, modal, showT, showTrash, showReview, showRole, showMore, showIndex]);

  // Touch handlers
  useEffect(() => {
    const c = cRef.current; if (!c) return;
    const g = gestureRef.current;
    const dist = (t1, t2) => { const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY; return Math.sqrt(dx * dx + dy * dy); };
    const mid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });

    const ts = e => {
      if (e.touches.length === 1) { const t = e.touches[0]; g.panning = (modeRef.current === 'pan'); g.pinching = false; g.tapCandidate = true; g.moved = false; g.startX = t.clientX; g.startY = t.clientY; g.startPanX = pan_.x; g.startPanY = pan_.y; g.tapPos = { cx: t.clientX, cy: t.clientY }; }
      else if (e.touches.length === 2) { e.preventDefault(); g.panning = false; g.pinching = true; g.tapCandidate = false; g.startDist = dist(e.touches[0], e.touches[1]); g.startZoom = zoom; const m = mid(e.touches[0], e.touches[1]); g.startMidX = m.x; g.startMidY = m.y; g.startPanX = pan_.x; g.startPanY = pan_.y; }
    };
    const tm = e => {
      if (g.pinching && e.touches.length >= 2) { e.preventDefault(); const d = dist(e.touches[0], e.touches[1]); const ratio = d / g.startDist; const newZoom = Math.min(8, Math.max(0.3, g.startZoom * ratio)); setZoom(newZoom); const m = mid(e.touches[0], e.touches[1]); setPan({ x: g.startPanX + (m.x - g.startMidX), y: g.startPanY + (m.y - g.startMidY) }); }
      else if (g.panning && e.touches.length === 1) { const t = e.touches[0]; const dx = t.clientX - g.startX, dy = t.clientY - g.startY; if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { g.moved = true; g.tapCandidate = false; e.preventDefault(); setPan({ x: g.startPanX + dx, y: g.startPanY + dy }); } }
    };
    const te = e => {
      if (g.tapCandidate && !g.moved && g.tapPos) { const coords = tapCoordsFromClient(g.tapPos.cx, g.tapPos.cy); if (coords) placeOrHandleCoords(coords); }
      if (e.touches.length === 0) { g.panning = false; g.pinching = false; g.tapCandidate = false; g.moved = false; g.tapPos = null; }
      else if (e.touches.length === 1 && g.pinching) { g.pinching = false; g.panning = (modeRef.current === 'pan'); g.startX = e.touches[0].clientX; g.startY = e.touches[0].clientY; g.startPanX = pan_.x; g.startPanY = pan_.y; g.tapCandidate = false; }
    };

    c.addEventListener('touchstart', ts, { passive: false });
    c.addEventListener('touchmove', tm, { passive: false });
    c.addEventListener('touchend', te, { passive: false });
    c.addEventListener('touchcancel', te, { passive: false });
    return () => { c.removeEventListener('touchstart', ts); c.removeEventListener('touchmove', tm); c.removeEventListener('touchend', te); c.removeEventListener('touchcancel', te); };
  }, [mode, pan_.x, pan_.y, zoom, el?.img, nid, movId, ae]);

  const onPin = id => {
    if (dupFromId !== null) {
      const targetPin = el?.pins.find(p => p.id === id);
      if (targetPin) { placeOrHandleCoords({ x: targetPin.x + 3, y: targetPin.y }); }
      return;
    }
    if (mode === 'move-pin') {
      if (!movId) { setMovId(id); showToast('Tap where to place pin #' + id); }
      else { setMovId(id); showToast('Now moving pin #' + id); }
      return;
    }
    if (mode === 'delete-pin') {
      const pin = el.pins.find(p => p.id === id);
      const name = pin ? pin.repairName || ('Pin #' + id) : 'Pin #' + id;
      if (!confirm('Move "' + name + '" to trash?')) return;
      const elevIdx = ae;
      const pinCopy = { ...pin };
      upd(elevIdx, el => ({ ...el, pins: el.pins.filter(p => p.id !== id), trash: [...(el.trash || []), { ...pinCopy, deletedAt: new Date().toISOString() }] }));
      setMode('pan');
      showToast('🗑 Pin #' + id + ' moved to trash');
      pushUndo(() => { upd(elevIdx, el => ({ ...el, pins: [...el.pins, pinCopy], trash: (el.trash || []).filter(t => t.id !== id) })); showToast('↶ Restored pin #' + id); });
      return;
    }
    setSelPin(id); const p = el.pins.find(p => p.id === id); if (p) setModal({ ...p });
  };
  const savePin = u => { upd(ae, el => ({ ...el, pins: el.pins.map(p => p.id === u.id ? u : p) })); setModal(null); setSelPin(null); };
  const duplicatePin = id => { setModal(null); setSelPin(null); setDupFromId(id); setMode('pan'); setMovId(null); showToast('⎘ Tap on the canvas to place a copy of pin #' + id); };
  const trashPin = id => {
    const pin = el.pins.find(p => p.id === id); if (!pin) return;
    const elevIdx = ae;
    const pinCopy = { ...pin };
    upd(elevIdx, el => ({ ...el, pins: el.pins.filter(p => p.id !== id), trash: [...(el.trash || []), { ...pinCopy, deletedAt: new Date().toISOString() }] }));
    setModal(null); setSelPin(null); showToast('🗑 Pin #' + id + ' moved to trash');
    pushUndo(() => { upd(elevIdx, el => ({ ...el, pins: [...el.pins, pinCopy], trash: (el.trash || []).filter(t => t.id !== id) })); showToast('↶ Restored pin #' + id); });
  };
  const restorePin = (elevIdx, pinId) => { upd(elevIdx, el => { const pin = (el.trash || []).find(p => p.id === pinId); if (!pin) return el; const { deletedAt, ...r } = pin; return { ...el, pins: [...el.pins, r], trash: (el.trash || []).filter(p => p.id !== pinId) }; }); showToast('✓ Pin restored'); };
  const addRT = r => { const nl = rl.find(x => x.name === r.name) ? rl : [...rl, r]; setRl(nl); setProject(p => { const np = { ...p, repairList: nl }; persist(np); return np; }); };

  const updateApproval = (pinId, patch, msg) => {
    setProject(p => { const np = { ...p, elevations: p.elevations.map(el => ({ ...el, pins: el.pins.map(pi => pi.id === pinId ? { ...pi, ...patch } : pi) })) }; persist(np); return np; });
    showToast(msg);
  };
  const approvePin = pinId => updateApproval(pinId, { approval: 'approved' }, '✓ Pin #' + pinId + ' approved');
  const declinePin = (pinId, comment) => updateApproval(pinId, { approval: 'declined', approvalComment: comment || '' }, '✗ Pin #' + pinId + ' declined');

  // ── ROUTING ── (after all hooks, before any rendering)
  if (!user) return <UserSetup onDone={u => saveUser(u)}/>;
  if (screen === 'home') return <HomeScreen onOpen={openProject} onCreate={() => setScreen('setup')} user={user} onRoleSwitch={switchRole} onSwitchUser={switchUser} onLogout={logout}/>;
  if (screen === 'setup') return <Setup onDone={createProject} onBack={() => setScreen('home')}/>;

  const pins = el?.pins || [];
  const trashCount = project.elevations.reduce((s, e) => s + (e.trash || []).length, 0);
  const iW = imgDims.w, iH = imgDims.h;
  const total = project.elevations.reduce((s, e) => s + (e.pins || []).length, 0);
  const hint = isClient ? '👁 View only' : (dupFromId !== null ? '⎘ Tap on the canvas to place a copy of pin #' + dupFromId : (mode === 'pin' ? (isMobile ? '📍 Tap to place a pin' : '📍 Click to place a pin') : mode === 'move-pin' ? (movId ? 'Moving #' + movId + ' — tap destination' : 'Tap a pin to select it') : mode === 'delete-pin' ? '🗑 Tap a pin to trash it' : (isMobile ? '✋ Drag to pan · pinch to zoom' : '✋ Drag to pan · scroll to zoom')));

  const modes = canEdit ? [
    { id: 'pan', i: '✋', l: 'Pan / View' },
    { id: 'pin', i: '📍', l: 'Add Pin' },
    { id: 'move-pin', i: '↔', l: 'Move Pin' },
    { id: 'delete-pin', i: '🗑', l: 'Delete Pin', danger: true }
  ] : [{ id: 'pan', i: '✋', l: 'Pan / View' }];

  const statusCounts = { [ST.TOREPAIR]: pins.filter(p => p.status === ST.TOREPAIR).length, [ST.FIXING]: pins.filter(p => p.status === ST.FIXING).length, [ST.DONE]: pins.filter(p => p.status === ST.DONE).length };

  // ─── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden', userSelect: 'none' }}>
        <div style={{ background: C.navyDark, padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setScreen('home')} style={{ background: 'none', border: '1px solid #1e3a5f', borderRadius: 6, color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: '6px 10px', minWidth: 40, minHeight: 36 }}>⌂</button>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0, padding: '0 10px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{project.name}</div>
            <div style={{ fontSize: 9, color: '#475569', fontFamily: 'DM Mono' }}>{user.name} · <span style={{ color: user.role === 'client' ? '#fbbf24' : '#93c5fd' }}>{user.role.toUpperCase()}</span></div>
          </div>
          <button onClick={() => setShowIndex(true)} disabled={pins.length === 0} style={{ background: pins.length ? C.blueDim : 'transparent', border: '1px solid ' + (pins.length ? '#1e3a5f' : '#1e3a5f44'), borderRadius: 6, color: pins.length ? '#93c5fd' : '#334155', fontSize: 11, cursor: 'pointer', padding: '6px 10px', minWidth: 40, minHeight: 36, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>≡ {pins.length || ''}</button>
        </div>

        <div style={{ display: 'flex', background: C.card, borderBottom: '1px solid ' + C.border, overflowX: 'auto', flexShrink: 0 }}>
          {project.elevations.map((e, i) => {
            const ep = e.pins || []; const ed = ep.filter(p => p.status === ST.DONE).length;
            return (
              <button key={i} onClick={() => { setAe(i); setMode("pan"); setMovId(null); setDupFromId(null); setSelPin(null); setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{ padding: '10px 14px', border: 'none', borderBottom: '3px solid ' + (i === ae ? C.navyDark : 'transparent'), background: 'transparent', color: i === ae ? C.navyDark : C.textDim, fontSize: 13, fontWeight: i === ae ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Barlow Condensed', minHeight: 44 }}>
                {e.name.toUpperCase()}
                {ep.length > 0 && <span style={{ fontSize: 10, color: i === ae ? C.navyMid : C.textMuted, background: i === ae ? C.blueDim : '#f3f4f6', padding: '1px 6px', borderRadius: 8, fontFamily: 'DM Mono' }}>{ed}/{ep.length}</span>}
              </button>
            );
          })}
        </div>

        <div ref={cRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#d8dce4', touchAction: 'none' }}>
          {!el?.img ? (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(' + C.border + ' 1px,transparent 1px),linear-gradient(90deg,' + C.border + ' 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.8 }}/>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none', padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 48, opacity: 0.15 }}>🏢</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>NO PHOTO — TAP ⋯ TO LOAD ONE</div>
              </div>
              {pins.map(p => <Marker key={p.id} pin={p} selected={selPin === p.id} isMoving={movId === p.id} isDeleting={mode === 'delete-pin'} onClick={onPin} x={p.x * csz.w / 100} y={p.y * csz.h / 100} currentUser={user.name}/>)}
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: 'translate(' + pan_.x + 'px,' + pan_.y + 'px) scale(' + zoom + ')', transformOrigin: 'center center', position: 'relative', display: 'inline-block', willChange: 'transform' }}>
                <img ref={iRef} src={el.img} alt="" style={{ display: 'block', maxWidth: '100vw', maxHeight: 'calc(100vh - 200px)', objectFit: 'contain', pointerEvents: 'none' }} draggable={false}/>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {pins.map(p => <Marker key={p.id} pin={p} selected={selPin === p.id} isMoving={movId === p.id} isDeleting={mode === 'delete-pin'} onClick={onPin} x={p.x * iW / 100} y={p.y * iH / 100} currentUser={user.name}/>)}
                </div>
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '4px 12px', fontSize: 10, color: mode === 'pin' || mode === 'move-pin' ? '#93c5fd' : mode === 'delete-pin' ? '#fca5a5' : '#94a3b8', pointerEvents: 'none', fontFamily: 'Barlow Condensed', letterSpacing: 0.3, whiteSpace: 'nowrap', maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</div>
        </div>

        <div style={{ background: C.navyDark, borderTop: '1px solid #1e3a5f', display: 'flex', alignItems: 'stretch', flexShrink: 0, height: 58, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {modes.map(m => {
            const active = mode === m.id; const danger = m.danger;
            const col = active ? (danger ? '#fca5a5' : '#93c5fd') : (danger ? '#64748b' : '#94a3b8');
            return (
              <button key={m.id} onClick={() => { setMode(m.id); setDupFromId(null); if (m.id !== 'move-pin') setMovId(null); }}
                style={{ flex: 1, background: active ? (danger ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.18)') : 'transparent', border: 'none', borderTop: '2px solid ' + (active ? (danger ? '#dc2626' : C.blue) : 'transparent'), color: col, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontFamily: 'Barlow Condensed', padding: '4px 2px' }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{m.i}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{m.l.split(' ')[0].toUpperCase()}</span>
              </button>
            );
          })}
          <div style={{ width: 1, background: '#1e3a5f', margin: '8px 0' }}/>
          <button onClick={() => setZoom(z => Math.min(8, z * 1.3))} style={{ flex: 0.7, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>+</button>
          <button onClick={() => setZoom(z => Math.max(0.3, z * 0.77))} style={{ flex: 0.7, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>−</button>
          <div style={{ width: 1, background: '#1e3a5f', margin: '8px 0' }}/>
          <button onClick={() => setShowMore(true)} style={{ flex: 0.8, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontFamily: 'Barlow Condensed' }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>⋯</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>MORE</span>
          </button>
        </div>

        {showMore && (
          <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 260, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: '100%', borderRadius: '16px 16px 0 0', padding: '10px 16px 20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 14px' }}/>
              {canEdit && (
                <label style={{ display: 'block', padding: '14px', border: '1px dashed ' + C.borderDark, borderRadius: 10, color: C.textDim, fontSize: 13, cursor: 'pointer', textAlign: 'center', background: C.surface, marginBottom: 10, fontFamily: 'Barlow Condensed', fontWeight: 600 }}>
                  {el?.img ? '🔄 CHANGE ELEVATION PHOTO' : '📷 LOAD ELEVATION PHOTO'}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { onPhoto(e); setShowMore(false); }}/>
                </label>
              )}
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setShowMore(false); }} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid ' + C.border, background: C.surface, color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10, fontFamily: 'Barlow Condensed' }}>⟲ RESET ZOOM ({Math.round(zoom * 100)}%)</button>
              {pins.length > 0 && (
                <div style={{ padding: '12px', background: C.surface, border: '1px solid ' + C.border, borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 8, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>THIS ELEVATION</div>
                  {[ST.TOREPAIR, ST.FIXING, ST.DONE].map(s => (
                    <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: SC[s] }}/><span style={{ fontSize: 12, color: C.textDim, fontFamily: 'Barlow Condensed' }}>{SL[s]}</span></div>
                      <span style={{ fontSize: 13, color: SC[s], fontFamily: 'DM Mono', fontWeight: 700 }}>{statusCounts[s]}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { setShowReview(true); setShowMore(false); }} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1px solid #d97706', background: '#fef3c7', color: '#92400e', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, fontFamily: 'Barlow Condensed' }}>📋 SURVEY REVIEW</button>
              {!isClient && <button onClick={() => { setShowT(true); setShowMore(false); }} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, fontFamily: 'Barlow Condensed' }}>📊 SUMMARY {total > 0 ? '(' + total + ' PINS)' : ''}</button>}
              {canEdit && <button onClick={() => { setShowTrash(true); setShowMore(false); }} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1px solid ' + (trashCount > 0 ? '#dc262630' : C.border), background: C.card, color: trashCount > 0 ? '#dc2626aa' : C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, fontFamily: 'Barlow Condensed' }}>🗑 TRASH {trashCount > 0 ? '(' + trashCount + ')' : ''}</button>}
              <button onClick={() => { setShowRole(true); setShowMore(false); }} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1px solid ' + C.border, background: C.card, color: C.textDim, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 4, fontFamily: 'Barlow Condensed' }}>👤 {user.name} · {user.role.toUpperCase()} — Switch Role</button>
            </div>
          </div>
        )}

        {showIndex && pins.length > 0 && (
          <div onClick={() => setShowIndex(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 260, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: '82%', maxWidth: 340, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '14px 18px', background: C.navyDark, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#f1f5f9', fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1.5 }}>PIN INDEX · {pins.length}</span>
                <button onClick={() => setShowIndex(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer', padding: '0 6px', minWidth: 36, minHeight: 36 }}>×</button>
              </div>
              <div style={{ padding: '10px 14px', background: C.surface, borderBottom: '1px solid ' + C.border }}>
                <input value={indexSearch} onChange={e => setIndexSearch(e.target.value)} placeholder="🔍 Search name, type, status..."
                  style={{ ...IS, padding: '8px 10px', fontSize: 12 }}/>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {(() => {
                  const q = indexSearch.trim().toLowerCase();
                  const filtered = q ? pins.filter(p => {
                    const name = (p.repairName || '').toLowerCase();
                    const type = (RT.find(r => r.id === p.repairType) || { label: '' }).label.toLowerCase();
                    const status = (p.approval === 'declined' ? 'declined' : (SL[p.status] || '')).toLowerCase();
                    const hazard = (HAZARDS.find(h => h.id === p.hazard) || { label: '' }).label.toLowerCase();
                    const by = (p.createdBy || '').toLowerCase();
                    return name.includes(q) || type.includes(q) || status.includes(q) || hazard.includes(q) || by.includes(q) || String(p.id).includes(q);
                  }) : pins;
                  if (filtered.length === 0) return <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: 12 }}>No pins match "{indexSearch}"</div>;
                  return filtered.map(p => {
                    const isDecl = p.approval === 'declined';
                    const sc = isDecl ? C.declined : (SC[p.status] || C.textMuted);
                    return (
                      <div key={p.id} onClick={() => { if (mode !== 'delete-pin') { onPin(p.id); setShowIndex(false); } }} style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: isDecl ? '#fef2f2' : (selPin === p.id ? C.blueDim : C.card) }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ background: pCol(p, user.name), borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: 'DM Mono' }}>{p.id}</div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: isDecl ? C.declined : C.navyDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontFamily: 'Barlow Condensed' }}>{p.repairName || 'Unnamed'}</span>
                        </div>
                        <div style={{ paddingLeft: 36, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flexShrink: 0 }}/>
                          <span style={{ fontSize: 10, fontWeight: 700, color: sc, fontFamily: 'Barlow Condensed' }}>{isDecl ? 'Declined' : (SL[p.status] || 'new')}</span>
                          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'DM Mono' }}>· {getMeas(p)}</span>
                          {p.createdBy && p.createdBy !== user.name && <span style={{ fontSize: 9, color: C.textMuted, marginLeft: 'auto' }}>by {p.createdBy}</span>}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {modal && <PinModal key={modal.id + "-" + (modal._justDuplicated ? "d" : "s")} pin={modal} repairList={rl} onSave={savePin} onTrash={trashPin} onDuplicate={duplicatePin} onClose={() => { setModal(null); setSelPin(null); }} onAddRT={addRT} isMobile={isMobile} user={user}/>}
        {showT && <SummaryTable project={project} onClose={() => setShowT(false)} user={user}/>}
        {showTrash && <TrashPanel project={project} onRestore={restorePin} onClose={() => setShowTrash(false)}/>}
        {showReview && <SurveyReview project={project} user={user} onApprove={approvePin} onDecline={declinePin} onClose={() => setShowReview(false)}/>}
        {showRole && <RoleSwitcher user={user} onSwitch={r => { switchRole(r); setShowRole(false); }} onSwitchUser={u => { switchUser(u); setShowRole(false); }} onLogout={logout} onClose={() => setShowRole(false)}/>}
        {!isOnline && <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 4px)', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, zIndex: 600, fontFamily: 'Barlow Condensed', letterSpacing: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>⚠ OFFLINE — saving locally</div>}
        {toast && <Toast msg={toast}/>}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', background: C.bg, overflow: 'hidden', userSelect: 'none' }}>
      <div style={{ width: 200, background: C.surface, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ background: C.navyDark, padding: '0 14px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 2.5, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>QUICK SURVEY</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Barlow Condensed' }}>{project.name}</div>
          </div>
          <button onClick={() => setScreen('home')} style={{ background: 'none', border: '1px solid #1e3a5f', borderRadius: 5, color: '#475569', fontSize: 11, cursor: 'pointer', padding: '3px 7px', flexShrink: 0, marginLeft: 6 }}>⌂</button>
        </div>
        {canEdit && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + C.border }}>
            <label style={{ display: 'block', padding: '8px 10px', border: '1px dashed ' + C.borderDark, borderRadius: 7, color: C.textDim, fontSize: 11, cursor: 'pointer', textAlign: 'center', background: C.card }}>
              {el?.img ? '🔄 Change photo' : '📷 Load photo'}
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhoto}/>
            </label>
          </div>
        )}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + C.border }}>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>MODE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {modes.map(m => {
              const active = mode === m.id; const danger = m.danger;
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setDupFromId(null); if (m.id !== 'move-pin') setMovId(null); }}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid ' + (active ? (danger ? '#dc2626' : C.blue) : C.border), background: active ? (danger ? '#dc262614' : C.blueDim) : C.card, color: active ? (danger ? '#dc2626' : C.blue) : (danger ? '#9ca3af' : C.textDim), fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed' }}>
                  {m.i} {m.l}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + C.border }}>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>ZOOM {Math.round(zoom * 100)}%</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setZoom(z => Math.min(8, z * 1.3))} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid ' + C.border, background: C.card, color: C.textDim, fontSize: 15, cursor: 'pointer' }}>+</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid ' + C.border, background: C.card, color: C.textMuted, fontSize: 9, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>RESET</button>
            <button onClick={() => setZoom(z => Math.max(0.3, z * 0.77))} style={{ flex: 1, padding: '5px', borderRadius: 5, border: '1px solid ' + C.border, background: C.card, color: C.textDim, fontSize: 15, cursor: 'pointer' }}>−</button>
          </div>
        </div>
        {pins.length > 0 && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + C.border }}>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.5, marginBottom: 7, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>THIS ELEVATION</div>
            {[ST.TOREPAIR, ST.FIXING, ST.DONE].map(s => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: SC[s] }}/><span style={{ fontSize: 10, color: C.textDim, fontFamily: 'Barlow Condensed' }}>{SL[s]}</span></div>
                <span style={{ fontSize: 10, color: SC[s], fontFamily: 'DM Mono', fontWeight: 600 }}>{statusCounts[s]}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + C.border }}>
          <button onClick={() => setShowRole(true)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.card, color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow Condensed', textAlign: 'left' }}>
            👤 {user.name} · <span style={{ color: user.role === 'client' ? '#d97706' : C.blue, fontWeight: 700 }}>{user.role.toUpperCase()}</span>
          </button>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid ' + C.border }}>
          <button onClick={() => setShowReview(true)} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid #d97706', background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>📋 SURVEY REVIEW</button>
          {!isClient && <button onClick={() => setShowT(true)} style={{ width: '100%', padding: '8px', borderRadius: 7, border: '1px solid ' + C.blue, background: C.blueDim, color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>📊 SUMMARY {total > 0 ? '(' + total + ')' : ''}</button>}
          {canEdit && <button onClick={() => setShowTrash(true)} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid ' + (trashCount > 0 ? '#dc262630' : C.border), background: C.card, color: trashCount > 0 ? '#dc2626aa' : C.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow Condensed' }}>🗑 TRASH {trashCount > 0 ? '(' + trashCount + ')' : ''}</button>}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', background: C.card, borderBottom: '1px solid ' + C.border, overflowX: 'auto', flexShrink: 0 }}>
          {project.elevations.map((e, i) => {
            const ep = e.pins || []; const ed = ep.filter(p => p.status === ST.DONE).length;
            return (
              <button key={i} onClick={() => { setAe(i); setMode("pan"); setMovId(null); setDupFromId(null); setSelPin(null); setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{ padding: '10px 16px', border: 'none', borderBottom: '2px solid ' + (i === ae ? C.navyDark : 'transparent'), background: 'transparent', color: i === ae ? C.navyDark : C.textDim, fontSize: 12, fontWeight: i === ae ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Barlow Condensed', transition: 'all 0.1s' }}>
                {e.name.toUpperCase()}
                {ep.length > 0 && <span style={{ fontSize: 9, color: i === ae ? C.navyMid : C.textMuted, background: i === ae ? C.blueDim : '#f3f4f6', padding: '1px 6px', borderRadius: 8, fontFamily: 'DM Mono' }}>{ed}/{ep.length}</span>}
                {e.img && <span style={{ fontSize: 8, color: '#16a34a', background: '#dcfce7', padding: '1px 4px', borderRadius: 4 }}>IMG</span>}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: mode === 'pin' || mode === 'move-pin' ? 'crosshair' : mode === 'delete-pin' ? 'not-allowed' : 'grab', background: '#d8dce4' }}
          ref={cRef} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onClick={onCanvasClick}>
          {!el?.img ? (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(' + C.border + ' 1px,transparent 1px),linear-gradient(90deg,' + C.border + ' 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.8 }}/>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                <div style={{ fontSize: 48, opacity: 0.1 }}>🏢</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'Barlow Condensed', letterSpacing: 1 }}>NO PHOTO — PINS FLOAT ON CANVAS</div>
              </div>
              {pins.map(p => <Marker key={p.id} pin={p} selected={selPin === p.id} isMoving={movId === p.id} isDeleting={mode === 'delete-pin'} onClick={onPin} x={p.x * csz.w / 100} y={p.y * csz.h / 100} currentUser={user.name}/>)}
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: 'translate(' + pan_.x + 'px,' + pan_.y + 'px) scale(' + zoom + ')', transformOrigin: 'center center', position: 'relative', display: 'inline-block' }}>
                <img ref={iRef} src={el.img} alt="" style={{ display: 'block', maxWidth: '72vw', maxHeight: '88vh', objectFit: 'contain', pointerEvents: 'none' }} draggable={false}/>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {pins.map(p => <Marker key={p.id} pin={p} selected={selPin === p.id} isMoving={movId === p.id} isDeleting={mode === 'delete-pin'} onClick={onPin} x={p.x * iW / 100} y={p.y * iH / 100} currentUser={user.name}/>)}
                </div>
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: mode === 'pin' || mode === 'move-pin' ? '#93c5fd' : mode === 'delete-pin' ? '#fca5a5' : '#94a3b8', pointerEvents: 'none', fontFamily: 'Barlow Condensed', letterSpacing: 0.5 }}>{hint}</div>
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(17,24,39,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '4px 12px', fontSize: 10, color: '#93c5fd', fontWeight: 700, letterSpacing: 2, pointerEvents: 'none', fontFamily: 'Barlow Condensed' }}>{(el?.name || '').toUpperCase()} · {project.name.toUpperCase()}</div>
        </div>
      </div>

      {pins.length > 0 && (
        <div style={{ width: 196, background: C.surface, borderLeft: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.navyDark }}>
            <span style={{ fontSize: 9, color: '#475569', letterSpacing: 2, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>INDEX</span>
            <span style={{ fontSize: 9, color: '#475569', fontFamily: 'DM Mono' }}>{pins.length}</span>
          </div>
          <div style={{ padding: '6px 8px', background: C.card, borderBottom: '1px solid ' + C.border }}>
            <input value={indexSearch} onChange={e => setIndexSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...IS, padding: '5px 8px', fontSize: 11 }}/>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(() => {
              const q = indexSearch.trim().toLowerCase();
              const filtered = q ? pins.filter(p => {
                const name = (p.repairName || '').toLowerCase();
                const type = (RT.find(r => r.id === p.repairType) || { label: '' }).label.toLowerCase();
                const status = (p.approval === 'declined' ? 'declined' : (SL[p.status] || '')).toLowerCase();
                const hazard = (HAZARDS.find(h => h.id === p.hazard) || { label: '' }).label.toLowerCase();
                const by = (p.createdBy || '').toLowerCase();
                return name.includes(q) || type.includes(q) || status.includes(q) || hazard.includes(q) || by.includes(q) || String(p.id).includes(q);
              }) : pins;
              if (filtered.length === 0) return <div style={{ padding: '16px', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>No matches</div>;
              return filtered.map(p => {
                const isDecl = p.approval === 'declined';
                const sc = isDecl ? C.declined : (SC[p.status] || C.textMuted);
                return (
                  <div key={p.id} onClick={() => { if (mode !== 'delete-pin') onPin(p.id); }} style={{ padding: '9px 14px', borderBottom: '1px solid ' + C.border, cursor: 'pointer', background: isDecl ? '#fef2f2' : (selPin === p.id ? C.blueDim : C.card), transition: 'background 0.1s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <div style={{ background: pCol(p, user.name), borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: 'DM Mono' }}>{p.id}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isDecl ? C.declined : C.navyDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontFamily: 'Barlow Condensed' }}>{p.repairName || 'Unnamed'}</span>
                    </div>
                    <div style={{ paddingLeft: 25, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc, flexShrink: 0 }}/>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc, fontFamily: 'Barlow Condensed' }}>{isDecl ? 'Declined' : (SL[p.status] || 'new')}</span>
                      {p.hazard && <span style={{ fontSize: 9, color: HC[p.hazard], marginLeft: 'auto' }}>●</span>}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {modal && <PinModal key={modal.id + "-" + (modal._justDuplicated ? "d" : "s")} pin={modal} repairList={rl} onSave={savePin} onTrash={trashPin} onDuplicate={duplicatePin} onClose={() => { setModal(null); setSelPin(null); }} onAddRT={addRT} isMobile={false} user={user}/>}
      {showT && <SummaryTable project={project} onClose={() => setShowT(false)} user={user}/>}
      {showTrash && <TrashPanel project={project} onRestore={restorePin} onClose={() => setShowTrash(false)}/>}
      {showReview && <SurveyReview project={project} user={user} onApprove={approvePin} onDecline={declinePin} onClose={() => setShowReview(false)}/>}
      {showRole && <RoleSwitcher user={user} onSwitch={r => { switchRole(r); setShowRole(false); }} onSwitchUser={u => { switchUser(u); setShowRole(false); }} onLogout={logout} onClose={() => setShowRole(false)}/>}
      {!isOnline && <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 4px)', left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, zIndex: 600, fontFamily: 'Barlow Condensed', letterSpacing: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>⚠ OFFLINE — saving locally</div>}
      {toast && <Toast msg={toast}/>}
    </div>
  );
}
