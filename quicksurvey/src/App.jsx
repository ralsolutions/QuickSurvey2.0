import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { C, ST, SC, SL, HC, SKEY_USER, APP_VERSION } from './lib/constants.js';
import { pCol, getMeas, useIsMobile, useDebouncedCallback, useOnline } from './lib/helpers.js';
import { dbGetAll, dbPut, openDB, migrateProjectIfNeeded, revokeAllPhotoUrls, deletePhoto, getPhotoUrl } from './lib/db.js';
import { processAndStoreElevationPhoto } from './lib/photo.js';

import { UserSetup } from './components/UserSetup.jsx';
import { HomeScreen } from './components/HomeScreen.jsx';
import { Setup } from './components/Setup.jsx';
import { Marker } from './components/Marker.jsx';
import { Toast } from './components/Toast.jsx';
import { PhotoImg } from './components/PhotoImg.jsx';

// Lazy-load heavy modals — they only download when first opened
const PinModal = lazy(() => import('./components/PinModal.jsx').then(m => ({ default: m.PinModal })));
const SummaryTable = lazy(() => import('./components/SummaryTable.jsx').then(m => ({ default: m.SummaryTable })));
const TrashPanel = lazy(() => import('./components/TrashPanel.jsx').then(m => ({ default: m.TrashPanel })));
const SurveyReview = lazy(() => import('./components/SurveyReview.jsx').then(m => ({ default: m.SurveyReview })));
const RoleSwitcher = lazy(() => import('./components/RoleSwitcher.jsx').then(m => ({ default: m.RoleSwitcher })));

// ── PWA install handler — sets up window.__qsInstallApp for the RoleSwitcher ──
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

export default function App({ onReady }) {
  // ── User profile ────────────────────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SKEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // ── Top-level screen state ──────────────────────────────────────────────────
  const [screen, setScreen] = useState('home'); // 'home' | 'setup' | 'survey'
  const [project, setProject] = useState(null);
  const [active, setActive] = useState(0);     // active elevation index
  const [showToast, setShowToast] = useState('');
  const [showRole, setShowRole] = useState(false);

  // ── Canvas state ────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState('pan');     // 'pan' | 'pin' | 'move' | 'delete'
  const [movingPin, setMovingPin] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [editPin, setEditPin] = useState(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [showSummary, setShowSummary] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showIndex, setShowIndex] = useState(false);  // mobile drawer
  const [showMore, setShowMore] = useState(false);    // mobile ⋯ menu
  const [searchQ, setSearchQ] = useState('');

  // ── Refs (used inside event handlers to avoid stale closures) ───────────────
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const modeRef = useRef(mode);
  const movRef = useRef(null);                 // pin id being moved
  const dupFromRef = useRef(null);             // pin id we just duplicated from
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const undoStackRef = useRef([]);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchRef = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const isMobile = useIsMobile(900);
  const online = useOnline();

  // ── First mount: signal splash to hide ──────────────────────────────────────
  useEffect(() => { if (onReady) onReady(); }, [onReady]);

  // ── Persistence: debounced save when project changes ────────────────────────
  const [saveProjectDebounced, flushSave] = useDebouncedCallback(async (p) => {
    if (p) await dbPut(p);
  }, 400);

  useEffect(() => {
    if (project) saveProjectDebounced(project);
  }, [project, saveProjectDebounced]);

  // Flush any pending writes before page unload
  useEffect(() => {
    const h = () => { if (project) flushSave(project); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [project, flushSave]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const toast = useCallback((msg) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(''), 2000);
  }, []);

  // ── Save user profile ───────────────────────────────────────────────────────
  const saveUser = (u) => {
    setUser(u);
    try { localStorage.setItem(SKEY_USER, JSON.stringify(u)); } catch {}
  };

  // ── Open project (with migration) ───────────────────────────────────────────
  const openProject = async (p) => {
    revokeAllPhotoUrls();  // free old object URLs from any previous project
    const migrated = await migrateProjectIfNeeded(p);
    setProject(migrated);
    setActive(0);
    setZoom(1); setPan({ x: 0, y: 0 });
    setMode('pan');
    undoStackRef.current = [];
    setScreen('survey');
  };

  // ── Create project ──────────────────────────────────────────────────────────
  const createProject = async (name, elevationNames) => {
    const newP = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      createdBy: user.name,
      _migratedToBlobs: true,
      repairTypes: [],
      elevations: elevationNames.map(n => ({ name: n, imgPhotoId: null, pins: [], trash: [] })),
    };
    await dbPut(newP);
    setProject(newP);
    setActive(0);
    setScreen('survey');
  };

  // ── Leave current project ───────────────────────────────────────────────────
  const goHome = () => {
    if (project) flushSave(project);
    revokeAllPhotoUrls();
    setProject(null);
    setScreen('home');
  };

  // ── Push undo snapshot ──────────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    if (!project) return;
    const snap = JSON.stringify(project);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }, [project]);

  const undo = useCallback(() => {
    const snap = undoStackRef.current.pop();
    if (!snap) { toast('Nothing to undo'); return; }
    try {
      setProject(JSON.parse(snap));
      toast('↶ Undone');
    } catch {}
  }, [toast]);

  // ── Resize observer for canvas ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'survey' || !canvasRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [screen]);

  // ── Image dims sync (when elevation changes) ────────────────────────────────
  useEffect(() => {
    setImgDims({ w: 0, h: 0 });
    setZoom(1); setPan({ x: 0, y: 0 });
    setSelectedPin(null);
  }, [active, project?.id]);

  // ── Active elevation ────────────────────────────────────────────────────────
  const elev = project?.elevations[active];

  // ── Coords math ─────────────────────────────────────────────────────────────
  // Image is rendered at "fit" size (contains within canvas), then scaled by zoom + panned.
  // pin.x and pin.y are stored as fractions [0..1] of the image natural size.

  const fitDims = () => {
    if (!imgDims.w || !imgDims.h || !canvasSize.w || !canvasSize.h) return { w: 0, h: 0, ox: 0, oy: 0 };
    const ar = imgDims.w / imgDims.h;
    const car = canvasSize.w / canvasSize.h;
    let w, h;
    if (ar > car) { w = canvasSize.w; h = canvasSize.w / ar; }
    else { h = canvasSize.h; w = canvasSize.h * ar; }
    return { w, h, ox: (canvasSize.w - w) / 2, oy: (canvasSize.h - h) / 2 };
  };

  const eventToImgFrac = (clientX, clientY) => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const f = fitDims();
    if (!f.w) return null;
    // Reverse the transform: subtract pan, divide by zoom, then convert to image coords
    const ix = (px - panRef.current.x) / zoomRef.current - f.ox;
    const iy = (py - panRef.current.y) / zoomRef.current - f.oy;
    return { fx: ix / f.w, fy: iy / f.h };
  };

  const fracToScreen = (fx, fy) => {
    const f = fitDims();
    if (!f.w) return { x: 0, y: 0 };
    const ix = fx * f.w + f.ox;
    const iy = fy * f.h + f.oy;
    return { x: ix * zoom + pan.x, y: iy * zoom + pan.y };
  };

  // ── Pin operations ──────────────────────────────────────────────────────────
  const nextPinId = () => {
    if (!project) return 1;
    let max = 0;
    for (const e of project.elevations) {
      for (const p of e.pins || []) if (p.id > max) max = p.id;
      for (const p of e.trash || []) if (p.id > max) max = p.id;
    }
    return max + 1;
  };

  const addPinAt = (fx, fy) => {
    if (!project) return;
    pushUndo();
    const id = nextPinId();
    const newPin = { id, x: fx, y: fy, createdAt: new Date().toISOString() };
    const newProject = { ...project, elevations: project.elevations.map((e, i) => i === active ? { ...e, pins: [...(e.pins || []), newPin] } : e) };
    setProject(newProject);
    setEditPin(newPin);
  };

  const updatePin = (updated) => {
    setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => i === active ? { ...e, pins: e.pins.map(pn => pn.id === updated.id ? updated : pn) } : e) }));
    setEditPin(null);
  };

  const movePinTo = (pinId, fx, fy) => {
    pushUndo();
    setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => i === active ? { ...e, pins: e.pins.map(pn => pn.id === pinId ? { ...pn, x: fx, y: fy } : pn) } : e) }));
    movRef.current = null;
    setMovingPin(null);
    setMode('pan');
    toast('✓ Pin moved');
  };

  const trashPin = (pinId) => {
    pushUndo();
    setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => {
      if (i !== active) return e;
      const pin = e.pins.find(pn => pn.id === pinId);
      if (!pin) return e;
      return { ...e, pins: e.pins.filter(pn => pn.id !== pinId), trash: [...(e.trash || []), { ...pin, deletedAt: new Date().toISOString() }] };
    }) }));
    setEditPin(null);
    setSelectedPin(null);
    toast('🗑 Moved to trash');
  };

  const restorePin = (elevIdx, pinId) => {
    pushUndo();
    setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => {
      if (i !== elevIdx) return e;
      const pin = (e.trash || []).find(pn => pn.id === pinId);
      if (!pin) return e;
      const { deletedAt, ...rest } = pin;
      return { ...e, pins: [...e.pins, rest], trash: e.trash.filter(pn => pn.id !== pinId) };
    }) }));
    toast('↩ Restored');
  };

  const duplicatePin = (pinId) => {
    if (!project || !elev) return;
    const orig = elev.pins.find(p => p.id === pinId);
    if (!orig) return;
    pushUndo();
    const newId = nextPinId();
    // Place the duplicate slightly offset so it doesn't overlap
    const dup = {
      ...orig,
      id: newId,
      x: Math.min(0.99, orig.x + 0.025),
      y: Math.min(0.99, orig.y + 0.025),
      // Reset progress photos and approval state for the new pin
      surveyPhotoIds: [], fixingPhotoIds: [], donePhotoIds: [],
      surveyPhotos: undefined, fixingPhotos: undefined, donePhotos: undefined,
      status: ST.TOREPAIR,
      approval: 'pending', approvalComment: undefined,
      fixingComment: undefined, doneComment: undefined,
      createdAt: new Date().toISOString(),
      createdBy: user.name,
      _justDuplicated: true,
    };
    setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => i === active ? { ...e, pins: [...e.pins, dup] } : e) }));
    setEditPin(dup);
    dupFromRef.current = pinId;
    toast('⎘ Duplicated — review fields');
  };

  // ── Add repair type to project's master list ────────────────────────────────
  const addRepairType = ({ name, type }) => {
    setProject(p => {
      const exists = (p.repairTypes || []).find(r => r.name === name);
      if (exists) return p;
      return { ...p, repairTypes: [...(p.repairTypes || []), { name, type }] };
    });
  };

  // ── Approval flow ───────────────────────────────────────────────────────────
  const approvePin = (pinId) => {
    pushUndo();
    setProject(p => ({ ...p, elevations: p.elevations.map(e => ({
      ...e,
      pins: (e.pins || []).map(pn => pn.id === pinId ? { ...pn, approval: 'approved', approvalComment: undefined } : pn)
    })) }));
  };

  const declinePin = (pinId, comment) => {
    pushUndo();
    setProject(p => ({ ...p, elevations: p.elevations.map(e => ({
      ...e,
      pins: (e.pins || []).map(pn => pn.id === pinId ? { ...pn, approval: 'declined', approvalComment: comment || undefined } : pn)
    })) }));
  };

  // ── Touch & mouse: pan / pinch / pin click ──────────────────────────────────
  // We use a single canvas-level handler. Marker components stop propagation when tapped.

  const onCanvasPointerDown = (e) => {
    if (modeRef.current === 'pin' && e.button !== undefined && e.button !== 0) return;
    const c = canvasRef.current;
    if (!c) return;

    if (e.touches && e.touches.length === 2) {
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchRef.current = { startDist: dist, startZoom: zoomRef.current };
      draggingRef.current = false;
      return;
    }

    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    draggingRef.current = true;
    dragStartRef.current = {
      x: cx, y: cy,
      panX: panRef.current.x, panY: panRef.current.y,
      moved: false,
    };
  };

  const onCanvasPointerMove = (e) => {
    if (e.touches && e.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const next = Math.max(0.5, Math.min(5, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
      setZoom(next);
      return;
    }

    if (!draggingRef.current) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - dragStartRef.current.x;
    const dy = cy - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragStartRef.current.moved = true;

    if (modeRef.current === 'pan' || modeRef.current === 'move' || modeRef.current === 'delete') {
      // In all modes except 'pin', dragging the canvas pans
      if (dragStartRef.current.moved) {
        setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
      }
    }
  };

  const onCanvasPointerUp = (e) => {
    if (e.touches && e.touches.length > 0) return;
    pinchRef.current = null;

    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (dragStartRef.current.moved) return;  // it was a drag, not a tap

    // Tap handling
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const m = modeRef.current;
    const frac = eventToImgFrac(cx, cy);
    if (!frac) return;

    if (m === 'pin' && elev?.imgPhotoId) {
      if (frac.fx >= 0 && frac.fx <= 1 && frac.fy >= 0 && frac.fy <= 1) {
        addPinAt(frac.fx, frac.fy);
      }
    } else if (m === 'move' && movRef.current != null) {
      movePinTo(movRef.current, frac.fx, frac.fy);
    }
  };

  const onMarkerClick = useCallback((pinId) => {
    const m = modeRef.current;
    if (m === 'move') {
      // First tap → select pin to move; second tap on canvas → drop it
      movRef.current = pinId;
      setMovingPin(pinId);
      toast('Tap destination');
    } else if (m === 'delete') {
      if (confirm('Delete this pin?')) trashPin(pinId);
    } else {
      // Open pin modal
      const pin = elev?.pins.find(p => p.id === pinId);
      if (pin) setEditPin(pin);
    }
  }, [elev, toast]);

  // ── Wheel zoom on desktop ───────────────────────────────────────────────────
  const onCanvasWheel = (e) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom(z => Math.max(0.5, Math.min(5, z * (1 + delta))));
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'survey') return;
    const h = (e) => {
      // Ignore when typing in inputs
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (editPin || showSummary || showTrash || showReview || showRole) return;
      const k = e.key.toLowerCase();
      if (k === 'p') setMode('pin');
      else if (k === 'm') setMode('move');
      else if (k === 'd') setMode('delete');
      else if (k === 'v' || k === 'h') setMode('pan');
      else if (k === 'r') { setZoom(1); setPan({ x: 0, y: 0 }); }
      else if (k === 's') setShowReview(true);
      else if (k === 'escape') {
        setMode('pan');
        setMovingPin(null);
        movRef.current = null;
      }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, editPin, showSummary, showTrash, showReview, showRole, undo]);

  // ── Upload elevation photo ──────────────────────────────────────────────────
  const uploadElevationPhoto = async (file) => {
    if (!file || !project || !elev) return;
    toast('Processing photo...');
    try {
      // If there was an old photo, schedule deletion (don't await — fire and forget)
      if (elev.imgPhotoId) deletePhoto(elev.imgPhotoId).catch(() => {});

      const photoId = await processAndStoreElevationPhoto(file, project.id);
      setProject(p => ({ ...p, elevations: p.elevations.map((e, i) => i === active ? { ...e, imgPhotoId: photoId, img: undefined } : e) }));

      // Read dims from the stored blob
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.src = url;
      toast('✓ Photo loaded');
    } catch (err) {
      console.error(err);
      toast('Error loading photo');
    }
  };

  // ── Render image dims on load ───────────────────────────────────────────────
  const onImgLoad = (e) => {
    const i = e.currentTarget;
    setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
  };

  // ── ROUTING ─────────────────────────────────────────────────────────────────

  if (!user) {
    return <UserSetup onDone={saveUser}/>;
  }

  if (screen === 'home') {
    return (
      <>
        <HomeScreen
          user={user}
          onOpen={openProject}
          onCreate={() => setScreen('setup')}
          onRoleSwitch={(r) => saveUser({ ...user, role: r })}
          onSwitchUser={(u) => saveUser({ ...user, name: u.name, company: u.company })}
          onLogout={() => { localStorage.removeItem(SKEY_USER); setUser(null); }}/>
        {!online && <OnlineBanner online={false}/>}
      </>
    );
  }

  if (screen === 'setup') {
    return <Setup onBack={() => setScreen('home')} onDone={createProject}/>;
  }

  // ── SURVEY SCREEN ───────────────────────────────────────────────────────────

  const stats = elev ? {
    total: (elev.pins || []).length,
    torepair: (elev.pins || []).filter(p => p.status === ST.TOREPAIR).length,
    fixing: (elev.pins || []).filter(p => p.status === ST.FIXING).length,
    done: (elev.pins || []).filter(p => p.status === ST.DONE).length,
  } : { total: 0, torepair: 0, fixing: 0, done: 0 };

  const filteredPins = elev ? (elev.pins || []).filter(p => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (p.repairName || '').toLowerCase().includes(q) || ('' + p.id).includes(q);
  }) : [];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.navyDark, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50, flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <button onClick={goHome} style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid #2563eb44', borderRadius: 6, color: '#93c5fd', cursor: 'pointer', padding: '5px 10px', fontSize: 12, fontFamily: 'Barlow Condensed', fontWeight: 700, flexShrink: 0 }}>← HOME</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1 }}>{stats.total} PINS · {stats.done} DONE</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => setShowReview(true)} title="Survey review (S)" style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid #f59e0b66', borderRadius: 6, color: '#fbbf24', cursor: 'pointer', padding: '5px 10px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>📋 {isMobile ? '' : 'REVIEW'}</button>
          {!isMobile && <button onClick={() => setShowSummary(true)} style={{ background: 'rgba(37,99,235,0.18)', border: '1px solid #2563eb66', borderRadius: 6, color: '#93c5fd', cursor: 'pointer', padding: '5px 10px', fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>📊 SUMMARY</button>}
          <button onClick={() => setShowRole(true)} style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid #8b5cf666', borderRadius: 6, color: '#c4b5fd', cursor: 'pointer', padding: '5px 10px', fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>{user.role.toUpperCase()}</button>
        </div>
      </div>

      {/* Elevation tabs */}
      <div style={{ background: C.card, borderBottom: '1px solid ' + C.border, padding: '0 12px', display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0, minHeight: 38 }}>
        {project.elevations.map((e, i) => (
          <button key={i} onClick={() => setActive(i)}
            style={{ padding: '8px 12px', border: 'none', background: 'transparent', borderBottom: '2px solid ' + (active === i ? C.blue : 'transparent'), color: active === i ? C.blue : C.textDim, fontSize: 12, fontWeight: active === i ? 700 : 400, cursor: 'pointer', fontFamily: 'Barlow Condensed', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
            {e.name} {(e.pins || []).length > 0 && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>({(e.pins || []).length})</span>}
          </button>
        ))}
      </div>

      {/* Main canvas + sidebars */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Desktop left toolbar */}
        {!isMobile && (
          <div style={{ width: 64, background: C.card, borderRight: '1px solid ' + C.border, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <ModeBtn icon="✋" label="Pan" active={mode === 'pan'} onClick={() => setMode('pan')}/>
            <ModeBtn icon="📍" label="Pin" active={mode === 'pin'} onClick={() => setMode('pin')}/>
            <ModeBtn icon="↔" label="Move" active={mode === 'move'} onClick={() => setMode('move')}/>
            <ModeBtn icon="✕" label="Del" active={mode === 'delete'} onClick={() => setMode('delete')} danger={true}/>
            <div style={{ height: 1, background: C.border, width: '90%', margin: '6px 0' }}/>
            <ToolBtn icon="+" label="In" onClick={() => setZoom(z => Math.min(5, z * 1.25))}/>
            <ToolBtn icon="−" label="Out" onClick={() => setZoom(z => Math.max(0.5, z / 1.25))}/>
            <ToolBtn icon="⊙" label="Reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}/>
            <div style={{ height: 1, background: C.border, width: '90%', margin: '6px 0' }}/>
            <ToolBtn icon="↶" label="Undo" onClick={undo}/>
            <ToolBtn icon="🗑" label="Trash" onClick={() => setShowTrash(true)}/>
            <div style={{ flex: 1 }}/>
            <div style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', fontFamily: 'DM Mono', writingMode: 'horizontal-tb', lineHeight: 1.4 }}>
              <div style={{ color: C.torepair, fontWeight: 700 }}>{stats.torepair}</div>
              <div>TR</div>
              <div style={{ color: C.fixing, fontWeight: 700, marginTop: 4 }}>{stats.fixing}</div>
              <div>FX</div>
              <div style={{ color: C.done, fontWeight: 700, marginTop: 4 }}>{stats.done}</div>
              <div>DN</div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasPointerDown}
          onMouseMove={onCanvasPointerMove}
          onMouseUp={onCanvasPointerUp}
          onMouseLeave={onCanvasPointerUp}
          onTouchStart={onCanvasPointerDown}
          onTouchMove={onCanvasPointerMove}
          onTouchEnd={onCanvasPointerUp}
          onTouchCancel={onCanvasPointerUp}
          onWheel={onCanvasWheel}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: C.bg,
            cursor: mode === 'pan' ? 'grab' : mode === 'pin' ? 'crosshair' : mode === 'delete' ? 'not-allowed' : 'pointer',
            touchAction: 'none',
          }}
        >
          {/* Empty state — upload elevation photo */}
          {!elev?.imgPhotoId && !elev?.img && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <label style={{ background: C.card, border: '2px dashed ' + C.borderDark, borderRadius: 12, padding: '32px 40px', textAlign: 'center', cursor: 'pointer', maxWidth: 400 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700, color: C.navyDark, marginBottom: 4 }}>UPLOAD ELEVATION PHOTO</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{elev?.name}</div>
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => uploadElevationPhoto(e.target.files[0])}/>
              </label>
            </div>
          )}

          {/* Photo + pins */}
          {elev?.imgPhotoId && (() => {
            const f = fitDims();
            return (
              <div style={{
                position: 'absolute', left: pan.x, top: pan.y,
                width: canvasSize.w, height: canvasSize.h,
                transform: `scale(${zoom})`, transformOrigin: '0 0',
                pointerEvents: 'none',
              }}>
                <div style={{ position: 'absolute', left: f.ox, top: f.oy, width: f.w, height: f.h, pointerEvents: 'none' }}>
                  <PhotoImg
                    photoId={elev.imgPhotoId}
                    style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', userSelect: 'none', pointerEvents: 'none' }}/>
                  {/* Hidden img for dims */}
                  <ImgDimsLoader photoId={elev.imgPhotoId} onLoad={(w, h) => { if (w !== imgDims.w || h !== imgDims.h) setImgDims({ w, h }); }}/>
                </div>
                {/* Pins overlay (positioned in screen coords, but inside the scaled container) */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `scale(${1/zoom})`, transformOrigin: '0 0' }}>
                  <PinsLayer
                    pins={elev.pins || []}
                    selectedPinId={selectedPin}
                    movingPinId={movingPin}
                    deleteMode={mode === 'delete'}
                    fitDims={f}
                    zoom={zoom}
                    pan={pan}
                    onMarkerClick={onMarkerClick}
                    currentUser={user.name}/>
                </div>
              </div>
            );
          })()}

          {/* Legacy fallback for old base64 elevation photos */}
          {!elev?.imgPhotoId && elev?.img && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={elev.img} onLoad={onImgLoad} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }} alt=""/>
            </div>
          )}

          {/* Mode badge */}
          {mode !== 'pan' && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: mode === 'pin' ? C.blue : mode === 'move' ? '#ea580c' : '#dc2626', color: '#fff', padding: '5px 14px', borderRadius: 16, fontSize: 11, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1.5, boxShadow: '0 2px 12px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
              {mode === 'pin' && '📍 TAP TO PLACE'}
              {mode === 'move' && (movingPin ? '📍 TAP DESTINATION' : '↔ TAP A PIN')}
              {mode === 'delete' && '✕ TAP A PIN TO DELETE'}
            </div>
          )}

          {/* Online indicator */}
          {!online && (
            <div style={{ position: 'absolute', top: 10, right: 10, background: '#ea580c', color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1 }}>OFFLINE</div>
          )}
        </div>

        {/* Desktop right sidebar — pin index */}
        {!isMobile && elev && (
          <div style={{ width: 240, background: C.card, borderLeft: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + C.border }}>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.5, fontFamily: 'Barlow Condensed', fontWeight: 700, marginBottom: 6 }}>PINS ({(elev.pins || []).length})</div>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '5px 9px', fontSize: 12, outline: 'none' }}/>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {filteredPins.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 11, padding: 20 }}>No pins</div>}
              {filteredPins.map(p => (
                <PinIndexRow key={p.id} pin={p} onClick={() => setEditPin(p)} currentUser={user.name}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom toolbar */}
      {isMobile && (
        <div style={{ background: C.card, borderTop: '1px solid ' + C.border, padding: '6px 8px', display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
          <MobileBtn icon="✋" active={mode === 'pan'} onClick={() => setMode('pan')}/>
          <MobileBtn icon="📍" active={mode === 'pin'} onClick={() => setMode('pin')}/>
          <MobileBtn icon="↔" active={mode === 'move'} onClick={() => setMode('move')}/>
          <MobileBtn icon="✕" active={mode === 'delete'} onClick={() => setMode('delete')} danger={true}/>
          <div style={{ width: 1, height: 24, background: C.border }}/>
          <MobileBtn icon="−" onClick={() => setZoom(z => Math.max(0.5, z / 1.25))}/>
          <MobileBtn icon="+" onClick={() => setZoom(z => Math.min(5, z * 1.25))}/>
          <MobileBtn icon="≡" onClick={() => setShowIndex(true)} badge={(elev?.pins || []).length}/>
          <MobileBtn icon="⋯" onClick={() => setShowMore(true)}/>
        </div>
      )}

      {/* Mobile pin index drawer */}
      {isMobile && showIndex && elev && (
        <div onClick={() => setShowIndex(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, maxWidth: '85vw', background: C.card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navyDark, fontFamily: 'Barlow Condensed' }}>PINS ({(elev.pins || []).length})</div>
              <button onClick={() => setShowIndex(false)} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid ' + C.border }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." style={{ width: '100%', background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none' }}/>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {filteredPins.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 11, padding: 20 }}>No pins</div>}
              {filteredPins.map(p => (
                <PinIndexRow key={p.id} pin={p} onClick={() => { setEditPin(p); setShowIndex(false); }} currentUser={user.name}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile more menu */}
      {isMobile && showMore && (
        <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: C.card, borderRadius: '14px 14px 0 0', padding: '12px 14px 24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 1.5, marginBottom: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, textAlign: 'center' }}>MORE</div>
            <button onClick={() => { setShowMore(false); setShowSummary(true); }} style={mobMenuBtn}>📊 Summary table</button>
            <button onClick={() => { setShowMore(false); setShowTrash(true); }} style={mobMenuBtn}>🗑 Trash</button>
            <button onClick={() => { setShowMore(false); undo(); }} style={mobMenuBtn}>↶ Undo last action</button>
            <button onClick={() => { setShowMore(false); setZoom(1); setPan({ x: 0, y: 0 }); }} style={mobMenuBtn}>⊙ Reset zoom</button>
            <button onClick={() => setShowMore(false)} style={{ ...mobMenuBtn, color: C.textMuted, marginTop: 6 }}>Close</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {editPin && (
        <Suspense fallback={null}>
          <PinModal
            pin={editPin}
            repairList={project.repairTypes || []}
            onSave={updatePin}
            onTrash={trashPin}
            onDuplicate={duplicatePin}
            onClose={() => setEditPin(null)}
            onAddRT={addRepairType}
            isMobile={isMobile}
            user={user}
            projectId={project.id}/>
        </Suspense>
      )}

      {showSummary && (
        <Suspense fallback={null}>
          <SummaryTable project={project} user={user} onClose={() => setShowSummary(false)} isMobile={isMobile}/>
        </Suspense>
      )}

      {showTrash && (
        <Suspense fallback={null}>
          <TrashPanel project={project} onRestore={(ei, id) => restorePin(ei, id)} onClose={() => setShowTrash(false)}/>
        </Suspense>
      )}

      {showReview && (
        <Suspense fallback={null}>
          <SurveyReview project={project} user={user} onApprove={approvePin} onDecline={declinePin} onClose={() => setShowReview(false)}/>
        </Suspense>
      )}

      {showRole && (
        <Suspense fallback={null}>
          <RoleSwitcher
            user={user}
            onSwitch={r => { saveUser({ ...user, role: r }); setShowRole(false); }}
            onSwitchUser={u => { saveUser({ ...user, name: u.name, company: u.company }); setShowRole(false); }}
            onLogout={() => { localStorage.removeItem(SKEY_USER); setUser(null); setShowRole(false); }}
            onClose={() => setShowRole(false)}/>
        </Suspense>
      )}

      {showToast && <Toast msg={showToast}/>}
      {!online && screen === 'survey' && <OnlineBanner online={false}/>}
    </div>
  );
}

// ── Helper subcomponents (kept inline since they're trivial) ──────────────────

function ModeBtn({ icon, label, active, onClick, danger }) {
  const col = danger ? '#dc2626' : C.blue;
  return (
    <button onClick={onClick} style={{ width: 50, padding: '8px 4px', borderRadius: 8, border: '1.5px solid ' + (active ? col : C.border), background: active ? col + '14' : C.surface, color: active ? col : C.textDim, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 9, fontFamily: 'Barlow Condensed', letterSpacing: 0.5, fontWeight: active ? 700 : 400 }}>{label}</span>
    </button>
  );
}

function ToolBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 50, padding: '6px 4px', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.textDim, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 8, fontFamily: 'Barlow Condensed' }}>{label}</span>
    </button>
  );
}

function MobileBtn({ icon, onClick, active, danger, badge }) {
  const col = danger ? '#dc2626' : C.blue;
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid ' + (active ? col : 'transparent'), background: active ? col + '14' : 'transparent', color: active ? col : C.textDim, cursor: 'pointer', fontSize: 18, position: 'relative', minHeight: 38 }}>
      {icon}
      {badge != null && badge > 0 && <span style={{ position: 'absolute', top: 2, right: 4, background: C.blue, color: '#fff', borderRadius: 8, fontSize: 9, padding: '1px 5px', minWidth: 14, fontFamily: 'DM Mono', fontWeight: 700 }}>{badge}</span>}
    </button>
  );
}

const mobMenuBtn = { width: '100%', padding: '12px', border: '1px solid ' + C.border, background: C.card, borderRadius: 8, color: C.navyDark, fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow Condensed', fontWeight: 600, marginBottom: 4 };

function PinIndexRow({ pin, onClick, currentUser }) {
  return (
    <div onClick={onClick} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}
      onMouseEnter={e => e.currentTarget.style.background = C.surface} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ background: pCol(pin, currentUser), borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: 'DM Mono', flexShrink: 0 }}>{pin.id}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.navyDark, fontFamily: 'Barlow Condensed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.repairName || 'Unnamed'}</div>
        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: 'DM Mono' }}>{getMeas(pin)}</div>
      </div>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: SC[pin.status] || C.border, flexShrink: 0 }}/>
    </div>
  );
}

function OnlineBanner({ online }) {
  if (online) return null;
  return (
    <div style={{ position: 'fixed', top: 'env(safe-area-inset-top)', left: '50%', transform: 'translateX(-50%)', background: '#ea580c', color: '#fff', padding: '4px 14px', fontSize: 10, fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: 1.5, borderRadius: '0 0 8px 8px', zIndex: 1000 }}>● OFFLINE</div>
  );
}

// Pins layer — extracted so memo'd Markers don't re-render unnecessarily
function PinsLayer({ pins, selectedPinId, movingPinId, deleteMode, fitDims, onMarkerClick, currentUser }) {
  return (
    <div style={{ position: 'absolute', left: fitDims.ox, top: fitDims.oy, width: fitDims.w, height: fitDims.h, pointerEvents: 'auto' }}>
      {pins.map(pin => (
        <Marker
          key={pin.id}
          pin={pin}
          x={pin.x * fitDims.w}
          y={pin.y * fitDims.h}
          selected={selectedPinId === pin.id}
          isMoving={movingPinId === pin.id}
          isDeleting={deleteMode}
          onClick={onMarkerClick}
          currentUser={currentUser}/>
      ))}
    </div>
  );
}

// Loads photo blob just to read its natural dims into App state
function ImgDimsLoader({ photoId, onLoad }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getPhotoUrl(photoId).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [photoId]);
  if (!url) return null;
  return <img src={url} style={{ display: 'none' }} onLoad={e => onLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} alt=""/>;
}
